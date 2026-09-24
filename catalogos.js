/* =========================================================
   Encuesta_APS — Catálogos y listas parametrizadas
   ---------------------------------------------------------
   Fuente única de verdad para las opciones cerradas exigidas
   por las reglas de negocio. Los <select> y grupos de casillas
   del formulario se construyen a partir de estos catálogos.

   CÓDIGOS DEL REPORTE SI-APS (`sispro`)
   Cada opción lleva, además de su `valor` interno, el código con
   que se reporta en el archivo plano APS124CCFP según el anexo
   técnico (versión 7, junio de 2026). El `valor` no cambia —es lo
   que ya guardan las fichas y la base—; el `sispro` es sólo para
   el reporte. Una opción sin `sispro` no tiene equivalente en el
   anexo y no se ofrece en el formulario (`vigente: false`): se
   conserva para leer fichas antiguas.

   Los catálogos que el anexo no enumera —país, ocupación y EAPB—
   vienen de las tablas oficiales de SISPRO en catalogos_sispro.js.
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   RN-005 — Entidad territorial fija del proyecto
   --------------------------------------------------------- */
const CAT_DEPARTAMENTO = { codigo: '76', nombre: 'Valle del Cauca' };
const CAT_MUNICIPIO = { codigo: '76001', nombre: 'Santiago de Cali' };

/* ---------------------------------------------------------
   RN-006 — Área de ubicación de la vivienda (variable 10)
   El anexo sólo distingue urbana y rural. «Centro poblado» dejó
   de ser un área y pasó a ser un tipo de ubicación (variable 8):
   un centro poblado es área rural.
   --------------------------------------------------------- */
const CAT_AREA_UBICACION = [
  { valor: 'urbana', etiqueta: 'Área urbana', sispro: '1' },
  { valor: 'rural', etiqueta: 'Área rural', sispro: '2' },
  { valor: 'centro_poblado', etiqueta: 'Centro poblado', sispro: '2', vigente: false }
];

/* ---------------------------------------------------------
   Anexo SI-APS, variable 8 — Tipo de ubicación de la vivienda
   Acompaña al ítem 9, que pasa a ser su nombre (variable 9).
   --------------------------------------------------------- */
const CAT_TIPO_UBICACION = [
  { valor: 'corregimiento', etiqueta: 'Corregimiento', sispro: '1' },
  { valor: 'centro_poblado', etiqueta: 'Centro poblado', sispro: '2' },
  { valor: 'vereda', etiqueta: 'Vereda', sispro: '3' },
  { valor: 'localidad', etiqueta: 'Localidad', sispro: '4' },
  { valor: 'barrio', etiqueta: 'Barrio', sispro: '5' },
  { valor: 'resguardo_indigena', etiqueta: 'Resguardo indígena', sispro: '6' }
];

/* ---------------------------------------------------------
   RN-007 / RN-008 — Territorios y microterritorios de Santiago de Cali
   El catálogo va de T01 a T110. Los 37 territorios del Anexo A (T48…T84)
   traen sus 4 microterritorios con nombre y comuna; el resto entra con
   MT01…MT04 sin nombre ni comuna, para que puedan seleccionarse mientras
   llega el detalle del anexo (no se inventan nombres). Sin comuna, un
   territorio no se considera rural (RN-007 no advierte sobre él).
   --------------------------------------------------------- */
const CAT_TERRITORIOS = {
  T01: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T02: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T03: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T04: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T05: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T06: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T07: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T08: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T09: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T10: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T11: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T12: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T13: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T14: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T15: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T16: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T17: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T18: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T19: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T20: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T21: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T22: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T23: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T24: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T25: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T26: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T27: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T28: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T29: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T30: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T31: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T32: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T33: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T34: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T35: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T36: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T37: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T38: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T39: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T40: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T41: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T42: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T43: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T44: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T45: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T46: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T47: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
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
  ],
  T85: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T86: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T87: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T88: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T89: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T90: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T91: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T92: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T93: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T94: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T95: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T96: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T97: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T98: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T99: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T100: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T101: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T102: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T103: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T104: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T105: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T106: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T107: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T108: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T109: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ],
  T110: [
    { codigo: 'MT01', nombre: null, comuna: null },
    { codigo: 'MT02', nombre: null, comuna: null },
    { codigo: 'MT03', nombre: null, comuna: null },
    { codigo: 'MT04', nombre: null, comuna: null }
  ]
};

// La comuna es homogénea dentro de cada territorio: se toma del primer microterritorio.
function comunaDeTerritorio(codigoTerritorio) {
  const microterritorios = CAT_TERRITORIOS[codigoTerritorio];
  return microterritorios && microterritorios.length ? microterritorios[0].comuna : null;
}

