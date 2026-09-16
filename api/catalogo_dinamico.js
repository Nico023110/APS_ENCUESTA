'use strict';

const { consultar } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const [eapbRes, prestadorRes, uzpeRes, terRes] = await Promise.all([
      consultar('SELECT codigo AS valor, nombre AS etiqueta, regimen FROM cat.eapb WHERE vigente = true ORDER BY nombre'),
      consultar('SELECT codigo AS valor, nombre AS etiqueta FROM cat.prestador WHERE vigente = true ORDER BY nombre'),
      consultar('SELECT codigo AS valor, nombre AS etiqueta FROM cat.uzpe WHERE vigente = true ORDER BY nombre'),
      consultar(`
        SELECT t.codigo as ter_codigo, m.codigo as mt_codigo, m.nombre, m.comuna
        FROM cat.territorio t
        /* LEFT, no INNER: el ítem 7 debe listar los 110 territorios de la
           ciudad (T01–T110, observación del equipo EBS) aunque sólo 37 —los
           del Anexo A, T48–T84— tengan microterritorios documentados. Con
           INNER JOIN, un territorio sin microterritorio simplemente
           desaparecía de esta respuesta: el catálogo estático (110) se veía
           al cargar la página y se reducía en silencio a 37 en cuanto
           llegaba esta consulta. */
        LEFT JOIN cat.microterritorio m ON t.codigo = m.territorio_codigo AND m.vigente = true
        WHERE t.vigente = true
        ORDER BY t.codigo, m.codigo
      `)
    ]);

    const territorios = {};
    for (const row of terRes.rows) {
      if (!territorios[row.ter_codigo]) territorios[row.ter_codigo] = [];
      // El LEFT JOIN deja una fila con mt_codigo NULL para el territorio sin
      // microterritorios: se registra el territorio (arreglo vacío) sin
      // empujar una fila fantasma.
      if (row.mt_codigo) {
        territorios[row.ter_codigo].push({
          codigo: row.mt_codigo,
          nombre: row.nombre,
          comuna: row.comuna
        });
      }
    }

    const catalogos = {
      eapb: eapbRes.rows,
      prestador: prestadorRes.rows,
      uzpe: uzpeRes.rows,
      territorios: territorios
    };

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(catalogos);
  } catch (err) {
    console.error('Error al obtener catálogos dinámicos:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
