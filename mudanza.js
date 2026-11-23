/* =========================================================================
   Encuesta_APS — Aviso de mudanza a la dirección nueva
   -------------------------------------------------------------------------
   La aplicación pasa de Vercel (aps-encuesta.vercel.app) al servidor de la
   E.S.E. (ebs.saludladera.gov.co). Lo que cada teléfono guarda —fichas sin
   subir, la copia para buscar sin señal, el acceso sin señal— queda atado a la
   dirección vieja y no pasa solo a la nueva. Por eso nadie debe cambiarse sin
   haber subido todo, y nadie debe quedarse trabajando en la vieja sin saber
   que se mudó.

   SE ENCIENDE EDITANDO mudanza.json (al lado de index.html) Y SUBIÉNDOLO
     activa          false: no se muestra nada en ninguna parte (así se sube).
     nuevaDireccion  https://… de la dirección nueva.
     corte           desde ese instante aquí ya no se empiezan fichas nuevas.
     apertura        desde ese instante se invita a ir a la dirección nueva
                     (si se deja vacía, es la misma hora del corte).
     mensaje         si no está vacío, reemplaza el texto del aviso previo.

   LO QUE HACE, POR FASE (sólo en la dirección vieja)
     aviso    (activa, antes del corte) un aviso arriba en el acceso, en la
              aplicación y en Instalar: la fecha, la dirección nueva y que
              suban todo antes. Se puede cerrar; vuelve a salir al abrir.
     cerrada  (del corte a la apertura) no deja empezar fichas nuevas; sí
              terminar la que está en pantalla y subir lo pendiente. Dice
              qué falta subir y cuándo abre la dirección nueva.
     mudada   (desde la apertura) lo mismo, y cuando ya no queda nada suyo
              por subir, el enlace a la dirección nueva y los pasos.

   En la dirección nueva no se muestra nunca: este archivo compara el origen,
   y el servidor propio ni siquiera entrega mudanza.json (sólo sirve lo que
   está en la lista de sw.js).

   SIN SEÑAL
   mudanza.json se pide a la red en cada apertura (sin caché, el service
   worker no lo toca) y la última respuesta se guarda en el equipo: un
   teléfono que ya la vio sigue viendo el aviso en terreno.
   ========================================================================= */

