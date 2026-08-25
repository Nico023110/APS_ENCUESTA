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
  let client;

  try {
    client = await pool.connect();
    
    // Iniciar transacción
    await client.query('BEGIN');

    // 1. Obtener o insertar Equipo de Salud (Manejo para pruebas)
    let equipoId = 1;
    const equipoCodigoLimpio = (encuesta.equipoSaludId || 'EQTEST').replace(/[^A-Za-z0-9]/g, '');
    const equipoRes = await client.query(`
      INSERT INTO aps.equipo_salud (codigo, activo) 
      VALUES ($1, true) 
      ON CONFLICT (codigo) DO UPDATE SET activo = true 
      RETURNING id
    `, [equipoCodigoLimpio]);
    equipoId = equipoRes.rows[0].id;

    // 2. Obtener o insertar Funcionario (Responsable)
    let responsableId = 1;
    const funcRes = await client.query(`
      INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, activo) 
      VALUES ($1, $2, 'Funcionario de Prueba', true)
      ON CONFLICT (tipo_id, numero_id) DO UPDATE SET activo = true
      RETURNING id
    `, [encuesta.responsableTipoId || 'CC', encuesta.responsableNumeroId || '99999999']);
    responsableId = funcRes.rows[0].id;

    // 3. Obtener o insertar Hogar (Usando el código de hogar como llave única)
    const hogarRes = await client.query(`
      INSERT INTO aps.hogar (
        codigo, municipio_codigo, area_ubicacion, territorio_codigo, microterritorio_codigo, 
        division_territorial, direccion_normalizada, latitud, longitud, punto_referencia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (codigo) DO UPDATE SET actualizado_en = now()
      RETURNING id
    `, [
      encuesta.idHogar || ('HG-' + Date.now()),
      '76001', 
      encuesta.areaUbicacion || 'urbana',
      encuesta.territorio || 'T48',
      encuesta.microterritorio || 'MT01',
      encuesta.divisionTerritorial || 'Barrio',
      'Direccion ' + (encuesta.idHogar || 'ND'),
      encuesta.latitud || null,
      encuesta.longitud || null,
      encuesta.ubicacionReferencia || 'ND'
    ]);
    const hogarId = hogarRes.rows[0].id;

    // 4. Insertar Ficha (Código de ficha es único)
    const insertFicha = `
      INSERT INTO aps.ficha (
        codigo, consentimiento, situacion_inminente, departamento_codigo, municipio_codigo,
        uzpe_codigo, hogar_id, equipo_salud_id, responsable_id, fecha_diligenciamiento,
        entorno_abordaje, lider_entorno, jovenes_en_paz, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'sincronizada')
      ON CONFLICT (codigo) DO NOTHING
      RETURNING id;
    `;
    const valoresFicha = [
      encuesta.codigoFicha || ('F-' + Date.now()),
      encuesta.consentimiento === 'si',
      encuesta.situacionInminente || 'no_aplica',
      '76',
      '76001',
      encuesta.uzpe || 'UZPE-02',
      hogarId,
      equipoId,
      responsableId,
      encuesta.fechaDiligenciamiento || new Date().toISOString().split('T')[0],
      encuesta.entornoAbordaje || 'hogar',
      encuesta.cabezaFamilia || 'ND',
      encuesta.jovenesEnPaz === 'si'
    ];
    
    let fichaId;
    const fichaResult = await client.query(insertFicha, valoresFicha);
    if (fichaResult.rows.length > 0) {
      fichaId = fichaResult.rows[0].id;
    } else {
      const existingFicha = await client.query('SELECT id FROM aps.ficha WHERE codigo = $1', [valoresFicha[0]]);
      fichaId = existingFicha.rows[0].id;
    }

    // 5. Insertar Vivienda (1 a 1 con Ficha)
    await client.query(`
      INSERT INTO aps.vivienda (
        ficha_id, estrato, tipo_vivienda, material_techo, vectores
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (ficha_id) DO NOTHING
    `, [
      fichaId,
      encuesta.estrato || 'bajo',
      encuesta.tipoVivienda || 'casa',
      encuesta.materialTecho || 'zinc',
      encuesta.vectores === 'si'
    ]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Encuesta guardada correctamente en la Base de Datos PostgreSQL' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error al guardar encuesta en BD:', err);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
};
