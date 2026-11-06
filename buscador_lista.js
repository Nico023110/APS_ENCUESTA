/* =========================================================================
   Encuesta_APS — Buscador con lista propia (ítems 9 y 73)
   -------------------------------------------------------------------------
   POR QUÉ NO ES UN <datalist>

   La lista nativa la filtra cada navegador a su manera, y lo que encuentra uno
   no lo encuentra otro. Firefox, por ejemplo, busca sólo en la etiqueta de cada
   opción: con «Comuna 2» como etiqueta, en el ítem 9 ningún barrio aparecía por
   su nombre. Aquí la búsqueda es la misma en todos los equipos y sin señal: sin
   tildes, sin importar mayúsculas, por el inicio de cada palabra y en cualquier
   orden.

   Este archivo es sólo el mecanismo. Qué se busca y qué se guarda lo decide
   cada campo: ocupacion.js (ítem 73) guarda un código de la tabla; barrios.js
   (ítem 9) guarda un nombre y admite lo que no esté en la lista.
   ========================================================================= */

const MAXIMO_FILAS_EN_LISTA = 30;

const PALABRAS_VACIAS_BUSQUEDA = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'en', 'por', 'para', 'con'];

function normalizarBusqueda(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function palabrasDeBusqueda(texto) {
  return normalizarBusqueda(texto).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Busca por palabras en un índice de filas { valor, palabras, largo, ... }.
 * @param {{palabrasVacias?:string[], raiz?:function(string):string}} [opciones]
 * @returns {{filas:Array, total:number, parcial:boolean}}
 *          `parcial`: ninguna coincide con todo lo escrito; son las que más se acercan.
 */
function buscarEnIndice(indice, texto, opciones) {
  const ajustes = opciones || {};
  const vacias = ajustes.palabrasVacias || PALABRAS_VACIAS_BUSQUEDA;
  const vacio = { filas: [], total: 0, parcial: false };

  let palabras = palabrasDeBusqueda(texto);
  const conSentido = palabras.filter(function (p) { return vacias.indexOf(p) === -1; });
  if (conSentido.length > 0) palabras = conSentido;
  const raices = ajustes.raiz ? palabras.map(ajustes.raiz) : palabras;
  if (raices.length === 0) return vacio;

  const candidatas = [];
  indice.forEach(function (fila) {
    let aciertos = 0;
    raices.forEach(function (raiz) {
      if (fila.palabras.some(function (p) { return p.indexOf(raiz) === 0; })) aciertos++;
    });
    if (aciertos > 0) {
      candidatas.push({
        fila: fila,
        aciertos: aciertos,
        alInicio: fila.palabras[0].indexOf(raices[0]) === 0 ? 0 : 1
      });
    }
  });

  const completas = candidatas.filter(function (c) { return c.aciertos === raices.length; });
  const elegidas = completas.length > 0 ? completas : candidatas;
  elegidas.sort(function (a, b) {
    return b.aciertos - a.aciertos || a.alInicio - b.alInicio ||
      a.fila.largo - b.fila.largo || a.fila.valor.localeCompare(b.fila.valor);
  });

  return {
    filas: elegidas.slice(0, MAXIMO_FILAS_EN_LISTA).map(function (c) { return c.fila; }),
    total: elegidas.length,
    parcial: completas.length === 0 && elegidas.length > 0
  };
}

/**
 * Engancha un buscador a los campos del formulario que coincidan con `selector`.
 * Por delegación, como el buscador de CUPS: un bloque clonado funciona sin
 * engancharlo. La lista sólo existe mientras está abierta, así que clonar un
 * bloque tampoco la arrastra.
 *
 * @param {Object} config
 * @param {string} config.selector        Los campos que atiende.
 * @param {string} config.idLista         id de la lista abierta.
 * @param {string} config.etiquetaLista   Lo que anuncia el lector de pantalla.
 * @param {function(string):Object} config.buscar  Texto → { filas, total, parcial }.
 * @param {function(HTMLElement,Object)} config.pintarFila  Llena la opción de una fila.
 * @param {function(string):boolean} config.esValorCompleto  Lo escrito ya es un valor de la lista: no hace falta abrirla.
 * @param {string} config.avisoSinResultados
 * @param {string} config.avisoParcial
 * @param {function():Array} [config.todas]  Con esto, entrar al campo despliega la lista completa, como una lista normal.
 * @param {string} [config.avisoTodas]    Lo que se dice encima de la lista completa.
 * @param {function(HTMLInputElement,function)} [config.alEnfocar]  Recibe el campo y la función que abre la lista.
 * @param {function(HTMLInputElement,function)} [config.alSalir]    Recibe el campo y la función que fija un valor.
 */
function crearBuscadorConLista(config) {
  const formulario = document.getElementById('encuestaForm');
  if (!formulario) return;

  let lista = null;
  let campoDeLista = null;
  let listaEsParcial = false;
  let campoYaUbicado = null;
  let eligiendo = false;

  function campoDe(elemento) {
    return elemento && elemento.matches && elemento.matches(config.selector) ? elemento : null;
  }

  function cerrar() {
    if (campoDeLista) {
      campoDeLista.setAttribute('aria-expanded', 'false');
      campoDeLista.removeAttribute('aria-controls');
      campoDeLista.removeAttribute('aria-activedescendant');
    }
    if (lista) lista.remove();
    lista = null;
    campoDeLista = null;
  }

  /* Debajo del campo y sin meterse bajo el teclado del teléfono, que achica lo
     visible sin avisar a la página. */
  function ajustar() {
    if (!lista || !campoDeLista) return;
    const campo = campoDeLista;
    lista.style.top = (campo.offsetTop + campo.offsetHeight + 4) + 'px';
    lista.style.left = campo.offsetLeft + 'px';
    lista.style.width = campo.offsetWidth + 'px';

    const vista = window.visualViewport;
    const finDeLoVisible = vista ? vista.offsetTop + vista.height : window.innerHeight;
    const disponible = finDeLoVisible - campo.getBoundingClientRect().bottom - 12;
    lista.style.maxHeight = Math.max(132, Math.min(280, disponible)) + 'px';
  }

  function agregarAviso(elemento, texto) {
    const aviso = document.createElement('li');
    aviso.className = 'combo-cups__aviso';
    aviso.setAttribute('role', 'presentation');
    aviso.textContent = texto;
    elemento.appendChild(aviso);
  }

  /* `alEntrar`: se llegó al campo, no se está escribiendo en él. */
  function pintar(campo, alEntrar) {
    const texto = campo.value.trim();
    cerrar();
    const completo = texto !== '' && config.esValorCompleto(texto);
    /* Un valor completo que se acaba de escribir no necesita lista. Pero al
       volver a él se ofrece todo: filtrar por lo que ya tiene el campo dejaría
       como única opción ese mismo valor. */
    const mostrarTodas = Boolean(config.todas) && (texto === '' || (alEntrar === true && completo));
    if (!mostrarTodas && (texto === '' || completo)) return;

    const filasTodas = mostrarTodas ? config.todas() : null;
    const resultado = mostrarTodas
      ? { filas: filasTodas, total: filasTodas.length, parcial: false }
      : config.buscar(texto);
    const nueva = document.createElement('ul');
    nueva.id = config.idLista;
    nueva.className = 'combo-cups__lista combo-buscador__lista';
    nueva.setAttribute('role', 'listbox');
    nueva.setAttribute('aria-label', config.etiquetaLista);

    if (mostrarTodas && config.avisoTodas) agregarAviso(nueva, config.avisoTodas);
    if (resultado.total === 0) agregarAviso(nueva, config.avisoSinResultados);
    else if (resultado.parcial) agregarAviso(nueva, config.avisoParcial);

    resultado.filas.forEach(function (fila, i) {
      const opcion = document.createElement('li');
      opcion.className = 'combo-buscador__opcion';
      opcion.id = config.idLista + '-opcion-' + i;
      opcion.setAttribute('role', 'option');
      opcion.dataset.valor = fila.valor;
      config.pintarFila(opcion, fila);
      nueva.appendChild(opcion);
    });

    if (resultado.total > resultado.filas.length) {
      agregarAviso(nueva, 'Hay más coincidencias. Escriba un poco más para acotar.');
    }

    campo.insertAdjacentElement('afterend', nueva);
    lista = nueva;
    campoDeLista = campo;
    listaEsParcial = resultado.parcial;
    campo.setAttribute('aria-expanded', 'true');
    campo.setAttribute('aria-controls', nueva.id);

    /* En el teléfono el teclado tapa media pantalla: el campo sube una vez, para
       que la lista quepa debajo. */
    if (campoYaUbicado !== campo && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      campoYaUbicado = campo;
      campo.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    ajustar();

    /* Se abre donde está lo que ya tiene el campo, no al principio de la lista. */
    const actual = completo ? Array.prototype.find.call(nueva.querySelectorAll('.combo-buscador__opcion'), function (o) {
      return o.dataset.valor === texto;
    }) : null;
    if (actual) {
      actual.classList.add('combo-buscador__opcion--activa');
      nueva.scrollTop = Math.max(0, actual.offsetTop - actual.offsetHeight);
      campo.setAttribute('aria-activedescendant', actual.id);
    }
  }

  function abrir(campo) {
    pintar(campo, true);
  }

  function fijar(campo, valor) {
    campo.value = valor;
    cerrar();
    /* Los mismos eventos que el teclado, para que las reglas, lo que depende del
       campo y el guardado automático se enteren. */
    eligiendo = true;
    try {
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      eligiendo = false;
    }
  }

  function moverSeleccion(salto) {
    if (!lista) return;
    const opciones = Array.prototype.slice.call(lista.querySelectorAll('.combo-buscador__opcion'));
    if (opciones.length === 0) return;
    const actual = opciones.findIndex(function (o) { return o.classList.contains('combo-buscador__opcion--activa'); });
    let siguiente = actual + salto;
    if (siguiente < 0) siguiente = opciones.length - 1;
    if (siguiente >= opciones.length) siguiente = 0;
    opciones.forEach(function (o) { o.classList.remove('combo-buscador__opcion--activa'); });
    opciones[siguiente].classList.add('combo-buscador__opcion--activa');
    opciones[siguiente].scrollIntoView({ block: 'nearest' });
    campoDeLista.setAttribute('aria-activedescendant', opciones[siguiente].id);
  }

  formulario.addEventListener('input', function (evento) {
    const campo = campoDe(evento.target);
    if (!campo || eligiendo) return;
    /* Cargar una ficha no es teclear: ver cargarEncuestaEnFormulario. */
    if (typeof cargandoFichaEnFormulario !== 'undefined' && cargandoFichaEnFormulario) return;
    if (document.activeElement !== campo || campo.readOnly || campo.disabled) return;
    pintar(campo);
  });

  formulario.addEventListener('focusin', function (evento) {
    const campo = campoDe(evento.target);
    if (!campo || campo.readOnly || campo.disabled || !config.alEnfocar) return;
    config.alEnfocar(campo, abrir);
  });

  /* Tocar el campo con la lista cerrada —después de elegir o de Escape— la abre:
     el foco ya estaba ahí, así que `focusin` no se entera. */
  formulario.addEventListener('click', function (evento) {
    const campo = campoDe(evento.target);
    if (!campo || lista || !config.todas || campo.readOnly || campo.disabled) return;
    abrir(campo);
  });

  formulario.addEventListener('keydown', function (evento) {
    const campo = campoDe(evento.target);
    if (!campo || campo.readOnly || campo.disabled) return;

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (!lista) abrir(campo);
      moverSeleccion(evento.key === 'ArrowDown' ? 1 : -1);
      evento.preventDefault();
      return;
    }
    if (!lista) return;

    if (evento.key === 'Enter') {
      /* El formulario se envía con Enter: con la lista abierta, Enter elige.
         Sin una marcada, sólo si no hay duda de cuál es. */
      evento.preventDefault();
      const opciones = lista.querySelectorAll('.combo-buscador__opcion');
      const activa = lista.querySelector('.combo-buscador__opcion--activa') ||
        (opciones.length === 1 && !listaEsParcial ? opciones[0] : null);
      if (activa) fijar(campo, activa.dataset.valor);
      return;
    }
    if (evento.key === 'Escape') {
      cerrar();
      evento.stopPropagation();
    }
  });

  /* `mousedown` y no `click`: al tocar la lista el campo perdería el foco, y al
     perderlo la lista se cierra antes de que el toque llegue a la opción. */
  formulario.addEventListener('mousedown', function (evento) {
    if (!lista || !lista.contains(evento.target)) return;
    evento.preventDefault();
    const opcion = evento.target.closest('.combo-buscador__opcion');
    if (opcion) fijar(campoDeLista, opcion.dataset.valor);
  });

  formulario.addEventListener('focusout', function (evento) {
    const campo = campoDe(evento.target);
    if (!campo) return;
    if (campoDeLista === campo) cerrar();
    if (campoYaUbicado === campo) campoYaUbicado = null;
    if (config.alSalir) config.alSalir(campo, fijar);
  });

  if (window.visualViewport) window.visualViewport.addEventListener('resize', ajustar);
  window.addEventListener('resize', ajustar);
}
