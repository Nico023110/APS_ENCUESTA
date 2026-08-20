/* =========================================================================
   APS APP — CÓDIGOS NoCUPS Y CONDUCTA ESPERADA POR REGLA
   Archivo 5 de 5 — Datos institucionales locales

   RN-114 y RN-220: las acciones se codifican en CUPS cuando corresponden a
   procedimientos del plan de beneficios, y en NoCUPS cuando son acciones
   educativas, de gestión o de salud ambiental sin código CUPS asignado.

   CRITERIO DE CREACIÓN
   Antes de crear cada código se verificó que no existiera ya en los 10.024
   CUPS oficiales. El resultado de esa verificación cambió el alcance previsto:

   El catálogo del Ministerio ya cubre casi toda la acción educativa y de salud
   ambiental, en sus anexos técnicos 5 y 6 —los prefijos I y A—. Existen, entre
   otros, "EDUCACIÓN Y COMUNICACIÓN PARA EL SANEAMIENTO BÁSICO" (I11006),
   "INFORMACIÓN PARA LA SALUD EN PREVENCIÓN EN ACCIDENTES EN EL HOGAR" (I10007),
   "INTERVENCIÓN DE FORMAS INMADURAS DE VECTORES" (I20202) e incluso
   "CARACTERIZACIÓN DEL INDIVIDUO Y SU ENTORNO FAMILIAR" (I30001).

   Crear NoCUPS para esas acciones habría duplicado el catálogo oficial y roto
   la comparabilidad del reporte. Por eso los NoCUPS de este archivo se limitan
   a lo que efectivamente no tiene código: la GESTIÓN ADMINISTRATIVA DEL CASO
   —trámites ante Registraduría, EAPB, ICBF, RLCPD, Secretaría de Educación— y
   la zoonosis veterinaria, que no pertenece al CUPS humano.

   La segunda sección mapea cada regla de decisión con los códigos que la
   resuelven, oficiales o locales. Ese mapeo es lo que permite al sistema
   proponer la conducta en lugar de esperar que el encuestador la recuerde.
   ========================================================================= */

BEGIN;

/* =========================================================================
   1. CÓDIGOS NoCUPS
   Nomenclatura: NC-<ámbito>-<consecutivo>.
     AMB  salud ambiental y entorno de la vivienda
     GES  gestión administrativa del caso
     NOT  notificación obligatoria a autoridad externa
     FAM  intervención sobre el núcleo familiar
     NOP  cierre de hallazgo sin intervención
   ========================================================================= */

INSERT INTO cat.cups (codigo, nombre, tipo, capitulo, apto_aps, ambito, habilitado) VALUES

/* --- Vivienda: salud ambiental y entorno (RN-211) ---------------------- */
('NC-AMB-01', 'Canalización a vacunación antirrábica animal',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-02', 'Gestión ante la empresa prestadora por fuente de agua no apta para consumo humano',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-03', 'Gestión ante el prestador de aseo o la autoridad ambiental por disposición inadecuada de residuos o aguas residuales',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-04', 'Reporte de vivienda con cubierta de asbesto a la autoridad sanitaria ambiental',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-05', 'Gestión de mejora locativa por hacinamiento',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-06', 'Solicitud de control vectorial al programa de enfermedades transmitidas por vectores',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-07', 'Visita de seguimiento por entorno de alto riesgo sanitario',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),
('NC-AMB-08', 'Entrega de elementos para dormir por déficit identificado',
   'NoCUPS', 'Salud ambiental', true, 'vivienda', true),

/* --- Familia (RN-206, RN-212) ------------------------------------------ */
('NC-FAM-01', 'Activación de la ruta de atención integral a víctimas de violencias',
   'NoCUPS', 'Gestión del caso', true, 'familia', true),
('NC-FAM-02', 'Evaluación de relevo del cuidador principal por sobrecarga',
   'NoCUPS', 'Gestión del caso', true, 'familia', true),

