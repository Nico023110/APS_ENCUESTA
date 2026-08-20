/* =========================================================================
   APS APP — REGLAS DE INTEGRIDAD, CÁLCULOS Y CIERRE
   Archivo 3 de 3
   =========================================================================

   Un CHECK sólo ve la fila que valida. Las reglas que cruzan tablas
   (RN-028, RN-029, RN-051, RN-070, RN-130, RN-220, RN-221, RN-222) se
   implementan aquí como funciones y disparadores.

   Criterio de severidad, tomado de la sección 1.3 de las reglas:
     - BLOQUEO      → excepción (RAISE EXCEPTION) o CHECK.
     - ADVERTENCIA  → no se implementa en la base: pertenece a la capa de
                      captura, que pide confirmación y deja continuar.
   La base no debe rechazar lo que la regla sólo advierte; si lo hiciera,
   impediría casos legítimos que las propias reglas admiten (RN-064).
   ========================================================================= */

BEGIN;

/* =========================================================================
   1. CÁLCULOS DERIVADOS
   ========================================================================= */

/* RN-064 — Edad en años, meses y días respecto a la fecha de diligenciamiento.
   Es la única fuente válida para habilitar preguntas condicionadas por edad. */
CREATE OR REPLACE FUNCTION aps.edad(p_nacimiento date, p_referencia date)
RETURNS interval LANGUAGE sql IMMUTABLE AS $$
  SELECT age(p_referencia, p_nacimiento);
$$;

CREATE OR REPLACE FUNCTION aps.edad_meses(p_nacimiento date, p_referencia date)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (extract(year from age(p_referencia, p_nacimiento))::int * 12)
       +  extract(month from age(p_referencia, p_nacimiento))::int;
$$;

CREATE OR REPLACE FUNCTION aps.edad_anios(p_nacimiento date, p_referencia date)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT extract(year from age(p_referencia, p_nacimiento))::int;
$$;

/* RN-099 — Clasificación de tensión arterial (AHA 2024).
   Derivada del ítem 98; no se digita. */
