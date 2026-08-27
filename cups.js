/* =========================================================================
   Encuesta_APS — Buscador de procedimientos CUPS / NoCUPS
   -------------------------------------------------------------------------
   ÍTEMS 114, 124 Y 136a

   POR QUÉ NO ES UN DESPLEGABLE

   El campo empezó siendo texto libre y eso dejaba fichas atrapadas: se
   escribía un código que la base no reconoce, la ficha cerraba en pantalla y
   la rechazaba un 400 al sincronizar, ya sin el formulario delante. Se pasó
   entonces a un `<select>` con las 64 acciones que un equipo básico concierta
   a diario, y el error dejó de ser posible.

   Pero el catálogo oficial tiene 10.044 procedimientos. Cuando el profesional
   realizó uno que no está en esa lista corta, el desplegable no se lo permitía
   registrar. Y descargar los diez mil al navegador no es opción en una visita
   domiciliaria sobre datos móviles.

   De ahí este control: se escribe, y lo escrito se busca contra la tabla
   `cat.cups` conforme se teclea. Sirven las dos formas en que un profesional
   busca —«876» para ir al código que ya conoce, «curación» para encontrarlo
   por lo que hizo— y lo que viaja es sólo lo que se pidió.

   NADA DE ESTO ESTÁ ESCRITO EN EL NAVEGADOR

   Ni un código ni un nombre viven en este archivo: todo sale de
   /api/buscar_cups, que consulta la tabla. Lo único que se guarda aquí es lo
   que la base ya respondió, y por una razón concreta: sin señal el
   desplegable quedaría mudo justo en la visita, que es cuando se necesita.

   SIN SEÑAL

   Se busca entonces sobre dos cosas que ya están en el dispositivo: el
   catálogo de acciones de APS —el mismo que descarga `catalogo_acciones`— y
   los códigos que se hayan resuelto antes. Se avisa de que la búsqueda es
   parcial, en vez de dejar creer que el código no existe.

   QUÉ SE GUARDA Y QUÉ NO

   El control escribe en el campo el CÓDIGO, nunca el nombre: es lo que exige
   la llave foránea contra `cat.cups` y lo que permite a RN-220 cruzar la
   alerta con la acción. El nombre se muestra debajo, como confirmación de que
   el código es el que se quería.
   ========================================================================= */

'use strict';

/* Códigos que la base ya confirmó en esta sesión o en una anterior:
   código -> nombre. Es una caché, no un catálogo. */
const CUPS_RESUELTOS = new Map();

const CLAVE_CACHE_CUPS = 'aps_cups_resueltos';

/* Recordar todo lo buscado haría crecer el almacenamiento sin límite. Con
   trescientos códigos cabe de sobra lo que un equipo usa en meses. */
const MAXIMO_CUPS_RECORDADOS = 300;

/* Se espera a que la persona deje de teclear: sin esto «876110» dispara seis
   consultas y llegan desordenadas. */
const RETARDO_BUSQUEDA_MS = 250;

/* Por debajo de dos caracteres el servidor no responde nada: cualquier
   término trae cientos de filas que no ayudan a elegir. */
const MINIMO_TERMINO_CUPS = 2;

/* Un temporizador y una petición en vuelo por cada campo. Van en WeakMap y no
   en el DOM porque son objetos, y porque así se sueltan solos cuando la fila
   se elimina. */
const temporizadoresCups = new WeakMap();
const peticionesCups = new WeakMap();

/* =========================================================
   1. CACHÉ DE CÓDIGOS YA RESUELTOS
   ========================================================= */

function cargarCupsRecordados() {
  try {
    const guardado = localStorage.getItem(CLAVE_CACHE_CUPS);
    if (!guardado) return;

    const filas = JSON.parse(guardado);
    if (!Array.isArray(filas)) return;

    filas.forEach(function (fila) {
      if (fila && fila.codigo) CUPS_RESUELTOS.set(String(fila.codigo), fila.nombre || '');
    });
  } catch (error) {
    console.warn('No fue posible leer los códigos CUPS recordados:', error);
  }
}

