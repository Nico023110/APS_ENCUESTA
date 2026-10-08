/* =========================================================
   Encuesta_APS — Guía de diligenciamiento por campo
   ---------------------------------------------------------
   Fuente: «Manual de usuario para el formulario de identificación
   de necesidades en salud» (ficha técnica de caracterización APS,
   anexo técnico PISIS APS124CCFP, Ministerio de Salud y Protección
   Social). Su sección 5 define, para cada una de las 98 variables
   del instrumento, qué es el dato y cómo se diligencia.

   El formulario de la aplicación es el SI-APS v2 2025 (140 ítems) y
   conserva su numeración. Cada entrada se ancla al `data-campo` del
   formulario y cita la variable equivalente de la ficha técnica, que
   casi nunca tiene el mismo número. Donde la aplicación resuelve el
   dato de otra forma (un valor fijo, un catálogo, la sesión), la
   instrucción lo dice: la guía describe lo que el encuestador ve.

   La ayuda equivale a las «ayudas emergentes» del instrumento en
   Excel: un botón junto a la etiqueta despliega la explicación sin
   tapar el campo. Se inyecta antes de guardar los prototipos de los
   bloques repetibles (formulario.js), así que las familias y los
   integrantes nuevos la traen al clonarse.

   Estructura de una entrada:
     variable  número(s) de la variable en la ficha técnica; null si
               el criterio no sale de la ficha
     fuente    (opcional) texto de procedencia cuando variable es null
     que       descripción de la variable (qué es)
     opciones  (opcional) [término, definición] de las respuestas
     como      instrucción de diligenciamiento
   ========================================================= */

'use strict';

