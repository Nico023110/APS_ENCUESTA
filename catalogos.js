/* =========================================================
   Encuesta_APS — Catálogos y listas parametrizadas
   ---------------------------------------------------------
   Fuente única de verdad para las opciones cerradas exigidas
   por las reglas de negocio. Los <select> y grupos de casillas
   del formulario se construyen a partir de estos catálogos.
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   RN-005 — Entidad territorial fija del proyecto
   --------------------------------------------------------- */
const CAT_DEPARTAMENTO = { codigo: '76', nombre: 'Valle del Cauca' };
const CAT_MUNICIPIO = { codigo: '76001', nombre: 'Santiago de Cali' };

/* ---------------------------------------------------------
   RN-006 — Área de ubicación de la vivienda
   --------------------------------------------------------- */
const CAT_AREA_UBICACION = [
  { valor: 'urbana', etiqueta: 'Área Urbana' },
  { valor: 'rural', etiqueta: 'Área rural' },
  { valor: 'centro_poblado', etiqueta: 'Centro poblado' }
];

/* ---------------------------------------------------------
   RN-009 — Territorios y microterritorios de Santiago de Cali
   Cada territorio (T48…T84) agrupa 4 microterritorios (MT01…MT04)
   con la comuna a la que pertenecen.
   --------------------------------------------------------- */
