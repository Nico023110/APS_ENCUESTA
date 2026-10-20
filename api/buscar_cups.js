/* =========================================================================
   Búsqueda de procedimientos CUPS / NoCUPS (ítems 114, 124 y 136a)
   -------------------------------------------------------------------------
   POR QUÉ EXISTE

   `catalogo_acciones` sirve las 64 acciones que un equipo básico concierta a
   diario —los NoCUPS y los CUPS marcados `apto_aps`— y con eso se llenaba un
   desplegable. Sirve para lo corriente y no para lo demás: el catálogo oficial
   tiene 10.044 procedimientos, y cuando el profesional realizó uno que no está
   en esa lista corta no tenía forma de registrarlo.

   Descargar los diez mil al navegador no es opción: son varios megabytes en
   una visita domiciliaria, muchas veces sobre datos móviles. Así que la
   búsqueda se hace aquí, contra la tabla, y viaja sólo lo que se pidió.

   QUÉ BUSCA Y EN QUÉ ORDEN

   Se contrasta contra el código y contra el nombre, de modo que sirvan las
   dos formas de buscar que usa un profesional: «876» para ir al código que ya
   conoce, «curación» para encontrarlo por lo que hizo. La búsqueda por nombre
   tolera tildes, palabras en otro orden y errores de digitación (ver la
   consulta). Primero el portafolio de la E.S.E., después por código, por
   palabras y por parecido, lo apto para APS y el código.
   ========================================================================= */

'use strict';

const { consultar } = require('./_db');
const { requerirSesion } = require('./_auth');

/* Por debajo de dos caracteres cualquier término trae cientos de filas que no
   ayudan a elegir: se prefiere no responder a inundar el desplegable. */
const MINIMO_TERMINO = 2;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

/* Cuánto debe parecerse el nombre a lo escrito para contar con errores de
   digitación (word_similarity de pg_trgm, de 0 a 1). 0,45 admite una o dos
   letras cambiadas en una palabra larga sin traer nombres sin relación. */
const PARECIDO_MINIMO = 0.45;

/* Palabras que no ayudan a buscar un procedimiento. */
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'por', 'para', 'con', 'en', 'y',
  'o', 'a', 'al', 'un', 'una']);

/* Lo escrito en minúsculas, sin tildes y partido en palabras de dos o más
   letras o dígitos. Sólo quedan [a-z0-9]: así viajan seguras a to_tsquery. */
function palabrasDeBusqueda(termino) {
  return String(termino).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function (p) { return p.length >= 2 && !PALABRAS_VACIAS.has(p); })
    .slice(0, 8);
}

function entero(valor, porDefecto, maximo) {
  const n = parseInt(valor, 10);
  if (!isFinite(n) || n < 1) return porDefecto;
  return Math.min(n, maximo);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const usuario = await requerirSesion(req, res, { permiso: 'catalogos.consultar' });
  if (!usuario) return;

  const consulta = req.query || {};
  const termino = String(consulta.q === undefined ? '' : consulta.q).trim();

  /* `codigo` pide una coincidencia exacta. Lo usa el formulario para resolver
     el nombre de un código que ya venía puesto —una ficha que se abre para
     corregir— sin tener que adivinar con una búsqueda por prefijo. */
  const exacto = String(consulta.codigo === undefined ? '' : consulta.codigo).trim();

  if (exacto === '' && termino.length < MINIMO_TERMINO) {
    return res.status(200).json({ termino: termino, total: 0, resultados: [] });
  }

  const limite = entero(consulta.limite, LIMITE_POR_DEFECTO, LIMITE_MAXIMO);

  try {
    if (exacto !== '') {
      const resultado = await consultar(`
        SELECT codigo, nombre, tipo::text AS tipo, ambito::text AS ambito,
               (apto_aps OR codigo LIKE 'NC-%') AS apto_aps
          FROM cat.cups
         WHERE habilitado AND codigo = $1
      `, [exacto]);

      return res.status(200).json({
        codigo: exacto,
        total: resultado.rows.length,
        resultados: resultado.rows
      });
    }

    /* El término entra como parámetro, nunca concatenado al SQL. Los comodines
       de LIKE que traiga escritos se escapan: sin esto, un `%` tecleado por
       descuido devuelve el catálogo entero. */
    const patron = termino.replace(/([\\%_])/g, '\\$1');
    const palabras = palabrasDeBusqueda(termino);

    /* Búsqueda tolerante (observación de la E.S.E., 19-10-2026). Antes era
       «el nombre contiene el texto tal cual»: «consulta odontologia» no
       encontraba «CONSULTA DE PRIMERA VEZ POR ODONTOLOGÍA GENERAL» —palabras
       en medio y una tilde—. Ahora cuenta cualquiera de tres caminos:

         por código     el código empieza por lo escrito (876 → 876110);
         por palabras   todas las palabras, en cualquier orden y sin tildes,
                        como comienzo de palabra (columna `busqueda`, índice
                        de texto en español sin acentos);
         por parecido   el nombre se parece a lo escrito aunque tenga errores
                        de digitación («odontolojia») — trigramas.

       Orden: primero el portafolio de la E.S.E. (15_portafolio_cups.sql),
       luego por código, por palabras, por parecido, lo apto para APS y el
       código, para que el orden sea estable. */
    const resultado = await consultar(`
      SELECT codigo, nombre, tipo::text AS tipo, ambito::text AS ambito,
             (apto_aps OR codigo LIKE 'NC-%') AS apto_aps,
             en_portafolio
        FROM (
          SELECT c.*,
                 (c.codigo ILIKE $1 || '%' ESCAPE '\\') AS por_codigo,
                 ($2 <> '' AND c.busqueda @@ to_tsquery('espanol_sin_acentos', $2)) AS por_palabras,
                 CASE WHEN $3 = '' THEN 0 ELSE word_similarity($3, unaccent(lower(c.nombre))) END AS parecido
            FROM cat.cups c
           WHERE c.habilitado
        ) candidatos
       WHERE por_codigo OR por_palabras OR parecido >= $4
       ORDER BY en_portafolio DESC, por_codigo DESC, por_palabras DESC, parecido DESC,
                (apto_aps OR codigo LIKE 'NC-%') DESC, codigo
       LIMIT $5
    `, [patron, palabras.map(function (p) { return p + ':*'; }).join(' & '), palabras.join(' '),
      PARECIDO_MINIMO, limite]);

    /* El catálogo cambia con cada actualización oficial, no durante la visita:
       una hora de caché ahorra viajes sin servir nada viejo. */
    res.setHeader('Cache-Control', 'public, max-age=3600');

    res.status(200).json({
      termino: termino,
      total: resultado.rows.length,
      /* Avisa de que la lista viene recortada, para que el formulario pueda
         decir «siga escribiendo» en vez de dejar creer que no hay más. */
      truncado: resultado.rows.length === limite,
      resultados: resultado.rows
    });
  } catch (err) {
    console.error('Error al buscar en el catálogo CUPS:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