const GUIA_CAMPOS = {

  /* ---------------- I. Información general ---------------- */

  departamento: {
    variable: '1',
    que: 'Áreas culturales y económicas dentro de las regiones geográficas del país.',
    como: 'Departamento o distrito donde se aplica el instrumento. En este despliegue queda fijo en 76 – Valle del Cauca.'
  },

  uzpe: {
    variable: '2',
    que: 'Unidad Zonal de Planeación y Evaluación: área más pequeña que el departamento y más grande que el municipio. ' +
      'En un departamento une varios municipios; en un distrito, varios barrios. Sirve de unidad territorial para la ' +
      'planeación y la evaluación del desarrollo.',
    como: 'Código del anexo de territorialización APS124TERR: las letras UZPE seguidas de un serial de 3 dígitos ' +
      '(UZPE001, UZPE002…). Si el departamento o distrito no tiene esta desagregación se usa UZPE999. ' +
      'En la aplicación se elige de la lista de UZPE vigentes.'
  },

  municipio: {
    variable: '3',
    que: 'Municipio: entidad territorial fundamental de la división político-administrativa del Estado, con autonomía ' +
      'política, fiscal y administrativa. Área no municipalizada: centro poblado que, con sus alrededores, no pertenece ' +
      'a ningún municipio.',
    como: 'Municipio donde se aplica el instrumento. En este despliegue queda fijo en 76001 – Santiago de Cali.'
  },

  territorio: {
    variable: '4',
    que: 'Espacio en el que se comparten dinámicas geográficas, poblacionales, socioambientales y culturales que inciden ' +
      'en las condiciones de salud. Es el primer nivel de territorialización en que se subdivide un municipio.',
    como: 'Código del territorio concertado entre el prestador y la entidad territorial (anexo APS124TERR): la letra T ' +
      'seguida de un serial (T01, T02, T03…). T99 corresponde a «No aplica» cuando el municipio no tiene ' +
      'territorialización. En Cali los territorios van de T01 a T110.'
  },

  microterritorio: {
    variable: '5',
    que: 'Espacio territorial y social conformado por un número de familias, que puede ajustarse según la ' +
      'concentración o la dispersión de la población.',
    como: 'Código del microterritorio dentro del territorio (anexo APS124TERR): las letras MT seguidas de un serial de ' +
      '2 dígitos (MT01, MT02…). MT99 corresponde a «No aplica». La lista se filtra según el territorio del ítem 7.'
  },

  divisionTerritorial: {
    variable: '6',
    que: 'Micro-localización de la vivienda dentro del microterritorio.',
    opciones: [
      ['Corregimiento o centro poblado', 'núcleo de población con una concentración de al menos 20 viviendas contiguas.'],
      ['Vereda', 'división territorial de carácter administrativo en el área rural del municipio, establecida por acuerdo municipal.'],
      ['Localidad', 'lugar donde se ubica la sede administrativa de un municipio.'],
      ['Barrio', 'conglomerado de viviendas del área urbana.'],
      ['Resguardo indígena', 'territorio constituido por comunidades étnicas.']
    ],
    como: 'Escriba el nombre del corregimiento, centro poblado, vereda, localidad, barrio o resguardo indígena donde se ' +
      'realiza la visita.'
  },

  equipoSaludId: {
    variable: '15',
    que: 'Identificador que el prestador u organismo al que está inscrito el Equipo Básico de Salud le asigna dentro ' +
      'del territorio.',
    como: 'Las letras EBS seguidas de un consecutivo de 3 dígitos (EBS001, EBS012…). Se toma de la cuenta con la que ' +
      'inició sesión; si no sigue esta estructura, solicite al administrador corregir el código del equipo.'
  },

  prestadorPrimario: {
    variable: '16',
    que: 'Organización funcional de servicios de salud, pública o privada, ubicada en un ámbito territorial definido y ' +
      'a cargo de las actividades primarias en salud que requiere la población.',
    como: 'Prestador primario al que está adscrito el EBS. Tenga en cuenta el municipio y el departamento por los ' +
      'homónimos entre prestadores. En este despliegue queda fijo en la E.S.E. Red de Salud de Ladera.'
  },

  responsableNumeroId: {
    variable: '17',
    que: 'Identificación del responsable de la evaluación de necesidades en salud: quien diligencia la ficha de ' +
      'caracterización.',
    como: 'Número de documento sin puntos, comas ni guiones. La aplicación lo toma de la sesión del usuario, junto con ' +
      'su nombre y apellidos.'
  },

  perfilProfesional: {
    variable: '18',
    que: 'Perfil de quien realiza la evaluación de necesidades en salud: auxiliar de enfermería, profesional en ' +
      'enfermería, técnico en salud, médico, entre otros.',
    como: 'Perfil de quien diligencia la ficha. Se toma de la sesión; si es «Otro», especifique cuál en el ítem 14.1.'
  },

  codigoFicha: {
    variable: '19',
    que: 'Consecutivo de visitas: cada vez que se visita una familia se lleva un consecutivo que aumenta en uno con ' +
      'cada nueva visita.',
    como: 'La ficha técnica lo escribe CF seguido de un consecutivo de 3 dígitos (CF001, CF002…). Aquí la aplicación ' +
      'lo genera sola al iniciar la ficha, con el municipio, el equipo, el dispositivo, el consecutivo y la fecha ' +
      '(por ejemplo 76001-EBS001-K7Q3-0042-20260924), para que no se repita entre equipos. No se digita.'
  },

  fechaDiligenciamiento: {
    variable: '20',
    que: 'Fecha en la que se realiza la visita y se diligencia la ficha.',
    como: 'Formato AAAA-MM-DD. No puede ser posterior a hoy ni tener más de 30 días de antigüedad.'
  },

  /* ---------------- Vivienda: ubicación e identificación ---------------- */

  direccion: {
    variable: '7',
    que: 'Identificación de la vía (calle, carrera, diagonal, transversal, avenida, con su número o nombre), seguida ' +
      'de la marca de número (#), el número de la vía que la cruza, un guion y el número de la casa dentro de la ' +
      'cuadra. Ese último número va entre 0 y 99: par al costado derecho e impar al izquierdo.',
    como: 'Registre la dirección de la vivienda por partes. Si la vivienda no tiene dirección, elija la nomenclatura ' +
      '«Sin dirección»: se registra SIN DIRECCION y la vivienda se ubica con el punto de referencia del ítem 24.'
  },

  coordenadas: {
    variable: '8',
    que: 'Geopunto (en línea o sin conexión): coordenadas de latitud y longitud del espacio físico del hogar.',
    como: 'Tome las coordenadas del GPS del dispositivo o búsquelas desde la dirección. Se registran como par, con ' +
      'punto decimal (ejemplo: 3.451647, -76.531985). Si no es posible obtenerlas, la ficha queda con ' +
      'georreferenciación pendiente.'
  },

  ubicacionReferencia: {
    variable: '9',
    que: 'Punto de referencia: hito visual o descripción que facilita encontrar el hogar en el territorio.',
    como: 'Describa de manera clara y concreta cómo llegar, en máximo 200 caracteres. Ejemplo: al lado derecho de la ' +
      'iglesia, dos casas a la izquierda del puesto de salud. Es indispensable cuando la vivienda no tiene dirección ' +
      'o nomenclatura.'
  },

  idHogar: {
    variable: null,
    fuente: 'Observaciones de la E.S.E. Ladera',
    que: 'Código de la unidad de vivienda física. Se conserva entre visitas: al regresar a la misma vivienda se usa ' +
      'el mismo código.',
    como: 'La letra H seguida de 4 dígitos (H0001, H0002…), con la misma estructura que el número de la familia.'
  },

  idFamilia: {
    variable: '10',
    que: 'Código que permite identificar a cada una de las familias caracterizadas.',
    como: 'La letra F seguida de un serial de 4 dígitos, de F0001 hasta el total de familias visitadas en el ' +
      'microterritorio (F0001, F0002, F0003…).'
  },

  estrato: {
    variable: '11',
    que: 'Clasificación de los inmuebles residenciales que reciben servicios públicos. Los estratos 1, 2 y 3 (bajo-bajo, ' +
      'bajo y medio-bajo) albergan a los usuarios con menores recursos y reciben subsidios; los estratos 5 y 6 ' +
      '(medio-alto y alto) pagan contribución; el estrato 4 (medio) paga el valor del servicio.',
    como: 'Tome el dato del recibo de servicios públicos si lo tiene a la mano; de lo contrario, el que indique el ' +
      'hogar.'
  },

  hogaresEnVivienda: {
    variable: '12 y 13',
    que: 'Hogar: persona o grupo de personas que ocupan toda o parte de una vivienda y se asocian para compartir la ' +
      'dormida o la comida; pueden ser familiares o no. Familia: grupo de personas que comparten el espacio, se ' +
      'reconocen como núcleo familiar y organizan juntas la supervivencia económica, afectiva y cotidiana.',
    como: 'Escriba en número cuántos hogares familiares hay en la vivienda visitada. No se acepta texto.'
  },

  personasEnVivienda: {
    variable: '14',
    que: 'Total de habitantes de toda la estructura de la vivienda.',
    como: 'Escriba el número de personas. No se acepta texto.'
  },

  habitacionesVivienda: {
    variable: '86',
    que: 'Cuartos o piezas que se usan para dormir.',
    como: 'Escriba en número los cuartos, piezas o dormitorios de la vivienda; no cuente cocina, baños ni espacios de ' +
      'uso comercial. No se acepta texto.'
  },

  hacinamiento: {
    variable: '87',
    que: 'Relación entre las personas de la vivienda y los cuartos para dormir.',
    como: 'Se calcula solo: hay hacinamiento cuando duermen más de 2 personas por cuarto.'
  },

  /* ---------------- IV. Caracterización de la vivienda ---------------- */

  tipoVivienda: {
    variable: '82',
    que: 'Clase de construcción o refugio que habita la familia.',
    como: 'Seleccione el tipo de vivienda que corresponda.'
  },

  materialTecho: {
    variable: '85',
    que: 'Material que predomina en la cubierta o techo de la vivienda.',
    como: 'Señale una sola opción: la del material predominante.'
  },

  riesgosAccidente: {
    variable: '88',
    que: 'Escenarios dentro de la vivienda que pueden causar accidentes, en especial a niñas, niños y personas mayores.',
    como: 'Marque todos los escenarios que identifique. Si no hay ninguno, marque «Ninguno».'
  },

  vectores: {
    variable: '91',
    que: 'Criaderos o reservorios que favorecen la presencia de vectores transmisores de enfermedades, como agua ' +
      'reposada, agua almacenada en albercas por más de 8 días, objetos que pueden recoger agua o basura en el patio o ' +
      'alrededor de la casa.',
    como: 'Observe dentro y cerca de la vivienda y responda Sí o No.'
  },

  factoresContaminacion: {
    variable: '92',
    que: 'Ambientes del entorno inmediato de la vivienda (peridomicilio) que pueden afectar la salud: cultivos, ' +
      'apriscos, porquerizas, galpones, terrenos baldíos, plagas, ruido, malos olores, botaderos, industrias, ' +
      'fuentes de agua, extracción minera, vías de tráfico vehicular, quemas a cielo abierto, entre otros.',
    como: 'Observe si cerca de la vivienda hay alguno y márquelos todos. Si no hay ninguno, marque «Ninguno».'
  },

  actividadEconomica: {
    variable: '93',
    que: 'Actividades productivas que se realizan dentro de la vivienda: talleres, comercios, microempresas, entre otras.',
    como: 'Seleccione Sí o No.'
  },

  animales: {
    variable: '94',
    que: 'Animales que conviven con la familia dentro de la vivienda o en su entorno inmediato.',
    como: 'Marque todos los que correspondan. Si marca «Otro», escriba cuál. La cantidad de perros y gatos se registra ' +
      'en los ítems 41 y 43.'
  },

  fuenteAgua: {
    variable: '95',
    que: 'Fuentes de abastecimiento de agua para consumo humano en la vivienda.',
    como: 'Marque todas las que use el hogar.'
  },

  disposicionExcretas: {
    variable: '96',
    que: 'Sistema de disposición de excretas de la vivienda.',
    como: 'Marque todos los que correspondan.'
  },

  aguasResiduales: {
    variable: '97',
    que: 'Sistema de disposición de las aguas residuales domésticas de la vivienda.',
    como: 'Marque todos los que correspondan.'
  },

  residuosSolidos: {
    variable: '98',
    que: 'Forma en que se realiza la disposición final de los residuos sólidos ordinarios de la vivienda.',
    como: 'Marque todas las que correspondan.'
  },

  energiaCocinar: {
    variable: '90',
    que: 'Fuente de energía o combustible que se usa para cocinar: electricidad, gas natural, gas propano, leña o ' +
      'carbón de leña, petróleo, gasolina, kerosén o alcohol, carbón mineral, materiales de desecho u otro.',
    como: 'Marque todas las que use el hogar. Si marca «Otro», escriba cuál.'
  },

  /* ---------------- II. Caracterización de la familia ---------------- */

  tipoFamilia: {
    variable: '21',
    que: 'Estructura de la familia según quiénes la conforman.',
    opciones: [
      ['Nuclear biparental', 'ambos progenitores (padre y madre) y sus hijos.'],
      ['Nuclear monoparental', 'un solo progenitor (padre o madre) y sus hijos.'],
      ['Extenso biparental', 'un hogar nuclear (pareja con o sin hijos) más otros parientes: tíos, primos, hermanos, ' +
        'suegros.'],
      ['Extenso monoparental', 'un progenitor con sus hijos más otros parientes.'],
      ['Compuesto biparental', 'un hogar nuclear más personas sin parentesco con el jefe del hogar.'],
      ['Compuesto monoparental', 'un hogar con un solo progenitor más otros parientes o personas sin parentesco.'],
      ['Unipersonal', 'una sola persona.']
    ],
    como: 'Seleccione el tipo de familia.'
  },

  numeroIntegrantes: {
    variable: '22',
    que: 'Cantidad de personas que conforman o integran la familia.',
    como: 'Escriba el número. No se acepta texto. La aplicación crea un bloque de integrante por cada persona.'
  },

  cuidadorPrincipal: {
    variable: '25',
    que: 'Cuidador: persona que asiste a otra que necesita ayuda para cuidarse, por ejemplo niñas y niños, personas ' +
      'mayores, personas con discapacidad o con alguna enfermedad.',
    como: 'Seleccione Sí o No. Si la respuesta es Sí, aplique la escala de Zarit (ítem 53).'
  },

  zaritPuntaje: {
    variable: '26',
    que: 'La escala de Zarit mide la sobrecarga del cuidador: calidad de vida, capacidad de autocuidado, red de apoyo ' +
      'social y competencias para afrontar los problemas de la persona cuidada.',
    opciones: [
      ['Ausencia de sobrecarga', '46 puntos o menos.'],
      ['Sobrecarga ligera', 'de 47 a 55 puntos.'],
      ['Sobrecarga intensa', '56 puntos o más.']
    ],
    como: 'Si hay cuidador principal, aplique la escala y escriba el puntaje total, de 0 a 100 según el anexo técnico ' +
      'APS124CCFP. La clasificación de sobrecarga se calcula sola.'
  },

  apgarFamiliar: {
    variable: '24',
    que: 'El APGAR familiar muestra cómo perciben los integrantes el funcionamiento de la familia en conjunto.',
    opciones: [
      ['Alta funcionalidad', 'de 7 a 10 puntos.'],
      ['Funcionalidad moderada', 'de 4 a 6 puntos.'],
      ['Disfunción familiar', 'de 0 a 3 puntos.']
    ],
    como: 'Aplique el instrumento APGAR familiar y seleccione el rango del resultado.'
  },

  situacionesRiesgo: {
    variable: '35 y 36',
    que: 'Sucesos vitales: hechos que las personas reconocen como importantes en su vida y que pueden influir en su ' +
      'comportamiento, como la muerte de un familiar, cambios de residencia, separaciones o el ingreso a estudiar. ' +
      'Vulnerabilidad social: ambiente personal o familiar debilitado por consumo de sustancias, explotación sexual, ' +
      'trabajo infantil, conflictos, violencia, entre otras.',
    como: 'Marque todas las situaciones que viva la familia. Si no hay ninguna, marque «Ninguna».'
  },

  practicasVinculo: {
    variable: '43',
    que: 'Prácticas que favorecen relaciones sanas y constructivas entre dos o más personas, como la empatía, la ' +
      'comunicación asertiva y la resolución saludable de conflictos.',
    como: 'Marque las prácticas que observe o que la familia refiera.'
  },

  redesApoyo: {
    variable: '44',
    que: 'Recursos sociales y comunitarios: vínculos entre instituciones, organizaciones, comunidades, familias o ' +
      'personas que comparten conocimientos, experiencias y recursos para responder juntos a una situación.',
    como: 'Seleccione el nivel de apoyo con el que cuenta la familia.'
  },

  practicasCuidadoHogar: {
    variable: '42 y 46',
    que: 'Prácticas para cuidar los entornos y prevenir enfermedades: uso adecuado del agua, reciclaje, manipulación ' +
      'adecuada de alimentos, consumo de agua potable, manejo de residuos y excretas, higiene de manos, entre otras.',
    como: 'Marque las prácticas que observe o que la familia refiera.'
  },

  /* ---------------- III. Integrantes de la familia ---------------- */

  primerNombre: {
    variable: '49',
    que: 'Primer nombre de la persona.',
    como: 'Escríbalo tal como figura en el documento de identificación. Solo letras y espacios.'
  },

  segundoNombre: {
    variable: '50',
    que: 'Segundo nombre de la persona.',
    como: 'Escríbalo tal como figura en el documento de identificación. Déjelo vacío si no tiene.'
  },

  primerApellido: {
    variable: '51',
    que: 'Primer apellido de la persona.',
    como: 'Escríbalo tal como figura en el documento de identificación. Solo letras y espacios.'
  },

  segundoApellido: {
    variable: '52',
    que: 'Segundo apellido de la persona.',
    como: 'Escríbalo tal como figura en el documento de identificación. Déjelo vacío si no tiene.'
  },

  tipoId: {
    variable: '53',
    que: 'Documento oficial que establece la identidad y la nacionalidad de su titular.',
    como: 'Seleccione el tipo de documento. Para un menor o un adulto sin identificación use MS o AS.'
  },

  numeroId: {
    variable: '54',
    que: 'Número único e irrepetible que identifica el documento de la persona.',
    como: 'Escríbalo sin puntos, comas ni guiones; la aplicación los retira al salir del campo. Si es un menor o un ' +
      'adulto sin identificación, registre el serial que generó la entidad territorial para su identificación ante ' +
      'la EPS.'
  },

  fechaNacimiento: {
    variable: '55',
    que: 'Fecha registrada en el documento de identificación.',
    como: 'Formato AAAA-MM-DD. De ella se calcula la edad que habilita las preguntas por curso de vida.'
  },

  sexo: {
    variable: '56',
    que: 'Características sexuales con las que nace la persona.',
    opciones: [
      ['Hombre', 'al nacer tiene características sexuales masculinas, como pene y testículos.'],
      ['Mujer', 'al nacer tiene características sexuales femeninas, como vagina.'],
      ['Intersexual (indeterminado)', 'nace con alguna de las variaciones de las características sexuales: ' +
        'cromosomas, gónadas, hormonas sexuales o genitales.']
    ],
    como: 'Seleccione la que corresponda.'
  },

  rolFamiliar: {
    variable: '57',
    que: 'Lugar que ocupa la persona dentro de la familia.',
    opciones: [
      ['Responsable económico (jefe o jefa de familia)', 'persona reconocida por los demás como jefe del hogar, por ' +
        'su edad, por ser el principal sostén económico o por otras razones. Puede ser hombre o mujer.'],
      ['Cónyuge o compañero(a)', 'persona que forma pareja con el responsable económico.'],
      ['Hijo(a)', 'descendiente directo.'],
      ['Hermano(a)', 'persona que tiene el mismo padre y la misma madre que otra.'],
      ['Padre o madre', 'progenitor.'],
      ['Otros', 'parentescos distintos a los anteriores, como primos, padrinos o tíos.']
    ],
    como: 'Seleccione la que corresponda. Cada familia tiene exactamente un responsable económico.'
  },

  ocupacion: {
    variable: '58',
    que: 'Ocupación habitual: el trabajo que la persona tuvo durante la mayor cantidad de tiempo. Puede no ser la más ' +
      'reciente ni la mejor pagada.',
    como: 'Escriba el código CIUO o parte del nombre y elíjalo de la lista. Para personas desempleadas, jubiladas, ' +
      'amas de casa o dedicadas al hogar use el código 9998.'
  },

  nivelEducativo: {
    variable: '59',
    que: 'Nivel de instrucción más alto alcanzado dentro del sistema formal de enseñanza: preescolar, básica primaria, ' +
      'básica secundaria, media, superior (técnica, tecnológica, universitaria) y posgrado (especialización, maestría, ' +
      'doctorado).',
    como: 'Seleccione el nivel más alto alcanzado.'
  },

  regimenAfiliacion: {
    variable: '60',
    que: 'Régimen del Sistema General de Seguridad Social en Salud al que está afiliada la persona.',
    opciones: [
      ['Subsidiado', 'el Estado subsidia la afiliación de la población que corresponde según el Sisbén.'],
      ['Contributivo', 'personas con contrato de trabajo, servidores públicos, pensionados y trabajadores ' +
        'independientes con capacidad de pago, que hacen un aporte mensual.'],
      ['Especial', 'sectores que se rigen por normas anteriores a la Ley 100 de 1993, como las Fuerzas Militares y la ' +
        'Policía Nacional.'],
      ['Excepción', 'sistemas de seguridad social de los regímenes exceptuados de la Ley 100 de 1993.'],
      ['No afiliado', 'no se encuentra afiliado a ninguno de los anteriores.']
    ],
    como: 'Seleccione el que corresponda.'
  },

  eapb: {
    variable: '61',
    que: 'Entidad Administradora de Planes de Beneficios: EPS del régimen contributivo y subsidiado, EPS indígenas, ' +
      'cajas de compensación, entidades adaptadas y de los regímenes de excepción, entre otras.',
    como: 'Seleccione la entidad a la que está afiliada la persona. Si no está afiliada, el campo se inactiva.'
  },

  sujetoEspecialProteccion: {
    variable: '62',
    que: 'Pertenencia a un grupo poblacional de especial protección.',
    opciones: [
      ['Niñas, niños y adolescentes', 'primera infancia (0 a 5 años), infancia (6 a 11 años) y adolescencia (12 a ' +
        '18 años).'],
      ['Gestante', 'mujer en estado de embarazo.'],
      ['Persona adulta mayor', 'persona de 60 años o más.'],
      ['Persona con orientación sexual diversa', 'personas que sienten atracción por personas de distintas ' +
        'identidades de género.'],
      ['Víctima de violencia', 'persona que directa o indirectamente ha sufrido un daño o el menoscabo de sus ' +
        'derechos por una violación de derechos humanos o por un delito.']
    ],
    como: 'Marque todos los grupos a los que pertenezca la persona. Si no pertenece a ninguno, marque «Ninguna».'
  },

  pertenenciaEtnica: {
    variable: '63',
    que: 'Grupo étnico con el que se reconoce la persona.',
    opciones: [
      ['Indígena', 'descendiente de los pueblos originarios de América, con conciencia de su identidad y que comparte ' +
        'valores, usos y costumbres de su cultura.'],
      ['Rrom (gitano)', 'descendiente de pueblos gitanos de tradición nómada, con normas y rasgos culturales propios, ' +
        'como el idioma romanés.'],
      ['Raizal', 'persona de rasgos culturales afro-anglo-antillanos, de fuerte identidad caribeña, con lengua propia ' +
        'de base inglesa.'],
      ['Palenquero', 'población afrocolombiana de San Basilio de Palenque (Mahates, Bolívar), con lengua criolla ' +
        'propia.'],
      ['Negro o afrocolombiano', 'persona de ascendencia africana, que puede tener rasgos culturales que la ' +
        'singularizan como grupo humano.'],
      ['Ninguna', 'no pertenece a ningún grupo étnico.']
    ],
    como: 'Seleccione la que corresponda. Si es «Ninguna», no se pregunta el pueblo o comunidad (ítem 80).'
  },

  puebloEtnico: {
    variable: '64',
    que: 'Conjunto de familias de ascendencia amerindia que comparten la identificación con su pasado aborigen y ' +
      'mantienen rasgos, valores y formas de organización propios de su cultura tradicional.',
    como: 'Escriba el pueblo o la comunidad a la que pertenece la persona.'
  },

  discapacidad: {
    variable: '65',
    que: 'Tipo de discapacidad que la persona reconoce.',
    opciones: [
      ['Física', 'discapacidades motoras que dificultan el movimiento, y orgánicas, por pérdida de funcionalidad de ' +
        'uno o varios sistemas.'],
      ['Auditiva', 'discapacidad sensorial que afecta el oído.'],
      ['Visual', 'discapacidad sensorial que afecta la vista.'],
      ['Sordoceguera', 'discapacidad sensorial que afecta el oído y la vista.'],
      ['Intelectual', 'función intelectual significativamente por debajo del promedio, que dificulta comprender o ' +
        'responder ante situaciones de la vida diaria.'],
      ['Psicosocial (mental)', 'alteraciones de la conducta adaptativa que afectan las facultades mentales.'],
      ['Múltiple', 'combina varios tipos de discapacidad.'],
      ['Sin discapacidad', 'no presenta discapacidad.']
    ],
    como: 'Marque todas las que correspondan. Si no presenta, marque «Sin discapacidad».'
  },

  saberesAncestrales: {
    variable: '47 y 81',
    que: 'Conocimientos y prácticas desarrolladas por las comunidades a lo largo del tiempo para comprender y manejar ' +
      'su salud y su entorno, incluido el acompañamiento de médicos tradicionales, parteras o sabedores de la salud ' +
      'propia.',
    como: 'Aplica a poblaciones y comunidades indígenas, negras, afrocolombianas, raizales, palenqueras y Rrom. Marque ' +
      'las prácticas que realice la persona; si no realiza ninguna, marque «Ninguna».'
  },

  practicasCuidado: {
    variable: '40 y 70',
    que: 'Hábitos de vida saludable: conductas cotidianas que inciden positivamente en el bienestar físico, mental y ' +
      'social, como la actividad física, la alimentación saludable, el lavado de manos y la salud bucal. La práctica ' +
      'deportiva o el ejercicio es una actividad planificada y repetitiva para mantener y mejorar la forma física.',
    como: 'Marque las prácticas que la persona realice de forma rutinaria. Si no realiza ninguna, marque «Ninguna».'
  },

  atencionesPendientesRpms: {
    variable: '67 y 68',
    que: 'Atenciones de la ruta de promoción y mantenimiento de la salud para el curso de vida o la gestación que la ' +
      'persona aún no ha recibido: valoración integral, salud bucal, vacunación, micronutrientes, desparasitación, ' +
      'tamizajes, planificación familiar y educación para la salud, entre otras.',
    como: 'Marque cada intervención pendiente. La lista solo muestra las que corresponden a la edad y al sexo; si está ' +
      'al día, marque «Ninguna».'
  },

  atencionesPendientesMaterno: {
    variable: '68',
    que: 'Atenciones pendientes de la ruta materno perinatal.',
    opciones: [
      ['Cuidado preconcepcional', 'intervenciones para identificar condiciones biológicas y hábitos que pueden ser ' +
        'un riesgo para la mujer o para el embarazo.'],
      ['Cuidado prenatal', 'controles de salud durante el embarazo para prepararse para el parto y la crianza.'],
      ['Preparación para la maternidad y la paternidad', 'proceso educativo entre el equipo de salud, la gestante, ' +
        'su pareja y su familia.'],
      ['Atención del puerperio', 'seguimiento de las primeras horas a días después del parto.'],
      ['Seguimiento del recién nacido', 'acompañamiento del recién nacido en su adaptación a la vida extrauterina.']
    ],
    como: 'Marque cada atención pendiente. Si no hay pendientes, marque «Ninguna».'
  },

  barrerasAcceso: {
    variable: '69',
    que: 'Motivos por los que la persona no ha recibido las atenciones de promoción y mantenimiento: lugar de atención ' +
      'lejano o cerrado, horarios restringidos, largos tiempos de espera, falta de tecnología, desconocimiento del ' +
      'derecho o de la gratuidad, enfermedad u hospitalización, falta de tiempo del cuidador, rechazo por tradición o ' +
      'cultura, o no estar afiliado.',
    como: 'Marque los motivos que correspondan a las atenciones pendientes.'
  },

  conocimientoDerecho: {
    variable: '48',
    que: 'Exigibilidad del derecho a la salud: poder pedir y reclamar lo que corresponde en virtud de contar con un ' +
      'derecho.',
    como: 'Marque las capacidades que la persona tenga para ejercer y exigir su derecho a la salud.'
  },

  lactanciaExclusiva: {
    variable: '71',
    que: 'Lactancia materna exclusiva: alimentación únicamente con leche materna, desde el nacimiento.',
    como: 'Solo para menores de 6 meses: seleccione Sí o No.'
  },

  peso: {
    variable: '74',
    que: 'Medida antropométrica (77.1): sirve para evaluar el estado nutricional de la persona.',
    como: 'Registre el peso en kilogramos, con punto decimal (ejemplo: 12.5).'
  },

  talla: {
    variable: '74',
    que: 'Medida antropométrica (77.2): sirve para evaluar el estado nutricional de la persona.',
    como: 'Registre la talla en centímetros (ejemplo: 69).'
  },

  imc: {
    variable: '75',
    que: 'Índice de masa corporal.',
    como: 'Se calcula solo: peso en kilogramos dividido por el cuadrado de la talla en metros.'
  },

  clasificacionAntropometrica: {
    variable: '75',
    que: 'Diagnóstico nutricional según el indicador peso para la talla o IMC para la edad.',
    opciones: [
      ['Obesidad', 'acumulación excesiva y general de grasa en el cuerpo.'],
      ['Sobrepeso', 'peso superior al saludable para la estatura.'],
      ['Riesgo de sobrepeso', 'peso en el límite de lo saludable para la estatura.'],
      ['Peso adecuado para la talla', 'el peso que corresponde a la talla.'],
      ['Riesgo de desnutrición aguda', 'bajo peso para la talla.'],
      ['Desnutrición aguda moderada', 'puntaje Z de peso para la talla entre −2 y −3 desviaciones estándar.'],
      ['Desnutrición aguda severa', 'puntaje Z por debajo de −3 desviaciones estándar; puede acompañarse de edemas ' +
        'y emaciación grave.']
    ],
    como: 'Con el IMC y las tablas del Ministerio, seleccione la clasificación que corresponda.'
  },

  signosDesnutricion: {
    variable: '77',
    que: 'Signos físicos de desnutrición aguda en niñas y niños.',
    opciones: [
      ['Cabeza', 'se ve grande respecto al cuerpo, con poco cabello, seco, que se cae o cambia de color.'],
      ['Cara', 'luce hinchada y pálida; los ojos permanecen hundidos.'],
      ['Piel', 'seca, áspera o escamosa.'],
      ['Tórax y abdomen', 'abdomen inflamado o abultado y costillas marcadas.'],
      ['Extremidades', 'brazos o piernas muy delgados o inflamados; plantas de manos y pies pálidas.'],
      ['Comportamiento', 'desgano, fatiga, pérdida de interés en el juego, irritabilidad, llanto excesivo o rechazo ' +
        'del alimento.']
    ],
    como: 'Marque cada signo que identifique. Si no hay signos, marque «Ninguna».'
  },

  enfermedadesNoTransmisibles: {
    variable: '66',
    que: 'Condiciones de salud crónicas: de larga duración (más de 3 a 6 meses), por lo general de progresión lenta y ' +
      'no curables, como hipertensión, colesterol alto, diabetes, enfermedad renal crónica, EPOC o depresión.',
    como: 'Marque las que un profesional de salud le haya diagnosticado. Si no tiene ninguna, marque «Ninguna».'
  },

  condicionesTransmisibles: {
    variable: '34',
    que: 'Enfermedades transmisibles: se transmiten de persona a persona o de animales a personas, como tuberculosis, ' +
      'VIH, malaria, dengue o cólera.',
    como: 'Marque las que presente la persona. Si no presenta ninguna, marque «Ninguna».'
  },

  enfermedadesUltimoMes: {
    variable: '78',
    que: 'Enfermedades que la persona presenta o presentó en el último mes, como diarrea o soltura de estómago, ' +
      'tos, resfriado o infección pulmonar, problemas de piel o alergias, o un accidente en el hogar.',
    como: 'Marque todas las que correspondan. Si marca otra enfermedad, escriba cuál.'
  },

  adherenciaTratamiento: {
    variable: '79',
    que: 'Si la persona recibe atención y tratamiento para la enfermedad actual.',
    como: 'Seleccione Sí o No. Si es No, registre el motivo en el ítem 104.'
  },

  motivoNoTratamiento: {
    variable: '80',
    que: 'Motivos por los que no ha recibido la atención: lugar lejano o cerrado, horarios restringidos, largos ' +
      'tiempos de espera, falta de tecnología, falta de tiempo del cuidador, tratamiento con remedios caseros, ' +
      'rechazo por tradición o cultura, o no estar afiliado.',
    como: 'Marque los motivos que correspondan.'
  }
};

