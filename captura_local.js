/* =========================================================================
   Encuesta_APS — La ficha en curso, en el dispositivo
   -------------------------------------------------------------------------
   Dos cosas que la captura sin señal necesita y que no existían:

   1. CÓDIGO DE LA FICHA (ítem 15, RN-015)
      La regla dice que el código lo genera el sistema y que, sin conexión,
      lleva un prefijo de dispositivo que garantiza que no se repita al
      sincronizar. El campo era texto libre («Ej. CF001»): dos equipos podían
      escribir el mismo código, y el servidor, que reconoce la ficha por su
      código, tomaba la segunda por una corrección de la primera. Tampoco
      había con qué reconocer un reenvío: si la señal se caía justo después de
      que el servidor guardara, la ficha quedaba pendiente y al sincronizarla
      no había forma de saber que ya estaba.

      Ahora se genera al empezar cada ficha:

          76001-EBS12-K7Q3-0042-20260924
          municipio · equipo · dispositivo · consecutivo · fecha de captura

      El dispositivo es un identificador al azar que se crea una vez y se
      guarda en el navegador; el consecutivo cuenta las fichas guardadas en
      ese dispositivo. Con el mismo código en cada reenvío, el servidor
      reemplaza la ficha en vez de duplicarla.

   2. BORRADOR AUTOMÁTICO
      Lo diligenciado antes de pulsar «Guardar» sólo existía en pantalla. Si
      Android cerraba la pestaña en segundo plano, se agotaba la batería o se
      recargaba la página, se perdía la visita entera. Ahora la ficha en curso
      se guarda en el dispositivo poco después de cada cambio, y al abrir la
      aplicación se recupera.

      Hay un solo borrador por usuario: el de la ficha que está en el
      formulario. Se borra al guardarla, al limpiar el formulario o al
      descartarlo. Guarda también si la ficha era una corrección, para
      reabrirla como corrección y no como una visita nueva.
   ========================================================================= */

'use strict';

/* =========================================================
   0. ALMACENAMIENTO
   ========================================================= */

/* El navegador puede negar el almacenamiento (modo privado, cuota llena): se
   devuelve null o false en vez de dejar que la excepción tumbe el formulario. */
function leerLocal(clave) {
  try { return localStorage.getItem(clave); } catch (error) { return null; }
}

function escribirLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch (error) {
    console.warn('No fue posible escribir ' + clave + ' en el dispositivo:', error);
    return false;
  }
}

function borrarLocal(clave) {
  try { localStorage.removeItem(clave); } catch (error) { /* sin almacenamiento */ }
}

/* =========================================================
   1. CÓDIGO DE LA FICHA (ítem 15, RN-015)
   ========================================================= */

const CLAVE_DISPOSITIVO = 'aps_dispositivo';
const CLAVE_CONSECUTIVO_FICHA = 'aps_consecutivo_ficha';

/* Sin 0/O ni 1/I/L: el código se dicta y se coteja contra el papel. */
const ALFABETO_DISPOSITIVO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LARGO_DISPOSITIVO = 4;
const EQUIPO_SIN_ASIGNAR = 'SINEQ';

/* Código generado al empezar la ficha que está en el formulario, con sus
   partes, mientras no se haya guardado. */
let codigoEnCurso = null;

