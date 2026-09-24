/* =========================================================================
   Encuesta_APS — POST /api/reporte_sispro
   -------------------------------------------------------------------------
   Genera el archivo plano APS124CCFP del anexo técnico SI-APS para cargarlo
   en PISIS. Cuerpo: { desde: 'AAAA-MM-DD', hasta: 'AAAA-MM-DD',
   formato: 'resumen' | 'archivo' }.

     resumen   JSON con el nombre del archivo, los conteos y las incidencias
               agrupadas por variable (qué fichas corregir antes de enviar).
     archivo   el .TXT, para descargar y firmar digitalmente.

   El archivo lleva los datos de todas las personas del período, sensibles
   incluidos, así que:
     - sólo lo generan los roles con «reporte.generar» (administrador y
       maestro), con sesión y cabecera anti-CSRF: es POST a propósito, para
       que un enlace o una imagen de otro sitio no puedan dispararlo;
     - el período se valida estrictamente y tiene tope de un año;
     - cada generación queda en aud.evento (quién, cuándo, qué período).
     - el resumen no trae datos personales: sólo códigos de ficha.

   Qué fichas entran: diligenciadas dentro del período, con consentimiento y
   cerradas. De cada hogar, sólo la visita más reciente del período: el
   anexo usa el ID de la familia como llave primaria y no admite repetirlo.
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const { leerFichasCompletas } = require('./_ficha_completa');
const { construirReporte } = require('./_reporte_sispro');

const TAMANO_LOTE = 500;
const MAX_DIAS = 366;
/* Tope por archivo: la función arma el reporte en memoria. Un mes de la red
   queda muy por debajo; un período mayor se divide. */
const MAX_FICHAS = 10000;
const FORMATOS = ['resumen', 'archivo'];

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

    const parametros = await leerParametros(cliente);
    if (!/^(NI|MU|DE|DI)$/.test(parametros.entidad.tipo) || !/^\d{1,12}$/.test(parametros.entidad.numero)) {
      return res.status(500).json({ error: 'Falta configurar la entidad que reporta (cat.parametro «entidad_reportante»).' });
    }

    const conteo = (await cliente.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE NOT consentimiento)::int AS sin_consentimiento,
             count(*) FILTER (WHERE consentimiento AND estado NOT IN ('cerrada', 'sincronizada'))::int AS no_cerradas
        FROM aps.ficha
       WHERE fecha_diligenciamiento BETWEEN $1 AND $2
    `, [periodo.desde, periodo.hasta])).rows[0];

    const ids = (await cliente.query(`
      SELECT id FROM (
        SELECT DISTINCT ON (f.hogar_id) f.id, f.fecha_diligenciamiento
          FROM aps.ficha f
         WHERE f.fecha_diligenciamiento BETWEEN $1 AND $2
           AND f.consentimiento
           AND f.estado IN ('cerrada', 'sincronizada')
         ORDER BY f.hogar_id, f.fecha_diligenciamiento DESC, f.id DESC
      ) ultimas
      ORDER BY fecha_diligenciamiento, id
    `, [periodo.desde, periodo.hasta])).rows.map(function (f) { return String(f.id); });

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
        visitasAnterioresDelMismoHogar: Math.max(0, conteo.total - conteo.sin_consentimiento - conteo.no_cerradas - fichas.length)
      },
      registros: reporte.resumen.registros,
      incidencias: reporte.resumen.incidencias,
      avisos: parametros.subregion ? [] : [
        'Falta el código de subregión (variable 4): configure «subregion_sispro» con los 3 dígitos ' +
        'parametrizados en la gestión técnica del SI-APS. Sin él, las variables 4, 123 y 124 salen vacías.'
      ]
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