function recordarCups(filas) {
  (filas || []).forEach(function (fila) {
    if (fila && fila.codigo) CUPS_RESUELTOS.set(String(fila.codigo), fila.nombre || '');
  });

  /* Se descartan los más antiguos: `Map` conserva el orden de inserción, así
     que los primeros son los que llevan más tiempo sin usarse. */
  while (CUPS_RESUELTOS.size > MAXIMO_CUPS_RECORDADOS) {
    CUPS_RESUELTOS.delete(CUPS_RESUELTOS.keys().next().value);
  }

  try {
    const lista = [];
    CUPS_RESUELTOS.forEach(function (nombre, codigo) {
      lista.push({ codigo: codigo, nombre: nombre });
    });
    localStorage.setItem(CLAVE_CACHE_CUPS, JSON.stringify(lista));
  } catch (error) {
    console.warn('No fue posible guardar los códigos CUPS resueltos:', error);
  }
}

/* =========================================================
   2. PARTES DEL CONTROL
   ========================================================= */

function comboDe(elemento) {
  return elemento ? elemento.closest('[data-rol="comboCups"]') : null;
}

function entradaDe(combo) {
  return combo ? combo.querySelector('.combo-cups__entrada') : null;
}

function listaDe(combo) {
  return combo ? combo.querySelector('.combo-cups__lista') : null;
}

function rotuloDe(combo) {
  return combo ? combo.querySelector('.combo-cups__nombre') : null;
}

/* =========================================================
   3. BÚSQUEDA
   ========================================================= */

/* Por qué falló la consulta. Los tres casos se arreglan de forma distinta y
   confundirlos cuesta caro: decir «sin conexión» cuando la página no la sirve
   su propio servidor manda a revisar la red —o la base— durante un buen rato,
   y el problema estaba en la barra de direcciones. */
const FALLO = {
  SIN_RED: 'sin_red',        // no hubo respuesta: sin señal, o el servidor caído
  SIN_ENDPOINT: 'sin_api',   // respondió algo que no es la API: 404
  SERVIDOR: 'servidor'       // la API respondió, y respondió que falló: 5xx
};

const MENSAJE_DE_FALLO = {
  sin_red: 'Sin conexión: se busca sólo entre las acciones ya descargadas.',
  /* Es el caso de abrir index.html con doble clic, o de servirlo con otra
     herramienta: la página carga, pero /api/ no existe en ese origen. */
  sin_api: 'La aplicación no se está sirviendo desde su propio servidor, así que no puede ' +
           'consultar el catálogo. Ábrala desde http://localhost (npm run dev).',
  servidor: 'El servidor no pudo consultar el catálogo. Revise la conexión a la base de datos.'
};

/**
 * Consulta la tabla. Devuelve `{ fallo }` cuando no se pudo obtener respuesta
 * útil, que es distinto de «no hay resultados»: en un caso se busca en lo que
 * hay en el dispositivo, en el otro se dice que el procedimiento no existe.
 */
async function buscarCupsEnServidor(termino, entrada) {
  /* Se cancela la búsqueda anterior del mismo campo: al teclear rápido las
     respuestas vuelven desordenadas y la de «87» puede llegar después de la
     de «876», dejando en pantalla la lista equivocada. */
  const enVuelo = peticionesCups.get(entrada);
  if (enVuelo) enVuelo.abort();

  const control = typeof AbortController === 'function' ? new AbortController() : null;
  if (control) peticionesCups.set(entrada, control);

  try {
    const respuesta = await fetch(
      '/api/buscar_cups?q=' + encodeURIComponent(termino),
      control ? { signal: control.signal } : undefined
    );

    if (!respuesta.ok) {
      console.error('La búsqueda de CUPS respondió ' + respuesta.status +
        ' para «' + termino + '».');
      return { fallo: respuesta.status === 404 ? FALLO.SIN_ENDPOINT : FALLO.SERVIDOR };
    }

    const cuerpo = await respuesta.json();
    const filas = Array.isArray(cuerpo.resultados) ? cuerpo.resultados : [];

    recordarCups(filas);
    return { resultados: filas, truncado: cuerpo.truncado === true };
  } catch (error) {
    if (error && error.name === 'AbortError') return { cancelada: true };
    console.error('No fue posible consultar el catálogo CUPS:', error);
    /* Abierta con doble clic no hay origen al que pedirle nada, y el fallo se
       parece a una caída de red aunque el equipo esté conectado. Se mira el
       protocolo y no `origenEsSeguro()`: un despliegue en la red local por
       http:// tampoco es contexto seguro, y ahí un fallo sí es de red. */
    const abiertaComoArchivo = typeof location !== 'undefined' && location.protocol === 'file:';
    return { fallo: abiertaComoArchivo ? FALLO.SIN_ENDPOINT : FALLO.SIN_RED };
  } finally {
    if (peticionesCups.get(entrada) === control) peticionesCups.delete(entrada);
  }
}