function identificadorDeDispositivo() {
  const guardado = leerLocal(CLAVE_DISPOSITIVO);
  if (guardado && new RegExp('^[' + ALFABETO_DISPOSITIVO + ']{' + LARGO_DISPOSITIVO + '}$').test(guardado)) {
    return guardado;
  }

  const azar = new Uint8Array(LARGO_DISPOSITIVO);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(azar);
  } else {
    for (let i = 0; i < azar.length; i++) azar[i] = Math.floor(Math.random() * 256);
  }

  const nuevo = Array.prototype.map.call(azar, function (byte) {
    return ALFABETO_DISPOSITIVO[byte % ALFABETO_DISPOSITIVO.length];
  }).join('');

  escribirLocal(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

function ultimoConsecutivoDeFicha() {
  const numero = parseInt(leerLocal(CLAVE_CONSECUTIVO_FICHA), 10);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

/* AAAAMMDD en la hora local del dispositivo: es la fecha de la visita. */
function fechaCompacta(fecha) {
  return String(fecha.getFullYear()) +
    String(fecha.getMonth() + 1).padStart(2, '0') +
    String(fecha.getDate()).padStart(2, '0');
}

function componerCodigoFicha(consecutivo, fecha) {
  const municipio = document.getElementById('municipio');
  const equipo = document.getElementById('equipoSaludId');

  const codigoMunicipio = (municipio && municipio.value) || CAT_MUNICIPIO.codigo;
  const codigoEquipo = String((equipo && equipo.value) || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || EQUIPO_SIN_ASIGNAR;

  return [
    codigoMunicipio,
    codigoEquipo,
    identificadorDeDispositivo(),
    String(consecutivo).padStart(4, '0'),
    fecha
  ].join('-');
}

/** Asigna el código de una ficha nueva. Se llama al dejar el formulario en blanco. */
function asignarCodigoFicha() {
  const campo = document.getElementById('codigoFicha');
  if (!campo) return;

  const consecutivo = ultimoConsecutivoDeFicha() + 1;
  const fecha = fechaCompacta(new Date());
  const codigo = componerCodigoFicha(consecutivo, fecha);

  codigoEnCurso = { codigo: codigo, consecutivo: consecutivo, fecha: fecha };
  campo.value = codigo;
}

/**
 * El equipo lo escribe la sesión al reiniciar el formulario, y puede llegar
 * después —la sesión se confirma con el servidor al abrir— o escribirlo a
 * mano un administrador. Mientras la ficha conserve el código que se le
 * generó, el código sigue al equipo. Uno recuperado de un borrador o de una
 * corrección no se toca: ya es el código de esa ficha.
 */
function actualizarCodigoPorEquipo() {
  const campo = document.getElementById('codigoFicha');
  if (!campo || !codigoEnCurso || campo.value !== codigoEnCurso.codigo) return;

  const codigo = componerCodigoFicha(codigoEnCurso.consecutivo, codigoEnCurso.fecha);
  codigoEnCurso.codigo = codigo;
  campo.value = codigo;
}

/**
 * Tras guardar una ficha nueva en el dispositivo, su consecutivo queda
 * usado. Se lee del propio código porque la ficha puede venir de un borrador
 * empezado antes de guardar otras.
 */
function confirmarCodigoFicha(codigo) {
  const partes = String(codigo || '').split('-');
  if (partes.length !== 5 || partes[2] !== identificadorDeDispositivo()) return;

  const consecutivo = parseInt(partes[3], 10);
  if (Number.isFinite(consecutivo) && consecutivo > ultimoConsecutivoDeFicha()) {
    escribirLocal(CLAVE_CONSECUTIVO_FICHA, String(consecutivo));
  }
  codigoEnCurso = null;
}

/**
 * El campo es de sólo lectura, y la carga de una corrección no escribe en
 * controles de sólo lectura (los trata como calculados). Sin reponerlo, la
 * ficha corregida se guardaba con un código nuevo: una segunda ficha en vez
 * de reemplazar la que se corregía.
 */
function reponerCodigoFicha(encuesta) {
  const campo = document.getElementById('codigoFicha');
  if (campo && encuesta && encuesta.codigoFicha) campo.value = String(encuesta.codigoFicha);
}

/* =========================================================
   2. BORRADOR AUTOMÁTICO
   ========================================================= */

const PREFIJO_BORRADOR = 'aps_borrador_';
const VERSION_BORRADOR = 1;

/* Pausa tras el último cambio antes de escribir: guardar en cada tecla
   serializaría la ficha entera decenas de veces por segundo en una tablet. */
const ESPERA_BORRADOR_MS = 1200;

let temporizadorBorrador = null;

/* Contenido del formulario recién reiniciado o recién cargado. Mientras lo
   que hay en pantalla sea igual, no hay nada que guardar: así el borrador no
   nace de los valores que ponen solos la sesión, los catálogos o una carga. */
let contenidoDeReferencia = null;

let avisoSinEspacioMostrado = false;

/* Campos que se escriben solos y no dicen que el encuestador haya empezado
   una ficha: la firma de la sesión (que puede llegar tarde), el código y el
   consentimiento, que por sí solo no es una ficha empezada. */
const CAMPOS_FUERA_DEL_BORRADOR = ['equipoSaludId', 'responsableTipoId', 'responsableNumeroId',
  'responsableNombre', 'perfilProfesional', 'perfilProfesionalOtro', 'codigoFicha',
  'consentimiento', 'yaRegistradaEnLaBase'];

function claveBorrador() {
  const usuario = typeof SESION !== 'undefined' && SESION.usuario ? SESION.usuario() : null;
  return PREFIJO_BORRADOR + (usuario && usuario.id ? usuario.id : 'local');
}

function contenidoComparable(datos) {
  const copia = Object.assign({}, datos);
  CAMPOS_FUERA_DEL_BORRADOR.forEach(function (clave) { delete copia[clave]; });
  return JSON.stringify(copia);
}

function formularioDeCaptura() {
  return document.getElementById('encuestaForm');
}

/** Lo que hay ahora en el formulario pasa a ser «sin cambios». */
function marcarFormularioLimpio() {
  clearTimeout(temporizadorBorrador);
  const formulario = formularioDeCaptura();
  if (!formulario) return;
  contenidoDeReferencia = contenidoComparable(recolectarDatosFormulario(formulario));
}

function leerBorrador() {
  const crudo = leerLocal(claveBorrador());
  if (!crudo) return null;
  try {
    const borrador = JSON.parse(crudo);
    return borrador && borrador.version === VERSION_BORRADOR && borrador.datos ? borrador : null;
  } catch (error) {
    console.warn('El borrador guardado no se pudo leer y se descarta:', error);
    borrarLocal(claveBorrador());
    return null;
  }
}

function descartarBorrador() {
  clearTimeout(temporizadorBorrador);
  borrarLocal(claveBorrador());
  ocultarAvisoBorrador();
}

function programarBorrador() {
  clearTimeout(temporizadorBorrador);
  temporizadorBorrador = setTimeout(guardarBorradorAhora, ESPERA_BORRADOR_MS);
}

function guardarBorradorAhora() {
  clearTimeout(temporizadorBorrador);
  const formulario = formularioDeCaptura();
  if (!formulario || contenidoDeReferencia === null) return;

  const datos = recolectarDatosFormulario(formulario);

  /* Sin autorización no hay captura (RN-001): nada que conservar. */
  if (datos.consentimiento === 'no') return;
  if (contenidoComparable(datos) === contenidoDeReferencia) return;

  const borrador = {
    version: VERSION_BORRADOR,
    guardadoEn: new Date().toISOString(),
    codigoFicha: datos.codigoFicha || null,
    correccion: encuestaEnCorreccion
      ? { id: encuestaEnCorreccion, desdeServidor: correccionDesdeServidor || null }
      : null,
    datos: datos
  };

  if (!escribirLocal(claveBorrador(), JSON.stringify(borrador)) && !avisoSinEspacioMostrado) {
    avisoSinEspacioMostrado = true;
    mostrarNotificacion(
      'No hay espacio en el dispositivo para guardar la ficha en curso. ' +
      'Sincronice las fichas pendientes para liberar espacio; hasta entonces, no cierre la aplicación.',
      'warning');
  }
}

/* --- 2.1 Recuperación ---------------------------------------------------- */

/**
 * Vuelve a poner el borrador en el formulario. Si era una corrección, se
 * reabre como corrección: al guardar reemplaza la ficha, no crea otra.
 */
function restaurarBorrador(borrador) {
  const datos = borrador.datos;

  cambiarVista('nueva');
  cargarEncuestaEnFormulario(datos);

  /* La carga de una ficha da por autorizada la que no trae consentimiento, y
     todas las guardadas lo traen. Un borrador puede no traerlo todavía, y
     marcar «SÍ» por el encuestado no es algo que el sistema pueda hacer. */
  if (!datos.consentimiento) {
    document.querySelectorAll('input[name="consentimiento"]').forEach(function (radio) {
      radio.checked = false;
    });
    aplicarBloqueoPorConsentimiento();
  }

  reponerCodigoFicha(borrador);

  if (borrador.correccion && borrador.correccion.id) {
    encuestaEnCorreccion = borrador.correccion.id;
    correccionDesdeServidor = borrador.correccion.desdeServidor || null;
    mostrarAvisoDeCorreccion(datos);
  }

  mostrarAvisoBorrador(borrador);
}

function restaurarBorradorSiHay() {
  const borrador = leerBorrador();
  if (!borrador) return;

  /* El aviso sobre el formulario ya lo dice; un diálogo encima exigiría un
     toque más sin pedir ninguna decisión. */
  try {
    restaurarBorrador(borrador);
  } catch (error) {
    /* Un borrador que ya no encaja en el formulario (por ejemplo, tras una
       actualización) no debe impedir usar la aplicación. Se conserva por si
       se puede recuperar a mano, y se avisa. */
    console.error('No fue posible recuperar el borrador:', error);
    mostrarNotificacion('No fue posible recuperar la ficha sin terminar.', 'error');
  }
}

/**
 * Corregir otra ficha reemplaza lo que hay en el formulario. Si lo que hay es
 * una ficha sin terminar, se pregunta antes.
 * @returns {boolean} true si se puede seguir con la corrección.
 */
function confirmarAntesDeReemplazarBorrador(idCorreccion, continuar) {
  const borrador = leerBorrador();
  if (!borrador) return true;

  if (borrador.correccion && borrador.correccion.id === idCorreccion) {
    /* Es la misma corrección, con cambios sin guardar: se retoma ésa. */
    restaurarBorrador(borrador);
    return false;
  }

  pedirConfirmacion({
    titulo: 'Ficha sin terminar',
    mensaje: 'La ficha ' + (borrador.codigoFicha || 'en curso') + ' no se ha guardado. ' +
      'Si abre otra para corregirla, la ficha sin terminar se descartará.',
    textoConfirmar: 'Descartar y corregir',
    alConfirmar: function () {
      descartarBorrador();
      continuar();
    }
  });
  return false;
}

/* --- 2.2 Aviso en el formulario ----------------------------------------- */

function formatearMomentoBorrador(iso) {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  const dia = fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  const hora = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return 'el ' + dia + ' a las ' + hora;
}

function mostrarAvisoBorrador(borrador) {
  let aviso = document.getElementById('avisoBorrador');

  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'avisoBorrador';
    aviso.className = 'aviso-borrador';
    aviso.setAttribute('role', 'status');

    const icono = document.createElement('i');
    icono.className = 'ph ph-clock-counter-clockwise aviso-borrador__icono';
    icono.setAttribute('aria-hidden', 'true');

    const texto = document.createElement('span');
    texto.id = 'avisoBorradorTexto';
    texto.className = 'aviso-borrador__texto';

    const descartar = document.createElement('button');
    descartar.type = 'button';
    descartar.className = 'btn btn--ghost';
    descartar.textContent = 'Descartar esta ficha';
    descartar.addEventListener('click', pedirDescartarFichaEnCurso);

    aviso.appendChild(icono);
    aviso.appendChild(texto);
    aviso.appendChild(descartar);

    const formulario = formularioDeCaptura();
    formulario.parentNode.insertBefore(aviso, formulario);
  }

  const momento = formatearMomentoBorrador(borrador.guardadoEn);
  document.getElementById('avisoBorradorTexto').textContent =
    'Ficha sin terminar recuperada' + (borrador.codigoFicha ? ' (' + borrador.codigoFicha + ')' : '') +
    (momento ? ', guardada automáticamente ' + momento : '') +
    '. Continúe donde la dejó o descártela para empezar una nueva.';
  aviso.hidden = false;
}

function ocultarAvisoBorrador() {
  const aviso = document.getElementById('avisoBorrador');
  if (aviso) aviso.hidden = true;
}

/* --- 2.3 Descartar o limpiar ------------------------------------------- */

function reiniciarFichaEnCurso() {
  if (encuestaEnCorreccion) salirDeCorreccion();
  formularioDeCaptura().reset();
  reiniciarEstadoFormulario();
  descartarBorrador();
}

function pedirDescartarFichaEnCurso() {
  pedirConfirmacion({
    titulo: 'Descartar la ficha',
    mensaje: 'Se borrarán todas las respuestas de esta ficha y no se podrán recuperar.',
    textoConfirmar: 'Descartar',
    alConfirmar: reiniciarFichaEnCurso
  });
}

/* --- 2.4 Arranque -------------------------------------------------------- */

function inicializarCapturaLocal() {
  const formulario = formularioDeCaptura();
  if (!formulario) return;

  formulario.addEventListener('input', programarBorrador);
  formulario.addEventListener('change', programarBorrador);

  /* Agregar o quitar una familia, un integrante o una fila de plan no dispara
     input ni change. */
  formulario.addEventListener('click', function (evento) {
    if (evento.target.closest('[data-accion], .btn--bloque, #btnAgregarComplemento, .complemento-quitar')) {
      programarBorrador();
    }
  });

  const equipo = document.getElementById('equipoSaludId');
  if (equipo) {
    equipo.addEventListener('input', actualizarCodigoPorEquipo);
    equipo.addEventListener('change', actualizarCodigoPorEquipo);
  }

  /* Al pasar a segundo plano Android puede cerrar la pestaña sin aviso: se
     escribe ya, sin esperar la pausa. */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') guardarBorradorAhora();
  });
  window.addEventListener('pagehide', guardarBorradorAhora);

  restaurarBorradorSiHay();
}