/* --- Persona: gestión administrativa del caso -------------------------- */
('NC-GES-01', 'Gestión de afiliación al SGSSS',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-02', 'Canalización a Registraduría por barrera de identificación',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-03', 'Radicación de solicitud ante la EAPB por barrera de acceso',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-04', 'Canalización a la Secretaría de Educación por desescolarización',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-05', 'Canalización al RLCPD para certificación de discapacidad',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-06', 'Asignación de cita con verificación de asistencia',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),
('NC-GES-07', 'Activación de línea de emergencia 123 u organismo de socorro',
   'NoCUPS', 'Gestión del caso', true, 'persona', true),

/* --- Notificación obligatoria a autoridad externa ---------------------- */
('NC-NOT-01', 'Notificación individual a SIVIGILA',
   'NoCUPS', 'Notificación obligatoria', true, 'persona', true),
('NC-NOT-02', 'Reporte al ICBF por presunta vulneración de derechos de menor de edad',
   'NoCUPS', 'Notificación obligatoria', true, 'persona', true),

/* --- Cierre de hallazgo sin intervención (RN-220) ----------------------
   plan_accion.codigo_accion es obligatorio, de modo que registrar un
   "No procede" exige un código con el cual hacerlo. Este es ese código: sin
   él, la única forma de cerrar un hallazgo que no requiere intervención sería
   el silencio, que RN-220 prohíbe expresamente.                          */
('NC-NOP-01', 'Hallazgo evaluado sin requerir intervención',
   'NoCUPS', 'Cierre de hallazgo', true, NULL, true)

ON CONFLICT (codigo) DO UPDATE SET
  nombre   = EXCLUDED.nombre,
  capitulo = EXCLUDED.capitulo,
  apto_aps = EXCLUDED.apto_aps,
  ambito   = EXCLUDED.ambito;


/* =========================================================================
   2. CONDUCTA ESPERADA POR REGLA
   `obligatoria = true` cuando la regla nombra la conducta de forma expresa.
   Los códigos con prefijo I y A son oficiales del Ministerio: se reutilizan
   en lugar de duplicarlos como NoCUPS.
   ========================================================================= */

INSERT INTO cat.accion_sugerida (regla_codigo, codigo_accion, ambito, obligatoria, nota) VALUES

/* RN-201 — Urgencia vital detectada al inicio */
('RN-201', 'NC-GES-07', 'persona', true,  'Activación de línea 123, traslado o notificación a organismo de socorro'),
('RN-201', '601A01',    'persona', false, 'Traslado asistencial básico cuando la urgencia lo requiere'),

/* RN-202 — Riesgo de suicidio. Única regla que bloquea la sincronización */
('RN-202', 'I30105',    'persona', true,  'Primeros auxilios psicológicos durante la visita'),
('RN-202', 'NC-NOT-01', 'persona', true,  'Notificación individual inmediata por ideación o intento suicida'),
('RN-202', 'NC-GES-06', 'persona', true,  'Valoración por psicología o psiquiatría el mismo día'),
('RN-202', 'I10107',    'familia', false, 'Información en salud para la prevención de la conducta suicida'),

/* RN-203 — Crisis hipertensiva y riesgo cardiovascular */
('RN-203', 'NC-GES-06', 'persona', true,  'Consulta médica en 72 horas en hipertensión nivel 2'),
('RN-203', 'I10409',    'persona', false, 'Factores protectores frente a enfermedad cardiovascular'),

/* RN-204 — Desnutrición aguda y riesgo nutricional */
('RN-204', 'NC-GES-06', 'persona', true,  'Valoración médica y nutricional según severidad'),
('RN-204', 'NC-NOT-01', 'persona', true,  'Notificación obligatoria de desnutrición aguda en menores de 5 años'),
('RN-204', 'I10403',    'persona', false, 'Educación en alimentación saludable'),
('RN-204', 'I10413',    'persona', false, 'Alimentación en la primera infancia'),

/* RN-205 — Gestación y ruta materno perinatal */
('RN-205', 'NC-GES-06', 'persona', true,  'Cita de control prenatal con verificación de asistencia'),
('RN-205', 'I10209',    'persona', false, 'Información en salud materna y perinatal'),

/* RN-206 — Violencias */
('RN-206', 'NC-FAM-01', 'familia', true,  'Ruta de atención integral a víctimas, atención en las primeras 72 horas'),
('RN-206', 'NC-NOT-01', 'persona', true,  'Notificación por violencia de género e intrafamiliar'),
('RN-206', 'NC-NOT-02', 'persona', true,  'Reporte al ICBF cuando la víctima es menor de 18 años'),
('RN-206', 'I10202',    'familia', false, 'Prevención de violencias por razones de género y violencias sexuales'),

/* RN-207 — Sintomatología depresiva y ansiosa */
('RN-207', 'NC-GES-06', 'persona', true,  'Valoración por psicología: 30 días con un síntoma, 72 horas con dos o más'),
('RN-207', 'I10101',    'persona', false, 'Información en salud para la promoción de la salud mental'),

/* RN-208 — Enfermedades transmisibles de notificación obligatoria */
('RN-208', 'NC-NOT-01', 'persona', true,  'Notificación del evento de interés en salud pública'),
('RN-208', 'A31004',    'familia', true,  'Estudio de contactos del hogar, obligatorio en tuberculosis'),
('RN-208', 'NC-AMB-06', 'vivienda', true, 'Control vectorial ante dengue, Zika o chikunguña con criaderos en el ítem 37'),
('RN-208', 'I10301',    'familia', false, 'Prevención de enfermedades transmitidas por vía aérea y contacto directo'),
('RN-208', 'I10304',    'vivienda', false,'Factores protectores hacia el control de enfermedades por vectores'),

/* RN-209 — Ausencia de afiliación al SGSSS */
('RN-209', 'NC-GES-01', 'persona', true,  'Gestión de afiliación con verificación en el primer seguimiento'),
('RN-209', 'NC-GES-02', 'persona', true,  'Canalización previa a Registraduría cuando el documento es MS o AS'),

/* RN-210 — Barreras de acceso efectivo */
('RN-210', 'NC-GES-03', 'persona', true,  'Gestión ante EAPB con número de radicado en barrera administrativa'),
('RN-210', '890101',    'persona', false, 'Atención domiciliaria en barrera del cuidador o dependencia'),
('RN-210', 'I10604',    'persona', false, 'Ejercicio del derecho a la salud en barrera de información'),
('RN-210', 'I10606',    'persona', false, 'Mecanismos de exigibilidad del derecho a la salud'),

/* RN-211 — Riesgo del entorno y la vivienda */
('RN-211', 'NC-AMB-02', 'vivienda', true, 'Agua no apta para consumo humano'),
('RN-211', 'NC-AMB-03', 'vivienda', true, 'Excretas, aguas residuales o residuos con disposición inadecuada'),
('RN-211', 'NC-AMB-04', 'vivienda', true, 'Cubierta de asbesto'),
('RN-211', 'NC-AMB-05', 'vivienda', true, 'Hacinamiento con riesgo de transmisión respiratoria'),
('RN-211', 'NC-AMB-07', 'vivienda', true, 'Tres o más hallazgos concurrentes: seguimiento obligatorio en 30 días'),
('RN-211', 'NC-AMB-08', 'vivienda', false,'Déficit de elementos para dormir'),
('RN-211', 'I11006',    'vivienda', false,'Educación y comunicación para el saneamiento básico'),
('RN-211', 'I11003',    'vivienda', false,'Educación sobre agua apta para consumo humano'),
('RN-211', 'I10007',    'vivienda', false,'Prevención de accidentes en el hogar con menores de 5 o mayores de 70'),

/* RN-042 / RN-044 / RN-045 — Rabia por animal no inmunizado */
('RN-042', 'NC-AMB-01', 'vivienda', true, 'Canalización a vacunación antirrábica animal'),
('RN-042', 'I10305',    'vivienda', false,'Factores protectores hacia el control de zoonosis'),

/* RN-212 — Sobrecarga del cuidador y dependencia */
('RN-212', 'NC-FAM-02', 'familia', true,  'Evaluación de relevo del cuidado en sobrecarga intensa'),
('RN-212', 'I30002',    'familia', false, 'Sesión de grupo de apoyo'),
('RN-212', 'I30006',    'familia', false, 'Acompañamiento a la familia en los diferentes entornos'),

/* RN-056 — Ausencia de redes de apoyo */
('RN-056', 'I30004',    'familia', false, 'Vinculación a otras redes de apoyo'),

/* RN-063 — Barrera de identificación */
('RN-063', 'NC-GES-02', 'persona', true,  'Canalización a Registraduría, condición previa para la afiliación'),

/* RN-074 — Desescolarización */
('RN-074', 'NC-GES-04', 'persona', true,  'Canalización a la Secretaría de Educación entre 5 y 17 años'),

/* RN-083 — Barrera de certificación de discapacidad */
('RN-083', 'NC-GES-05', 'persona', true,  'Canalización al RLCPD'),

/* RN-091 — Lactancia materna exclusiva */
('RN-091', 'I10605',    'persona', false, 'Promoción de la lactancia materna en menores de 6 meses'),

/* RN-109 — Consumo problemático de sustancias psicoactivas */
('RN-109', 'NC-GES-06', 'persona', true,  'Derivación a valoración por salud mental al superar el umbral'),
('RN-109', 'I11105',    'persona', false, 'Reducción de riesgos y daños por consumo de sustancias psicoactivas'),

/* RN-220 — Cierre de hallazgo sin intervención */
('RN-220', 'NC-NOP-01', 'persona', false, 'Exige justificación escrita. Monitorear su frecuencia en supervisión')

ON CONFLICT (regla_codigo, codigo_accion) DO UPDATE SET
  ambito      = EXCLUDED.ambito,
  obligatoria = EXCLUDED.obligatoria,
  nota        = EXCLUDED.nota;


/* =========================================================================
   3. Los CUPS oficiales que las reglas invocan quedan aptos para campo
   Resuelve parcialmente la marca de apto_aps: un código que alguna regla
   nombra es, por definición, seleccionable en una visita domiciliaria.
   ========================================================================= */

UPDATE cat.cups c SET apto_aps = true
  FROM cat.accion_sugerida s
 WHERE s.codigo_accion = c.codigo
   AND NOT c.apto_aps;

/* --- Consulta de apoyo: qué acción propone el sistema ante una alerta --- */
CREATE OR REPLACE VIEW aps.v_conducta_esperada AS
SELECT a.id            AS alerta_id,
       a.ficha_id,
       a.regla_codigo,
       a.prioridad,
       a.estado,
       s.codigo_accion,
       c.nombre        AS accion,
       c.tipo,
       s.ambito,
       s.obligatoria,
       s.nota,
       EXISTS (SELECT 1
                 FROM aps.alerta_accion aa
                 JOIN aps.plan_accion pa ON pa.id = aa.plan_accion_id
                WHERE aa.alerta_id = a.id AND pa.codigo_accion = s.codigo_accion) AS registrada
  FROM aps.alerta a
  JOIN cat.accion_sugerida s ON s.regla_codigo = a.regla_codigo
  JOIN cat.cups c            ON c.codigo = s.codigo_accion;

COMMENT ON VIEW aps.v_conducta_esperada IS
  'RN-220. Para cada alerta activa muestra la conducta que la regla espera y si ya fue '
  'registrada. Consultar con obligatoria AND NOT registrada para el pendiente real.';

COMMIT;
