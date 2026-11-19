/* =========================================================================
   Encuesta_APS — ¿Ya fue caracterizada? (búsqueda y copia para sin señal)
   -------------------------------------------------------------------------
   Antes de ir a una vivienda, el profesional busca si ya la caracterizaron,
   para no repetir el trabajo (decisión del 2026-11-18). Se busca en dos
   lugares:

     - la base anterior a la app (esquema hist, 2025 – primer semestre de
       2026, bd/20_base_previa.sql);
     - las fichas de la app (aps.hogar y su última visita).

   Y de tres maneras, una por búsqueda:

     documento  el de cualquier persona de la vivienda (exacto)
     direccion  la nomenclatura urbana, leída con cruce.js (exacta tras
                normalizar: «Cra 14 # 14-14» = «KR 14 # 14 - 14»)
     cercania   el GPS del teléfono: viviendas a menos de RADIO metros
                (para veredas y direcciones sin nomenclatura)

   El resultado sólo avisa: el profesional decide si la visita va (puede ser
   un seguimiento, o una casa vecina). Dice cuándo, qué EBS, quién, dónde y
   cuántas personas; nunca nombres ni datos de salud.

   Cada búsqueda queda en aud.evento (consulta_sensible), y hay un tope por
   persona para que nadie recorra la base a fuerza de consultas.

   armarCopia: toda la base, para buscar sin señal (base_previa.js la guarda
   cifrada con la bóveda).
   ========================================================================= */

'use strict';

const path = require('path');
const CRUCE = require(path.join(__dirname, '..', 'cruce.js'));

const RADIO_POR_DEFECTO = 30;     // metros: la casa y las de al lado
const RADIO_MAXIMO = 100;
const MAXIMO_RESULTADOS = 25;
const TOPE_BUSQUEDAS = 40;        // por persona
const VENTANA_TOPE_MIN = 10;      // en estos minutos

const ENTIDAD_AUDITORIA = 'base_previa';

const ESTADOS_VISITA = {
  borrador: 'Borrador',
  interrumpida_urgencia: 'Interrumpida por urgencia',
  incompleta_causa_externa: 'Cerrada incompleta',
  rechazada_sin_consentimiento: 'Sin consentimiento',
  cerrada: 'Cerrada',
  sincronizada: 'Cerrada'
};

class ErrorDeBusqueda extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
  }
}

/**
 * Qué se pidió buscar. Una sola manera por búsqueda.
 * @returns {{modo:string, documento?:string, clave?:string, punto?:object, radio?:number, escrito?:string}}
 * @throws ErrorDeBusqueda si no se puede buscar con lo que llegó.
 */
function prepararBusqueda(cuerpo) {
  const modo = String(cuerpo && cuerpo.modo || '');

  if (modo === 'documento') {
    const documento = CRUCE.documentoDeCruce(cuerpo.documento);
    if (!documento) {
      throw new ErrorDeBusqueda('Escriba el número de documento completo, sin puntos (5 caracteres o más).', 'documento');
    }
    return { modo: modo, documento: documento };
  }

  if (modo === 'direccion') {
    const escrito = String(cuerpo.direccion || '').slice(0, 160);
    const clave = CRUCE.claveDeDireccion(escrito);
    if (!clave) {
      throw new ErrorDeBusqueda('No se pudo leer la dirección. Escríbala como «Cra 14 # 14-14»: tipo de vía, número, ' +
        '# número - placa. Para veredas o casas sin nomenclatura use «Cerca de mí».', 'direccion');
    }
    return { modo: modo, clave: clave, escrito: escrito };
  }

  if (modo === 'cercania') {
    const punto = CRUCE.puntoEnCali(cuerpo.latitud, cuerpo.longitud);
    if (!punto) {
      throw new ErrorDeBusqueda('La ubicación del teléfono no está en Cali o no llegó. Inténtelo de nuevo al aire libre.', 'ubicacion');
    }
    const pedido = Number(cuerpo.radio);
    const radio = isFinite(pedido) && pedido > 0 ? Math.min(Math.round(pedido), RADIO_MAXIMO) : RADIO_POR_DEFECTO;
    return { modo: modo, punto: punto, radio: radio };
  }

  throw new ErrorDeBusqueda('Elija cómo buscar: por documento, por dirección o cerca de usted.', 'modo');
}

