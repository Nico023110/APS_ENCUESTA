/* =========================================================================
   APS APP — ESQUEMA RELACIONAL
   Fuente: REGLAS_DE_NEGOCIO.md v2.0 (RN-000 … RN-226)
           reglas.js  (modelo de datos esperado, líneas 33-59)
           catalogos.js (catálogos parametrizados)
   Motor:  PostgreSQL 14+
   Archivo 1 de 3 — Estructura (DDL)
   =========================================================================

   PRINCIPIOS DE DISEÑO

   1. RN-000 fija la cardinalidad: Ficha 1 → Vivienda 1 → Familia N → Integrante N.
      El árbol de tablas la reproduce literalmente.

   2. Se separa IDENTIDAD PERSISTENTE de CARACTERIZACIÓN POR VISITA:
        aps.hogar   / aps.vivienda           (RN-025: el hogar sobrevive a la visita)
        aps.familia / aps.familia_ficha      (RN-026: el id de familia es estable)
        aps.persona / aps.integrante         (RN-063: tipo+número deduplica entre visitas)
      Sin esta separación no se puede cumplir "una misma persona caracterizada
      dos veces no se contabiliza como dos individuos".

   3. Todo campo de selección MÚLTIPLE es una tabla puente, nunca un arreglo ni
      una cadena separada por comas: el instrumento exige contarlos y cruzarlos.

   4. Los catálogos viven en el esquema `cat` y son parametrizables sin desplegar
      código (nota final de la sección 15 de las reglas).

   5. Alerta y acción quedan unidas por aps.alerta_accion (RN-220): para cualquier
      ficha debe poder responderse "¿qué se hizo frente a este hallazgo?".

   ========================================================================= */

BEGIN;

CREATE SCHEMA IF NOT EXISTS cat;   -- catálogos parametrizables
CREATE SCHEMA IF NOT EXISTS aps;   -- núcleo transaccional
CREATE SCHEMA IF NOT EXISTS aud;   -- auditoría inalterable (RN-225)

COMMENT ON SCHEMA cat IS 'Catálogos parametrizados. Administrables sin nueva versión de la aplicación.';
COMMENT ON SCHEMA aps IS 'Núcleo transaccional del instrumento SI-APS.';
COMMENT ON SCHEMA aud IS 'Auditoría y trazabilidad. Append-only (RN-225).';


/* =========================================================================
   1. TIPOS ENUMERADOS
   Sólo para valores cerrados por regla o por arquitectura. Todo lo que el
   Ministerio pueda cambiar sin cambiar la regla va en cat.opcion.
   ========================================================================= */

CREATE TYPE aps.estado_ficha AS ENUM (
  'borrador',                 -- en captura
  'interrumpida_urgencia',    -- RN-201: visita suspendida por urgencia vital
  'incompleta_causa_externa', -- RN-222 excepción de campo: no entra al denominador
  'rechazada_sin_consentimiento', -- RN-001 / RN-224: sólo la novedad, sin datos
  'cerrada',
  'sincronizada'
);

CREATE TYPE aps.ambito_plan AS ENUM ('vivienda', 'familia', 'persona');           -- RN-000
CREATE TYPE aps.tipo_respuesta AS ENUM ('en_sitio', 'derivada');                  -- RN-115/125/136b
CREATE TYPE aps.estado_seguimiento AS ENUM ('C', 'CP', 'NC');                     -- RN-226
CREATE TYPE aps.prioridad AS ENUM ('regular', 'prioritaria', 'inmediata');        -- RN-200
CREATE TYPE aps.estado_alerta AS ENUM ('activa','atendida','no_procede','reactivada'); -- RN-220/226
CREATE TYPE aps.riesgo_familiar AS ENUM ('sin_riesgo','bajo','medio','alto');     -- RN-221
CREATE TYPE aps.tipo_procedimiento AS ENUM ('CUPS', 'NoCUPS');                    -- RN-220
CREATE TYPE aps.sistema_notificacion AS ENUM ('SIVIGILA','ICBF','LINEA_123','EAPB','REGISTRADURIA','SEC_EDUCACION','RLCPD');
CREATE TYPE aps.resultado_sincronizacion AS ENUM ('exitosa','fallida','conflicto_resuelto','rechazada');
CREATE TYPE aud.tipo_evento AS ENUM (
  'creacion','modificacion','alerta_activada','conducta_registrada',
  'cierre','sincronizacion','consulta_sensible','derecho_titular'
);
CREATE TYPE aud.derecho_titular AS ENUM ('conocer','actualizar','rectificar','suprimir'); -- RN-224.5


/* =========================================================================
   2. CATÁLOGOS
   ========================================================================= */

/* --- 2.1 Catálogo genérico de listas simples -----------------------------
   Un dominio por cada pregunta de lista cerrada del instrumento (estrato,
   tipo de vivienda, material de techo, rol familiar, …). Evita 60 tablas
   de dos columnas y permite versionar opciones sin migración de esquema. */

CREATE TABLE cat.dominio (
  codigo        text PRIMARY KEY,
  nombre        text NOT NULL,
  item          int,                          -- ítem del formulario impreso que lo origina
  regla         text,                         -- RN-xxx que lo gobierna
  multiple      boolean NOT NULL DEFAULT false,
  descripcion   text
);
COMMENT ON TABLE cat.dominio IS 'Cada lista cerrada del instrumento. `multiple`=true si el ítem admite selección múltiple.';

CREATE TABLE cat.opcion (
  dominio_codigo text NOT NULL REFERENCES cat.dominio(codigo) ON UPDATE CASCADE,
  codigo         text NOT NULL,
  etiqueta       text NOT NULL,
  orden          int  NOT NULL DEFAULT 0,
  es_excluyente  boolean NOT NULL DEFAULT false, -- "Ninguna"/"Ninguno"/"No aplica" (sección 15)
  exige_texto    boolean NOT NULL DEFAULT false, -- "Otro → ¿Cuál?" (RN-014, RN-040, RN-068 …)
  vigente        boolean NOT NULL DEFAULT true,
  metadata       jsonb,                          -- umbrales, rangos de edad, sexo aplicable
  PRIMARY KEY (dominio_codigo, codigo)
);
COMMENT ON COLUMN cat.opcion.metadata IS
  'Reglas finas asociadas a la opción. Ej. matriz de RN-087: {"edad_min_meses":6,"edad_max_meses":23,"sexos":["mujer","intersexual"]}.';

/* Validador usado por los CHECK de las tablas de datos.
   Se acepta deliberadamente que un cambio posterior de catálogo no revalide
   filas históricas: las reglas exigen catálogos actualizables (sección 15) y
   auditoría inalterable (RN-225), es decir, la ficha vale por el catálogo
   vigente el día de la captura. */
