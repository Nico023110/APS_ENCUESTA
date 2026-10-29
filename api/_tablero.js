/* =========================================================================
   Encuesta_APS — Tableros de población (módulo interno)
   -------------------------------------------------------------------------
   Lo atiende GET /api/productividad?tablero=1: los mismos que ven la
   productividad (coordinación del EBS, administrador y maestro) y con el
   mismo alcance. Va en ese endpoint y no en uno propio para no sumar otra
   función en Vercel.

   Qué se cuenta: la población caracterizada. De cada vivienda entra su
   visita más reciente del período —volver a una casa deja otra ficha, no
   otra vivienda—, sólo fichas con consentimiento (RN-001: sin él no hay
   datos). Lo mismo que hace el Inicio con las fichas del equipo.

   Parámetros (query):
     desde, hasta   AAAA-MM-DD, fecha de diligenciamiento (ítem 16); hasta
                    cinco años, porque el tablero suele mirar lo acumulado.
     ebs            código del EBS (opcional)
     comuna         comuna del microterritorio, o «sin» (opcional)
     territorio     código del territorio, T48… (opcional)

   Sólo cuentas, nunca personas: cada fila de la respuesta es una categoría
   del instrumento con su número. Las categorías van en código (el del
   catálogo) y el navegador las nombra con catalogos.js, la misma fuente que
   el formulario. Los datos sensibles (orientación sexual, violencias) no
   se cuentan aquí.

   Las expresiones de cada dimensión están escritas abajo; de la petición
   sólo llegan los filtros, como parámetros.
   ========================================================================= */

'use strict';

const MAX_DIAS = 5 * 366;

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
  if ((hasta - desde) / 86400000 >= MAX_DIAS) return { error: 'El período no puede superar cinco años.' };

  const ebs = q.ebs ? String(q.ebs).trim() : null;
  if (ebs && !/^[A-Za-z0-9]{3,20}$/.test(ebs)) return { error: 'Código de EBS no válido.' };

  const comuna = q.comuna ? String(q.comuna).trim() : null;
  if (comuna && !/^[A-Za-z0-9 .]{1,20}$/.test(comuna)) return { error: 'Comuna no válida.' };

  const territorio = q.territorio ? String(q.territorio).trim().toUpperCase() : null;
  if (territorio && !/^T[0-9]{1,4}$/.test(territorio)) return { error: 'Territorio no válido.' };

  return { desde: q.desde, hasta: q.hasta, ebs: ebs, comuna: comuna, territorio: territorio };
}

/* La comuna de Cali del microterritorio. La E.S.E. numera «1.1», «18.1» y
   «20.1» los territorios de la continuidad que repiten comuna (T50, T52 y
   T54): para el tablero son la 1, la 18 y la 20, como en el ítem 7. */
const COMUNA = `CASE WHEN m.comuna ~ '^[0-9]+\\.[0-9]+$' THEN split_part(m.comuna, '.', 1) ELSE m.comuna END`;

/* sel: la última visita de cada vivienda en el período, con los filtros.
   $1-$2 el período; $3 EBS, $4 comuna ('sin' = sin comuna), $5 territorio
   y $6 el equipo del alcance, todos opcionales (NULL = sin filtro).
   fam y per: sus familias y sus integrantes, con la edad cumplida a la
   fecha de la visita. */
