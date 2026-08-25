const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const encuesta = req.body;

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // NOTA: Aquí iría la lógica de inserción completa en las tablas relacionales:
      // aps.hogar, aps.familia, aps.persona, aps.ficha, aps.vivienda, aps.integrante
      
      // Ejemplo simplificado para insertar la ficha base (Asumiendo que los IDs relacionales ya existan o se creen aquí):
      /*
      const insertFicha = `
        INSERT INTO aps.ficha (
          consentimiento, situacion_inminente, departamento_codigo, municipio_codigo,
          uzpe_codigo, hogar_id, equipo_salud_id, responsable_id, fecha_diligenciamiento,
          entorno_abordaje, jovenes_en_paz, lider_entorno
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id;
      `;
      const valoresFicha = [
        encuesta.consentimiento === 'si',
        encuesta.situacionInminente,
        '76', // Ejemplo: Valle del Cauca
        '76001', // Ejemplo: Cali
        encuesta.uzpe,
        1, // ID de hogar (se debe crear o buscar primero)
        1, // ID de equipo de salud
        1, // ID del responsable
        encuesta.fechaDiligenciamiento,
        encuesta.entornoAbordaje,
        encuesta.jovenesEnPaz === 'si',
        encuesta.cabezaFamilia || 'ND'
      ];
      
      await client.query(insertFicha, valoresFicha);
      */
      
      await client.query('COMMIT');
      res.status(200).json({ message: 'Encuesta recibida por la API y guardada en BD (simulado)' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error al guardar encuesta:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  }
};
