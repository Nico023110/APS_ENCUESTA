/* =========================================================================
   APS APP — Cargar la base de caracterizaciones previas a la app
   -------------------------------------------------------------------------
   Uso:
     node bd/cargar_base_previa.js --archivo "<ruta del .xlsx>"            (ensayo)
     node bd/cargar_base_previa.js --archivo "<ruta del .xlsx>" --cargar

     Contra la copia local:
     node -r ./bd/base_local.js bd/cargar_base_previa.js --archivo "…" --cargar

   Sin --cargar sólo lee el Excel y dice qué cargaría; no se conecta a la
   base. Con --cargar escribe en la base de DATABASE_URL (en .env.local es
   Neon, la de producción: se muestra antes de escribir) en una transacción:
   o queda todo o no queda nada. Volver a cargar el mismo archivo (misma
   huella SHA-256) reemplaza lo que había cargado.

   El Excel es «BASE DE DATOS IDENTIFICACIONES (EBS) AÑO 2025 - PRIMER
   SEMESTRE 2026, MIGRAR APP»: una fila por persona, con los datos de su
   vivienda repetidos. Aquí se agrupa por «NUMERO UNICO DE VIVIENDA» y se
   guarda sólo lo que sirve para reconocer la vivienda (ver
   bd/20_base_previa.sql): nada de nombres, nacimientos ni salud.

   Lo que se corrige al leer, y por qué:
   - Coordenadas: el Excel perdió el punto decimal (3443338 → 3.443338). Con
     menos de 4 decimales o fuera de Cali quedan vacías (cruce.js).
   - Fechas: casi todas son seriales de Excel; unas 300 vienen como texto
     mes/día/año. Fuera de enero de 2025 – junio de 2026 se prueba con día y
     mes cruzados y, si tampoco, con la fecha en que se digitó la vivienda.
   - Territorio «T82 » → T82; microterritorio «MTO2» → MT02, «MT4» → MT04.
   - Documento: sólo letras y dígitos; menos de 5 no identifica a nadie.
   - Quien caracterizó: si el nombre viene en «0», se toma el que tiene su
     documento (ítem 17) en las demás filas; los nombres, con mayúscula
     inicial. El barrio pierde el «- ESE LADERA» que trae pegado.
   La salida nunca muestra datos de personas: sólo cuentas.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { leerXlsx, fechaDeSerial } = require(path.join(__dirname, 'leer_xlsx.js'));
const CRUCE = require(path.join(__dirname, '..', 'cruce.js'));

/* Lo que cubre la base: lo de fuera es un error de digitación. */
const FECHA_MINIMA = '2025-01-01';
const FECHA_MAXIMA = '2026-06-30';

/* Columnas que se leen, por el comienzo de su encabezado (sin tildes ni
   mayúsculas): el Excel puede cambiar de orden. */
const COLUMNAS = {
  territorio: '4. territorio',
  microterritorio: '5. microterritorio',
  division: '6. corregimiento',
  direccion: '7. direccion',
  latitud: '8.1 geopunto',
  longitud: '8.2 geopunto',
  referencia: '9. ubicacion del hogar',
  familia: '10. numero de identificacion de la familia',
  ebs: '15. numero de identificacion del equipo basico de salud (ebs) vivien',
  responsableDocumento: '17. numero de identificacion del responsable',
  responsable: '17.1 nombre del responsable',
  perfil: '18. perfil de quien realiza',
  vivienda: 'numero unico de vivienda',
  fecha: '20. fecha diligenciamiento',
  tipoId: '53. tipo de identificacion',
  numeroId: '54. numero de identificacion',
  digitada: 'hora de inicio vivien'
};