CREATE FUNCTION cat.es_opcion(p_dominio text, p_codigo text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_codigo IS NULL
      OR EXISTS (SELECT 1 FROM cat.opcion o
                  WHERE o.dominio_codigo = p_dominio AND o.codigo = p_codigo);
$$;

/* --- 2.2 Catálogos estructurados (jerárquicos o con atributos propios) --- */

CREATE TABLE cat.departamento (                                   -- RN-003 (DIVIPOLA)
  codigo char(2) PRIMARY KEY,
  nombre text NOT NULL
);

CREATE TABLE cat.municipio (                                      -- RN-005
  codigo             char(5) PRIMARY KEY,
  departamento_codigo char(2) NOT NULL REFERENCES cat.departamento(codigo),
  nombre             text NOT NULL,
  -- RN-005: coherencia jerárquica DIVIPOLA
  CONSTRAINT municipio_pertenece_departamento CHECK (codigo LIKE departamento_codigo || '%')
);

CREATE TABLE cat.uzpe (                                           -- RN-004
  codigo           text PRIMARY KEY,
  municipio_codigo char(5) NOT NULL REFERENCES cat.municipio(codigo),
  nombre           text NOT NULL,
  vigente          boolean NOT NULL DEFAULT true
);

CREATE TABLE cat.territorio (                                     -- RN-007, Anexo A
  codigo       text PRIMARY KEY,                                  -- T48 … T84
  nombre       text NOT NULL,
  uzpe_codigo  text REFERENCES cat.uzpe(codigo),
  es_rural     boolean NOT NULL DEFAULT false,                    -- restringe RN-007 vs ítem 6
  vigente      boolean NOT NULL DEFAULT true
);

CREATE TABLE cat.microterritorio (                                -- RN-008, Anexo A
  territorio_codigo text NOT NULL REFERENCES cat.territorio(codigo),
  codigo            text NOT NULL,                                -- MT01 … MT04
  nombre            text,
  comuna            text,                                         -- se hereda como derivado
  vigente           boolean NOT NULL DEFAULT true,
  PRIMARY KEY (territorio_codigo, codigo)
);

CREATE TABLE cat.pais (                                           -- RN-065
  codigo char(2) PRIMARY KEY,
  nombre text NOT NULL
);

CREATE TABLE cat.eapb (                                           -- RN-076
  codigo   text PRIMARY KEY,
  nombre   text NOT NULL,
  regimen  text,                                                  -- coherencia con RN-075
  vigente  boolean NOT NULL DEFAULT true
);

CREATE TABLE cat.ocupacion_ciuo (                                 -- RN-073
  codigo            text PRIMARY KEY,
  nombre            text NOT NULL,
  riesgo_ocupacional text                                         -- agroquímicos, minería, asbesto…
);

CREATE TABLE cat.prestador (                                      -- RN-011
  codigo  text PRIMARY KEY,
  nombre  text NOT NULL,
  vigente boolean NOT NULL DEFAULT true
);

/* --- 2.3 CUPS: acciones e intervenciones del Plan de Cuidado -------------
   RN-114/124/136a: las acciones se codifican en CUPS cuando corresponden a
   procedimientos del plan de beneficios, y en NoCUPS cuando son acciones
   educativas, de gestión o de salud ambiental sin código CUPS asignado
   (RN-220). Ambos viven aquí, discriminados por `tipo`.

   La carga proviene de TablaReferencia_CUPS.xlsx (MSPS). Se conserva la
   jerarquía oficial completa porque es lo que hace navegable un catálogo de
   diez mil códigos: el encuestador busca por texto, no recuerda el número. */

CREATE TABLE cat.cups (
  codigo            text PRIMARY KEY,
  nombre            text NOT NULL,
  tipo              aps.tipo_procedimiento NOT NULL DEFAULT 'CUPS',
  capitulo          text,          -- "CapItulo 01 SISTEMA NERVIOSO"
  grupo             text,          -- nivel 1 de la jerarquía oficial
  subgrupo          text,          -- nivel 2
  categoria         text,          -- nivel 3
  codigo_jerarquico text,          -- "01.0.1.01"
  sexo_aplicable    char(1),       -- Z ambos · F femenino · M masculino
  quirurgico        boolean,
  habilitado        boolean NOT NULL DEFAULT true,
  -- Subconjunto seleccionable por el EBS en campo. De los ~10.000 códigos
  -- oficiales sólo una fracción tiene sentido en una visita domiciliaria;
  -- marcar el subconjunto evita ofrecer al encuestador una lista inmanejable.
  apto_aps          boolean NOT NULL DEFAULT false,
  ambito            aps.ambito_plan,          -- NULL = aplicable a cualquiera
  actualizado_en    timestamptz,

  CONSTRAINT cups_sexo_valido CHECK (sexo_aplicable IS NULL OR sexo_aplicable IN ('Z','F','M')),
  -- Los NoCUPS son códigos internos: no traen jerarquía oficial.
  CONSTRAINT cups_nocups_sin_jerarquia CHECK (tipo = 'CUPS' OR codigo_jerarquico IS NULL)
);
COMMENT ON COLUMN cat.cups.sexo_aplicable IS
  'Columna "Extra_I:Cobertura" de la fuente oficial. Filtra la selección según el sexo del '
  'integrante intervenido. En personas intersexuales o trans la decisión se fundamenta en el '
  'órgano presente, no en este campo (RN-087, enfoque diferencial).';

/* --- 2.4 Acción sugerida por regla ---------------------------------------
   RN-220 exige que toda alerta genere al menos una acción, y varias reglas
   nombran la acción concreta: RN-042 "obliga a registrar acción de canalización
   a vacunación antirrábica", RN-074 "exige registrar la canalización a la
   Secretaría de Educación", RN-209 "exigir acción de gestión de afiliación".

   Esta tabla convierte esas obligaciones en datos: liga cada regla de decisión
   con los códigos que la resuelven, de modo que el sistema pueda proponer la
   acción al EBS en lugar de dejarlo buscar entre diez mil códigos. Sin ella,
   RN-220 depende de que el encuestador recuerde qué corresponde a cada
   hallazgo. */

CREATE TABLE cat.accion_sugerida (
  regla_codigo  text NOT NULL,                    -- RN-201 … RN-212
  codigo_accion text NOT NULL REFERENCES cat.cups(codigo),
  ambito        aps.ambito_plan NOT NULL,
  obligatoria   boolean NOT NULL DEFAULT false,   -- la regla la nombra expresamente
  nota          text,
  PRIMARY KEY (regla_codigo, codigo_accion)
);
COMMENT ON TABLE cat.accion_sugerida IS
  'Catálogo de conducta esperada por regla. Es una sugerencia operativa, no una '
  'restricción: el EBS puede registrar otra acción si el caso lo amerita, pero '
  'las marcadas obligatoria = true corresponden a reglas que nombran la conducta '
  'de forma expresa.';

CREATE INDEX ix_accion_sugerida_regla ON cat.accion_sugerida (regla_codigo);

CREATE TABLE cat.parametro (                                      -- RN-003, RN-016, RN-022/023
  clave       text PRIMARY KEY,
  valor       jsonb NOT NULL,
  descripcion text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE cat.parametro IS
  'Recuadro municipal, departamento fijado, antigüedad máxima de ficha, plazos por prioridad. '
  'Las reglas exigen que sean parámetros y no valores en código fuente.';


/* =========================================================================
   3. ACTORES: EQUIPO BÁSICO DE SALUD
   ========================================================================= */

CREATE TABLE aps.equipo_salud (                                   -- RN-010
  id               bigserial PRIMARY KEY,
  codigo           text NOT NULL UNIQUE,
  prestador_codigo text REFERENCES cat.prestador(codigo),         -- RN-011
  municipio_codigo char(5) REFERENCES cat.municipio(codigo),
  activo           boolean NOT NULL DEFAULT true,
  CONSTRAINT ebs_formato_codigo CHECK (codigo ~ '^[A-Za-z0-9]{3,20}$')  -- RN-010
);

CREATE TABLE aps.funcionario (                                    -- RN-012/013/014, 113, 116, 123, 126, 135, 137
  id                bigserial PRIMARY KEY,
  tipo_id           text NOT NULL,          -- dominio TIPO_ID_RESPONSABLE: CC, CD, CE, PT
  numero_id         text NOT NULL,
  nombre_completo   text NOT NULL,
  perfil_profesional text,                  -- dominio PERFIL_PROFESIONAL
  perfil_otro       text,                   -- RN-014: obligatorio si perfil = 'otro'
  equipo_salud_id   bigint REFERENCES aps.equipo_salud(id),
  activo            boolean NOT NULL DEFAULT true,
  UNIQUE (tipo_id, numero_id),
  CONSTRAINT func_tipo_id_valido CHECK (cat.es_opcion('TIPO_ID_RESPONSABLE', tipo_id)),
  CONSTRAINT func_perfil_valido  CHECK (cat.es_opcion('PERFIL_PROFESIONAL', perfil_profesional)),
  -- RN-013: formato ligado al tipo de documento
  CONSTRAINT func_formato_documento CHECK (
    (tipo_id = 'CC' AND numero_id ~ '^[0-9]{6,10}$')
    OR (tipo_id IN ('CD','CE','PT') AND numero_id ~ '^[A-Za-z0-9]{5,16}$')
  ),
  -- RN-014: "Otro" exige aclaración
  CONSTRAINT func_perfil_otro CHECK (perfil_profesional <> 'otro' OR nullif(btrim(perfil_otro),'') IS NOT NULL)
);


/* =========================================================================
   4. IDENTIDADES PERSISTENTES
   ========================================================================= */

/* --- 4.1 Hogar / unidad de vivienda física (RN-025) ---------------------- */
CREATE TABLE aps.hogar (
  id                   bigserial PRIMARY KEY,
  codigo               text NOT NULL UNIQUE,          -- ítem 25, generado por el sistema
  municipio_codigo     char(5) NOT NULL REFERENCES cat.municipio(codigo),
  area_ubicacion       text NOT NULL,                 -- ítem 6, dominio AREA_UBICACION
  territorio_codigo    text NOT NULL,                 -- ítem 7
  microterritorio_codigo text NOT NULL,               -- ítem 8
  comuna               text,                          -- derivado de RN-008, sólo lectura
  division_territorial text NOT NULL,                 -- ítem 9
  direccion_normalizada text NOT NULL,                -- ítem 21
  direccion_componentes jsonb,                        -- captura estructurada (direccion.js)
  latitud              numeric(9,6),                  -- ítem 22
  longitud             numeric(9,6),                  -- ítem 23
  geo_pendiente        boolean NOT NULL DEFAULT false,-- RN-022: sin señal GPS
  geo_motivo_imposibilidad text,                      -- RN-022 / RN-222.6
  punto_referencia     text NOT NULL,                 -- ítem 24
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (territorio_codigo, microterritorio_codigo)
    REFERENCES cat.microterritorio(territorio_codigo, codigo),          -- RN-008 cascada
  CONSTRAINT hogar_area_valida CHECK (cat.es_opcion('AREA_UBICACION', area_ubicacion)),
  CONSTRAINT hogar_latitud_rango  CHECK (latitud  IS NULL OR latitud  BETWEEN -90  AND 90),   -- RN-022
  CONSTRAINT hogar_longitud_rango CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),  -- RN-023
  -- RN-023: latitud y longitud se registran siempre como par
  CONSTRAINT hogar_geo_par CHECK ((latitud IS NULL) = (longitud IS NULL)),
  -- RN-022: sin coordenadas, la ficha queda marcada como georreferenciación pendiente
  CONSTRAINT hogar_geo_pendiente_coherente CHECK (latitud IS NOT NULL OR geo_pendiente)
);
COMMENT ON TABLE aps.hogar IS
  'Unidad de vivienda física. RN-025: se conserva estable entre visitas; al regresar a la '
  'misma dirección georreferenciada se recupera el hogar existente en lugar de crear otro.';
CREATE INDEX ix_hogar_geo ON aps.hogar (latitud, longitud);
CREATE INDEX ix_hogar_territorio ON aps.hogar (territorio_codigo, microterritorio_codigo);

/* --- 4.2 Familia (RN-026) ------------------------------------------------ */
CREATE TABLE aps.familia (
  id          bigserial PRIMARY KEY,
  codigo      text NOT NULL UNIQUE,                   -- ítem 26
  hogar_id    bigint NOT NULL REFERENCES aps.hogar(id) ON DELETE RESTRICT,
  consecutivo int NOT NULL,                           -- 1..N dentro del hogar
  creada_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, consecutivo),
  CONSTRAINT familia_consecutivo_positivo CHECK (consecutivo >= 1)
);
COMMENT ON TABLE aps.familia IS 'RN-026: llave subordinada al hogar. Una vivienda puede contener varias familias.';

