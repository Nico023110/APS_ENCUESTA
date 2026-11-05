/* =========================================================================
   Encuesta_APS — Buscador de ocupaciones CIUO (ítem 73, RN-073)
   -------------------------------------------------------------------------
   POR QUÉ NO ES UN <datalist>

   El campo usaba la lista nativa del navegador, y cada navegador la filtra a
   su manera: Chrome exige el texto tal cual, con tildes y en el mismo género
   —«mecanico», «enfermera» o «secretaria» no encontraban nada—, y otros sólo
   buscan por código. Las pocas palabras cotidianas que sí coincidían («hogar»,
   «ama de casa», «estudiante», «desempleado») llevaban a la misma opción, y un
   campo con 9998 sólo ofrecía 9998. A quien diligenciaba le parecía que no
   había otro código posible (reporte de usuario, 2026-11-05).

   Aquí la búsqueda es la misma en todos los equipos y sin señal: sin tildes,
   sin importar género ni plural, por partes de palabra y en cualquier orden.
   El campo sigue guardando sólo el código; el catálogo y lo que se reporta no
   cambian.
   ========================================================================= */

const MAXIMO_OCUPACIONES_EN_LISTA = 30;

const PALABRAS_VACIAS_OCUPACION = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'en', 'por', 'para', 'con'];

/* Cómo se dice en la visita lo que la tabla oficial nombra de otra forma. Sólo
   ayudan a encontrar: lo que se muestra y se guarda es lo de la tabla. */
const PALABRAS_COTIDIANAS_OCUPACION = [
  [['9998'], 'pensionado'],
  [['9622'], 'oficios varios'],
  [['9111'], 'empleada domestica servicio domestico'],
  [['9112'], 'aseo limpieza'],
  [['8324'], 'taxista'],
  [['8321'], 'mototaxista motociclista'],
  [['8323', '8331', '8332'], 'chofer'],
  [['9621'], 'domiciliario'],
  [['5414'], 'vigilante celador vigilancia'],
  [['9611'], 'reciclador'],
  [['7126'], 'plomero'],
  [['5141'], 'estilista barbero'],
  [['5142'], 'manicurista estilista'],
  [['5311'], 'ninera'],
  [['2261'], 'dentista'],
  [['4321'], 'bodeguero almacenista'],
  [['3221'], 'auxiliar de enfermeria'],
  [['0310'], 'soldado'],
  [['6111', '6112', '6113', '6114'], 'campesino'],
  [['2310', '2320', '2330', '2341', '2342', '2352', '2353', '2354', '2355'], 'docente maestro']
];