/**
 * Lo que se puede ofrecer sin red: el catálogo de acciones de APS que ya está
 * descargado y los códigos resueltos en visitas anteriores.
 */
function buscarCupsEnElDispositivo(termino) {
  const buscado = termino.toLowerCase();
  const vistos = new Set();
  const filas = [];

  function considerar(codigo, nombre, aptoAps) {
    if (vistos.has(codigo)) return;
    const coincide = codigo.toLowerCase().indexOf(buscado) === 0 ||
                     String(nombre).toLowerCase().indexOf(buscado) !== -1;
    if (!coincide) return;
    vistos.add(codigo);
    filas.push({ codigo: codigo, nombre: nombre, apto_aps: aptoAps });
  }

  /* `CAT_ACCION_PLAN` lo llena `catalogo_acciones`; su etiqueta viene como
     «CÓDIGO — nombre» y aquí interesa sólo el nombre. */
  (typeof CAT_ACCION_PLAN === 'undefined' ? [] : CAT_ACCION_PLAN).forEach(function (opcion) {
    const separador = String(opcion.etiqueta).indexOf(' — ');
    const nombre = separador === -1
      ? opcion.etiqueta
      : String(opcion.etiqueta).slice(separador + 3);
    considerar(opcion.valor, nombre, true);
  });

  CUPS_RESUELTOS.forEach(function (nombre, codigo) { considerar(codigo, nombre, false); });

  return filas.slice(0, 20);
}

/* =========================================================
   4. PINTADO DE LA LISTA
   ========================================================= */

function cerrarListaCups(combo) {
  const lista = listaDe(combo);
  const entrada = entradaDe(combo);
  if (!lista) return;

  lista.hidden = true;
  lista.innerHTML = '';
  if (entrada) entrada.setAttribute('aria-expanded', 'false');
}

function pintarListaCups(combo, filas, aviso) {
  const lista = listaDe(combo);
  const entrada = entradaDe(combo);
  if (!lista) return;

  const partes = [];

  if (aviso) {
    partes.push('<li class="combo-cups__aviso" role="presentation">' +
      escaparHtml(aviso) + '</li>');
  }

  filas.forEach(function (fila, i) {
    partes.push(
      '<li class="combo-cups__opcion" role="option" id="' +
        (entrada.id || 'combo') + '-opcion-' + i + '"' +
        ' data-codigo="' + escaparHtml(fila.codigo) + '"' +
        ' data-nombre="' + escaparHtml(fila.nombre) + '">' +
        '<span class="combo-cups__codigo">' + escaparHtml(fila.codigo) + '</span>' +
        '<span class="combo-cups__etiqueta">' + escaparHtml(fila.nombre) + '</span>' +
        (fila.apto_aps ? '<span class="combo-cups__marca">APS</span>' : '') +
      '</li>'
    );
  });

  if (filas.length === 0 && !aviso) {
    partes.push('<li class="combo-cups__aviso" role="presentation">' +
      'Ningún procedimiento coincide con lo escrito.</li>');
  }

  lista.innerHTML = partes.join('');
  lista.hidden = false;
  if (entrada) entrada.setAttribute('aria-expanded', 'true');
}

/* =========================================================
   5. EL NOMBRE DEBAJO DEL CAMPO
   ---------------------------------------------------------
   Es la confirmación de que el código escrito es el que se quería: seis
   dígitos no se leen, «AORTOGRAMA TORÁCICO» sí. Y si el código no está en el
   catálogo se dice en el momento, no al sincronizar.
   ========================================================= */

function mostrarNombreCups(combo, codigo, nombre, estado) {
  const rotulo = rotuloDe(combo);
  if (!rotulo) return;

  rotulo.classList.remove('combo-cups__nombre--error', 'combo-cups__nombre--pendiente');

  if (!codigo) {
    rotulo.textContent = '';
    delete rotulo.dataset.codigo;
    return;
  }

  rotulo.dataset.codigo = codigo;

  if (estado === 'desconocido') {
    rotulo.textContent = 'Este código no está en el catálogo CUPS ni en los NoCUPS.';
    rotulo.classList.add('combo-cups__nombre--error');
    return;
  }

  if (estado === 'sin_verificar') {
    rotulo.textContent = 'No se pudo verificar el código contra el catálogo. Revise la consola ' +
      'del navegador para ver por qué.';
    rotulo.classList.add('combo-cups__nombre--pendiente');
    return;
  }

  rotulo.textContent = nombre || '';
}

