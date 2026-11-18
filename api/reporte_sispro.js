/* =========================================================================
   Encuesta_APS — POST /api/reporte_sispro
   -------------------------------------------------------------------------
   Genera el archivo plano APS124CCFP del anexo técnico SI-APS para cargarlo
   en PISIS, y las fichas en Excel. Cuerpo: { desde: 'AAAA-MM-DD',
   hasta: 'AAAA-MM-DD', formato: 'resumen' | 'archivo' | 'excel' }.

     resumen   JSON con el nombre del archivo, los conteos y las incidencias
               agrupadas por variable (qué fichas corregir antes de enviar).
     archivo   el .TXT, para descargar y firmar digitalmente.
     excel     las fichas del período en un libro de Excel legible
               (api/_excel_fichas.js). Va aquí y no en un endpoint propio:
               mismo permiso, mismo período, misma auditoría.

   El archivo lleva los datos de todas las personas del período, sensibles
   incluidos, así que:
     - sólo lo generan los roles con «reporte.generar» (administrador y
       maestro), con sesión y cabecera anti-CSRF: es POST a propósito, para
       que un enlace o una imagen de otro sitio no puedan dispararlo;
     - el período se valida estrictamente y tiene tope de un año;
     - cada generación queda en aud.evento (quién, cuándo, qué período).
     - el resumen no trae datos personales: sólo códigos de ficha.

   Qué fichas entran: diligenciadas dentro del período, con consentimiento,
   cerradas y completas —todos los integrantes del ítem 51 y una familia en
   cada hogar del ítem 28 (api/_completitud.js)—. Una ficha incompleta queda
   por fuera y entra en el período en que se complete, aunque su visita sea
   anterior. De cada hogar, sólo la visita más reciente: el anexo usa el ID
   de la familia como llave primaria y no admite repetirlo.
   El Excel, en cambio, trae todas las visitas con consentimiento del período,
   cerradas o no: es la caracterización para consultar, no el reporte.
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const { leerFichasCompletas } = require('./_ficha_completa');
const { construirReporte } = require('./_reporte_sispro');
const { construirExcel } = require('./_excel_fichas');
const { obtenerMotor } = require('./_validacion');
const { SQL_FICHA_INCOMPLETA, SQL_COMPLETADA_EL } = require('./_completitud');

/* AAAA-MM-DD de un DATE de la base (pg lo entrega como Date a medianoche local). */
function fechaTexto(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.slice(0, 10);
  const d = new Date(valor);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TAMANO_LOTE = 500;
const MAX_DIAS = 366;
/* Tope por archivo: la función arma el reporte en memoria. Un mes de la red
   queda muy por debajo; un período mayor se divide. */
const MAX_FICHAS = 10000;
const FORMATOS = ['resumen', 'archivo', 'excel'];

/* Fecha real AAAA-MM-DD: 2026-02-30 no pasa. */
function fechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(texto + 'T00:00:00Z');
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) return null;
  return fecha;
}

function validarPeriodo(cuerpo) {
  const datos = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const desde = fechaValida(datos.desde);
  const hasta = fechaValida(datos.hasta);
  if (!desde || !hasta) return { error: 'Indique las fechas del período en formato AAAA-MM-DD.' };
  if (desde > hasta) return { error: 'La fecha inicial es posterior a la final.' };
  if ((hasta - desde) / 86400000 >= MAX_DIAS) return { error: 'El período no puede superar un año.' };
  const formato = datos.formato === undefined ? 'resumen' : datos.formato;
  if (FORMATOS.indexOf(formato) === -1) return { error: 'Formato no reconocido.' };
  return { desde: datos.desde, hasta: datos.hasta, formato: formato };
}

