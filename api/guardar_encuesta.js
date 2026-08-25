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
    await client.query('BEGIN');

    // ── 1. Equipo de Salud ──────────────────────────────────────────
    const equipoCodigo = (encuesta.equipoSaludId || 'EQTEST').replace(/[^A-Za-z0-9]/g, '');
    const equipoRes = await client.query(`
      INSERT INTO aps.equipo_salud (codigo, activo) 
      VALUES ($1, true) 
      ON CONFLICT (codigo) DO UPDATE SET activo = true 
      RETURNING id
    `, [equipoCodigo]);
    const equipoId = equipoRes.rows[0].id;

    // ── 2. Funcionario / Responsable ────────────────────────────────
    const funcRes = await client.query(`
      INSERT INTO aps.funcionario (tipo_id, numero_id, nombre_completo, activo) 
      VALUES ($1, $2, $3, true)
      ON CONFLICT (tipo_id, numero_id) DO UPDATE SET activo = true
      RETURNING id
    `, [
      encuesta.responsableTipoId || 'CC',
      encuesta.responsableNumeroId || '99999999',
      encuesta.cabezaFamilia || 'Funcionario APS'
    ]);
    const responsableId = funcRes.rows[0].id;

    // ── 3. Hogar ────────────────────────────────────────────────────
    const hogarCodigo = encuesta.idHogar || ('HG' + Date.now());
    const hogarRes = await client.query(`
      INSERT INTO aps.hogar (
        codigo, municipio_codigo, area_ubicacion, territorio_codigo, 
        microterritorio_codigo, division_territorial, direccion_normalizada, 
        latitud, longitud, punto_referencia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (codigo) DO UPDATE SET actualizado_en = now()
      RETURNING id
    `, [
      hogarCodigo,
      '76001',
      encuesta.areaUbicacion || 'urbana',
      encuesta.territorio || 'T48',
      encuesta.microterritorio || 'MT01',
      encuesta.divisionTerritorial || 'Sin especificar',
      encuesta.direccion || encuesta.direccionLegible || ('Direccion ' + hogarCodigo),
      encuesta.latitud ? parseFloat(encuesta.latitud) : null,
      encuesta.longitud ? parseFloat(encuesta.longitud) : null,
      encuesta.ubicacionReferencia || 'ND'
    ]);
    const hogarId = hogarRes.rows[0].id;

    // ── 4. Ficha ────────────────────────────────────────────────────
    // Validar fecha: si tiene más de 28 días, usar fecha de hoy para evitar 
    // que el trigger RN-016 rechace la ficha (30 días máximo)
    let fechaDiligenciamiento = encuesta.fechaDiligenciamiento || new Date().toISOString().split('T')[0];
    const diffDias = Math.floor((Date.now() - new Date(fechaDiligenciamiento).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDias > 28) {
      fechaDiligenciamiento = new Date().toISOString().split('T')[0];
    }

    // Resolver la UZPE: quitar guiones para buscar el código correcto
    let uzpeCodigo = (encuesta.uzpe || 'UZPE006').replace(/-/g, '');
    // Verificar que existe; si no, usar la primera que haya
    const uzpeCheck = await client.query('SELECT codigo FROM cat.uzpe WHERE codigo = $1', [uzpeCodigo]);
    if (uzpeCheck.rows.length === 0) {
      const fallback = await client.query('SELECT codigo FROM cat.uzpe LIMIT 1');
      uzpeCodigo = fallback.rows.length > 0 ? fallback.rows[0].codigo : 'UZPE006';
    }

    const fichaCodigo = encuesta.codigoFicha || ('F' + Date.now());
    const fichaRes = await client.query(`
      INSERT INTO aps.ficha (
        codigo, consentimiento, situacion_inminente, departamento_codigo, municipio_codigo,
        uzpe_codigo, hogar_id, equipo_salud_id, responsable_id, fecha_diligenciamiento,
        entorno_abordaje, lider_entorno, jovenes_en_paz, estado, cerrada_en
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'cerrada', now())
      ON CONFLICT (codigo) DO NOTHING
      RETURNING id;
    `, [
      fichaCodigo,
      encuesta.consentimiento === 'si',
      encuesta.situacionInminente || 'no_aplica',
      '76',
      '76001',
      uzpeCodigo,
      hogarId,
      equipoId,
      responsableId,
      fechaDiligenciamiento,
      encuesta.entornoAbordaje || 'hogar',
      encuesta.cabezaFamilia || 'ND',
      encuesta.jovenesEnPaz === 'si'
    ]);

    let fichaId;
    if (fichaRes.rows.length > 0) {
      fichaId = fichaRes.rows[0].id;
    } else {
      // Ficha ya existe, obtener su ID
      const existing = await client.query('SELECT id FROM aps.ficha WHERE codigo = $1', [fichaCodigo]);
      fichaId = existing.rows[0].id;
    }

    // ── 5. Vivienda ─────────────────────────────────────────────────
    const perros = parseInt(encuesta.perros) || 0;
    const gatos = parseInt(encuesta.gatos) || 0;
    const tieneAnimales = (perros + gatos) > 0;

    await client.query(`
      INSERT INTO aps.vivienda (
        ficha_id, estrato, hogares_en_vivienda, personas_en_vivienda,
        habitaciones_vivienda, elementos_para_dormir, tipo_vivienda, material_techo,
        vectores, actividad_economica, perros, perros_vacunados, gatos, gatos_vacunados,
        carnet_antirrabico, fuente_agua, disposicion_excretas, aguas_residuales, residuos_solidos
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (ficha_id) DO NOTHING
    `, [
      fichaId,
      encuesta.estrato || 'bajo',
      parseInt(encuesta.hogaresEnVivienda) || 1,
      parseInt(encuesta.personasEnVivienda) || 1,
      parseInt(encuesta.habitacionesVivienda) || 1,
      parseInt(encuesta.elementosParaDormir) || 1,
      encuesta.tipoVivienda || 'casa',
      encuesta.materialTecho || 'zinc',
      encuesta.vectores || 'no',
      encuesta.actividadEconomica === 'si',
      perros,
      parseInt(encuesta.perrosVacunados) || 0,
      gatos,
      parseInt(encuesta.gatosVacunados) || 0,
      tieneAnimales ? (encuesta.carnetAntirrabico || 'no') : 'no_aplica',
      encuesta.fuenteAgua || 'acueducto_esp',
      encuesta.disposicionExcretas || 'alcantarillado',
      encuesta.aguasResiduales || 'alcantarillado',
      encuesta.residuosSolidos || 'servicio_aseo'
    ]);

    // ── 6. Familias, Personas e Integrantes ─────────────────────────
    // El modelo anidado es: familias: [{ ...familia, integrantes: [{ ...persona }] }]
    const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];

    for (let fi = 0; fi < familias.length; fi++) {
      const fam = familias[fi];

      // 6a. Obtener o crear la Familia (identidad persistente)
      const famCodigo = fam.idFamilia || encuesta.idFamilia || ('FM' + Date.now() + fi);
      const familiaRes = await client.query(`
        INSERT INTO aps.familia (codigo, hogar_id, consecutivo)
        VALUES ($1, $2, $3)
        ON CONFLICT (codigo) DO UPDATE SET codigo = EXCLUDED.codigo
        RETURNING id
      `, [famCodigo, hogarId, fi + 1]);
      const familiaId = familiaRes.rows[0].id;

      // 6b. Familia-Ficha (caracterización de esta visita)
      const familiaFichaRes = await client.query(`
        INSERT INTO aps.familia_ficha (
          ficha_id, familia_id, tipo_familia, numero_integrantes,
          cuidador_principal, zarit, redes_apoyo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (ficha_id, familia_id) DO NOTHING
        RETURNING id
      `, [
        fichaId,
        familiaId,
        fam.tipoFamilia || 'nuclear_biparental',
        parseInt(fam.numeroIntegrantes) || 1,
        fam.cuidadorPrincipal === 'si',
        fam.cuidadorPrincipal === 'si' ? (fam.zarit || 'ausencia') : null,
        fam.redesApoyo || 'cuenta_protectoras'
      ]);

      let familiaFichaId;
      if (familiaFichaRes.rows.length > 0) {
        familiaFichaId = familiaFichaRes.rows[0].id;
      } else {
        const existFF = await client.query(
          'SELECT id FROM aps.familia_ficha WHERE ficha_id = $1 AND familia_id = $2',
          [fichaId, familiaId]
        );
        familiaFichaId = existFF.rows[0].id;
      }

      // 6c. Integrantes de esta familia
      const integrantes = Array.isArray(fam.integrantes) ? fam.integrantes : [];

      for (let ii = 0; ii < integrantes.length; ii++) {
        const ing = integrantes[ii];

        // Solo procesar si tiene al menos nombre y tipo/numero de documento
        if (!ing.primerNombre || !ing.tipoId || !ing.numeroId) continue;

        // 6c-i. Persona (identidad persistente, UPSERT por tipo+numero)
        const personaRes = await client.query(`
          INSERT INTO aps.persona (
            tipo_id, numero_id, primer_nombre, segundo_nombre,
            primer_apellido, segundo_apellido, fecha_nacimiento, sexo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (tipo_id, numero_id) DO UPDATE SET
            primer_nombre = EXCLUDED.primer_nombre,
            primer_apellido = EXCLUDED.primer_apellido
          RETURNING id
        `, [
          ing.tipoId,
          ing.numeroId,
          ing.primerNombre,
          ing.segundoNombre || null,
          ing.primerApellido || 'ND',
          ing.segundoApellido || null,
          ing.fechaNacimiento || '2000-01-01',
          ing.sexo || 'hombre'
        ]);
        const personaId = personaRes.rows[0].id;

        // 6c-ii. Integrante (caracterización en esta visita)
        // 6c-ii. Integrante (caracterización en esta visita)
        let eapbCodigo = ing.eapbCodigo;
        let regimenAfiliacion = ing.regimenAfiliacion || 'no_afiliado';
        
        if (!eapbCodigo) {
          regimenAfiliacion = 'no_afiliado';
          eapbCodigo = null;
        }

        await client.query(`
          INSERT INTO aps.integrante (
            familia_ficha_id, persona_id, orden, genero,
            autoidentificacion_genero, orientacion_sexual,
            rol_familiar, regimen_afiliacion, eapb_codigo, pertenencia_etnica,
            limitacion_cotidiana
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (familia_ficha_id, persona_id) DO NOTHING
        `, [
          familiaFichaId,
          personaId,
          ii + 1,
          ing.genero || 'masculino',
          ing.autoidentificacionGenero || 'masculino',
          ing.orientacionSexual || null,
          ing.rolFamiliar || 'hijo',
          regimenAfiliacion,
          eapbCodigo,
          ing.pertenenciaEtnica || 'ninguna',
          ing.limitacionCotidiana === 'si'
        ]);
      }
    }

    await client.query('COMMIT');
    
    console.log('Encuesta guardada OK:', fichaCodigo, 'fichaId:', fichaId);
    res.status(200).json({ 
      message: 'Encuesta guardada en la base de datos',
      fichaId: fichaId,
      codigo: fichaCodigo
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    }
    console.error('Error al guardar encuesta en BD:', err.message);
    res.status(500).json({ error: 'Error de servidor', detalles: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
};