/* El rectángulo que contiene el círculo: lo filtra el índice, y la distancia
   exacta se mide después. */
function cajaAlrededor(punto, radio) {
  const dLat = radio / 111320;
  const dLon = radio / (111320 * Math.cos(punto.latitud * Math.PI / 180));
  return [punto.latitud - dLat, punto.latitud + dLat, punto.longitud - dLon, punto.longitud + dLon];
}

function numeroONulo(valor) {
  return valor === null || valor === undefined ? null : Number(valor);
}

/* ---------- Base anterior (hist) ---------- */

const COLUMNAS_PREVIA = `
  v.id, v.numero_anterior, v.territorio, v.microterritorio, v.division_territorial, v.direccion,
  v.latitud, v.longitud, v.ultima_fecha::text AS fecha, v.ebs_codigo, v.ebs_nombre, v.responsable,
  v.familias, v.personas, c.periodo`;

async function buscarPrevias(db, b) {
  if (b.modo === 'documento') {
    return (await db.query(`
      SELECT ${COLUMNAS_PREVIA}, array_agg(DISTINCT p.tipo_id) AS tipos
        FROM hist.persona p
        JOIN hist.vivienda v ON v.id = p.vivienda_id
        JOIN hist.carga c ON c.id = v.carga_id
       WHERE p.numero_id = $1
       GROUP BY v.id, c.periodo
       ORDER BY v.ultima_fecha DESC NULLS LAST
       LIMIT ${MAXIMO_RESULTADOS + 1}
    `, [b.documento])).rows;
  }
  if (b.modo === 'direccion') {
    return (await db.query(`
      SELECT ${COLUMNAS_PREVIA}
        FROM hist.vivienda v JOIN hist.carga c ON c.id = v.carga_id
       WHERE v.clave_direccion = $1
       ORDER BY v.ultima_fecha DESC NULLS LAST
       LIMIT ${MAXIMO_RESULTADOS + 1}
    `, [b.clave])).rows;
  }
  const caja = cajaAlrededor(b.punto, b.radio);
  return (await db.query(`
    SELECT ${COLUMNAS_PREVIA}
      FROM hist.vivienda v JOIN hist.carga c ON c.id = v.carga_id
     WHERE v.latitud BETWEEN $1 AND $2 AND v.longitud BETWEEN $3 AND $4
     LIMIT 500
  `, caja)).rows;
}

function deLaPrevia(fila, b) {
  return {
    origen: 'previa',
    periodo: fila.periodo,
    fecha: fila.fecha,
    territorio: fila.territorio,
    microterritorio: fila.microterritorio,
    lugar: fila.division_territorial,
    direccion: fila.direccion,
    equipo: fila.ebs_codigo,
    equipoNombre: fila.ebs_nombre,
    responsable: fila.responsable,
    familias: numeroONulo(fila.familias),
    personas: numeroONulo(fila.personas),
    referencia: fila.numero_anterior ? 'Vivienda ' + fila.numero_anterior + ' de la base anterior' : null,
    tipoDocumento: b.modo === 'documento' && Array.isArray(fila.tipos) ? fila.tipos.join(', ') : null,
    latitud: numeroONulo(fila.latitud),
    longitud: numeroONulo(fila.longitud)
  };
}

/* ---------- Fichas de la app (aps) ---------- */

/* Por documento, la visita más reciente en que estuvo la persona; por
   dirección o cercanía, la última visita de la vivienda. Volver a una casa
   deja otra ficha, no otra vivienda. */
