/* =========================================================================
   Encuesta_APS — GET /api/productividad
   -------------------------------------------------------------------------
   Reportes de productividad para la coordinación del EBS (la coordinadora y
   los líderes de zona), el administrador y el maestro: cuántas fichas,
   viviendas, hogares, familias y personas se caracterizaron en un período,
   agrupadas por EBS, comuna, territorio, barrio, persona que diligenció, o
   por día, semana o mes.

   Parámetros (query):
     desde, hasta   AAAA-MM-DD, fecha de diligenciamiento (ítem 16); tope de
                    un año.
     agrupar        ebs | comuna | territorio | barrio | persona | dia |
                    semana | mes  (por defecto, ebs)
     ebs            código del EBS (opcional)
     comuna         comuna del microterritorio, o «sin» (opcional)
     persona        id del funcionario que diligenció (opcional)

   Sólo cuentas: ningún dato de la población. Lo único con nombre es el
   personal que diligenció, que es lo que la coordinación necesita ver.
   La expresión de cada agrupación sale de AGRUPACIONES, nunca de la
   petición; los filtros van como parámetros.

   Por EBS y por persona, la respuesta incluye también a quienes no tienen
   fichas en el período (con ceros): la pregunta de la coordinación suele ser
   quién no ha reportado.

   Qué cuenta cada columna:
     fichas         visitas diligenciadas en el período
     viviendas      viviendas distintas visitadas
     hogares, familias, personas   lo caracterizado en esas visitas
     planPendiente  fichas con el plan de cuidado pendiente (sin acciones, o
                    con alguna alerta sin conducta), como en el historial
     incompletas    visitas cerradas como incompletas por causa externa
     sinConsentimiento, integrantesPendientes (RN-051), diasActivos
   ========================================================================= */

'use strict';

const { obtenerPool } = require('./_db');
const { requerirSesion } = require('./_auth');
const { SIN_CONDUCTA } = require('./_plan_cuidado');
const roles = require('../roles.js');

const MAX_DIAS = 366;

/* clave: expresión del grupo sobre `base`; etiqueta: cómo se muestra. */
const AGRUPACIONES = {
  ebs: { clave: 'base.ebs', etiqueta: 'min(base.ebs)' },
  comuna: { clave: "coalesce(base.comuna, '')", etiqueta: 'min(base.comuna)' },
  territorio: { clave: "coalesce(base.territorio, '')", etiqueta: 'min(base.comuna)' },
  barrio: { clave: "lower(coalesce(base.barrio, ''))", etiqueta: 'min(base.barrio)' },
  persona: { clave: 'base.responsable_id::text', etiqueta: 'min(base.responsable_id::text)' },
  dia: { clave: "to_char(base.fecha, 'YYYY-MM-DD')", etiqueta: "min(to_char(base.fecha, 'YYYY-MM-DD'))" },
  semana: { clave: "to_char(date_trunc('week', base.fecha), 'YYYY-MM-DD')",
    etiqueta: "min(to_char(date_trunc('week', base.fecha), 'YYYY-MM-DD'))" },
  mes: { clave: "to_char(base.fecha, 'YYYY-MM')", etiqueta: "min(to_char(base.fecha, 'YYYY-MM'))" }
};

/* Fecha real AAAA-MM-DD: 2026-02-30 no pasa. */
function fechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(texto + 'T00:00:00Z');
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) return null;
  return fecha;
}

function validar(consulta) {
  const q = consulta || {};
  const desde = fechaValida(q.desde);
  const hasta = fechaValida(q.hasta);
  if (!desde || !hasta) return { error: 'Indique las fechas del período en formato AAAA-MM-DD.' };
  if (desde > hasta) return { error: 'La fecha inicial es posterior a la final.' };
  if ((hasta - desde) / 86400000 >= MAX_DIAS) return { error: 'El período no puede superar un año.' };

  const agrupar = q.agrupar === undefined || q.agrupar === '' ? 'ebs' : String(q.agrupar);
  if (!Object.prototype.hasOwnProperty.call(AGRUPACIONES, agrupar)) return { error: 'Agrupación no reconocida.' };

  const ebs = q.ebs ? String(q.ebs).trim() : null;
  if (ebs && !/^[A-Za-z0-9]{3,20}$/.test(ebs)) return { error: 'Código de EBS no válido.' };

  const comuna = q.comuna ? String(q.comuna).trim() : null;
  if (comuna && !/^[A-Za-z0-9 .]{1,20}$/.test(comuna)) return { error: 'Comuna no válida.' };

  const persona = q.persona ? String(q.persona).trim() : null;
  if (persona && !/^[0-9]{1,18}$/.test(persona)) return { error: 'Persona no válida.' };

  return { desde: q.desde, hasta: q.hasta, agrupar: agrupar, ebs: ebs, comuna: comuna, persona: persona };
}