const BASE = `
  sel AS (
    SELECT DISTINCT ON (f.hogar_id)
           f.id, f.hogar_id, f.fecha_diligenciamiento AS fecha,
           eq.codigo AS ebs, h.territorio_codigo AS territorio, ${COMUNA} AS comuna
      FROM aps.ficha f
      JOIN aps.hogar h         ON h.id = f.hogar_id
      JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
      LEFT JOIN cat.microterritorio m
             ON m.territorio_codigo = h.territorio_codigo AND m.codigo = h.microterritorio_codigo
     WHERE f.consentimiento
       AND f.estado <> 'rechazada_sin_consentimiento'
       AND f.fecha_diligenciamiento BETWEEN $1 AND $2
       AND ($3::text IS NULL OR eq.codigo = $3)
       AND ($4::text IS NULL OR coalesce(${COMUNA}, 'sin') = $4)
       AND ($5::text IS NULL OR h.territorio_codigo = $5)
       AND ($6::bigint IS NULL OR f.equipo_salud_id = $6)
     ORDER BY f.hogar_id, f.fecha_diligenciamiento DESC, f.capturada_en DESC, f.id DESC
  ),
  viv AS (
    SELECT v.* FROM aps.vivienda v JOIN sel ON sel.id = v.ficha_id
  ),
  fam AS (
    SELECT ff.* FROM aps.familia_ficha ff JOIN sel ON sel.id = ff.ficha_id
  ),
  per AS (
    SELECT i.*, p.sexo,
           extract(year FROM age(sel.fecha, p.fecha_nacimiento))::int AS edad,
           age(sel.fecha, p.fecha_nacimiento) < interval '6 months' AS menor_6m
      FROM aps.integrante i
      JOIN fam ON fam.id = i.familia_ficha_id
      JOIN sel ON sel.id = fam.ficha_id
      JOIN aps.persona p ON p.id = i.persona_id
  )`;

/* Curso de vida de la Resolución 3280 de 2018. */
const CURSO_DE_VIDA = `CASE WHEN per.edad <= 5 THEN 'primera_infancia'
                            WHEN per.edad <= 11 THEN 'infancia'
                            WHEN per.edad <= 17 THEN 'adolescencia'
                            WHEN per.edad <= 28 THEN 'juventud'
                            WHEN per.edad <= 59 THEN 'adultez'
                            ELSE 'vejez' END`;

/* Una fila por categoría: (dim, valor, sexo, n). `sexo` sólo en lo que se
   muestra por sexo; en lo demás va NULL. Las selecciones múltiples cuentan
   familias o personas que marcaron la opción (una vez cada una: la llave de
   su tabla es la persona o la familia con el código). */