/* --- 4.3 Persona (RN-063) ------------------------------------------------ */
CREATE TABLE aps.persona (
  id                bigserial PRIMARY KEY,
  tipo_id           text NOT NULL,                    -- ítem 62, dominio TIPO_ID_INTEGRANTE
  numero_id         text NOT NULL,                    -- ítem 63
  primer_nombre     text NOT NULL,                    -- ítem 58
  segundo_nombre    text,                             -- ítem 59
  primer_apellido   text NOT NULL,                    -- ítem 60
  segundo_apellido  text,                             -- ítem 61
  fecha_nacimiento  date NOT NULL,                    -- ítem 64
  sexo              text NOT NULL,                    -- ítem 66, dominio SEXO
  nacionalidad      char(2) NOT NULL DEFAULT 'CO' REFERENCES cat.pais(codigo), -- ítem 65
  identificador_temporal boolean NOT NULL DEFAULT false,  -- RN-063: tipos MS y AS
  creada_en         timestamptz NOT NULL DEFAULT now(),

  -- RN-063: tipo + número es la llave de deduplicación entre visitas y entre hogares
  UNIQUE (tipo_id, numero_id),

  CONSTRAINT persona_tipo_id_valido CHECK (cat.es_opcion('TIPO_ID_INTEGRANTE', tipo_id)),
  CONSTRAINT persona_sexo_valido    CHECK (cat.es_opcion('SEXO', sexo)),
  CONSTRAINT persona_nombres_alfabeticos CHECK (          -- RN-058 a RN-061
        primer_nombre   ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ ]+$'
    AND primer_apellido ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ ]+$'
    AND (segundo_nombre   IS NULL OR segundo_nombre   ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ ]*$')
    AND (segundo_apellido IS NULL OR segundo_apellido ~ '^[A-Za-zÁÉÍÓÚÑáéíóúñ ]*$')
  ),
  -- RN-063: formato del número ligado al tipo de documento
  CONSTRAINT persona_formato_documento CHECK (
       (tipo_id IN ('CC','TI')            AND numero_id ~ '^[0-9]{6,10}$')
    OR (tipo_id = 'RC'                    AND numero_id ~ '^[0-9]{8,11}$')
    OR (tipo_id IN ('CE','PE','PT','CD')  AND numero_id ~ '^[A-Za-z0-9]{5,16}$')
    OR (tipo_id = 'NV'                    AND numero_id ~ '^[A-Za-z0-9]{1,20}$')
    OR (tipo_id IN ('MS','AS')            AND identificador_temporal)
  ),
  -- RN-064: los rangos de edad (fecha futura, 120 años, MS/AS) se validan por trigger
  -- en 03_reglas.sql, no por CHECK: dependen de la fecha actual y un CHECK volátil
  -- haría fallar la restauración de un respaldo cuando un MS cumple 18 años.
  -- RN-064: los documentos de extranjería exigen nacionalidad distinta de Colombia
  CONSTRAINT persona_extranjeria_nacionalidad CHECK (
    tipo_id NOT IN ('CE','CD','PE','PT') OR nacionalidad <> 'CO'
  )
);
CREATE INDEX ix_persona_nombre ON aps.persona (primer_apellido, primer_nombre);


/* =========================================================================
   5. LA VISITA: FICHA (ítems 1-20)
   ========================================================================= */