/* Una fila por ficha del período, con lo que se cuenta de ella. $1-$2 el
   período; $3 EBS, $4 comuna ('sin' = sin comuna), $5 persona y $6 el equipo
   del alcance, todos opcionales (NULL = sin filtro). */
const BASE = `
  base AS (
    SELECT f.id, f.fecha_diligenciamiento AS fecha, f.hogar_id, f.responsable_id,
           f.consentimiento, f.estado,
           eq.codigo AS ebs,
           h.territorio_codigo AS territorio,
           nullif(btrim(h.division_territorial), '') AS barrio,
           m.comuna,
           comp.familias, comp.hogares, comp.personas, comp.integrantes_pendientes,
           ((SELECT count(*) FROM aps.plan_cuidado p
              JOIN aps.plan_accion a ON a.plan_id = p.id
             WHERE p.ficha_id = f.id AND a.codigo_accion IS NOT NULL) = 0
            OR EXISTS (SELECT 1 FROM aps.alerta al WHERE al.ficha_id = f.id AND ${SIN_CONDUCTA})) AS plan_pendiente
      FROM aps.ficha f
      JOIN aps.hogar h         ON h.id = f.hogar_id
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      LEFT JOIN cat.microterritorio m
             ON m.territorio_codigo = h.territorio_codigo AND m.codigo = h.microterritorio_codigo
      /* La misma composición que listar_fichas: una familia sin hogar
         (fichas anteriores al ítem) cuenta como un hogar propio. */
      LEFT JOIN LATERAL (
        SELECT count(*) AS familias,
               count(DISTINCT coalesce(ff.hogar_numero::text, 'f' || ff.id)) AS hogares,
               coalesce(sum((SELECT count(*) FROM aps.integrante i WHERE i.familia_ficha_id = ff.id)), 0) AS personas,
               coalesce(sum(greatest(ff.numero_integrantes - (SELECT count(*) FROM aps.integrante i
                                                               WHERE i.familia_ficha_id = ff.id), 0)), 0)
                 AS integrantes_pendientes
          FROM aps.familia_ficha ff
         WHERE ff.ficha_id = f.id
      ) comp ON true
     WHERE f.fecha_diligenciamiento BETWEEN $1 AND $2
       AND ($3::text IS NULL OR eq.codigo = $3)
       AND ($4::text IS NULL OR coalesce(m.comuna, 'sin') = $4)
       AND ($5::bigint IS NULL OR f.responsable_id = $5)
       AND ($6::bigint IS NULL OR f.equipo_salud_id = $6)
  )`;

const MEDIDAS = `
  count(*)::int AS fichas,
  count(DISTINCT base.hogar_id)::int AS viviendas,
  coalesce(sum(base.hogares), 0)::int AS hogares,
  coalesce(sum(base.familias), 0)::int AS familias,
  coalesce(sum(base.personas), 0)::int AS personas,
  count(*) FILTER (WHERE base.plan_pendiente)::int AS plan_pendiente,
  count(*) FILTER (WHERE base.estado = 'incompleta_causa_externa')::int AS incompletas,
  count(*) FILTER (WHERE NOT base.consentimiento)::int AS sin_consentimiento,
  coalesce(sum(base.integrantes_pendientes), 0)::int AS integrantes_pendientes,
  count(DISTINCT base.fecha)::int AS dias_activos,
  to_char(min(base.fecha), 'YYYY-MM-DD') AS primera,
  to_char(max(base.fecha), 'YYYY-MM-DD') AS ultima`;