async function visitasDeLaApp(db, b) {
  let candidatas;
  if (b.modo === 'documento') {
    candidatas = (await db.query(`
      SELECT DISTINCT ON (f.hogar_id) f.hogar_id, f.id AS ficha_id
        FROM aps.persona p
        JOIN aps.integrante i     ON i.persona_id = p.id
        JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
        JOIN aps.ficha f          ON f.id = ff.ficha_id
       WHERE upper(p.numero_id) = $1
       ORDER BY f.hogar_id, f.fecha_diligenciamiento DESC, f.id DESC
    `, [b.documento])).rows;
  } else {
    let hogares;
    if (b.modo === 'direccion') {
      /* La dirección de la app ya viene normalizada (direccion.js): la clave
         es su comienzo. Se confirma leyéndola igual, para que «- 14» no traiga
         «- 140». */
      hogares = (await db.query(`
        SELECT id, direccion_normalizada FROM aps.hogar
         WHERE direccion_normalizada LIKE $1 || '%'
         LIMIT 500
      `, [b.clave])).rows.filter(function (h) {
        return CRUCE.claveDeDireccion(h.direccion_normalizada) === b.clave;
      });
    } else {
      const caja = cajaAlrededor(b.punto, b.radio);
      hogares = (await db.query(`
        SELECT id, latitud, longitud FROM aps.hogar
         WHERE latitud BETWEEN $1 AND $2 AND longitud BETWEEN $3 AND $4
         LIMIT 500
      `, caja)).rows;
    }
    if (!hogares.length) return [];
    candidatas = (await db.query(`
      SELECT DISTINCT ON (f.hogar_id) f.hogar_id, f.id AS ficha_id
        FROM aps.ficha f
       WHERE f.hogar_id = ANY($1::bigint[])
       ORDER BY f.hogar_id, f.fecha_diligenciamiento DESC, f.id DESC
    `, [hogares.map(function (h) { return h.id; })])).rows;
  }
  if (!candidatas.length) return [];

  return (await db.query(`
    SELECT h.id, h.codigo, h.nuv, h.territorio_codigo, h.microterritorio_codigo, h.division_territorial,
           h.direccion_normalizada, h.latitud, h.longitud,
           f.fecha_diligenciamiento::text AS fecha, f.estado::text AS estado,
           /* Cuándo llegó al servidor (subida al sistema), hora de Colombia. */
           to_char(f.capturada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS subida,
           e.codigo AS ebs, fu.nombre_completo AS responsable,
           (SELECT count(*) FROM aps.familia_ficha ff WHERE ff.ficha_id = f.id) AS familias,
           (SELECT count(*) FROM aps.integrante i JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
             WHERE ff.ficha_id = f.id) AS personas
      FROM aps.ficha f
      JOIN aps.hogar h         ON h.id = f.hogar_id
      JOIN aps.equipo_salud e  ON e.id = f.equipo_salud_id
      JOIN aps.funcionario fu  ON fu.id = f.responsable_id
     WHERE f.id = ANY($1::bigint[])
  `, [candidatas.map(function (c) { return c.ficha_id; })])).rows;
}

function textoNuv(nuv) {
  return nuv === null || nuv === undefined ? null : 'NUV' + String(nuv).padStart(4, '0');
}

function deLaApp(fila) {
  return {
    origen: 'app',
    periodo: null,
    fecha: fila.fecha,
    territorio: fila.territorio_codigo,
    microterritorio: fila.microterritorio_codigo,
    lugar: fila.division_territorial,
    direccion: fila.direccion_normalizada,
    equipo: fila.ebs,
    equipoNombre: null,
    responsable: fila.responsable,
    familias: numeroONulo(fila.familias),
    personas: numeroONulo(fila.personas),
    referencia: [fila.codigo, textoNuv(fila.nuv)].filter(Boolean).join(' · ') || null,
    estado: ESTADOS_VISITA[fila.estado] || null,
    subida: fila.subida || null,
    tipoDocumento: null,
    latitud: numeroONulo(fila.latitud),
    longitud: numeroONulo(fila.longitud)
  };
}

/* ---------- Juntar ---------- */

/**
 * Une, mide la distancia (cercanía) y ordena: por cercanía, la más cercana;
 * si no, la visita más reciente. Las coordenadas no salen: sólo la distancia.
 */