/**
 * Resuelve el nombre de un código ya escrito. Lo usan la carga de una ficha
 * puesta a corregir y el repintado general del formulario, donde el código
 * llega puesto y nadie lo tecleó.
 */
async function resolverCodigoCups(combo) {
  const entrada = entradaDe(combo);
  if (!entrada) return;

  const codigo = entrada.value.trim();
  const rotulo = rotuloDe(combo);

  if (codigo === '') {
    mostrarNombreCups(combo, '');
    return;
  }

  /* Ya resuelto para este mismo código: no se vuelve a preguntar. Es lo que
     hace barato llamar a esta función desde el recálculo general. */
  if (rotulo && rotulo.dataset.codigo === codigo && rotulo.textContent !== '') return;

  if (CUPS_RESUELTOS.has(codigo)) {
    mostrarNombreCups(combo, codigo, CUPS_RESUELTOS.get(codigo));
    return;
  }

  let respuesta = null;
  try {
    const peticion = await fetch('/api/buscar_cups?codigo=' + encodeURIComponent(codigo));
    if (peticion.ok) respuesta = await peticion.json();
    else console.error('La consulta del código ' + codigo + ' respondió ' + peticion.status + '.');
  } catch (error) {
    console.error('No fue posible consultar el código ' + codigo + ':', error);
  }

  /* No se pudo comprobar no es lo mismo que no existe: decir «este código no
     está en el catálogo» sin haber podido preguntar manda a corregir un dato
     que puede estar bien. */
  if (respuesta === null) {
    mostrarNombreCups(combo, codigo, '', 'sin_verificar');
    return;
  }

  const fila = (respuesta.resultados || [])[0];
  if (!fila) {
    mostrarNombreCups(combo, codigo, '', 'desconocido');
    return;
  }

  recordarCups([fila]);
  mostrarNombreCups(combo, codigo, fila.nombre);
}

/** Repasa todos los campos de código del formulario. */
function resolverCombosCups(raiz) {
  const ambito = raiz || document;
  Array.prototype.forEach.call(
    ambito.querySelectorAll('[data-rol="comboCups"]'),
    function (combo) { resolverCodigoCups(combo); }
  );
}

/* =========================================================
   6. INTERACCIÓN
   ========================================================= */

/* Campos cuyo valor acaba de poner la lista, no el teclado. Dura lo que tarda
   el `dispatchEvent`, que es síncrono. */
const elegidosDeLaLista = new WeakSet();

function elegirOpcionCups(combo, codigo, nombre) {
  const entrada = entradaDe(combo);
  if (!entrada) return;

  entrada.value = codigo;
  recordarCups([{ codigo: codigo, nombre: nombre }]);
  cerrarListaCups(combo);

  /* Hay que producir los mismos eventos que el teclado: sin ellos ni las
     reglas ni el tablero de riesgo se enteran de que el plan ya tiene su
     acción. Pero el escuchador de `input` está para lo que se teclea, y si
     viera éste borraría el nombre recién puesto y volvería a buscar por el
     código ya elegido, reabriendo la lista que acabamos de cerrar. */
  elegidosDeLaLista.add(entrada);
  try {
    entrada.dispatchEvent(new Event('input', { bubbles: true }));
    entrada.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    elegidosDeLaLista.delete(entrada);
  }

  mostrarNombreCups(combo, codigo, nombre);
}

async function buscarYPintar(combo) {
  const entrada = entradaDe(combo);
  const termino = entrada.value.trim();

  if (termino.length < MINIMO_TERMINO_CUPS) {
    cerrarListaCups(combo);
    return;
  }

  const resultado = await buscarCupsEnServidor(termino, entrada);

  /* La búsqueda quedó obsoleta: ya hay otra en vuelo con lo que se escribió
     después. Pintar ahora dejaría en pantalla la lista del término viejo. */
  if (resultado.cancelada) return;

  if (resultado.fallo) {
    /* Se ofrece lo que haya en el dispositivo, pero diciendo por qué la
       búsqueda es parcial: cada motivo se arregla de una forma distinta. */
    pintarListaCups(combo, buscarCupsEnElDispositivo(termino), MENSAJE_DE_FALLO[resultado.fallo]);
    return;
  }

  pintarListaCups(combo, resultado.resultados,
    resultado.truncado ? 'Hay más coincidencias. Escriba un poco más para acotar.' : '');
}