const CAT_TERRITORIOS = {
  T48: [
    { codigo: 'MT01', nombre: 'San Cayetano', comuna: '3' },
    { codigo: 'MT02', nombre: 'Libertadores', comuna: '3' },
    { codigo: 'MT03', nombre: 'Nacional', comuna: '3' },
    { codigo: 'MT04', nombre: 'La Chanca', comuna: '3' }
  ],
  T49: [
    { codigo: 'MT01', nombre: 'Terrón Cabecera', comuna: '1' },
    { codigo: 'MT02', nombre: 'Malvinas', comuna: '1' },
    { codigo: 'MT03', nombre: 'Portada', comuna: '1' },
    { codigo: 'MT04', nombre: 'Palermo', comuna: '1' }
  ],
  T50: [
    { codigo: 'MT01', nombre: 'Legua', comuna: '1.1' },
    { codigo: 'MT02', nombre: 'Vista Hermosa', comuna: '1.1' },
    { codigo: 'MT03', nombre: 'Patio Bonito', comuna: '1.1' },
    { codigo: 'MT04', nombre: 'Aguacatal', comuna: '1.1' }
  ],
  T51: [
    { codigo: 'MT01', nombre: 'Los Comedores', comuna: '18' },
    { codigo: 'MT02', nombre: 'Cuatro Esquinas', comuna: '18' },
    { codigo: 'MT03', nombre: 'La Esperanza', comuna: '18' },
    { codigo: 'MT04', nombre: 'Cesoles', comuna: '18' }
  ],
  T52: [
    { codigo: 'MT01', nombre: 'Oasis', comuna: '18.1' },
    { codigo: 'MT02', nombre: 'Las Minas', comuna: '18.1' },
    { codigo: 'MT03', nombre: 'La Cañada', comuna: '18.1' },
    { codigo: 'MT04', nombre: 'La Piedra Brisas de la Chorrera', comuna: '18.1' }
  ],
  T53: [
    { codigo: 'MT01', nombre: 'Belèn', comuna: '20' },
    { codigo: 'MT02', nombre: 'Corea', comuna: '20' },
    { codigo: 'MT03', nombre: 'Siloé', comuna: '20' },
    { codigo: 'MT04', nombre: 'Quebrada Isabel Pérez', comuna: '20' }
  ],
  T54: [
    { codigo: 'MT01', nombre: 'Cortijo', comuna: '20.1' },
    { codigo: 'MT02', nombre: 'Lleras Camargo', comuna: '20.1' },
    { codigo: 'MT03', nombre: 'Brisas de Mayo', comuna: '20.1' },
    { codigo: 'MT04', nombre: 'Pueblo Joven', comuna: '20.1' }
  ],
  T55: [
    { codigo: 'MT01', nombre: 'Brisas de Montebello', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Montecitos', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Arrayanes', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'La Piscina', comuna: 'Rural' }
  ],
  T56: [
    { codigo: 'MT01', nombre: 'Colinas', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Centro Puesto de Salud', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Hora Cero', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Las Guacas 107', comuna: 'Rural' }
  ],
  T57: [
    { codigo: 'MT01', nombre: 'Campo Alegre Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Campo Alegre Berlyn', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Centro sector 4 y 5', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Estadero Mi Rey', comuna: 'Rural' }
  ],
  T58: [
    { codigo: 'MT01', nombre: 'Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Normandía los Mangos', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Normandía las Minas', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'El Filo', comuna: 'Rural' }
  ],
  T59: [
    { codigo: 'MT01', nombre: 'La María', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'La Fragua', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Entre Ríos', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'San Isidro', comuna: 'Rural' }
  ],
  T60: [
    { codigo: 'MT01', nombre: 'Cabecera Alta', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Vergel', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Lomitas', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Villa del Rosario', comuna: 'Rural' }
  ],
  T61: [
    { codigo: 'MT01', nombre: 'Cabecera Baja', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Vista Hermosa', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'La Virgen', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Tres Cruces', comuna: 'Rural' }
  ],
  T62: [
    { codigo: 'MT01', nombre: 'Las Palmas', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Las Brisas', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Las Victorias', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Las Granjas', comuna: 'Rural' }
  ],
  T63: [
    { codigo: 'MT01', nombre: 'Montañitas parte Alta', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'El Filo', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Los Limones', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Montañitas parte Baja', comuna: 'Rural' }
  ],
  T64: [
    { codigo: 'MT01', nombre: 'Laureles', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Alto Aguacatal Cabecera', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'El Silencio', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Alto Aguacatal', comuna: 'Rural' }
  ],
  T65: [
    { codigo: 'MT01', nombre: 'Kilómetro 18', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'San Miguel Alto', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'San Miguel Bajo', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Las Peñas', comuna: 'Rural' }
  ],
  T66: [
    { codigo: 'MT01', nombre: 'Cerezo', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Palomar', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'San Miguel', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Las Nieves Altas', comuna: 'Rural' }
  ],
  T67: [
    { codigo: 'MT01', nombre: 'San Pablo', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'San Antonio', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Las Nieves Bajas', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Cabecera', comuna: 'Rural' }
  ],
  T68: [
    { codigo: 'MT01', nombre: 'La Esperanza', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'La Ascensión', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'El Diamante', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'La Soledad', comuna: 'Rural' }
  ],
  T69: [
    { codigo: 'MT01', nombre: 'Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Las Nieves', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Santa Elena Baja', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Santa Elena Alta', comuna: 'Rural' }
  ],
  T70: [
    { codigo: 'MT01', nombre: 'Paujil parte Baja', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Paujil parte Alta', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Cabecera', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'El Bosque', comuna: 'Rural' }
  ],
  T71: [
    { codigo: 'MT01', nombre: 'El Porvenir', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'La Vega', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Fincas los Sierra', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'El Pato', comuna: 'Rural' }
  ],
  T72: [
    { codigo: 'MT01', nombre: 'Loma de la Cajita', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'El Castillo', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'La Esmeralda', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Cabecera', comuna: 'Rural' }
  ],
  T73: [
    { codigo: 'MT01', nombre: 'Peñas', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Plan de Vivienda', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Casa Blanca', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Cabecera Baja Andes', comuna: 'Rural' }
  ],
  T74: [
    { codigo: 'MT01', nombre: 'Cabecera Alta', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Yanaconas', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'La Emisora', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Atenas', comuna: 'Rural' }
  ],
  T75: [
    { codigo: 'MT01', nombre: 'Los Cristales', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Pueblo Nuevo', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Quebrada Honda', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'La Reforma', comuna: 'Rural' }
  ],
  T76: [
    { codigo: 'MT01', nombre: 'Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'El Otoño', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Sirena - Sector Arrayanes', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Sirena Santa Barbara', comuna: 'Rural' }
  ],
  T77: [
    { codigo: 'MT01', nombre: 'El Crucero Sector Alto', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'El Crucero Sector Bajo', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'El Rosario parte Alta', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'El Rosario parte Baja', comuna: 'Rural' }
  ],
  T78: [
    { codigo: 'MT01', nombre: 'Cabecera parte Baja', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Cabecera Sector Oasis', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Cabecera sector Areneros', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Cabecera', comuna: 'Rural' }
  ],
  T79: [
    { codigo: 'MT01', nombre: 'Cascajal Sector Guayacal', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Cascajal Sector Flamenco', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Cauca Viejo', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Cascajal Cabecera', comuna: 'Rural' }
  ],
  T80: [
    { codigo: 'MT01', nombre: 'La Pailita 1', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Morgan', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'La Pailita 2', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Morgan parte Alta', comuna: 'Rural' }
  ],
  T81: [
    { codigo: 'MT01', nombre: 'Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'El Carmen', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Sector Edén Alto', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Sector Edén Bajo', comuna: 'Rural' }
  ],
  T82: [
    { codigo: 'MT01', nombre: 'Fonda', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'Fonda Sector la Rochela', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Fonda Sector Bocatoma', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Dosquebradas', comuna: 'Rural' }
  ],
  T83: [
    { codigo: 'MT01', nombre: 'La Cabecera', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'San Francisco', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'Alto San Pablo', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Pico de Águila', comuna: 'Rural' }
  ],
  T84: [
    { codigo: 'MT01', nombre: 'San Pablo', comuna: 'Rural' },
    { codigo: 'MT02', nombre: 'La Vorágine', comuna: 'Rural' },
    { codigo: 'MT03', nombre: 'El Porvenir', comuna: 'Rural' },
    { codigo: 'MT04', nombre: 'Peón', comuna: 'Rural' }
  ]
};

// La comuna es homogénea dentro de cada territorio: se toma del primer microterritorio.
function comunaDeTerritorio(codigoTerritorio) {
  const microterritorios = CAT_TERRITORIOS[codigoTerritorio];
  return microterritorios && microterritorios.length ? microterritorios[0].comuna : null;
}

function etiquetaTerritorio(codigoTerritorio) {
  const comuna = comunaDeTerritorio(codigoTerritorio);
  if (!comuna) return codigoTerritorio;
  return codigoTerritorio + ' · ' + (comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna);
}

function buscarMicroterritorio(codigoTerritorio, codigoMicroterritorio) {
  const microterritorios = CAT_TERRITORIOS[codigoTerritorio] || [];
  return microterritorios.find(function (mt) { return mt.codigo === codigoMicroterritorio; }) || null;
}

/* ---------------------------------------------------------
   RN-012 — Tipo de identificación del responsable
   --------------------------------------------------------- */
const CAT_TIPO_ID_RESPONSABLE = [
  { valor: 'CC', etiqueta: 'CC. Cédula de Ciudadanía' },
  { valor: 'CD', etiqueta: 'CD. Carné Diplomático' },
  { valor: 'CE', etiqueta: 'CE. Cédula de Extranjería' },
  { valor: 'PT', etiqueta: 'PT. Permiso por Protección Temporal' }
];

/* ---------------------------------------------------------
   RN-014 — Perfil profesional del responsable
   --------------------------------------------------------- */
const CAT_PERFIL_PROFESIONAL = [
  { valor: 'medicina', etiqueta: 'Medicina' },
  { valor: 'enfermeria', etiqueta: 'Enfermería (profesional)' },
  { valor: 'auxiliar_enfermeria', etiqueta: 'Auxiliar de enfermería' },
  { valor: 'psicologia', etiqueta: 'Psicología' },
  { valor: 'trabajo_social', etiqueta: 'Trabajo social' },
  { valor: 'odontologia', etiqueta: 'Odontología' },
  { valor: 'nutricion', etiqueta: 'Nutrición y dietética' },
  { valor: 'fisioterapia', etiqueta: 'Fisioterapia' },
  { valor: 'terapia_ocupacional', etiqueta: 'Terapia ocupacional' },
  { valor: 'gestor_comunitario', etiqueta: 'Gestor / Promotor comunitario en salud' },
  { valor: 'tecnico_saneamiento', etiqueta: 'Técnico en salud pública / saneamiento ambiental' },
  { valor: 'otro', etiqueta: 'Otro' }
];

/* ---------------------------------------------------------
   RN-017 / RN-018 — Entorno de identificación
   --------------------------------------------------------- */
const CAT_ENTORNO = [
  { valor: 'hogar', etiqueta: 'Hogar' },
  { valor: 'comunitario', etiqueta: 'Comunitario' },
  { valor: 'institucional', etiqueta: 'Institucional' },
  { valor: 'educativo', etiqueta: 'Educativo' },
  { valor: 'laboral', etiqueta: 'Laboral' }
];

// RN-018: el nombre de la institución es obligatorio en todos los entornos salvo Hogar.
const ENTORNOS_CON_INSTITUCION = ['comunitario', 'institucional', 'educativo', 'laboral'];

/* ---------------------------------------------------------
   RN-020 / RN-037 — Opciones binarias y ternarias
   --------------------------------------------------------- */
const CAT_SI_NO = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' }
];

const CAT_SI_NO_NA = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
  { valor: 'no_aplica', etiqueta: 'No aplica' }
];

/* ---------------------------------------------------------
   RN-002 — Situaciones inminentes
   --------------------------------------------------------- */
const CAT_SITUACION_INMINENTE = [
  { valor: 'fisica', etiqueta: 'Física (urgencia vital)', prioritaria: true },
  { valor: 'psicologica', etiqueta: 'Psicológica (urgencia vital en salud mental)', prioritaria: true },
  { valor: 'emergencia', etiqueta: 'Situación de emergencia o desastre', prioritaria: true },
  { valor: 'no_aplica', etiqueta: 'No aplica', prioritaria: false }
];

/* ---------------------------------------------------------
   RN-027 — Estrato socioeconómico
   --------------------------------------------------------- */
const CAT_ESTRATO = [
  { valor: 'bajo_bajo', etiqueta: 'Bajo - Bajo' },
  { valor: 'bajo', etiqueta: 'Bajo' },
  { valor: 'medio_bajo', etiqueta: 'Medio - Bajo' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'medio_alto', etiqueta: 'Medio - Alto' },
  { valor: 'alto', etiqueta: 'Alto' }
];

/* ---------------------------------------------------------
   RN-034 — Tipo de vivienda
   --------------------------------------------------------- */
const CAT_TIPO_VIVIENDA = [
  { valor: 'casa', etiqueta: 'Casa' },
  { valor: 'apartamento', etiqueta: 'Apartamento' },
  { valor: 'cuarto', etiqueta: 'Tipo "Cuarto"' },
  { valor: 'tradicional_indigena', etiqueta: 'Vivienda tradicional Indígena' },
  { valor: 'carpa', etiqueta: 'Carpa' },
  { valor: 'tradicional_etnica', etiqueta: 'Vivienda tradicional étnica' },
  { valor: 'contenedor', etiqueta: 'Contenedor' },
  { valor: 'embarcacion', etiqueta: 'Embarcación' },
  { valor: 'vagon', etiqueta: 'Vagón' },
  { valor: 'refugio_natural', etiqueta: 'Refugio Natural' },
  { valor: 'cueva', etiqueta: 'Cueva' },
  { valor: 'puente', etiqueta: 'Puente' }
];

/* ---------------------------------------------------------
   RN-035 — Material predominante del techo
   --------------------------------------------------------- */
const CAT_MATERIAL_TECHO = [
  { valor: 'concreto', etiqueta: 'Concreto' },
  { valor: 'tejas_barro', etiqueta: 'Tejas de barro' },
  { valor: 'fibrocemento_sin_asbesto', etiqueta: 'Fibrocemento sin asbesto' },
  { valor: 'zinc', etiqueta: 'Zinc' },
  { valor: 'plastico', etiqueta: 'Plástico' },
  { valor: 'fibrocemento_con_asbesto', etiqueta: 'Teja o lámina de fibrocemento con asbesto' },
  { valor: 'palma_paja', etiqueta: 'Palma o paja' },
  { valor: 'desechos', etiqueta: 'Desechos (cartón, lata, etc.)' }
];

/* ---------------------------------------------------------
   RN-036 — Escenarios de riesgo de accidente en la vivienda
   Selección múltiple con "ninguno" como opción de exclusión.
   --------------------------------------------------------- */
const VALOR_NINGUNO = 'ninguno';

const CAT_RIESGOS_ACCIDENTE = [
  { valor: 'objetos_cortopunzantes', etiqueta: 'Objetos cortantes o punzantes al alcance de los niños' },
  { valor: 'sustancias_quimicas', etiqueta: 'Sustancias químicas al alcance de los niños y/o reenvasadas en envases de alimentos o bebidas' },
  { valor: 'medicamentos', etiqueta: 'Medicamentos al alcance de los niños' },
  { valor: 'velas_encendidas', etiqueta: 'Velas, velones, incienso encendidos en la vivienda' },
  { valor: 'conexiones_electricas', etiqueta: 'Conexiones eléctricas en mal estado o sobrecargadas' },
  { valor: 'objetos_pequenos', etiqueta: 'Botones, canicas entre otros objetos pequeños o con piezas que puedan desmontarse, al alcance de los niños' },
  { valor: 'pasillos_obstruidos', etiqueta: 'Pasillos obstruidos con juguetes, sillas u otros objetos' },
  { valor: 'superficies_resbaladizas', etiqueta: 'Superficies resbaladizas, suelos con agua, grasas, aceites, entre otros' },
  { valor: 'tanques_sin_tapa', etiqueta: 'Tanques o recipientes de almacenamiento de agua sin tapa' },
  { valor: 'escaleras_sin_proteccion', etiqueta: 'Escaleras sin protección' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true }
];

/* ---------------------------------------------------------
   RN-038 — Factores de contaminación y entorno peridomiciliario
   --------------------------------------------------------- */
const CAT_FACTORES_CONTAMINACION = [
  { valor: 'cultivos', etiqueta: 'Cultivos' },
  { valor: 'apriscos', etiqueta: 'Apriscos' },
  { valor: 'porquerizas', etiqueta: 'Porquerizas' },
  { valor: 'galpones', etiqueta: 'Galpones' },
  { valor: 'terrenos_baldios', etiqueta: 'Terrenos baldíos' },
  { valor: 'plagas', etiqueta: 'Presencia de Plagas: roedores, cucarachas, zancudos, moscas, etc.' },
  { valor: 'malos_olores', etiqueta: 'Malos olores' },
  { valor: 'ruido', etiqueta: 'Ruido o sonidos desagradables' },
  { valor: 'excretas_satelite', etiqueta: 'Sitios satélites de disposición de excretas' },
  { valor: 'rellenos_botaderos', etiqueta: 'Rellenos sanitarios / botaderos' },
  { valor: 'contaminacion_visual', etiqueta: 'Contaminación visual' },
  { valor: 'rio_quebrada', etiqueta: 'Río o quebrada' },
  { valor: 'ptar', etiqueta: 'Planta de tratamiento de agua residual' },
  { valor: 'extraccion_minera', etiqueta: 'Extracción minera' },
  { valor: 'industrias_contaminantes', etiqueta: 'Industrias contaminantes (del sector energético, minero, transporte, construcción, manufacturera, entre otros)' },
  { valor: 'canales_agua_lluvia', etiqueta: 'Canales de agua lluvia' },
  { valor: 'trafico_vehicular', etiqueta: 'Vías de alto tráfico vehicular' },
  { valor: 'quemas_cielo_abierto', etiqueta: 'Quemas a cielo abierto' },
  { valor: 'alta_tension', etiqueta: 'Fuentes de energía eléctrica de alta tensión' },
  { valor: 'agroquimicos', etiqueta: 'Aspersión o almacenamiento de agroquímicos u otras sustancias químicas' },
  { valor: 'asbesto', etiqueta: 'Industrias de construcción, demolición, talleres u otros que usen o dispongan de material de asbesto' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true }
];

/* =========================================================
   RN-021 — NOMENCLATURA DE DIRECCIÓN
   Catálogos para descomponer el ítem 21 en sus partes
   normalizables. Abreviaturas según la convención catastral
   colombiana (IGAC / DANE).
   ========================================================= */

/* Tipo de vía principal — direcciones urbanas */
const CAT_TIPO_VIA = [
  { valor: 'CL', etiqueta: 'Calle (CL)' },
  { valor: 'KR', etiqueta: 'Carrera (KR)' },
  { valor: 'AV', etiqueta: 'Avenida (AV)' },
  { valor: 'AC', etiqueta: 'Avenida Calle (AC)' },
  { valor: 'AK', etiqueta: 'Avenida Carrera (AK)' },
  { valor: 'DG', etiqueta: 'Diagonal (DG)' },
  { valor: 'TV', etiqueta: 'Transversal (TV)' },
  { valor: 'CQ', etiqueta: 'Circular (CQ)' },
  { valor: 'CV', etiqueta: 'Circunvalar (CV)' },
  { valor: 'AU', etiqueta: 'Autopista (AU)' },
  { valor: 'PJ', etiqueta: 'Pasaje (PJ)' },
  { valor: 'PT', etiqueta: 'Peatonal (PT)' },
  { valor: 'VR', etiqueta: 'Variante (VR)' },
  { valor: 'MZ', etiqueta: 'Manzana (MZ)' }
];

/* Letras de nomenclatura (A…Z) */
const CAT_LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (letra) {
  return { valor: letra, etiqueta: letra };
});

/* Cuadrante o sufijo cardinal */
const CAT_CUADRANTE = [
  { valor: 'N', etiqueta: 'Norte (N)' },
  { valor: 'S', etiqueta: 'Sur (S)' },
  { valor: 'E', etiqueta: 'Este (E)' },
  { valor: 'O', etiqueta: 'Oeste (O)' }
];

/* Complementos de dirección (unidad, apartamento, torre, etc.) */
const CAT_COMPLEMENTO = [
  { valor: 'AP', etiqueta: 'Apartamento (AP)' },
  { valor: 'CA', etiqueta: 'Casa (CA)' },
  { valor: 'TO', etiqueta: 'Torre (TO)' },
  { valor: 'BL', etiqueta: 'Bloque (BL)' },
  { valor: 'IN', etiqueta: 'Interior (IN)' },
  { valor: 'ED', etiqueta: 'Edificio (ED)' },
  { valor: 'CO', etiqueta: 'Conjunto / Unidad residencial (CO)' },
  { valor: 'ET', etiqueta: 'Etapa (ET)' },
  { valor: 'MZ', etiqueta: 'Manzana (MZ)' },
  { valor: 'LT', etiqueta: 'Lote (LT)' },
  { valor: 'PI', etiqueta: 'Piso (PI)' },
  { valor: 'HB', etiqueta: 'Habitación (HB)' },
  { valor: 'OF', etiqueta: 'Oficina (OF)' },
  { valor: 'LC', etiqueta: 'Local (LC)' },
  { valor: 'BG', etiqueta: 'Bodega (BG)' },
  { valor: 'GJ', etiqueta: 'Garaje (GJ)' },
  { valor: 'PQ', etiqueta: 'Portería (PQ)' }
];

/* Tipo de vía rural — corregimientos, veredas y centros poblados */
const CAT_TIPO_VIA_RURAL = [
  { valor: 'VIA', etiqueta: 'Vía' },
  { valor: 'CARRETERA', etiqueta: 'Carretera' },
  { valor: 'CAMINO', etiqueta: 'Camino / Trocha' },
  { valor: 'ENTRADA', etiqueta: 'Entrada' },
  { valor: 'SECTOR', etiqueta: 'Sector' },
  { valor: 'SN', etiqueta: 'Sin nomenclatura vial' }
];

/* Tipo de predio rural */
const CAT_TIPO_PREDIO_RURAL = [
  { valor: 'FINCA', etiqueta: 'Finca' },
  { valor: 'PARCELA', etiqueta: 'Parcela' },
  { valor: 'PREDIO', etiqueta: 'Predio' },
  { valor: 'HACIENDA', etiqueta: 'Hacienda' },
  { valor: 'GRANJA', etiqueta: 'Granja' },
  { valor: 'CASA', etiqueta: 'Casa / Vivienda' },
  { valor: 'KIOSCO', etiqueta: 'Kiosco / Cambuche' }
];

/* Modos de nomenclatura disponibles (ítem 21) */
const CAT_MODO_DIRECCION = [
  { valor: 'urbana', etiqueta: 'Urbana (nomenclatura vial)' },
  { valor: 'rural', etiqueta: 'Rural (vía, kilómetro y predio)' }
];

/* El modo se preselecciona a partir del ítem 6 (área de ubicación) */
const MODO_DIRECCION_POR_AREA = {
  urbana: 'urbana',
  centro_poblado: 'urbana',
  rural: 'rural'
};

/* RN-022 / RN-023 — Recuadro geográfico del municipio de Santiago de Cali.
   Advierte (no bloquea) coordenadas fuera del territorio. Cubre la zona urbana
   y los 15 corregimientos: laderas occidentales (Km 18, El Saladito, Felidia,
   Pichindé), norte (Montebello, Golondrinas, La Paz), sur (Pance, La Buitrera)
   y oriente sobre el río Cauca (Navarro, Cascajal).
   Es un parámetro de configuración: puede ajustarse sin tocar las reglas. */
const BBOX_CALI = { latMin: 3.24, latMax: 3.56, lonMin: -76.78, lonMax: -76.40 };

/* ---------------------------------------------------------
   Utilidad de lectura: valor -> etiqueta
   --------------------------------------------------------- */
function etiquetaDeCatalogo(catalogo, valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const opcion = catalogo.find(function (item) { return item.valor === valor; });
  return opcion ? opcion.etiqueta : valor;
}

function etiquetasDeCatalogo(catalogo, valores) {
  if (!Array.isArray(valores) || valores.length === 0) return null;
  return valores.map(function (valor) { return etiquetaDeCatalogo(catalogo, valor); }).join(', ');
}

/* =========================================================
   CATÁLOGOS DE LOS BLOQUES 4 A 12
   Soportan las reglas RN-039 a RN-226. Los ítems 39 a 140
   del instrumento aún no se capturan en el formulario; estos
   catálogos son la fuente de verdad para cuando se agreguen.
   ========================================================= */

/* Marcadores de exclusión usados por los grupos de selección múltiple */
const VALOR_NINGUNA = 'ninguna';
const VALOR_NO_APLICA = 'no_aplica';

/* ---------------------------------------------------------
   RN-004 — Unidad Zonal de Planeación y Evaluación
   Catálogo parametrizable administrado por la Secretaría de
   Salud Pública Municipal.
   --------------------------------------------------------- */
const CAT_UZPE = [
  { valor: 'UZPE001', etiqueta: 'UZPE001' },
  { valor: 'UZPE002', etiqueta: 'UZPE002' },
  { valor: 'UZPE003', etiqueta: 'UZPE003' },
  { valor: 'UZPE004', etiqueta: 'UZPE004' },
  { valor: 'UZPE005', etiqueta: 'UZPE005' },
  { valor: 'UZPE006', etiqueta: 'UZPE006' },
  { valor: 'UZPE007', etiqueta: 'UZPE007' },
  { valor: 'UZPE008', etiqueta: 'UZPE008' },
  { valor: 'UZPE009', etiqueta: 'UZPE009' },
  { valor: 'UZPE010', etiqueta: 'UZPE010' }
];

/* UZPE del despliegue actual: queda preseleccionada, sin impedir el cambio. */
const UZPE_PREDETERMINADA = 'UZPE006';

/* ---------------------------------------------------------
   RN-040 — Animales en la vivienda o entorno
   --------------------------------------------------------- */
const CAT_ANIMALES = [
  { valor: 'perros', etiqueta: 'Perros' },
  { valor: 'gatos', etiqueta: 'Gatos' },
  { valor: 'porcinos', etiqueta: 'Porcinos' },
  { valor: 'bovinos', etiqueta: 'Bovinos: Búfalos, vacas, toros' },
  { valor: 'equinos', etiqueta: 'Equinos: Asnos, mulas, caballos, burros' },
  { valor: 'ovinos_caprinos', etiqueta: 'Ovinos / caprino' },
  { valor: 'aves_produccion', etiqueta: 'Aves de producción' },
  { valor: 'aves_ornamentales', etiqueta: 'Aves ornamentales' },
  { valor: 'peces_hamster', etiqueta: 'Peces ornamentales, hámster' },
  { valor: 'cobayos_conejos', etiqueta: 'Cobayos, conejos' },
  { valor: 'silvestres', etiqueta: 'Animales silvestres' },
  { valor: 'otro', etiqueta: 'Otro' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true }
];

/* ---------------------------------------------------------
   RN-046 — Fuente de abastecimiento de agua
   `noSegura` marca las fuentes que activan alerta en RN-211.
   --------------------------------------------------------- */
const CAT_FUENTE_AGUA = [
  { valor: 'acueducto_esp', etiqueta: 'Acueducto administrado por empresa prestadora (ESP)', noSegura: false },
  { valor: 'acueducto_veredal', etiqueta: 'Acueducto veredal o comunitario', noSegura: false },
  { valor: 'pila_publica', etiqueta: 'Pila pública', noSegura: false },
  { valor: 'agua_embotellada', etiqueta: 'Agua embotellada o en bolsa', noSegura: false },
  { valor: 'carro_tanque', etiqueta: 'Carro tanque', noSegura: true },
  { valor: 'distribucion_comunitaria', etiqueta: 'Abasto con distribución comunitaria', noSegura: true },
  { valor: 'pozo_con_bomba', etiqueta: 'Pozo con bomba', noSegura: true },
  { valor: 'pozo_sin_bomba', etiqueta: 'Pozo sin bomba, aljibe, jagüey o barreno', noSegura: true },
  { valor: 'laguna_jaguey', etiqueta: 'Laguna o jagüey', noSegura: true },
  { valor: 'rio_quebrada', etiqueta: 'Río, quebrada', noSegura: true },
  { valor: 'manantial', etiqueta: 'Manantial o nacimiento', noSegura: true },
  { valor: 'aguas_lluvias', etiqueta: 'Aguas lluvias', noSegura: true },
  { valor: 'aguatero', etiqueta: 'Aguatero', noSegura: true }
];

/* ---------------------------------------------------------
   RN-047 — Disposición de excretas
   --------------------------------------------------------- */
const CAT_DISPOSICION_EXCRETAS = [
  { valor: 'alcantarillado', etiqueta: 'Sanitario conectado al alcantarillado', critica: false },
  { valor: 'letrina', etiqueta: 'Sanitario y letrina', critica: false },
  { valor: 'pozo_septico', etiqueta: 'Sanitario conectado a pozo séptico', critica: false },
  { valor: 'ecologico_seco', etiqueta: 'Sanitario ecológico seco', critica: false },
  { valor: 'sin_conexion', etiqueta: 'Sanitario sin conexión', critica: true },
  { valor: 'fuente_hidrica', etiqueta: 'Sanitario con disposición a fuente hídrica', critica: true },
  { valor: 'campo_abierto', etiqueta: 'Campo abierto', critica: true }
];

/* ---------------------------------------------------------
   RN-048 — Aguas residuales domésticas
   --------------------------------------------------------- */
const CAT_AGUAS_RESIDUALES = [
  { valor: 'alcantarillado', etiqueta: 'Alcantarillado', critica: false },
  { valor: 'pozo_septico', etiqueta: 'Pozo séptico', critica: false },
  { valor: 'campo_oxidacion', etiqueta: 'Campo de oxidación', critica: false },
  { valor: 'biofiltro', etiqueta: 'Biofiltro', critica: false },
  { valor: 'fuente_hidrica', etiqueta: 'Fuente hídrica', critica: true },
  { valor: 'campo_abierto', etiqueta: 'Campo abierto', critica: true }
];

/* ---------------------------------------------------------
   RN-049 — Disposición final de residuos sólidos
   --------------------------------------------------------- */
const CAT_RESIDUOS_SOLIDOS = [
  { valor: 'servicio_aseo', etiqueta: 'Recolección por parte del servicio de aseo distrital o municipal', critica: false },
  { valor: 'enterramiento', etiqueta: 'Enterramiento', critica: true },
  { valor: 'quema', etiqueta: 'Quema a campo abierto', critica: true },
  { valor: 'fuentes_agua', etiqueta: 'Disposición en fuentes de agua cercana', critica: true },
  { valor: 'campo_abierto', etiqueta: 'Disposición a campo abierto', critica: true }
];

/* ---------------------------------------------------------
   RN-050 — Tipo de familia
   --------------------------------------------------------- */
const CAT_TIPO_FAMILIA = [
  { valor: 'nuclear_biparental', etiqueta: 'Nuclear biparental' },
  { valor: 'nuclear_monoparental', etiqueta: 'Nuclear monoparental' },
  { valor: 'extenso_biparental', etiqueta: 'Extenso biparental' },
  { valor: 'extenso_monoparental', etiqueta: 'Extenso monoparental' },
  { valor: 'compuesto_biparental', etiqueta: 'Compuesto biparental' },
  { valor: 'compuesto_monoparental', etiqueta: 'Compuesto monoparental' },
  { valor: 'unipersonal', etiqueta: 'Unipersonal' }
];

/* ---------------------------------------------------------
   RN-053 / RN-212 — Escala de Zarit
   --------------------------------------------------------- */
const CAT_ZARIT = [
  { valor: 'ausencia', etiqueta: 'Ausencia de sobrecarga (≤ 46)', prioridad: null },
  { valor: 'ligera', etiqueta: 'Sobrecarga ligera (47-55)', prioridad: 'regular' },
  { valor: 'intensa', etiqueta: 'Sobrecarga intensa (≥ 56)', prioridad: 'prioritaria' }
];

/* ---------------------------------------------------------
   RN-054 — Situaciones familiares de riesgo
   --------------------------------------------------------- */
const CAT_SITUACIONES_RIESGO_FAMILIAR = [
  { valor: 'inicio_convivencia', etiqueta: 'Inicio de la convivencia en pareja' },
  { valor: 'nuevo_integrante', etiqueta: 'Llegada de un nuevo integrante' },
  { valor: 'ingreso_estudiar', etiqueta: 'Ingreso a estudiar' },
  { valor: 'perdida_ano_escolar', etiqueta: 'Pérdida del año escolar' },
  { valor: 'embarazo_adolescente', etiqueta: 'Embarazo temprano o adolescente' },
  { valor: 'independencia_hijos', etiqueta: 'Independencia de los hijos-hijas' },
  { valor: 'separacion', etiqueta: 'Separación' },
  { valor: 'jubilacion', etiqueta: 'Jubilación' },
  { valor: 'duelo', etiqueta: 'Duelo' },
  { valor: 'desempleo', etiqueta: 'Desempleo o pérdida abrupta del trabajo' },
  { valor: 'crisis_economica', etiqueta: 'Pérdidas o crisis económicas' },
  { valor: 'muerte_inesperada', etiqueta: 'Muerte inesperada' },
  { valor: 'migracion', etiqueta: 'Migración' },
  { valor: 'enfermedad_terminal', etiqueta: 'Enfermedad terminal o huérfana/rara en alguno de sus integrantes' },
  { valor: 'accidente_discapacidad', etiqueta: 'Accidente o situación que genera discapacidad' },
  { valor: 'antecedente_suicidio', etiqueta: 'Antecedentes de intento o muerte por suicidio en alguno de sus integrantes', riesgo: 'suicidio' },
  { valor: 'violencia', etiqueta: 'Vivencia de alguna forma de violencia', riesgo: 'violencia' },
  { valor: 'abandono', etiqueta: 'Persona en situación de abandono', riesgo: 'abandono' },
  { valor: 'consumo_spa', etiqueta: 'Consumo problemático de sustancias psicoactivas, incluyendo alcohol', riesgo: 'spa' },
  { valor: 'trastorno_mental', etiqueta: 'Trastorno de salud mental', riesgo: 'salud_mental' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-055 — Prácticas que favorecen los vínculos familiares
   --------------------------------------------------------- */
const CAT_PRACTICAS_VINCULO = [
  { valor: 'maneja_tension', etiqueta: 'Cuando hay tensión o estrés en la familia lo reconoce y encuentran la forma de manejarlas de manera pacífica' },
  { valor: 'decisiones_concertadas', etiqueta: 'Las decisiones familiares son concertadas teniendo en cuenta a todos sus integrantes' },
  { valor: 'resuelve_conflictos', etiqueta: 'La familia resuelve los conflictos buscando el bienestar de todos sus integrantes' },
  { valor: 'escucha_activa', etiqueta: 'La comunicación en la familia está basada en la escucha activa, el respeto y la negociación' },
  { valor: 'acompana_menores', etiqueta: 'Los padres y cuidadores comparten, apoyan y supervisan las actividades de niños y adolescentes con respeto y límites' },
  { valor: 'considera_mayores', etiqueta: 'Los integrantes tienen en cuenta los intereses, opiniones y preferencias de las personas adultas mayores' }
];

/* ---------------------------------------------------------
   RN-056 — Redes de apoyo social
   --------------------------------------------------------- */
const CAT_REDES_APOYO = [
  { valor: 'cuenta_protectoras', etiqueta: 'Cuenta con redes de apoyo sociales protectoras para el cuidado de su salud', riesgo: false },
  { valor: 'cuenta_ampliables', etiqueta: 'Cuenta con redes de apoyo sociales para el cuidado de su salud, pero podría ampliarlas para fortalecerse', riesgo: false },
  { valor: 'no_cuenta', etiqueta: 'No identifica / no cuenta con redes de apoyo sociales protectoras', riesgo: true }
];

/* ---------------------------------------------------------
   RN-057 — Prácticas de cuidado en el entorno hogar
   --------------------------------------------------------- */
const CAT_PRACTICAS_CUIDADO_HOGAR = [
  { valor: 'tratamiento_agua', etiqueta: 'Tratamiento casero al agua antes del consumo humano y almacenamiento adecuado' },
  { valor: 'ventilacion', etiqueta: 'Facilita la circulación del aire en la vivienda a través de la ventilación natural o artificial' },
  { valor: 'evita_humo', etiqueta: 'Evita el consumo de tabaco, el encendido de carros al interior de la vivienda y el uso de leña para cocinar' },
  { valor: 'residuos_tapados', etiqueta: 'Los residuos sólidos se almacenan en recipientes con tapa, se separan en la fuente, no se queman, no se tiran a campo abierto o en fuentes de agua' },
  { valor: 'pisos_limpios', etiqueta: 'Los pisos y paredes de la vivienda están limpios' },
  { valor: 'toldillos', etiqueta: 'Usa toldillos, angeos y trampas caseras para la protección contra vectores y roedores' },
  { valor: 'peridomicilio_limpio', etiqueta: 'Al interior de la vivienda o el peri-domicilio, jardín o espacios como patio o azotea están limpios' },
  { valor: 'quimicos_seguros', etiqueta: 'El lugar donde se almacenan los productos químicos está ventilado, cerrado, separado de alimentos y fuera del alcance de niños y mascotas' }
];

/* ---------------------------------------------------------
   RN-062 / RN-063 / RN-064 — Tipo de identificación del integrante
   `edadMinMeses` y `edadMaxMeses` definen la coherencia con la edad
   calculada; `bloqueaEdad` distingue el bloqueo de la advertencia;
   `exigeExtranjero` obliga a nacionalidad distinta de Colombia.
   --------------------------------------------------------- */
const CAT_TIPO_ID_INTEGRANTE = [
  {
    valor: 'AS', etiqueta: 'AS. Adulto sin Identificación',
    formato: 'temporal', edadMinMeses: 216, edadMaxMeses: null,
    bloqueaEdad: true, exigeExtranjero: false, sinDocumento: true
  },
  {
    valor: 'CC', etiqueta: 'CC. Cédula de Ciudadanía',
    formato: 'numerico_6_10', edadMinMeses: 216, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'CD', etiqueta: 'CD. Carné Diplomático',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true
  },
  {
    valor: 'CE', etiqueta: 'CE. Cédula de Extranjería',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true
  },
  {
    valor: 'MS', etiqueta: 'MS. Menor sin Identificación',
    formato: 'temporal', edadMinMeses: 0, edadMaxMeses: 215,
    bloqueaEdad: true, exigeExtranjero: false, sinDocumento: true
  },
  {
    valor: 'NV', etiqueta: 'NV. Certificado de Nacido Vivo',
    formato: 'alfanumerico_5_16', edadMinMeses: 0, edadMaxMeses: 11,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'PE', etiqueta: 'PE. Permiso Especial de Permanencia',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true, migrante: true
  },
  {
    valor: 'PT', etiqueta: 'PT. Permiso por Protección Temporal',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true, migrante: true
  },
  {
    valor: 'RC', etiqueta: 'RC. Registro Civil',
    formato: 'numerico_8_11', edadMinMeses: 0, edadMaxMeses: 83,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'TI', etiqueta: 'TI. Tarjeta de identidad',
    formato: 'numerico_6_10', edadMinMeses: 84, edadMaxMeses: 215,
    bloqueaEdad: false, exigeExtranjero: false
  }
];

/* Formatos de documento reutilizados por RN-013 y RN-063 */
const FORMATOS_DOCUMENTO = {
  numerico_6_10: /^\d{6,10}$/,
  numerico_8_11: /^\d{8,11}$/,
  alfanumerico_5_16: /^[A-Za-z0-9-]{5,16}$/
};

/* ---------------------------------------------------------
   RN-065 — Nacionalidad (lista corta + catálogo ampliable)
   --------------------------------------------------------- */
const NACIONALIDAD_COLOMBIA = 'CO';

const CAT_NACIONALIDAD = [
  { valor: 'CO', etiqueta: 'Colombia' },
  { valor: 'VE', etiqueta: 'Venezuela' },
  { valor: 'EC', etiqueta: 'Ecuador' },
  { valor: 'PE', etiqueta: 'Perú' },
  { valor: 'HT', etiqueta: 'Haití' },
  { valor: 'CU', etiqueta: 'Cuba' },
  { valor: 'OT', etiqueta: 'Otra' }
];

/* ---------------------------------------------------------
   RN-066 / RN-067 / RN-068 / RN-069 — Sexo, género y orientación
   --------------------------------------------------------- */
const CAT_SEXO = [
  { valor: 'hombre', etiqueta: 'Hombre' },
  { valor: 'mujer', etiqueta: 'Mujer' },
  { valor: 'intersexual', etiqueta: 'Intersexual (Indeterminado)' }
];

/* Sexos con capacidad de gestar para RN-085 y RN-205 */
const SEXOS_CON_CAPACIDAD_GESTAR = ['mujer', 'intersexual'];

const CAT_GENERO = [
  { valor: 'femenino', etiqueta: 'Femenino' },
  { valor: 'masculino', etiqueta: 'Masculino' }
];

const CAT_AUTOIDENTIFICACION_GENERO = [
  { valor: 'femenino', etiqueta: 'Femenino' },
  { valor: 'masculino', etiqueta: 'Masculino' },
  { valor: 'transexual', etiqueta: 'Transexual', diversa: true },
  { valor: 'transgenero', etiqueta: 'Transgenero', diversa: true },
  { valor: 'no_responde', etiqueta: 'No responde' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true }
];

const CAT_ORIENTACION_SEXUAL = [
  { valor: 'heterosexual', etiqueta: 'Heterosexual' },
  { valor: 'lesbiana', etiqueta: 'Lesbiana' },
  { valor: 'gay', etiqueta: 'Gay' },
  { valor: 'bisexual', etiqueta: 'Bisexual' },
  { valor: 'no_responde', etiqueta: 'No responde' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true }
];

/* ---------------------------------------------------------
   RN-072 — Rol dentro de la familia
   --------------------------------------------------------- */
const ROL_RESPONSABLE_ECONOMICO = 'responsable_economico';

const CAT_ROL_FAMILIAR = [
  { valor: ROL_RESPONSABLE_ECONOMICO, etiqueta: 'Responsable económico de la familia' },
  { valor: 'conyuge', etiqueta: 'Cónyuge o compañero(a)' },
  { valor: 'hijo', etiqueta: 'Hijo(a)' },
  { valor: 'hermano', etiqueta: 'Hermano(a)' },
  { valor: 'padre_madre', etiqueta: 'Padre o madre' },
  { valor: 'otros', etiqueta: 'Otros' }
];

/* ---------------------------------------------------------
   RN-074 — Nivel educativo
   `edadMinimaEsperada` soporta la advertencia de coherencia.
   --------------------------------------------------------- */
const CAT_NIVEL_EDUCATIVO = [
  { valor: 'preescolar', etiqueta: 'Preescolar', edadMinimaEsperada: 3 },
  { valor: 'basica_primaria', etiqueta: 'Básica Primaria', edadMinimaEsperada: 5 },
  { valor: 'basica_secundaria', etiqueta: 'Básica Secundaria', edadMinimaEsperada: 10 },
  { valor: 'media_academica', etiqueta: 'Media Académica o Clásica', edadMinimaEsperada: 14 },
  { valor: 'media_tecnica', etiqueta: 'Media Técnica (Bachillerato Técnico)', edadMinimaEsperada: 14 },
  { valor: 'normalista', etiqueta: 'Normalista', edadMinimaEsperada: 16 },
  { valor: 'tecnica_profesional', etiqueta: 'Técnica Profesional', edadMinimaEsperada: 16 },
  { valor: 'tecnologica', etiqueta: 'Tecnológica', edadMinimaEsperada: 17 },
  { valor: 'profesional', etiqueta: 'Profesional', edadMinimaEsperada: 20 },
  { valor: 'especializacion', etiqueta: 'Especialización', edadMinimaEsperada: 22 },
  { valor: 'maestria', etiqueta: 'Maestría', edadMinimaEsperada: 23 },
  { valor: 'doctorado', etiqueta: 'Doctorado', edadMinimaEsperada: 24 },
  { valor: 'tecnica_laboral', etiqueta: 'Técnica Laboral', edadMinimaEsperada: 15 },
  { valor: 'ninguno', etiqueta: 'Ninguno', edadMinimaEsperada: 0 }
];

/* ---------------------------------------------------------
   RN-075 / RN-076 / RN-209 — Régimen de afiliación
   --------------------------------------------------------- */
const REGIMEN_NO_AFILIADO = 'no_afiliado';

const CAT_REGIMEN_AFILIACION = [
  { valor: 'subsidiado', etiqueta: 'Subsidiado' },
  { valor: 'contributivo', etiqueta: 'Contributivo' },
  { valor: 'especial', etiqueta: 'Especial' },
  { valor: 'excepcion', etiqueta: 'Excepción' },
  { valor: REGIMEN_NO_AFILIADO, etiqueta: 'No afiliado' }
];

/* ---------------------------------------------------------
   RN-077 — Sujeto de especial protección constitucional
   --------------------------------------------------------- */
const SUJETO_GESTANTE = 'gestante';
const SUJETO_VIOLENCIA_GENERO = 'victima_violencia_genero';

const CAT_SUJETO_ESPECIAL_PROTECCION = [
  { valor: 'ninez', etiqueta: 'Niñas, niños o adolescentes' },
  { valor: SUJETO_GESTANTE, etiqueta: 'Gestante' },
  { valor: 'adulto_mayor', etiqueta: 'Persona adulta mayor' },
  { valor: 'orientacion_diversa', etiqueta: 'Personas con orientación sexual diversa' },
  { valor: 'campesino', etiqueta: 'Campesina o campesino' },
  { valor: 'migrante', etiqueta: 'Migrantes' },
  { valor: 'madre_cabeza_familia', etiqueta: 'Madre cabeza de familia' },
  { valor: 'enfermedad_huerfana', etiqueta: 'Personas con enfermedades huérfanas' },
  { valor: 'victima_conflicto', etiqueta: 'Víctima del conflicto armado', violencia: true },
  { valor: SUJETO_VIOLENCIA_GENERO, etiqueta: 'Víctima de violencia de género e intrafamiliar', violencia: true },
  { valor: 'victima_violencia_interpersonal', etiqueta: 'Víctima de violencia interpersonal', violencia: true },
  { valor: 'privado_libertad', etiqueta: 'Persona privada de la libertad (medida domiciliaria)' },
  { valor: 'responsabilidad_penal_adolescente', etiqueta: 'Personas en el sistema de responsabilidad penal adolescente' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-078 — Modalidad de la violencia
   El instrumento impreso duplica "Negligencia y abandono";
   aquí se registra una sola vez (ver Anexo C del documento).
   --------------------------------------------------------- */
const MODALIDAD_VIOLENCIA_SEXUAL = 'sexual';

const CAT_MODALIDAD_VIOLENCIA = [
  { valor: 'fisica', etiqueta: 'Física' },
  { valor: 'psicologica', etiqueta: 'Psicológica' },
  { valor: 'negligencia_abandono', etiqueta: 'Negligencia y abandono' },
  { valor: MODALIDAD_VIOLENCIA_SEXUAL, etiqueta: 'Sexual' },
  { valor: 'patrimonial', etiqueta: 'Patrimonial o económica' }
];

/* ---------------------------------------------------------
   RN-079 / RN-080 — Pertenencia étnica
   --------------------------------------------------------- */
const ETNIA_NINGUNA = 'ninguna';

const CAT_PERTENENCIA_ETNICA = [
  { valor: 'indigena', etiqueta: 'Indígena' },
  { valor: 'rrom', etiqueta: 'Rrom (Gitanos)' },
  { valor: 'negro', etiqueta: 'Negro' },
  { valor: 'afrocolombiano', etiqueta: 'Afrocolombiano' },
  { valor: 'raizal', etiqueta: 'Raizal (San Andrés y Providencia)' },
  { valor: 'palenquero', etiqueta: 'Palenquero de San Basilio de Palenque' },
  { valor: ETNIA_NINGUNA, etiqueta: 'Ninguna' }
];

/* ---------------------------------------------------------
   RN-081 — Saberes ancestrales
   --------------------------------------------------------- */
const CAT_SABERES_ANCESTRALES = [
  { valor: 'proteccion_danos', etiqueta: 'Prácticas para proteger ante posibles daños (aseguranzas, rituales y otros)' },
  { valor: 'transicion', etiqueta: 'Prácticas que acompañan en momentos de transición (arrullos o cantos, rituales de paso u otros)' },
  { valor: 'cuidado_salud', etiqueta: 'Prácticas tradicionales para el cuidado de la salud (baile o danza, música, uso de plantas, masajes u otros)' },
  { valor: 'armonizacion', etiqueta: 'Prácticas de armonización o para favorecer el bienestar (rituales, consejería del sabedor/a, pagamentos)' },
  { valor: 'partera_sabedor', etiqueta: 'Acompañamiento de partera, sabedor o médico tradicional en los procesos de salud enfermedad' },
  { valor: 'cuidado_entorno', etiqueta: 'Prácticas de cuidado con el entorno, con los alimentos u otros' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-082 / RN-083 — Discapacidad
   --------------------------------------------------------- */
const SIN_DISCAPACIDAD = 'sin_discapacidad';

const CAT_DISCAPACIDAD = [
  { valor: 'fisica', etiqueta: 'Física' },
  { valor: 'auditiva', etiqueta: 'Auditiva' },
  { valor: 'visual', etiqueta: 'Visual' },
  { valor: 'sordoceguera', etiqueta: 'Sordoceguera' },
  { valor: 'intelectual', etiqueta: 'Intelectual' },
  { valor: 'psicosocial', etiqueta: 'Psicosocial (mental)' },
  { valor: 'multiple', etiqueta: 'Múltiple' },
  { valor: SIN_DISCAPACIDAD, etiqueta: 'Sin discapacidad', excluyente: true }
];

/* ---------------------------------------------------------
   RN-086 — Prácticas rutinarias de cuidado de la salud
   --------------------------------------------------------- */
const CAT_PRACTICAS_CUIDADO = [
  { valor: 'alimentacion', etiqueta: 'Consume alimentos en cantidad y calidad suficiente todos los días' },
  { valor: 'actividad_fisica', etiqueta: 'Realiza actividad física, ejercicio o actividad deportiva' },
  { valor: 'higiene_oral', etiqueta: 'Higiene oral diaria (cepillado mínimo 2 veces al día)' },
  { valor: 'lavado_manos', etiqueta: 'Lavado de manos antes de consumir alimentos o después de entrar al baño, cambiar pañales, tener contacto con animales, retirar secreciones nasales, llegar de la calle, manipular sustancias químicas' },
  { valor: 'sueno', etiqueta: 'Duerme lo suficiente para estar con energía durante todo el día (entre 6 a 8 horas diarias)' },
  { valor: 'control_pantallas', etiqueta: 'Controla el tiempo de exposición a televisión, videojuegos y celular (menos de 2 horas al día)' },
  { valor: 'ocio', etiqueta: 'Realiza actividades en el tiempo libre o de ocio' },
  { valor: 'actividades_culturales', etiqueta: 'Participa en actividades culturales, sociales, alternativas o complementarias que aportan al cuidado de la salud' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-087 — Atenciones pendientes de promoción y mantenimiento
   `rangos` son pares [edadMinMeses, edadMaxMeses] (null = sin tope).
   `sexos` restringe por sexo biológico; null = ambos.
   `gestante` habilita la atención cuando hay gestación confirmada.
   `mujerEdadFertil` la habilita en mujeres de 10 a 54 años.
   --------------------------------------------------------- */
const CAT_ATENCIONES_RPMS = [
  { valor: 'valoracion_integral_pyms', etiqueta: 'Valoración Integral para la PYMS', rangos: [[0, null]], sexos: null },
  { valor: 'valoracion_salud_bucal', etiqueta: 'Valoración integral en salud bucal por profesional en odontología para la PYMS', rangos: [[0, null]], sexos: null },
  { valor: 'lactancia_materna', etiqueta: 'Promoción y apoyo a lactancia materna', rangos: [[0, 24]], sexos: null, gestante: true },
  { valor: 'aplicacion_fluor', etiqueta: 'Aplicación de flúor', rangos: [[12, 215]], sexos: null },
  { valor: 'profilaxis_placa', etiqueta: 'Profilaxis y remoción de placa bacteriana', rangos: [[24, null]], sexos: null },
  { valor: 'vacunacion', etiqueta: 'Vacunación de acuerdo con el esquema', rangos: [[0, 215], [720, null]], sexos: null, gestante: true },
  { valor: 'fortificacion_micronutrientes', etiqueta: 'Fortificación casera con micronutrientes en polvo', rangos: [[6, 23]], sexos: null },
  { valor: 'suplementacion_micronutrientes', etiqueta: 'Suplementación con micronutrientes', rangos: [[6, 155]], sexos: null, gestante: true },
  { valor: 'desparasitacion', etiqueta: 'Desparasitación intestinal antihelmíntica', rangos: [[12, 215]], sexos: null },
  { valor: 'tamizaje_anemia', etiqueta: 'Tamizaje para anemia - Hemoglobina y hematocrito', rangos: [[6, 71]], sexos: null, gestante: true, mujerEdadFertil: true },
  { valor: 'asesoria_anticoncepcion', etiqueta: 'Asesoría en anticoncepción (planificación familiar)', rangos: [[156, null]], sexos: null },
  { valor: 'suministro_anticonceptivos', etiqueta: 'Suministro de anticonceptivos', rangos: [[156, null]], sexos: null },
  { valor: 'tamizaje_cardiovascular', etiqueta: 'Tamizaje de riesgo cardiovascular', rangos: [[216, null]], sexos: null },
  { valor: 'prueba_treponemica', etiqueta: 'Prueba rápida treponémica', rangos: [[156, null]], sexos: null, gestante: true },
  { valor: 'prueba_vih', etiqueta: 'Prueba rápida y asesoría pre y postest VIH', rangos: [[156, null]], sexos: null, gestante: true },
  { valor: 'prueba_hepatitis', etiqueta: 'Prueba rápida para Hepatitis B (18 a 28 años) y C (22 a 28 años)', rangos: [[216, 347]], sexos: null },
  { valor: 'prueba_embarazo', etiqueta: 'Prueba de embarazo en caso de retraso menstrual u otros síntomas o signos de sospecha', rangos: [[120, null]], sexos: ['mujer', 'intersexual'] },
  { valor: 'tamizaje_cuello_uterino', etiqueta: 'Tamizaje para cáncer de cuello uterino (mujeres de 20 a 28 años)', rangos: [[240, 347]], sexos: ['mujer', 'intersexual'] },
  { valor: 'colposcopia', etiqueta: 'Colposcopia y Biopsia cérvico uterina (mujeres)', rangos: [[240, null]], sexos: ['mujer', 'intersexual'] },
  { valor: 'tamizaje_mama', etiqueta: 'Tamizaje para cáncer de mama', rangos: [[480, null]], sexos: ['mujer', 'intersexual'] },
  { valor: 'tamizaje_prostata', etiqueta: 'Tamizaje para cáncer de próstata', rangos: [[600, null]], sexos: ['hombre', 'intersexual'] },
  { valor: 'tamizaje_colon', etiqueta: 'Tamizaje para cáncer de colon y recto', rangos: [[600, null]], sexos: null },
  { valor: 'educacion_salud', etiqueta: 'Educación para la salud', rangos: [[0, null]], sexos: null },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, rangos: [[0, null]], sexos: null }
];

/* Determina si una atención de RPMS es exigible para el perfil del integrante. */
function atencionRpmsExigible(atencion, edadMeses, sexo, esGestante) {
  if (!atencion || atencion.excluyente) return true;
  if (edadMeses === null || edadMeses === undefined) return false;

  if (atencion.gestante && esGestante) return true;

  if (atencion.mujerEdadFertil &&
      SEXOS_CON_CAPACIDAD_GESTAR.indexOf(sexo) !== -1 &&
      edadMeses >= 120 && edadMeses <= 659) {
    return true;
  }

  if (atencion.sexos && atencion.sexos.indexOf(sexo) === -1) return false;

  return (atencion.rangos || []).some(function (rango) {
    const dentroDelMinimo = edadMeses >= rango[0];
    const dentroDelMaximo = rango[1] === null || edadMeses <= rango[1];
    return dentroDelMinimo && dentroDelMaximo;
  });
}

/* Lista de atenciones habilitadas para un integrante concreto (RN-087). */
function atencionesRpmsExigibles(edadMeses, sexo, esGestante) {
  return CAT_ATENCIONES_RPMS.filter(function (atencion) {
    return atencionRpmsExigible(atencion, edadMeses, sexo, esGestante);
  });
}

/* ---------------------------------------------------------
   RN-088 — Atenciones pendientes de la ruta materno perinatal
   --------------------------------------------------------- */
const CAT_ATENCIONES_MATERNO = [
  { valor: 'preconcepcional', etiqueta: 'Atención para el cuidado preconcepcional' },
  { valor: 'ive', etiqueta: 'Interrupción Voluntaria del Embarazo -IVE-' },
  { valor: 'control_prenatal', etiqueta: 'Atención para el cuidado prenatal - Controles prenatales', esencial: true },
  { valor: 'preparacion_maternidad', etiqueta: 'Preparación para la maternidad y paternidad' },
  { valor: 'puerperio', etiqueta: 'Atención del puerperio' },
  { valor: 'anticonceptivo_postparto', etiqueta: 'Provisión del método anticonceptivo post parto inmediato' },
  { valor: 'seguimiento_recien_nacido', etiqueta: 'Atención y seguimiento del recién nacido' },
  { valor: 'educacion_salud', etiqueta: 'Educación para la salud' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-089 / RN-210 — Barreras de acceso
   `tipo` y `prioridad` alimentan la clasificación de RN-210.
   --------------------------------------------------------- */
const CAT_BARRERAS_ACCESO = [
  { valor: 'no_afiliado', etiqueta: 'No Afiliado', tipo: 'aseguramiento', prioridad: 'prioritaria' },
  { valor: 'desconoce_derecho', etiqueta: 'Desconocimiento del derecho a las intervenciones', tipo: 'informacion', prioridad: 'regular' },
  { valor: 'desconoce_gratuidad', etiqueta: 'Desconocimiento que las intervenciones son gratuitas', tipo: 'informacion', prioridad: 'regular' },
  { valor: 'servicio_lejano', etiqueta: 'El servicio de salud está lejos del lugar de residencia', tipo: 'geografica', prioridad: 'regular' },
  { valor: 'sin_personal', etiqueta: 'No hay personal de salud en el centro de salud cercano', tipo: 'geografica', prioridad: 'regular' },
  { valor: 'tramites', etiqueta: 'Dificultades con trámites administrativos', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'sin_agenda', etiqueta: '"No hay agenda" para esta atención', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'no_sabe_solicitar', etiqueta: 'No sabe cómo solicitar la cita', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'horarios_restringidos', etiqueta: 'Horarios de atención restringidos', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'tiempos_espera', etiqueta: 'Largos tiempos de espera', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'incomodidad_personal', etiqueta: 'No se siente cómodo(a) con el personal de salud', tipo: 'cultural', prioridad: 'regular' },
  { valor: 'no_puede_acudir', etiqueta: 'Persona enferma que no puede acudir al servicio', tipo: 'dependencia', prioridad: 'prioritaria' },
  { valor: 'falta_tiempo_cuidador', etiqueta: 'Falta de tiempo del cuidador', tipo: 'dependencia', prioridad: 'prioritaria' },
  { valor: 'adecuacion_sociocultural', etiqueta: 'Falta de adecuación sociocultural del servicio', tipo: 'cultural', prioridad: 'regular' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-090 — Conocimiento y exigibilidad del derecho a la salud
   --------------------------------------------------------- */
const CAT_CONOCIMIENTO_DERECHO = [
  { valor: 'derechos_deberes', etiqueta: 'Conoce los derechos y deberes en salud' },
  { valor: 'informacion_atenciones', etiqueta: 'Tiene información sobre las atenciones y servicios de salud a los cuales tiene derecho (promoción, prevención, atención, rehabilitación)' },
  { valor: 'lugares_servicios', etiqueta: 'Conoce los lugares donde pueden prestar los servicios de salud' },
  { valor: 'resolver_dificultades', etiqueta: 'Conoce cómo resolver las dificultades que se le presentan para acceder a la atención en salud' }
];

/* ---------------------------------------------------------
   RN-096 / RN-204 — Clasificación antropométrica
   --------------------------------------------------------- */
const CAT_CLASIFICACION_ANTROPOMETRICA = [
  { valor: 'obesidad', etiqueta: 'Obesidad', prioridad: 'regular' },
  { valor: 'sobrepeso', etiqueta: 'Sobrepeso', prioridad: 'regular' },
  { valor: 'riesgo_sobrepeso', etiqueta: 'Riesgo de Sobrepeso', prioridad: 'regular' },
  { valor: 'peso_adecuado', etiqueta: 'Peso Adecuado para la Talla o IMC adecuado para la edad', prioridad: null },
  { valor: 'riesgo_desnutricion', etiqueta: 'Riesgo de Desnutrición Aguda (en <5 años), o Riesgo de delgadez (en > de 4 años) o Bajo peso para la edad gestacional o Delgadez (en mayores de 17 años)', prioridad: 'regular' },
  { valor: 'desnutricion_moderada', etiqueta: 'Desnutrición Aguda Moderada', prioridad: 'prioritaria' },
  { valor: 'desnutricion_severa', etiqueta: 'Desnutrición Aguda Severa', prioridad: 'inmediata' },
  { valor: 'riesgo_delgadez', etiqueta: 'Riesgo de Delgadez', prioridad: 'regular' },
  { valor: 'delgadez', etiqueta: 'Delgadez', prioridad: 'regular' },
  { valor: 'bajo_peso_gestacional', etiqueta: 'Bajo Peso para la Edad Gestacional', prioridad: 'prioritaria' },
  { valor: 'normal', etiqueta: 'Normal', prioridad: null }
];

/* ---------------------------------------------------------
   RN-097 — Signos físicos de desnutrición aguda
   --------------------------------------------------------- */
const CAT_SIGNOS_DESNUTRICION = [
  { valor: 'cabeza', etiqueta: 'Cabeza' },
  { valor: 'cara', etiqueta: 'Cara' },
  { valor: 'piel', etiqueta: 'Piel' },
  { valor: 'torax_abdomen', etiqueta: 'Tórax y abdomen' },
  { valor: 'extremidades', etiqueta: 'Extremidades' },
  { valor: 'comportamiento', etiqueta: 'Comportamiento' },
  { valor: 'edema', etiqueta: 'Edema', severo: true },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-099 / RN-203 — Clasificación de tensión arterial (AHA 2024)
   --------------------------------------------------------- */
const CAT_CLASIFICACION_TENSION = [
  { valor: 'crisis', etiqueta: 'Crisis hipertensiva (sistólica más alta de 180 mm Hg y/o diastólica más alta de 120 mm Hg)', prioridad: 'inmediata' },
  { valor: 'nivel2', etiqueta: 'Alta - Hipertensión nivel 2 (sistólica 140 mm Hg o más alta o diastólica 90 mm Hg o más alta)', prioridad: 'prioritaria' },
  { valor: 'nivel1', etiqueta: 'Alta - Hipertensión nivel 1 (sistólica de 130 a 139 mm Hg o diastólica 80 a 89 mm Hg)', prioridad: 'regular' },
  { valor: 'elevada', etiqueta: 'Elevada (sistólica de 120 a 129 mm Hg y diastólica menos de 80 mm Hg)', prioridad: 'regular' },
  { valor: 'normal', etiqueta: 'Normal (sistólica menos de 120 mm Hg y diastólica menos de 80 mm Hg)', prioridad: null }
];

/* Clasifica la tensión arterial según AHA 2024 (RN-099). */
function clasificarTensionArterial(sistolica, diastolica) {
  if (typeof sistolica !== 'number' || typeof diastolica !== 'number') return null;
  if (sistolica > 180 || diastolica > 120) return 'crisis';
  if (sistolica >= 140 || diastolica >= 90) return 'nivel2';
  if (sistolica >= 130 || diastolica >= 80) return 'nivel1';
  if (sistolica >= 120) return 'elevada';
  return 'normal';
}

/* ---------------------------------------------------------
   RN-100 — Enfermedades no transmisibles
   --------------------------------------------------------- */
const CAT_ENFERMEDADES_NO_TRANSMISIBLES = [
  { valor: 'obstetrica', etiqueta: 'Enfermedad obstétrica (trastornos hipertensivos, hemorragias, sepsis, diabetes gestacional, otra)' },
  { valor: 'cardiovascular', etiqueta: 'Enfermedades cardiovasculares (Hipertensión, enfermedad cardiaca)', cardiovascular: true },
  { valor: 'diabetes', etiqueta: 'Diabetes', cardiovascular: true },
  { valor: 'cancer', etiqueta: 'Cáncer' },
  { valor: 'epoc', etiqueta: 'EPOC' },
  { valor: 'raras_huerfanas', etiqueta: 'Enfermedades raras y huérfanas' },
  { valor: 'trastorno_mental', etiqueta: 'Trastorno mental', saludMental: true },
  { valor: 'epilepsia', etiqueta: 'Epilepsia' },
  { valor: 'secuelas_lesiones', etiqueta: 'Secuelas de lesiones por causa externa (secuelas de accidentes, agresiones físicas e intento de suicidio)' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-101 / RN-208 — Condiciones de salud transmisible
   `notifica` marca los eventos de notificación obligatoria a SIVIGILA.
   --------------------------------------------------------- */
const CONDICION_TUBERCULOSIS = 'tuberculosis';

const CAT_CONDICIONES_TRANSMISIBLES = [
  { valor: 'prevalentes_infancia', etiqueta: 'Enfermedades prevalentes de la infancia (Enfermedad Diarreica Aguda, Infección Respiratoria Aguda)', prioridad: 'prioritaria', notifica: false, infancia: true },
  { valor: CONDICION_TUBERCULOSIS, etiqueta: 'Tuberculosis', prioridad: 'prioritaria', notifica: true, contactos: true },
  { valor: 'lepra', etiqueta: 'Lepra', prioridad: 'prioritaria', notifica: true },
  { valor: 'rabia', etiqueta: 'Rabia', prioridad: 'inmediata', notifica: true },
  { valor: 'dengue', etiqueta: 'Dengue', prioridad: 'prioritaria', notifica: true, vectorial: true },
  { valor: 'chikunguya', etiqueta: 'Chikunguya', prioridad: 'prioritaria', notifica: true, vectorial: true },
  { valor: 'zika', etiqueta: 'Zika', prioridad: 'prioritaria', notifica: true, vectorial: true },
  { valor: 'chagas', etiqueta: 'Chagas', prioridad: 'prioritaria', notifica: true, vectorial: true },
  { valor: 'leishmaniasis_visceral', etiqueta: 'Leishmaniasis visceral', prioridad: 'inmediata', notifica: true },
  { valor: 'leishmaniasis_cutanea', etiqueta: 'Leishmaniasis Cutánea', prioridad: 'prioritaria', notifica: true },
  { valor: 'tungiasis', etiqueta: 'Tungiasis', prioridad: 'regular', notifica: false },
  { valor: 'eta', etiqueta: 'Enfermedades transmitidas por alimentos (Cólera, hepatitis A, parasitosis intestinal)', prioridad: 'prioritaria', notifica: true },
  { valor: 'era', etiqueta: 'Enfermedad respiratoria aguda (ERA)', prioridad: 'prioritaria', notifica: false, infancia: true },
  { valor: 'eda', etiqueta: 'Enfermedad diarreica aguda (EDA)', prioridad: 'prioritaria', notifica: false, infancia: true },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-102 — Zona endémica y sintomatología específica
   --------------------------------------------------------- */
const CAT_ZONA_ENDEMICA = [
  { valor: 'geohelmintiasis', etiqueta: 'Geohelmintiasis', prioridad: 'regular' },
  { valor: 'teniasis', etiqueta: 'Teniasis / cisticercosis', prioridad: 'regular' },
  { valor: 'tracoma', etiqueta: 'Tracoma', prioridad: 'regular' },
  { valor: 'escabiosis', etiqueta: 'Escabiosis', prioridad: 'regular' },
  { valor: 'pian', etiqueta: 'Pian', prioridad: 'regular' },
  { valor: 'malaria', etiqueta: 'Malaria', prioridad: 'prioritaria', notifica: true },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-104 — Motivo de no recibir atención
   --------------------------------------------------------- */
const CAT_MOTIVO_NO_TRATAMIENTO = [
  { valor: 'no_afiliada', etiqueta: 'Persona no afiliada', tipo: 'aseguramiento', prioridad: 'prioritaria' },
  { valor: 'servicio_lejano', etiqueta: 'El servicio de salud está lejos del lugar de residencia', tipo: 'geografica', prioridad: 'regular' },
  { valor: 'tramites', etiqueta: 'Dificultades con trámites administrativos', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'sin_agenda', etiqueta: '"No hay agenda" para esta atención', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'no_sabe_solicitar', etiqueta: 'No sabe cómo solicitar la cita', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'no_puede_copago', etiqueta: 'No puede pagar el copago', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'horarios_restringidos', etiqueta: 'Horarios de atención restringidos', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'tiempos_espera', etiqueta: 'Largos tiempos de espera', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'incomodidad_personal', etiqueta: 'No se siente cómodo(a) con el personal de salud', tipo: 'cultural', prioridad: 'regular' },
  { valor: 'no_puede_acudir', etiqueta: 'Persona enferma que no puede acudir al servicio', tipo: 'dependencia', prioridad: 'prioritaria' },
  { valor: 'no_adherencia', etiqueta: 'No tiene adherencia al tratamiento', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'sin_medicamentos', etiqueta: 'No hay disponibilidad de medicamentos en el centro de atención', tipo: 'administrativa', prioridad: 'prioritaria' },
  { valor: 'falta_tiempo_cuidador', etiqueta: 'Falta de tiempo del cuidador', tipo: 'dependencia', prioridad: 'prioritaria' },
  { valor: 'adecuacion_sociocultural', etiqueta: 'Falta de adecuación sociocultural del servicio', tipo: 'cultural', prioridad: 'regular' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true }
];

/* ---------------------------------------------------------
   RN-105 — Riesgos en salud mental de jóvenes y adolescentes
   --------------------------------------------------------- */
const CAT_RIESGOS_SALUD_MENTAL_JOVEN = [
  { valor: 'inicio_convivencia', etiqueta: 'Inicio de la convivencia en pareja' },
  { valor: 'nuevo_integrante', etiqueta: 'Llegada de un nuevo integrante' },
  { valor: 'ingreso_estudiar', etiqueta: 'Ingreso a estudiar' },
  { valor: 'perdida_ano_escolar', etiqueta: 'Pérdida del año escolar' },
  { valor: 'embarazo_adolescente', etiqueta: 'Embarazo temprano o adolescente' },
  { valor: 'independencia_hogar', etiqueta: 'Independencia o salida del hogar paterno-materno' },
  { valor: 'separacion_pareja', etiqueta: 'Separación de pareja' },
  { valor: 'duelo', etiqueta: 'Duelo' },
  { valor: 'desempleo', etiqueta: 'Desempleo o pérdida abrupta del trabajo' },
  { valor: 'crisis_economica', etiqueta: 'Pérdidas o crisis económicas' },
  { valor: 'conflictos_familiares', etiqueta: 'Conflictos familiares' },
  { valor: 'abandono', etiqueta: 'Situación de abandono' },
  { valor: 'sin_redes', etiqueta: 'No identifica / No cuenta con redes de apoyo sociales protectoras' },
  { valor: 'estigma', etiqueta: 'Estigma y discriminación' },
  { valor: 'conflictos_orientacion', etiqueta: 'Conflictos relacionados con su orientación sexual' },
  { valor: 'trastorno_familiar', etiqueta: 'Trastorno de salud mental en algún integrante de la familia' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true }
];

/* ---------------------------------------------------------
   RN-106 / RN-207 — Sintomatología depresiva y ansiosa
   --------------------------------------------------------- */
const CAT_SINTOMATOLOGIA_DEPRESIVA = [
  { valor: 'tristeza', etiqueta: 'Se ha sentido triste todos los días durante la mayor parte del día' },
  { valor: 'anhedonia', etiqueta: 'Ha perdido el interés en actividades que antes disfrutaba' },
  { valor: 'inquietud', etiqueta: 'Se ha sentido inquieto(a) o nervioso(a) todos los días durante la mayor parte del día' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true }
];

/* ---------------------------------------------------------
   RN-107 / RN-202 — Ideación o riesgo de suicidio
   --------------------------------------------------------- */
const IDEACION_CON_RIESGO = 'ha_pensado';

const CAT_IDEACION_SUICIDA = [
  { valor: IDEACION_CON_RIESGO, etiqueta: 'Ha pensado en lastimarse o en no querer seguir viviendo', riesgo: true },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', riesgo: false },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', riesgo: false }
];

/* ---------------------------------------------------------
   RN-109 — Umbrales de los instrumentos de tamizaje de consumo
   --------------------------------------------------------- */
const UMBRALES_TAMIZAJE_SPA = {
  crafft: { edadMinMeses: 168, edadMaxMeses: 215, umbral: 2, etiqueta: 'CRAFFT' },
  audit: { edadMinMeses: 216, edadMaxMeses: null, umbral: 8, etiqueta: 'AUDIT' },
  assist: { edadMinMeses: 216, edadMaxMeses: null, umbral: 4, etiqueta: 'ASSIST' }
};

/* ---------------------------------------------------------
   RN-113 / RN-115 / RN-118 — Plan de cuidado
   --------------------------------------------------------- */
const CAT_TIPO_ID_EJECUTOR = [
  { valor: 'CC', etiqueta: 'CC' },
  { valor: 'DE', etiqueta: 'DE' },
  { valor: 'PT', etiqueta: 'PT' }
];

const CAT_TIPO_RESPUESTA = [
  { valor: 'en_sitio', etiqueta: 'En sitio' },
  { valor: 'derivada', etiqueta: 'Derivada' }
];

const CAT_ESTADO_SEGUIMIENTO = [
  { valor: 'C', etiqueta: 'C: Cumple', cumple: true },
  { valor: 'CP', etiqueta: 'CP: Cumple Parcial', cumple: false },
  { valor: 'NC', etiqueta: 'NC: No cumple', cumple: false }
];

/* Acción registrada expresamente como no procedente (RN-220) */
const ACCION_NO_PROCEDE = 'no_procede';