function ordenarResultados(resultados, b) {
  let lista = resultados;
  if (b.modo === 'cercania') {
    lista = resultados.map(function (r) {
      const metros = r.latitud === null ? Infinity
        : CRUCE.distanciaEnMetros(b.punto.latitud, b.punto.longitud, r.latitud, r.longitud);
      return Object.assign({}, r, { distancia: Math.round(metros) });
    }).filter(function (r) { return r.distancia <= b.radio; });
    lista.sort(function (a, c) { return a.distancia - c.distancia || String(c.fecha).localeCompare(String(a.fecha)); });
  } else {
    lista = lista.slice().sort(function (a, c) { return String(c.fecha || '').localeCompare(String(a.fecha || '')); });
  }
  const total = lista.length;
  return {
    total: total,
    truncado: total > MAXIMO_RESULTADOS,
    resultados: lista.slice(0, MAXIMO_RESULTADOS).map(function (r) {
      const sinPunto = Object.assign({}, r);
      delete sinPunto.latitud;
      delete sinPunto.longitud;
      return sinPunto;
    })
  };
}

/* El tope y el registro van en una sola ida y vuelta: cuenta lo de la
   ventana y, si cabe, anota esta búsqueda. */
async function anotarBusqueda(db, usuario, b) {
  const valor = b.modo === 'documento' ? b.documento : b.modo === 'direccion' ? b.clave : 'radio ' + b.radio + ' m';
  const r = (await db.query(`
    WITH recientes AS (
      SELECT count(*) AS n FROM aud.evento
       WHERE funcionario_id = $1 AND entidad = $2
         AND ocurrido_en > now() - ($3 || ' minutes')::interval
    ), anotada AS (
      INSERT INTO aud.evento (entidad, tipo, campo, valor_nuevo, funcionario_id, latitud, longitud)
      SELECT $2, 'consulta_sensible', $4, $5, $1, $6, $7
       WHERE (SELECT n FROM recientes) < $8
      RETURNING id
    )
    SELECT (SELECT n FROM recientes) AS n, (SELECT count(*) FROM anotada) AS anotada
  `, [usuario.funcionarioId, ENTIDAD_AUDITORIA, String(VENTANA_TOPE_MIN), 'buscar_' + b.modo, valor,
    b.punto ? b.punto.latitud : null, b.punto ? b.punto.longitud : null, TOPE_BUSQUEDAS])).rows[0];
  return Number(r.anotada) > 0;
}

/**
 * @returns {Promise<object>} lo que va al navegador.
 * @throws ErrorDeBusqueda (codigo 'tope' si pasó el tope).
 */
async function buscar(db, usuario, cuerpo) {
  const b = prepararBusqueda(cuerpo);
  const permitida = await anotarBusqueda(db, usuario, b);
  if (!permitida) {
    throw new ErrorDeBusqueda('Hizo muchas búsquedas seguidas. Espere unos minutos y vuelva a intentarlo.', 'tope');
  }
  const [previas, app] = await Promise.all([buscarPrevias(db, b), visitasDeLaApp(db, b)]);
  const juntas = previas.map(function (f) { return deLaPrevia(f, b); }).concat(app.map(deLaApp));
  return Object.assign({
    modo: b.modo,
    buscado: b.modo === 'documento' ? b.documento : b.modo === 'direccion' ? b.clave : null,
    radio: b.radio || null
  }, ordenarResultados(juntas, b));
}

/* ---------- Copia para buscar sin señal ---------- */

/**
 * Toda la base —las viviendas anteriores y las de la app, de cualquier EBS y
 * territorio— en arreglos compactos, para buscar sin señal igual que con
 * señal (decisión del 2026-11-19: consultar sin importar el EBS). El teléfono
 * la guarda cifrada con la llave de la persona (base_previa.js).
 *
 * viviendas: [origen (0 anterior, 1 app), fecha, territorio, microterritorio,
 *             lugar, dirección, clave, latitud, longitud, EBS, nombre del EBS,
 *             responsable, familias, personas, referencia, estado, subida]
 * documentos: [índice de la vivienda, número]
 */