function normal(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function ubicarColumnas(encabezados) {
  const normales = encabezados.map(normal);
  const indices = {};
  const faltan = [];
  Object.keys(COLUMNAS).forEach(function (campo) {
    /* «diligencimiento» viene así en el Excel: se acepta con y sin la a. */
    const prefijo = COLUMNAS[campo];
    const i = normales.findIndex(function (h) {
      return h.indexOf(prefijo) === 0 || h.replace('diligencimiento', 'diligenciamiento').indexOf(prefijo) === 0;
    });
    if (i < 0) faltan.push(prefijo);
    indices[campo] = i;
  });
  if (faltan.length) throw new Error('Al Excel le faltan columnas: ' + faltan.join('; '));
  return indices;
}

/* «0», «#N/A» y vacío son lo mismo: nada. */
function valor(texto) {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  if (limpio === '' || limpio === '0' || /^#N\/A$/i.test(limpio) || /^N\/?A$/i.test(limpio)) return null;
  return limpio;
}

function territorioNormal(texto) {
  const t = String(texto || '').toUpperCase().replace(/\s+/g, '');
  return /^T\d{1,3}$/.test(t) ? t : null;
}

function microterritorioNormal(texto) {
  const t = String(texto || '').toUpperCase().replace(/\s+/g, '').replace(/^MTO/, 'MT0');
  const m = /^MT(\d{1,2})$/.exec(t);
  return m ? 'MT' + m[1].padStart(2, '0') : null;
}

/* «SAN PASCUAL - COMUNA 3 - ESE LADERA» → «SAN PASCUAL - COMUNA 3»: en la
   base anterior más de la mitad lleva el nombre de la E.S.E., que no ubica. */
function lugarNormal(texto) {
  const limpio = valor(texto);
  if (!limpio) return null;
  return valor(limpio.replace(/\s*-?\s*E\.?\s?S\.?\s?E\.?\s+LADERA\s*$/i, '').replace(/[\s-]+$/, ''));
}

/* Quien caracterizó: «gloria patricia casaran» → «Gloria Patricia Casaran».
   Un número en lugar del nombre no es un nombre. */
function nombreDePersona(texto) {
  const limpio = valor(texto);
  if (!limpio || /^\d+$/.test(limpio)) return null;
  return limpio.toLocaleLowerCase('es-CO').replace(/(^|[\s'-])(\p{L})/gu, function (todo, antes, letra) {
    return antes + letra.toLocaleUpperCase('es-CO');
  });
}

/* «EBS033 - Comuna 3» → { codigo: 'EBS033', nombre: 'Comuna 3' }. */
function equipoDe(texto) {
  const limpio = valor(texto);
  if (!limpio) return { codigo: null, nombre: null };
  const m = /^(EBS\s*\d{1,3})\s*-?\s*(.*)$/i.exec(limpio);
  if (!m) return { codigo: null, nombre: limpio };
  const numero = m[1].replace(/\D/g, '');
  return { codigo: 'EBS' + numero.padStart(3, '0'), nombre: valor(m[2]) };
}

/* «CC-Cédula de Ciudadanía» → CC. */
function tipoDeDocumento(texto) {
  const m = /^\s*([A-Za-z]{2})\s*-/.exec(String(texto || ''));
  return m ? m[1].toUpperCase() : 'ND';
}

function enRango(iso) {
  return iso !== null && iso >= FECHA_MINIMA && iso <= FECHA_MAXIMA;
}

function iso(anio, mes, dia) {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString().slice(0, 10);
}

/* Serial de Excel (con o sin hora) o texto mes/día/año. */
function leerFecha(texto) {
  const limpio = valor(texto);
  if (!limpio) return null;
  if (/^\d+(\.\d+)?$/.test(limpio)) return fechaDeSerial(limpio);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(limpio);
  if (m) return iso(Number(m[3]), Number(m[1]), Number(m[2]));
  const i = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpio);
  return i ? iso(Number(i[1]), Number(i[2]), Number(i[3])) : null;
}

/** La fecha de la visita, corregida si hace falta. @returns {{fecha:string|null, como:string}} */
function fechaDeVisita(textoFecha, textoDigitada) {
  const leida = leerFecha(textoFecha);
  if (enRango(leida)) return { fecha: leida, como: 'tal cual' };
  if (leida) {
    const [a, m, d] = leida.split('-').map(Number);
    const cruzada = d <= 12 ? iso(a, d, m) : null;
    if (enRango(cruzada)) return { fecha: cruzada, como: 'dia y mes cruzados' };
  }
  const digitada = leerFecha(textoDigitada);
  if (enRango(digitada)) return { fecha: digitada, como: 'fecha de digitacion' };
  return { fecha: null, como: 'sin fecha' };
}

function masFrecuente(lista) {
  const cuentas = new Map();
  lista.forEach(function (v) { if (v !== null && v !== undefined) cuentas.set(v, (cuentas.get(v) || 0) + 1); });
  let mejor = null;
  let veces = 0;
  cuentas.forEach(function (n, v) { if (n > veces) { mejor = v; veces = n; } });
  return mejor;
}

/**
 * Agrupa las filas (una por persona) en viviendas.
 * @returns {{viviendas:object[], resumen:object}}
 */
function agruparViviendas(filas) {
  const c = ubicarColumnas(filas[0] || []);
  const porVivienda = new Map();
  const resumen = {
    filas: 0, filasSinVivienda: 0, personas: 0, documentosCruzables: 0, documentosSinCruce: 0,
    fechas: { 'tal cual': 0, 'dia y mes cruzados': 0, 'fecha de digitacion': 0, 'sin fecha': 0 }
  };

  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    if (!f || !f.some(function (v) { return v !== null && v !== undefined && v !== ''; })) continue;
    resumen.filas++;
    const numero = valor(f[c.vivienda]);
    if (!numero) { resumen.filasSinVivienda++; continue; }

    let v = porVivienda.get(numero);
    if (!v) {
      v = { numero: numero, filas: [] };
      porVivienda.set(numero, v);
    }
    v.filas.push(f);
  }

  /* En una de cada tres filas el nombre de quien caracterizó viene en «0»,
     pero su documento (ítem 17) siempre está: el nombre se completa con el
     que tiene ese documento en las demás filas. El documento no se guarda. */
  const nombresPorDocumento = new Map();
  porVivienda.forEach(function (v) {
    v.filas.forEach(function (f) {
      const documento = valor(f[c.responsableDocumento]);
      const nombre = nombreDePersona(f[c.responsable]);
      if (!documento || !nombre) return;
      const lista = nombresPorDocumento.get(documento) || [];
      lista.push(nombre);
      nombresPorDocumento.set(documento, lista);
    });
  });
  const nombreDelResponsable = function (filasVivienda) {
    const propio = masFrecuente(filasVivienda.map(function (f) { return nombreDePersona(f[c.responsable]); }));
    if (propio) return propio;
    const documento = masFrecuente(filasVivienda.map(function (f) { return valor(f[c.responsableDocumento]); }));
    return documento && nombresPorDocumento.has(documento) ? masFrecuente(nombresPorDocumento.get(documento)) : null;
  };

  const viviendas = [];
  porVivienda.forEach(function (v) {
    const fechas = [];
    const personas = new Map();
    let punto = null;

    v.filas.forEach(function (f) {
      const visita = fechaDeVisita(f[c.fecha], f[c.digitada]);
      resumen.fechas[visita.como]++;
      if (visita.fecha) fechas.push(visita.fecha);

      if (!punto) {
        punto = CRUCE.puntoEnCali(CRUCE.coordenadaDeTexto(f[c.latitud], 1), CRUCE.coordenadaDeTexto(f[c.longitud], 2));
      }

      resumen.personas++;
      /* Un número guardado como decimal en Excel llega «31234567.0». */
      const documento = CRUCE.documentoDeCruce(String(f[c.numeroId] || '').replace(/\.0+$/, ''));
      if (!documento) { resumen.documentosSinCruce++; return; }
      resumen.documentosCruzables++;
      const tipo = tipoDeDocumento(f[c.tipoId]);
      personas.set(tipo + '|' + documento, { tipo: tipo, numero: documento });
    });

    const columna = function (indice) { return v.filas.map(function (f) { return valor(f[indice]); }); };
    const direccion = masFrecuente(columna(c.direccion));
    const equipo = equipoDe(masFrecuente(columna(c.ebs)));
    const familias = new Set(columna(c.familia).filter(Boolean));
    fechas.sort();

    viviendas.push({
      numero: v.numero,
      territorio: masFrecuente(v.filas.map(function (f) { return territorioNormal(f[c.territorio]); })),
      microterritorio: masFrecuente(v.filas.map(function (f) { return microterritorioNormal(f[c.microterritorio]); })),
      division: masFrecuente(v.filas.map(function (f) { return lugarNormal(f[c.division]); })),
      direccion: direccion,
      clave: CRUCE.claveDeDireccion(direccion),
      latitud: punto ? punto.latitud : null,
      longitud: punto ? punto.longitud : null,
      referencia: masFrecuente(columna(c.referencia)),
      primeraFecha: fechas.length ? fechas[0] : null,
      ultimaFecha: fechas.length ? fechas[fechas.length - 1] : null,
      ebsCodigo: equipo.codigo,
      ebsNombre: equipo.nombre,
      responsable: nombreDelResponsable(v.filas),
      perfil: masFrecuente(columna(c.perfil)),
      familias: Math.max(1, familias.size),
      personas: v.filas.length,
      documentos: Array.from(personas.values())
    });
  });

  resumen.viviendas = viviendas.length;
  resumen.conDireccion = viviendas.filter(function (v) { return v.direccion; }).length;
  resumen.conClave = viviendas.filter(function (v) { return v.clave; }).length;
  resumen.conPunto = viviendas.filter(function (v) { return v.latitud !== null; }).length;
  resumen.sinFecha = viviendas.filter(function (v) { return !v.ultimaFecha; }).length;
  resumen.conResponsable = viviendas.filter(function (v) { return v.responsable; }).length;
  resumen.sinTerritorio = viviendas.filter(function (v) { return !v.territorio; }).length;
  resumen.ilocalizables = viviendas.filter(function (v) {
    return !v.clave && v.latitud === null && v.documentos.length === 0;
  }).length;
  const fechasValidas = viviendas.map(function (v) { return v.primeraFecha; }).filter(Boolean).sort();
  const ultimas = viviendas.map(function (v) { return v.ultimaFecha; }).filter(Boolean).sort();
  resumen.desde = fechasValidas[0] || null;
  resumen.hasta = ultimas[ultimas.length - 1] || null;
  const porEquipo = new Map();
  viviendas.forEach(function (v) { const k = v.ebsCodigo || '(sin código)'; porEquipo.set(k, (porEquipo.get(k) || 0) + 1); });
  resumen.porEquipo = Array.from(porEquipo.entries()).sort();
  return { viviendas: viviendas, resumen: resumen };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];

function periodoDe(desde, hasta) {
  if (!desde || !hasta) return 'sin fechas';
  const mes = function (isoFecha) { return MESES[Number(isoFecha.slice(5, 7)) - 1] + ' de ' + isoFecha.slice(0, 4); };
  return mes(desde) + ' a ' + mes(hasta);
}

/* ---------- Escritura ---------- */

async function cargar(cliente, archivo, huella, viviendas, resumen) {
  const existe = (await cliente.query("SELECT to_regclass('hist.vivienda') IS NOT NULL AS hay")).rows[0].hay;
  if (!existe) throw new Error('La base no tiene las tablas de hist: aplique antes npm run bd:migrar (archivo 20).');

  await cliente.query('BEGIN');
  try {
    const anterior = await cliente.query('DELETE FROM hist.carga WHERE huella = $1 RETURNING id', [huella]);
    const cargaId = (await cliente.query(`
      INSERT INTO hist.carga (archivo, huella, periodo, viviendas, personas)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [archivo, huella, periodoDe(resumen.desde, resumen.hasta), viviendas.length, resumen.personas])).rows[0].id;

    const columnas = ['numero', 'territorio', 'microterritorio', 'division', 'direccion', 'clave', 'latitud', 'longitud',
      'referencia', 'primeraFecha', 'ultimaFecha', 'ebsCodigo', 'ebsNombre', 'responsable', 'perfil', 'familias', 'personas'];
    const arreglos = columnas.map(function (col) { return viviendas.map(function (v) { return v[col]; }); });
    const insertadas = await cliente.query(`
      INSERT INTO hist.vivienda (
        carga_id, numero_anterior, territorio, microterritorio, division_territorial, direccion, clave_direccion,
        latitud, longitud, punto_referencia, primera_fecha, ultima_fecha, ebs_codigo, ebs_nombre,
        responsable, perfil_responsable, familias, personas)
      SELECT $1, * FROM unnest(
        $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
        $8::numeric[], $9::numeric[], $10::text[], $11::date[], $12::date[], $13::text[], $14::text[],
        $15::text[], $16::text[], $17::int[], $18::int[])
      RETURNING id, numero_anterior
    `, [cargaId].concat(arreglos));

    const idPorNumero = new Map(insertadas.rows.map(function (r) { return [r.numero_anterior, r.id]; }));
    const ids = [];
    const tipos = [];
    const numeros = [];
    viviendas.forEach(function (v) {
      v.documentos.forEach(function (d) {
        ids.push(idPorNumero.get(v.numero));
        tipos.push(d.tipo);
        numeros.push(d.numero);
      });
    });
    await cliente.query(`
      INSERT INTO hist.persona (vivienda_id, tipo_id, numero_id)
      SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[])
    `, [ids, tipos, numeros]);

    await cliente.query('COMMIT');
    return { cargaId: cargaId, reemplazo: anterior.rowCount > 0, viviendas: insertadas.rowCount, documentos: ids.length };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(function () {});
    throw error;
  }
}

/* ---------- Programa ---------- */

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

function imprimirResumen(archivo, r) {
  const pct = function (n, d) { return d ? ' (' + Math.round(100 * n / d) + ' %)' : ''; };
  console.log('\n  Archivo: ' + path.basename(archivo));
  console.log('  Período: ' + periodoDe(r.desde, r.hasta));
  console.log('  Filas (personas): ' + r.filas + (r.filasSinVivienda ? '  · sin número de vivienda: ' + r.filasSinVivienda : ''));
  console.log('  Viviendas: ' + r.viviendas);
  console.log('    con dirección legible para cruzar: ' + r.conClave + pct(r.conClave, r.viviendas) +
    '   (con dirección escrita: ' + r.conDireccion + ')');
  console.log('    con coordenadas en Cali:           ' + r.conPunto + pct(r.conPunto, r.viviendas));
  console.log('    con el nombre de quien caracterizó: ' + r.conResponsable + pct(r.conResponsable, r.viviendas));
  console.log('    sin fecha válida:                  ' + r.sinFecha);
  console.log('    sin territorio:                    ' + r.sinTerritorio);
  console.log('    sin dirección, punto ni documento: ' + r.ilocalizables);
  console.log('  Documentos para cruzar: ' + r.documentosCruzables + '  · sin documento útil: ' + r.documentosSinCruce);
  console.log('  Fechas de visita (por persona): ' + Object.keys(r.fechas).map(function (k) { return k + ' ' + r.fechas[k]; }).join(' · '));
  console.log('  Viviendas por EBS: ' + r.porEquipo.map(function (e) { return e[0] + ' ' + e[1]; }).join(', '));
}

async function principal() {
  const archivo = argumento('--archivo');
  if (!archivo) {
    console.error('\nUso: node bd/cargar_base_previa.js --archivo "<ruta del .xlsx>" [--cargar]\n');
    process.exit(1);
  }
  const buffer = fs.readFileSync(archivo);
  const huella = crypto.createHash('sha256').update(buffer).digest('hex');
  const { filas } = leerXlsx(buffer);
  const { viviendas, resumen } = agruparViviendas(filas);
  imprimirResumen(archivo, resumen);

  if (process.argv.indexOf('--cargar') < 0) {
    console.log('\n  Ensayo: no se escribió nada. Para cargar, agregue --cargar.\n');
    return;
  }

  require('dotenv').config({ path: [path.join(__dirname, '..', '.env.local'), path.join(__dirname, '..', '.env')], quiet: true });
  const { Client } = require('pg');
  const { opcionesConexion } = require(path.join(__dirname, '..', 'api', '_db.js'));
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!cadena) throw new Error('No hay DATABASE_URL.');
  const url = new URL(cadena);
  console.log('\n  Base: ' + url.hostname + '/' + url.pathname.replace(/^\//, ''));

  const cliente = new Client(opcionesConexion(cadena));
  await cliente.connect();
  try {
    const r = await cargar(cliente, path.basename(archivo), huella, viviendas, resumen);
    console.log('  Cargado: ' + r.viviendas + ' viviendas y ' + r.documentos + ' documentos' +
      (r.reemplazo ? ' (reemplazó la carga anterior del mismo archivo)' : '') + '.\n');
  } finally {
    await cliente.end();
  }
}

if (require.main === module) {
  principal().catch(function (error) {
    console.error('\nERROR: ' + error.message + '\n');
    process.exit(1);
  });
}

module.exports = { agruparViviendas, fechaDeVisita, equipoDe, tipoDeDocumento, microterritorioNormal,
  territorioNormal, periodoDe, cargar };
