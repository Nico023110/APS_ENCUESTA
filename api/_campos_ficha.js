/* =========================================================================
   Preguntas de la ficha en el orden del formulario (exportación a Excel)
   -------------------------------------------------------------------------
   GENERADO por bd/gen_campos_ficha.js desde index.html, app.js y anexo.js.
   No se edita a mano: se corrige el formulario y se regenera.
   ========================================================================= */

'use strict';

const CAMPOS_FICHA = {
  ficha: [
    {
      campo: "consentimiento",
      item: "1",
      etiqueta: "Consentimiento informado para el tratamiento de datos",
      seccion: "1.1 Tratamiento y uso de datos",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "situacionInminente",
      item: "2",
      etiqueta: "Situación que pone en peligro la vida de las personas",
      seccion: "2.1 Identificación de situaciones inminentes que ponen en peligro la vida de las personas",
      catalogo: "CAT_SITUACION_INMINENTE",
      multiple: true,
      anexo: false
    },
    {
      campo: "observacionesSituacion",
      item: "A2.24",
      etiqueta: "Observaciones de la situación atendida",
      seccion: "2.1 Identificación de situaciones inminentes que ponen en peligro la vida de las personas",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "departamento",
      item: "3",
      etiqueta: "Departamento",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "uzpe",
      item: "4",
      etiqueta: "Unidad Zonal de Planeación y Evaluación (UZPE)",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: "CAT_UZPE_VIGENTES",
      multiple: false,
      anexo: false
    },
    {
      campo: "municipio",
      item: "5",
      etiqueta: "Municipio / Área no municipalizada",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "areaUbicacion",
      item: "6",
      etiqueta: "Área de ubicación de la vivienda",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: "CAT_AREA_UBICACION",
      multiple: false,
      anexo: false
    },
    {
      campo: "territorio",
      item: "7",
      etiqueta: "Territorio",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "microterritorio",
      item: "8",
      etiqueta: "Microterritorio",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "comuna",
      item: "",
      etiqueta: "Comuna (derivada del territorio)",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "tipoUbicacion",
      item: "A2.8",
      etiqueta: "Tipo de ubicación de la vivienda",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: "CAT_TIPO_UBICACION",
      multiple: false,
      anexo: true
    },
    {
      campo: "divisionTerritorial",
      item: "9",
      etiqueta: "Nombre del corregimiento, centro poblado, vereda, localidad, barrio o resguardo indígena",
      seccion: "2.2 Datos generales del escenario del entorno",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "equipoSaludId",
      item: "10",
      etiqueta: "Número de identificación del Equipo de Salud",
      seccion: "2.3 Detalles del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "prestadorPrimario",
      item: "11",
      etiqueta: "Prestador primario / Organismo de adscripción del Equipo de Salud",
      seccion: "2.3 Detalles del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "responsableTipoId",
      item: "12",
      etiqueta: "Tipo de identificación",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: "CAT_TIPO_ID_RESPONSABLE",
      multiple: false,
      anexo: false
    },
    {
      campo: "responsableNumeroId",
      item: "13",
      etiqueta: "Número de identificación",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "perfilProfesional",
      item: "14",
      etiqueta: "Perfil profesional",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: "CAT_PERFIL_PROFESIONAL",
      multiple: false,
      anexo: false
    },
    {
      campo: "perfilProfesionalOtro",
      item: "14.1",
      etiqueta: "¿Cuál?",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "codigoFicha",
      item: "15",
      etiqueta: "Código de la ficha: (generado)",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "fechaDiligenciamiento",
      item: "16",
      etiqueta: "Fecha diligenciamiento de la ficha",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "entornoAbordaje",
      item: "17",
      etiqueta: "Entorno de abordaje",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: "CAT_ENTORNO",
      multiple: false,
      anexo: false
    },
    {
      campo: "nombreInstitucion",
      item: "18",
      etiqueta: "Institución / Entidad / Organización",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "cabezaFamilia",
      item: "19",
      etiqueta: "Cabeza de familia / Líder / Representante legal",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "jovenesEnPaz",
      item: "20",
      etiqueta: "¿Habitantes en Prog. Jóvenes en Paz?",
      seccion: "2.4 Detalle de personal del Equipo de Salud",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "direccion",
      item: "21",
      etiqueta: "Dirección",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "latitud",
      item: "22",
      etiqueta: "Latitud",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "longitud",
      item: "23",
      etiqueta: "Longitud",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "ubicacionReferencia",
      item: "24",
      etiqueta: "Ubicación del hogar (punto de referencia)",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "telefonoVivienda",
      item: "A2.15",
      etiqueta: "Teléfono de la vivienda",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "nuv",
      item: "",
      etiqueta: "NUV (número único de vivienda)",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "idHogar",
      item: "25",
      etiqueta: "N.° de Identificación del hogar: (automático)",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "idFamilia",
      item: "26",
      etiqueta: "N.° de Identificación de la familia: (automático)",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "estrato",
      item: "27",
      etiqueta: "Estrato socioeconómico de la vivienda",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: "CAT_ESTRATO",
      multiple: false,
      anexo: false
    },
    {
      campo: "hogaresEnVivienda",
      item: "28",
      etiqueta: "N.° de hogares familiares en la vivienda",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "personasEnVivienda",
      item: "29",
      etiqueta: "N.° de personas en la vivienda",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "habitacionesVivienda",
      item: "30",
      etiqueta: "N.° de habitaciones por vivienda",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "elementosParaDormir",
      item: "31",
      etiqueta: "¿Cuántos elementos para dormir hay actualmente en su hogar?",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "personasPorHabitacion",
      item: "32",
      etiqueta: "N.° personas por habitación: (cálculo auto)",
      seccion: "2.5 Datos generales de la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "tipoVivienda",
      item: "34",
      etiqueta: "Tipo de vivienda",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_TIPO_VIVIENDA",
      multiple: false,
      anexo: false
    },
    {
      campo: "materialTecho",
      item: "35",
      etiqueta: "Material de la cubierta o techo",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_MATERIAL_TECHO",
      multiple: false,
      anexo: false
    },
    {
      campo: "ambientesLuzNatural",
      item: "A2.34",
      etiqueta: "Ambientes de la vivienda con luz natural",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_AMBIENTES_VIVIENDA",
      multiple: true,
      anexo: true
    },
    {
      campo: "ambientesVentilacion",
      item: "A2.35",
      etiqueta: "Ambientes de la vivienda con ventilación natural o artificial",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_AMBIENTES_VIVIENDA",
      multiple: true,
      anexo: true
    },
    {
      campo: "elementosVivienda",
      item: "A2.36",
      etiqueta: "Elementos que hay en la vivienda",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_ELEMENTOS_VIVIENDA",
      multiple: true,
      anexo: true
    },
    {
      campo: "alumbrado",
      item: "A2.37",
      etiqueta: "Alumbrado predominante en la vivienda",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_ALUMBRADO",
      multiple: false,
      anexo: true
    },
    {
      campo: "cocinaSeparada",
      item: "A2.41",
      etiqueta: "¿La cocina está separada de los demás espacios de la vivienda?",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "banoSeparado",
      item: "A2.42",
      etiqueta: "¿El baño está separado de los demás espacios de la vivienda?",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "dormitoriosSeparados",
      item: "A2.43",
      etiqueta: "¿Los dormitorios están separados físicamente?",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "riesgosAccidente",
      item: "36",
      etiqueta: "Escenarios de riesgo de accidente en la vivienda",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_RIESGOS_ACCIDENTE",
      multiple: true,
      anexo: false
    },
    {
      campo: "vectores",
      item: "37",
      etiqueta: "Criaderos o reservorios de vectores (mosquitos, ratas, etc.)",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: false
    },
    {
      campo: "factoresContaminacion",
      item: "38",
      etiqueta: "Cerca de la vivienda hay",
      seccion: "3.1 Características y condiciones del entorno y de la vivienda",
      catalogo: "CAT_FACTORES_CONTAMINACION",
      multiple: true,
      anexo: false
    },
    {
      campo: "actividadEconomica",
      item: "39",
      etiqueta: "Actividad económica en el interior de la vivienda",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "areaTrabajoIndependiente",
      item: "A2.51",
      etiqueta: "¿El área de trabajo es independiente de las demás áreas de la vivienda?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "familiarAfectadoActividad",
      item: "A2.52",
      etiqueta: "¿Algún integrante de la familia se ha visto afectado por la actividad económica?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "animales",
      item: "40",
      etiqueta: "Animales que conviven en la vivienda o entorno inmediato",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_ANIMALES",
      multiple: true,
      anexo: false
    },
    {
      campo: "animalesOtro",
      item: "40.1",
      etiqueta: "¿Cuál otro animal?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "perros",
      item: "41",
      etiqueta: "N.° de perros en la vivienda",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "perrosVacunados",
      item: "42",
      etiqueta: "Cantidad de perros con vacuna antirrábica",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "gatos",
      item: "43",
      etiqueta: "N.° de gatos en la vivienda",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "gatosVacunados",
      item: "44",
      etiqueta: "Cantidad de gatos con vacuna antirrábica",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "carnetAntirrabico",
      item: "45",
      etiqueta: "Carnet de vacuna antirrábica (perros/gatos) inferior a 3 años",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: false
    },
    {
      campo: "finalidadTenencia",
      item: "A2.97",
      etiqueta: "Finalidad de la tenencia de los animales",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_FINALIDAD_TENENCIA",
      multiple: true,
      anexo: true
    },
    {
      campo: "confinamientoAnimales",
      item: "A2.98",
      etiqueta: "Confinamiento de los animales",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_CONFINAMIENTO_ANIMALES",
      multiple: true,
      anexo: true
    },
    {
      campo: "desparasitaAnimales",
      item: "A2.99",
      etiqueta: "¿Se desparasita a los animales domésticos?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "instalacionesSegurasAnimales",
      item: "A2.100",
      etiqueta: "¿Las instalaciones para los animales son seguras?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "excretasAnimales",
      item: "A2.101",
      etiqueta: "¿Las excretas de los animales se recogen y disponen adecuadamente?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "barrerasContactoAnimales",
      item: "A2.102",
      etiqueta: "¿La vivienda tiene barreras que eviten el contacto directo con los animales?",
      seccion: "3.2 Oficios, ocupaciones y animales en la vivienda",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "fuenteAgua",
      item: "46",
      etiqueta: "Fuente principal de agua para consumo humano",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_FUENTE_AGUA",
      multiple: true,
      anexo: false
    },
    {
      campo: "horasSuministroAgua",
      item: "A2.54",
      etiqueta: "Horas al día con suministro de agua",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_HORAS_SUMINISTRO",
      multiple: false,
      anexo: true
    },
    {
      campo: "tanqueAlmacenamiento",
      item: "A2.55",
      etiqueta: "Tanque de almacenamiento de agua",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_TANQUE_AGUA",
      multiple: false,
      anexo: true
    },
    {
      campo: "frecuenciaLimpiezaTanque",
      item: "A2.56",
      etiqueta: "Frecuencia de limpieza del tanque",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_FRECUENCIA_LIMPIEZA_TANQUE",
      multiple: false,
      anexo: true
    },
    {
      campo: "distanciaTanque",
      item: "A2.57",
      etiqueta: "Distancia entre el tanque y el pozo séptico o el alcantarillado",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_DISTANCIA_TANQUE",
      multiple: false,
      anexo: true
    },
    {
      campo: "disposicionExcretas",
      item: "47",
      etiqueta: "Sistema de disposición de excretas",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_DISPOSICION_EXCRETAS",
      multiple: true,
      anexo: false
    },
    {
      campo: "aguasResiduales",
      item: "48",
      etiqueta: "Sistema de disposición de aguas residuales domésticas",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_AGUAS_RESIDUALES",
      multiple: true,
      anexo: false
    },
    {
      campo: "almacenamientoResiduos",
      item: "A2.60",
      etiqueta: "Almacenamiento de los residuos sólidos en la vivienda",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_ALMACENAMIENTO_RESIDUOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "almacenamientoResiduosOtro",
      item: "A2.61",
      etiqueta: "¿Qué otro sistema de almacenamiento?",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "residuosSolidos",
      item: "49",
      etiqueta: "Disposición final de los residuos sólidos ordinarios",
      seccion: "3.3 Agua y saneamiento básico",
      catalogo: "CAT_RESIDUOS_SOLIDOS",
      multiple: true,
      anexo: false
    },
    {
      campo: "accesoVivienda",
      item: "A2.38",
      etiqueta: "Acceso a la vivienda",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: "CAT_ACCESO_VIVIENDA",
      multiple: false,
      anexo: true
    },
    {
      campo: "otrosAccesosVivienda",
      item: "A2.39",
      etiqueta: "Otros accesos a la vivienda",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "mediosTransporte",
      item: "A2.44",
      etiqueta: "Medios de transporte habituales de la familia",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: "CAT_MEDIOS_TRANSPORTE",
      multiple: true,
      anexo: true
    },
    {
      campo: "mediosTransporteOtro",
      item: "A2.45",
      etiqueta: "¿Qué otro medio de transporte?",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "seguridadDesplazamiento",
      item: "A2.46",
      etiqueta: "Elementos de seguridad que usa la familia al desplazarse",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: "CAT_SEGURIDAD_DESPLAZAMIENTO",
      multiple: true,
      anexo: true
    },
    {
      campo: "seguridadDesplazamientoOtro",
      item: "A2.47",
      etiqueta: "¿Qué otro elemento de seguridad?",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "desplazamientoMayor30",
      item: "A2.48",
      etiqueta: "Factores que hacen que el desplazamiento tome más de 30 minutos",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: "CAT_DESPLAZAMIENTO_30",
      multiple: true,
      anexo: true
    },
    {
      campo: "desplazamientoMayor30Otro",
      item: "A2.49",
      etiqueta: "¿Qué otro factor?",
      seccion: "3.4 Acceso a la vivienda y desplazamiento",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "conocePracticasResiduos",
      item: "A2.63",
      etiqueta: "¿Conoce prácticas de reducción y separación de residuos en el hogar?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "realizaReduccionResiduos",
      item: "A2.64",
      etiqueta: "¿Realiza prácticas de reducción y separación de residuos?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "formasReduccionResiduos",
      item: "A2.65",
      etiqueta: "¿Cómo reduce la generación de residuos?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_REDUCCION_RESIDUOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "formasReduccionResiduosOtro",
      item: "A2.66",
      etiqueta: "¿Qué otra práctica de reducción?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "realizaAprovechamientoResiduos",
      item: "A2.67",
      etiqueta: "¿Realiza prácticas de aprovechamiento de residuos?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "practicasAprovechamiento",
      item: "A2.68",
      etiqueta: "¿Qué prácticas de aprovechamiento de residuos realiza?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "disposicionResiduosPeligrosos",
      item: "A2.69",
      etiqueta: "¿Cómo dispone los residuos peligrosos (pilas, bombillos, medicamentos, envases de químicos)?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_DISPOSICION_PELIGROSOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "disposicionResiduosPeligrososOtro",
      item: "A2.70",
      etiqueta: "¿Qué otra forma de disposición de residuos peligrosos?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "reduccionSeparacionRural",
      item: "A2.71",
      etiqueta: "¿Realiza procesos de reducción y separación de residuos rurales?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "aprovechamientoRural",
      item: "A2.72",
      etiqueta: "¿Qué prácticas de aprovechamiento de residuos rurales realiza?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_APROVECHAMIENTO_RURAL",
      multiple: true,
      anexo: true
    },
    {
      campo: "aprovechamientoRuralOtro",
      item: "A2.73",
      etiqueta: "¿Qué otra práctica de aprovechamiento rural?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "separacionRural",
      item: "A2.74",
      etiqueta: "¿Qué prácticas de separación de residuos aplica?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_SEPARACION_RESIDUOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "separacionRuralOtro",
      item: "A2.75",
      etiqueta: "¿Qué otra práctica de separación?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "limpiezaSuperficies",
      item: "A2.76",
      etiqueta: "¿Cómo se realiza la limpieza de superficies?",
      seccion: "3.5 Manejo de residuos",
      catalogo: "CAT_LIMPIEZA_SUPERFICIES",
      multiple: false,
      anexo: true
    },
    {
      campo: "limpiezaSuperficiesOtro",
      item: "A2.77",
      etiqueta: "¿Qué otra práctica de limpieza?",
      seccion: "3.5 Manejo de residuos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "energiaCocinar",
      item: "A2.78",
      etiqueta: "Fuente de energía para cocinar",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: "CAT_ENERGIA_COCINAR",
      multiple: true,
      anexo: true
    },
    {
      campo: "energiaCocinarOtro",
      item: "A2.79",
      etiqueta: "¿Qué otra fuente de energía?",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "fuentesHumo",
      item: "A2.80",
      etiqueta: "Fuentes frecuentes de humo en el hogar",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: "CAT_FUENTES_HUMO",
      multiple: true,
      anexo: true
    },
    {
      campo: "fuentesHumoOtro",
      item: "A2.81",
      etiqueta: "¿Qué otra fuente de humo?",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "practicasCalidadAire",
      item: "A2.82",
      etiqueta: "Prácticas que afectan la calidad del aire",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: "CAT_PRACTICAS_CALIDAD_AIRE",
      multiple: true,
      anexo: true
    },
    {
      campo: "tipoEstufa",
      item: "A2.83",
      etiqueta: "Tipo de estufa",
      seccion: "3.6 Calidad del aire y energía",
      catalogo: "CAT_TIPO_ESTUFA",
      multiple: true,
      anexo: true
    },
    {
      campo: "vectoresPresentes",
      item: "A2.85",
      etiqueta: "Vectores transmisores de enfermedades presentes en la vivienda",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: "CAT_VECTORES",
      multiple: true,
      anexo: true
    },
    {
      campo: "vectoresPresentesOtro",
      item: "A2.86",
      etiqueta: "¿Qué otro vector?",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "medidasControlVectores",
      item: "A2.87",
      etiqueta: "Medidas para el control de vectores transmisores de enfermedades",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: "CAT_MEDIDAS_VECTORES",
      multiple: true,
      anexo: true
    },
    {
      campo: "medidasControlVectoresOtro",
      item: "A2.88",
      etiqueta: "¿Qué otra medida de control?",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "animalesPonzonosos",
      item: "A2.89",
      etiqueta: "Animales ponzoñosos en el hogar",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: "CAT_ANIMALES_PONZONOSOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "animalesPonzonososOtro",
      item: "A2.90",
      etiqueta: "¿Qué otro animal ponzoñoso?",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "medidasPonzonosos",
      item: "A2.91",
      etiqueta: "Medidas para reducir el riesgo de animales ponzoñosos",
      seccion: "3.7 Vectores y animales ponzoñosos",
      catalogo: "CAT_MEDIDAS_PONZONOSOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "lugarQuimicos",
      item: "A2.104",
      etiqueta: "Lugar donde adquiere los productos químicos del hogar",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: "CAT_LUGAR_QUIMICOS",
      multiple: false,
      anexo: true
    },
    {
      campo: "disposicionQuimicos",
      item: "A2.105",
      etiqueta: "Disposición final de los residuos químicos",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: "CAT_DISPOSICION_QUIMICOS",
      multiple: true,
      anexo: true
    },
    {
      campo: "disposicionQuimicosOtro",
      item: "A2.106",
      etiqueta: "¿Qué otra práctica de disposición de químicos?",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "instruccionesQuimicos",
      item: "A2.107",
      etiqueta: "¿Sigue las instrucciones del fabricante para manejar y almacenar los químicos?",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "envaseOriginalQuimicos",
      item: "A2.108",
      etiqueta: "¿Los productos químicos se guardan en su envase original y en un lugar asignado?",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "proteccionLimpieza",
      item: "A2.109",
      etiqueta: "¿Usa protección y ventila al limpiar con químicos?",
      seccion: "3.8 Productos químicos en el hogar",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "motivoSinGeorreferenciacion",
      item: "",
      etiqueta: "Motivo por el cual no fue posible georreferenciar la vivienda",
      seccion: "Validación de completitud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "visitaIncompleta",
      item: "",
      etiqueta: "Cierre por causa externa",
      seccion: "Validación de completitud",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "motivoVisitaIncompleta",
      item: "",
      etiqueta: "Motivo del cierre incompleto",
      seccion: "Validación de completitud",
      catalogo: null,
      multiple: false,
      anexo: false
    }
  ],
  familia: [
    {
      campo: "hogarNumero",
      item: "",
      etiqueta: "Hogar al que pertenece",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "aliasFamilia",
      item: "A2.111",
      etiqueta: "Alias de la familia",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "tipoFamilia",
      item: "50",
      etiqueta: "Tipo de familia",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: "CAT_TIPO_FAMILIA",
      multiple: false,
      anexo: false
    },
    {
      campo: "numeroIntegrantes",
      item: "51",
      etiqueta: "N.° de personas que conforman la familia",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "idFamiliaBloque",
      item: "",
      etiqueta: "N.° de ID de la familia",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "codigoCf",
      item: "",
      etiqueta: "Código de la visita a la familia (CF)",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "cuidadorPrincipal",
      item: "52",
      etiqueta: "Cuidador principal identificado en la familia (niños, personas mayores, etc.)",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "zaritPuntaje",
      item: "A2.115",
      etiqueta: "Escala ZARIT: puntaje del cuidador principal",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "apgarFamiliar",
      item: "A2.113",
      etiqueta: "APGAR familiar (funcionalidad de la familia)",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: "CAT_APGAR",
      multiple: false,
      anexo: true
    },
    {
      campo: "situacionesRiesgo",
      item: "54",
      etiqueta: "Situaciones o condiciones de riesgo para la salud (física o mental)",
      seccion: "4.1 Estructura y contexto familiar",
      catalogo: "CAT_SITUACIONES_RIESGO_FAMILIAR",
      multiple: true,
      anexo: false
    },
    {
      campo: "practicasVinculo",
      item: "55",
      etiqueta: "Prácticas que favorecen los vínculos familiares",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: "CAT_PRACTICAS_VINCULO",
      multiple: true,
      anexo: false
    },
    {
      campo: "redesApoyo",
      item: "56",
      etiqueta: "Redes de apoyo social",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: "CAT_REDES_APOYO",
      multiple: false,
      anexo: false
    },
    {
      campo: "practicasCuidadoHogar",
      item: "57",
      etiqueta: "Prácticas para el cuidado de la salud y protección en el hogar",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: "CAT_PRACTICAS_CUIDADO_HOGAR",
      multiple: true,
      anexo: false
    },
    {
      campo: "medidasRespiratorias",
      item: "A2.120",
      etiqueta: "Medida principal ante enfermedades respiratorias en el hogar",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: "CAT_MEDIDAS_RESPIRATORIAS",
      multiple: false,
      anexo: true
    },
    {
      campo: "medidasRespiratoriasOtro",
      item: "A2.121",
      etiqueta: "¿Qué otra medida?",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "higieneCompartida",
      item: "A2.122",
      etiqueta: "¿Los integrantes comparten implementos de higiene personal?",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "sinContactoTelefonico",
      item: "",
      etiqueta: "Novedad de contacto",
      seccion: "4.2 Prácticas protectoras en la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    }
  ],
  integrante: [
    {
      campo: "primerNombre",
      item: "58",
      etiqueta: "Primer Nombre",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "segundoNombre",
      item: "59",
      etiqueta: "Segundo Nombre",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "primerApellido",
      item: "60",
      etiqueta: "Primer Apellido",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "segundoApellido",
      item: "61",
      etiqueta: "Segundo Apellido",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "tipoId",
      item: "62",
      etiqueta: "Tipo de identificación",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_TIPO_ID_INTEGRANTE",
      multiple: false,
      anexo: false
    },
    {
      campo: "numeroId",
      item: "63",
      etiqueta: "Número de identificación",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "fechaNacimiento",
      item: "64",
      etiqueta: "Fecha de nacimiento",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "edadCalculada",
      item: "",
      etiqueta: "Edad (cálculo automático)",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "nacionalidad",
      item: "65",
      etiqueta: "País de origen",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_PAIS",
      multiple: false,
      anexo: false
    },
    {
      campo: "estatusMigratorio",
      item: "A3.10",
      etiqueta: "Estatus migratorio",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_ESTATUS_MIGRATORIO",
      multiple: false,
      anexo: true
    },
    {
      campo: "sexo",
      item: "66",
      etiqueta: "Sexo",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_SEXO",
      multiple: false,
      anexo: false
    },
    {
      campo: "genero",
      item: "67",
      etiqueta: "Género",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_GENERO",
      multiple: false,
      anexo: false
    },
    {
      campo: "autoidentificacionGenero",
      item: "68",
      etiqueta: "Usted se identifica como",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_AUTOIDENTIFICACION_GENERO",
      multiple: false,
      anexo: false
    },
    {
      campo: "autoidentificacionGeneroOtro",
      item: "68.1",
      etiqueta: "¿Cuál?",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "orientacionSexual",
      item: "69",
      etiqueta: "Cuál es su orientación sexual",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_ORIENTACION_SEXUAL",
      multiple: false,
      anexo: false
    },
    {
      campo: "orientacionSexualOtro",
      item: "69.1",
      etiqueta: "¿Cuál?",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "telefono1",
      item: "70",
      etiqueta: "Teléfono 1",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "telefono2",
      item: "71",
      etiqueta: "Teléfono 2",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "rolFamiliar",
      item: "72",
      etiqueta: "Rol dentro de la familia",
      seccion: "5.1 Identificación de cada uno de los integrantes de la familia",
      catalogo: "CAT_ROL_FAMILIAR",
      multiple: false,
      anexo: false
    },
    {
      campo: "ocupacion",
      item: "73",
      etiqueta: "Ocupación (código CIUO)",
      seccion: "5.2 Características socioeconómicas",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "nivelEducativo",
      item: "74",
      etiqueta: "Nivel Educativo",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_NIVEL_EDUCATIVO",
      multiple: false,
      anexo: false
    },
    {
      campo: "regimenAfiliacion",
      item: "75",
      etiqueta: "Régimen de afiliación",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_REGIMEN_AFILIACION",
      multiple: false,
      anexo: false
    },
    {
      campo: "eapb",
      item: "76",
      etiqueta: "EAPB",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_EAPB",
      multiple: false,
      anexo: false
    },
    {
      campo: "sujetoEspecialProteccion",
      item: "77",
      etiqueta: "Sujeto de especial protección o condiciones de riesgo",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_SUJETO_ESPECIAL_PROTECCION",
      multiple: true,
      anexo: false
    },
    {
      campo: "sujetoEspecialProteccionOtro",
      item: "77.1",
      etiqueta: "¿Cuál?",
      seccion: "5.2 Características socioeconómicas",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "modalidadViolencia",
      item: "78",
      etiqueta: "Modalidad de la violencia",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_MODALIDAD_VIOLENCIA",
      multiple: true,
      anexo: false
    },
    {
      campo: "pertenenciaEtnica",
      item: "79",
      etiqueta: "Pertenencia étnica",
      seccion: "5.2 Características socioeconómicas",
      catalogo: "CAT_PERTENENCIA_ETNICA",
      multiple: false,
      anexo: false
    },
    {
      campo: "puebloEtnico",
      item: "80",
      etiqueta: "Pueblo o comunidad étnica",
      seccion: "5.2 Características socioeconómicas",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "saberesAncestrales",
      item: "81",
      etiqueta: "Prácticas de cuidado de la salud desde sus saberes ancestrales / tradicionales",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SABERES_ANCESTRALES",
      multiple: true,
      anexo: false
    },
    {
      campo: "discapacidad",
      item: "82",
      etiqueta: "¿Se reconoce como persona con discapacidad?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_DISCAPACIDAD",
      multiple: true,
      anexo: false
    },
    {
      campo: "certificacionRlcpd",
      item: "83",
      etiqueta: "Tiene certificación y registro de discapacidad (RLCPD)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: false
    },
    {
      campo: "intencionReproductiva",
      item: "84",
      etiqueta: "Intención reproductiva a corto plazo",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "gestacionActual",
      item: "85",
      etiqueta: "Gestación actual confirmada",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "practicasCuidado",
      item: "86",
      etiqueta: "¿Realiza rutinariamente las siguientes prácticas para el cuidado de la salud?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_PRACTICAS_CUIDADO",
      multiple: true,
      anexo: false
    },
    {
      campo: "atencionesPendientesRpms",
      item: "87",
      etiqueta: "Atenciones pendientes de promoción y mantenimiento",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ATENCIONES_RPMS",
      multiple: true,
      anexo: false
    },
    {
      campo: "atencionesPendientesMaterno",
      item: "88",
      etiqueta: "Atenciones pendientes de la ruta materno perinatal",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ATENCIONES_MATERNO",
      multiple: true,
      anexo: false
    },
    {
      campo: "barrerasAcceso",
      item: "89",
      etiqueta: "Motivo por el cual no ha recibido las atenciones de promoción y mantenimiento o materno perinatal",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_BARRERAS_ACCESO",
      multiple: true,
      anexo: false
    },
    {
      campo: "conocimientoDerecho",
      item: "90",
      etiqueta: "Prácticas para el ejercicio y exigibilidad del derecho a la salud",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_CONOCIMIENTO_DERECHO",
      multiple: true,
      anexo: false
    },
    {
      campo: "lactanciaExclusiva",
      item: "91",
      etiqueta: "Si es menor de 6 meses, ¿recibe lactancia materna exclusiva?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: false
    },
    {
      campo: "peso",
      item: "92",
      etiqueta: "Peso (en kilogramos)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "talla",
      item: "93",
      etiqueta: "Talla (en centímetros)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "circunferenciaCintura",
      item: "94",
      etiqueta: "Circunferencia de cintura (cm)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "imc",
      item: "95",
      etiqueta: "Resultado del IMC (cálculo automático)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "clasificacionAntropometrica",
      item: "96",
      etiqueta: "Clasificación antropométrica del estado nutricional según indicador Peso para la Talla (P/T) o IMC para la edad",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_CLASIFICACION_ANTROPOMETRICA",
      multiple: false,
      anexo: false
    },
    {
      campo: "signosDesnutricion",
      item: "97",
      etiqueta: "Se identifican signos físicos de desnutrición aguda en niños y niñas de 3 meses a 5 años",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SIGNOS_DESNUTRICION",
      multiple: true,
      anexo: false
    },
    {
      campo: "lavadoManos",
      item: "A3.43",
      etiqueta: "¿Se lava las manos con agua y jabón?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "tensionSistolica",
      item: "98",
      etiqueta: "Tensión arterial sistólica (mm Hg)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "tensionDiastolica",
      item: "98",
      etiqueta: "Tensión arterial diastólica (mm Hg)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "clasificacionTension",
      item: "99",
      etiqueta: "Clasificación de la Tensión arterial (AHA 2024) (cálculo automático)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_CLASIFICACION_TENSION",
      multiple: false,
      anexo: false
    },
    {
      campo: "urgenciasAccidente",
      item: "A3.47",
      etiqueta: "¿Acudió a urgencias por algún accidente en el hogar?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_URGENCIAS_HOGAR",
      multiple: true,
      anexo: true
    },
    {
      campo: "enfermedadesUltimoMes",
      item: "A3.48",
      etiqueta: "Enfermedades sufridas en el último mes",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ENFERMEDADES_ULTIMO_MES",
      multiple: true,
      anexo: true
    },
    {
      campo: "enfermedadesUltimoMesOtra",
      item: "A3.49",
      etiqueta: "¿Qué otra enfermedad?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "accionAfeccion",
      item: "A3.50",
      etiqueta: "¿Qué hizo ante la afección del último mes?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ACCION_AFECCION",
      multiple: false,
      anexo: true
    },
    {
      campo: "accionAfeccionOtra",
      item: "A3.51",
      etiqueta: "¿Qué otra acción tomó?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "tieneDiagnostico",
      item: "A3.56",
      etiqueta: "¿Tiene diagnóstico de alguna enfermedad?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "sintomasSinDiagnostico",
      item: "A3.57",
      etiqueta: "¿Tiene signos y síntomas compatibles con alguna enfermedad, sin diagnóstico?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "enfermedadesNoTransmisibles",
      item: "100",
      etiqueta: "¿Algún profesional de salud le ha diagnosticado o le ha dicho que tiene alguna enfermedad no transmisible?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ENFERMEDADES_NO_TRANSMISIBLES",
      multiple: true,
      anexo: false
    },
    {
      campo: "condicionesTransmisibles",
      item: "101",
      etiqueta: "¿Presenta alguna de las siguientes situaciones o condiciones de salud transmisible?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_CONDICIONES_TRANSMISIBLES",
      multiple: true,
      anexo: false
    },
    {
      campo: "zonaEndemica",
      item: "102",
      etiqueta: "¿Vive en zona endémica para alguno de los siguientes eventos o presenta signos y síntomas?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_ZONA_ENDEMICA",
      multiple: false,
      anexo: false
    },
    {
      campo: "adherenciaTratamiento",
      item: "103",
      etiqueta: "Recibe atención y tratamiento actual (si hay alguna condición en los ítems 100 a 102)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: false
    },
    {
      campo: "motivoNoTratamiento",
      item: "104",
      etiqueta: "Motivo(s) por el (los) cual(es) no ha recibido la atención",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_MOTIVO_NO_TRATAMIENTO",
      multiple: true,
      anexo: false
    },
    {
      campo: "riesgosSaludMentalJoven",
      item: "105",
      etiqueta: "Situaciones que identifica como riesgo para su salud física o mental",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_RIESGOS_SALUD_MENTAL_JOVEN",
      multiple: true,
      anexo: false
    },
    {
      campo: "sintomatologiaDepresiva",
      item: "106",
      etiqueta: "Durante más de dos semanas (sólo personas mayores de 14 años)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SINTOMATOLOGIA_DEPRESIVA",
      multiple: true,
      anexo: false
    },
    {
      campo: "ideacionSuicida",
      item: "107",
      etiqueta: "Durante los últimos 8 días (sólo personas mayores de 14 años)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_IDEACION_SUICIDA",
      multiple: false,
      anexo: false
    },
    {
      campo: "consumoSpa",
      item: "108",
      etiqueta: "Consumo de sustancias psicoactivas, incluyendo alcohol y tabaco",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "consumoTabaco",
      item: "A3.64",
      etiqueta: "¿Consume tabaco?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_CONSUMO_TABACO",
      multiple: false,
      anexo: true
    },
    {
      campo: "cigarrillosDiarios",
      item: "A3.65",
      etiqueta: "Consumo máximo de cigarrillos diarios (en los últimos 15 años)",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "aniosFumando",
      item: "A3.66",
      etiqueta: "Años que ha fumado",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "puntajeAssist",
      item: "",
      etiqueta: "Puntaje riesgo ASSIST",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "puntajeAudit",
      item: "",
      etiqueta: "Puntaje riesgo AUDIT",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "puntajeCrafft",
      item: "",
      etiqueta: "Puntaje riesgo CRAFFT",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: null,
      multiple: false,
      anexo: false
    },
    {
      campo: "limitacionCotidiana",
      item: "110",
      etiqueta: "¿Ha presentado alguna otra situación de salud que limite sus actividades cotidianas en la última semana?",
      seccion: "5.3 Situación de salud, servicios y prácticas de cuidado",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: false
    },
    {
      campo: "fechaUltimaMenstruacion",
      item: "A3.70",
      etiqueta: "Fecha de la última menstruación (FUM)",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "conoceIve",
      item: "A3.74",
      etiqueta: "¿Conoce sobre la Interrupción Voluntaria del Embarazo (IVE)?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "atencionPreconcepcional",
      item: "A3.81",
      etiqueta: "¿Ha recibido atención para el cuidado preconcepcional?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "conoceSignosAlarma",
      item: "A3.73",
      etiqueta: "¿Conoce los signos de alarma en el embarazo?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "inicioPrenatales",
      item: "A3.75",
      etiqueta: "¿Inició atenciones prenatales?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "inicioOportunoPrenatal",
      item: "A3.76",
      etiqueta: "¿Inició oportunamente la atención prenatal?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "numeroAtencionesPrenatales",
      item: "A3.80",
      etiqueta: "Número de atenciones prenatales hasta el momento",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "controlesPrenatales",
      item: "A3.82",
      etiqueta: "¿Recibe atención para el cuidado prenatal (controles prenatales)?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "riesgoGestacional",
      item: "A3.78",
      etiqueta: "Clasificación del riesgo gestacional",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_RIESGO_GESTACIONAL",
      multiple: false,
      anexo: true
    },
    {
      campo: "riesgoPreeclampsia",
      item: "A3.79",
      etiqueta: "Clasificación del riesgo de preeclampsia",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_RIESGO_PREECLAMPSIA",
      multiple: false,
      anexo: true
    },
    {
      campo: "sesionesPreparacion",
      item: "A3.83",
      etiqueta: "Sesiones de preparación para la maternidad y paternidad",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "accesoAnticonceptivosPostparto",
      item: "A3.77",
      etiqueta: "¿Tiene acceso a métodos anticonceptivos postparto?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "fechaEventoObstetrico",
      item: "A3.84",
      etiqueta: "Fecha de atención del evento obstétrico (probable o del parto)",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "puerperio48h",
      item: "A3.85",
      etiqueta: "¿Recibió atención del puerperio en las primeras 48 horas?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "seguimientoPuerperio",
      item: "A3.86",
      etiqueta: "¿Tuvo consulta de seguimiento al puerperio entre el tercer y quinto día?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "apoyoLactancia",
      item: "A3.87",
      etiqueta: "¿Recibió apoyo a la lactancia materna?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "atencionRecienNacido24h",
      item: "A3.88",
      etiqueta: "¿El recién nacido fue atendido durante sus primeras 24 horas de vida?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "controlRecienNacido",
      item: "A3.89",
      etiqueta: "¿El recién nacido tuvo control entre el tercer y quinto día?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "vacunacionRecienNacido",
      item: "A3.90",
      etiqueta: "¿El recién nacido fue vacunado?",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "metodoAnticonceptivoPostparto",
      item: "A3.91",
      etiqueta: "Método anticonceptivo postparto inmediato",
      seccion: "5.4 Salud materna y perinatal",
      catalogo: "CAT_METODO_ANTICONCEPTIVO_POSTPARTO",
      multiple: false,
      anexo: true
    },
    {
      campo: "historialLaboral",
      item: "A3.92",
      etiqueta: "¿Cuenta con historial laboral?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "trabajoRecienteLugar",
      item: "A3.93",
      etiqueta: "Lugar de trabajo o actividad específica más reciente",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "trabajoRecienteEmpleador",
      item: "A3.94",
      etiqueta: "Nombre del empleador",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "trabajoRecienteMeses",
      item: "A3.95",
      etiqueta: "Periodo laboral (meses)",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleosPrevios",
      item: "A3.96",
      etiqueta: "¿Cuenta con más empleos previos al actual?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO",
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio1Lugar",
      item: "A3.97",
      etiqueta: "Empleo previo 1: lugar de trabajo o actividad específica",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio1Empleador",
      item: "A3.98",
      etiqueta: "Empleo previo 1: nombre del empleador",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio1Meses",
      item: "A3.99",
      etiqueta: "Empleo previo 1: periodo laboral (meses)",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio2Lugar",
      item: "A3.100",
      etiqueta: "Empleo previo 2: lugar de trabajo o actividad específica",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio2Empleador",
      item: "A3.101",
      etiqueta: "Empleo previo 2: nombre del empleador",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "empleoPrevio2Meses",
      item: "A3.102",
      etiqueta: "Empleo previo 2: periodo laboral (meses)",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: null,
      multiple: false,
      anexo: true
    },
    {
      campo: "actividadInvolucraAsbesto",
      item: "A3.103",
      etiqueta: "En alguno de sus trabajos, ¿ha realizado alguna actividad que involucre asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "actividadRelacionadaAsbesto",
      item: "A3.104",
      etiqueta: "En alguno de sus trabajos, ¿ha realizado alguna actividad relacionada con asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "actividadesAsbesto",
      item: "A3.105",
      etiqueta: "¿Cuáles actividades relacionadas con asbesto ha realizado?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_ACTIVIDADES_ASBESTO",
      multiple: true,
      anexo: true
    },
    {
      campo: "interactuoMaterialesAsbesto",
      item: "A3.106",
      etiqueta: "¿Ha interactuado con materiales que tengan asbesto en sus trabajos?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "materialesAsbestoTrabajo",
      item: "A3.107",
      etiqueta: "¿Con cuáles materiales con asbesto interactuó?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_MATERIALES_ASBESTO_TRABAJO",
      multiple: true,
      anexo: true
    },
    {
      campo: "modalidadEmpleoAsbesto",
      item: "A3.108",
      etiqueta: "¿En qué modalidad de empleo se presentó mayormente la exposición?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_MODALIDAD_EMPLEO",
      multiple: false,
      anexo: true
    },
    {
      campo: "materialesAsbestoHogar",
      item: "A3.109",
      etiqueta: "En su hogar, ¿ha tenido alguna vez materiales que contengan asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "elementosAsbestoHogar",
      item: "A3.110",
      etiqueta: "¿Cuáles elementos del hogar tienen presencia de asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_ELEMENTOS_ASBESTO_HOGAR",
      multiple: true,
      anexo: true
    },
    {
      campo: "estadoMaterialesAsbesto",
      item: "A3.111",
      etiqueta: "¿En qué estado se encuentran los materiales con asbesto de la vivienda?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_ESTADO_MATERIALES",
      multiple: false,
      anexo: true
    },
    {
      campo: "conviveTrabajadorAsbesto",
      item: "A3.112",
      etiqueta: "En su hogar, ¿convive con alguien que haya trabajado con asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "reparacionesAsbesto",
      item: "A3.113",
      etiqueta: "¿Ha hecho reparaciones en su vivienda con materiales que contengan asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "actividadAsbestoCerca",
      item: "A3.114",
      etiqueta: "¿Recuerda alguna actividad que haya implicado asbesto cerca de su hogar?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    },
    {
      campo: "actividadesAsbestoCerca",
      item: "A3.115",
      etiqueta: "¿Cuál actividad con asbesto se realizó cerca de su hogar?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_ACTIVIDADES_ASBESTO_CERCA",
      multiple: false,
      anexo: true
    },
    {
      campo: "familiaresEnfermedadAsbesto",
      item: "A3.116",
      etiqueta: "¿Ha tenido familiares con enfermedades relacionadas con asbesto?",
      seccion: "5.5 Historial laboral y exposición a asbesto",
      catalogo: "CAT_SI_NO_NA",
      multiple: false,
      anexo: true
    }
  ]
};

module.exports = { CAMPOS_FICHA };
