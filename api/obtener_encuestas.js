const { consultar } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const resultado = await consultar(`
      SELECT id, codigo, fecha_diligenciamiento, estado
      FROM aps.ficha
      ORDER BY capturada_en DESC
      LIMIT 100
    `);

    res.status(200).json(resultado.rows);
  } catch (err) {
    console.error('Error al obtener encuestas:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
