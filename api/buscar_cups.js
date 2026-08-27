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

   QUÉ BUSCA

   Lo que se escribe se contrasta contra el código y contra el nombre, de modo
   que sirvan las dos formas de buscar que usa un profesional: «876» para ir
   al código que ya conoce, «curación» para encontrarlo por lo que hizo.

   ORDEN DE LOS RESULTADOS

     1. Los que empiezan por lo escrito, antes que los que sólo lo contienen:
        quien teclea «876» busca 876110, no un nombre que mencione 876.
     2. Entre iguales, primero lo apto para APS. Un equipo en campo elige mil
        veces la visita domiciliaria y una vez la arteriografía coronaria.
     3. Y por código, para que el orden sea estable entre dos búsquedas.
   ========================================================================= */

'use strict';

const { consultar } = require('./_db');

/* Por debajo de dos caracteres cualquier término trae cientos de filas que no
   ayudan a elegir: se prefiere no responder a inundar el desplegable. */
const MINIMO_TERMINO = 2;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 50;

function entero(valor, porDefecto, maximo) {
  const n = parseInt(valor, 10);
  if (!isFinite(n) || n < 1) return porDefecto;
  return Math.min(n, maximo);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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

    const resultado = await consultar(`
      SELECT codigo, nombre, tipo::text AS tipo, ambito::text AS ambito,
             (apto_aps OR codigo LIKE 'NC-%') AS apto_aps
        FROM cat.cups
       WHERE habilitado
         AND (codigo ILIKE $1 || '%' ESCAPE '\\' OR nombre ILIKE '%' || $1 || '%' ESCAPE '\\')
       ORDER BY (codigo ILIKE $1 || '%' ESCAPE '\\') DESC,
                (apto_aps OR codigo LIKE 'NC-%') DESC,
                codigo
       LIMIT $2
    `, [patron, limite]);

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