CREATE TABLE aps.ficha (
  id                    bigserial PRIMARY KEY,
  codigo                text NOT NULL UNIQUE,          -- ítem 15, RN-015
  -- Bloque 1: autorización
  consentimiento        boolean NOT NULL,              -- ítem 1, RN-001
  situacion_inminente   text NOT NULL,                 -- ítem 2, dominio SITUACION_INMINENTE
  -- Bloque 2: geografía y equipo
  departamento_codigo   char(2) NOT NULL REFERENCES cat.departamento(codigo),  -- ítem 3
  municipio_codigo      char(5) NOT NULL REFERENCES cat.municipio(codigo),     -- ítem 5
  uzpe_codigo           text NOT NULL REFERENCES cat.uzpe(codigo),             -- ítem 4
  hogar_id              bigint NOT NULL REFERENCES aps.hogar(id),              -- ítems 6-9, 21-25
  equipo_salud_id       bigint NOT NULL REFERENCES aps.equipo_salud(id),       -- ítem 10
  prestador_codigo      text REFERENCES cat.prestador(codigo),                 -- ítem 11
  responsable_id        bigint NOT NULL REFERENCES aps.funcionario(id),        -- ítems 12-14
  fecha_diligenciamiento date NOT NULL,                                        -- ítem 16
  entorno_abordaje      text NOT NULL,                 -- ítem 17, dominio ENTORNO
  nombre_institucion    text,                          -- ítem 18, condicionado
  lider_entorno         text NOT NULL,                 -- ítem 19
  jovenes_en_paz        boolean NOT NULL,              -- ítem 20
  -- Auditoria y Versionamiento
  fechas_modificacion   jsonb DEFAULT '[]'::jsonb,     -- Arreglo de fechas de modificacion
  -- Ciclo de vida y sincronización
  estado                aps.estado_ficha NOT NULL DEFAULT 'borrador',
  motivo_cierre_incompleto text,                       -- RN-222 excepción de campo
  novedad_urgencia      text,                          -- RN-201.4
  version               int NOT NULL DEFAULT 1,        -- RN-225: correcciones por nueva versión
  ficha_reemplazada_id  bigint REFERENCES aps.ficha(id),
  dispositivo_id        text,                          -- RN-015 / RN-223: unicidad offline
  capturada_en          timestamptz NOT NULL DEFAULT now(),
  cerrada_en            timestamptz,
  sincronizada_en       timestamptz,

  CONSTRAINT ficha_situacion_valida CHECK (cat.es_opcion('SITUACION_INMINENTE', situacion_inminente)),
  CONSTRAINT ficha_entorno_valido   CHECK (cat.es_opcion('ENTORNO', entorno_abordaje)),
  -- RN-005: el municipio debe pertenecer al departamento de la ficha
  CONSTRAINT ficha_divipola_coherente CHECK (municipio_codigo LIKE departamento_codigo || '%'),
  -- RN-016: fecha no futura y no anterior a 30 días — validada por trigger en
  -- 03_reglas.sql por la misma razón de volatilidad que en aps.persona.
  -- RN-018: institución obligatoria en entornos distintos de hogar
  CONSTRAINT ficha_institucion_condicionada CHECK (
    entorno_abordaje = 'hogar' OR nullif(btrim(nombre_institucion),'') IS NOT NULL
  ),
  -- RN-001: sin consentimiento la ficha sólo puede existir como novedad
  CONSTRAINT ficha_sin_consentimiento CHECK (
    consentimiento OR estado = 'rechazada_sin_consentimiento'
  ),
  -- RN-222: el cierre incompleto exige motivo registrado
  CONSTRAINT ficha_motivo_incompleta CHECK (
    estado <> 'incompleta_causa_externa' OR nullif(btrim(motivo_cierre_incompleto),'') IS NOT NULL
  ),
  CONSTRAINT ficha_cierre_fechado CHECK (
    estado NOT IN ('cerrada','sincronizada') OR cerrada_en IS NOT NULL
  )
);
CREATE INDEX ix_ficha_hogar  ON aps.ficha (hogar_id, fecha_diligenciamiento DESC);
CREATE INDEX ix_ficha_equipo ON aps.ficha (equipo_salud_id, fecha_diligenciamiento DESC);
CREATE INDEX ix_ficha_estado ON aps.ficha (estado);


/* =========================================================================
   6. VIVIENDA — caracterización de la visita (ítems 27-49)
   Relación 1:1 con la ficha (RN-000). Los ítems 21-25 de identidad viven en
   aps.hogar porque persisten entre visitas.
   ========================================================================= */

CREATE TABLE aps.vivienda (
  ficha_id              bigint PRIMARY KEY REFERENCES aps.ficha(id) ON DELETE CASCADE,
  -- Bloque 3
  estrato               text NOT NULL,                 -- ítem 27
  hogares_en_vivienda   int  NOT NULL,                 -- ítem 28
  personas_en_vivienda  int  NOT NULL,                 -- ítem 29
  habitaciones_vivienda int  NOT NULL,                 -- ítem 30
  elementos_para_dormir int  NOT NULL,                 -- ítem 31
  personas_por_habitacion numeric(4,1)
    GENERATED ALWAYS AS (round(personas_en_vivienda::numeric / habitaciones_vivienda, 1)) STORED, -- ítem 32, RN-032
  hacinamiento          boolean
    GENERATED ALWAYS AS (personas_en_vivienda::numeric / habitaciones_vivienda > 2) STORED,       -- ítem 33, RN-033
  hacinamiento_critico  boolean
    GENERATED ALWAYS AS (personas_en_vivienda::numeric / habitaciones_vivienda > 3) STORED,       -- RN-033
  tipo_vivienda         text NOT NULL,                 -- ítem 34
  material_techo        text NOT NULL,                 -- ítem 35
  vectores              text NOT NULL,                 -- ítem 37, dominio SI_NO_NA
  -- Bloque 4
  actividad_economica   boolean NOT NULL,              -- ítem 39
  perros                int NOT NULL DEFAULT 0,        -- ítem 41
  perros_vacunados      int NOT NULL DEFAULT 0,        -- ítem 42
  gatos                 int NOT NULL DEFAULT 0,        -- ítem 43
  gatos_vacunados       int NOT NULL DEFAULT 0,        -- ítem 44
  carnet_antirrabico    text NOT NULL,                 -- ítem 45, dominio SI_NO_NA
  fuente_agua           text NOT NULL,                 -- ítem 46
  disposicion_excretas  text NOT NULL,                 -- ítem 47
  aguas_residuales      text NOT NULL,                 -- ítem 48
  residuos_solidos      text NOT NULL,                 -- ítem 49

  CONSTRAINT viv_estrato_valido    CHECK (cat.es_opcion('ESTRATO', estrato)),
  CONSTRAINT viv_tipo_valido       CHECK (cat.es_opcion('TIPO_VIVIENDA', tipo_vivienda)),
  CONSTRAINT viv_techo_valido      CHECK (cat.es_opcion('MATERIAL_TECHO', material_techo)),
  CONSTRAINT viv_vectores_valido   CHECK (cat.es_opcion('SI_NO_NA', vectores)),
  CONSTRAINT viv_carnet_valido     CHECK (cat.es_opcion('SI_NO_NA', carnet_antirrabico)),
  CONSTRAINT viv_agua_valida       CHECK (cat.es_opcion('FUENTE_AGUA', fuente_agua)),
  CONSTRAINT viv_excretas_valida   CHECK (cat.es_opcion('DISPOSICION_EXCRETAS', disposicion_excretas)),
  CONSTRAINT viv_residuales_valida CHECK (cat.es_opcion('AGUAS_RESIDUALES', aguas_residuales)),
  CONSTRAINT viv_residuos_valida   CHECK (cat.es_opcion('RESIDUOS_SOLIDOS', residuos_solidos)),

  CONSTRAINT viv_hogares_min     CHECK (hogares_en_vivienda >= 1),   -- RN-028
  CONSTRAINT viv_personas_min    CHECK (personas_en_vivienda > 0),   -- RN-029
  CONSTRAINT viv_habitaciones_min CHECK (habitaciones_vivienda > 0), -- RN-030
  CONSTRAINT viv_elementos_min   CHECK (elementos_para_dormir >= 0), -- RN-031
  CONSTRAINT viv_animales_no_negativos CHECK (
    perros >= 0 AND gatos >= 0 AND perros_vacunados >= 0 AND gatos_vacunados >= 0
  ),
  -- RN-042 y RN-044: los vacunados nunca superan el total
  CONSTRAINT viv_perros_vacunados_coherente CHECK (perros_vacunados <= perros),
  CONSTRAINT viv_gatos_vacunados_coherente  CHECK (gatos_vacunados  <= gatos),
  -- RN-045: sin caninos ni felinos, el carné se autoasigna "No aplica"
  CONSTRAINT viv_carnet_no_aplica CHECK (
    (perros + gatos) > 0 OR carnet_antirrabico = 'no_aplica'
  )
);
COMMENT ON COLUMN aps.vivienda.personas_por_habitacion IS 'RN-032. Calculado, de sólo lectura. No editable por el encuestador.';
COMMENT ON COLUMN aps.vivienda.hacinamiento IS 'RN-033. Criterio DANE: >2.0 hacinamiento, >3.0 crítico.';