/* =========================================================
   Pintado e interacción
   ========================================================= */

/* El ítem que se nombra en el botón: «3» de «3.», o el texto de la etiqueta
   si el campo no lleva número de ítem. */
function nombreDelCampoParaGuia(etiqueta) {
  const numero = etiqueta.querySelector('.item-num');
  if (numero) return 'ítem ' + numero.textContent.replace(/[^\d.]/g, '').replace(/\.$/, '');
  return etiqueta.textContent.replace(/[*:]/g, '').replace(/\s+/g, ' ').trim();
}

function crearParrafoDeGuia(titulo, texto) {
  const parrafo = document.createElement('p');
  parrafo.className = 'guia-campo__parrafo';
  const fuerte = document.createElement('strong');
  fuerte.textContent = titulo + ' ';
  parrafo.appendChild(fuerte);
  parrafo.appendChild(document.createTextNode(texto));
  return parrafo;
}

function crearPanelDeGuia(entrada) {
  const panel = document.createElement('div');
  panel.className = 'guia-campo';
  panel.hidden = true;

  const fuente = document.createElement('p');
  fuente.className = 'guia-campo__fuente';
  fuente.textContent = entrada.variable
    ? 'Ficha técnica APS124CCFP · variable ' + entrada.variable
    : (entrada.fuente || 'Criterio del proyecto');
  panel.appendChild(fuente);

  panel.appendChild(crearParrafoDeGuia('Qué es.', entrada.que));

  if (Array.isArray(entrada.opciones) && entrada.opciones.length > 0) {
    const lista = document.createElement('ul');
    lista.className = 'guia-campo__opciones';
    entrada.opciones.forEach(function (opcion) {
      const item = document.createElement('li');
      const termino = document.createElement('strong');
      termino.textContent = opcion[0] + ':';
      item.appendChild(termino);
      item.appendChild(document.createTextNode(' ' + opcion[1]));
      lista.appendChild(item);
    });
    panel.appendChild(lista);
  }

  panel.appendChild(crearParrafoDeGuia('Cómo diligenciarlo.', entrada.como));
  return panel;
}