(function () {
  'use strict';

  const RUTA = '/mudanza.json';
  const CLAVE_CONFIGURACION = 'aps_mudanza';
  const CLAVE_AVISO_CERRADO = 'aps_mudanza_aviso_cerrado';
  const CADA_MINUTO_MS = 60 * 1000;
  const ENTRE_CONSULTAS_MS = 5 * 60 * 1000;
  const ZONA = 'America/Bogota';

  let configuracion = normalizar(leerGuardada());
  let estadoSincronia = null;
  let ultimaConsulta = 0;
  let firmaPintada = '';

  /* ---------------------------------------------------------
     Configuración
     --------------------------------------------------------- */

  function leerGuardada() {
    try {
      const texto = window.localStorage.getItem(CLAVE_CONFIGURACION);
      return texto ? JSON.parse(texto) : null;
    } catch (error) { return null; }
  }

  function guardar(cruda) {
    try {
      if (cruda) window.localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(cruda));
      else window.localStorage.removeItem(CLAVE_CONFIGURACION);
    } catch (error) { /* sin almacenamiento: se usa sólo lo de esta apertura */ }
  }

  /* Sólo una configuración completa y con https enciende algo. Cualquier otra
     cosa —un archivo a medio editar, una dirección http— es «apagada». */
  function normalizar(cruda) {
    if (!cruda || cruda.activa !== true) return null;
    let nueva;
    try { nueva = new URL(String(cruda.nuevaDireccion)); } catch (error) { return null; }
    if (nueva.protocol !== 'https:') return null;
    const corte = Date.parse(cruda.corte);
    if (isNaN(corte)) return null;
    const apertura = cruda.apertura ? Date.parse(cruda.apertura) : NaN;
    return {
      nueva: nueva.origin,
      host: nueva.host,
      corte: corte,
      apertura: isNaN(apertura) || apertura < corte ? corte : apertura,
      mensaje: typeof cruda.mensaje === 'string' ? cruda.mensaje.trim().slice(0, 600) : ''
    };
  }

  function consultar(forzar) {
    const ahora = Date.now();
    if (!forzar && ahora - ultimaConsulta < ENTRE_CONSULTAS_MS) return Promise.resolve();
    if (typeof window.fetch !== 'function') return Promise.resolve();
    ultimaConsulta = ahora;
    return window.fetch(RUTA, { cache: 'no-store', credentials: 'same-origin' }).then(function (respuesta) {
      /* No está (la dirección nueva no lo entrega): apagado. */
      if (respuesta.status === 404) { configuracion = null; guardar(null); return; }
      if (!respuesta.ok) return;
      return respuesta.json().then(function (cruda) {
        configuracion = normalizar(cruda);
        guardar(configuracion ? cruda : null);
      });
    }).catch(function () { /* sin señal o archivo dañado: sigue lo último que se vio */ })
      .then(pintar);
  }

  /* ---------------------------------------------------------
     Fase y textos
     --------------------------------------------------------- */

  function fase() {
    if (!configuracion) return 'ninguna';
    if (window.location.origin === configuracion.nueva) return 'ninguna';
    const ahora = Date.now();
    if (ahora < configuracion.corte) return 'aviso';
    if (ahora < configuracion.apertura) return 'cerrada';
    return 'mudada';
  }

  function cerrada() {
    const f = fase();
    return f === 'cerrada' || f === 'mudada';
  }

  /* «el viernes 27 de noviembre a las 4:00 p. m.», en la hora de Colombia. */
  function cuando(instante) {
    const partes = {};
    new Intl.DateTimeFormat('es-CO', {
      timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit', hour12: true
    }).formatToParts(new Date(instante)).forEach(function (parte) { partes[parte.type] = parte.value; });
    const periodo = String(partes.dayPeriod || '').replace(/\s+/g, ' ').trim();
    const hora = partes.hour + ':' + partes.minute + (periodo ? ' ' + periodo : '');
    return 'el ' + partes.weekday + ' ' + partes.day + ' de ' + partes.month +
      (partes.hour === '1' ? ' a la ' : ' a las ') + hora;
  }

  function cantidad(n, uno, varios) { return n === 1 ? '1 ' + uno : n + ' ' + varios; }

  /* Qué decir en esta página ahora. Devuelve null si no hay nada que decir. */
  function contenido(pagina) {
    const f = fase();
    if (f === 'ninguna') return null;
    const c = configuracion;

    if (f === 'aviso') {
      if (avisoCerrado()) return null;
      return {
        tono: 'aviso',
        titulo: 'La aplicación cambia de dirección',
        textos: [c.mensaje || ('Desde ' + cuando(c.corte) + ' se usará en ' + c.host +
          ', con el mismo usuario y contraseña. Antes de esa hora termine sus borradores y suba todas ' +
          'sus fichas: lo que quede en este equipo no pasa solo a la dirección nueva.')],
        acciones: [{ tipo: 'cerrar', texto: 'Entendido' }]
      };
    }

    const mudada = f === 'mudada';
    const salida = {
      tono: 'fuerte',
      titulo: mudada ? 'La aplicación se mudó a ' + c.host : 'La aplicación se está mudando',
      textos: [],
      pendientes: [],
      pasos: [],
      acciones: []
    };
    const abre = mudada ? '' : 'Desde ' + cuando(c.apertura) + ' se usará en ' + c.host + ', con el mismo usuario y contraseña. ';

    if (pagina === 'instalar') {
      salida.titulo = mudada ? 'No instale esta: la aplicación se mudó' : 'La aplicación se está mudando';
      salida.textos.push(mudada
        ? 'Instálela desde ' + c.host + '. Si ya tiene esta instalada, suba primero todas sus fichas y después desinstálela.'
        : abre + 'Desde esa hora se instala allá.');
      if (mudada) salida.acciones.push({ tipo: 'enlace', texto: 'Instalar desde ' + c.host, ruta: '/instalar' });
      return salida;
    }

    if (pagina === 'acceso') {
      salida.textos.push(mudada
        ? 'Entre en ' + c.host + ' con el mismo usuario y contraseña. Aquí ya no se hacen fichas nuevas.'
        : abre + 'Aquí ya no se hacen fichas nuevas.');
      const sinSubir = window.PWA && typeof window.PWA.fichasSinSubir === 'function' ? window.PWA.fichasSinSubir() : 0;
      if (sinSubir > 0) {
        salida.pendientes.push('En este equipo hay ' + cantidad(sinSubir, 'ficha sin subir', 'fichas sin subir') +
          ': quien la capturó debe entrar aquí y subirla antes de cambiar.');
      }
      if (mudada) salida.acciones.push({ tipo: 'enlace', texto: 'Ir a ' + c.host, ruta: '/' });
      return salida;
    }

    /* La aplicación: depende de lo que haya en este equipo. */
    const s = estadoSincronia;
    if (!s) {
      salida.textos.push(abre + 'Revisando lo que hay en este equipo…');
      return salida;
    }
    if (s.pendientes > 0) {
      salida.pendientes.push('Antes de cambiar, suba ' + (s.pendientes === 1 ? 'su ficha' : 'sus ' + s.pendientes + ' fichas') +
        ': sólo está' + (s.pendientes === 1 ? '' : 'n') + ' en este equipo.');
      salida.acciones.push({
        tipo: 'subir',
        texto: s.estado === 'subiendo' ? 'Subiendo…' : s.estado === 'sin-red' ? 'Esperando señal' : 'Subir ahora',
        deshabilitado: s.estado === 'subiendo' || s.estado === 'sin-red'
      });
    }
    if (s.conOtraLlave) {
      salida.pendientes.push('Falta abrir lo que guardó con su contraseña anterior: en Inicio, «Abrir».');
    }
    if (s.ajenas > 0) {
      salida.pendientes.push('En este equipo también hay fichas de otras personas sin subir: cada una debe entrar aquí ' +
        'con su usuario y subirlas.');
    }
    const todoArriba = s.pendientes === 0 && !s.conOtraLlave;
    if (todoArriba && mudada) {
      salida.textos.push('Todo lo suyo está en la base. Desde ahora trabaje en ' + c.host + ', con el mismo usuario y contraseña.');
      salida.pasos = [
        'Abra la dirección nueva con señal y entre.',
        'Instálela desde allá (página Instalar).',
        'Cuando diga que quedó lista para trabajar sin señal, desinstale esta.'
      ];
      salida.acciones.push({ tipo: 'enlace', texto: 'Ir a ' + c.host, ruta: '/' });
    } else if (todoArriba) {
      salida.textos.push(abre + 'Todo lo suyo ya está en la base.');
    } else if (!mudada) {
      salida.textos.unshift(abre);
    }
    salida.textos.push('Aquí ya no se pueden empezar fichas nuevas.');
    return salida;
  }

  function avisoCerrado() {
    try { return window.sessionStorage.getItem(CLAVE_AVISO_CERRADO) === String(configuracion.corte); } catch (error) { return false; }
  }

  function cerrarAviso() {
    try { window.sessionStorage.setItem(CLAVE_AVISO_CERRADO, String(configuracion.corte)); } catch (error) { /* se cierra sólo en pantalla */ }
    pintar();
  }

  /* ---------------------------------------------------------
     Pintar
     --------------------------------------------------------- */

  function paginaActual() {
    const cuerpo = document.body;
    if (!cuerpo) return null;
    if (cuerpo.classList.contains('cuerpo-acceso')) return 'acceso';
    if (cuerpo.classList.contains('cuerpo-instalar')) return 'instalar';
    if (document.getElementById('view-inicio')) return 'aplicacion';
    return null;
  }

  function lugar(pagina) {
    if (pagina === 'acceso') return { padre: document.querySelector('.puerta__acceso'), antes: 'primero' };
    if (pagina === 'instalar') {
      const cabecera = document.querySelector('.instalar__cabecera');
      return { padre: cabecera ? cabecera.parentNode : null, despuesDe: cabecera };
    }
    return { padre: document.querySelector('.app-main'), antes: 'primero' };
  }

  function elemento(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  function construir(datos) {
    const caja = elemento('section', 'mudanza mudanza--' + datos.tono);
    caja.id = 'mudanza';
    caja.setAttribute('role', datos.tono === 'fuerte' ? 'alert' : 'status');
    caja.setAttribute('aria-label', 'Cambio de dirección de la aplicación');

    const titulo = elemento('h2', 'mudanza__titulo');
    const icono = elemento('i', 'ph ' + (datos.tono === 'fuerte' ? 'ph-truck' : 'ph-megaphone'));
    icono.setAttribute('aria-hidden', 'true');
    titulo.appendChild(icono);
    titulo.appendChild(document.createTextNode(datos.titulo));
    caja.appendChild(titulo);

    datos.textos.filter(Boolean).forEach(function (t) { caja.appendChild(elemento('p', 'mudanza__texto', t.trim())); });
    (datos.pendientes || []).forEach(function (t) { caja.appendChild(elemento('p', 'mudanza__pendiente', t)); });
    if (datos.pasos && datos.pasos.length) {
      const lista = elemento('ol', 'mudanza__pasos');
      datos.pasos.forEach(function (t) { lista.appendChild(elemento('li', '', t)); });
      caja.appendChild(lista);
    }

    if (datos.acciones.length) {
      const acciones = elemento('div', 'mudanza__acciones');
      datos.acciones.forEach(function (accion) {
        let nodo;
        if (accion.tipo === 'enlace') {
          nodo = elemento('a', 'mudanza__boton', accion.texto);
          nodo.href = configuracion.nueva + accion.ruta;
          nodo.rel = 'noopener';
          nodo.target = '_blank';
        } else {
          nodo = elemento('button', 'mudanza__boton' + (accion.tipo === 'cerrar' ? ' mudanza__boton--suave' : ''), accion.texto);
          nodo.type = 'button';
          nodo.disabled = Boolean(accion.deshabilitado);
          nodo.addEventListener('click', accion.tipo === 'cerrar' ? cerrarAviso : subirAhora);
        }
        nodo.dataset.accion = accion.tipo;
        acciones.appendChild(nodo);
      });
      caja.appendChild(acciones);
    }
    return caja;
  }

  function pintar() {
    const pagina = paginaActual();
    if (!pagina) return;
    const datos = contenido(pagina);
    const firma = datos ? JSON.stringify(datos) : '';
    const actual = document.getElementById('mudanza');
    /* Mismo contenido: no se toca, para no hacer parpadear un botón bajo el dedo. */
    if (firma === firmaPintada && (actual !== null) === Boolean(datos)) return;
    firmaPintada = firma;
    if (actual) actual.remove();
    if (!datos) return;

    const donde = lugar(pagina);
    if (!donde.padre) return;
    const caja = construir(datos);
    if (donde.despuesDe) donde.padre.insertBefore(caja, donde.despuesDe.nextSibling);
    else donde.padre.insertBefore(caja, donde.padre.firstChild);
  }

  function subirAhora() {
    if (typeof window.sincronizarEncuestas === 'function') window.sincronizarEncuestas();
  }

  /* ---------------------------------------------------------
     Lo que llama la aplicación
     --------------------------------------------------------- */

  function avisarQueNoSeEmpiezan() {
    const c = configuracion;
    const texto = fase() === 'mudada'
      ? 'Las fichas nuevas ya no se hacen aquí: entre en ' + c.host + '.'
      : 'Las fichas nuevas ya no se hacen aquí: desde ' + cuando(c.apertura) + ' se hacen en ' + c.host + '.';
    if (typeof window.mostrarAvisoBreve === 'function') window.mostrarAvisoBreve(texto, 'warning');
    const caja = document.getElementById('mudanza');
    if (caja && typeof caja.scrollIntoView === 'function') caja.scrollIntoView({ block: 'start' });
  }

  /* Abrir el formulario: sí para terminar lo que está en pantalla (una ficha
     empezada, un borrador retomado, una corrección); no para una en blanco. */
  function permiteEntrarAlFormulario() {
    if (!cerrada()) return true;
    const enPantalla = (typeof window.fichaTieneDatos === 'function' && window.fichaTieneDatos()) ||
      (typeof encuestaEnCorreccion !== 'undefined' && Boolean(encuestaEnCorreccion));
    if (enPantalla) return true;
    avisarQueNoSeEmpiezan();
    return false;
  }

  /* «Empezar otra» siempre deja el formulario en blanco. */
  function permiteFichaNueva() {
    if (!cerrada()) return true;
    avisarQueNoSeEmpiezan();
    return false;
  }

  /* renderizarEstadoSync() (app.js) cuenta lo de este equipo; aquí se reusa. */
  function alCambiarSincronia(estado) {
    estadoSincronia = estado ? {
      estado: String(estado.estado || ''),
      pendientes: Number(estado.pendientes) || 0,
      ajenas: Number(estado.ajenas) || 0,
      conOtraLlave: Boolean(estado.conOtraLlave)
    } : null;
    pintar();
  }

  function iniciar() {
    pintar();
    consultar(true);
    window.setInterval(pintar, CADA_MINUTO_MS);
    window.addEventListener('online', function () { consultar(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { consultar(false); pintar(); }
    });
  }

  window.MUDANZA = {
    fase: fase,
    permiteEntrarAlFormulario: permiteEntrarAlFormulario,
    permiteFichaNueva: permiteFichaNueva,
    alCambiarSincronia: alCambiarSincronia,
    consultar: consultar,
    pintar: pintar
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