function normalizarOcupacion(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function palabrasDeOcupacion(texto) {
  return normalizarOcupacion(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/* «enfermera» debe encontrar «enfermería» y «secretaria», «secretarios»: se
   busca por la raíz, sin la terminación de género o plural. Lo corto se deja
   como está: mientras se escribe, «cas» todavía no es una palabra. */
function raizDeOcupacion(palabra) {
  return palabra.length > 4 ? palabra.replace(/(as|os|es|a|o|e|s)$/, '') : palabra;
}

let indiceDeOcupaciones = null;

function obtenerIndiceDeOcupaciones() {
  if (indiceDeOcupaciones) return indiceDeOcupaciones;
  indiceDeOcupaciones = CAT_OCUPACION_CIUO.map(function (ocupacion) {
    const cotidianas = PALABRAS_COTIDIANAS_OCUPACION
      .filter(function (par) { return par[0].indexOf(ocupacion.valor) !== -1; })
      .map(function (par) { return par[1]; })
      .join(' ');
    return {
      valor: ocupacion.valor,
      etiqueta: ocupacion.etiqueta,
      palabras: palabrasDeOcupacion(ocupacion.etiqueta + ' ' + cotidianas),
      largo: ocupacion.etiqueta.length
    };
  });
  return indiceDeOcupaciones;
}

/**
 * Busca por código (desde su inicio) o por palabras del nombre.
 * @returns {{filas:Array<{valor:string,etiqueta:string}>, total:number, parcial:boolean}}
 *          `parcial`: ninguna coincide con todo lo escrito; son las que más se acercan.
 */
function buscarOcupaciones(texto) {
  const indice = obtenerIndiceDeOcupaciones();
  const limpio = String(texto || '').trim();
  const vacio = { filas: [], total: 0, parcial: false };
  if (limpio === '') return vacio;

  if (/^\d+$/.test(limpio)) {
    const porCodigo = indice.filter(function (o) { return o.valor.indexOf(limpio) === 0; });
    return { filas: porCodigo.slice(0, MAXIMO_OCUPACIONES_EN_LISTA), total: porCodigo.length, parcial: false };
  }

  let palabras = palabrasDeOcupacion(limpio);
  const conSentido = palabras.filter(function (p) { return PALABRAS_VACIAS_OCUPACION.indexOf(p) === -1; });
  if (conSentido.length > 0) palabras = conSentido;
  const raices = palabras.map(raizDeOcupacion);
  if (raices.length === 0) return vacio;

  const candidatas = [];
  indice.forEach(function (ocupacion) {
    let aciertos = 0;
    raices.forEach(function (raiz) {
      if (ocupacion.palabras.some(function (p) { return p.indexOf(raiz) === 0; })) aciertos++;
    });
    if (aciertos > 0) {
      candidatas.push({
        ocupacion: ocupacion,
        aciertos: aciertos,
        alInicio: ocupacion.palabras[0].indexOf(raices[0]) === 0 ? 0 : 1
      });
    }
  });

  const completas = candidatas.filter(function (c) { return c.aciertos === raices.length; });
  const elegidas = completas.length > 0 ? completas : candidatas;
  elegidas.sort(function (a, b) {
    return b.aciertos - a.aciertos || a.alInicio - b.alInicio ||
      a.ocupacion.largo - b.ocupacion.largo || a.ocupacion.valor.localeCompare(b.ocupacion.valor);
  });

  return {
    filas: elegidas.slice(0, MAXIMO_OCUPACIONES_EN_LISTA).map(function (c) { return c.ocupacion; }),
    total: elegidas.length,
    parcial: completas.length === 0 && elegidas.length > 0
  };
}

function esCodigoDeOcupacion(texto) {
  return CAT_OCUPACION_CIUO.some(function (o) { return o.valor === texto; });
}

/* --- La lista bajo el campo -----------------------------------------------
   Una sola para todos los integrantes: sólo existe mientras está abierta, así
   que clonar un bloque de integrante no la arrastra. */
let listaOcupacion = null;
let campoDeListaOcupacion = null;
let campoYaUbicado = null;
let eligiendoOcupacion = false;

function campoDeOcupacion(elemento) {
  return elemento && elemento.matches && elemento.matches('[data-rol="ocupacion"]') ? elemento : null;
}

function cerrarListaOcupacion() {
  if (campoDeListaOcupacion) {
    campoDeListaOcupacion.setAttribute('aria-expanded', 'false');
    campoDeListaOcupacion.removeAttribute('aria-controls');
    campoDeListaOcupacion.removeAttribute('aria-activedescendant');
  }
  if (listaOcupacion) listaOcupacion.remove();
  listaOcupacion = null;
  campoDeListaOcupacion = null;
}

/* Debajo del campo y sin meterse bajo el teclado del teléfono, que achica lo
   visible sin avisar a la página. */
function ajustarListaOcupacion() {
  if (!listaOcupacion || !campoDeListaOcupacion) return;
  const campo = campoDeListaOcupacion;
  listaOcupacion.style.top = (campo.offsetTop + campo.offsetHeight + 4) + 'px';
  listaOcupacion.style.left = campo.offsetLeft + 'px';
  listaOcupacion.style.width = campo.offsetWidth + 'px';

  const vista = window.visualViewport;
  const finDeLoVisible = vista ? vista.offsetTop + vista.height : window.innerHeight;
  const disponible = finDeLoVisible - campo.getBoundingClientRect().bottom - 12;
  listaOcupacion.style.maxHeight = Math.max(132, Math.min(280, disponible)) + 'px';
}

function agregarAvisoOcupacion(lista, texto) {
  const aviso = document.createElement('li');
  aviso.className = 'combo-cups__aviso';
  aviso.setAttribute('role', 'presentation');
  aviso.textContent = texto;
  lista.appendChild(aviso);
}

function pintarListaOcupacion(campo) {
  const texto = campo.value.trim();
  cerrarListaOcupacion();
  /* Sin nada escrito no hay qué ofrecer, y un código ya completo no necesita
     lista: su nombre aparece debajo del campo. */
  if (texto === '' || esCodigoDeOcupacion(texto)) return;

  const resultado = buscarOcupaciones(texto);
  const lista = document.createElement('ul');
  lista.id = 'listaOcupacion';
  lista.className = 'combo-cups__lista combo-ocupacion__lista';
  lista.setAttribute('role', 'listbox');
  lista.setAttribute('aria-label', 'Ocupaciones que coinciden con lo escrito');

  if (resultado.total === 0) {
    agregarAvisoOcupacion(lista, 'No se encontró esa ocupación. Pruebe con otra palabra o con el código.');
  } else if (resultado.parcial) {
    agregarAvisoOcupacion(lista, 'Ninguna coincide con todas las palabras. Estas se acercan:');
  }

  resultado.filas.forEach(function (ocupacion, i) {
    const opcion = document.createElement('li');
    opcion.className = 'combo-ocupacion__opcion';
    opcion.id = 'listaOcupacion-opcion-' + i;
    opcion.setAttribute('role', 'option');
    opcion.dataset.codigo = ocupacion.valor;

    const codigo = document.createElement('span');
    codigo.className = 'combo-cups__codigo';
    codigo.textContent = ocupacion.valor;
    const etiqueta = document.createElement('span');
    etiqueta.className = 'combo-cups__etiqueta';
    etiqueta.textContent = ocupacion.etiqueta;

    opcion.appendChild(codigo);
    opcion.appendChild(etiqueta);
    lista.appendChild(opcion);
  });

  if (resultado.total > resultado.filas.length) {
    agregarAvisoOcupacion(lista, 'Hay más coincidencias. Escriba un poco más para acotar.');
  }

  campo.insertAdjacentElement('afterend', lista);
  listaOcupacion = lista;
  campoDeListaOcupacion = campo;
  campo.setAttribute('aria-expanded', 'true');
  campo.setAttribute('aria-controls', lista.id);

  /* En el teléfono el teclado tapa media pantalla: el campo sube una vez, para
     que la lista quepa debajo. */
  if (campoYaUbicado !== campo && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    campoYaUbicado = campo;
    campo.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  ajustarListaOcupacion();
}

function fijarOcupacion(campo, codigo) {
  campo.value = codigo;
  cerrarListaOcupacion();
  /* Los mismos eventos que el teclado, para que las reglas, el nombre bajo el
     campo y el guardado automático se enteren. */
  eligiendoOcupacion = true;
  try {
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    eligiendoOcupacion = false;
  }
}

/* Al salir: un nombre escrito completo que sólo puede ser una ocupación se
   resuelve solo, y el nombre que aparece debajo lo confirma. Si puede ser
   varias, queda como está y la validación pide elegir. */
function resolverOcupacionEscrita(campo) {
  const texto = campo.value.trim();
  if (campo.readOnly || campo.disabled || texto === '' || /^\d+$/.test(texto)) {
    if (texto !== campo.value) fijarOcupacion(campo, texto);
    return;
  }
  if (esCodigoDeOcupacion(texto)) return;
  const resultado = buscarOcupaciones(texto);
  if (resultado.total === 1 && !resultado.parcial) fijarOcupacion(campo, resultado.filas[0].valor);
}

function moverSeleccionOcupacion(salto) {
  if (!listaOcupacion) return;
  const opciones = Array.prototype.slice.call(listaOcupacion.querySelectorAll('.combo-ocupacion__opcion'));
  if (opciones.length === 0) return;
  const actual = opciones.findIndex(function (o) { return o.classList.contains('combo-ocupacion__opcion--activa'); });
  let siguiente = actual + salto;
  if (siguiente < 0) siguiente = opciones.length - 1;
  if (siguiente >= opciones.length) siguiente = 0;
  opciones.forEach(function (o) { o.classList.remove('combo-ocupacion__opcion--activa'); });
  opciones[siguiente].classList.add('combo-ocupacion__opcion--activa');
  opciones[siguiente].scrollIntoView({ block: 'nearest' });
  campoDeListaOcupacion.setAttribute('aria-activedescendant', opciones[siguiente].id);
}

function manejarTeclaOcupacion(evento) {
  const campo = campoDeOcupacion(evento.target);
  if (!campo || campo.readOnly || campo.disabled) return;

  if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
    if (!listaOcupacion) pintarListaOcupacion(campo);
    moverSeleccionOcupacion(evento.key === 'ArrowDown' ? 1 : -1);
    evento.preventDefault();
    return;
  }
  if (!listaOcupacion) return;

  if (evento.key === 'Enter') {
    /* El formulario se envía con Enter: con la lista abierta, Enter elige.
       Sin una marcada, sólo si no hay duda de cuál es. */
    evento.preventDefault();
    const opciones = listaOcupacion.querySelectorAll('.combo-ocupacion__opcion');
    const activa = listaOcupacion.querySelector('.combo-ocupacion__opcion--activa') ||
      (opciones.length === 1 ? opciones[0] : null);
    if (activa) fijarOcupacion(campo, activa.dataset.codigo);
    return;
  }
  if (evento.key === 'Escape') {
    cerrarListaOcupacion();
    evento.stopPropagation();
  }
}

/* Por delegación, como el buscador de CUPS: los bloques de integrante se clonan
   y un clon funciona sin engancharlo. */
function inicializarBuscadorOcupacion() {
  const formulario = document.getElementById('encuestaForm');
  if (!formulario) return;

  formulario.addEventListener('input', function (evento) {
    const campo = campoDeOcupacion(evento.target);
    if (!campo || eligiendoOcupacion) return;
    /* Cargar una ficha no es teclear: ver cargarEncuestaEnFormulario. */
    if (typeof cargandoFichaEnFormulario !== 'undefined' && cargandoFichaEnFormulario) return;
    if (document.activeElement !== campo || campo.readOnly || campo.disabled) return;
    pintarListaOcupacion(campo);
  });

  /* Con un código ya puesto, lo que se escriba lo reemplaza: quien vuelve al
     campo para cambiar 9998 no tiene que borrarlo primero. */
  formulario.addEventListener('focusin', function (evento) {
    const campo = campoDeOcupacion(evento.target);
    if (!campo || campo.readOnly || campo.disabled) return;
    if (esCodigoDeOcupacion(campo.value.trim())) campo.select();
    else pintarListaOcupacion(campo);
  });

  formulario.addEventListener('keydown', manejarTeclaOcupacion);

  /* `mousedown` y no `click`: al tocar la lista el campo perdería el foco, y al
     perderlo la lista se cierra antes de que el toque llegue a la opción. */
  formulario.addEventListener('mousedown', function (evento) {
    if (!listaOcupacion || !listaOcupacion.contains(evento.target)) return;
    evento.preventDefault();
    const opcion = evento.target.closest('.combo-ocupacion__opcion');
    if (opcion) fijarOcupacion(campoDeListaOcupacion, opcion.dataset.codigo);
  });

  formulario.addEventListener('focusout', function (evento) {
    const campo = campoDeOcupacion(evento.target);
    if (!campo) return;
    if (campoDeListaOcupacion === campo) cerrarListaOcupacion();
    if (campoYaUbicado === campo) campoYaUbicado = null;
    resolverOcupacionEscrita(campo);
  });

  if (window.visualViewport) window.visualViewport.addEventListener('resize', ajustarListaOcupacion);
  window.addEventListener('resize', ajustarListaOcupacion);
}