function medidasDe(fila) {
  return {
    fichas: fila ? fila.fichas : 0,
    viviendas: fila ? fila.viviendas : 0,
    hogares: fila ? fila.hogares : 0,
    familias: fila ? fila.familias : 0,
    personas: fila ? fila.personas : 0,
    planPendiente: fila ? fila.plan_pendiente : 0,
    incompletas: fila ? fila.incompletas : 0,
    sinConsentimiento: fila ? fila.sin_consentimiento : 0,
    integrantesPendientes: fila ? fila.integrantes_pendientes : 0,
    diasActivos: fila ? fila.dias_activos : 0,
    primera: fila ? fila.primera : null,
    ultima: fila ? fila.ultima : null
  };
}

function etiquetaComuna(comuna) {
  if (!comuna) return 'Sin comuna';
  return comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna;
}

/* Quien captura fichas: los roles de nivel profesional o técnico. */
const ROLES_QUE_CAPTURAN = Object.keys(roles.ROLES || {}).filter(function (rol) {
  const nivel = roles.nivelDe(rol);
  return nivel === 'profesional' || nivel === 'tecnico';
});

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const usuario = await requerirSesion(req, res, { permiso: 'productividad.ver' });
  if (!usuario) return;

  const alcance = roles.alcanceDeLectura(usuario.rol);
  if (!alcance) return res.status(403).json({ error: 'Su rol no permite consultar fichas', codigo: 'sin_permiso' });

  const p = validar(req.query);
  if (p.error) return res.status(400).json({ error: p.error });

  const equipoDelAlcance = alcance === 'todas' ? null : (usuario.equipoSaludId || -1);
  const parametros = [p.desde, p.hasta, p.ebs, p.comuna, p.persona, equipoDelAlcance];
  const grupo = AGRUPACIONES[p.agrupar];
  const pool = obtenerPool();

  /* Ceros: por EBS, los equipos con personal activo; por persona, quien
     captura fichas y tiene la cuenta activa (del EBS filtrado, si lo hay).
     Con un filtro de comuna o de persona no aplican. */
  const conCeros = (p.agrupar === 'ebs' || p.agrupar === 'persona') && !p.comuna && !p.persona;

  try {
    const [agrupado, porDia, opciones, universo] = await Promise.all([
      pool.query(`
        WITH ${BASE}
        SELECT ${grupo.clave} AS clave, ${grupo.etiqueta} AS etiqueta, min(base.comuna) AS comuna,
               GROUPING(${grupo.clave}) AS es_total, ${MEDIDAS}
          FROM base
         GROUP BY GROUPING SETS ((${grupo.clave}), ())
      `, parametros),
      pool.query(`
        WITH ${BASE}
        SELECT to_char(base.fecha, 'YYYY-MM-DD') AS fecha, count(*)::int AS fichas
          FROM base GROUP BY base.fecha ORDER BY base.fecha
      `, parametros),
      /* Para los filtros: lo que hay en el período, sin los demás filtros. */
      pool.query(`
        WITH ${BASE}
        SELECT 'ebs' AS tipo, base.ebs AS valor FROM base GROUP BY base.ebs
        UNION ALL
        SELECT 'comuna', coalesce(base.comuna, 'sin') FROM base GROUP BY base.comuna
        UNION ALL
        SELECT 'persona', base.responsable_id::text FROM base GROUP BY base.responsable_id
      `, [p.desde, p.hasta, null, null, null, equipoDelAlcance]),
      conCeros && p.agrupar === 'ebs'
        ? pool.query(`
            SELECT DISTINCT eq.codigo AS clave
              FROM aps.equipo_salud eq
              JOIN aps.funcionario fu ON fu.equipo_salud_id = eq.id AND fu.activo
              JOIN aps.usuario u ON u.funcionario_id = fu.id AND u.activo
             WHERE eq.activo
               AND ($1::text IS NULL OR eq.codigo = $1)
               AND ($2::bigint IS NULL OR eq.id = $2)
          `, [p.ebs, equipoDelAlcance])
        : conCeros
          ? pool.query(`
              SELECT fu.id::text AS clave
                FROM aps.funcionario fu
                JOIN aps.usuario u ON u.funcionario_id = fu.id AND u.activo
                LEFT JOIN aps.equipo_salud eq ON eq.id = fu.equipo_salud_id
               WHERE fu.activo
                 AND u.rol = ANY($1::text[])
                 AND ($2::text IS NULL OR eq.codigo = $2)
                 AND ($3::bigint IS NULL OR fu.equipo_salud_id = $3)
            `, [ROLES_QUE_CAPTURAN, p.ebs, equipoDelAlcance])
          : Promise.resolve({ rows: [] })
    ]);

    const totales = agrupado.rows.find(function (f) { return f.es_total === 1; });
    const grupos = agrupado.rows.filter(function (f) { return f.es_total !== 1; });
    const claves = new Set(grupos.map(function (f) { return f.clave; }));
    universo.rows.forEach(function (u) {
      if (!claves.has(u.clave)) grupos.push({ clave: u.clave, etiqueta: u.clave, comuna: null, cero: true });
    });

    /* Nombre, rol y EBS del personal: de quienes aparecen en el reporte o en
       el filtro de personas. */
    const idsPersona = new Set();
    if (p.agrupar === 'persona') grupos.forEach(function (g) { idsPersona.add(g.clave); });
    opciones.rows.forEach(function (o) { if (o.tipo === 'persona') idsPersona.add(o.valor); });
    if (p.persona) idsPersona.add(p.persona);
    const personal = new Map();
    if (idsPersona.size > 0) {
      (await pool.query(`
        SELECT fu.id::text AS id, fu.nombre_completo, u.rol, eq.codigo AS ebs
          FROM aps.funcionario fu
          LEFT JOIN aps.usuario u ON u.funcionario_id = fu.id
          LEFT JOIN aps.equipo_salud eq ON eq.id = fu.equipo_salud_id
         WHERE fu.id = ANY($1::bigint[])
      `, [Array.from(idsPersona)])).rows.forEach(function (f) { personal.set(f.id, f); });
    }
    const describirPersona = function (id) {
      const f = personal.get(String(id));
      return {
        etiqueta: f ? f.nombre_completo : 'Funcionario ' + id,
        detalle: f ? [f.rol ? roles.etiquetaDeRol(f.rol) : null, f.ebs].filter(Boolean).join(' · ') : null
      };
    };

    const filas = grupos.map(function (g) {
      let etiqueta = g.etiqueta;
      let detalle = null;
      if (p.agrupar === 'comuna') etiqueta = etiquetaComuna(g.comuna);
      if (p.agrupar === 'territorio') {
        etiqueta = g.clave || 'Sin territorio';
        detalle = g.clave ? etiquetaComuna(g.comuna) : null;
      }
      if (p.agrupar === 'barrio') etiqueta = g.etiqueta || 'Sin barrio registrado';
      if (p.agrupar === 'persona') {
        const persona = describirPersona(g.clave);
        etiqueta = persona.etiqueta;
        detalle = persona.detalle;
      }
      return Object.assign({ clave: g.clave, etiqueta: etiqueta, detalle: detalle }, medidasDe(g.cero ? null : g));
    });

    const valoresDe = function (tipo) {
      return opciones.rows.filter(function (o) { return o.tipo === tipo; }).map(function (o) { return o.valor; });
    };

    return res.status(200).json({
      periodo: { desde: p.desde, hasta: p.hasta },
      agrupar: p.agrupar,
      filtros: { ebs: p.ebs, comuna: p.comuna, persona: p.persona },
      totales: medidasDe(totales),
      filas: filas,
      porDia: porDia.rows,
      opciones: {
        ebs: valoresDe('ebs').sort(),
        comunas: valoresDe('comuna').sort(function (a, b) {
          return (parseFloat(a) || 999) - (parseFloat(b) || 999) || a.localeCompare(b);
        }).map(function (c) { return { valor: c, etiqueta: etiquetaComuna(c === 'sin' ? null : c) }; }),
        personas: valoresDe('persona').map(function (id) {
          const persona = describirPersona(id);
          return { valor: id, etiqueta: persona.etiqueta, detalle: persona.detalle };
        }).sort(function (a, b) { return a.etiqueta.localeCompare(b.etiqueta, 'es'); })
      }
    });
  } catch (error) {
    console.error('Error al generar el reporte de productividad:', error.message);
    return res.status(500).json({ error: 'No fue posible generar el reporte.' });
  }
};