/* Selección múltiple de la vivienda (RN-036, RN-038, RN-040) */
CREATE TABLE aps.vivienda_riesgo_accidente (          -- ítem 36
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vra_valido CHECK (cat.es_opcion('RIESGOS_ACCIDENTE', codigo))
);

CREATE TABLE aps.vivienda_factor_contaminacion (      -- ítem 38
  ficha_id bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo   text NOT NULL,
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT vfc_valido CHECK (cat.es_opcion('FACTORES_CONTAMINACION', codigo))
);

CREATE TABLE aps.vivienda_animal (                    -- ítem 40
  ficha_id  bigint NOT NULL REFERENCES aps.vivienda(ficha_id) ON DELETE CASCADE,
  codigo    text NOT NULL,
  otro_cual text,                                     -- RN-040: "Otro" exige aclaración
  PRIMARY KEY (ficha_id, codigo),
  CONSTRAINT va_valido CHECK (cat.es_opcion('ANIMALES', codigo)),
  CONSTRAINT va_otro_cual CHECK (codigo <> 'otro' OR nullif(btrim(otro_cual),'') IS NOT NULL)
);


/* =========================================================================
   7. FAMILIA — caracterización de la visita (ítems 50-57)
   ========================================================================= */

CREATE TABLE aps.familia_ficha (
  id                     bigserial PRIMARY KEY,
  ficha_id               bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  familia_id             bigint NOT NULL REFERENCES aps.familia(id),
  tipo_familia           text NOT NULL,               -- ítem 50
  numero_integrantes     int  NOT NULL,               -- ítem 51
  cuidador_principal     boolean NOT NULL,            -- ítem 52
  zarit                  text,                        -- ítem 53, condicionado
  redes_apoyo            text NOT NULL,               -- ítem 56
  sin_contacto_telefonico boolean NOT NULL DEFAULT false, -- RN-070: novedad explícita
  clasificacion_riesgo   aps.riesgo_familiar,         -- RN-221, calculado
  riesgo_calculado_en    timestamptz,

  UNIQUE (ficha_id, familia_id),
  CONSTRAINT ff_tipo_valido  CHECK (cat.es_opcion('TIPO_FAMILIA', tipo_familia)),
  CONSTRAINT ff_zarit_valido CHECK (cat.es_opcion('ZARIT', zarit)),
  CONSTRAINT ff_redes_valida CHECK (cat.es_opcion('REDES_APOYO', redes_apoyo)),
  CONSTRAINT ff_integrantes_min CHECK (numero_integrantes > 0),        -- RN-051
  -- RN-053: la escala Zarit se exige si y sólo si hay cuidador principal
  CONSTRAINT ff_zarit_condicionado CHECK (cuidador_principal = (zarit IS NOT NULL))
);
COMMENT ON COLUMN aps.familia_ficha.numero_integrantes IS
  'RN-051. El número de filas en aps.integrante debe ser exactamente igual a este valor para cerrar la ficha.';

CREATE TABLE aps.familia_situacion_riesgo (           -- ítem 54, RN-054
  familia_ficha_id bigint NOT NULL REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  codigo           text NOT NULL,
  PRIMARY KEY (familia_ficha_id, codigo),
  CONSTRAINT fsr_valido CHECK (cat.es_opcion('SITUACIONES_RIESGO_FAMILIAR', codigo))
);

CREATE TABLE aps.familia_practica_vinculo (           -- ítem 55, RN-055
  familia_ficha_id bigint NOT NULL REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  codigo           text NOT NULL,
  PRIMARY KEY (familia_ficha_id, codigo),
  CONSTRAINT fpv_valido CHECK (cat.es_opcion('PRACTICAS_VINCULO', codigo))
);

CREATE TABLE aps.familia_practica_cuidado_hogar (     -- ítem 57, RN-057
  familia_ficha_id bigint NOT NULL REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  codigo           text NOT NULL,
  PRIMARY KEY (familia_ficha_id, codigo),
  CONSTRAINT fpch_valido CHECK (cat.es_opcion('PRACTICAS_CUIDADO_HOGAR', codigo))
);


/* =========================================================================
   8. INTEGRANTE — caracterización individual (ítems 58-110)
   ========================================================================= */