function etiquetaMicroterritorio(mt) {
  return mt.nombre ? mt.codigo + ' — ' + mt.nombre : mt.codigo;
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
  { valor: 'CC', etiqueta: 'CC. Cédula de Ciudadanía', sispro: 'CC' },
  { valor: 'CD', etiqueta: 'CD. Carné Diplomático', sispro: 'CD' },
  { valor: 'CE', etiqueta: 'CE. Cédula de Extranjería', sispro: 'CE' },
  { valor: 'PT', etiqueta: 'PT. Permiso por Protección Temporal', sispro: 'PT' }
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
const ENTORNO_HOGAR = 'hogar';
const ENTORNOS_CON_INSTITUCION = ['comunitario', 'institucional', 'educativo', 'laboral'];

/* ---------------------------------------------------------
   RN-020 / RN-037 — Opciones binarias y ternarias
   --------------------------------------------------------- */
const CAT_SI_NO = [
  { valor: 'si', etiqueta: 'Sí', sispro: '1' },
  { valor: 'no', etiqueta: 'No', sispro: '2' }
];

const CAT_SI_NO_NA = [
  { valor: 'si', etiqueta: 'Sí', sispro: '1' },
  { valor: 'no', etiqueta: 'No', sispro: '2' },
  { valor: 'no_aplica', etiqueta: 'No aplica', sispro: '3' }
];

/* ---------------------------------------------------------
   RN-002 — Situaciones inminentes (variable 23)
   El anexo la reporta como selección múltiple: una visita puede
   encontrar a la vez una urgencia física y una emergencia.
   --------------------------------------------------------- */
const CAT_SITUACION_INMINENTE = [
  { valor: 'fisica', etiqueta: 'Física (urgencia vital)', prioritaria: true, sispro: '1' },
  { valor: 'psicologica', etiqueta: 'Psicológica (urgencia vital en salud mental)', prioritaria: true, sispro: '2' },
  { valor: 'emergencia', etiqueta: 'Situación de emergencia o desastre', prioritaria: true, sispro: '3' },
  { valor: 'no_aplica', etiqueta: 'No aplica', prioritaria: false, excluyente: true, sispro: '4' }
];

/* ---------------------------------------------------------
   RN-027 — Estrato socioeconómico (variable 16)
   --------------------------------------------------------- */
const CAT_ESTRATO = [
  { valor: 'bajo_bajo', etiqueta: 'Bajo - Bajo', sispro: '1' },
  { valor: 'bajo', etiqueta: 'Bajo', sispro: '2' },
  { valor: 'medio_bajo', etiqueta: 'Medio - Bajo', sispro: '3' },
  { valor: 'medio', etiqueta: 'Medio', sispro: '4' },
  { valor: 'medio_alto', etiqueta: 'Medio - Alto', sispro: '5' },
  { valor: 'alto', etiqueta: 'Alto', sispro: '6' }
];

/* ---------------------------------------------------------
   RN-034 — Tipo de vivienda (variable 31)
   --------------------------------------------------------- */
const CAT_TIPO_VIVIENDA = [
  { valor: 'casa', etiqueta: 'Casa', sispro: '1' },
  { valor: 'apartamento', etiqueta: 'Apartamento', sispro: '2' },
  { valor: 'cuarto', etiqueta: 'Tipo "Cuarto"', sispro: '3' },
  { valor: 'tradicional_indigena', etiqueta: 'Vivienda tradicional Indígena', sispro: '4' },
  { valor: 'tradicional_etnica', etiqueta: 'Vivienda tradicional étnica', sispro: '5' },
  { valor: 'carpa', etiqueta: 'Carpa', sispro: '6' },
  { valor: 'contenedor', etiqueta: 'Contenedor', sispro: '7' },
  { valor: 'embarcacion', etiqueta: 'Embarcación', sispro: '8' },
  { valor: 'vagon', etiqueta: 'Vagón', sispro: '9' },
  { valor: 'refugio_natural', etiqueta: 'Refugio Natural', sispro: '10' },
  { valor: 'cueva', etiqueta: 'Cueva', sispro: '11' },
  { valor: 'puente', etiqueta: 'Puente', sispro: '12' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '13' }
];

/* ---------------------------------------------------------
   RN-035 — Material predominante del techo (variable 40)
   El anexo distingue «Fibrocemento con asbesto» (4) de «Teja o
   lámina de fibrocemento con asbesto» (6). Se respetan las dos.
   --------------------------------------------------------- */
const CAT_MATERIAL_TECHO = [
  { valor: 'concreto', etiqueta: 'Concreto', sispro: '1' },
  { valor: 'tejas_barro', etiqueta: 'Tejas de barro', sispro: '2' },
  { valor: 'fibrocemento_sin_asbesto', etiqueta: 'Fibrocemento sin asbesto', sispro: '3' },
  { valor: 'fibrocemento_asbesto', etiqueta: 'Fibrocemento con asbesto', sispro: '4' },
  { valor: 'zinc', etiqueta: 'Zinc', sispro: '5' },
  { valor: 'fibrocemento_con_asbesto', etiqueta: 'Teja o lámina de fibrocemento con asbesto', sispro: '6' },
  { valor: 'palma_paja', etiqueta: 'Palma o paja', sispro: '7' },
  { valor: 'plastico', etiqueta: 'Plástico', sispro: '8' },
  { valor: 'desechos', etiqueta: 'Desechos (cartón, lata, tela, sacos, etc.)', sispro: '9' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '10' }
];

/* ---------------------------------------------------------
   RN-036 — Escenarios de riesgo de accidente (variable 32)
   Selección múltiple con "ninguno" como opción de exclusión.
   --------------------------------------------------------- */
const VALOR_NINGUNO = 'ninguno';

const CAT_RIESGOS_ACCIDENTE = [
  { valor: 'objetos_cortopunzantes', etiqueta: 'Objetos cortantes o punzantes al alcance de los niños', sispro: '1' },
  { valor: 'sustancias_quimicas', etiqueta: 'Sustancias químicas al alcance de los niños y/o reenvasadas en envases de alimentos o bebidas', sispro: '2' },
  { valor: 'medicamentos', etiqueta: 'Medicamentos al alcance de los niños', sispro: '3' },
  { valor: 'velas_encendidas', etiqueta: 'Velas, velones, incienso encendidos en la vivienda', sispro: '4' },
  { valor: 'conexiones_electricas', etiqueta: 'Conexiones eléctricas en mal estado o sobrecargadas', sispro: '5' },
  { valor: 'objetos_pequenos', etiqueta: 'Botones, canicas entre otros objetos pequeños o con piezas que puedan desmontarse, al alcance de los niños', sispro: '6' },
  { valor: 'pasillos_obstruidos', etiqueta: 'Pasillos obstruidos con juguetes, sillas u otros objetos', sispro: '7' },
  { valor: 'superficies_resbaladizas', etiqueta: 'Superficies resbaladizas, suelos con agua, grasas, aceites, entre otros', sispro: '8' },
  { valor: 'tanques_sin_tapa', etiqueta: 'Tanques o recipientes de almacenamiento de agua sin tapa', sispro: '9' },
  { valor: 'escaleras_sin_proteccion', etiqueta: 'Escaleras sin protección', sispro: '10' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true, sispro: '11' }
];

/* ---------------------------------------------------------
   RN-038 — Cerca de la vivienda hay (variable 33)
   Orden y códigos del anexo. La opción de asbesto lleva la
   pregunta de apoyo que el anexo pide formular.
   --------------------------------------------------------- */
const CAT_FACTORES_CONTAMINACION = [
  { valor: 'cultivos', etiqueta: 'Cultivos', sispro: '1' },
  { valor: 'apriscos', etiqueta: 'Apriscos', sispro: '2' },
  { valor: 'porquerizas', etiqueta: 'Porquerizas', sispro: '3' },
  { valor: 'galpones', etiqueta: 'Galpones', sispro: '4' },
  { valor: 'terrenos_baldios', etiqueta: 'Terrenos baldíos', sispro: '5' },
  { valor: 'plagas', etiqueta: 'Presencia de Plagas: roedores, cucarachas, zancudos, moscas, etc.', sispro: '6' },
  { valor: 'ruido', etiqueta: 'Ruido o sonidos desagradables', sispro: '7' },
  { valor: 'malos_olores', etiqueta: 'Malos olores', sispro: '8' },
  { valor: 'excretas_satelite', etiqueta: 'Sitios satélites de disposición de excretas', sispro: '9' },
  { valor: 'rellenos_botaderos', etiqueta: 'Rellenos sanitarios / botaderos', sispro: '10' },
  { valor: 'industrias_contaminantes', etiqueta: 'Industrias contaminantes (del sector energético, minero, transporte, construcción, manufacturera, entre otros)', sispro: '11' },
  { valor: 'contaminacion_visual', etiqueta: 'Contaminación visual', sispro: '12' },
  { valor: 'rio_quebrada', etiqueta: 'Río o quebrada', sispro: '13' },
  { valor: 'ptar', etiqueta: 'Planta de tratamiento de agua residual', sispro: '14' },
  { valor: 'extraccion_minera', etiqueta: 'Extracción minera', sispro: '15' },
  { valor: 'canales_agua_lluvia', etiqueta: 'Canales de agua lluvia', sispro: '16' },
  { valor: 'trafico_vehicular', etiqueta: 'Vías de alto tráfico vehicular', sispro: '17' },
  { valor: 'quemas_cielo_abierto', etiqueta: 'Quemas a cielo abierto', sispro: '18' },
  { valor: 'agroquimicos', etiqueta: 'Aspersión o almacenamiento de agroquímicos u otras sustancias químicas', sispro: '19' },
  { valor: 'alta_tension', etiqueta: 'Fuentes de energía eléctrica de alta tensión', sispro: '20' },
  { valor: 'asbesto', etiqueta: 'Industrias de construcción, demolición, talleres u otros que usen o dispongan de material de asbesto (pregunte: ¿alguna vez usted o alguien de su familia ha trabajado o vivido en un lugar donde podría haber estado expuesto al asbesto?)', sispro: '21' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true, sispro: '22' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '23' }
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

/* Las opciones que el formulario ofrece: sin las `vigente: false`, que sólo
   existen para leer fichas anteriores al anexo técnico. */
function opcionesVigentes(catalogo) {
  return (catalogo || []).filter(function (opcion) { return opcion.vigente !== false; });
}

/* Código con que una opción se reporta en el archivo plano (anexo SI-APS),
   o null si el valor no tiene equivalente en el anexo. */
function codigoSispro(catalogo, valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const opcion = (catalogo || []).find(function (item) { return item.valor === valor; });
  return opcion && opcion.sispro !== undefined ? opcion.sispro : null;
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

   `vigente` decide en un solo sitio qué UZPE existen para este
   despliegue: el formulario ofrece las vigentes y el seed de la
   base siembra exactamente esas mismas.

   Antes el formulario ofrecía las diez y la base sólo aceptaba
   UZPE006, así que el endpoint reescribía en silencio la
   respuesta del encuestador. Cuando la Secretaría confirme las
   denominaciones oficiales, basta poner `vigente: true` con el
   nombre real y regenerar el seed (node bd/gen_seed.js).
   --------------------------------------------------------- */
const CAT_UZPE = [
  { valor: 'UZPE001', etiqueta: 'UZPE001', vigente: false },
  { valor: 'UZPE002', etiqueta: 'UZPE002', vigente: false },
  { valor: 'UZPE003', etiqueta: 'UZPE003', vigente: false },
  { valor: 'UZPE004', etiqueta: 'UZPE004', vigente: false },
  { valor: 'UZPE005', etiqueta: 'UZPE005', vigente: false },
  { valor: 'UZPE006', etiqueta: 'UZPE006', vigente: true },
  { valor: 'UZPE007', etiqueta: 'UZPE007', vigente: false },
  { valor: 'UZPE008', etiqueta: 'UZPE008', vigente: false },
  { valor: 'UZPE009', etiqueta: 'UZPE009', vigente: false },
  { valor: 'UZPE010', etiqueta: 'UZPE010', vigente: false }
];

/* Las que el formulario puede ofrecer y la base va a aceptar. */
const CAT_UZPE_VIGENTES = CAT_UZPE.filter(function (u) { return u.vigente; });

/* UZPE del despliegue actual: queda preseleccionada. */
const UZPE_PREDETERMINADA = 'UZPE006';

/* ---------------------------------------------------------
   RN-040 — Animales en la vivienda o entorno
   --------------------------------------------------------- */
const CAT_ANIMALES = [
  { valor: 'perros', etiqueta: 'Perros', sispro: '1' },
  { valor: 'gatos', etiqueta: 'Gatos', sispro: '2' },
  { valor: 'porcinos', etiqueta: 'Porcinos', sispro: '3' },
  { valor: 'bovinos', etiqueta: 'Bovinos: Búfalos, vacas, toros', sispro: '4' },
  { valor: 'equinos', etiqueta: 'Equinos: Asnos, mulas, caballos, burros', sispro: '5' },
  { valor: 'ovinos_caprinos', etiqueta: 'Ovinos / caprino', sispro: '6' },
  { valor: 'aves_produccion', etiqueta: 'Aves de producción', sispro: '7' },
  { valor: 'aves_ornamentales', etiqueta: 'Aves ornamentales', sispro: '8' },
  { valor: 'peces_hamster', etiqueta: 'Peces ornamentales, hámster', sispro: '9' },
  { valor: 'cobayos_conejos', etiqueta: 'Cobayos, conejos', sispro: '10' },
  { valor: 'silvestres', etiqueta: 'Animales silvestres', sispro: '11' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '12' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true, sispro: '13' }
];

/* ---------------------------------------------------------
   RN-046 — Fuente principal de agua para consumo (variable 53)
   Selección múltiple: una vivienda puede beber agua del acueducto
   y embotellada. `noSegura` marca las fuentes que activan alerta
   en RN-211 (basta con una).
   --------------------------------------------------------- */
const CAT_FUENTE_AGUA = [
  { valor: 'acueducto_esp', etiqueta: 'Acueducto administrado por empresa prestadora (ESP)', noSegura: false, sispro: '1' },
  { valor: 'agua_embotellada', etiqueta: 'Agua embotellada o en bolsa', noSegura: false, sispro: '2' },
  { valor: 'acueducto_veredal', etiqueta: 'Acueducto veredal o comunitario', noSegura: false, sispro: '3' },
  { valor: 'pila_publica', etiqueta: 'Pila pública', noSegura: false, sispro: '4' },
  { valor: 'carro_tanque', etiqueta: 'Carro tanque', noSegura: true, sispro: '5' },
  { valor: 'distribucion_comunitaria', etiqueta: 'Abasto con distribución comunitaria', noSegura: true, sispro: '6' },
  { valor: 'pozo_con_bomba', etiqueta: 'Pozo con bomba', noSegura: true, sispro: '7' },
  { valor: 'pozo_sin_bomba', etiqueta: 'Pozo sin bomba, aljibe, jagüey o barreno', noSegura: true, sispro: '8' },
  { valor: 'laguna_jaguey', etiqueta: 'Laguna o jagüey', noSegura: true, sispro: '9' },
  { valor: 'rio_quebrada', etiqueta: 'Río, quebrada', noSegura: true, sispro: '10' },
  { valor: 'manantial', etiqueta: 'Manantial o nacimiento', noSegura: true, sispro: '11' },
  { valor: 'aguas_lluvias', etiqueta: 'Aguas lluvias', noSegura: true, sispro: '12' },
  { valor: 'aguatero', etiqueta: 'Aguatero', noSegura: true, sispro: '13' },
  { valor: 'otro', etiqueta: 'Otro', noSegura: true, sispro: '14' }
];

/* ---------------------------------------------------------
   RN-047 — Sistema de disposición de excretas (variable 58)
   Selección múltiple en el anexo.
   --------------------------------------------------------- */
const CAT_DISPOSICION_EXCRETAS = [
  { valor: 'alcantarillado', etiqueta: 'Sanitario conectado al alcantarillado', critica: false, sispro: '1' },
  { valor: 'letrina', etiqueta: 'Sanitario y letrina', critica: false, sispro: '2' },
  { valor: 'pozo_septico', etiqueta: 'Sanitario conectado a pozo séptico', critica: false, sispro: '3' },
  { valor: 'ecologico_seco', etiqueta: 'Sanitario ecológico seco', critica: false, sispro: '4' },
  { valor: 'sin_conexion', etiqueta: 'Sanitario sin conexión', critica: true, sispro: '5' },
  { valor: 'fuente_hidrica', etiqueta: 'Sanitario con disposición a fuente hídrica', critica: true, sispro: '6' },
  { valor: 'campo_abierto', etiqueta: 'Campo abierto', critica: true, sispro: '7' }
];

/* ---------------------------------------------------------
   RN-048 — Aguas residuales domésticas (variable 59)
   Selección múltiple en el anexo.
   --------------------------------------------------------- */
const CAT_AGUAS_RESIDUALES = [
  { valor: 'alcantarillado', etiqueta: 'Alcantarillado', critica: false, sispro: '1' },
  { valor: 'pozo_septico', etiqueta: 'Pozo séptico', critica: false, sispro: '2' },
  { valor: 'campo_oxidacion', etiqueta: 'Campo de oxidación', critica: false, sispro: '3' },
  { valor: 'biofiltro', etiqueta: 'Biofiltro', critica: false, sispro: '4' },
  { valor: 'fuente_hidrica', etiqueta: 'Fuente hídrica', critica: true, sispro: '5' },
  { valor: 'campo_abierto', etiqueta: 'Campo abierto', critica: true, sispro: '6' }
];

/* ---------------------------------------------------------
   RN-049 — Disposición final de residuos sólidos (variable 62)
   Selección múltiple en el anexo.
   --------------------------------------------------------- */
const CAT_RESIDUOS_SOLIDOS = [
  { valor: 'servicio_aseo', etiqueta: 'Recolección por parte del servicio de aseo distrital o municipal', critica: false, sispro: '1' },
  { valor: 'enterramiento', etiqueta: 'Enterramiento', critica: true, sispro: '2' },
  { valor: 'quema', etiqueta: 'Quema a campo abierto', critica: true, sispro: '3' },
  { valor: 'fuentes_agua', etiqueta: 'Disposición en fuentes de agua cercana', critica: true, sispro: '4' },
  { valor: 'campo_abierto', etiqueta: 'Disposición a campo abierto', critica: true, sispro: '5' }
];

/* ---------------------------------------------------------
   RN-050 — Tipo de familia (variable 112)
   --------------------------------------------------------- */
const CAT_TIPO_FAMILIA = [
  { valor: 'nuclear_biparental', etiqueta: 'Nuclear biparental', sispro: '1' },
  { valor: 'nuclear_monoparental', etiqueta: 'Nuclear monoparental', sispro: '2' },
  { valor: 'extenso_biparental', etiqueta: 'Extenso biparental', sispro: '3' },
  { valor: 'extenso_monoparental', etiqueta: 'Extenso monoparental', sispro: '4' },
  { valor: 'compuesto_biparental', etiqueta: 'Compuesto biparental', sispro: '5' },
  { valor: 'compuesto_monoparental', etiqueta: 'Compuesto monoparental', sispro: '6' },
  { valor: 'unipersonal', etiqueta: 'Unipersonal', sispro: '7' }
];

/* ---------------------------------------------------------
   RN-053 / RN-212 — Escala de Zarit (variable 115)
   El anexo reporta el PUNTAJE (0 a 100), no la clasificación. El
   formulario pide el puntaje y la clasificación se deriva con estos
   umbrales, que son los que siguen alimentando la alerta RN-212.
   --------------------------------------------------------- */
const CAT_ZARIT = [
  { valor: 'ausencia', etiqueta: 'Ausencia de sobrecarga (≤ 46)', prioridad: null, maximo: 46 },
  { valor: 'ligera', etiqueta: 'Sobrecarga ligera (47-55)', prioridad: 'regular', maximo: 55 },
  { valor: 'intensa', etiqueta: 'Sobrecarga intensa (≥ 56)', prioridad: 'prioritaria', maximo: null }
];

const ZARIT_PUNTAJE_MAXIMO = 100;

/** Clasificación de Zarit a partir del puntaje (RN-053), o null sin puntaje válido. */
function clasificarZarit(puntaje) {
  if (typeof puntaje !== 'number' || !isFinite(puntaje) || puntaje < 0) return null;
  const nivel = CAT_ZARIT.find(function (n) { return n.maximo === null || puntaje <= n.maximo; });
  return nivel ? nivel.valor : null;
}

/* ---------------------------------------------------------
   RN-054 — Situaciones familiares de riesgo (variable 116)
   Orden y códigos del anexo.
   --------------------------------------------------------- */
const CAT_SITUACIONES_RIESGO_FAMILIAR = [
  { valor: 'inicio_convivencia', etiqueta: 'Inicio de la convivencia en pareja', sispro: '1' },
  { valor: 'nuevo_integrante', etiqueta: 'Llegada de un nuevo integrante', sispro: '2' },
  { valor: 'ingreso_estudiar', etiqueta: 'Ingreso a estudiar', sispro: '3' },
  { valor: 'perdida_ano_escolar', etiqueta: 'Pérdida del año escolar', sispro: '4' },
  { valor: 'embarazo_adolescente', etiqueta: 'Embarazo temprano o adolescente', sispro: '5' },
  { valor: 'independencia_hijos', etiqueta: 'Independencia de los hijos-hijas', sispro: '6' },
  { valor: 'separacion', etiqueta: 'Separación de pareja', sispro: '7' },
  { valor: 'jubilacion', etiqueta: 'Jubilación', sispro: '8' },
  { valor: 'duelo', etiqueta: 'Duelo', sispro: '9' },
  { valor: 'desempleo', etiqueta: 'Desempleo o pérdida abrupta del trabajo', sispro: '10' },
  { valor: 'crisis_economica', etiqueta: 'Pérdidas o crisis económicas', sispro: '11' },
  { valor: 'enfermedad_terminal', etiqueta: 'Enfermedad terminal o huérfana/rara en alguno de sus integrantes', sispro: '12' },
  { valor: 'antecedente_suicidio', etiqueta: 'Antecedentes de intento o muerte por suicidio en alguno de sus integrantes', riesgo: 'suicidio', sispro: '13' },
  { valor: 'accidente_discapacidad', etiqueta: 'Accidente o situación que genera discapacidad', sispro: '14' },
  { valor: 'muerte_inesperada', etiqueta: 'Muerte inesperada', sispro: '15' },
  { valor: 'violencia', etiqueta: 'Vivencia de alguna forma de violencia', riesgo: 'violencia', sispro: '16' },
  { valor: 'abandono', etiqueta: 'Persona en situación de abandono', riesgo: 'abandono', sispro: '17' },
  { valor: 'migracion', etiqueta: 'Migración', sispro: '18' },
  { valor: 'consumo_spa', etiqueta: 'Consumo problemático de sustancias psicoactivas, incluyendo alcohol', riesgo: 'spa', sispro: '19' },
  { valor: 'trastorno_mental', etiqueta: 'Trastorno de salud mental', riesgo: 'salud_mental', sispro: '20' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '21' }
];

/* ---------------------------------------------------------
   RN-055 — Prácticas que favorecen los vínculos familiares (variable 117)
   --------------------------------------------------------- */
const CAT_PRACTICAS_VINCULO = [
  { valor: 'maneja_tension', etiqueta: 'Cuando hay tensión o estrés en la familia lo reconoce y encuentran la forma de manejarlas de manera pacífica', sispro: '1' },
  { valor: 'decisiones_concertadas', etiqueta: 'Las decisiones familiares son concertadas teniendo en cuenta a todos sus integrantes', sispro: '2' },
  { valor: 'resuelve_conflictos', etiqueta: 'La familia resuelve los conflictos buscando el bienestar de todos sus integrantes', sispro: '3' },
  { valor: 'escucha_activa', etiqueta: 'La comunicación en la familia está basada en la escucha activa, el respeto y la negociación', sispro: '4' },
  { valor: 'acompana_menores', etiqueta: 'Los padres y cuidadores comparten, apoyan y supervisan las actividades de niños y adolescentes con respeto y límites', sispro: '5' },
  { valor: 'considera_mayores', etiqueta: 'Los integrantes tienen en cuenta los intereses, opiniones y preferencias de las personas adultas mayores', sispro: '6' }
];

/* ---------------------------------------------------------
   RN-056 — Redes de apoyo social (variable 118)
   --------------------------------------------------------- */
const CAT_REDES_APOYO = [
  { valor: 'cuenta_protectoras', etiqueta: 'Cuenta con redes de apoyo sociales protectoras para el cuidado de su salud', riesgo: false, sispro: '1' },
  { valor: 'cuenta_ampliables', etiqueta: 'Cuenta con redes de apoyo sociales para el cuidado de su salud, pero podría ampliarlas para fortalecerse', riesgo: false, sispro: '2' },
  { valor: 'no_cuenta', etiqueta: 'No identifica / no cuenta con redes de apoyo sociales protectoras', riesgo: true, sispro: '3' }
];

/* ---------------------------------------------------------
   RN-057 — Prácticas de cuidado en el entorno hogar (variable 119)
   --------------------------------------------------------- */
const CAT_PRACTICAS_CUIDADO_HOGAR = [
  { valor: 'tratamiento_agua', etiqueta: 'Tratamiento casero al agua antes del consumo humano y almacenamiento adecuado', sispro: '1' },
  { valor: 'ventilacion', etiqueta: 'Facilita la circulación del aire en la vivienda a través de la ventilación natural o artificial', sispro: '2' },
  { valor: 'evita_humo', etiqueta: 'Evita el consumo de tabaco, el encendido de carros al interior de la vivienda y el uso de leña para cocinar', sispro: '3' },
  { valor: 'residuos_tapados', etiqueta: 'Los residuos sólidos se almacenan en recipientes con tapa, se separan en la fuente, no se queman, no se tiran a campo abierto o en fuentes de agua', sispro: '4' },
  { valor: 'pisos_limpios', etiqueta: 'Los pisos y paredes de la vivienda están limpios', sispro: '5' },
  { valor: 'toldillos', etiqueta: 'Usa toldillos, angeos y trampas caseras para la protección contra vectores y roedores', sispro: '6' },
  { valor: 'peridomicilio_limpio', etiqueta: 'Al interior de la vivienda o el peri-domicilio, jardín o espacios como patio o azotea están limpios', sispro: '7' },
  { valor: 'quimicos_seguros', etiqueta: 'El lugar donde se almacenan los productos químicos está ventilado, cerrado, separado de alimentos y fuera del alcance de niños y mascotas', sispro: '8' }
];

/* ---------------------------------------------------------
   RN-062 / RN-063 / RN-064 — Tipo de identificación del integrante
   `edadMinMeses` y `edadMaxMeses` definen la coherencia con la edad
   calculada; `bloqueaEdad` distingue el bloqueo de la advertencia;
   `exigeExtranjero` obliga a nacionalidad distinta de Colombia.
   --------------------------------------------------------- */
/* El anexo remite a la tabla TipoIDAfiliado de SISPRO (variable 6 del
   registro tipo 3), que trae AS, CC, CD, CE, MS, PA, PE, PT, RC y TI. El
   certificado de nacido vivo (NV) no está en ella: el recién nacido sin
   registro civil se reporta como MS. NV se conserva para leer las fichas
   que ya lo usaron, pero no se ofrece. */
const CAT_TIPO_ID_INTEGRANTE = [
  {
    valor: 'AS', etiqueta: 'AS. Adulto sin Identificación', sispro: 'AS',
    formato: 'temporal', edadMinMeses: 216, edadMaxMeses: null,
    bloqueaEdad: true, exigeExtranjero: false, sinDocumento: true
  },
  {
    valor: 'CC', etiqueta: 'CC. Cédula de Ciudadanía', sispro: 'CC',
    formato: 'numerico_6_10', edadMinMeses: 216, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'CD', etiqueta: 'CD. Carné Diplomático', sispro: 'CD',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true
  },
  {
    valor: 'CE', etiqueta: 'CE. Cédula de Extranjería', sispro: 'CE',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true
  },
  {
    valor: 'MS', etiqueta: 'MS. Menor sin Identificación', sispro: 'MS',
    formato: 'temporal', edadMinMeses: 0, edadMaxMeses: 215,
    bloqueaEdad: true, exigeExtranjero: false, sinDocumento: true
  },
  {
    valor: 'NV', etiqueta: 'NV. Certificado de Nacido Vivo', vigente: false,
    formato: 'alfanumerico_5_16', edadMinMeses: 0, edadMaxMeses: 11,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'PA', etiqueta: 'PA. Pasaporte', sispro: 'PA',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'PE', etiqueta: 'PE. Permiso Especial de Permanencia', sispro: 'PE',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true, migrante: true
  },
  {
    valor: 'PT', etiqueta: 'PT. Permiso por Protección Temporal', sispro: 'PT',
    formato: 'alfanumerico_5_16', edadMinMeses: null, edadMaxMeses: null,
    bloqueaEdad: false, exigeExtranjero: true, migrante: true
  },
  {
    valor: 'RC', etiqueta: 'RC. Registro Civil', sispro: 'RC',
    formato: 'numerico_8_11', edadMinMeses: 0, edadMaxMeses: 83,
    bloqueaEdad: false, exigeExtranjero: false
  },
  {
    valor: 'TI', etiqueta: 'TI. Tarjeta de identidad', sispro: 'TI',
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
   RN-065 — País de origen (variable 9)
   La lista es CAT_PAIS (catalogos_sispro.js, tabla Pais de SISPRO):
   el anexo exige el código numérico del país, así que ya no basta
   con «Colombia, Venezuela u Otra» más el nombre escrito a mano.
   --------------------------------------------------------- */
const NACIONALIDAD_COLOMBIA = 'CO';
/* Valor de las fichas anteriores al anexo, cuando la lista era corta y el
   país se escribía en el ítem 65.1. Ya no se ofrece; se lee para corregir. */
const NACIONALIDAD_OTRA = 'OT';

/* ---------------------------------------------------------
   Anexo SI-APS, variable 10 — Estatus migratorio
   --------------------------------------------------------- */
const ESTATUS_MIGRATORIO_NO_APLICA = 'no_aplica';

const CAT_ESTATUS_MIGRATORIO = [
  { valor: 'regular', etiqueta: 'Regular', sispro: '1' },
  { valor: 'sin_autorizacion', etiqueta: 'Sin autorización de permanencia', sispro: '2' },
  { valor: ESTATUS_MIGRATORIO_NO_APLICA, etiqueta: 'No aplica (nacional colombiano)', sispro: '3' }
];

/* ---------------------------------------------------------
   RN-066 / RN-067 / RN-068 / RN-069 — Sexo, género y orientación
   (variables 11 a 14)
   --------------------------------------------------------- */
const CAT_SEXO = [
  { valor: 'hombre', etiqueta: 'Hombre', sispro: '1' },
  { valor: 'mujer', etiqueta: 'Mujer', sispro: '2' },
  { valor: 'intersexual', etiqueta: 'Intersexual (Indeterminado)', sispro: '3' }
];

/* Sexos con capacidad de gestar para RN-085 y RN-205 */
const SEXOS_CON_CAPACIDAD_GESTAR = ['mujer', 'intersexual'];

const CAT_GENERO = [
  { valor: 'femenino', etiqueta: 'Femenino', sispro: '1' },
  { valor: 'masculino', etiqueta: 'Masculino', sispro: '2' }
];

const CAT_AUTOIDENTIFICACION_GENERO = [
  { valor: 'femenino', etiqueta: 'Femenino', sispro: '1' },
  { valor: 'masculino', etiqueta: 'Masculino', sispro: '2' },
  { valor: 'transexual', etiqueta: 'Transexual', diversa: true, sispro: '3' },
  { valor: 'transgenero', etiqueta: 'Transgenero', diversa: true, sispro: '4' },
  { valor: 'no_responde', etiqueta: 'No responde', sispro: '5' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true, sispro: '6' }
];

const CAT_ORIENTACION_SEXUAL = [
  { valor: 'heterosexual', etiqueta: 'Heterosexual', sispro: '1' },
  { valor: 'lesbiana', etiqueta: 'Lesbiana', sispro: '2' },
  { valor: 'gay', etiqueta: 'Gay', sispro: '3' },
  { valor: 'bisexual', etiqueta: 'Bisexual', sispro: '4' },
  { valor: 'no_responde', etiqueta: 'No responde', sispro: '5' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true, sispro: '6' }
];

/* ---------------------------------------------------------
   RN-072 — Rol dentro de la familia (variable 17)
   --------------------------------------------------------- */
const ROL_RESPONSABLE_ECONOMICO = 'responsable_economico';

const CAT_ROL_FAMILIAR = [
  { valor: ROL_RESPONSABLE_ECONOMICO, etiqueta: 'Responsable económico de la familia', sispro: '1' },
  { valor: 'conyuge', etiqueta: 'Cónyuge o compañero(a)', sispro: '2' },
  { valor: 'hijo', etiqueta: 'Hijo(a)', sispro: '3' },
  { valor: 'hermano', etiqueta: 'Hermano(a)', sispro: '4' },
  { valor: 'padre_madre', etiqueta: 'Padre o madre', sispro: '5' },
  { valor: 'otros', etiqueta: 'Otros', sispro: '6' }
];

/* ---------------------------------------------------------
   RN-073 — Ocupación (variable 18)
   CAT_OCUPACION_CIUO está en catalogos_sispro.js. 9998 es la que el
   anexo manda usar para desempleados, amas de casa y dedicación al
   hogar; también es la que se reporta para menores de 15 años, a
   quienes el instrumento no pregunta la ocupación.
   --------------------------------------------------------- */
const OCUPACION_SIN_OCUPACION = '9998';

/* ---------------------------------------------------------
   RN-074 — Nivel educativo (variable 19, tabla SGDNivEducativo)
   `edadMinimaEsperada` soporta la advertencia de coherencia.
   «Técnica Laboral» no existe en la tabla oficial: no se ofrece.
   --------------------------------------------------------- */
const CAT_NIVEL_EDUCATIVO = [
  { valor: 'preescolar', etiqueta: 'Preescolar', edadMinimaEsperada: 3, sispro: '1' },
  { valor: 'basica_primaria', etiqueta: 'Básica Primaria', edadMinimaEsperada: 5, sispro: '2' },
  { valor: 'basica_secundaria', etiqueta: 'Básica Secundaria', edadMinimaEsperada: 10, sispro: '3' },
  { valor: 'media_academica', etiqueta: 'Media Académica o Clásica', edadMinimaEsperada: 14, sispro: '4' },
  { valor: 'media_tecnica', etiqueta: 'Media Técnica (Bachillerato Técnico)', edadMinimaEsperada: 14, sispro: '5' },
  { valor: 'normalista', etiqueta: 'Normalista', edadMinimaEsperada: 16, sispro: '6' },
  { valor: 'tecnica_profesional', etiqueta: 'Técnica Profesional', edadMinimaEsperada: 16, sispro: '7' },
  { valor: 'tecnologica', etiqueta: 'Tecnológica', edadMinimaEsperada: 17, sispro: '8' },
  { valor: 'profesional', etiqueta: 'Profesional', edadMinimaEsperada: 20, sispro: '9' },
  { valor: 'especializacion', etiqueta: 'Especialización', edadMinimaEsperada: 22, sispro: '10' },
  { valor: 'maestria', etiqueta: 'Maestría', edadMinimaEsperada: 23, sispro: '11' },
  { valor: 'doctorado', etiqueta: 'Doctorado', edadMinimaEsperada: 24, sispro: '12' },
  { valor: 'tecnica_laboral', etiqueta: 'Técnica Laboral', edadMinimaEsperada: 15, vigente: false },
  { valor: 'ninguno', etiqueta: 'Ninguno', edadMinimaEsperada: 0, sispro: '13' }
];

/* ---------------------------------------------------------
   RN-075 / RN-076 / RN-209 — Régimen de afiliación (variable 20)
   --------------------------------------------------------- */
const REGIMEN_NO_AFILIADO = 'no_afiliado';

const CAT_REGIMEN_AFILIACION = [
  { valor: 'subsidiado', etiqueta: 'Subsidiado', sispro: '1' },
  { valor: 'contributivo', etiqueta: 'Contributivo', sispro: '2' },
  { valor: 'especial', etiqueta: 'Especial', sispro: '3' },
  { valor: 'excepcion', etiqueta: 'Excepción', sispro: '4' },
  { valor: REGIMEN_NO_AFILIADO, etiqueta: 'No afiliado', sispro: '5' }
];

/* =========================================================
   PRESTADOR PRIMARIO (ítem 11, RN-011, variable 26)
   ---------------------------------------------------------
   Las EAPB, el país y la ocupación ya no son provisionales: salen
   de las tablas oficiales de SISPRO (catalogos_sispro.js). El
   prestador sigue siendo un catálogo propio porque la ficha la
   diligencia sólo la E.S.E. Ladera; lo que el anexo reporta de él
   es el NIT sin dígito de verificación (variable 26), que va en
   `nit`.
   --------------------------------------------------------- */

/* Red pública de Santiago de Cali. */
/* RN-011 — Único prestador que diligencia la ficha con esta herramienta. */
const PRESTADOR_FIJO = { valor: 'PROV-ESE-LADERA', etiqueta: 'E.S.E. Red de Salud de Ladera', nit: '805027289' };

const CAT_PRESTADOR = [
  { valor: 'PROV-ESE-LADERA', etiqueta: 'E.S.E. Ladera', nit: '805027289' },
  { valor: 'PROV-ESE-CENTRO', etiqueta: 'E.S.E. Centro' },
  { valor: 'PROV-ESE-NORTE', etiqueta: 'E.S.E. Norte' },
  { valor: 'PROV-ESE-ORIENTE', etiqueta: 'E.S.E. Oriente' },
  { valor: 'PROV-ESE-SURORIENTE', etiqueta: 'E.S.E. Suroriente' }
];

/* ---------------------------------------------------------
   RN-077 — Sujeto de especial protección constitucional
   --------------------------------------------------------- */
const SUJETO_GESTANTE = 'gestante';
/* El anexo (variable 23) abre la modalidad de la violencia con la opción 10,
   «Víctima de violencia interpersonal». La opción de «violencia de género e
   intrafamiliar» del instrumento impreso no existe en el anexo: se leen las
   fichas que la usaron, pero ya no se ofrece. */
const SUJETO_VIOLENCIA_INTERPERSONAL = 'victima_violencia_interpersonal';
const SUJETO_VIOLENCIA_GENERO = 'victima_violencia_genero';
const SUJETOS_CON_MODALIDAD_VIOLENCIA = [SUJETO_VIOLENCIA_INTERPERSONAL, SUJETO_VIOLENCIA_GENERO];

const CAT_SUJETO_ESPECIAL_PROTECCION = [
  { valor: 'ninez', etiqueta: 'Niñas, niños o adolescentes', sispro: '1' },
  { valor: SUJETO_GESTANTE, etiqueta: 'Gestante', sispro: '2' },
  { valor: 'adulto_mayor', etiqueta: 'Persona adulta mayor', sispro: '3' },
  { valor: 'orientacion_diversa', etiqueta: 'Personas con orientación sexual diversa', sispro: '4' },
  { valor: 'campesino', etiqueta: 'Campesina o campesino', sispro: '5' },
  { valor: 'migrante', etiqueta: 'Migrantes', sispro: '6' },
  { valor: 'madre_cabeza_familia', etiqueta: 'Madre cabeza de familia', sispro: '7' },
  { valor: 'enfermedad_huerfana', etiqueta: 'Personas con enfermedades huérfanas', sispro: '8' },
  { valor: 'victima_conflicto', etiqueta: 'Víctima del conflicto armado', violencia: true, sispro: '9' },
  { valor: SUJETO_VIOLENCIA_INTERPERSONAL, etiqueta: 'Víctima de violencia interpersonal', violencia: true, sispro: '10' },
  { valor: SUJETO_VIOLENCIA_GENERO, etiqueta: 'Víctima de violencia de género e intrafamiliar', violencia: true, sispro: '10', vigente: false },
  { valor: 'privado_libertad', etiqueta: 'Persona privada de la libertad (medida domiciliaria)', sispro: '11' },
  { valor: 'responsabilidad_penal_adolescente', etiqueta: 'Personas en el sistema de responsabilidad penal adolescente', sispro: '12' },
  { valor: 'discapacidad', etiqueta: 'Persona con condición de discapacidad', sispro: '14' },
  { valor: 'otro', etiqueta: 'Otro', exigeCual: true, sispro: '15' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '13' }
];

/* ---------------------------------------------------------
   RN-078 — Modalidad de la violencia (variable 23)
   El instrumento impreso duplica "Negligencia y abandono";
   aquí se registra una sola vez (ver Anexo C del documento).
   --------------------------------------------------------- */
const MODALIDAD_VIOLENCIA_SEXUAL = 'sexual';

const CAT_MODALIDAD_VIOLENCIA = [
  { valor: 'fisica', etiqueta: 'Física', sispro: '1' },
  { valor: 'psicologica', etiqueta: 'Psicológica', sispro: '2' },
  { valor: 'negligencia_abandono', etiqueta: 'Negligencia y abandono', sispro: '3' },
  { valor: MODALIDAD_VIOLENCIA_SEXUAL, etiqueta: 'Sexual', sispro: '4' },
  { valor: 'patrimonial', etiqueta: 'Patrimonial o económica', sispro: '5' }
];

/* ---------------------------------------------------------
   RN-079 / RN-080 — Pertenencia étnica (variable 24, tabla MDECEtnia)
   El código lleva cero a la izquierda: 01 a 07.
   --------------------------------------------------------- */
const ETNIA_NINGUNA = 'ninguna';

const CAT_PERTENENCIA_ETNICA = [
  { valor: 'indigena', etiqueta: 'Indígena', sispro: '01' },
  { valor: 'rrom', etiqueta: 'Rrom (Gitanos)', sispro: '02' },
  { valor: 'raizal', etiqueta: 'Raizal (San Andrés y Providencia)', sispro: '03' },
  { valor: 'palenquero', etiqueta: 'Palenquero de San Basilio de Palenque', sispro: '04' },
  { valor: 'negro', etiqueta: 'Negro(a)', sispro: '05' },
  { valor: 'afrocolombiano', etiqueta: 'Afrocolombiano', sispro: '06' },
  { valor: ETNIA_NINGUNA, etiqueta: 'Ninguna de las anteriores', sispro: '07' }
];

/* ---------------------------------------------------------
   RN-081 — Saberes ancestrales (variable 26)
   --------------------------------------------------------- */
const CAT_SABERES_ANCESTRALES = [
  { valor: 'proteccion_danos', etiqueta: 'Prácticas para proteger ante posibles daños (aseguranzas, rituales y otros)', sispro: '1' },
  { valor: 'transicion', etiqueta: 'Prácticas que acompañan en momentos de transición (arrullos o cantos, rituales de paso u otros)', sispro: '2' },
  { valor: 'cuidado_salud', etiqueta: 'Prácticas tradicionales para el cuidado de la salud (baile o danza, música, uso de plantas, masajes u otros)', sispro: '3' },
  { valor: 'armonizacion', etiqueta: 'Prácticas de armonización o para favorecer el bienestar (rituales, consejería del sabedor/a, pagamentos)', sispro: '4' },
  { valor: 'partera_sabedor', etiqueta: 'Acompañamiento de partera, sabedor o médico tradicional en los procesos de salud enfermedad', sispro: '5' },
  { valor: 'cuidado_entorno', etiqueta: 'Prácticas de cuidado con el entorno, con los alimentos u otros', sispro: '6' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '7' }
];

/* ---------------------------------------------------------
   RN-082 / RN-083 — Discapacidad (variables 30 y 31)
   --------------------------------------------------------- */
const SIN_DISCAPACIDAD = 'sin_discapacidad';

const CAT_DISCAPACIDAD = [
  { valor: 'fisica', etiqueta: 'Física', sispro: '1' },
  { valor: 'auditiva', etiqueta: 'Auditiva', sispro: '2' },
  { valor: 'visual', etiqueta: 'Visual', sispro: '3' },
  { valor: 'sordoceguera', etiqueta: 'Sordoceguera', sispro: '4' },
  { valor: 'intelectual', etiqueta: 'Intelectual', sispro: '5' },
  { valor: 'psicosocial', etiqueta: 'Psicosocial (mental)', sispro: '6' },
  { valor: 'multiple', etiqueta: 'Múltiple', sispro: '7' },
  { valor: SIN_DISCAPACIDAD, etiqueta: 'Sin discapacidad', excluyente: true, sispro: '8' }
];

/* ---------------------------------------------------------
   RN-086 — Prácticas rutinarias de cuidado de la salud (variable 28)
   --------------------------------------------------------- */
const CAT_PRACTICAS_CUIDADO = [
  { valor: 'alimentacion', etiqueta: 'Consume alimentos en cantidad y calidad suficiente todos los días', sispro: '1' },
  { valor: 'actividad_fisica', etiqueta: 'Realiza actividad física, ejercicio o actividad deportiva', sispro: '2' },
  { valor: 'higiene_oral', etiqueta: 'Higiene oral diaria (cepillado mínimo 2 veces al día)', sispro: '3' },
  { valor: 'lavado_manos', etiqueta: 'Lavado de manos antes de consumir alimentos o después de entrar al baño, cambiar pañales, tener contacto con animales, retirar secreciones nasales, llegar de la calle, manipular sustancias químicas', sispro: '4' },
  { valor: 'sueno', etiqueta: 'Duerme lo suficiente para estar con energía durante todo el día (entre 6 a 8 horas diarias)', sispro: '5' },
  { valor: 'control_pantallas', etiqueta: 'Controla el tiempo de exposición a televisión, videojuegos y celular (menos de 2 horas al día)', sispro: '6' },
  { valor: 'ocio', etiqueta: 'Realiza actividades en el tiempo libre o de ocio', sispro: '7' },
  { valor: 'actividades_culturales', etiqueta: 'Participa en actividades culturales, sociales, alternativas o complementarias que aportan al cuidado de la salud', sispro: '8' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '9' }
];

/* ---------------------------------------------------------
   RN-087 — Atenciones pendientes de promoción y mantenimiento
   `rangos` son pares [edadMinMeses, edadMaxMeses] (null = sin tope).
   `sexos` restringe por sexo biológico; null = ambos.
   `gestante` habilita la atención cuando hay gestación confirmada.
   `mujerEdadFertil` la habilita en mujeres de 10 a 54 años.
   --------------------------------------------------------- */
const CAT_ATENCIONES_RPMS = [
  { valor: 'valoracion_integral_pyms', etiqueta: 'Valoración Integral para la PYMS', rangos: [[0, null]], sexos: null, sispro: '1' },
  { valor: 'valoracion_salud_bucal', etiqueta: 'Valoración integral en salud bucal por profesional en odontología para la PYMS', rangos: [[0, null]], sexos: null, sispro: '2' },
  { valor: 'lactancia_materna', etiqueta: 'Promoción y apoyo a lactancia materna', rangos: [[0, 24]], sexos: null, gestante: true, sispro: '3' },
  { valor: 'aplicacion_fluor', etiqueta: 'Aplicación de flúor', rangos: [[12, 215]], sexos: null, sispro: '4' },
  { valor: 'profilaxis_placa', etiqueta: 'Profilaxis y remoción de placa bacteriana', rangos: [[24, null]], sexos: null, sispro: '5' },
  { valor: 'vacunacion', etiqueta: 'Vacunación de acuerdo con el esquema', rangos: [[0, 215], [720, null]], sexos: null, gestante: true, sispro: '6' },
  { valor: 'fortificacion_micronutrientes', etiqueta: 'Fortificación casera con micronutrientes en polvo', rangos: [[6, 23]], sexos: null, sispro: '7' },
  { valor: 'suplementacion_micronutrientes', etiqueta: 'Suplementación con micronutrientes', rangos: [[6, 155]], sexos: null, gestante: true, sispro: '8' },
  { valor: 'desparasitacion', etiqueta: 'Desparasitación intestinal antihelmíntica', rangos: [[12, 215]], sexos: null, sispro: '9' },
  { valor: 'tamizaje_anemia', etiqueta: 'Tamizaje para anemia - Hemoglobina y hematocrito', rangos: [[6, 71]], sexos: null, gestante: true, mujerEdadFertil: true, sispro: '10' },
  { valor: 'asesoria_anticoncepcion', etiqueta: 'Asesoría en anticoncepción (planificación familiar)', rangos: [[156, null]], sexos: null, sispro: '11' },
  { valor: 'suministro_anticonceptivos', etiqueta: 'Suministro de anticonceptivos', rangos: [[156, null]], sexos: null, sispro: '19' },
  { valor: 'tamizaje_its', etiqueta: 'Tamizaje para ITS', rangos: [[156, null]], sexos: null, gestante: true, sispro: '13' },
  { valor: 'tamizaje_cardiovascular', etiqueta: 'Tamizaje de riesgo cardiovascular', rangos: [[216, null]], sexos: null, sispro: '12' },
  { valor: 'prueba_treponemica', etiqueta: 'Prueba rápida treponémica', rangos: [[156, null]], sexos: null, gestante: true, sispro: '20' },
  { valor: 'prueba_vih', etiqueta: 'Prueba rápida y asesoría pre y postest VIH', rangos: [[156, null]], sexos: null, gestante: true, sispro: '21' },
  { valor: 'prueba_hepatitis', etiqueta: 'Prueba rápida para Hepatitis B (18 a 28 años) y C (22 a 28 años)', rangos: [[216, 347]], sexos: null, sispro: '22' },
  { valor: 'prueba_embarazo', etiqueta: 'Prueba de embarazo en caso de retraso menstrual u otros síntomas o signos de sospecha', rangos: [[120, null]], sexos: ['mujer', 'intersexual'], sispro: '23' },
  { valor: 'tamizaje_cuello_uterino', etiqueta: 'Tamizaje para cáncer de cuello uterino (mujeres de 20 a 28 años)', rangos: [[240, 347]], sexos: ['mujer', 'intersexual'], sispro: '14' },
  { valor: 'colposcopia', etiqueta: 'Colposcopia y Biopsia cérvico uterina (mujeres)', rangos: [[240, null]], sexos: ['mujer', 'intersexual'], sispro: '24' },
  { valor: 'tamizaje_mama', etiqueta: 'Tamizaje para cáncer de mama', rangos: [[480, null]], sexos: ['mujer', 'intersexual'], sispro: '15' },
  { valor: 'tamizaje_prostata', etiqueta: 'Tamizaje para cáncer de próstata', rangos: [[600, null]], sexos: ['hombre', 'intersexual'], sispro: '16' },
  { valor: 'tamizaje_colon', etiqueta: 'Tamizaje para cáncer de colon y recto', rangos: [[600, null]], sexos: null, sispro: '17' },
  { valor: 'cuidado_preconcepcional', etiqueta: 'Atención para el cuidado preconcepcional', rangos: [[120, 659]], sexos: null, sispro: '26' },
  { valor: 'educacion_salud', etiqueta: 'Educación para la salud', rangos: [[0, null]], sexos: null, sispro: '25' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, rangos: [[0, null]], sexos: null, sispro: '18' }
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
   RN-088 — Atenciones pendientes de la ruta materno perinatal (variable 34)
   «No aplica» (9) es lo que se reporta de quien no está gestando: el
   formulario sólo muestra la pregunta a gestantes.
   --------------------------------------------------------- */
const CAT_ATENCIONES_MATERNO = [
  { valor: 'preconcepcional', etiqueta: 'Atención para el cuidado preconcepcional', sispro: '1' },
  { valor: 'ive', etiqueta: 'Interrupción Voluntaria del Embarazo -IVE-', sispro: '2' },
  { valor: 'control_prenatal', etiqueta: 'Atención para el cuidado prenatal - Controles prenatales', esencial: true, sispro: '3' },
  { valor: 'preparacion_maternidad', etiqueta: 'Preparación para la maternidad y paternidad', sispro: '4' },
  { valor: 'puerperio', etiqueta: 'Atención del puerperio', sispro: '5' },
  { valor: 'anticonceptivo_postparto', etiqueta: 'Provisión del método anticonceptivo post parto inmediato', sispro: '6' },
  { valor: 'seguimiento_recien_nacido', etiqueta: 'Atención para el seguimiento del recién nacido', sispro: '7' },
  { valor: 'educacion_salud', etiqueta: 'Educación para la salud', sispro: '8' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '9', vigente: false },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '10' }
];

/* ---------------------------------------------------------
   RN-089 / RN-210 — Barreras de acceso (variable 35)
   `tipo` y `prioridad` alimentan la clasificación de RN-210.
   --------------------------------------------------------- */
const CAT_BARRERAS_ACCESO = [
  { valor: 'no_afiliado', etiqueta: 'No Afiliado', tipo: 'aseguramiento', prioridad: 'prioritaria', sispro: '1' },
  { valor: 'desconoce_derecho', etiqueta: 'Desconocimiento del derecho a las intervenciones', tipo: 'informacion', prioridad: 'regular', sispro: '2' },
  { valor: 'desconoce_gratuidad', etiqueta: 'Desconocimiento que las intervenciones son gratuitas', tipo: 'informacion', prioridad: 'regular', sispro: '3' },
  { valor: 'servicio_lejano', etiqueta: 'El servicio de salud está lejos del lugar de residencia', tipo: 'geografica', prioridad: 'regular', sispro: '4' },
  { valor: 'sin_personal', etiqueta: 'No hay personal de salud en el centro de salud cercano', tipo: 'geografica', prioridad: 'regular', sispro: '5' },
  { valor: 'tramites', etiqueta: 'Dificultades con trámites administrativos', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '6' },
  { valor: 'sin_agenda', etiqueta: '"No hay agenda" para esta atención', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '7' },
  { valor: 'no_sabe_solicitar', etiqueta: 'No sabe cómo solicitar la cita', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '8' },
  { valor: 'horarios_restringidos', etiqueta: 'Horarios de atención restringidos', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '9' },
  { valor: 'tiempos_espera', etiqueta: 'Largos tiempos de espera', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '10' },
  { valor: 'incomodidad_personal', etiqueta: 'No se siente cómodo(a) con el personal de salud', tipo: 'cultural', prioridad: 'regular', sispro: '11' },
  { valor: 'no_puede_acudir', etiqueta: 'Persona enferma que no puede acudir al servicio', tipo: 'dependencia', prioridad: 'prioritaria', sispro: '12' },
  { valor: 'falta_tiempo_cuidador', etiqueta: 'Falta de tiempo del cuidador', tipo: 'dependencia', prioridad: 'prioritaria', sispro: '13' },
  { valor: 'adecuacion_sociocultural', etiqueta: 'Falta de adecuación sociocultural del servicio', tipo: 'cultural', prioridad: 'regular', sispro: '14' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '15' }
];

/* ---------------------------------------------------------
   RN-090 — Prácticas para el ejercicio del derecho a la salud (variable 27)
   El anexo añade «No registra» y «Ninguna», las dos excluyentes: la
   pregunta pasa a ser obligatoria y necesita una respuesta para quien
   no conoce ninguna de las cuatro.
   --------------------------------------------------------- */
const CAT_CONOCIMIENTO_DERECHO = [
  { valor: 'derechos_deberes', etiqueta: 'Conoce los derechos y deberes en salud', sispro: '1' },
  { valor: 'informacion_atenciones', etiqueta: 'Tiene información sobre las atenciones y servicios de salud a los cuales tiene derecho (promoción, prevención, atención, rehabilitación)', sispro: '2' },
  { valor: 'lugares_servicios', etiqueta: 'Conoce los lugares donde pueden prestar los servicios de salud', sispro: '3' },
  { valor: 'resolver_dificultades', etiqueta: 'Conoce cómo resolver las dificultades que se le presentan para acceder a la atención en salud', sispro: '4' },
  { valor: 'no_registra', etiqueta: 'No registra', excluyente: true, sispro: '5' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '6' }
];

/* ---------------------------------------------------------
   RN-096 / RN-204 — Clasificación antropométrica (variable 42)
   --------------------------------------------------------- */
const CAT_CLASIFICACION_ANTROPOMETRICA = [
  { valor: 'obesidad', etiqueta: 'Obesidad', prioridad: 'regular', sispro: '1' },
  { valor: 'sobrepeso', etiqueta: 'Sobrepeso', prioridad: 'regular', sispro: '2' },
  { valor: 'riesgo_sobrepeso', etiqueta: 'Riesgo de Sobrepeso', prioridad: 'regular', sispro: '3' },
  { valor: 'peso_adecuado', etiqueta: 'Peso Adecuado para la Talla o IMC adecuado para la edad', prioridad: null, sispro: '4' },
  { valor: 'riesgo_desnutricion', etiqueta: 'Riesgo de Desnutrición Aguda (en <5 años), o Riesgo de delgadez (en > de 4 años) o Bajo peso para la edad gestacional o Delgadez (en mayores de 17 años)', prioridad: 'regular', sispro: '5' },
  { valor: 'desnutricion_moderada', etiqueta: 'Desnutrición Aguda Moderada', prioridad: 'prioritaria', sispro: '6' },
  { valor: 'desnutricion_severa', etiqueta: 'Desnutrición Aguda Severa', prioridad: 'inmediata', sispro: '7' },
  { valor: 'riesgo_delgadez', etiqueta: 'Riesgo de Delgadez', prioridad: 'regular', sispro: '8' },
  { valor: 'delgadez', etiqueta: 'Delgadez', prioridad: 'regular', sispro: '9' },
  { valor: 'bajo_peso_gestacional', etiqueta: 'Bajo Peso para la Edad Gestacional', prioridad: 'prioritaria', sispro: '10' },
  { valor: 'normal', etiqueta: 'Normal', prioridad: null, sispro: '11' }
];

/* ---------------------------------------------------------
   RN-097 — Signos físicos de desnutrición aguda (variable 41)
   «No aplica» (9) es lo que se reporta fuera de los 3 meses a 5 años.
   --------------------------------------------------------- */
const CAT_SIGNOS_DESNUTRICION = [
  { valor: 'cabeza', etiqueta: 'Cabeza', sispro: '1' },
  { valor: 'cara', etiqueta: 'Cara', sispro: '2' },
  { valor: 'piel', etiqueta: 'Piel', sispro: '3' },
  { valor: 'torax_abdomen', etiqueta: 'Tórax y abdomen', sispro: '4' },
  { valor: 'extremidades', etiqueta: 'Extremidades', sispro: '5' },
  { valor: 'comportamiento', etiqueta: 'Comportamiento', sispro: '6' },
  { valor: 'edema', etiqueta: 'Edema', severo: true, sispro: '7' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '8' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '9', vigente: false }
];

/* ---------------------------------------------------------
   RN-099 / RN-203 — Clasificación de tensión arterial (AHA 2024, variable 46)
   «No aplica» (6) es lo que se reporta de los menores de 18 años.
   --------------------------------------------------------- */
const CAT_CLASIFICACION_TENSION = [
  { valor: 'crisis', etiqueta: 'Crisis hipertensiva (sistólica más alta de 180 mm Hg y/o diastólica más alta de 120 mm Hg)', prioridad: 'inmediata', sispro: '1' },
  { valor: 'nivel2', etiqueta: 'Alta - Hipertensión nivel 2 (sistólica 140 mm Hg o más alta o diastólica 90 mm Hg o más alta)', prioridad: 'prioritaria', sispro: '2' },
  { valor: 'nivel1', etiqueta: 'Alta - Hipertensión nivel 1 (sistólica de 130 a 139 mm Hg o diastólica 80 a 89 mm Hg)', prioridad: 'regular', sispro: '3' },
  { valor: 'elevada', etiqueta: 'Elevada (sistólica de 120 a 129 mm Hg y diastólica menos de 80 mm Hg)', prioridad: 'regular', sispro: '4' },
  { valor: 'normal', etiqueta: 'Normal (sistólica menos de 120 mm Hg y diastólica menos de 80 mm Hg)', prioridad: null, sispro: '5' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', prioridad: null, sispro: '6', vigente: false }
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
   RN-100 — Enfermedades no transmisibles (variable 59)
   El anexo amplía la lista con seis enfermedades (11 a 16).
   --------------------------------------------------------- */
const CAT_ENFERMEDADES_NO_TRANSMISIBLES = [
  { valor: 'obstetrica', etiqueta: 'Enfermedad obstétrica (trastornos hipertensivos, hemorragias, sepsis, diabetes gestacional, otra)', sispro: '1' },
  { valor: 'cardiovascular', etiqueta: 'Enfermedades cardiovasculares (Hipertensión, enfermedad cardiaca)', cardiovascular: true, sispro: '2' },
  { valor: 'diabetes', etiqueta: 'Diabetes', cardiovascular: true, sispro: '3' },
  { valor: 'cancer', etiqueta: 'Cáncer', sispro: '4' },
  { valor: 'epoc', etiqueta: 'EPOC, neumoconiosis (asbestosis, silicosis o antracosis)', sispro: '5' },
  { valor: 'raras_huerfanas', etiqueta: 'Enfermedades raras y huérfanas', sispro: '6' },
  { valor: 'trastorno_mental', etiqueta: 'Trastorno mental', saludMental: true, sispro: '7' },
  { valor: 'epilepsia', etiqueta: 'Epilepsia', sispro: '8' },
  { valor: 'secuelas_lesiones', etiqueta: 'Secuelas de lesiones por causa externa (secuelas de accidentes, agresiones físicas e intento de suicidio)', sispro: '9' },
  { valor: 'enfermedad_pulmones', etiqueta: 'Enfermedad de los pulmones', sispro: '11' },
  { valor: 'cerebrovascular', etiqueta: 'Enfermedades cerebrovasculares', cardiovascular: true, sispro: '12' },
  { valor: 'osteoarticular', etiqueta: 'Enfermedades osteoarticulares', sispro: '13' },
  { valor: 'varices', etiqueta: 'Várices', sispro: '14' },
  { valor: 'hipertension', etiqueta: 'Hipertensión arterial', cardiovascular: true, sispro: '15' },
  { valor: 'dislipidemia', etiqueta: 'Colesterol o triglicéridos altos', cardiovascular: true, sispro: '16' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '10' }
];

/* ---------------------------------------------------------
   RN-101 / RN-208 — Condiciones de salud transmisible (variable 58)
   `notifica` marca los eventos de notificación obligatoria a SIVIGILA.
   --------------------------------------------------------- */
const CONDICION_TUBERCULOSIS = 'tuberculosis';

const CAT_CONDICIONES_TRANSMISIBLES = [
  { valor: 'prevalentes_infancia', etiqueta: 'Enfermedades prevalentes de la infancia (Enfermedad Diarreica Aguda, Infección Respiratoria Aguda)', prioridad: 'prioritaria', notifica: false, infancia: true, sispro: '1' },
  { valor: CONDICION_TUBERCULOSIS, etiqueta: 'Tuberculosis', prioridad: 'prioritaria', notifica: true, contactos: true, sispro: '2' },
  { valor: 'lepra', etiqueta: 'Lepra', prioridad: 'prioritaria', notifica: true, sispro: '3' },
  { valor: 'rabia', etiqueta: 'Rabia', prioridad: 'inmediata', notifica: true, sispro: '4' },
  { valor: 'dengue', etiqueta: 'Dengue', prioridad: 'prioritaria', notifica: true, vectorial: true, sispro: '5' },
  { valor: 'chikunguya', etiqueta: 'Chikungunya', prioridad: 'prioritaria', notifica: true, vectorial: true, sispro: '6' },
  { valor: 'zika', etiqueta: 'Zika', prioridad: 'prioritaria', notifica: true, vectorial: true, sispro: '7' },
  { valor: 'chagas', etiqueta: 'Chagas', prioridad: 'prioritaria', notifica: true, vectorial: true, sispro: '8' },
  { valor: 'leishmaniasis_visceral', etiqueta: 'Leishmaniasis visceral', prioridad: 'inmediata', notifica: true, sispro: '9' },
  { valor: 'leishmaniasis_cutanea', etiqueta: 'Leishmaniasis Cutánea', prioridad: 'prioritaria', notifica: true, sispro: '10' },
  { valor: 'tungiasis', etiqueta: 'Tungiasis', prioridad: 'regular', notifica: false, sispro: '11' },
  { valor: 'eta', etiqueta: 'Enfermedades transmitidas por alimentos (Cólera, hepatitis A, parasitosis intestinal)', prioridad: 'prioritaria', notifica: true, sispro: '12' },
  { valor: 'era', etiqueta: 'Enfermedad respiratoria aguda (ERA)', prioridad: 'prioritaria', notifica: false, infancia: true, sispro: '13' },
  { valor: 'eda', etiqueta: 'Enfermedad diarreica aguda (EDA)', prioridad: 'prioritaria', notifica: false, infancia: true, sispro: '14' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '15' }
];

/* ---------------------------------------------------------
   RN-102 — Zona endémica y sintomatología específica (variable 60)
   El anexo la reporta como respuesta ÚNICA (un código). El formulario
   la pregunta con opciones excluyentes entre sí.
   --------------------------------------------------------- */
const CAT_ZONA_ENDEMICA = [
  { valor: 'geohelmintiasis', etiqueta: 'Geohelmintiasis', prioridad: 'regular', sispro: '1' },
  { valor: 'teniasis', etiqueta: 'Teniasis / cisticercosis', prioridad: 'regular', sispro: '2' },
  { valor: 'tracoma', etiqueta: 'Tracoma', prioridad: 'regular', sispro: '3' },
  { valor: 'escabiosis', etiqueta: 'Escabiosis', prioridad: 'regular', sispro: '4' },
  { valor: 'pian', etiqueta: 'Pian', prioridad: 'regular', sispro: '5' },
  { valor: 'malaria', etiqueta: 'Malaria', prioridad: 'prioritaria', notifica: true, sispro: '6' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '7' }
];

/* ---------------------------------------------------------
   RN-104 — Motivo de no recibir atención (variable 62)
   --------------------------------------------------------- */
const CAT_MOTIVO_NO_TRATAMIENTO = [
  { valor: 'no_afiliada', etiqueta: 'Persona no afiliada', tipo: 'aseguramiento', prioridad: 'prioritaria', sispro: '1' },
  { valor: 'servicio_lejano', etiqueta: 'El servicio de salud está lejos del lugar de residencia', tipo: 'geografica', prioridad: 'regular', sispro: '2' },
  { valor: 'tramites', etiqueta: 'Dificultades con trámites administrativos', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '3' },
  { valor: 'sin_agenda', etiqueta: '"No hay agenda" para esta atención', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '4' },
  { valor: 'no_sabe_solicitar', etiqueta: 'No sabe cómo solicitar la cita', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '5' },
  { valor: 'no_puede_copago', etiqueta: 'No puede pagar el copago', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '6' },
  { valor: 'horarios_restringidos', etiqueta: 'Horarios de atención restringidos', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '7' },
  { valor: 'tiempos_espera', etiqueta: 'Largos tiempos de espera', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '8' },
  { valor: 'incomodidad_personal', etiqueta: 'No se siente cómodo(a) con el personal de salud', tipo: 'cultural', prioridad: 'regular', sispro: '9' },
  { valor: 'no_puede_acudir', etiqueta: 'Persona enferma que no puede acudir al servicio', tipo: 'dependencia', prioridad: 'prioritaria', sispro: '10' },
  { valor: 'no_adherencia', etiqueta: 'No tiene adherencia al tratamiento', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '11' },
  { valor: 'sin_medicamentos', etiqueta: 'No hay disponibilidad de medicamentos en el centro de atención', tipo: 'administrativa', prioridad: 'prioritaria', sispro: '12' },
  { valor: 'falta_tiempo_cuidador', etiqueta: 'Falta de tiempo del cuidador', tipo: 'dependencia', prioridad: 'prioritaria', sispro: '13' },
  { valor: 'adecuacion_sociocultural', etiqueta: 'Falta de adecuación sociocultural del servicio', tipo: 'cultural', prioridad: 'regular', sispro: '14' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '15' }
];

/* ---------------------------------------------------------
   RN-105 — Riesgos para la salud física o mental (variable 54)
   El anexo usa la tabla APSRiesgoFisicoMental —la misma lista de la
   familia, con dos matices de redacción— y la pide a todo integrante,
   no sólo a jóvenes. Las cuatro opciones del instrumento impreso que
   no están en esa tabla se conservan sólo para leer fichas antiguas.
   El nombre del catálogo se mantiene porque es el de su dominio en la
   base (RIESGOS_SALUD_MENTAL_JOVEN).
   --------------------------------------------------------- */
const CAT_RIESGOS_SALUD_MENTAL_JOVEN = [
  { valor: 'inicio_convivencia', etiqueta: 'Inicio de la convivencia en pareja', sispro: '1' },
  { valor: 'nuevo_integrante', etiqueta: 'Llegada de un nuevo integrante', sispro: '2' },
  { valor: 'ingreso_estudiar', etiqueta: 'Ingreso a estudiar', sispro: '3' },
  { valor: 'perdida_ano_escolar', etiqueta: 'Pérdida del año escolar', sispro: '4' },
  { valor: 'embarazo_adolescente', etiqueta: 'Embarazo temprano o adolescente', sispro: '5' },
  { valor: 'independencia_hogar', etiqueta: 'Independencia o salida del hogar paterno-materno', sispro: '6' },
  { valor: 'separacion_pareja', etiqueta: 'Separación de pareja', sispro: '7' },
  { valor: 'jubilacion', etiqueta: 'Jubilación', sispro: '8' },
  { valor: 'duelo', etiqueta: 'Duelo', sispro: '9' },
  { valor: 'desempleo', etiqueta: 'Desempleo o pérdida abrupta del trabajo', sispro: '10' },
  { valor: 'crisis_economica', etiqueta: 'Pérdidas o crisis económicas', sispro: '11' },
  { valor: 'enfermedad_terminal', etiqueta: 'Enfermedad terminal o huérfana/rara en alguno de sus integrantes', sispro: '12' },
  { valor: 'antecedente_suicidio', etiqueta: 'Antecedentes de intento o muerte por suicidio en alguno de sus integrantes', sispro: '13' },
  { valor: 'accidente_discapacidad', etiqueta: 'Accidente o situación que genera discapacidad', sispro: '14' },
  { valor: 'muerte_inesperada', etiqueta: 'Muerte inesperada', sispro: '15' },
  { valor: 'violencia', etiqueta: 'Vivencia de alguna forma de violencia', sispro: '16' },
  { valor: 'abandono', etiqueta: 'Persona en situación de abandono', sispro: '17' },
  { valor: 'migracion', etiqueta: 'Migración', sispro: '18' },
  { valor: 'consumo_spa', etiqueta: 'Consumo problemático de sustancias psicoactivas, incluyendo alcohol', sispro: '19' },
  { valor: 'trastorno_familiar', etiqueta: 'Trastorno de salud mental en algún integrante de la familia', sispro: '20' },
  { valor: 'conflictos_familiares', etiqueta: 'Conflictos familiares', vigente: false },
  { valor: 'sin_redes', etiqueta: 'No identifica / No cuenta con redes de apoyo sociales protectoras', vigente: false },
  { valor: 'estigma', etiqueta: 'Estigma y discriminación', vigente: false },
  { valor: 'conflictos_orientacion', etiqueta: 'Conflictos relacionados con su orientación sexual', vigente: false },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', excluyente: true, sispro: '21' }
];

/* ---------------------------------------------------------
   RN-106 / RN-207 — Sintomatología depresiva y ansiosa (variable 52)
   «No aplica» (5) es lo que se reporta de los menores de 14 años.
   --------------------------------------------------------- */
const CAT_SINTOMATOLOGIA_DEPRESIVA = [
  { valor: 'tristeza', etiqueta: 'Se ha sentido triste todos los días durante la mayor parte del día', sispro: '1' },
  { valor: 'anhedonia', etiqueta: 'Ha perdido el interés en actividades que antes disfrutaba', sispro: '2' },
  { valor: 'inquietud', etiqueta: 'Se ha sentido inquieto(a) o nervioso(a) todos los días durante la mayor parte del día', sispro: '3' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true, sispro: '4' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '5', vigente: false }
];

/* ---------------------------------------------------------
   RN-107 / RN-202 — Ideación o riesgo de suicidio (variable 53)
   --------------------------------------------------------- */
const IDEACION_CON_RIESGO = 'ha_pensado';

const CAT_IDEACION_SUICIDA = [
  { valor: IDEACION_CON_RIESGO, etiqueta: 'Ha pensado en lastimarse o en no querer seguir viviendo', riesgo: true, sispro: '1' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', riesgo: false, sispro: '2' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', riesgo: false, sispro: '3' }
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
/* Quien ejecuta una acción del plan o responde por un seguimiento es un
   integrante del EBS, es decir la misma clase de persona que el responsable
   del ítem 12. Se reutiliza aquel catálogo en vez de mantener una lista
   aparte: la lista propia ofrecía 'DE', que `aps.funcionario` no admite —su
   restricción valida contra TIPO_ID_RESPONSABLE—, de modo que escoger esa
   opción hacía imposible guardar el plan. */
const CAT_TIPO_ID_EJECUTOR = CAT_TIPO_ID_RESPONSABLE;

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

/* ---------------------------------------------------------
   RN-114 / RN-124 / RN-136a — Acciones del plan de cuidado
   ---------------------------------------------------------
   Ítems 114, 124 y 136a. A diferencia del resto de catálogos, éste no se
   escribe aquí: son decenas de códigos CUPS y NoCUPS que viven en `cat.cups`
   y cambian con cada actualización del catálogo oficial. Se pide en marcha a
   /api/catalogo_acciones y se guarda en el navegador para seguir sirviendo
   sin red.

   El arreglo se llena, no se reasigna: `CATALOGOS_DECLARATIVOS` guarda esta
   misma referencia, y sustituirla dejaría al formulario apuntando a la lista
   vieja.

   Antes el código se digitaba a mano y el formulario sólo comprobaba que no
   estuviera vacío. La base sí exige que exista, así que la ficha pasaba la
   validación en pantalla y la rechazaba el servidor al sincronizar.
   --------------------------------------------------------- */
const CAT_ACCION_PLAN = [];

/** Reemplaza el contenido del catálogo conservando la referencia. */
function fijarCatalogoAcciones(filas) {
  CAT_ACCION_PLAN.length = 0;
  (filas || []).forEach(function (fila) {
    CAT_ACCION_PLAN.push({
      valor: fila.codigo,
      etiqueta: fila.codigo + ' — ' + fila.nombre,
      ambito: fila.ambito || null
    });
  });
  return CAT_ACCION_PLAN;
}

function fijarCatalogosDinamicos(data) {
  if (data.eapb) {
    CAT_EAPB.length = 0;
    data.eapb.forEach(function(r) { CAT_EAPB.push(r); });
  }
  if (data.prestador) {
    CAT_PRESTADOR.length = 0;
    data.prestador.forEach(function(r) { CAT_PRESTADOR.push(r); });
  }
  if (data.uzpe) {
    CAT_UZPE.length = 0;
    CAT_UZPE_VIGENTES.length = 0;
    data.uzpe.forEach(function(r) {
      CAT_UZPE.push(r);
      CAT_UZPE_VIGENTES.push(r);
    });
  }
  if (data.territorios) {
    for (const key in CAT_TERRITORIOS) {
      if (Object.prototype.hasOwnProperty.call(CAT_TERRITORIOS, key)) {
        delete CAT_TERRITORIOS[key];
      }
    }
    for (const key in data.territorios) {
      if (Object.prototype.hasOwnProperty.call(data.territorios, key)) {
        CAT_TERRITORIOS[key] = data.territorios[key];
      }
    }
  }
}

/* =========================================================
   CATÁLOGOS DE LAS VARIABLES QUE AÑADE EL ANEXO TÉCNICO SI-APS
   ---------------------------------------------------------
   Anexo técnico del reporte APS124CCFP (versión 7, junio de
   2026). Estas preguntas no estaban en el instrumento impreso;
   las define anexo.js y cada una cita aquí su lista. El `valor`
   es interno y el `sispro`, el código que se reporta.
   ========================================================= */

/* --- Registro tipo 2: vivienda -------------------------------------- */

/* Variables 34 y 35 */
const CAT_AMBIENTES_VIVIENDA = [
  { valor: 'cocina', etiqueta: 'Cocina', sispro: '1' },
  { valor: 'dormitorio_adultos', etiqueta: 'Dormitorio de adultos', sispro: '2' },
  { valor: 'dormitorio_ninos', etiqueta: 'Dormitorio de niños', sispro: '3' },
  { valor: 'sala_comedor', etiqueta: 'Sala / Comedor', sispro: '4' },
  { valor: 'sanitario', etiqueta: 'Sanitario', sispro: '5' },
  { valor: 'lavado_ropas', etiqueta: 'Zona de lavado de ropas', sispro: '6' }
];

/* Variable 36 */
const CAT_ELEMENTOS_VIVIENDA = [
  { valor: 'lavamanos', etiqueta: 'Lavamanos', sispro: '1' },
  { valor: 'lavaplatos', etiqueta: 'Lavaplatos', sispro: '2' },
  { valor: 'lavadero', etiqueta: 'Lavadero de ropa', sispro: '3' }
];

/* Variable 37 */
const CAT_ALUMBRADO = [
  { valor: 'electrica', etiqueta: 'Luz eléctrica', sispro: '1' },
  { valor: 'combustible', etiqueta: 'Kerosén, petróleo, gasolina', sispro: '2' },
  { valor: 'velas', etiqueta: 'Velas', sispro: '3' },
  { valor: 'solar', etiqueta: 'Energía solar', sispro: '4' },
  { valor: 'planta', etiqueta: 'Planta de electricidad', sispro: '5' }
];

/* Variable 38 */
const CAT_ACCESO_VIVIENDA = [
  { valor: 'transporte', etiqueta: 'Medios de transporte (buses, autos, camiones, lanchas, etc.)', sispro: '1' },
  { valor: 'centros_sociales', etiqueta: 'Centros sociales, culturales y/o recreacionales', sispro: '2' },
  { valor: 'parques', etiqueta: 'Parques y áreas deportivas', sispro: '3' },
  { valor: 'cultos', etiqueta: 'Iglesias, templos, espacios para cultos religiosos', sispro: '4' },
  { valor: 'educativas', etiqueta: 'Instituciones educativas', sispro: '5' },
  { valor: 'salud', etiqueta: 'Servicios de salud', sispro: '6' },
  { valor: VALOR_NINGUNA, etiqueta: 'Ninguna', sispro: '7' }
];

/* Variable 44 */
const CAT_MEDIOS_TRANSPORTE = [
  { valor: 'particular', etiqueta: 'Vehículo particular', sispro: '1' },
  { valor: 'publico', etiqueta: 'Servicio público', sispro: '2' },
  { valor: 'motocicleta', etiqueta: 'Motocicleta', sispro: '3' },
  { valor: 'bicicleta', etiqueta: 'Bicicleta', sispro: '4' },
  { valor: 'caminando', etiqueta: 'Caminando', sispro: '5' },
  { valor: 'maquinaria', etiqueta: 'Maquinaria agrícola o camión', sispro: '6' },
  { valor: 'cable', etiqueta: 'Cable aéreo', sispro: '7' },
  { valor: 'fluvial', etiqueta: 'Canoa, lancha, chalupa, piragua', sispro: '8' },
  { valor: 'semovientes', etiqueta: 'Semovientes', sispro: '9' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '10' }
];

/* Variable 46 */
const CAT_SEGURIDAD_DESPLAZAMIENTO = [
  { valor: 'casco', etiqueta: 'Casco', sispro: '1' },
  { valor: 'cinturon', etiqueta: 'Cinturón de seguridad', sispro: '2' },
  { valor: 'retencion_infantil', etiqueta: 'Sistema de retención infantil', sispro: '3' },
  { valor: 'chaleco_reflectivo', etiqueta: 'Chaleco reflectivo', sispro: '4' },
  { valor: 'chaleco_salvavidas', etiqueta: 'Chaleco salvavidas', sispro: '5' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', excluyente: true, sispro: '6' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '7' }
];

/* Variable 48 */
const CAT_DESPLAZAMIENTO_30 = [
  { valor: 'infraestructura_vial', etiqueta: 'Estado de la infraestructura vial', sispro: '1' },
  { valor: 'congestion', etiqueta: 'Congestión vial', sispro: '2' },
  { valor: 'disponibilidad_transporte', etiqueta: 'Disponibilidad de medios de transporte', sispro: '3' },
  { valor: 'distancias', etiqueta: 'Distancias a recorrer', sispro: '4' },
  { valor: 'economica', etiqueta: 'Disponibilidad económica', sispro: '5' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '6' }
];

/* Variable 54 */
const CAT_HORAS_SUMINISTRO = [
  { valor: '24h', etiqueta: '24 horas', sispro: '1' },
  { valor: '12a23', etiqueta: 'De 12 a 23 horas', sispro: '2' },
  { valor: '4a12', etiqueta: 'Entre 4 y 12 horas', sispro: '3' },
  { valor: 'menos4', etiqueta: 'Menos de 4 horas', sispro: '4' },
  { valor: 'dias_sin', etiqueta: 'Se presentan días sin suministro', sispro: '5' }
];

/* Variable 55 */
const TANQUE_NO_TIENE = 'no_tiene';

const CAT_TANQUE_AGUA = [
  { valor: 'aereo', etiqueta: 'Aéreo', sispro: '1' },
  { valor: 'superficial', etiqueta: 'Superficial', sispro: '2' },
  { valor: 'subterraneo', etiqueta: 'Subterráneo', sispro: '3' },
  { valor: TANQUE_NO_TIENE, etiqueta: 'No tiene tanque de almacenamiento', sispro: '4' }
];

/* Variable 56 */
const CAT_FRECUENCIA_LIMPIEZA_TANQUE = [
  { valor: 'cada_uso', etiqueta: 'Después de cada uso', sispro: '1' },
  { valor: 'semestral', etiqueta: 'Semestral', sispro: '2' },
  { valor: 'no_lavado', etiqueta: 'No está lavado', sispro: '3' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', sispro: '4' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '5' }
];

/* Variable 57 */
const CAT_DISTANCIA_TANQUE = [
  { valor: 'mas10', etiqueta: 'Más de 10 metros', sispro: '1' },
  { valor: '5a9', etiqueta: 'Entre 5 y 9 metros', sispro: '2' },
  { valor: 'menos5', etiqueta: 'Menos de 5 metros', sispro: '3' }
];

/* Variable 60 */
const CAT_ALMACENAMIENTO_RESIDUOS = [
  { valor: 'con_tapa', etiqueta: 'Recipientes con tapa', sispro: '1' },
  { valor: 'sin_tapa', etiqueta: 'Recipientes sin tapa', sispro: '2' },
  { valor: 'suelo', etiqueta: 'Directamente al suelo', sispro: '3' },
  { valor: 'bolsas', etiqueta: 'Bolsas plásticas', sispro: '4' },
  { valor: 'otro', etiqueta: 'Otras', sispro: '5' }
];

/* Variable 65 */
const CAT_REDUCCION_RESIDUOS = [
  { valor: 'evita_desechables', etiqueta: 'Se evita el uso de productos de un solo uso como botellas, vajillas y cubiertos desechables, entre otros', sispro: '1' },
  { valor: 'reutiliza', etiqueta: 'Se reutilizan materiales que hayan cumplido su primer ciclo, como el papel y el cartón', sispro: '2' },
  { valor: 'electronicos', etiqueta: 'Eliminación o reutilización de aparatos eléctricos a través de empresas especializadas (computadores, cartuchos de impresora, entre otros)', sispro: '3' },
  { valor: 'evita_aerosoles', etiqueta: 'Se evita el uso de ambientadores artificiales o aerosoles', sispro: '4' },
  { valor: 'granel', etiqueta: 'Se compra a granel usando los propios envases o maletas para empacar', sispro: '5' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '6' }
];

/* Variable 69 */
const CAT_DISPOSICION_PELIGROSOS = [
  { valor: 'sitios_autorizados', etiqueta: 'Sitios autorizados para su recolección', sispro: '1' },
  { valor: 'centros_acopio', etiqueta: 'Centros de acopio', sispro: '2' },
  { valor: 'enterramiento', etiqueta: 'Enterramiento', sispro: '3' },
  { valor: 'quema', etiqueta: 'Quema a campo abierto', sispro: '4' },
  { valor: 'fuentes_agua', etiqueta: 'Disposición en fuentes de agua cercana', sispro: '5' },
  { valor: 'campo_abierto', etiqueta: 'Disposición a campo abierto', sispro: '6' },
  { valor: 'con_ordinarios', etiqueta: 'En conjunto con los residuos ordinarios de la vivienda', sispro: '7' },
  { valor: 'empresas', etiqueta: 'Recolectados por empresas especializadas', sispro: '8' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '9' }
];

/* Variable 72 */
const CAT_APROVECHAMIENTO_RURAL = [
  { valor: 'compostaje', etiqueta: 'Compostaje', sispro: '1' },
  { valor: 'lombricultivo', etiqueta: 'Lombricultivo', sispro: '2' },
  { valor: 'biocombustible', etiqueta: 'Biocombustible', sispro: '3' },
  { valor: 'biofertilizante', etiqueta: 'Biofertilizante', sispro: '4' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '5' }
];

/* Variable 74 */
const CAT_SEPARACION_RESIDUOS = [
  { valor: 'no_aprovechables', etiqueta: 'Separación de residuos no aprovechables (icopor, pañales, toallas higiénicas, cerámicas, papel carbón, entre otros)', sispro: '1' },
  { valor: 'organicos', etiqueta: 'Separación de residuos orgánicos (restos de alimentos, de poda y jardinería, de carpintería, entre otros)', sispro: '2' },
  { valor: 'aprovechables', etiqueta: 'Separación de residuos aprovechables (papel, cartón, vidrio, plástico, tetrapack, metal)', sispro: '3' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '4' }
];

/* Variable 76 */
const CAT_LIMPIEZA_SUPERFICIES = [
  { valor: 'polvo', etiqueta: 'Retiro de polvo', sispro: '1' },
  { valor: 'agua_jabon', etiqueta: 'Retiro de polvo y limpieza con agua y jabón', sispro: '2' },
  { valor: 'desinfeccion', etiqueta: 'Retiro de polvo, limpieza con agua y jabón y desinfección', sispro: '3' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '4' }
];

/* Variable 78 */
const CAT_ENERGIA_COCINAR = [
  { valor: 'electricidad', etiqueta: 'Electricidad', sispro: '1' },
  { valor: 'gas_natural', etiqueta: 'Gas natural', sispro: '2' },
  { valor: 'glp', etiqueta: 'Gas licuado del petróleo (gas propano)', sispro: '3' },
  { valor: 'lena', etiqueta: 'Leña, madera o carbón de leña', sispro: '4' },
  { valor: 'combustible', etiqueta: 'Petróleo, gasolina, kerosén, alcohol', sispro: '5' },
  { valor: 'carbon_mineral', etiqueta: 'Carbón mineral', sispro: '6' },
  { valor: 'desechos', etiqueta: 'Materiales de desecho', sispro: '7' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '8' }
];

/* Variable 80 */
const CAT_FUENTES_HUMO = [
  { valor: 'tabaco', etiqueta: 'Cigarrillo o tabaco', sispro: '1' },
  { valor: 'lena', etiqueta: 'Leña', sispro: '2' },
  { valor: 'carbon', etiqueta: 'Carbón', sispro: '3' },
  { valor: 'quema_basura', etiqueta: 'Quema de basura', sispro: '4' },
  { valor: 'vapeadores', etiqueta: 'Vapeadores', sispro: '5' },
  { valor: 'narguilas', etiqueta: 'Narguilas', sispro: '6' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '7' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '8' }
];

/* Variable 82 */
const CAT_PRACTICAS_CALIDAD_AIRE = [
  { valor: 'carbon_lena', etiqueta: 'Cocinar con carbón o leña', sispro: '1' },
  { valor: 'fumadores', etiqueta: 'Fumadores activos en la vivienda', sispro: '2' },
  { valor: 'vehiculo', etiqueta: 'Encender el vehículo dentro de la vivienda en un área sin buena ventilación', sispro: '3' },
  { valor: 'quema_basura', etiqueta: 'Quema de basura afuera de la vivienda', sispro: '4' },
  { valor: 'polvillo', etiqueta: 'Barrido de pisos con levantamiento de polvillo', sispro: '5' }
];

/* Variable 83 */
const CAT_TIPO_ESTUFA = [
  { valor: 'convencional_buena', etiqueta: 'Eléctrica, de gas, petróleo, gasolina, kerosén o alcohol con conexiones en buen estado, sin fugas, buena combustión y sin riesgo eléctrico', sispro: '1' },
  { valor: 'convencional_mala', etiqueta: 'Eléctrica, de gas, petróleo, gasolina, kerosén o alcohol con conexiones en mal estado, reparaciones defectuosas, mala combustión o riesgo eléctrico', sispro: '2' },
  { valor: 'lena_mejorada', etiqueta: 'De leña, madera o carbón mejorada: con chimenea y fuera de la vivienda, o dentro en buen estado y sin manchas', sispro: '3' },
  { valor: 'lena_interior', etiqueta: 'De leña, madera o carbón dentro de la vivienda, con manchas en el lugar donde está la estufa', sispro: '4' }
];

/* Variable 85 */
const CAT_VECTORES = [
  { valor: 'zancudos', etiqueta: 'Zancudos', sispro: '1' },
  { valor: 'cucarachas', etiqueta: 'Cucarachas', sispro: '2' },
  { valor: 'moscas', etiqueta: 'Moscas', sispro: '3' },
  { valor: 'mosquitos', etiqueta: 'Mosquitos', sispro: '4' },
  { valor: 'pulgas', etiqueta: 'Pulgas', sispro: '5' },
  { valor: 'piojos', etiqueta: 'Piojos', sispro: '6' },
  { valor: 'garrapatas', etiqueta: 'Garrapatas', sispro: '7' },
  { valor: 'roedores', etiqueta: 'Roedores', sispro: '8' },
  { valor: 'chinches', etiqueta: 'Chinches', sispro: '9' },
  { valor: 'triatominos', etiqueta: 'Triatominos (pito)', sispro: '10' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '11' }
];

/* Variable 87. Las dos primeras son también las únicas opciones de la
   variable 103, que el reporte deriva de ésta (ver anexo.js). */
const CAT_MEDIDAS_VECTORES = [
  { valor: 'residuos_higienicos', etiqueta: 'Manejo higiénico de los residuos sólidos', sispro: '1' },
  { valor: 'evita_luz_blanca', etiqueta: 'Evitar el uso de fuentes de luz blanca o brillante en ambientes oscuros', sispro: '2' },
  { valor: 'inservibles', etiqueta: 'Recolección de inservibles', sispro: '3' },
  { valor: 'toldillos', etiqueta: 'Uso de toldillos', sispro: '4' },
  { valor: 'angeos', etiqueta: 'Uso de angeos y trampas caseras', sispro: '5' },
  { valor: 'orden_higiene', etiqueta: 'Ordenamiento e higiene', sispro: '6' },
  { valor: 'malezas', etiqueta: 'Limpieza de malezas', sispro: '7' },
  { valor: 'drenaje', etiqueta: 'Drenaje de zonas encharcadas', sispro: '8' },
  { valor: 'proteccion_depositos', etiqueta: 'Protección de depósitos de agua de consumo mientras no estén en uso', sispro: '9' },
  { valor: 'retiro_recipientes', etiqueta: 'Retiro de recipientes que usualmente contienen o acumulan agua', sispro: '10' },
  { valor: 'reemplazo_techos', etiqueta: 'Reemplazo de techos en paja por techo de zinc', sispro: '11' },
  { valor: 'reparaciones', etiqueta: 'Reparaciones para eliminar sitios húmedos o poco iluminados', sispro: '12' },
  { valor: 'ropa_clara', etiqueta: 'Uso de pantalones y camisas manga larga de colores claros', sispro: '13' },
  { valor: 'otro', etiqueta: 'Otras', sispro: '14' }
];

/* Variable 89 */
const CAT_ANIMALES_PONZONOSOS = [
  { valor: 'aranas', etiqueta: 'Arañas', sispro: '1' },
  { valor: 'escorpiones', etiqueta: 'Escorpiones o alacranes', sispro: '2' },
  { valor: 'serpientes', etiqueta: 'Serpientes o víboras', sispro: '3' },
  { valor: 'abejas', etiqueta: 'Abejas', sispro: '4' },
  { valor: 'avispas', etiqueta: 'Avispas', sispro: '5' },
  { valor: 'orugas', etiqueta: 'Orugas', sispro: '6' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica', excluyente: true, sispro: '7' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '8' }
];

/* Variable 91 */
const CAT_MEDIDAS_PONZONOSOS = [
  { valor: 'sacudir_ropa', etiqueta: 'Sacudir la ropa y los zapatos antes de usarlos', sispro: '1' },
  { valor: 'huecos_arboles', etiqueta: 'No meter las manos en huecos de los árboles', sispro: '2' },
  { valor: 'guantes', etiqueta: 'Usar guantes de carnaza o tener precaución al levantar piedras o rocas', sispro: '3' },
  { valor: 'orden_peridomicilio', etiqueta: 'Orden e higiene en las viviendas y el peridomicilio', sispro: '4' },
  { valor: 'corte_monte', etiqueta: 'No caminar junto al corte del monte en los caminos de herradura', sispro: '5' },
  { valor: 'botas', etiqueta: 'No caminar descalzo en el campo, usar botas de caña alta', sispro: '6' },
  { valor: 'ninos_boscosas', etiqueta: 'Evitar que los niños y niñas jueguen en zonas boscosas', sispro: '7' },
  { valor: 'perros', etiqueta: 'Transitar si es posible en compañía de perros', sispro: '8' },
  { valor: 'noche', etiqueta: 'Evitar deambular de noche', sispro: '9' },
  { valor: 'panales', etiqueta: 'No molestar panales de abejas o avispas', sispro: '10' }
];

/* Variable 97 */
const CAT_FINALIDAD_TENENCIA = [
  { valor: 'compania', etiqueta: 'Compañía', sispro: '1' },
  { valor: 'produccion', etiqueta: 'Producción', sispro: '2' },
  { valor: 'autoconsumo', etiqueta: 'Autoconsumo', sispro: '3' },
  { valor: 'vigilancia', etiqueta: 'Vigilancia', sispro: '4' }
];

/* Variable 98 */
const CAT_CONFINAMIENTO_ANIMALES = [
  { valor: 'total', etiqueta: 'Totalmente confinados', sispro: '1' },
  { valor: 'parcial', etiqueta: 'Parcialmente confinados', sispro: '2' },
  { valor: 'libres', etiqueta: 'Libres', sispro: '3' }
];

/* Variable 104 */
const CAT_LUGAR_QUIMICOS = [
  { valor: 'tienda_barrio', etiqueta: 'Tiendas de barrio', sispro: '1' },
  { valor: 'almacen_cadena', etiqueta: 'Almacenes de cadena', sispro: '2' },
  { valor: 'especializado', etiqueta: 'Establecimientos específicos de venta de productos químicos', sispro: '3' },
  { valor: 'granel', etiqueta: 'Establecimientos de venta a granel', sispro: '4' }
];

/* Variable 105 */
const CAT_DISPOSICION_QUIMICOS = [
  { valor: 'separados', etiqueta: 'Se separan de los residuos ordinarios para posterior aprovechamiento', sispro: '1' },
  { valor: 'con_ordinarios', etiqueta: 'En conjunto con los residuos ordinarios de la vivienda', sispro: '2' },
  { valor: 'quema', etiqueta: 'Quema a campo abierto', sispro: '3' },
  { valor: 'fuentes_agua', etiqueta: 'Disposición en fuentes de agua cercana', sispro: '4' },
  { valor: 'campo_abierto', etiqueta: 'Disposición a campo abierto', sispro: '5' },
  { valor: 'enterramiento', etiqueta: 'Enterramiento', sispro: '6' },
  { valor: 'reutiliza_envases', etiqueta: 'Se utilizan para contener bebidas, alimentos y agua y para otros usos en el hogar', sispro: '7' },
  { valor: 'otro', etiqueta: 'Otros', sispro: '8' }
];

/* --- Registro tipo 2: familia --------------------------------------- */

/* Variable 113 — resultado del APGAR familiar */
const CAT_APGAR = [
  { valor: 'alta', etiqueta: '7 a 10 puntos. Alta funcionalidad', sispro: '1' },
  { valor: 'moderada', etiqueta: '4 a 6 puntos. Funcionalidad moderada', sispro: '2' },
  { valor: 'disfuncion', etiqueta: '0 a 3 puntos. Disfunción familiar', sispro: '3' }
];

/* Variable 120 */
const CAT_MEDIDAS_RESPIRATORIAS = [
  { valor: 'tapabocas', etiqueta: 'Uso de tapabocas', sispro: '1' },
  { valor: 'lavado_manos', etiqueta: 'Lavado frecuente de manos', sispro: '2' },
  { valor: 'cubrir_rostro', etiqueta: 'Cubrir el rostro al toser y estornudar', sispro: '3' },
  { valor: VALOR_NINGUNO, etiqueta: 'Ninguno', sispro: '4' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '5' }
];

/* --- Registro tipo 3: integrante ------------------------------------ */

/* Variable 47 */
const CAT_URGENCIAS_HOGAR = [
  { valor: 'cortopunzantes', etiqueta: 'Heridas por objetos cortopunzantes', sispro: '1' },
  { valor: 'intoxicacion', etiqueta: 'Intoxicación', sispro: '2' },
  { valor: 'quemadura', etiqueta: 'Quemadura', sispro: '3' },
  { valor: 'electrocucion', etiqueta: 'Electrocución', sispro: '4' },
  { valor: 'asfixia', etiqueta: 'Asfixia respiratoria', sispro: '5' },
  { valor: 'golpes', etiqueta: 'Golpes y atrapamientos', sispro: '6' },
  { valor: 'caida', etiqueta: 'Caída', sispro: '7' },
  { valor: 'ahogamiento', etiqueta: 'Ahogamientos o sumersiones', sispro: '8' },
  { valor: 'agresion_animal', etiqueta: 'Agresión animal', sispro: '9' },
  { valor: 'caida_alturas', etiqueta: 'Caída de alturas', sispro: '10' },
  { valor: VALOR_NO_APLICA, etiqueta: 'No aplica (no acudió a urgencias por un accidente en el hogar)', excluyente: true, sispro: '11' }
];

/* Variable 48 */
const CAT_ENFERMEDADES_ULTIMO_MES = [
  { valor: 'diarrea', etiqueta: 'Diarrea o soltura de estómago', sispro: '1' },
  { valor: 'resfriado', etiqueta: 'Tos, congestión y presencia de resfriado', sispro: '2' },
  { valor: 'infeccion_pulmonar', etiqueta: 'Infección pulmonar', sispro: '3' },
  { valor: 'intoxicacion', etiqueta: 'Intoxicación por sustancias químicas', sispro: '4' },
  { valor: 'piel_alergias', etiqueta: 'Problemas de piel / alergias', sispro: '5' },
  { valor: 'accidente_hogar', etiqueta: 'Accidente en el hogar', sispro: '6' },
  { valor: 'explosivos', etiqueta: 'Lesiones por artefactos explosivos', sispro: '7' },
  { valor: 'siniestro_vial', etiqueta: 'Siniestro vial', sispro: '8' },
  { valor: 'cancer', etiqueta: 'Cáncer', sispro: '9' },
  { valor: 'hta', etiqueta: 'Hipertensión arterial (HTA)', sispro: '10' },
  { valor: 'diabetes', etiqueta: 'Diabetes', sispro: '11' },
  { valor: 'obesidad', etiqueta: 'Obesidad', sispro: '12' },
  { valor: 'renal', etiqueta: 'Enfermedad renal crónica', sispro: '13' },
  { valor: 'epoc', etiqueta: 'EPOC', sispro: '14' },
  { valor: 'asma', etiqueta: 'Asma', sispro: '15' },
  { valor: 'huerfanas', etiqueta: 'Enfermedades huérfanas', sispro: '16' },
  { valor: 'bucales', etiqueta: 'Enfermedades bucales (caries, enfermedad periodontal)', sispro: '17' },
  { valor: 'visuales_auditivas', etiqueta: 'Enfermedades visuales y auditivas', sispro: '18' },
  { valor: 'otro', etiqueta: 'Otra', sispro: '19' }
];

/* Variable 50 */
const CAT_ACCION_AFECCION = [
  { valor: 'no_acudio', etiqueta: 'No acudió a ningún servicio de salud', sispro: '1' },
  { valor: 'eps_atendido', etiqueta: 'Solicitó atención a través de la EPS y lo atendieron', sispro: '2' },
  { valor: 'eps_no_atendido', etiqueta: 'Solicitó atención a través de la EPS y no lo atendieron', sispro: '3' },
  { valor: 'particular', etiqueta: 'Acudió a un servicio de salud particular pagado por usted mismo', sispro: '4' },
  { valor: 'alternativa', etiqueta: 'Acudió a algún tipo de atención alternativa', sispro: '5' },
  { valor: 'farmacia', etiqueta: 'Acudió a la farmacia', sispro: '6' },
  { valor: 'curandero', etiqueta: 'Acudió a un curandero', sispro: '7' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '8' }
];

/* Variable 64 */
const TABACO_NO_APLICA = 'no_aplica';

const CAT_CONSUMO_TABACO = [
  { valor: 'activo', etiqueta: 'Fumador activo', sispro: '1' },
  { valor: 'exfumador', etiqueta: 'Exfumador', sispro: '2' },
  { valor: TABACO_NO_APLICA, etiqueta: 'No aplica (nunca ha fumado)', sispro: '3' }
];

/* Variable 78 del registro tipo 3 */
const CAT_RIESGO_GESTACIONAL = [
  { valor: 'alto', etiqueta: 'Alto riesgo', sispro: '1' },
  { valor: 'bajo', etiqueta: 'Bajo riesgo', sispro: '2' },
  { valor: 'no_evaluado', etiqueta: 'Riesgo no evaluado', sispro: '3' }
];

/* Variable 79 del registro tipo 3 */
const CAT_RIESGO_PREECLAMPSIA = [
  { valor: 'alto', etiqueta: 'Alto riesgo', sispro: '1' },
  { valor: 'bajo', etiqueta: 'Bajo riesgo', sispro: '2' }
];

/* Variable 91 del registro tipo 3 */
const CAT_METODO_ANTICONCEPTIVO_POSTPARTO = [
  { valor: 'preservativo', etiqueta: 'Barrera - Preservativo', sispro: '1' },
  { valor: 'hormonal_mensual_combinado', etiqueta: 'Hormonal mensual combinado', sispro: '2' },
  { valor: 'hormonal_mensual_progestageno', etiqueta: 'Hormonal mensual sólo progestágeno', sispro: '3' },
  { valor: 'hormonal_trimestral', etiqueta: 'Hormonal trimestral', sispro: '4' },
  { valor: 'implante', etiqueta: 'Implante subdérmico', sispro: '5' },
  { valor: 'dispositivo_hormonal', etiqueta: 'Dispositivo de liberación hormonal', sispro: '6' },
  { valor: 'diu', etiqueta: 'Dispositivo intrauterino', sispro: '7' },
  { valor: 'no_ofertado', etiqueta: 'Ninguno - no fue ofertado', sispro: '8' },
  { valor: 'no_elegible', etiqueta: 'Ninguno - no cumple con criterios de elegibilidad', sispro: '9' },
  { valor: 'decision_persona', etiqueta: 'Ninguno - decisión de la persona', sispro: '10' },
  { valor: 'otro', etiqueta: 'Otro', sispro: '11' }
];

/* Variable 105 del registro tipo 3 */
const CAT_ACTIVIDADES_ASBESTO = [
  'Trabajadores de astilleros (construcción, reparación o desguace de embarcaciones)',
  'Trabajadores en almacenes que almacenan materiales de construcción',
  'Representantes de ventas que trabajan con materiales que contienen asbesto',
  'Fabricantes de materiales de fricción (frenos, embragues)',
  'Fabricantes de materiales de fibrocemento (uralita)',
  'Fabricantes de productos textiles que contienen asbesto',
  'Reparadores de material de fricción (frenos, embragues)',
  'Agricultura (reparación o mantenimiento de vehículos o maquinaria)',
  'Trabajadores de aislamiento o revestimientos aislantes',
  'Albañiles (instalación de techos o cubiertas de fibrocemento — placas o tejas)',
  'Artistas gráficos',
  'Artesanos y actividades manuales y técnicas',
  'Bomberos',
  'Carpinteros, encofradores, ensambladores o ebanistas',
  'Conductores que realizan mantenimiento de vehículos',
  'Electricistas',
  'Trabajadores de la producción o mantenimiento de vagones de tren o metro',
  'Trabajadores de la producción o reparación de estufas',
  'Trabajadores de la producción de pintura',
  'Fontaneros o inspectores de tuberías',
  'Fundiciones',
  'Trabajadores de la industria alimentaria y de bebidas (reparación o mantenimiento)',
  'Trabajadores de cerámica (reparación o mantenimiento)',
  'Trabajadores de la industria del plástico o del caucho (reparación o mantenimiento)',
  'Trabajadores de la industria del vidrio',
  'Instaladores de cocinas',
  'Joyeros',
  'Deshollinadores',
  'Trabajadores de la rehabilitación, reparación o mantenimiento de edificios industriales',
  'Trabajadores de la rehabilitación, reparación o mantenimiento de materiales de fibrocemento (uralita)',
  'Mecánicos de automóviles',
  'Mecánicos de ascensores',
  'Mecánicos en la industria',
  'Trabajadores en minas de asbesto',
  'Estibadores',
  'Pintores de edificios',
  'Reparadores de maquinaria industrial',
  'Trabajadores en la reparación o mantenimiento de redes municipales de distribución de agua',
  'Reparadores de motores eléctricos',
  'Reparadores y pintores de carrocerías',
  'Trabajadores de salas de calderas',
  'Trabajadores en servicios de centrales de gas, nucleares y eléctricas',
  'Servicio militar y fuerzas armadas (reparación o mantenimiento)',
  'Soldadores (también fabricantes de latón y estaño)',
  'Traperos',
  'Techadores (instalación o reparación de techos o fachadas)',
  'Técnicos de ventilación e instaladores de aire acondicionado',
  'Trabajadores textiles (ropa resistente al calor)'
].map(function (etiqueta, i) {
  return { valor: 'a' + (i + 1), etiqueta: etiqueta, sispro: String(i + 1) };
});

/* Variable 107 del registro tipo 3 */
const CAT_MATERIALES_ASBESTO_TRABAJO = [
  { valor: 'fibrocemento', etiqueta: 'Fibrocemento (placas, tejas, tuberías, tanques, bajantes)', sispro: '1' },
  { valor: 'friccion', etiqueta: 'Materiales de fricción (frenos, embragues, fricción industrial)', sispro: '2' },
  { valor: 'aislantes', etiqueta: 'Aislantes térmicos o industriales (mantas, juntas, textiles resistentes al calor, calderas)', sispro: '3' }
];

/* Variable 108 del registro tipo 3 */
const CAT_MODALIDAD_EMPLEO = [
  { valor: 'formal', etiqueta: 'Formal', sispro: '1' },
  { valor: 'informal', etiqueta: 'Informal', sispro: '2' }
];

/* Variable 110 del registro tipo 3 */
const CAT_ELEMENTOS_ASBESTO_HOGAR = [
  { valor: 'estufa_placa', etiqueta: 'Estufas de placa térmica', sispro: '1' },
  { valor: 'estufa_resistencia', etiqueta: 'Estufas de resistencia eléctrica', sispro: '2' },
  { valor: 'cocina_resistencia', etiqueta: 'Cocinas con resistencias eléctricas', sispro: '3' },
  { valor: 'calentador_electrico', etiqueta: 'Calentadores eléctricos', sispro: '4' },
  { valor: 'calentador_gas', etiqueta: 'Calentadores de gas butano', sispro: '5' },
  { valor: 'fundas_planchar', etiqueta: 'Fundas para tablas de planchar', sispro: '6' },
  { valor: 'secadores', etiqueta: 'Secadores de pelo, pies y manos', sispro: '7' },
  { valor: 'tostadoras', etiqueta: 'Tostadoras', sispro: '8' },
  { valor: 'guantes_horno', etiqueta: 'Guantes de horno resistentes al calor', sispro: '9' },
  { valor: 'proteccion_formica', etiqueta: 'Protección térmica para muebles de fórmica debajo de hornos', sispro: '10' }
];

/* Variable 111 del registro tipo 3 */
const CAT_ESTADO_MATERIALES = [
  { valor: 'bueno', etiqueta: 'Bueno', sispro: '1' },
  { valor: 'malo', etiqueta: 'Malo', sispro: '2' }
];

/* Variable 115 del registro tipo 3 (respuesta única en el anexo) */
const CAT_ACTIVIDADES_ASBESTO_CERCA = [
  { valor: 'astilleros', etiqueta: 'Astilleros (construcción, reparación o desguace de embarcaciones)', sispro: '1' },
  { valor: 'almacenes', etiqueta: 'Almacenes de materiales de construcción', sispro: '2' },
  { valor: 'ventas', etiqueta: 'Venta de materiales que contienen asbesto (frenos, embragues, hilo, cuerda, cordón, tela, juntas, cartón, etc.)', sispro: '3' },
  { valor: 'fabrica_friccion', etiqueta: 'Fabricación de materiales de fricción (frenos, embragues)', sispro: '4' },
  { valor: 'fabrica_fibrocemento', etiqueta: 'Fabricación de materiales de fibrocemento (uralita)', sispro: '5' },
  { valor: 'fabrica_textiles', etiqueta: 'Fabricación de productos textiles con asbesto (hilos, cuerdas, cordones, telas, juntas, cartón)', sispro: '6' },
  { valor: 'reparacion_friccion', etiqueta: 'Reparación de material de fricción (frenos, embragues)', sispro: '7' }
];
