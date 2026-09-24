/* =========================================================================
   APS APP — Variables del anexo técnico SI-APS (reporte APS124CCFP)
   -------------------------------------------------------------------------
   GENERADO por bd/gen_anexo.js desde anexo.js. No editar a mano.
   Idempotente: se aplica con `npm run bd:migrar` sobre la base existente y
   con `npm run bd:crear` sobre una nueva.
   ========================================================================= */

BEGIN;

/* =========================================================================
   1. ÍTEMS DEL INSTRUMENTO QUE EL ANEXO CAMBIÓ DE FORMA
   -------------------------------------------------------------------------
   La situación inminente (ítem 2, variable 23) y los ítems 46 a 49
   (variables 53, 58, 59 y 62) pasan de respuesta única a selección múltiple.
   Cada uno gana su tabla puente; la columna de siempre se conserva con la
   opción principal —la primera marcada— para no romper lo que ya la lee
   (listados, la vista de riesgo anterior, consultas de análisis).
   ========================================================================= */

CREATE TABLE IF NOT EXISTS aps.ficha_situacion_inminente (
  ficha_id bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT fsi_codigo_valido CHECK (cat.es_opcion('SITUACION_INMINENTE', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_fuente_agua (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vfa_codigo_valido CHECK (cat.es_opcion('FUENTE_AGUA', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_disposicion_excretas (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vde_codigo_valido CHECK (cat.es_opcion('DISPOSICION_EXCRETAS', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_aguas_residuales (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT var_codigo_valido CHECK (cat.es_opcion('AGUAS_RESIDUALES', codigo))
);

CREATE TABLE IF NOT EXISTS aps.vivienda_residuos_solidos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vrs_codigo_valido CHECK (cat.es_opcion('RESIDUOS_SOLIDOS', codigo))
);

/* Las fichas guardadas antes del anexo tienen su respuesta en la columna: pasa
   a ser la primera fila de su puente. */
INSERT INTO aps.ficha_situacion_inminente (ficha_id, codigo)
  SELECT id, situacion_inminente FROM aps.ficha WHERE situacion_inminente IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_fuente_agua (ficha_id, codigo)
  SELECT ficha_id, fuente_agua FROM aps.vivienda WHERE fuente_agua IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_disposicion_excretas (ficha_id, codigo)
  SELECT ficha_id, disposicion_excretas FROM aps.vivienda WHERE disposicion_excretas IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_aguas_residuales (ficha_id, codigo)
  SELECT ficha_id, aguas_residuales FROM aps.vivienda WHERE aguas_residuales IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO aps.vivienda_residuos_solidos (ficha_id, codigo)
  SELECT ficha_id, residuos_solidos FROM aps.vivienda WHERE residuos_solidos IS NOT NULL
  ON CONFLICT DO NOTHING;

/* Ítem 77: «Víctima de violencia de género e intrafamiliar» no existe en el
   anexo; la opción que abre la modalidad de la violencia es la 10, «Víctima
   de violencia interpersonal». */
INSERT INTO aps.integrante_sujeto_proteccion (integrante_id, codigo)
  SELECT integrante_id, 'victima_violencia_interpersonal'
    FROM aps.integrante_sujeto_proteccion WHERE codigo = 'victima_violencia_genero'
  ON CONFLICT DO NOTHING;
DELETE FROM aps.integrante_sujeto_proteccion WHERE codigo = 'victima_violencia_genero';

/* =========================================================================
   2. IDENTIFICADORES OFICIALES DEL REPORTE (variables 123 y 124)
   -------------------------------------------------------------------------
   El anexo arma el número de la vivienda con departamento, subregión,
   municipio, territorio y microterritorio, más «H» y un consecutivo de cuatro
   dígitos que REINICIA POR MICROTERRITORIO; el de la familia le suma «F» y
   el consecutivo dentro del hogar (aps.familia.consecutivo, que ya existe).
   El consecutivo del hogar se asigna una vez y no cambia: la misma vivienda
   tiene que llegar con el mismo número a cada reporte semanal.
   ========================================================================= */

ALTER TABLE aps.hogar ADD COLUMN IF NOT EXISTS consecutivo_sispro int;

CREATE UNIQUE INDEX IF NOT EXISTS ux_hogar_consecutivo_sispro
  ON aps.hogar (territorio_codigo, microterritorio_codigo, consecutivo_sispro)
  WHERE consecutivo_sispro IS NOT NULL;

/* Los hogares que ya existen reciben su consecutivo en orden de creación. */
WITH numerados AS (
  SELECT h.id,
         coalesce((SELECT max(o.consecutivo_sispro) FROM aps.hogar o
                    WHERE o.territorio_codigo = h.territorio_codigo
                      AND o.microterritorio_codigo = h.microterritorio_codigo), 0)
         + row_number() OVER (PARTITION BY h.territorio_codigo, h.microterritorio_codigo ORDER BY h.id) AS n
    FROM aps.hogar h
   WHERE h.consecutivo_sispro IS NULL
)
UPDATE aps.hogar h SET consecutivo_sispro = numerados.n
  FROM numerados WHERE numerados.id = h.id;

/* Parámetros del reporte. La subregión (variable 4) la asigna la Secretaría
   en el componente de gestión técnica de SI-APS: tres dígitos que el anexo
   no permite deducir. Mientras falte, el archivo plano la señala. */
INSERT INTO cat.parametro (clave, valor, descripcion) VALUES
  ('entidad_reportante', '{"tipo":"NI","numero":"805027289","nombre":"Red de Salud de Ladera E.S.E."}',
   'Anexo SI-APS, registro tipo 1 y nombre del archivo: tipo y número (NIT sin dígito de verificación) de la entidad que reporta.'),
  ('subregion_sispro', 'null',
   'Anexo SI-APS, variable 4: código de subregión (3 dígitos) parametrizado en SI-APS para el distrito. Sin él, las variables 4, 123 y 124 quedan incompletas.'),
  ('nit_prestador_primario', '"805027289"',
   'Anexo SI-APS, variable 26: NIT sin dígito de verificación del prestador primario u organismo de adscripción del EBS.')
ON CONFLICT (clave) DO NOTHING;

/* =========================================================================
   3. RN-211 CON LAS LISTAS
   -------------------------------------------------------------------------
   La vista contaba un hallazgo por la opción única de cada ítem. Ahora basta
   con que UNA de las opciones marcadas sea de riesgo; las fichas antiguas sin
   puente siguen contando por su columna.
   ========================================================================= */

CREATE OR REPLACE FUNCTION aps.alguna_marca(p_dominio text, p_codigos text[], p_bandera text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(bool_or(aps.marca(p_dominio, c, p_bandera)), false)
    FROM unnest(p_codigos) AS c;
$$;

CREATE OR REPLACE VIEW aps.v_riesgo_vivienda AS
SELECT v.ficha_id,
       v.hacinamiento,
       v.hacinamiento_critico,
       (v.hacinamiento)::int                                                          -- RN-033
     + aps.alguna_marca('FUENTE_AGUA', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_fuente_agua x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.fuente_agua]), 'noSegura')::int                                       -- RN-046
     + aps.alguna_marca('DISPOSICION_EXCRETAS', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_disposicion_excretas x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.disposicion_excretas]), 'critica')::int                               -- RN-047
     + aps.alguna_marca('AGUAS_RESIDUALES', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_aguas_residuales x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.aguas_residuales]), 'critica')::int                                   -- RN-048
     + aps.alguna_marca('RESIDUOS_SOLIDOS', coalesce(
         (SELECT array_agg(codigo) FROM aps.vivienda_residuos_solidos x WHERE x.ficha_id = v.ficha_id),
         ARRAY[v.residuos_solidos]), 'critica')::int                                   -- RN-049
     + (v.vectores = 'si')::int                                                        -- RN-037
     + (v.material_techo IN ('desechos','palma_paja','fibrocemento_con_asbesto','fibrocemento_asbesto'))::int -- RN-035
     + (v.perros_vacunados < v.perros
        OR v.gatos_vacunados < v.gatos
        OR v.carnet_antirrabico = 'no')::int                                           -- RN-042/044/045
     + (v.elementos_para_dormir < v.personas_en_vivienda / 2.0)::int                   -- RN-031
       AS hallazgos
  FROM aps.vivienda v;

/* =========================================================================
   4. VARIABLES NUEVAS DEL ANEXO (generado de anexo.js)
   ========================================================================= */

/* --- aps.ficha --------------------------------------------------------- */
-- A2.24 · Observaciones de la situación atendida
ALTER TABLE aps.ficha ADD COLUMN IF NOT EXISTS observaciones_situacion text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fich_observaciones_situacion') THEN
    ALTER TABLE aps.ficha ADD CONSTRAINT ax_fich_observaciones_situacion CHECK (char_length(observaciones_situacion) <= 200 AND position('|' in observaciones_situacion) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.ficha.observaciones_situacion IS 'Anexo SI-APS A2.24: Observaciones de la situación atendida';

/* --- aps.hogar --------------------------------------------------------- */
-- A2.8 · Tipo de ubicación de la vivienda
ALTER TABLE aps.hogar ADD COLUMN IF NOT EXISTS tipo_ubicacion text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_hoga_tipo_ubicacion') THEN
    ALTER TABLE aps.hogar ADD CONSTRAINT ax_hoga_tipo_ubicacion CHECK (cat.es_opcion('TIPO_UBICACION', tipo_ubicacion));
  END IF;
END $$;
COMMENT ON COLUMN aps.hogar.tipo_ubicacion IS 'Anexo SI-APS A2.8: Tipo de ubicación de la vivienda';

/* --- aps.vivienda ------------------------------------------------------ */
-- A2.15 · Teléfono de la vivienda
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS telefono_vivienda text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_telefono_vivienda') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_telefono_vivienda CHECK (char_length(telefono_vivienda) <= 10 AND position('|' in telefono_vivienda) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.telefono_vivienda IS 'Anexo SI-APS A2.15: Teléfono de la vivienda';

-- A2.34 · Ambientes de la vivienda con luz natural
CREATE TABLE IF NOT EXISTS aps.vivienda_ambientes_luz_natural (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_ambientes_luz_natural_valido CHECK (cat.es_opcion('AMBIENTES_VIVIENDA', codigo))
);
COMMENT ON TABLE aps.vivienda_ambientes_luz_natural IS 'Anexo SI-APS A2.34: Ambientes de la vivienda con luz natural';

-- A2.35 · Ambientes de la vivienda con ventilación natural o artificial
CREATE TABLE IF NOT EXISTS aps.vivienda_ambientes_ventilacion (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_ambientes_ventilacion_valido CHECK (cat.es_opcion('AMBIENTES_VIVIENDA', codigo))
);
COMMENT ON TABLE aps.vivienda_ambientes_ventilacion IS 'Anexo SI-APS A2.35: Ambientes de la vivienda con ventilación natural o artificial';

-- A2.36 · Elementos que hay en la vivienda
CREATE TABLE IF NOT EXISTS aps.vivienda_elementos_vivienda (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_elementos_vivienda_valido CHECK (cat.es_opcion('ELEMENTOS_VIVIENDA', codigo))
);
COMMENT ON TABLE aps.vivienda_elementos_vivienda IS 'Anexo SI-APS A2.36: Elementos que hay en la vivienda';

-- A2.37 · Alumbrado predominante en la vivienda
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS alumbrado text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_alumbrado') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_alumbrado CHECK (cat.es_opcion('ALUMBRADO', alumbrado));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.alumbrado IS 'Anexo SI-APS A2.37: Alumbrado predominante en la vivienda';

-- A2.41 · ¿La cocina está separada de los demás espacios de la vivienda?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS cocina_separada text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_cocina_separada') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_cocina_separada CHECK (cat.es_opcion('SI_NO', cocina_separada));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.cocina_separada IS 'Anexo SI-APS A2.41: ¿La cocina está separada de los demás espacios de la vivienda?';

-- A2.42 · ¿El baño está separado de los demás espacios de la vivienda?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS bano_separado text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_bano_separado') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_bano_separado CHECK (cat.es_opcion('SI_NO', bano_separado));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.bano_separado IS 'Anexo SI-APS A2.42: ¿El baño está separado de los demás espacios de la vivienda?';

-- A2.43 · ¿Los dormitorios están separados físicamente?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS dormitorios_separados text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_dormitorios_separados') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_dormitorios_separados CHECK (cat.es_opcion('SI_NO', dormitorios_separados));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.dormitorios_separados IS 'Anexo SI-APS A2.43: ¿Los dormitorios están separados físicamente?';

-- A2.38 · Acceso a la vivienda
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS acceso_vivienda text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_acceso_vivienda') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_acceso_vivienda CHECK (cat.es_opcion('ACCESO_VIVIENDA', acceso_vivienda));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.acceso_vivienda IS 'Anexo SI-APS A2.38: Acceso a la vivienda';

-- A2.39 · Otros accesos a la vivienda
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS otros_accesos_vivienda text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_otros_accesos_vivienda') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_otros_accesos_vivienda CHECK (char_length(otros_accesos_vivienda) <= 200 AND position('|' in otros_accesos_vivienda) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.otros_accesos_vivienda IS 'Anexo SI-APS A2.39: Otros accesos a la vivienda';

-- A2.44 · Medios de transporte habituales de la familia
CREATE TABLE IF NOT EXISTS aps.vivienda_medios_transporte (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_medios_transporte_valido CHECK (cat.es_opcion('MEDIOS_TRANSPORTE', codigo))
);
COMMENT ON TABLE aps.vivienda_medios_transporte IS 'Anexo SI-APS A2.44: Medios de transporte habituales de la familia';

-- A2.45 · ¿Qué otro medio de transporte?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS medios_transporte_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_medios_transporte_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_medios_transporte_otro CHECK (char_length(medios_transporte_otro) <= 200 AND position('|' in medios_transporte_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.medios_transporte_otro IS 'Anexo SI-APS A2.45: ¿Qué otro medio de transporte?';

-- A2.46 · Elementos de seguridad que usa la familia al desplazarse
CREATE TABLE IF NOT EXISTS aps.vivienda_seguridad_desplazamiento (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_seguridad_desplazamiento_valido CHECK (cat.es_opcion('SEGURIDAD_DESPLAZAMIENTO', codigo))
);
COMMENT ON TABLE aps.vivienda_seguridad_desplazamiento IS 'Anexo SI-APS A2.46: Elementos de seguridad que usa la familia al desplazarse';

-- A2.47 · ¿Qué otro elemento de seguridad?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS seguridad_desplazamiento_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_seguridad_desplazamiento_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_seguridad_desplazamiento_otro CHECK (char_length(seguridad_desplazamiento_otro) <= 200 AND position('|' in seguridad_desplazamiento_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.seguridad_desplazamiento_otro IS 'Anexo SI-APS A2.47: ¿Qué otro elemento de seguridad?';

-- A2.48 · Factores que hacen que el desplazamiento tome más de 30 minutos
CREATE TABLE IF NOT EXISTS aps.vivienda_desplazamiento_mayor30 (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_desplazamiento_mayor30_valido CHECK (cat.es_opcion('DESPLAZAMIENTO_30', codigo))
);
COMMENT ON TABLE aps.vivienda_desplazamiento_mayor30 IS 'Anexo SI-APS A2.48: Factores que hacen que el desplazamiento tome más de 30 minutos';

-- A2.49 · ¿Qué otro factor?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS desplazamiento_mayor30_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_desplazamiento_mayor30_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_desplazamiento_mayor30_otro CHECK (char_length(desplazamiento_mayor30_otro) <= 200 AND position('|' in desplazamiento_mayor30_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.desplazamiento_mayor30_otro IS 'Anexo SI-APS A2.49: ¿Qué otro factor?';

-- A2.51 · ¿El área de trabajo es independiente de las demás áreas de la vivienda?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS area_trabajo_independiente text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_area_trabajo_independiente') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_area_trabajo_independiente CHECK (cat.es_opcion('SI_NO', area_trabajo_independiente));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.area_trabajo_independiente IS 'Anexo SI-APS A2.51: ¿El área de trabajo es independiente de las demás áreas de la vivienda?';

-- A2.52 · ¿Algún integrante de la familia se ha visto afectado por la actividad económica?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS familiar_afectado_actividad text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_familiar_afectado_actividad') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_familiar_afectado_actividad CHECK (cat.es_opcion('SI_NO', familiar_afectado_actividad));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.familiar_afectado_actividad IS 'Anexo SI-APS A2.52: ¿Algún integrante de la familia se ha visto afectado por la actividad económica?';

-- A2.97 · Finalidad de la tenencia de los animales
CREATE TABLE IF NOT EXISTS aps.vivienda_finalidad_tenencia (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_finalidad_tenencia_valido CHECK (cat.es_opcion('FINALIDAD_TENENCIA', codigo))
);
COMMENT ON TABLE aps.vivienda_finalidad_tenencia IS 'Anexo SI-APS A2.97: Finalidad de la tenencia de los animales';

-- A2.98 · Confinamiento de los animales
CREATE TABLE IF NOT EXISTS aps.vivienda_confinamiento_animales (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_confinamiento_animales_valido CHECK (cat.es_opcion('CONFINAMIENTO_ANIMALES', codigo))
);
COMMENT ON TABLE aps.vivienda_confinamiento_animales IS 'Anexo SI-APS A2.98: Confinamiento de los animales';

-- A2.99 · ¿Se desparasita a los animales domésticos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS desparasita_animales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_desparasita_animales') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_desparasita_animales CHECK (cat.es_opcion('SI_NO', desparasita_animales));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.desparasita_animales IS 'Anexo SI-APS A2.99: ¿Se desparasita a los animales domésticos?';

-- A2.100 · ¿Las instalaciones para los animales son seguras?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS instalaciones_seguras_animales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_instalaciones_seguras_animales') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_instalaciones_seguras_animales CHECK (cat.es_opcion('SI_NO', instalaciones_seguras_animales));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.instalaciones_seguras_animales IS 'Anexo SI-APS A2.100: ¿Las instalaciones para los animales son seguras?';

-- A2.101 · ¿Las excretas de los animales se recogen y disponen adecuadamente?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS excretas_animales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_excretas_animales') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_excretas_animales CHECK (cat.es_opcion('SI_NO', excretas_animales));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.excretas_animales IS 'Anexo SI-APS A2.101: ¿Las excretas de los animales se recogen y disponen adecuadamente?';

-- A2.102 · ¿La vivienda tiene barreras que eviten el contacto directo con los animales?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS barreras_contacto_animales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_barreras_contacto_animales') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_barreras_contacto_animales CHECK (cat.es_opcion('SI_NO', barreras_contacto_animales));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.barreras_contacto_animales IS 'Anexo SI-APS A2.102: ¿La vivienda tiene barreras que eviten el contacto directo con los animales?';

-- A2.54 · Horas al día con suministro de agua
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS horas_suministro_agua text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_horas_suministro_agua') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_horas_suministro_agua CHECK (cat.es_opcion('HORAS_SUMINISTRO', horas_suministro_agua));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.horas_suministro_agua IS 'Anexo SI-APS A2.54: Horas al día con suministro de agua';

-- A2.55 · Tanque de almacenamiento de agua
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS tanque_almacenamiento text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_tanque_almacenamiento') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_tanque_almacenamiento CHECK (cat.es_opcion('TANQUE_AGUA', tanque_almacenamiento));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.tanque_almacenamiento IS 'Anexo SI-APS A2.55: Tanque de almacenamiento de agua';

-- A2.56 · Frecuencia de limpieza del tanque
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS frecuencia_limpieza_tanque text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_frecuencia_limpieza_tanque') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_frecuencia_limpieza_tanque CHECK (cat.es_opcion('FRECUENCIA_LIMPIEZA_TANQUE', frecuencia_limpieza_tanque));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.frecuencia_limpieza_tanque IS 'Anexo SI-APS A2.56: Frecuencia de limpieza del tanque';

-- A2.57 · Distancia entre el tanque y el pozo séptico o el alcantarillado
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS distancia_tanque text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_distancia_tanque') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_distancia_tanque CHECK (cat.es_opcion('DISTANCIA_TANQUE', distancia_tanque));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.distancia_tanque IS 'Anexo SI-APS A2.57: Distancia entre el tanque y el pozo séptico o el alcantarillado';

-- A2.60 · Almacenamiento de los residuos sólidos en la vivienda
CREATE TABLE IF NOT EXISTS aps.vivienda_almacenamiento_residuos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_almacenamiento_residuos_valido CHECK (cat.es_opcion('ALMACENAMIENTO_RESIDUOS', codigo))
);
COMMENT ON TABLE aps.vivienda_almacenamiento_residuos IS 'Anexo SI-APS A2.60: Almacenamiento de los residuos sólidos en la vivienda';

-- A2.61 · ¿Qué otro sistema de almacenamiento?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS almacenamiento_residuos_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_almacenamiento_residuos_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_almacenamiento_residuos_otro CHECK (char_length(almacenamiento_residuos_otro) <= 200 AND position('|' in almacenamiento_residuos_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.almacenamiento_residuos_otro IS 'Anexo SI-APS A2.61: ¿Qué otro sistema de almacenamiento?';

-- A2.63 · ¿Conoce prácticas de reducción y separación de residuos en el hogar?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS conoce_practicas_residuos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_conoce_practicas_residuos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_conoce_practicas_residuos CHECK (cat.es_opcion('SI_NO', conoce_practicas_residuos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.conoce_practicas_residuos IS 'Anexo SI-APS A2.63: ¿Conoce prácticas de reducción y separación de residuos en el hogar?';

-- A2.64 · ¿Realiza prácticas de reducción y separación de residuos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS realiza_reduccion_residuos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_realiza_reduccion_residuos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_realiza_reduccion_residuos CHECK (cat.es_opcion('SI_NO', realiza_reduccion_residuos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.realiza_reduccion_residuos IS 'Anexo SI-APS A2.64: ¿Realiza prácticas de reducción y separación de residuos?';

-- A2.65 · ¿Cómo reduce la generación de residuos?
CREATE TABLE IF NOT EXISTS aps.vivienda_formas_reduccion_residuos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_formas_reduccion_residuos_valido CHECK (cat.es_opcion('REDUCCION_RESIDUOS', codigo))
);
COMMENT ON TABLE aps.vivienda_formas_reduccion_residuos IS 'Anexo SI-APS A2.65: ¿Cómo reduce la generación de residuos?';

-- A2.66 · ¿Qué otra práctica de reducción?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS formas_reduccion_residuos_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_formas_reduccion_residuos_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_formas_reduccion_residuos_otro CHECK (char_length(formas_reduccion_residuos_otro) <= 200 AND position('|' in formas_reduccion_residuos_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.formas_reduccion_residuos_otro IS 'Anexo SI-APS A2.66: ¿Qué otra práctica de reducción?';

-- A2.67 · ¿Realiza prácticas de aprovechamiento de residuos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS realiza_aprovechamiento_residuos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_realiza_aprovechamiento_residuos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_realiza_aprovechamiento_residuos CHECK (cat.es_opcion('SI_NO', realiza_aprovechamiento_residuos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.realiza_aprovechamiento_residuos IS 'Anexo SI-APS A2.67: ¿Realiza prácticas de aprovechamiento de residuos?';

-- A2.68 · ¿Qué prácticas de aprovechamiento de residuos realiza?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS practicas_aprovechamiento text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_practicas_aprovechamiento') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_practicas_aprovechamiento CHECK (char_length(practicas_aprovechamiento) <= 200 AND position('|' in practicas_aprovechamiento) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.practicas_aprovechamiento IS 'Anexo SI-APS A2.68: ¿Qué prácticas de aprovechamiento de residuos realiza?';

-- A2.69 · ¿Cómo dispone los residuos peligrosos (pilas, bombillos, medicamentos, envases de químicos)?
CREATE TABLE IF NOT EXISTS aps.vivienda_disposicion_residuos_peligrosos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_disposicion_residuos_peligrosos_valido CHECK (cat.es_opcion('DISPOSICION_PELIGROSOS', codigo))
);
COMMENT ON TABLE aps.vivienda_disposicion_residuos_peligrosos IS 'Anexo SI-APS A2.69: ¿Cómo dispone los residuos peligrosos (pilas, bombillos, medicamentos, envases de químicos)?';

-- A2.70 · ¿Qué otra forma de disposición de residuos peligrosos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS disposicion_residuos_peligrosos_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_disposicion_residuos_peligrosos_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_disposicion_residuos_peligrosos_otro CHECK (char_length(disposicion_residuos_peligrosos_otro) <= 200 AND position('|' in disposicion_residuos_peligrosos_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.disposicion_residuos_peligrosos_otro IS 'Anexo SI-APS A2.70: ¿Qué otra forma de disposición de residuos peligrosos?';

-- A2.71 · ¿Realiza procesos de reducción y separación de residuos rurales?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS reduccion_separacion_rural text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_reduccion_separacion_rural') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_reduccion_separacion_rural CHECK (cat.es_opcion('SI_NO', reduccion_separacion_rural));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.reduccion_separacion_rural IS 'Anexo SI-APS A2.71: ¿Realiza procesos de reducción y separación de residuos rurales?';

-- A2.72 · ¿Qué prácticas de aprovechamiento de residuos rurales realiza?
CREATE TABLE IF NOT EXISTS aps.vivienda_aprovechamiento_rural (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_aprovechamiento_rural_valido CHECK (cat.es_opcion('APROVECHAMIENTO_RURAL', codigo))
);
COMMENT ON TABLE aps.vivienda_aprovechamiento_rural IS 'Anexo SI-APS A2.72: ¿Qué prácticas de aprovechamiento de residuos rurales realiza?';

-- A2.73 · ¿Qué otra práctica de aprovechamiento rural?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS aprovechamiento_rural_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_aprovechamiento_rural_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_aprovechamiento_rural_otro CHECK (char_length(aprovechamiento_rural_otro) <= 200 AND position('|' in aprovechamiento_rural_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.aprovechamiento_rural_otro IS 'Anexo SI-APS A2.73: ¿Qué otra práctica de aprovechamiento rural?';

-- A2.74 · ¿Qué prácticas de separación de residuos aplica?
CREATE TABLE IF NOT EXISTS aps.vivienda_separacion_rural (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_separacion_rural_valido CHECK (cat.es_opcion('SEPARACION_RESIDUOS', codigo))
);
COMMENT ON TABLE aps.vivienda_separacion_rural IS 'Anexo SI-APS A2.74: ¿Qué prácticas de separación de residuos aplica?';

-- A2.75 · ¿Qué otra práctica de separación?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS separacion_rural_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_separacion_rural_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_separacion_rural_otro CHECK (char_length(separacion_rural_otro) <= 200 AND position('|' in separacion_rural_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.separacion_rural_otro IS 'Anexo SI-APS A2.75: ¿Qué otra práctica de separación?';

-- A2.76 · ¿Cómo se realiza la limpieza de superficies?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS limpieza_superficies text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_limpieza_superficies') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_limpieza_superficies CHECK (cat.es_opcion('LIMPIEZA_SUPERFICIES', limpieza_superficies));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.limpieza_superficies IS 'Anexo SI-APS A2.76: ¿Cómo se realiza la limpieza de superficies?';

-- A2.77 · ¿Qué otra práctica de limpieza?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS limpieza_superficies_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_limpieza_superficies_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_limpieza_superficies_otro CHECK (char_length(limpieza_superficies_otro) <= 200 AND position('|' in limpieza_superficies_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.limpieza_superficies_otro IS 'Anexo SI-APS A2.77: ¿Qué otra práctica de limpieza?';

-- A2.78 · Fuente de energía para cocinar
CREATE TABLE IF NOT EXISTS aps.vivienda_energia_cocinar (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_energia_cocinar_valido CHECK (cat.es_opcion('ENERGIA_COCINAR', codigo))
);
COMMENT ON TABLE aps.vivienda_energia_cocinar IS 'Anexo SI-APS A2.78: Fuente de energía para cocinar';

-- A2.79 · ¿Qué otra fuente de energía?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS energia_cocinar_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_energia_cocinar_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_energia_cocinar_otro CHECK (char_length(energia_cocinar_otro) <= 200 AND position('|' in energia_cocinar_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.energia_cocinar_otro IS 'Anexo SI-APS A2.79: ¿Qué otra fuente de energía?';

-- A2.80 · Fuentes frecuentes de humo en el hogar
CREATE TABLE IF NOT EXISTS aps.vivienda_fuentes_humo (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_fuentes_humo_valido CHECK (cat.es_opcion('FUENTES_HUMO', codigo))
);
COMMENT ON TABLE aps.vivienda_fuentes_humo IS 'Anexo SI-APS A2.80: Fuentes frecuentes de humo en el hogar';

-- A2.81 · ¿Qué otra fuente de humo?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS fuentes_humo_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_fuentes_humo_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_fuentes_humo_otro CHECK (char_length(fuentes_humo_otro) <= 200 AND position('|' in fuentes_humo_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.fuentes_humo_otro IS 'Anexo SI-APS A2.81: ¿Qué otra fuente de humo?';

-- A2.82 · Prácticas que afectan la calidad del aire
CREATE TABLE IF NOT EXISTS aps.vivienda_practicas_calidad_aire (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_practicas_calidad_aire_valido CHECK (cat.es_opcion('PRACTICAS_CALIDAD_AIRE', codigo))
);
COMMENT ON TABLE aps.vivienda_practicas_calidad_aire IS 'Anexo SI-APS A2.82: Prácticas que afectan la calidad del aire';

-- A2.83 · Tipo de estufa
CREATE TABLE IF NOT EXISTS aps.vivienda_tipo_estufa (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_tipo_estufa_valido CHECK (cat.es_opcion('TIPO_ESTUFA', codigo))
);
COMMENT ON TABLE aps.vivienda_tipo_estufa IS 'Anexo SI-APS A2.83: Tipo de estufa';

-- A2.85 · Vectores transmisores de enfermedades presentes en la vivienda
CREATE TABLE IF NOT EXISTS aps.vivienda_vectores_presentes (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_vectores_presentes_valido CHECK (cat.es_opcion('VECTORES', codigo))
);
COMMENT ON TABLE aps.vivienda_vectores_presentes IS 'Anexo SI-APS A2.85: Vectores transmisores de enfermedades presentes en la vivienda';

-- A2.86 · ¿Qué otro vector?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS vectores_presentes_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_vectores_presentes_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_vectores_presentes_otro CHECK (char_length(vectores_presentes_otro) <= 200 AND position('|' in vectores_presentes_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.vectores_presentes_otro IS 'Anexo SI-APS A2.86: ¿Qué otro vector?';

-- A2.87 · Medidas para el control de vectores transmisores de enfermedades
CREATE TABLE IF NOT EXISTS aps.vivienda_medidas_control_vectores (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_medidas_control_vectores_valido CHECK (cat.es_opcion('MEDIDAS_VECTORES', codigo))
);
COMMENT ON TABLE aps.vivienda_medidas_control_vectores IS 'Anexo SI-APS A2.87: Medidas para el control de vectores transmisores de enfermedades';

-- A2.88 · ¿Qué otra medida de control?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS medidas_control_vectores_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_medidas_control_vectores_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_medidas_control_vectores_otro CHECK (char_length(medidas_control_vectores_otro) <= 200 AND position('|' in medidas_control_vectores_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.medidas_control_vectores_otro IS 'Anexo SI-APS A2.88: ¿Qué otra medida de control?';

-- A2.89 · Animales ponzoñosos en el hogar
CREATE TABLE IF NOT EXISTS aps.vivienda_animales_ponzonosos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_animales_ponzonosos_valido CHECK (cat.es_opcion('ANIMALES_PONZONOSOS', codigo))
);
COMMENT ON TABLE aps.vivienda_animales_ponzonosos IS 'Anexo SI-APS A2.89: Animales ponzoñosos en el hogar';

-- A2.90 · ¿Qué otro animal ponzoñoso?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS animales_ponzonosos_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_animales_ponzonosos_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_animales_ponzonosos_otro CHECK (char_length(animales_ponzonosos_otro) <= 200 AND position('|' in animales_ponzonosos_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.animales_ponzonosos_otro IS 'Anexo SI-APS A2.90: ¿Qué otro animal ponzoñoso?';

-- A2.91 · Medidas para reducir el riesgo de animales ponzoñosos
CREATE TABLE IF NOT EXISTS aps.vivienda_medidas_ponzonosos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_medidas_ponzonosos_valido CHECK (cat.es_opcion('MEDIDAS_PONZONOSOS', codigo))
);
COMMENT ON TABLE aps.vivienda_medidas_ponzonosos IS 'Anexo SI-APS A2.91: Medidas para reducir el riesgo de animales ponzoñosos';

-- A2.104 · Lugar donde adquiere los productos químicos del hogar
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS lugar_quimicos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_lugar_quimicos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_lugar_quimicos CHECK (cat.es_opcion('LUGAR_QUIMICOS', lugar_quimicos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.lugar_quimicos IS 'Anexo SI-APS A2.104: Lugar donde adquiere los productos químicos del hogar';

-- A2.105 · Disposición final de los residuos químicos
CREATE TABLE IF NOT EXISTS aps.vivienda_disposicion_quimicos (
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text   NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vivienda_disposicion_quimicos_valido CHECK (cat.es_opcion('DISPOSICION_QUIMICOS', codigo))
);
COMMENT ON TABLE aps.vivienda_disposicion_quimicos IS 'Anexo SI-APS A2.105: Disposición final de los residuos químicos';

-- A2.106 · ¿Qué otra práctica de disposición de químicos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS disposicion_quimicos_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_disposicion_quimicos_otro') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_disposicion_quimicos_otro CHECK (char_length(disposicion_quimicos_otro) <= 200 AND position('|' in disposicion_quimicos_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.disposicion_quimicos_otro IS 'Anexo SI-APS A2.106: ¿Qué otra práctica de disposición de químicos?';

-- A2.107 · ¿Sigue las instrucciones del fabricante para manejar y almacenar los químicos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS instrucciones_quimicos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_instrucciones_quimicos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_instrucciones_quimicos CHECK (cat.es_opcion('SI_NO', instrucciones_quimicos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.instrucciones_quimicos IS 'Anexo SI-APS A2.107: ¿Sigue las instrucciones del fabricante para manejar y almacenar los químicos?';

-- A2.108 · ¿Los productos químicos se guardan en su envase original y en un lugar asignado?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS envase_original_quimicos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_envase_original_quimicos') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_envase_original_quimicos CHECK (cat.es_opcion('SI_NO', envase_original_quimicos));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.envase_original_quimicos IS 'Anexo SI-APS A2.108: ¿Los productos químicos se guardan en su envase original y en un lugar asignado?';

-- A2.109 · ¿Usa protección y ventila al limpiar con químicos?
ALTER TABLE aps.vivienda ADD COLUMN IF NOT EXISTS proteccion_limpieza text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_vivi_proteccion_limpieza') THEN
    ALTER TABLE aps.vivienda ADD CONSTRAINT ax_vivi_proteccion_limpieza CHECK (cat.es_opcion('SI_NO', proteccion_limpieza));
  END IF;
END $$;
COMMENT ON COLUMN aps.vivienda.proteccion_limpieza IS 'Anexo SI-APS A2.109: ¿Usa protección y ventila al limpiar con químicos?';

/* --- aps.familia_ficha ------------------------------------------------- */
-- A2.111 · Alias de la familia
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS alias_familia text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_alias_familia') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_alias_familia CHECK (char_length(alias_familia) <= 200 AND position('|' in alias_familia) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.alias_familia IS 'Anexo SI-APS A2.111: Alias de la familia';

-- A2.115 · Escala ZARIT: puntaje del cuidador principal
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS zarit_puntaje int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_zarit_puntaje') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_zarit_puntaje CHECK (zarit_puntaje >= 0 AND zarit_puntaje <= 100);
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.zarit_puntaje IS 'Anexo SI-APS A2.115: Escala ZARIT: puntaje del cuidador principal';

-- A2.113 · APGAR familiar (funcionalidad de la familia)
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS apgar_familiar text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_apgar_familiar') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_apgar_familiar CHECK (cat.es_opcion('APGAR', apgar_familiar));
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.apgar_familiar IS 'Anexo SI-APS A2.113: APGAR familiar (funcionalidad de la familia)';

-- A2.120 · Medida principal ante enfermedades respiratorias en el hogar
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS medidas_respiratorias text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_medidas_respiratorias') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_medidas_respiratorias CHECK (cat.es_opcion('MEDIDAS_RESPIRATORIAS', medidas_respiratorias));
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.medidas_respiratorias IS 'Anexo SI-APS A2.120: Medida principal ante enfermedades respiratorias en el hogar';

-- A2.121 · ¿Qué otra medida?
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS medidas_respiratorias_otro text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_medidas_respiratorias_otro') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_medidas_respiratorias_otro CHECK (char_length(medidas_respiratorias_otro) <= 200 AND position('|' in medidas_respiratorias_otro) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.medidas_respiratorias_otro IS 'Anexo SI-APS A2.121: ¿Qué otra medida?';

-- A2.122 · ¿Los integrantes comparten implementos de higiene personal?
ALTER TABLE aps.familia_ficha ADD COLUMN IF NOT EXISTS higiene_compartida text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_fami_higiene_compartida') THEN
    ALTER TABLE aps.familia_ficha ADD CONSTRAINT ax_fami_higiene_compartida CHECK (cat.es_opcion('SI_NO', higiene_compartida));
  END IF;
END $$;
COMMENT ON COLUMN aps.familia_ficha.higiene_compartida IS 'Anexo SI-APS A2.122: ¿Los integrantes comparten implementos de higiene personal?';

/* --- aps.integrante ---------------------------------------------------- */
-- A3.10 · Estatus migratorio
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS estatus_migratorio text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_estatus_migratorio') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_estatus_migratorio CHECK (cat.es_opcion('ESTATUS_MIGRATORIO', estatus_migratorio));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.estatus_migratorio IS 'Anexo SI-APS A3.10: Estatus migratorio';

-- A3.43 · ¿Se lava las manos con agua y jabón?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS lavado_manos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_lavado_manos') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_lavado_manos CHECK (cat.es_opcion('SI_NO', lavado_manos));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.lavado_manos IS 'Anexo SI-APS A3.43: ¿Se lava las manos con agua y jabón?';

-- A3.47 · ¿Acudió a urgencias por algún accidente en el hogar?
CREATE TABLE IF NOT EXISTS aps.integrante_urgencias_accidente (
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text   NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT integrante_urgencias_accidente_valido CHECK (cat.es_opcion('URGENCIAS_HOGAR', codigo))
);
COMMENT ON TABLE aps.integrante_urgencias_accidente IS 'Anexo SI-APS A3.47: ¿Acudió a urgencias por algún accidente en el hogar?';

-- A3.48 · Enfermedades sufridas en el último mes
CREATE TABLE IF NOT EXISTS aps.integrante_enfermedades_ultimo_mes (
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text   NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT integrante_enfermedades_ultimo_mes_valido CHECK (cat.es_opcion('ENFERMEDADES_ULTIMO_MES', codigo))
);
COMMENT ON TABLE aps.integrante_enfermedades_ultimo_mes IS 'Anexo SI-APS A3.48: Enfermedades sufridas en el último mes';

-- A3.49 · ¿Qué otra enfermedad?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS enfermedades_ultimo_mes_otra text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_enfermedades_ultimo_mes_otra') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_enfermedades_ultimo_mes_otra CHECK (char_length(enfermedades_ultimo_mes_otra) <= 200 AND position('|' in enfermedades_ultimo_mes_otra) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.enfermedades_ultimo_mes_otra IS 'Anexo SI-APS A3.49: ¿Qué otra enfermedad?';

-- A3.50 · ¿Qué hizo ante la afección del último mes?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS accion_afeccion text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_accion_afeccion') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_accion_afeccion CHECK (cat.es_opcion('ACCION_AFECCION', accion_afeccion));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.accion_afeccion IS 'Anexo SI-APS A3.50: ¿Qué hizo ante la afección del último mes?';

-- A3.51 · ¿Qué otra acción tomó?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS accion_afeccion_otra text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_accion_afeccion_otra') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_accion_afeccion_otra CHECK (char_length(accion_afeccion_otra) <= 200 AND position('|' in accion_afeccion_otra) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.accion_afeccion_otra IS 'Anexo SI-APS A3.51: ¿Qué otra acción tomó?';

-- A3.56 · ¿Tiene diagnóstico de alguna enfermedad?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS tiene_diagnostico text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_tiene_diagnostico') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_tiene_diagnostico CHECK (cat.es_opcion('SI_NO', tiene_diagnostico));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.tiene_diagnostico IS 'Anexo SI-APS A3.56: ¿Tiene diagnóstico de alguna enfermedad?';

-- A3.57 · ¿Tiene signos y síntomas compatibles con alguna enfermedad, sin diagnóstico?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS sintomas_sin_diagnostico text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_sintomas_sin_diagnostico') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_sintomas_sin_diagnostico CHECK (cat.es_opcion('SI_NO', sintomas_sin_diagnostico));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.sintomas_sin_diagnostico IS 'Anexo SI-APS A3.57: ¿Tiene signos y síntomas compatibles con alguna enfermedad, sin diagnóstico?';

-- A3.64 · ¿Consume tabaco?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS consumo_tabaco text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_consumo_tabaco') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_consumo_tabaco CHECK (cat.es_opcion('CONSUMO_TABACO', consumo_tabaco));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.consumo_tabaco IS 'Anexo SI-APS A3.64: ¿Consume tabaco?';

-- A3.65 · Consumo máximo de cigarrillos diarios (en los últimos 15 años)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS cigarrillos_diarios int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_cigarrillos_diarios') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_cigarrillos_diarios CHECK (cigarrillos_diarios >= 0 AND cigarrillos_diarios <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.cigarrillos_diarios IS 'Anexo SI-APS A3.65: Consumo máximo de cigarrillos diarios (en los últimos 15 años)';

-- A3.66 · Años que ha fumado
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS anios_fumando int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_anios_fumando') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_anios_fumando CHECK (anios_fumando >= 0 AND anios_fumando <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.anios_fumando IS 'Anexo SI-APS A3.66: Años que ha fumado';

-- A3.70 · Fecha de la última menstruación (FUM)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS fecha_ultima_menstruacion date;
COMMENT ON COLUMN aps.integrante.fecha_ultima_menstruacion IS 'Anexo SI-APS A3.70: Fecha de la última menstruación (FUM)';

-- A3.74 · ¿Conoce sobre la Interrupción Voluntaria del Embarazo (IVE)?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS conoce_ive text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_conoce_ive') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_conoce_ive CHECK (cat.es_opcion('SI_NO', conoce_ive));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.conoce_ive IS 'Anexo SI-APS A3.74: ¿Conoce sobre la Interrupción Voluntaria del Embarazo (IVE)?';

-- A3.81 · ¿Ha recibido atención para el cuidado preconcepcional?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS atencion_preconcepcional text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_atencion_preconcepcional') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_atencion_preconcepcional CHECK (cat.es_opcion('SI_NO_NA', atencion_preconcepcional));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.atencion_preconcepcional IS 'Anexo SI-APS A3.81: ¿Ha recibido atención para el cuidado preconcepcional?';

-- A3.73 · ¿Conoce los signos de alarma en el embarazo?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS conoce_signos_alarma text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_conoce_signos_alarma') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_conoce_signos_alarma CHECK (cat.es_opcion('SI_NO', conoce_signos_alarma));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.conoce_signos_alarma IS 'Anexo SI-APS A3.73: ¿Conoce los signos de alarma en el embarazo?';

-- A3.75 · ¿Inició atenciones prenatales?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS inicio_prenatales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_inicio_prenatales') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_inicio_prenatales CHECK (cat.es_opcion('SI_NO', inicio_prenatales));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.inicio_prenatales IS 'Anexo SI-APS A3.75: ¿Inició atenciones prenatales?';

-- A3.76 · ¿Inició oportunamente la atención prenatal?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS inicio_oportuno_prenatal text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_inicio_oportuno_prenatal') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_inicio_oportuno_prenatal CHECK (cat.es_opcion('SI_NO', inicio_oportuno_prenatal));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.inicio_oportuno_prenatal IS 'Anexo SI-APS A3.76: ¿Inició oportunamente la atención prenatal?';

-- A3.80 · Número de atenciones prenatales hasta el momento
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS numero_atenciones_prenatales int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_numero_atenciones_prenatales') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_numero_atenciones_prenatales CHECK (numero_atenciones_prenatales >= 0 AND numero_atenciones_prenatales <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.numero_atenciones_prenatales IS 'Anexo SI-APS A3.80: Número de atenciones prenatales hasta el momento';

-- A3.82 · ¿Recibe atención para el cuidado prenatal (controles prenatales)?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS controles_prenatales text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_controles_prenatales') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_controles_prenatales CHECK (cat.es_opcion('SI_NO_NA', controles_prenatales));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.controles_prenatales IS 'Anexo SI-APS A3.82: ¿Recibe atención para el cuidado prenatal (controles prenatales)?';

-- A3.78 · Clasificación del riesgo gestacional
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS riesgo_gestacional text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_riesgo_gestacional') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_riesgo_gestacional CHECK (cat.es_opcion('RIESGO_GESTACIONAL', riesgo_gestacional));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.riesgo_gestacional IS 'Anexo SI-APS A3.78: Clasificación del riesgo gestacional';

-- A3.79 · Clasificación del riesgo de preeclampsia
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS riesgo_preeclampsia text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_riesgo_preeclampsia') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_riesgo_preeclampsia CHECK (cat.es_opcion('RIESGO_PREECLAMPSIA', riesgo_preeclampsia));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.riesgo_preeclampsia IS 'Anexo SI-APS A3.79: Clasificación del riesgo de preeclampsia';

-- A3.83 · Sesiones de preparación para la maternidad y paternidad
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS sesiones_preparacion int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_sesiones_preparacion') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_sesiones_preparacion CHECK (sesiones_preparacion >= 0 AND sesiones_preparacion <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.sesiones_preparacion IS 'Anexo SI-APS A3.83: Sesiones de preparación para la maternidad y paternidad';

-- A3.77 · ¿Tiene acceso a métodos anticonceptivos postparto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS acceso_anticonceptivos_postparto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_acceso_anticonceptivos_postparto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_acceso_anticonceptivos_postparto CHECK (cat.es_opcion('SI_NO', acceso_anticonceptivos_postparto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.acceso_anticonceptivos_postparto IS 'Anexo SI-APS A3.77: ¿Tiene acceso a métodos anticonceptivos postparto?';

-- A3.84 · Fecha de atención del evento obstétrico (probable o del parto)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS fecha_evento_obstetrico date;
COMMENT ON COLUMN aps.integrante.fecha_evento_obstetrico IS 'Anexo SI-APS A3.84: Fecha de atención del evento obstétrico (probable o del parto)';

-- A3.85 · ¿Recibió atención del puerperio en las primeras 48 horas?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS puerperio48h text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_puerperio48h') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_puerperio48h CHECK (cat.es_opcion('SI_NO', puerperio48h));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.puerperio48h IS 'Anexo SI-APS A3.85: ¿Recibió atención del puerperio en las primeras 48 horas?';

-- A3.86 · ¿Tuvo consulta de seguimiento al puerperio entre el tercer y quinto día?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS seguimiento_puerperio text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_seguimiento_puerperio') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_seguimiento_puerperio CHECK (cat.es_opcion('SI_NO', seguimiento_puerperio));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.seguimiento_puerperio IS 'Anexo SI-APS A3.86: ¿Tuvo consulta de seguimiento al puerperio entre el tercer y quinto día?';

-- A3.87 · ¿Recibió apoyo a la lactancia materna?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS apoyo_lactancia text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_apoyo_lactancia') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_apoyo_lactancia CHECK (cat.es_opcion('SI_NO', apoyo_lactancia));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.apoyo_lactancia IS 'Anexo SI-APS A3.87: ¿Recibió apoyo a la lactancia materna?';

-- A3.88 · ¿El recién nacido fue atendido durante sus primeras 24 horas de vida?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS atencion_recien_nacido24h text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_atencion_recien_nacido24h') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_atencion_recien_nacido24h CHECK (cat.es_opcion('SI_NO', atencion_recien_nacido24h));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.atencion_recien_nacido24h IS 'Anexo SI-APS A3.88: ¿El recién nacido fue atendido durante sus primeras 24 horas de vida?';

-- A3.89 · ¿El recién nacido tuvo control entre el tercer y quinto día?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS control_recien_nacido text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_control_recien_nacido') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_control_recien_nacido CHECK (cat.es_opcion('SI_NO', control_recien_nacido));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.control_recien_nacido IS 'Anexo SI-APS A3.89: ¿El recién nacido tuvo control entre el tercer y quinto día?';

-- A3.90 · ¿El recién nacido fue vacunado?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS vacunacion_recien_nacido text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_vacunacion_recien_nacido') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_vacunacion_recien_nacido CHECK (cat.es_opcion('SI_NO', vacunacion_recien_nacido));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.vacunacion_recien_nacido IS 'Anexo SI-APS A3.90: ¿El recién nacido fue vacunado?';

-- A3.91 · Método anticonceptivo postparto inmediato
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS metodo_anticonceptivo_postparto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_metodo_anticonceptivo_postparto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_metodo_anticonceptivo_postparto CHECK (cat.es_opcion('METODO_ANTICONCEPTIVO_POSTPARTO', metodo_anticonceptivo_postparto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.metodo_anticonceptivo_postparto IS 'Anexo SI-APS A3.91: Método anticonceptivo postparto inmediato';

-- A3.92 · ¿Cuenta con historial laboral?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS historial_laboral text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_historial_laboral') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_historial_laboral CHECK (cat.es_opcion('SI_NO', historial_laboral));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.historial_laboral IS 'Anexo SI-APS A3.92: ¿Cuenta con historial laboral?';

-- A3.93 · Lugar de trabajo o actividad específica más reciente
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS trabajo_reciente_lugar text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_trabajo_reciente_lugar') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_trabajo_reciente_lugar CHECK (char_length(trabajo_reciente_lugar) <= 200 AND position('|' in trabajo_reciente_lugar) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.trabajo_reciente_lugar IS 'Anexo SI-APS A3.93: Lugar de trabajo o actividad específica más reciente';

-- A3.94 · Nombre del empleador
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS trabajo_reciente_empleador text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_trabajo_reciente_empleador') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_trabajo_reciente_empleador CHECK (char_length(trabajo_reciente_empleador) <= 200 AND position('|' in trabajo_reciente_empleador) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.trabajo_reciente_empleador IS 'Anexo SI-APS A3.94: Nombre del empleador';

-- A3.95 · Periodo laboral (meses)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS trabajo_reciente_meses int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_trabajo_reciente_meses') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_trabajo_reciente_meses CHECK (trabajo_reciente_meses >= 0 AND trabajo_reciente_meses <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.trabajo_reciente_meses IS 'Anexo SI-APS A3.95: Periodo laboral (meses)';

-- A3.96 · ¿Cuenta con más empleos previos al actual?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleos_previos text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleos_previos') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleos_previos CHECK (cat.es_opcion('SI_NO', empleos_previos));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleos_previos IS 'Anexo SI-APS A3.96: ¿Cuenta con más empleos previos al actual?';

-- A3.97 · Empleo previo 1: lugar de trabajo o actividad específica
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo1_lugar text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo1_lugar') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo1_lugar CHECK (char_length(empleo_previo1_lugar) <= 200 AND position('|' in empleo_previo1_lugar) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo1_lugar IS 'Anexo SI-APS A3.97: Empleo previo 1: lugar de trabajo o actividad específica';

-- A3.98 · Empleo previo 1: nombre del empleador
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo1_empleador text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo1_empleador') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo1_empleador CHECK (char_length(empleo_previo1_empleador) <= 200 AND position('|' in empleo_previo1_empleador) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo1_empleador IS 'Anexo SI-APS A3.98: Empleo previo 1: nombre del empleador';

-- A3.99 · Empleo previo 1: periodo laboral (meses)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo1_meses int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo1_meses') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo1_meses CHECK (empleo_previo1_meses >= 0 AND empleo_previo1_meses <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo1_meses IS 'Anexo SI-APS A3.99: Empleo previo 1: periodo laboral (meses)';

-- A3.100 · Empleo previo 2: lugar de trabajo o actividad específica
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo2_lugar text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo2_lugar') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo2_lugar CHECK (char_length(empleo_previo2_lugar) <= 200 AND position('|' in empleo_previo2_lugar) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo2_lugar IS 'Anexo SI-APS A3.100: Empleo previo 2: lugar de trabajo o actividad específica';

-- A3.101 · Empleo previo 2: nombre del empleador
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo2_empleador text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo2_empleador') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo2_empleador CHECK (char_length(empleo_previo2_empleador) <= 200 AND position('|' in empleo_previo2_empleador) = 0);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo2_empleador IS 'Anexo SI-APS A3.101: Empleo previo 2: nombre del empleador';

-- A3.102 · Empleo previo 2: periodo laboral (meses)
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS empleo_previo2_meses int;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_empleo_previo2_meses') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_empleo_previo2_meses CHECK (empleo_previo2_meses >= 0 AND empleo_previo2_meses <= 99);
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.empleo_previo2_meses IS 'Anexo SI-APS A3.102: Empleo previo 2: periodo laboral (meses)';

-- A3.103 · En alguno de sus trabajos, ¿ha realizado alguna actividad que involucre asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS actividad_involucra_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_actividad_involucra_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_actividad_involucra_asbesto CHECK (cat.es_opcion('SI_NO_NA', actividad_involucra_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.actividad_involucra_asbesto IS 'Anexo SI-APS A3.103: En alguno de sus trabajos, ¿ha realizado alguna actividad que involucre asbesto?';

-- A3.104 · En alguno de sus trabajos, ¿ha realizado alguna actividad relacionada con asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS actividad_relacionada_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_actividad_relacionada_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_actividad_relacionada_asbesto CHECK (cat.es_opcion('SI_NO_NA', actividad_relacionada_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.actividad_relacionada_asbesto IS 'Anexo SI-APS A3.104: En alguno de sus trabajos, ¿ha realizado alguna actividad relacionada con asbesto?';

-- A3.105 · ¿Cuáles actividades relacionadas con asbesto ha realizado?
CREATE TABLE IF NOT EXISTS aps.integrante_actividades_asbesto (
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text   NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT integrante_actividades_asbesto_valido CHECK (cat.es_opcion('ACTIVIDADES_ASBESTO', codigo))
);
COMMENT ON TABLE aps.integrante_actividades_asbesto IS 'Anexo SI-APS A3.105: ¿Cuáles actividades relacionadas con asbesto ha realizado?';

-- A3.106 · ¿Ha interactuado con materiales que tengan asbesto en sus trabajos?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS interactuo_materiales_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_interactuo_materiales_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_interactuo_materiales_asbesto CHECK (cat.es_opcion('SI_NO_NA', interactuo_materiales_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.interactuo_materiales_asbesto IS 'Anexo SI-APS A3.106: ¿Ha interactuado con materiales que tengan asbesto en sus trabajos?';

-- A3.107 · ¿Con cuáles materiales con asbesto interactuó?
CREATE TABLE IF NOT EXISTS aps.integrante_materiales_asbesto_trabajo (
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text   NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT integrante_materiales_asbesto_trabajo_valido CHECK (cat.es_opcion('MATERIALES_ASBESTO_TRABAJO', codigo))
);
COMMENT ON TABLE aps.integrante_materiales_asbesto_trabajo IS 'Anexo SI-APS A3.107: ¿Con cuáles materiales con asbesto interactuó?';

-- A3.108 · ¿En qué modalidad de empleo se presentó mayormente la exposición?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS modalidad_empleo_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_modalidad_empleo_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_modalidad_empleo_asbesto CHECK (cat.es_opcion('MODALIDAD_EMPLEO', modalidad_empleo_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.modalidad_empleo_asbesto IS 'Anexo SI-APS A3.108: ¿En qué modalidad de empleo se presentó mayormente la exposición?';

-- A3.109 · En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS materiales_asbesto_hogar text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_materiales_asbesto_hogar') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_materiales_asbesto_hogar CHECK (cat.es_opcion('SI_NO_NA', materiales_asbesto_hogar));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.materiales_asbesto_hogar IS 'Anexo SI-APS A3.109: En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto?';

-- A3.110 · ¿Cuáles elementos del hogar tienen presencia de asbesto?
CREATE TABLE IF NOT EXISTS aps.integrante_elementos_asbesto_hogar (
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text   NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT integrante_elementos_asbesto_hogar_valido CHECK (cat.es_opcion('ELEMENTOS_ASBESTO_HOGAR', codigo))
);
COMMENT ON TABLE aps.integrante_elementos_asbesto_hogar IS 'Anexo SI-APS A3.110: ¿Cuáles elementos del hogar tienen presencia de asbesto?';

-- A3.111 · ¿En qué estado se encuentran los materiales con asbesto de la vivienda?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS estado_materiales_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_estado_materiales_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_estado_materiales_asbesto CHECK (cat.es_opcion('ESTADO_MATERIALES', estado_materiales_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.estado_materiales_asbesto IS 'Anexo SI-APS A3.111: ¿En qué estado se encuentran los materiales con asbesto de la vivienda?';

-- A3.112 · En su hogar, ¿convive con alguien que haya trabajado con asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS convive_trabajador_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_convive_trabajador_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_convive_trabajador_asbesto CHECK (cat.es_opcion('SI_NO_NA', convive_trabajador_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.convive_trabajador_asbesto IS 'Anexo SI-APS A3.112: En su hogar, ¿convive con alguien que haya trabajado con asbesto?';

-- A3.113 · ¿Ha hecho reparaciones en su vivienda con materiales que contengan asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS reparaciones_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_reparaciones_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_reparaciones_asbesto CHECK (cat.es_opcion('SI_NO_NA', reparaciones_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.reparaciones_asbesto IS 'Anexo SI-APS A3.113: ¿Ha hecho reparaciones en su vivienda con materiales que contengan asbesto?';

-- A3.114 · ¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS actividad_asbesto_cerca text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_actividad_asbesto_cerca') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_actividad_asbesto_cerca CHECK (cat.es_opcion('SI_NO_NA', actividad_asbesto_cerca));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.actividad_asbesto_cerca IS 'Anexo SI-APS A3.114: ¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar?';

-- A3.115 · ¿Cuál actividad con asbesto se realizó cerca de su hogar?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS actividades_asbesto_cerca text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_actividades_asbesto_cerca') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_actividades_asbesto_cerca CHECK (cat.es_opcion('ACTIVIDADES_ASBESTO_CERCA', actividades_asbesto_cerca));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.actividades_asbesto_cerca IS 'Anexo SI-APS A3.115: ¿Cuál actividad con asbesto se realizó cerca de su hogar?';

-- A3.116 · ¿Ha tenido familiares con enfermedades relacionadas con asbesto?
ALTER TABLE aps.integrante ADD COLUMN IF NOT EXISTS familiares_enfermedad_asbesto text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ax_inte_familiares_enfermedad_asbesto') THEN
    ALTER TABLE aps.integrante ADD CONSTRAINT ax_inte_familiares_enfermedad_asbesto CHECK (cat.es_opcion('SI_NO_NA', familiares_enfermedad_asbesto));
  END IF;
END $$;
COMMENT ON COLUMN aps.integrante.familiares_enfermedad_asbesto IS 'Anexo SI-APS A3.116: ¿Ha tenido familiares con enfermedades relacionadas con asbesto?';

COMMIT;