CREATE TABLE aps.integrante (
  id                     bigserial PRIMARY KEY,
  familia_ficha_id       bigint NOT NULL REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  persona_id             bigint NOT NULL REFERENCES aps.persona(id),
  orden                  int NOT NULL,                -- "Integrante 3 de 5" (RN-000)

  -- Bloque 7: identificación (los ítems 58-66 viven en aps.persona)
  genero                 text NOT NULL,               -- ítem 67
  autoidentificacion_genero text NOT NULL,            -- ítem 68
  autoidentificacion_genero_otro text,
  orientacion_sexual     text,                        -- ítem 69 (sensible, RN-224)
  orientacion_sexual_otro text,
  telefono1              text,                        -- ítem 70
  telefono2              text,                        -- ítem 71
  rol_familiar           text NOT NULL,               -- ítem 72

  -- Bloque 8: socioeconómico
  ocupacion_codigo       text REFERENCES cat.ocupacion_ciuo(codigo), -- ítem 73 (≥15 años)
  ocupacion_texto        text,
  nivel_educativo        text,                        -- ítem 74 (≥5 años)
  regimen_afiliacion     text NOT NULL,               -- ítem 75
  eapb_codigo            text REFERENCES cat.eapb(codigo),           -- ítem 76
  pertenencia_etnica     text NOT NULL,               -- ítem 79
  pueblo_etnico          text,                        -- ítem 80, condicionado

  -- Bloque 9: salud
  certificacion_rlcpd    text,                        -- ítem 83, dominio SI_NO_NA
  intencion_reproductiva boolean,                     -- ítem 84
  gestacion_actual       boolean,                     -- ítem 85
  lactancia_exclusiva    text,                        -- ítem 91, dominio SI_NO_NA
  peso                   numeric(5,2),                -- ítem 92 (kg)
  talla                  numeric(5,1),                -- ítem 93 (cm)
  circunferencia_cintura numeric(5,1),                -- ítem 94 (≥18 años)
  imc                    numeric(5,2)
    GENERATED ALWAYS AS (
      CASE WHEN peso IS NOT NULL AND talla IS NOT NULL AND talla > 0
           THEN round(peso / ((talla/100) * (talla/100)), 2) END
    ) STORED,                                          -- ítem 95, RN-095
  clasificacion_antropometrica text,                  -- ítem 96
  tension_sistolica      int,                         -- ítem 98 (≥18 años)
  tension_diastolica     int,
  clasificacion_tension  text,                        -- ítem 99, derivado AHA 2024
  adherencia_tratamiento text,                        -- ítem 103, dominio SI_NO_NA
  consumo_spa            text,                        -- ítem 108, dominio SI_NO_NA
  puntaje_crafft         int,                         -- ítem 109 (14-17 años)
  puntaje_audit          int,                         -- ítem 109 (≥18, alcohol)
  puntaje_assist         int,                         -- ítem 109 (≥18, otras sustancias)
  ideacion_suicida       boolean,                     -- ítem 107 (≥14 años)
  limitacion_cotidiana   boolean NOT NULL,            -- ítem 110

  UNIQUE (familia_ficha_id, persona_id),              -- RN-063: sin duplicados en la familia
  UNIQUE (familia_ficha_id, orden),

  CONSTRAINT int_genero_valido    CHECK (cat.es_opcion('GENERO', genero)),
  CONSTRAINT int_autoid_valida    CHECK (cat.es_opcion('AUTOIDENTIFICACION_GENERO', autoidentificacion_genero)),
  CONSTRAINT int_orientacion_valida CHECK (cat.es_opcion('ORIENTACION_SEXUAL', orientacion_sexual)),
  CONSTRAINT int_rol_valido       CHECK (cat.es_opcion('ROL_FAMILIAR', rol_familiar)),
  CONSTRAINT int_educativo_valido CHECK (cat.es_opcion('NIVEL_EDUCATIVO', nivel_educativo)),
  CONSTRAINT int_regimen_valido   CHECK (cat.es_opcion('REGIMEN_AFILIACION', regimen_afiliacion)),
  CONSTRAINT int_etnia_valida     CHECK (cat.es_opcion('PERTENENCIA_ETNICA', pertenencia_etnica)),
  CONSTRAINT int_antropo_valida   CHECK (cat.es_opcion('CLASIFICACION_ANTROPOMETRICA', clasificacion_antropometrica)),
  CONSTRAINT int_tension_valida   CHECK (cat.es_opcion('CLASIFICACION_TENSION', clasificacion_tension)),
  CONSTRAINT int_rlcpd_valido     CHECK (cat.es_opcion('SI_NO_NA', certificacion_rlcpd)),
  CONSTRAINT int_lactancia_valida CHECK (cat.es_opcion('SI_NO_NA', lactancia_exclusiva)),
  CONSTRAINT int_adherencia_valida CHECK (cat.es_opcion('SI_NO_NA', adherencia_tratamiento)),
  CONSTRAINT int_consumo_valido   CHECK (cat.es_opcion('SI_NO_NA', consumo_spa)),

  -- RN-068 y RN-069: "Otro" exige el campo "¿Cuál?"
  CONSTRAINT int_autoid_otro CHECK (
    autoidentificacion_genero <> 'otro' OR nullif(btrim(autoidentificacion_genero_otro),'') IS NOT NULL
  ),
  CONSTRAINT int_orientacion_otro CHECK (
    orientacion_sexual IS DISTINCT FROM 'otro' OR nullif(btrim(orientacion_sexual_otro),'') IS NOT NULL
  ),
  -- RN-070 y RN-071: formato de teléfono y distinción entre ambos
  CONSTRAINT int_telefono1_formato CHECK (telefono1 IS NULL OR telefono1 ~ '^([0-9]{7}|[0-9]{10})$'),
  CONSTRAINT int_telefono2_formato CHECK (telefono2 IS NULL OR telefono2 ~ '^([0-9]{7}|[0-9]{10})$'),
  CONSTRAINT int_telefonos_distintos CHECK (telefono2 IS NULL OR telefono2 <> telefono1),
  -- RN-076: "No afiliado" inhabilita la EAPB (RN-209.2)
  CONSTRAINT int_eapb_condicionada CHECK (
    (regimen_afiliacion = 'no_afiliado') = (eapb_codigo IS NULL)
  ),
  -- RN-080: el pueblo étnico se exige si la pertenencia es distinta de "Ninguna"
  CONSTRAINT int_pueblo_etnico_condicionado CHECK (
    (pertenencia_etnica = 'ninguna') OR nullif(btrim(pueblo_etnico),'') IS NOT NULL
  ),
  -- RN-092 / RN-093: antropometría positiva
  CONSTRAINT int_peso_positivo  CHECK (peso  IS NULL OR peso  > 0),
  CONSTRAINT int_talla_positiva CHECK (talla IS NULL OR talla > 0),
  CONSTRAINT int_cintura_positiva CHECK (circunferencia_cintura IS NULL OR circunferencia_cintura > 0),
  -- RN-098: la tensión se registra como par
  CONSTRAINT int_tension_par CHECK ((tension_sistolica IS NULL) = (tension_diastolica IS NULL)),
  CONSTRAINT int_tension_rango CHECK (
    tension_sistolica IS NULL OR (tension_sistolica BETWEEN 50 AND 300
                              AND tension_diastolica BETWEEN 30 AND 200
                              AND tension_sistolica > tension_diastolica)
  ),
  -- RN-109: los puntajes sólo existen si hubo consumo declarado
  CONSTRAINT int_puntajes_condicionados CHECK (
    consumo_spa = 'si'
    OR (puntaje_crafft IS NULL AND puntaje_audit IS NULL AND puntaje_assist IS NULL)
  ),
  CONSTRAINT int_puntaje_crafft_rango CHECK (puntaje_crafft IS NULL OR puntaje_crafft BETWEEN 0 AND 6),
  CONSTRAINT int_puntaje_audit_rango  CHECK (puntaje_audit  IS NULL OR puntaje_audit  BETWEEN 0 AND 40),
  CONSTRAINT int_puntaje_assist_rango CHECK (puntaje_assist IS NULL OR puntaje_assist BETWEEN 0 AND 39),
  -- RN-073: ocupación por catálogo CIUO o texto libre, nunca ambos vacíos si aplica
  CONSTRAINT int_ocupacion_unica CHECK (ocupacion_codigo IS NULL OR ocupacion_texto IS NULL)
);
COMMENT ON COLUMN aps.integrante.imc IS 'RN-095. Calculado sobre peso/talla. Exigible en mayores de 5 años.';
COMMENT ON COLUMN aps.integrante.orientacion_sexual IS 'Dato sensible. RN-224.2 y RN-224.6: cifrado en reposo y consulta auditada.';
CREATE INDEX ix_integrante_persona ON aps.integrante (persona_id);

/* --- 8.1 Selecciones múltiples del integrante ---------------------------- */

CREATE TABLE aps.integrante_sujeto_proteccion (       -- ítem 77, RN-077
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  otro_cual     text,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT isp_valido CHECK (cat.es_opcion('SUJETO_ESPECIAL_PROTECCION', codigo)),
  CONSTRAINT isp_otro_cual CHECK (codigo <> 'otro' OR nullif(btrim(otro_cual),'') IS NOT NULL)
);

CREATE TABLE aps.integrante_modalidad_violencia (     -- ítem 78, RN-078 (dato sensible)
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT imv_valido CHECK (cat.es_opcion('MODALIDAD_VIOLENCIA', codigo))
);
COMMENT ON TABLE aps.integrante_modalidad_violencia IS
  'RN-078. La opción "Negligencia y abandono" se registra UNA sola vez pese a la duplicación '
  'del formulario impreso (defecto de diagramación, Anexo C). Visibilidad restringida (RN-224.6).';

CREATE TABLE aps.integrante_saber_ancestral (         -- ítem 81, RN-081
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT isa_valido CHECK (cat.es_opcion('SABERES_ANCESTRALES', codigo))
);

CREATE TABLE aps.integrante_discapacidad (            -- ítem 82, RN-082
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT idis_valido CHECK (cat.es_opcion('DISCAPACIDAD', codigo))
);

CREATE TABLE aps.integrante_practica_cuidado (        -- ítem 86, RN-086
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT ipc_valido CHECK (cat.es_opcion('PRACTICAS_CUIDADO', codigo))
);

CREATE TABLE aps.integrante_atencion_rpms (           -- ítem 87, RN-087
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT iar_valido CHECK (cat.es_opcion('ATENCIONES_RPMS', codigo))
);
COMMENT ON TABLE aps.integrante_atencion_rpms IS
  'RN-087. Sólo se registran atenciones exigibles según edad y sexo (metadata de cat.opcion). '
  'Toda atención pendiente obliga a barrera en ítem 89 y acción en el Plan de Cuidado de la Persona.';

CREATE TABLE aps.integrante_atencion_materno (        -- ítem 88, RN-088
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT iam_valido CHECK (cat.es_opcion('ATENCIONES_MATERNO', codigo))
);

