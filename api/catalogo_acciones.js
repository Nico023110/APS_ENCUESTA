/* =========================================================================
   Catálogo de acciones del plan de cuidado (ítems 114, 124 y 136a)
   -------------------------------------------------------------------------
   POR QUÉ EXISTE

   El código de la acción se digitaba a mano. El formulario sólo comprobaba
   que no estuviera vacío; la base exige que exista en `cat.cups`. Resultado:
   la ficha se daba por buena en pantalla, el encuestador la veía en su
   historial, y al sincronizar la rechazaba un 400 que nombraba una regla
   —«El código no existe en el catálogo CUPS ni en los NoCUPS»— sobre un campo
   que nadie le había dicho cómo llenar.

   Sirviendo aquí la lista, el formulario dejó de admitir códigos inventados.

   QUÉ DEVUELVE

   Los NoCUPS (acciones propias de APS, NC-…) y los CUPS marcados `apto_aps`:
   unas decenas de códigos, no los diez mil del catálogo completo. Es lo que
   un equipo básico de salud puede concertar en una visita domiciliaria.

   PARA QUÉ SIRVE HOY

   Ya no llena ningún desplegable. Desde que el campo se escribe y se busca
   contra la tabla entera (`buscar_cups`), un equipo puede registrar cualquiera
   de los 10.044 procedimientos oficiales, no sólo estas decenas.

   Esta lista sigue descargándose por una razón: es la única que cabe en el
   dispositivo. Sin señal —que es la mitad de las visitas— la búsqueda se hace
   sobre ella, y el encuestador conserva lo que va a necesitar el 99% de las
   veces en vez de quedarse con un campo mudo.
   ========================================================================= */

'use strict';

const { consultar } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const resultado = await consultar(`
      SELECT codigo, nombre, ambito::text AS ambito
        FROM cat.cups
       WHERE (apto_aps OR codigo LIKE 'NC-%')
         AND habilitado
       ORDER BY (codigo LIKE 'NC-%') DESC, ambito NULLS LAST, codigo
    `);

    /* Se cachea en el navegador para que el formulario siga funcionando sin
       red: la lista cambia con cada actualización del catálogo, no a diario. */
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(resultado.rows);
  } catch (err) {
    console.error('Error al obtener el catálogo de acciones:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