/* Entidad que reporta y subregión: parámetros institucionales, no código. */
async function leerParametros(cliente) {
  const filas = (await cliente.query(
    "SELECT clave, valor FROM cat.parametro WHERE clave IN ('entidad_reportante', 'subregion_sispro', 'nit_prestador_primario')"
  )).rows;
  const valor = function (clave) {
    const fila = filas.find(function (f) { return f.clave === clave; });
    return fila ? fila.valor : null;
  };
  const entidad = valor('entidad_reportante') || {};
  const subregion = valor('subregion_sispro');
  return {
    entidad: { tipo: String(entidad.tipo || ''), numero: String(entidad.numero || ''), nombre: entidad.nombre || null },
    subregion: typeof subregion === 'string' && /^\d{3}$/.test(subregion) ? subregion : null,
    nitPrestador: valor('nit_prestador_primario')
  };
}

/* Nombre de cada acción del plan, del catálogo (CUPS y NoCUPS). */
async function nombresDeAcciones(cliente, fichas) {
  const codigos = new Set();
  fichas.forEach(function (leida) {
    const e = leida.encuesta;
    const planes = [e.planVivienda];
    (e.familias || []).forEach(function (f) {
      planes.push(f.planFamilia);
      (f.integrantes || []).forEach(function (i) { planes.push(i.planPersona); });
    });
    planes.filter(Boolean).forEach(function (p) {
      (p.acciones || []).forEach(function (a) { if (a.codigoAccion) codigos.add(String(a.codigoAccion)); });
    });
  });
  const nombres = {};
  if (codigos.size === 0) return nombres;
  (await cliente.query('SELECT codigo, nombre FROM cat.cups WHERE codigo = ANY($1)', [Array.from(codigos)])).rows
    .forEach(function (fila) { nombres[fila.codigo] = fila.nombre; });
  return nombres;
}