CREATE TABLE aps.integrante_barrera_acceso (          -- ítem 89, RN-089 / RN-210
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  tipo_barrera  text,                                 -- clasificación de RN-210
  radicado_eapb text,                                 -- RN-210: gestión ante EAPB
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT iba_valido CHECK (cat.es_opcion('BARRERAS_ACCESO', codigo)),
  CONSTRAINT iba_tipo_valido CHECK (cat.es_opcion('TIPO_BARRERA', tipo_barrera))
);

CREATE TABLE aps.integrante_conocimiento_derecho (    -- ítem 90, RN-090
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT icd_valido CHECK (cat.es_opcion('CONOCIMIENTO_DERECHO', codigo))
);

CREATE TABLE aps.integrante_signo_desnutricion (      -- ítem 97, RN-097
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT isd_valido CHECK (cat.es_opcion('SIGNOS_DESNUTRICION', codigo))
);
COMMENT ON TABLE aps.integrante_signo_desnutricion IS
  'RN-097 / RN-204. La presencia de cualquier signo en menor de 5 años eleva a INMEDIATA. '
  'El código "edema" es signo de desnutrición aguda severa: remisión hospitalaria inmediata.';

CREATE TABLE aps.integrante_enfermedad_no_transmisible (  -- ítem 100, RN-100
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT ient_valido CHECK (cat.es_opcion('ENFERMEDADES_NO_TRANSMISIBLES', codigo))
);

CREATE TABLE aps.integrante_condicion_transmisible (  -- ítem 101, RN-101 / RN-208
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  es_contacto   boolean NOT NULL DEFAULT false,       -- RN-208: extensión familiar por tuberculosis
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT ict_valido CHECK (cat.es_opcion('CONDICIONES_TRANSMISIBLES', codigo))
);

CREATE TABLE aps.integrante_zona_endemica (           -- ítem 102, RN-102
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT ize_valido CHECK (cat.es_opcion('ZONA_ENDEMICA', codigo))
);

CREATE TABLE aps.integrante_motivo_no_tratamiento (   -- ítem 104, RN-104 / RN-210
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  tipo_barrera  text,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT imnt_valido CHECK (cat.es_opcion('MOTIVO_NO_TRATAMIENTO', codigo)),
  CONSTRAINT imnt_tipo_valido CHECK (cat.es_opcion('TIPO_BARRERA', tipo_barrera))
);

CREATE TABLE aps.integrante_riesgo_salud_mental (     -- ítem 105, RN-105 (14-28 años)
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT irsm_valido CHECK (cat.es_opcion('RIESGOS_SALUD_MENTAL_JOVEN', codigo))
);

CREATE TABLE aps.integrante_sintoma_depresivo (       -- ítem 106, RN-106 / RN-207
  integrante_id bigint NOT NULL REFERENCES aps.integrante(id) ON DELETE CASCADE,
  codigo        text NOT NULL,
  PRIMARY KEY (integrante_id, codigo),
  CONSTRAINT isdep_valido CHECK (cat.es_opcion('SINTOMATOLOGIA_DEPRESIVA', codigo))
);
COMMENT ON TABLE aps.integrante_sintoma_depresivo IS
  'RN-207. Un síntoma = REGULAR, dos o más = PRIORITARIA, concurrente con ideación = INMEDIATA.';


/* =========================================================================
   9. PLAN DE CUIDADO (ítems 111-140)
   Un único árbol para los tres ámbitos. Las llaves heredadas (RN-111/112,
   RN-120/121/122, RN-130/131/132) se materializan como columnas para poder
   auditar la integridad transversal que exige RN-130, y se validan contra
   el origen mediante trigger en 03_reglas.sql.
   ========================================================================= */

CREATE TABLE aps.plan_cuidado (
  id                 bigserial PRIMARY KEY,
  ficha_id           bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  ambito             aps.ambito_plan NOT NULL,
  familia_ficha_id   bigint REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  integrante_id      bigint REFERENCES aps.integrante(id) ON DELETE CASCADE,

  -- Llaves heredadas de sólo lectura
  codigo_ebs         text NOT NULL,     -- ítems 111 / 120 / 130 ← ítem 10
  codigo_vivienda    text NOT NULL,     -- ítems 112 / 121 / 131 ← ítem 25
  codigo_familia     text,              -- ítems 122 / 132       ← ítem 26
  tipo_id_integrante text,              -- ítem 133              ← ítem 62
  numero_id_integrante text,            -- ítem 134              ← ítem 63

  -- RN-000: un plan de vivienda por ficha, uno de familia por familia, uno de persona por integrante
  CONSTRAINT plan_ambito_coherente CHECK (
       (ambito = 'vivienda' AND familia_ficha_id IS NULL AND integrante_id IS NULL
                            AND codigo_familia IS NULL   AND tipo_id_integrante IS NULL)
    OR (ambito = 'familia'  AND familia_ficha_id IS NOT NULL AND integrante_id IS NULL
                            AND codigo_familia IS NOT NULL   AND tipo_id_integrante IS NULL)
    OR (ambito = 'persona'  AND familia_ficha_id IS NOT NULL AND integrante_id IS NOT NULL
                            AND codigo_familia IS NOT NULL
                            AND tipo_id_integrante IS NOT NULL AND numero_id_integrante IS NOT NULL)
  ),
  CONSTRAINT plan_tipo_id_valido CHECK (cat.es_opcion('TIPO_ID_INTEGRANTE', tipo_id_integrante))
);
-- RN-000: cardinalidad exacta por ámbito
CREATE UNIQUE INDEX ux_plan_vivienda ON aps.plan_cuidado (ficha_id)         WHERE ambito = 'vivienda';
CREATE UNIQUE INDEX ux_plan_familia  ON aps.plan_cuidado (familia_ficha_id) WHERE ambito = 'familia';
CREATE UNIQUE INDEX ux_plan_persona  ON aps.plan_cuidado (integrante_id)    WHERE ambito = 'persona';

COMMENT ON TABLE aps.plan_cuidado IS
  'RN-122: cuando la vivienda alberga más de una familia se exige un plan familiar independiente '
  'por cada una. No se admite un plan único que agrupe varios núcleos.';

CREATE TABLE aps.plan_accion (                        -- ítems 113-115 / 123-125 / 135-136
  id             bigserial PRIMARY KEY,
  plan_id        bigint NOT NULL REFERENCES aps.plan_cuidado(id) ON DELETE CASCADE,
  ejecutor_id    bigint NOT NULL REFERENCES aps.funcionario(id),   -- ítems 113 / 123 / 135
  codigo_accion  text NOT NULL REFERENCES cat.cups(codigo),          -- ítems 114 / 124 / 136a
  procedimiento_realizado text,                        -- ítems 114 / 124 / 136a, en palabras
  tipo_respuesta aps.tipo_respuesta NOT NULL,                       -- ítems 115 / 125 / 136b
  institucion_destino text,                            -- si tipo_respuesta = 'derivada'
  fecha_cita     date,                                 -- RN-200: derivación con cita asignada
  registrada_en  timestamptz NOT NULL DEFAULT now(),
  -- RN-220: cuando el EBS considera que el hallazgo no requiere intervención
  no_procede     boolean NOT NULL DEFAULT false,
  justificacion_no_procede text,
  CONSTRAINT accion_no_procede_justificada CHECK (
    NOT no_procede OR nullif(btrim(justificacion_no_procede),'') IS NOT NULL
  ),
  CONSTRAINT accion_derivada_destino CHECK (
    tipo_respuesta <> 'derivada' OR nullif(btrim(institucion_destino),'') IS NOT NULL
  )
);
COMMENT ON COLUMN aps.plan_accion.procedimiento_realizado IS
  'Ítems 114 / 124 / 136a. El código CUPS/NoCUPS nombra el procedimiento dentro de una '
  'codificación cerrada; esta columna deja al profesional describir en sus palabras lo que '
  'efectivamente hizo. Es complemento, no reemplazo: el código sigue siendo obligatorio '
  'porque de él dependen la llave foránea a cat.cups y el cruce alerta ↔ acción de RN-220.';