function programarBusquedaCups(combo) {
  const entrada = entradaDe(combo);
  if (!entrada) return;

  clearTimeout(temporizadoresCups.get(entrada));
  temporizadoresCups.set(entrada, setTimeout(function () {
    buscarYPintar(combo);
  }, RETARDO_BUSQUEDA_MS));
}

/* --- Recorrido con el teclado ------------------------------------------ */

function opcionesDe(combo) {
  const lista = listaDe(combo);
  return lista ? Array.prototype.slice.call(lista.querySelectorAll('.combo-cups__opcion')) : [];
}

function moverSeleccionCups(combo, salto) {
  const opciones = opcionesDe(combo);
  if (opciones.length === 0) return;

  const actual = opciones.findIndex(function (o) {
    return o.classList.contains('combo-cups__opcion--activa');
  });

  let siguiente = actual + salto;
  if (siguiente < 0) siguiente = opciones.length - 1;
  if (siguiente >= opciones.length) siguiente = 0;

  opciones.forEach(function (o) { o.classList.remove('combo-cups__opcion--activa'); });
  opciones[siguiente].classList.add('combo-cups__opcion--activa');
  opciones[siguiente].scrollIntoView({ block: 'nearest' });

  const entrada = entradaDe(combo);
  if (entrada) entrada.setAttribute('aria-activedescendant', opciones[siguiente].id || '');
}

function manejarTeclaCups(evento) {
  const combo = comboDe(evento.target);
  if (!combo || !evento.target.classList.contains('combo-cups__entrada')) return;

  const lista = listaDe(combo);
  const abierta = lista && !lista.hidden;

  if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
    if (!abierta) {
      buscarYPintar(combo);
      evento.preventDefault();
      return;
    }
    moverSeleccionCups(combo, evento.key === 'ArrowDown' ? 1 : -1);
    evento.preventDefault();
    return;
  }

  if (evento.key === 'Enter') {
    const activa = lista && lista.querySelector('.combo-cups__opcion--activa');
    if (abierta && activa) {
      /* El formulario se envía con Enter: dentro de la lista, Enter elige. */
      evento.preventDefault();
      elegirOpcionCups(combo, activa.dataset.codigo, activa.dataset.nombre);
    }
    return;
  }

  if (evento.key === 'Escape' && abierta) {
    cerrarListaCups(combo);
    evento.stopPropagation();
  }
}

/* =========================================================
   7. INICIALIZACIÓN
   ---------------------------------------------------------
   Todo por delegación sobre el formulario: las filas de acción se clonan al
   agregar una acción y al poner una ficha a corregir, y un control que se
   registre a sí mismo obliga a acordarse de engancharlo en cada sitio donde
   se clona. Delegando, un clon funciona sin que nadie haga nada.
   ========================================================= */

function inicializarBuscadorCups() {
  const formulario = document.getElementById('encuestaForm');
  if (!formulario) return;

  cargarCupsRecordados();

  formulario.addEventListener('input', function (evento) {
    if (!evento.target.classList.contains('combo-cups__entrada')) return;
    if (elegidosDeLaLista.has(evento.target)) return;

    const combo = comboDe(evento.target);
    /* El nombre de debajo deja de corresponder en cuanto se toca el código. */
    mostrarNombreCups(combo, '');
    programarBusquedaCups(combo);
  });

  formulario.addEventListener('keydown', manejarTeclaCups);

  /* `mousedown` y no `click`: al hacer clic, el campo pierde el foco primero y
     el cierre por `focusout` se llevaría la lista antes de que el clic
     llegara a la opción. */
  formulario.addEventListener('mousedown', function (evento) {
    const opcion = evento.target.closest('.combo-cups__opcion');
    if (!opcion) return;
    evento.preventDefault();
    elegirOpcionCups(comboDe(opcion), opcion.dataset.codigo, opcion.dataset.nombre);
  });

  formulario.addEventListener('focusout', function (evento) {
    const combo = comboDe(evento.target);
    if (!combo) return;
    /* Se cierra al salir del control, no al salir del campo: entre el campo y
       su lista hay un salto de foco que no es una salida. */
    setTimeout(function () {
      if (combo.contains(document.activeElement)) return;
      cerrarListaCups(combo);
      resolverCodigoCups(combo);
    }, 0);
  });
}