const DIMENSIONES = `
  SELECT 'total' AS dim, 'viviendas' AS valor, NULL::text AS sexo, count(*)::int AS n FROM sel
  UNION ALL SELECT 'total', 'hogares', NULL,
         count(DISTINCT fam.ficha_id::text || ':' || coalesce(fam.hogar_numero::text, 'f' || fam.id))::int FROM fam
  UNION ALL SELECT 'total', 'hogaresDeclarados', NULL, coalesce(sum(viv.hogares_en_vivienda), 0)::int FROM viv
  UNION ALL SELECT 'total', 'familias', NULL, count(*)::int FROM fam
  UNION ALL SELECT 'total', 'personas', NULL, count(*)::int FROM per
  UNION ALL SELECT 'total', 'hacinamiento', NULL, count(*) FILTER (WHERE viv.hacinamiento)::int FROM viv
  UNION ALL SELECT 'total', 'conCuidador', NULL, count(*) FILTER (WHERE fam.cuidador_principal)::int FROM fam
  UNION ALL SELECT 'total', 'gestantes', NULL, count(*) FILTER (WHERE per.gestacion_actual)::int FROM per
  UNION ALL SELECT 'total', 'preguntadasGestacion', NULL, count(*) FILTER (WHERE per.gestacion_actual IS NOT NULL)::int FROM per
  UNION ALL SELECT 'total', 'primeraInfancia', NULL, count(*) FILTER (WHERE per.edad <= 5)::int FROM per
  UNION ALL SELECT 'total', 'mayores', NULL, count(*) FILTER (WHERE per.edad >= 60)::int FROM per
  UNION ALL SELECT 'total', 'menores6m', NULL, count(*) FILTER (WHERE per.menor_6m)::int FROM per
  UNION ALL SELECT 'total', 'discapacidad', NULL, count(DISTINCT d.integrante_id)::int
         FROM per JOIN aps.integrante_discapacidad d ON d.integrante_id = per.id AND d.codigo <> 'sin_discapacidad'
  UNION ALL SELECT 'total', 'victimas', NULL, count(DISTINCT s.integrante_id)::int
         FROM per JOIN aps.integrante_sujeto_proteccion s ON s.integrante_id = per.id AND s.codigo = 'victima_conflicto'
  /* Denominadores de las preguntas que no se hacen a todos: cuántas
     personas las respondieron. */
  UNION ALL SELECT 'total', 'respondieronMaterno', NULL, count(DISTINCT x.integrante_id)::int
         FROM per JOIN aps.integrante_atencion_materno x ON x.integrante_id = per.id
  UNION ALL SELECT 'total', 'respondieronBarreras', NULL, count(DISTINCT x.integrante_id)::int
         FROM per JOIN aps.integrante_barrera_acceso x ON x.integrante_id = per.id
  UNION ALL SELECT 'total', 'conBarreras', NULL, count(DISTINCT x.integrante_id)::int
         FROM per JOIN aps.integrante_barrera_acceso x ON x.integrante_id = per.id AND x.codigo <> 'ninguna'

  /* Vivienda */
  UNION ALL SELECT 'estrato', viv.estrato, NULL, count(*)::int FROM viv GROUP BY viv.estrato
  UNION ALL SELECT 'fuenteAgua', viv.fuente_agua, NULL, count(*)::int FROM viv GROUP BY viv.fuente_agua
  UNION ALL SELECT 'comuna', coalesce(sel.comuna, 'sin'), NULL, count(*)::int FROM sel GROUP BY sel.comuna
  UNION ALL SELECT 'territorio', sel.territorio, NULL, count(*)::int FROM sel GROUP BY sel.territorio

  /* Familia */
  UNION ALL SELECT 'tipoFamilia', fam.tipo_familia, NULL, count(*)::int FROM fam GROUP BY fam.tipo_familia
  UNION ALL SELECT 'integrantesFamilia', least(fam.numero_integrantes, 10)::text, NULL, count(*)::int
         FROM fam GROUP BY least(fam.numero_integrantes, 10)
  UNION ALL SELECT 'apgar', coalesce(fam.apgar_familiar, 'sin_dato'), NULL, count(*)::int FROM fam GROUP BY fam.apgar_familiar
  UNION ALL SELECT 'riesgoFamiliar', coalesce(fam.clasificacion_riesgo::text, 'sin_dato'), NULL, count(*)::int
         FROM fam GROUP BY fam.clasificacion_riesgo
  UNION ALL SELECT 'redesApoyo', fam.redes_apoyo, NULL, count(*)::int FROM fam GROUP BY fam.redes_apoyo
  UNION ALL SELECT 'zarit', fam.zarit, NULL, count(*)::int FROM fam WHERE fam.cuidador_principal GROUP BY fam.zarit
  UNION ALL SELECT 'situacionesRiesgo', x.codigo, NULL, count(*)::int
         FROM fam JOIN aps.familia_situacion_riesgo x ON x.familia_ficha_id = fam.id GROUP BY x.codigo
  UNION ALL SELECT 'practicasVinculo', x.codigo, NULL, count(*)::int
         FROM fam JOIN aps.familia_practica_vinculo x ON x.familia_ficha_id = fam.id GROUP BY x.codigo
  UNION ALL SELECT 'practicasHogar', x.codigo, NULL, count(*)::int
         FROM fam JOIN aps.familia_practica_cuidado_hogar x ON x.familia_ficha_id = fam.id GROUP BY x.codigo

  /* Persona, por sexo */
  UNION ALL SELECT 'cursoVida', ${CURSO_DE_VIDA}, per.sexo, count(*)::int FROM per GROUP BY 2, per.sexo
  UNION ALL SELECT 'quinquenio', (least(per.edad / 5, 16) * 5)::text, per.sexo, count(*)::int
         FROM per GROUP BY least(per.edad / 5, 16), per.sexo
  UNION ALL SELECT 'nivelEducativo', per.nivel_educativo, per.sexo, count(*)::int
         FROM per WHERE per.nivel_educativo IS NOT NULL GROUP BY per.nivel_educativo, per.sexo
  UNION ALL SELECT 'regimen', per.regimen_afiliacion, per.sexo, count(*)::int FROM per GROUP BY per.regimen_afiliacion, per.sexo
  UNION ALL SELECT 'etnia', per.pertenencia_etnica, per.sexo, count(*)::int FROM per GROUP BY per.pertenencia_etnica, per.sexo
  UNION ALL SELECT 'antropometria', per.clasificacion_antropometrica, per.sexo, count(*)::int
         FROM per WHERE per.clasificacion_antropometrica IS NOT NULL GROUP BY per.clasificacion_antropometrica, per.sexo
  UNION ALL SELECT 'tratamiento', per.adherencia_tratamiento, per.sexo, count(*)::int
         FROM per WHERE per.adherencia_tratamiento IS NOT NULL GROUP BY per.adherencia_tratamiento, per.sexo
  UNION ALL SELECT 'lactancia', coalesce(per.lactancia_exclusiva, 'sin_dato'), per.sexo, count(*)::int
         FROM per WHERE per.menor_6m GROUP BY per.lactancia_exclusiva, per.sexo
  UNION ALL SELECT 'discapacidad', x.codigo, per.sexo, count(*)::int
         FROM per JOIN aps.integrante_discapacidad x ON x.integrante_id = per.id GROUP BY x.codigo, per.sexo
  UNION ALL SELECT 'practicasCuidado', x.codigo, per.sexo, count(*)::int
         FROM per JOIN aps.integrante_practica_cuidado x ON x.integrante_id = per.id GROUP BY x.codigo, per.sexo
  UNION ALL SELECT 'enfermedadesNT', x.codigo, per.sexo, count(*)::int
         FROM per JOIN aps.integrante_enfermedad_no_transmisible x ON x.integrante_id = per.id GROUP BY x.codigo, per.sexo
  /* ¿Tiene alguna enfermedad no transmisible diagnosticada? Una vez por
     persona: sí con cualquier código distinto de «Ninguna». */
  UNION ALL SELECT 'conEnfermedadNT', e.valor, e.sexo, count(*)::int FROM (
           SELECT per.sexo,
                  CASE WHEN bool_or(x.codigo <> 'ninguna') THEN 'si'
                       WHEN bool_or(x.codigo = 'ninguna') THEN 'no'
                       ELSE 'sin_dato' END AS valor
             FROM per LEFT JOIN aps.integrante_enfermedad_no_transmisible x ON x.integrante_id = per.id
            GROUP BY per.id, per.sexo
         ) e GROUP BY e.valor, e.sexo

  /* Persona, sin sexo */
  UNION ALL SELECT 'sujetoProteccion', x.codigo, NULL, count(*)::int
         FROM per JOIN aps.integrante_sujeto_proteccion x ON x.integrante_id = per.id GROUP BY x.codigo
  UNION ALL SELECT 'saberes', x.codigo, NULL, count(*)::int
         FROM per JOIN aps.integrante_saber_ancestral x ON x.integrante_id = per.id GROUP BY x.codigo
  UNION ALL SELECT 'transmisibles', x.codigo, NULL, count(*)::int
         FROM per JOIN aps.integrante_condicion_transmisible x ON x.integrante_id = per.id GROUP BY x.codigo
  UNION ALL SELECT 'barreras', x.codigo, NULL, count(*)::int
         FROM per JOIN aps.integrante_barrera_acceso x ON x.integrante_id = per.id GROUP BY x.codigo
  UNION ALL SELECT 'atencionesMaterno', x.codigo, NULL, count(*)::int
         FROM per JOIN aps.integrante_atencion_materno x ON x.integrante_id = per.id GROUP BY x.codigo
  UNION ALL SELECT 'gestacion', CASE WHEN per.gestacion_actual THEN 'si' ELSE 'no' END, NULL, count(*)::int
         FROM per WHERE per.gestacion_actual IS NOT NULL GROUP BY per.gestacion_actual`;