async function armarCopia(db, usuario) {
  const [previas, documentosPrevios, app, documentosApp] = await Promise.all([
    db.query(`
      SELECT v.id, v.numero_anterior, v.territorio, v.microterritorio, v.division_territorial, v.direccion,
             v.clave_direccion, v.latitud, v.longitud, v.ultima_fecha::text AS fecha, v.ebs_codigo, v.ebs_nombre,
             v.responsable, v.familias, v.personas
        FROM hist.vivienda v
    `),
    db.query('SELECT p.vivienda_id, p.numero_id FROM hist.persona p'),
    db.query(`
      SELECT DISTINCT ON (h.id) h.id, h.codigo, h.nuv, h.territorio_codigo, h.microterritorio_codigo,
             h.division_territorial, h.direccion_normalizada, h.latitud, h.longitud,
             f.fecha_diligenciamiento::text AS fecha, f.estado::text AS estado,
           /* Cuándo llegó al servidor (subida al sistema), hora de Colombia. */
           to_char(f.capturada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS subida, e.codigo AS ebs,
             fu.nombre_completo AS responsable,
             (SELECT count(*) FROM aps.familia_ficha ff WHERE ff.ficha_id = f.id) AS familias,
             (SELECT count(*) FROM aps.integrante i JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
               WHERE ff.ficha_id = f.id) AS personas
        FROM aps.hogar h
        JOIN aps.ficha f        ON f.hogar_id = h.id
        JOIN aps.equipo_salud e ON e.id = f.equipo_salud_id
        JOIN aps.funcionario fu ON fu.id = f.responsable_id
       ORDER BY h.id, f.fecha_diligenciamiento DESC, f.id DESC
    `),
    db.query(`
      SELECT DISTINCT f.hogar_id, upper(p.numero_id) AS numero_id
        FROM aps.ficha f
        JOIN aps.familia_ficha ff ON ff.ficha_id = f.id
        JOIN aps.integrante i     ON i.familia_ficha_id = ff.id
        JOIN aps.persona p        ON p.id = i.persona_id
    `)
  ]);

  if (!previas.rows.length && !app.rows.length) {
    return { disponible: false, motivo: 'sin_viviendas' };
  }

  const viviendas = [];
  const documentos = [];
  const indicePrevia = new Map();
  previas.rows.forEach(function (v) {
    indicePrevia.set(String(v.id), viviendas.length);
    viviendas.push([0, v.fecha, v.territorio, v.microterritorio, v.division_territorial, v.direccion,
      v.clave_direccion, numeroONulo(v.latitud), numeroONulo(v.longitud), v.ebs_codigo, v.ebs_nombre,
      v.responsable, numeroONulo(v.familias), numeroONulo(v.personas),
      v.numero_anterior ? 'Vivienda ' + v.numero_anterior + ' de la base anterior' : null, null, null]);
  });
  documentosPrevios.rows.forEach(function (d) {
    const i = indicePrevia.get(String(d.vivienda_id));
    if (i !== undefined) documentos.push([i, d.numero_id]);
  });

  const indiceApp = new Map();
  app.rows.forEach(function (h) {
    indiceApp.set(String(h.id), viviendas.length);
    viviendas.push([1, h.fecha, h.territorio_codigo, h.microterritorio_codigo, h.division_territorial,
      h.direccion_normalizada, CRUCE.claveDeDireccion(h.direccion_normalizada), numeroONulo(h.latitud),
      numeroONulo(h.longitud), h.ebs, null, h.responsable, numeroONulo(h.familias), numeroONulo(h.personas),
      [h.codigo, textoNuv(h.nuv)].filter(Boolean).join(' · ') || null, ESTADOS_VISITA[h.estado] || null, h.subida || null]);
  });
  documentosApp.rows.forEach(function (d) {
    const i = indiceApp.get(String(d.hogar_id));
    if (i !== undefined) documentos.push([i, d.numero_id]);
  });

  await db.query(`
    INSERT INTO aud.evento (entidad, tipo, campo, valor_nuevo, funcionario_id)
    VALUES ($1, 'consulta_sensible', 'copia_sin_senal', $2, $3)
  `, [ENTIDAD_AUDITORIA, viviendas.length + ' viviendas (toda la base)', usuario.funcionarioId]);

  return {
    disponible: true,
    version: 1,
    generada: new Date().toISOString(),
    viviendas: viviendas,
    documentos: documentos
  };
}

module.exports = {
  prepararBusqueda, buscar, armarCopia, ordenarResultados, cajaAlrededor,
  ErrorDeBusqueda, RADIO_POR_DEFECTO, RADIO_MAXIMO, MAXIMO_RESULTADOS, TOPE_BUSQUEDAS, ESTADOS_VISITA
};