/** La etiqueta principal del campo: el primer <label> hijo directo. */
function etiquetaPrincipal(campo) {
  for (let i = 0; i < campo.children.length; i++) {
    if (campo.children[i].tagName === 'LABEL') return campo.children[i];
  }
  return null;
}

/**
 * Pone el botón de guía y su panel en cada campo del formulario que tenga
 * entrada en GUIA_CAMPOS. Es idempotente: un campo que ya lo tiene se salta.
 */
function inicializarGuiaCampos(raiz) {
  const formulario = raiz || document.getElementById('encuestaForm');
  if (!formulario) return;

  Array.prototype.forEach.call(formulario.querySelectorAll('.field[data-campo]'), function (campo) {
    const entrada = GUIA_CAMPOS[campo.dataset.campo];
    if (!entrada || campo.classList.contains('tiene-guia')) return;

    const etiqueta = etiquetaPrincipal(campo);
    if (!etiqueta) return;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'guia-boton';
    boton.dataset.guia = campo.dataset.campo;
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Guía de diligenciamiento del ' + nombreDelCampoParaGuia(etiqueta));
    boton.title = 'Guía de diligenciamiento';
    boton.textContent = '?';

    campo.classList.add('tiene-guia');
    etiqueta.insertAdjacentElement('afterend', crearPanelDeGuia(entrada));
    campo.insertBefore(boton, campo.firstChild);
  });

  if (!document.documentElement.dataset.guiaLista) {
    document.documentElement.dataset.guiaLista = 'si';
    document.addEventListener('click', manejarClicDeGuia);
    document.addEventListener('keydown', manejarTeclaDeGuia);
  }
}