/* Los filtros ofrecen lo que hay en el período (sin los demás filtros), y
   las fechas de la primera y la última ficha que entraron. */
const OPCIONES = `
  SELECT 'ebs' AS tipo, sel.ebs AS valor, NULL::text AS comuna FROM sel GROUP BY sel.ebs
  UNION ALL SELECT 'comuna', coalesce(sel.comuna, 'sin'), NULL FROM sel GROUP BY sel.comuna
  UNION ALL SELECT 'territorio', sel.territorio, min(coalesce(sel.comuna, 'sin')) FROM sel GROUP BY sel.territorio`;

const RANGO = `
  SELECT to_char(min(sel.fecha), 'YYYY-MM-DD') AS primera, to_char(max(sel.fecha), 'YYYY-MM-DD') AS ultima FROM sel`;

function etiquetaComuna(comuna) {
  if (!comuna || comuna === 'sin') return 'Sin comuna';
  return comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna;
}

/* «1» antes que «1.1» antes que «3»…, y lo que no es número (Rural, sin) al final. */
function compararComunas(a, b) {
  return (parseFloat(a) || 999) - (parseFloat(b) || 999) || String(a).localeCompare(String(b));
}

/* Arma la respuesta a partir de las filas de las tres consultas. */
function armarRespuesta(p, filas, opciones, rango) {
  const totales = {};
  const dimensiones = {};
  filas.forEach(function (f) {
    if (f.dim === 'total') { totales[f.valor] = f.n; return; }
    if (f.valor === null || f.valor === undefined) return;
    (dimensiones[f.dim] = dimensiones[f.dim] || []).push(
      f.sexo === null || f.sexo === undefined ? { valor: f.valor, n: f.n } : { valor: f.valor, sexo: f.sexo, n: f.n }
    );
  });

  const deTipo = function (tipo) { return opciones.filter(function (o) { return o.tipo === tipo && o.valor; }); };
  return {
    periodo: { desde: p.desde, hasta: p.hasta },
    filtros: { ebs: p.ebs, comuna: p.comuna, territorio: p.territorio },
    rango: { primera: (rango && rango.primera) || null, ultima: (rango && rango.ultima) || null },
    totales: totales,
    dimensiones: dimensiones,
    opciones: {
      ebs: deTipo('ebs').map(function (o) { return o.valor; }).sort(),
      comunas: deTipo('comuna').map(function (o) { return o.valor; }).sort(compararComunas)
        .map(function (c) { return { valor: c, etiqueta: etiquetaComuna(c) }; }),
      territorios: deTipo('territorio').map(function (o) { return { valor: o.valor, comuna: o.comuna }; })
        .sort(function (a, b) { return Number(a.valor.slice(1)) - Number(b.valor.slice(1)); })
    }
  };
}

/* La consulta, contra el pool que le pasen (el de _db.js, o uno simulado en
   las pruebas). `equipoDelAlcance` es el EBS de quien consulta cuando su rol
   sólo ve el suyo; null cuando ve todos. */
async function consultarTablero(pool, p, equipoDelAlcance) {
  const parametros = [p.desde, p.hasta, p.ebs, p.comuna, p.territorio, equipoDelAlcance];
  const sinFiltros = [p.desde, p.hasta, null, null, null, equipoDelAlcance];
  const [filas, opciones, rango] = await Promise.all([
    pool.query('WITH ' + BASE + ' ' + DIMENSIONES, parametros),
    pool.query('WITH ' + BASE + ' ' + OPCIONES, sinFiltros),
    pool.query('WITH ' + BASE + ' ' + RANGO, parametros)
  ]);
  return armarRespuesta(p, filas.rows, opciones.rows, rango.rows[0]);
}

module.exports = { validar, consultarTablero, armarRespuesta, MAX_DIAS };
