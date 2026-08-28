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
        JOIN cat.microterritorio m ON t.codigo = m.territorio_codigo
        WHERE t.vigente = true AND m.vigente = true
        ORDER BY t.codigo, m.codigo
      `)
    ]);

    const territorios = {};
    for (const row of terRes.rows) {
      if (!territorios[row.ter_codigo]) territorios[row.ter_codigo] = [];
      territorios[row.ter_codigo].push({
        codigo: row.mt_codigo,
        nombre: row.nombre,
        comuna: row.comuna
      });
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