COMMENT ON COLUMN aps.plan_accion.no_procede IS
  'RN-220. El silencio no es opción válida de cierre. Monitorear su frecuencia en supervisión: '
  'su uso rutinario delata evasión.';

CREATE TABLE aps.plan_seguimiento (                   -- ítems 116-119 / 126-129 / 137-140
  id                bigserial PRIMARY KEY,
  plan_id           bigint NOT NULL REFERENCES aps.plan_cuidado(id) ON DELETE CASCADE,
  responsable_id    bigint NOT NULL REFERENCES aps.funcionario(id),  -- ítems 116 / 126 / 137
  accion_concertada text NOT NULL,                                   -- ítems 117 / 127 / 138
  fecha_concertacion date NOT NULL,
  seg1_fecha        date,                                            -- ítems 118 / 128 / 139
  seg1_estado       aps.estado_seguimiento,
  seg1_motivo_nc    text,                                            -- RN-226.4
  seg2_fecha        date,                                            -- ítems 119 / 129 / 140
  seg2_estado       aps.estado_seguimiento,
  seg2_motivo_nc    text,
  escalado_gestor_eapb boolean NOT NULL DEFAULT false,               -- RN-226.4

  CONSTRAINT seg1_completo CHECK ((seg1_fecha IS NULL) = (seg1_estado IS NULL)),
  CONSTRAINT seg2_completo CHECK ((seg2_fecha IS NULL) = (seg2_estado IS NULL)),
  -- RN-226.2: el segundo seguimiento es cronológicamente posterior al primero
  CONSTRAINT seg2_posterior CHECK (seg2_fecha IS NULL OR (seg1_fecha IS NOT NULL AND seg2_fecha > seg1_fecha)),
  -- RN-226.4: NC obliga a registrar motivo
  CONSTRAINT seg1_nc_motivado CHECK (seg1_estado <> 'NC' OR nullif(btrim(seg1_motivo_nc),'') IS NOT NULL),
  CONSTRAINT seg2_nc_motivado CHECK (seg2_estado <> 'NC' OR nullif(btrim(seg2_motivo_nc),'') IS NOT NULL)
);


/* =========================================================================
   10. ALERTAS Y CANALIZACIÓN (RN-200 a RN-212, RN-220)
   ========================================================================= */

CREATE TABLE aps.alerta (
  id                bigserial PRIMARY KEY,
  ficha_id          bigint NOT NULL REFERENCES aps.ficha(id) ON DELETE CASCADE,
  regla_codigo      text NOT NULL,                    -- RN-201 … RN-212
  ambito            aps.ambito_plan NOT NULL,         -- RN-220: qué plan recibe la acción
  familia_ficha_id  bigint REFERENCES aps.familia_ficha(id) ON DELETE CASCADE,
  integrante_id     bigint REFERENCES aps.integrante(id) ON DELETE CASCADE,
  prioridad         aps.prioridad NOT NULL,           -- RN-200, calculada, no editable a la baja
  prioridad_base    aps.prioridad,                    -- antes de elevaciones por concurrencia
  motivo            text NOT NULL,
  detectada_en      timestamptz NOT NULL DEFAULT now(),
  vence_en          timestamptz NOT NULL,             -- RN-200: momento / 72 h / 30 días
  estado            aps.estado_alerta NOT NULL DEFAULT 'activa',
  bloquea_cierre    boolean NOT NULL DEFAULT false,   -- RN-202 y RN-222.5
  reactivada_de_id  bigint REFERENCES aps.alerta(id), -- RN-226.5

  CONSTRAINT alerta_ambito_coherente CHECK (
       (ambito = 'vivienda' AND familia_ficha_id IS NULL AND integrante_id IS NULL)
    OR (ambito = 'familia'  AND familia_ficha_id IS NOT NULL AND integrante_id IS NULL)
    OR (ambito = 'persona'  AND familia_ficha_id IS NOT NULL AND integrante_id IS NOT NULL)
  )
);
CREATE INDEX ix_alerta_ficha ON aps.alerta (ficha_id, prioridad DESC, estado);
COMMENT ON COLUMN aps.alerta.prioridad IS
  'RN-200. Calculada automáticamente y no editable a la baja. Cuando un individuo acumula '
  'varias alertas prevalece el nivel más alto.';

/* RN-220: el vínculo explícito y auditable entre alerta y acción.
   Responde, para cualquier ficha: ¿qué se hizo frente a este hallazgo? */
CREATE TABLE aps.alerta_accion (
  alerta_id      bigint NOT NULL REFERENCES aps.alerta(id) ON DELETE CASCADE,
  plan_accion_id bigint NOT NULL REFERENCES aps.plan_accion(id) ON DELETE CASCADE,
  vinculada_en   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alerta_id, plan_accion_id)
);

CREATE TABLE aps.notificacion_obligatoria (           -- RN-202.4, RN-204, RN-206.4/5, RN-208
  id            bigserial PRIMARY KEY,
  alerta_id     bigint NOT NULL REFERENCES aps.alerta(id) ON DELETE CASCADE,
  sistema       aps.sistema_notificacion NOT NULL,
  evento        text NOT NULL,
  radicado      text,
  notificada_en timestamptz,
  UNIQUE (alerta_id, sistema, evento)
);
COMMENT ON TABLE aps.notificacion_obligatoria IS
  'RN-223.5: las alertas INMEDIATAS se notifican por el canal más rápido disponible, '
  'sin esperar la sincronización completa de la ficha.';


/* =========================================================================
   11. SINCRONIZACIÓN Y AUDITORÍA (RN-223, RN-224, RN-225)
   ========================================================================= */

CREATE TABLE aps.sincronizacion (                     -- RN-223
  id             bigserial PRIMARY KEY,
  ficha_id       bigint NOT NULL REFERENCES aps.ficha(id),
  dispositivo_id text NOT NULL,
  intento        int NOT NULL DEFAULT 1,
  resultado      aps.resultado_sincronizacion NOT NULL,
  mensaje        text,
  ficha_conservada_id bigint REFERENCES aps.ficha(id),  -- RN-223.4: histórico del conflicto
  ocurrida_en    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aud.evento (                             -- RN-225
  id             bigserial PRIMARY KEY,
  ficha_id       bigint REFERENCES aps.ficha(id),
  entidad        text NOT NULL,
  entidad_id     bigint,
  tipo           aud.tipo_evento NOT NULL,
  campo          text,
  valor_anterior text,
  valor_nuevo    text,
  funcionario_id bigint REFERENCES aps.funcionario(id),
  dispositivo_id text,
  latitud        numeric(9,6),                        -- RN-225: coordenadas al momento de captura
  longitud       numeric(9,6),
  ocurrido_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_aud_evento_ficha ON aud.evento (ficha_id, ocurrido_en);
COMMENT ON TABLE aud.evento IS
  'RN-225. Registro inalterable. Ninguna ficha cerrada y sincronizada puede modificarse ni '
  'eliminarse: las correcciones se hacen por nueva versión conservando el histórico íntegro.';

CREATE TABLE aud.acceso_sensible (                    -- RN-224.2
  id            bigserial PRIMARY KEY,
  ficha_id      bigint REFERENCES aps.ficha(id),
  integrante_id bigint REFERENCES aps.integrante(id),
  funcionario_id bigint NOT NULL REFERENCES aps.funcionario(id),
  grupo_dato    text NOT NULL,   -- salud | orientacion_sexual | identidad_genero | etnia | violencia | salud_mental
  consultado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aud.solicitud_titular (                  -- RN-224.5
  id           bigserial PRIMARY KEY,
  persona_id   bigint NOT NULL REFERENCES aps.persona(id),
  derecho      aud.derecho_titular NOT NULL,
  radicada_en  timestamptz NOT NULL DEFAULT now(),
  atendida_en  timestamptz,
  resultado    text,
  funcionario_id bigint REFERENCES aps.funcionario(id)
);

COMMIT;
