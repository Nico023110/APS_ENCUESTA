/* =========================================================================
   Encuesta_APS — Listado de fichas guardadas en la base
   -------------------------------------------------------------------------
   POR QUÉ EXISTE

   El historial y la portada leían únicamente `localStorage`: lo guardado
   desde OTRO dispositivo nunca aparecía, aunque estuviera en la base, porque
   nada volvía a consultarla. Un equipo diligenciaba, sincronizaba, y esa
   ficha quedaba invisible para cualquier otro equipo que abriera el mismo
   enlace — la base tenía el dato, pero nadie lo pedía de vuelta.

   Este endpoint es esa consulta. Devuelve lo mínimo que necesitan las dos
   vistas que listan fichas —la tabla de la portada y la del historial—: no
   la ficha completa, que exigiría reunir familias, integrantes y planes de
   una docena de tablas. Ver el detalle completo de una fila puntual lo
   resuelve `obtener_ficha.js`.

   QUÉ NO TRAE

   `direccion_componentes`, el origen de las coordenadas y la consulta de
   geocodificación no se persisten en ninguna tabla hoy: el formulario los
   calcula al vuelo y `guardar_encuesta.js` nunca los escribe. No se inventan
   aquí; las columnas del historial que dependen de ellos simplemente no
   aplican a una fila que viene de la base.
   ========================================================================= */

'use strict';

const { consultar } = require('./_db');

/* Techo del listado. La app no pagina el historial —lo pinta entero—, así
   que sin un límite una base con años de fichas tumbaría el navegador antes
   que el servidor. 2000 filas es generoso para lo que captura un equipo
   básico de salud; si el proyecto crece más allá de eso, el historial
   necesita paginación antes que este número. */
const LIMITE = 2000;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const resultado = await consultar(`
      SELECT
        f.codigo                  AS codigo_ficha,
        f.capturada_en,
        f.fechas_modificacion,
        f.situacion_inminente,
        h.territorio_codigo       AS territorio,
        h.microterritorio_codigo  AS microterritorio,
        h.division_territorial,
        h.direccion_normalizada   AS direccion,
        v.personas_por_habitacion,
        v.hacinamiento
      FROM aps.ficha f
      JOIN aps.hogar h        ON h.id = f.hogar_id
      LEFT JOIN aps.vivienda v ON v.ficha_id = f.id
      ORDER BY f.capturada_en DESC
      LIMIT ${LIMITE}
    `);

    /* Los nombres de columna llegan en snake_case porque así los devuelve
       PostgreSQL; el resto de la aplicación —recolectarDatosFormulario,
       renderizarHistorial— habla en camelCase. Se traduce aquí, una sola
       vez, para que el frontend no tenga que saber que esta fila vino de SQL
       y no del formulario. */
    const filas = resultado.rows.map(function (fila) {
      return {
        codigoFicha: fila.codigo_ficha,
        fechaRegistro: fila.capturada_en,
        fechasModificacion: Array.isArray(fila.fechas_modificacion) ? fila.fechas_modificacion : [],
        situacionInminente: fila.situacion_inminente,
        territorio: fila.territorio,
        microterritorio: fila.microterritorio,
        divisionTerritorial: fila.division_territorial,
        direccion: fila.direccion,
        personasPorHabitacion: fila.personas_por_habitacion === null
          ? null : Number(fila.personas_por_habitacion),
        /* La base la guarda boolean; el resto de la app —badgeHacinamiento,
           los filtros del historial— habla en 'si'/'no', como en el formulario. */
        hacinamiento: fila.hacinamiento === null ? null : (fila.hacinamiento ? 'si' : 'no')
      };
    });

    res.status(200).json(filas);
  } catch (err) {
    console.error('Error al listar las fichas:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