async function enviarExcel(cliente, periodo, usuario, res) {
  const ids = (await cliente.query(`
    SELECT id FROM aps.ficha
     WHERE fecha_diligenciamiento BETWEEN $1 AND $2 AND consentimiento
     ORDER BY fecha_diligenciamiento, id
  `, [periodo.desde, periodo.hasta])).rows.map(function (f) { return String(f.id); });

  if (ids.length === 0) return res.status(404).json({ error: 'No hay fichas con consentimiento en el período.' });
  if (ids.length > MAX_FICHAS) {
    return res.status(400).json({
      error: 'El período tiene ' + ids.length + ' fichas y un libro admite hasta ' + MAX_FICHAS + '. Elija un período más corto.'
    });
  }

  const fichas = [];
  for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
    Array.prototype.push.apply(fichas, await leerFichasCompletas(cliente, ids.slice(i, i + TAMANO_LOTE)));
  }

  const libro = construirExcel({
    fichas: fichas, motor: obtenerMotor(), nombresAcciones: await nombresDeAcciones(cliente, fichas),
    desde: periodo.desde, hasta: periodo.hasta, generadoPor: usuario.nombre || usuario.documento
  });

  /* RN-225: quién descargó qué período y cuántas personas trae. */
  await cliente.query(`
    INSERT INTO aud.evento (entidad, tipo, campo, valor_nuevo, funcionario_id)
    VALUES ('fichas_excel', 'consulta_sensible', 'excel', $1, $2)
  `, [JSON.stringify({ archivo: libro.nombreArchivo, desde: periodo.desde, hasta: periodo.hasta,
    fichas: libro.totales.fichas, personas: libro.totales.personas }), usuario.funcionarioId]);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="' + libro.nombreArchivo + '"');
  res.setHeader('X-Nombre-Archivo', libro.nombreArchivo);
  return res.end(libro.contenido);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res, { permiso: 'reporte.generar' });
  if (!usuario) return;

  const periodo = validarPeriodo(req.body);
  if (periodo.error) return res.status(400).json({ error: periodo.error });

  let cliente;
  try {
    cliente = await obtenerPool().connect();

    if (periodo.formato === 'excel') return await enviarExcel(cliente, periodo, usuario, res);

    const parametros = await leerParametros(cliente);
    if (!/^(NI|MU|DE|DI)$/.test(parametros.entidad.tipo) || !/^\d{1,12}$/.test(parametros.entidad.numero)) {
      return res.status(500).json({ error: 'Falta configurar la entidad que reporta (cat.parametro «entidad_reportante»).' });
    }

    const conteo = (await cliente.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE NOT f.consentimiento)::int AS sin_consentimiento,
             count(*) FILTER (WHERE f.consentimiento AND f.estado NOT IN ('cerrada', 'sincronizada'))::int AS no_cerradas,
             count(*) FILTER (WHERE f.consentimiento AND f.estado IN ('cerrada', 'sincronizada')
                                AND ${SQL_FICHA_INCOMPLETA})::int AS incompletas
        FROM aps.ficha f
       WHERE f.fecha_diligenciamiento BETWEEN $1 AND $2
    `, [periodo.desde, periodo.hasta])).rows[0];

    /* RN-051 / RN-028: una ficha con integrantes u hogares por caracterizar
       no va al plano —PISIS no admite la familia ni la vivienda a medias—; va
       en el del período en que se complete, aunque su visita sea anterior. De
       cada hogar, la visita más reciente. */
    const seleccion = (await cliente.query(`
      SELECT id, codigo, fecha_diligenciamiento, completada_el, tardia FROM (
        SELECT DISTINCT ON (c.hogar_id) c.id, c.codigo, c.fecha_diligenciamiento, c.completada_el,
               c.fecha_diligenciamiento < $1 AS tardia
          FROM (
            SELECT f.id, f.codigo, f.hogar_id, f.fecha_diligenciamiento, ${SQL_COMPLETADA_EL} AS completada_el
              FROM aps.ficha f
             WHERE f.fecha_diligenciamiento <= $2
               AND f.consentimiento
               AND f.estado IN ('cerrada', 'sincronizada')
               AND NOT ${SQL_FICHA_INCOMPLETA}
          ) c
         WHERE c.fecha_diligenciamiento BETWEEN $1 AND $2
            OR (c.fecha_diligenciamiento < $1 AND c.completada_el BETWEEN $1 AND $2)
         ORDER BY c.hogar_id, c.fecha_diligenciamiento DESC, c.id DESC
      ) ultimas
      ORDER BY fecha_diligenciamiento, id
    `, [periodo.desde, periodo.hasta])).rows;
    const ids = seleccion.map(function (f) { return String(f.id); });
    const tardias = seleccion.filter(function (f) { return f.tardia; });

    /* Las del período que quedan por fuera por incompletas: sólo su código y
       cuánto les falta, para completarlas en la aplicación. */
    const incompletas = conteo.incompletas === 0 ? [] : (await cliente.query(`
      SELECT f.codigo, f.fecha_diligenciamiento,
             coalesce((SELECT sum(greatest(ff.numero_integrantes - (SELECT count(*) FROM aps.integrante i
                                                                     WHERE i.familia_ficha_id = ff.id), 0))
                         FROM aps.familia_ficha ff WHERE ff.ficha_id = f.id), 0)::int AS integrantes,
             coalesce((SELECT greatest(v.hogares_en_vivienda - (
                         SELECT count(DISTINCT coalesce(ff.hogar_numero::text, 'f' || ff.id))
                           FROM aps.familia_ficha ff WHERE ff.ficha_id = f.id), 0)
                         FROM aps.vivienda v
                        WHERE v.ficha_id = f.id AND EXISTS (SELECT 1 FROM aps.familia_ficha x WHERE x.ficha_id = f.id)), 0)::int AS hogares
        FROM aps.ficha f
       WHERE f.fecha_diligenciamiento BETWEEN $1 AND $2
         AND f.consentimiento AND f.estado IN ('cerrada', 'sincronizada')
         AND ${SQL_FICHA_INCOMPLETA}
       ORDER BY f.fecha_diligenciamiento, f.codigo
       LIMIT 500
    `, [periodo.desde, periodo.hasta])).rows;

    if (ids.length > MAX_FICHAS) {
      return res.status(400).json({
        error: 'El período tiene ' + ids.length + ' fichas y un archivo admite hasta ' + MAX_FICHAS +
          '. Genere el reporte por períodos más cortos.'
      });
    }

    const fichas = [];
    for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
      const lote = await leerFichasCompletas(cliente, ids.slice(i, i + TAMANO_LOTE));
      Array.prototype.push.apply(fichas, lote);
    }

    const reporte = construirReporte({
      fichas: fichas,
      desde: periodo.desde,
      hasta: periodo.hasta,
      entidad: parametros.entidad,
      subregion: parametros.subregion,
      nitPrestador: parametros.nitPrestador
    });

    const resumen = {
      nombreArchivo: reporte.nombreArchivo,
      periodo: { desde: periodo.desde, hasta: periodo.hasta },
      entidad: parametros.entidad,
      fichas: {
        enElPeriodo: conteo.total,
        incluidas: fichas.length,
        sinConsentimiento: conteo.sin_consentimiento,
        noCerradas: conteo.no_cerradas,
        incompletas: conteo.incompletas,
        completadasDespues: tardias.length,
        visitasAnterioresDelMismoHogar: Math.max(0,
          conteo.total - conteo.sin_consentimiento - conteo.no_cerradas - conteo.incompletas - (fichas.length - tardias.length))
      },
      /* Sólo códigos de ficha, sin datos personales. */
      incompletas: incompletas.map(function (f) {
        return { codigo: f.codigo, fecha: fechaTexto(f.fecha_diligenciamiento), integrantes: f.integrantes, hogares: f.hogares };
      }),
      completadasDespues: tardias.map(function (f) {
        return { codigo: f.codigo, fecha: fechaTexto(f.fecha_diligenciamiento), completadaEl: fechaTexto(f.completada_el) };
      }),
      registros: reporte.resumen.registros,
      incidencias: reporte.resumen.incidencias,
      /* La subregión sale de la UZPE de cada vivienda; sólo se avisa si alguna
         quedó sin ella (ficha sin UZPE y sin el parámetro de respaldo). */
      avisos: (reporte.resumen.incidencias.detalle.some(function (x) { return x.tipoRegistro === 2 && x.variable === 4; })
        ? ['Hay viviendas sin subregión (variable 4): su ficha no trae UZPE y no está configurado «subregion_sispro». ' +
           'Sin ella, las variables 4, 123 y 124 salen vacías.']
        : []).concat(tardias.length > 0
        ? [tardias.length + (tardias.length === 1 ? ' ficha visitada antes de este período va' : ' fichas visitadas antes de este período van') +
           ' en el archivo porque se completó en él (quedó por fuera de su mes por estar incompleta). Su fecha de ' +
           'caracterización es la de la visita, anterior al período.']
        : [])
    };

    /* RN-225: quién generó qué período, en qué formato y con qué volumen. */
    await cliente.query(`
      INSERT INTO aud.evento (entidad, tipo, campo, valor_nuevo, funcionario_id)
      VALUES ('reporte_sispro', 'consulta_sensible', $1, $2, $3)
    `, [periodo.formato, JSON.stringify({
      archivo: reporte.nombreArchivo, desde: periodo.desde, hasta: periodo.hasta,
      tipo2: resumen.registros.tipo2, tipo3: resumen.registros.tipo3
    }), usuario.funcionarioId]);

    if (periodo.formato === 'archivo') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=us-ascii');
      res.setHeader('Content-Disposition', 'attachment; filename="' + reporte.nombreArchivo + '"');
      res.setHeader('X-Nombre-Archivo', reporte.nombreArchivo);
      return res.end(Buffer.from(reporte.contenido, 'ascii'));
    }

    return res.status(200).json(resumen);
  } catch (error) {
    console.error('Error al generar el reporte SI-APS:', error.message);
    return res.status(500).json({ error: 'No fue posible generar el reporte.' });
  } finally {
    if (cliente) cliente.release();
  }
};