let contadorPanelesGuia = 0;

function panelDeBoton(boton) {
  const campo = boton.closest('.field');
  if (!campo) return null;
  for (let i = 0; i < campo.children.length; i++) {
    if (campo.children[i].classList.contains('guia-campo')) return campo.children[i];
  }
  return null;
}

function alternarGuia(boton, abrir) {
  const panel = panelDeBoton(boton);
  if (!panel) return;
  const abierto = abrir === undefined ? panel.hidden : abrir;

  /* El id se asigna al abrir por primera vez y no al pintar: los bloques
     repetibles se clonan de un prototipo, y un id fijado antes de clonar se
     repetiría en cada familia e integrante. */
  if (!panel.id) {
    contadorPanelesGuia += 1;
    panel.id = 'guiaCampo' + contadorPanelesGuia;
    boton.setAttribute('aria-controls', panel.id);
  }

  panel.hidden = !abierto;
  boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');

  /* En la rejilla de doce columnas un campo de cifras mide un cuarto de fila:
     ahí la guía quedaba en una columna de seis palabras por renglón. Mientras
     está abierta, el campo toma la fila entera; al cerrarla vuelve a su ancho. */
  const campo = boton.closest('.field');
  if (campo) campo.classList.toggle('guia-abierta', abierto);
}

function manejarClicDeGuia(evento) {
  const boton = evento.target.closest ? evento.target.closest('.guia-boton') : null;
  if (!boton) return;
  evento.preventDefault();
  alternarGuia(boton);
}

/* Escape cierra la guía del campo en el que está el foco y lo devuelve al botón. */
function manejarTeclaDeGuia(evento) {
  if (evento.key !== 'Escape') return;
  const activo = document.activeElement;
  const campo = activo && activo.closest ? activo.closest('.field.tiene-guia') : null;
  if (!campo) return;
  const boton = campo.querySelector('.guia-boton');
  const panel = boton && panelDeBoton(boton);
  if (!panel || panel.hidden) return;
  alternarGuia(boton, false);
  boton.focus();
}
