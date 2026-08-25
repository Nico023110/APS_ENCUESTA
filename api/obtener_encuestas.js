const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const client = await pool.connect();
    // Por ahora obtenemos solo un resumen de las fichas para listarlas
    // Cuando las tablas estén creadas, esto funcionará.
    const query = `
      SELECT id, codigo, fecha_diligenciamiento, estado
      FROM aps.ficha
      ORDER BY capturada_en DESC
      LIMIT 100
    `;
    const result = await client.query(query);
    client.release();

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error al obtener encuestas:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