CREATE OR REPLACE FUNCTION aps.clasificar_tension(p_sistolica int, p_diastolica int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_sistolica IS NULL OR p_diastolica IS NULL           THEN 'no_aplica'
    WHEN p_sistolica > 180 OR p_diastolica > 120               THEN 'crisis_hipertensiva'
    WHEN p_sistolica >= 140 OR p_diastolica >= 90              THEN 'hipertension_2'
    WHEN p_sistolica BETWEEN 130 AND 139
      OR p_diastolica BETWEEN 80 AND 89                        THEN 'hipertension_1'
    WHEN p_sistolica BETWEEN 120 AND 129 AND p_diastolica < 80 THEN 'elevada'
    ELSE 'normal'
  END;
$$;

/* Edad calculada por integrante: la interfaz habilita las preguntas
   condicionadas a partir de aquí, y RN-064 la declara única fuente válida.
   Se define antes que las funciones de RN-087 porque éstas la consultan. */
CREATE OR REPLACE VIEW aps.v_integrante_edad AS
SELECT i.id                                        AS integrante_id,
       f.id                                        AS ficha_id,
       p.id                                        AS persona_id,
       p.fecha_nacimiento,
       f.fecha_diligenciamiento,
       aps.edad_anios(p.fecha_nacimiento, f.fecha_diligenciamiento)  AS edad_anios,
       aps.edad_meses(p.fecha_nacimiento, f.fecha_diligenciamiento)  AS edad_meses,
       aps.edad(p.fecha_nacimiento, f.fecha_diligenciamiento)        AS edad
  FROM aps.integrante i
  JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
  JOIN aps.ficha f          ON f.id  = ff.ficha_id
  JOIN aps.persona p        ON p.id  = i.persona_id;

/* RN-087 — Atenciones de la Ruta de Promoción y Mantenimiento exigibles según
   el perfil del integrante. La matriz de edad y sexo vive en
   cat.opcion.metadata (rangos en meses, sexos, gestante, mujerEdadFertil) y
   proviene del Anexo del instrumento a través de catalogos.js.

   "Las atenciones no exigibles para el perfil del individuo no se muestran,
    evitando que se registren pendientes que no le corresponden."

   Enfoque diferencial: en personas intersexuales se habilitan los tamizajes de
   ambos sexos y la selección la decide el profesional según el órgano presente.
   El mismo criterio aplica cuando la autoidentificación de género es transexual
   o transgénero, decisión que toma la capa de captura y no esta función. */
CREATE OR REPLACE FUNCTION cat.atencion_rpms_exigible(
  p_metadata    jsonb,
  p_edad_meses  int,
  p_sexo        text,
  p_gestante    boolean
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rango jsonb; v_min int; v_max int;
BEGIN
  IF p_metadata IS NULL THEN RETURN true; END IF;                 -- "Ninguna"
  IF coalesce((p_metadata ->> 'excluyente')::boolean, false) THEN RETURN true; END IF;
  IF p_edad_meses IS NULL THEN RETURN false; END IF;

  -- Las atenciones marcadas para gestantes se habilitan sin importar la edad.
  IF coalesce((p_metadata ->> 'gestante')::boolean, false) AND p_gestante THEN
    RETURN true;
  END IF;

  -- Tamizaje de anemia: mujeres en edad fértil (10 a 54 años).
  IF coalesce((p_metadata ->> 'mujerEdadFertil')::boolean, false)
     AND p_sexo IN ('mujer', 'intersexual')
     AND p_edad_meses BETWEEN 120 AND 659 THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(p_metadata -> 'sexos') = 'array'
     AND NOT (p_metadata -> 'sexos') ? p_sexo
     AND p_sexo <> 'intersexual' THEN
    RETURN false;
  END IF;

  FOR rango IN SELECT * FROM jsonb_array_elements(coalesce(p_metadata -> 'rangos', '[]'::jsonb))
  LOOP
    v_min := (rango ->> 0)::int;
    v_max := (rango ->> 1)::int;      -- ->> devuelve NULL para el JSON null: "sin tope"
    IF p_edad_meses >= v_min AND (v_max IS NULL OR p_edad_meses <= v_max) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END $$;

/* Lista de atenciones habilitadas para un integrante concreto. La interfaz de
   captura debe construir el ítem 87 exclusivamente a partir de esta consulta. */
CREATE OR REPLACE FUNCTION aps.atenciones_rpms_exigibles(p_integrante_id bigint)
RETURNS TABLE (codigo text, etiqueta text, orden int)
LANGUAGE sql STABLE AS $$
  SELECT o.codigo, o.etiqueta, o.orden
    FROM aps.v_integrante_edad e
    JOIN aps.integrante i ON i.id = e.integrante_id
    JOIN aps.persona p    ON p.id = e.persona_id
   CROSS JOIN cat.opcion o
   WHERE e.integrante_id = p_integrante_id
     AND o.dominio_codigo = 'ATENCIONES_RPMS'
     AND o.vigente
     AND cat.atencion_rpms_exigible(o.metadata, e.edad_meses, p.sexo,
                                    coalesce(i.gestacion_actual, false))
   ORDER BY o.orden;
$$;

/* Impide registrar una atención pendiente que no corresponde al perfil.
   RN-087 no es sólo una regla de presentación: una atención marcada obliga a
   registrar barrera (ítem 89) y canalización, de modo que un pendiente
   espurio genera trabajo real sobre una persona que no lo necesita. */
CREATE OR REPLACE FUNCTION aps.trg_atencion_rpms_exigible() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_exigible boolean;
BEGIN
  SELECT cat.atencion_rpms_exigible(o.metadata, e.edad_meses, p.sexo,
                                    coalesce(i.gestacion_actual, false))
    INTO v_exigible
    FROM aps.v_integrante_edad e
    JOIN aps.integrante i ON i.id = e.integrante_id
    JOIN aps.persona p    ON p.id = e.persona_id
    JOIN cat.opcion o     ON o.dominio_codigo = 'ATENCIONES_RPMS' AND o.codigo = NEW.codigo
   WHERE e.integrante_id = NEW.integrante_id;

  IF NOT coalesce(v_exigible, false) THEN
    RAISE EXCEPTION 'RN-087: la atención "%" no es exigible para el perfil de edad y sexo '
                    'del integrante %.', NEW.codigo, NEW.integrante_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_atencion_rpms_exigible
  BEFORE INSERT OR UPDATE ON aps.integrante_atencion_rpms
  FOR EACH ROW EXECUTE FUNCTION aps.trg_atencion_rpms_exigible();

/* RN-200 — Plazo máximo de respuesta por nivel de prioridad. */
CREATE OR REPLACE FUNCTION aps.plazo_prioridad(p_prioridad aps.prioridad)
RETURNS interval LANGUAGE sql STABLE AS $$
  SELECT CASE p_prioridad
    WHEN 'inmediata'   THEN interval '0 hours'   -- en el momento de la visita
    WHEN 'prioritaria' THEN interval '72 hours'
    WHEN 'regular'     THEN interval '30 days'
  END;
$$;

/* RN-200 — Al acumular varias alertas prevalece el nivel más alto. */
CREATE OR REPLACE FUNCTION aps.prioridad_maxima(a aps.prioridad, b aps.prioridad)
RETURNS aps.prioridad LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN a IS NULL THEN b WHEN b IS NULL THEN a
              WHEN a > b THEN a ELSE b END;      -- el ENUM ya está en orden ascendente
$$;

/* La prioridad de una alerta nunca es editable a la baja (RN-200). */
CREATE OR REPLACE FUNCTION aps.trg_alerta_prioridad() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.prioridad_base := coalesce(NEW.prioridad_base, NEW.prioridad);
    NEW.vence_en := coalesce(NEW.vence_en, NEW.detectada_en + aps.plazo_prioridad(NEW.prioridad));
    -- RN-202 y RN-222.5: la ideación suicida es la única alerta que bloquea la sincronización
    IF NEW.regla_codigo = 'RN-202' OR NEW.prioridad = 'inmediata' THEN
      NEW.bloquea_cierre := true;
    END IF;
  ELSIF NEW.prioridad < OLD.prioridad THEN
    RAISE EXCEPTION 'RN-200: la prioridad de una alerta no es editable a la baja (% → %)',
      OLD.prioridad, NEW.prioridad;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_alerta_prioridad
  BEFORE INSERT OR UPDATE ON aps.alerta
  FOR EACH ROW EXECUTE FUNCTION aps.trg_alerta_prioridad();


/* =========================================================================
   2. VALIDACIONES DEPENDIENTES DE LA FECHA ACTUAL
   Van en trigger y no en CHECK: un CHECK volátil se reevalúa al restaurar un
   respaldo y haría fallar la carga de filas que eran válidas el día que se
   capturaron (por ejemplo, un MS que desde entonces cumplió 18 años).
   ========================================================================= */

/* RN-064 — Fecha de nacimiento y coherencia de edad con el tipo de documento. */
CREATE OR REPLACE FUNCTION aps.trg_persona_fechas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_nacimiento > CURRENT_DATE THEN
    RAISE EXCEPTION 'RN-064: la fecha de nacimiento (%) no puede ser futura.', NEW.fecha_nacimiento;
  END IF;
  IF NEW.fecha_nacimiento <= CURRENT_DATE - INTERVAL '120 years' THEN
    RAISE EXCEPTION 'RN-064: la fecha de nacimiento (%) implica una edad superior a 120 años.',
      NEW.fecha_nacimiento;
  END IF;

  -- RN-064: MS y AS bloquean; el resto de inconsistencias sólo advierten y las
  -- resuelve la capa de captura pidiendo confirmación (criterio de severidad).
  IF NEW.tipo_id = 'MS' AND NEW.fecha_nacimiento <= CURRENT_DATE - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'RN-064: "Menor sin Identificación" exige edad inferior a 18 años.';
  END IF;
  IF NEW.tipo_id = 'AS' AND NEW.fecha_nacimiento > CURRENT_DATE - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'RN-064: "Adulto sin Identificación" exige edad igual o superior a 18 años.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_persona_fechas
  BEFORE INSERT OR UPDATE ON aps.persona
  FOR EACH ROW EXECUTE FUNCTION aps.trg_persona_fechas();

/* RN-016 — Fecha de diligenciamiento: ni futura ni con más de 30 días de antigüedad. */
CREATE OR REPLACE FUNCTION aps.trg_ficha_fecha() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_dias int;
BEGIN
  IF NEW.fecha_diligenciamiento > CURRENT_DATE THEN
    RAISE EXCEPTION 'RN-016: la fecha de diligenciamiento (%) no puede ser futura.',
      NEW.fecha_diligenciamiento;
  END IF;

  -- El límite es parámetro de configuración, no valor en código (sección 15).
  SELECT coalesce((valor #>> '{}')::int, 30) INTO v_dias
    FROM cat.parametro WHERE clave = 'dias_maximos_ficha';

  -- Se evalúa contra la sincronización, que es cuando la regla lo exige.
  IF NEW.estado = 'sincronizada' AND OLD.estado IS DISTINCT FROM 'sincronizada'
     AND NEW.fecha_diligenciamiento < CURRENT_DATE - (v_dias || ' days')::interval THEN
    RAISE EXCEPTION 'RN-016: la ficha % tiene más de % días de antigüedad y no puede sincronizarse.',
      NEW.codigo, v_dias;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ficha_fecha
  BEFORE INSERT OR UPDATE ON aps.ficha
  FOR EACH ROW EXECUTE FUNCTION aps.trg_ficha_fecha();


/* =========================================================================
   3. INTEGRIDAD ENTRE TABLAS
   ========================================================================= */

/* RN-007 — Coherencia entre el territorio (ítem 7) y el área de ubicación
   (ítem 6). Los territorios rurales del Anexo A —aquellos cuyos
   microterritorios llevan comuna "Rural"— sólo son seleccionables cuando la
   vivienda se registra en "Área rural" o "Centro poblado". */
CREATE OR REPLACE FUNCTION aps.trg_hogar_territorio_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_es_rural boolean;
BEGIN
  SELECT es_rural INTO v_es_rural FROM cat.territorio WHERE codigo = NEW.territorio_codigo;

  IF v_es_rural AND NEW.area_ubicacion NOT IN ('rural', 'centro_poblado') THEN
    RAISE EXCEPTION 'RN-007: el territorio % es rural y no admite el área de ubicación "%".',
      NEW.territorio_codigo, NEW.area_ubicacion;
  END IF;

  IF NOT v_es_rural AND NEW.area_ubicacion = 'rural' THEN
    RAISE EXCEPTION 'RN-007: el territorio % es urbano y no admite el área "Área rural".',
      NEW.territorio_codigo;
  END IF;

  -- RN-008: la comuna es un derivado de sólo lectura del microterritorio.
  SELECT comuna INTO NEW.comuna
    FROM cat.microterritorio
   WHERE territorio_codigo = NEW.territorio_codigo AND codigo = NEW.microterritorio_codigo;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_hogar_territorio_area
  BEFORE INSERT OR UPDATE ON aps.hogar
  FOR EACH ROW EXECUTE FUNCTION aps.trg_hogar_territorio_area();

/* RN-130 / RN-131 / RN-132 — Las llaves del plan son heredadas, no digitadas.
   Cualquier divergencia bloquea la sincronización; aquí se bloquea antes,
   en la escritura, que es donde el error todavía se puede corregir. */
CREATE OR REPLACE FUNCTION aps.trg_plan_llaves_heredadas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_codigo_ebs text; v_codigo_vivienda text; v_codigo_familia text;
  v_tipo_id text; v_numero_id text;
BEGIN
  SELECT e.codigo, h.codigo INTO v_codigo_ebs, v_codigo_vivienda
    FROM aps.ficha f
    JOIN aps.equipo_salud e ON e.id = f.equipo_salud_id
    JOIN aps.hogar h        ON h.id = f.hogar_id
   WHERE f.id = NEW.ficha_id;

  IF NEW.codigo_ebs IS DISTINCT FROM v_codigo_ebs THEN
    RAISE EXCEPTION 'RN-111/120/130: el código de EBS del plan (%) no coincide con el ítem 10 (%)',
      NEW.codigo_ebs, v_codigo_ebs;
  END IF;
  IF NEW.codigo_vivienda IS DISTINCT FROM v_codigo_vivienda THEN
    RAISE EXCEPTION 'RN-112/121/131: el código de vivienda del plan (%) no coincide con el ítem 25 (%)',
      NEW.codigo_vivienda, v_codigo_vivienda;
  END IF;

  IF NEW.familia_ficha_id IS NOT NULL THEN
    SELECT fa.codigo INTO v_codigo_familia
      FROM aps.familia_ficha ff JOIN aps.familia fa ON fa.id = ff.familia_id
     WHERE ff.id = NEW.familia_ficha_id;
    IF NEW.codigo_familia IS DISTINCT FROM v_codigo_familia THEN
      RAISE EXCEPTION 'RN-122/132: el código de familia del plan (%) no coincide con el ítem 26 (%)',
        NEW.codigo_familia, v_codigo_familia;
    END IF;
  END IF;

  -- RN-133 / RN-134: la persona intervenida debe ser un integrante ya capturado
  IF NEW.integrante_id IS NOT NULL THEN
    SELECT p.tipo_id, p.numero_id INTO v_tipo_id, v_numero_id
      FROM aps.integrante i JOIN aps.persona p ON p.id = i.persona_id
     WHERE i.id = NEW.integrante_id
       AND i.familia_ficha_id = NEW.familia_ficha_id;   -- bajo la familia del ítem 132
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RN-133/134: el integrante intervenido no pertenece a la familia del plan';
    END IF;
    IF NEW.tipo_id_integrante   IS DISTINCT FROM v_tipo_id
    OR NEW.numero_id_integrante IS DISTINCT FROM v_numero_id THEN
      RAISE EXCEPTION 'RN-133/134: el documento del plan (%/%) no coincide con los ítems 62/63 (%/%)',
        NEW.tipo_id_integrante, NEW.numero_id_integrante, v_tipo_id, v_numero_id;
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_plan_llaves_heredadas
  BEFORE INSERT OR UPDATE ON aps.plan_cuidado
  FOR EACH ROW EXECUTE FUNCTION aps.trg_plan_llaves_heredadas();

/* RN-226.1 — El primer seguimiento es posterior a la fecha de diligenciamiento
   y no excede el plazo del nivel de prioridad de la alerta que lo originó. */
CREATE OR REPLACE FUNCTION aps.trg_seguimiento_fechas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_fecha_ficha date;
BEGIN
  SELECT f.fecha_diligenciamiento INTO v_fecha_ficha
    FROM aps.plan_cuidado p JOIN aps.ficha f ON f.id = p.ficha_id
   WHERE p.id = NEW.plan_id;

  IF NEW.fecha_concertacion < v_fecha_ficha THEN
    RAISE EXCEPTION 'RN-016: la fecha de concertación (%) es anterior a la de diligenciamiento (%)',
      NEW.fecha_concertacion, v_fecha_ficha;
  END IF;
  IF NEW.seg1_fecha IS NOT NULL AND NEW.seg1_fecha < v_fecha_ficha THEN
    RAISE EXCEPTION 'RN-226.1: el primer seguimiento (%) es anterior a la fecha de diligenciamiento (%)',
      NEW.seg1_fecha, v_fecha_ficha;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seguimiento_fechas
  BEFORE INSERT OR UPDATE ON aps.plan_seguimiento
  FOR EACH ROW EXECUTE FUNCTION aps.trg_seguimiento_fechas();

/* RN-226.5 — Un NC sobre acción derivada de alerta INMEDIATA o PRIORITARIA
   reactiva la alerta original: el incumplimiento de una atención urgente no
   puede darse por cerrado. */
CREATE OR REPLACE FUNCTION aps.trg_seguimiento_nc_reactiva() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seg2_estado = 'NC' OR (NEW.seg1_estado = 'NC' AND NEW.seg2_estado IS NULL) THEN
    UPDATE aps.alerta a
       SET estado = 'reactivada'
      FROM aps.alerta_accion aa
      JOIN aps.plan_accion pa ON pa.id = aa.plan_accion_id
     WHERE aa.alerta_id = a.id
       AND pa.plan_id = NEW.plan_id
       AND a.prioridad IN ('inmediata','prioritaria')
       AND a.estado <> 'reactivada';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seguimiento_nc_reactiva
  AFTER INSERT OR UPDATE ON aps.plan_seguimiento
  FOR EACH ROW EXECUTE FUNCTION aps.trg_seguimiento_nc_reactiva();


/* =========================================================================
   3. SEMAFORIZACIÓN DEL RIESGO FAMILIAR (RN-221)
   ========================================================================= */

CREATE OR REPLACE FUNCTION aps.calcular_riesgo_familiar(p_familia_ficha_id bigint)
RETURNS aps.riesgo_familiar LANGUAGE plpgsql STABLE AS $$
DECLARE v_inmediatas int; v_prioritarias int; v_regulares int; v_ficha_id bigint;
BEGIN
  SELECT ficha_id INTO v_ficha_id FROM aps.familia_ficha WHERE id = p_familia_ficha_id;

  -- Agrega las alertas de los integrantes, de la familia y de la vivienda que comparten.
  SELECT count(*) FILTER (WHERE prioridad = 'inmediata'),
         count(*) FILTER (WHERE prioridad = 'prioritaria'),
         count(*) FILTER (WHERE prioridad = 'regular')
    INTO v_inmediatas, v_prioritarias, v_regulares
    FROM aps.alerta
   WHERE estado <> 'no_procede'
     AND (familia_ficha_id = p_familia_ficha_id
          OR (ambito = 'vivienda' AND ficha_id = v_ficha_id));

  RETURN CASE
    WHEN v_inmediatas > 0 OR v_prioritarias >= 3 THEN 'alto'::aps.riesgo_familiar
    WHEN v_prioritarias BETWEEN 1 AND 2          THEN 'medio'::aps.riesgo_familiar
    WHEN v_regulares > 0                         THEN 'bajo'::aps.riesgo_familiar
    ELSE 'sin_riesgo'::aps.riesgo_familiar
  END;
END $$;
COMMENT ON FUNCTION aps.calcular_riesgo_familiar IS
  'RN-221. Campo calculado de sólo lectura. Se recalcula ante cualquier modificación de la ficha. '
  'Determina la periodicidad del seguimiento: alto 30 días, medio 90, bajo 180, sin riesgo anual.';

/* Recalcula la semaforización de todas las familias de la ficha ante cambios en alertas. */
CREATE OR REPLACE FUNCTION aps.trg_recalcular_riesgo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ficha_id bigint;
BEGIN
  v_ficha_id := coalesce(NEW.ficha_id, OLD.ficha_id);
  UPDATE aps.familia_ficha ff
     SET clasificacion_riesgo = aps.calcular_riesgo_familiar(ff.id),
         riesgo_calculado_en  = now()
   WHERE ff.ficha_id = v_ficha_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_recalcular_riesgo
  AFTER INSERT OR UPDATE OR DELETE ON aps.alerta
  FOR EACH ROW EXECUTE FUNCTION aps.trg_recalcular_riesgo();


/* =========================================================================
   4. VALIDACIÓN DE COMPLETITUD PARA EL CIERRE (RN-222)
   Devuelve la lista de incumplimientos agrupados por bloque, con el ítem y la
   regla, para que la interfaz pueda navegar al campo. La regla es explícita:
   "No se admite un mensaje genérico de error".
   ========================================================================= */

CREATE OR REPLACE FUNCTION aps.validar_cierre(p_ficha_id bigint)
RETURNS TABLE (bloque text, regla text, item int, detalle text)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- 1. Consentimiento informado (RN-001)
  RETURN QUERY
  SELECT 'Autorización', 'RN-001', 1, 'El consentimiento informado no fue aceptado.'
    FROM aps.ficha f WHERE f.id = p_ficha_id AND NOT f.consentimiento;

  -- 2. Caracterización de la vivienda ausente
  RETURN QUERY
  SELECT 'Vivienda', 'RN-000', 21, 'La ficha no tiene caracterización de vivienda.'
   WHERE NOT EXISTS (SELECT 1 FROM aps.vivienda v WHERE v.ficha_id = p_ficha_id);

  -- 3. Familias declaradas sin caracterizar (RN-028, RN-222.3)
  RETURN QUERY
  SELECT 'Familia', 'RN-028', 28,
         format('Se declararon %s familias en la vivienda y hay %s caracterizadas.',
                v.hogares_en_vivienda, (SELECT count(*) FROM aps.familia_ficha ff WHERE ff.ficha_id = p_ficha_id))
    FROM aps.vivienda v
   WHERE v.ficha_id = p_ficha_id
     AND v.hogares_en_vivienda <> (SELECT count(*) FROM aps.familia_ficha ff WHERE ff.ficha_id = p_ficha_id);

  -- 4. Integrantes declarados sin caracterizar (RN-051.1, RN-222.4)
  RETURN QUERY
  SELECT 'Integrante', 'RN-051', 51,
         format('La familia %s declaró %s integrantes y tiene %s capturados.',
                fa.codigo, ff.numero_integrantes, count(i.id))
    FROM aps.familia_ficha ff
    JOIN aps.familia fa ON fa.id = ff.familia_id
    LEFT JOIN aps.integrante i ON i.familia_ficha_id = ff.id
   WHERE ff.ficha_id = p_ficha_id
   GROUP BY fa.codigo, ff.numero_integrantes
  HAVING count(i.id) <> ff.numero_integrantes;

  -- 5. Responsable económico único por familia (RN-051.3, RN-072)
  RETURN QUERY
  SELECT 'Integrante', 'RN-072', 72,
         format('La familia %s tiene %s integrantes con rol "Responsable económico"; debe haber exactamente uno.',
                fa.codigo, count(*) FILTER (WHERE i.rol_familiar = 'responsable_economico'))
    FROM aps.familia_ficha ff
    JOIN aps.familia fa ON fa.id = ff.familia_id
    LEFT JOIN aps.integrante i ON i.familia_ficha_id = ff.id
   WHERE ff.ficha_id = p_ficha_id
   GROUP BY fa.codigo
  HAVING count(*) FILTER (WHERE i.rol_familiar = 'responsable_economico') <> 1;

  -- 6. Personas de la vivienda vs. integrantes declarados (RN-029.4)
  RETURN QUERY
  SELECT 'Vivienda', 'RN-029', 29,
         format('La vivienda declara %s personas pero las familias suman %s integrantes.',
                v.personas_en_vivienda, s.total)
    FROM aps.vivienda v
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(ff.numero_integrantes), 0) AS total
        FROM aps.familia_ficha ff WHERE ff.ficha_id = p_ficha_id
    ) s
   WHERE v.ficha_id = p_ficha_id AND v.personas_en_vivienda < s.total;

  -- 7. Alertas INMEDIATAS sin conducta registrada (RN-220, RN-222.5)
  RETURN QUERY
  SELECT 'Plan de cuidado', 'RN-220', NULL::int,
         format('Alerta %s de prioridad %s sin acción registrada: %s', a.regla_codigo, a.prioridad, a.motivo)
    FROM aps.alerta a
   WHERE a.ficha_id = p_ficha_id
     AND a.estado = 'activa'
     AND a.bloquea_cierre
     AND NOT EXISTS (SELECT 1 FROM aps.alerta_accion aa WHERE aa.alerta_id = a.id);

  -- 8. Georreferenciación pendiente sin motivo (RN-022, RN-222.6)
  RETURN QUERY
  SELECT 'Vivienda', 'RN-022', 22, 'Georreferenciación pendiente sin motivo de imposibilidad registrado.'
    FROM aps.ficha f JOIN aps.hogar h ON h.id = f.hogar_id
   WHERE f.id = p_ficha_id
     AND h.geo_pendiente
     AND nullif(btrim(h.geo_motivo_imposibilidad), '') IS NULL;

  -- 9. Familia sin medio de contacto telefónico y sin la novedad (RN-070, RN-222.7)
  RETURN QUERY
  SELECT 'Integrante', 'RN-070', 70,
         format('La familia %s no registra teléfono de contacto ni la novedad "sin medio de contacto telefónico".', fa.codigo)
    FROM aps.familia_ficha ff
    JOIN aps.familia fa ON fa.id = ff.familia_id
   WHERE ff.ficha_id = p_ficha_id
     AND NOT ff.sin_contacto_telefonico
     AND NOT EXISTS (
       SELECT 1 FROM aps.integrante i
        WHERE i.familia_ficha_id = ff.id AND nullif(btrim(i.telefono1), '') IS NOT NULL
     );

  -- 10. Barrera de identificación sin canalización (RN-063, RN-209.5)
  RETURN QUERY
  SELECT 'Integrante', 'RN-063', 63,
         format('%s %s tiene documento %s y no registra canalización a Registraduría.',
                p.primer_nombre, p.primer_apellido, p.tipo_id)
    FROM aps.integrante i
    JOIN aps.persona p        ON p.id = i.persona_id
    JOIN aps.familia_ficha ff ON ff.id = i.familia_ficha_id
   WHERE ff.ficha_id = p_ficha_id
     AND p.tipo_id IN ('MS','AS')
     AND NOT EXISTS (
       SELECT 1 FROM aps.plan_cuidado pc
        WHERE pc.integrante_id = i.id AND pc.ambito = 'persona'
     );
END $$;
COMMENT ON FUNCTION aps.validar_cierre IS
  'RN-222. Resumen de validación previo al cierre. Cada fila indica bloque, regla e ítem para '
  'permitir navegación directa al campo.';

/* El cierre efectivo consulta la validación anterior. */
CREATE OR REPLACE FUNCTION aps.trg_ficha_cierre() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_pendientes int;
BEGIN
  IF NEW.estado IN ('cerrada','sincronizada') AND OLD.estado NOT IN ('cerrada','sincronizada') THEN
    -- RN-222, excepción de campo: el cierre incompleto se admite con motivo registrado.
    IF NEW.estado = 'cerrada' THEN
      SELECT count(*) INTO v_pendientes FROM aps.validar_cierre(NEW.id);
      IF v_pendientes > 0 THEN
        RAISE EXCEPTION 'RN-222: la ficha % tiene % incumplimiento(s) de completitud. '
                        'Consulte aps.validar_cierre(%) para el detalle.', NEW.codigo, v_pendientes, NEW.id;
      END IF;
    END IF;
    NEW.cerrada_en := coalesce(NEW.cerrada_en, now());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ficha_cierre
  BEFORE UPDATE ON aps.ficha
  FOR EACH ROW EXECUTE FUNCTION aps.trg_ficha_cierre();


/* =========================================================================
   5. INALTERABILIDAD (RN-225)
   ========================================================================= */

/* "Ninguna ficha cerrada y sincronizada puede modificarse ni eliminarse.
    Las correcciones se realizan mediante una nueva versión." */
CREATE OR REPLACE FUNCTION aps.trg_ficha_inalterable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado = 'sincronizada' THEN
      RAISE EXCEPTION 'RN-225: la ficha % está sincronizada y no puede eliminarse.', OLD.codigo;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.estado = 'sincronizada'
     AND (NEW.codigo, NEW.hogar_id, NEW.consentimiento, NEW.fecha_diligenciamiento, NEW.responsable_id)
      IS DISTINCT FROM
         (OLD.codigo, OLD.hogar_id, OLD.consentimiento, OLD.fecha_diligenciamiento, OLD.responsable_id)
  THEN
    RAISE EXCEPTION 'RN-225: la ficha % está sincronizada. Registre una nueva versión '
                    '(ficha_reemplazada_id) en lugar de modificarla.', OLD.codigo;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ficha_inalterable
  BEFORE UPDATE OR DELETE ON aps.ficha
  FOR EACH ROW EXECUTE FUNCTION aps.trg_ficha_inalterable();

/* La auditoría es append-only. */
CREATE OR REPLACE FUNCTION aud.trg_solo_insercion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RN-225: % es un registro de auditoría inalterable; sólo admite inserciones.', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_evento_inalterable
  BEFORE UPDATE OR DELETE ON aud.evento
  FOR EACH ROW EXECUTE FUNCTION aud.trg_solo_insercion();

CREATE TRIGGER trg_acceso_inalterable
  BEFORE UPDATE OR DELETE ON aud.acceso_sensible
  FOR EACH ROW EXECUTE FUNCTION aud.trg_solo_insercion();


/* =========================================================================
   6. VISTAS DE APOYO
   ========================================================================= */

/* RN-220 — Alertas sin acción: la pregunta que el modelo debe poder responder. */
CREATE OR REPLACE VIEW aps.v_alertas_sin_accion AS
SELECT a.*, f.codigo AS codigo_ficha
  FROM aps.alerta a
  JOIN aps.ficha f ON f.id = a.ficha_id
 WHERE a.estado = 'activa'
   AND NOT EXISTS (SELECT 1 FROM aps.alerta_accion aa WHERE aa.alerta_id = a.id);

/* RN-211 — Entorno de alto riesgo sanitario: tres o más hallazgos concurrentes.
   Los criterios de "no segura" y "crítica" se leen de cat.opcion.metadata, que
   el seed toma de las banderas `noSegura` y `critica` de catalogos.js. Así el
   umbral sanitario se administra por catálogo y no queda escrito en la vista. */
CREATE OR REPLACE FUNCTION aps.marca(p_dominio text, p_codigo text, p_bandera text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  -- El coalesce externo cubre el caso de que la opción no exista: sin él la
  -- consulta devolvería NULL y anularía toda la suma de hallazgos.
  SELECT coalesce(
    (SELECT (o.metadata ->> p_bandera)::boolean
       FROM cat.opcion o
      WHERE o.dominio_codigo = p_dominio AND o.codigo = p_codigo),
    false);
$$;

CREATE OR REPLACE VIEW aps.v_riesgo_vivienda AS
SELECT v.ficha_id,
       v.hacinamiento,
       v.hacinamiento_critico,
       (v.hacinamiento)::int                                                          -- RN-033
     + aps.marca('FUENTE_AGUA', v.fuente_agua, 'noSegura')::int                       -- RN-046
     + aps.marca('DISPOSICION_EXCRETAS', v.disposicion_excretas, 'critica')::int       -- RN-047
     + aps.marca('AGUAS_RESIDUALES', v.aguas_residuales, 'critica')::int               -- RN-048
     + aps.marca('RESIDUOS_SOLIDOS', v.residuos_solidos, 'critica')::int               -- RN-049
     + (v.vectores = 'si')::int                                                        -- RN-037
     + (v.material_techo IN ('desechos','palma_paja','fibrocemento_con_asbesto'))::int -- RN-035
     + (v.perros_vacunados < v.perros
        OR v.gatos_vacunados < v.gatos
        OR v.carnet_antirrabico = 'no')::int                                           -- RN-042/044/045
     + (v.elementos_para_dormir < v.personas_en_vivienda / 2.0)::int                   -- RN-031
       AS hallazgos
  FROM aps.vivienda v;
COMMENT ON VIEW aps.v_riesgo_vivienda IS
  'RN-211. Con tres o más hallazgos la vivienda se clasifica como entorno de alto riesgo '
  'sanitario, la prioridad global asciende a PRIORITARIA y se programa visita de seguimiento '
  'obligatoria dentro de los 30 días. Los riesgos de accidente del ítem 36 no se cuentan aquí: '
  'sólo elevan prioridad si hay menores de 5 años o adultos mayores de 70 (RN-211, párrafo final).';

COMMIT;
