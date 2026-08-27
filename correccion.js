/* =========================================================================
   Encuesta_APS — Corrección de una ficha ya guardada
   -------------------------------------------------------------------------
   POR QUÉ EXISTE

   Hasta ahora, una ficha que el servidor rechazaba quedaba atrapada: vivía en
   el historial del dispositivo, fallaba en cada sincronización y no había
   forma de arreglarla. El historial sólo ofrecía «Ver» y «Eliminar», así que
   corregir un dato costaba volver a diligenciar la visita entera —doscientos
   y pico campos— o perderla.

   Esto cierra ese hueco: «Corregir» devuelve la ficha al formulario, con
   todas sus respuestas puestas, para arreglar lo que haga falta y volver a
   guardar. La ficha no se duplica; se reemplaza la que ya estaba.

   CÓMO FUNCIONA

   El formulario y el modelo comparten los nombres: el campo
   `familias[0].integrantes[1].peso` produce la clave del mismo nombre. Cargar
   es, entonces, recorrer el objeto al revés. Lo que no es automático es la
   estructura —cuántas familias, cuántos integrantes, cuántas filas de plan—,
   que hay que recrear antes de poder poner nada.

   El orden importa en dos sentidos:

     1. Sin consentimiento, el `fieldset` de captura está deshabilitado y
        ningún otro campo admite valores. Va primero.
     2. Hay listas que se pueblan al elegir otra —el microterritorio depende
        del territorio—, así que los valores se aplican en dos pasadas: en la
        segunda ya existen las opciones que la primera no encontró.
   ========================================================================= */

'use strict';

/* Ficha que se está corrigiendo. `null` cuando se captura una nueva. */
let encuestaEnCorreccion = null;

/* =========================================================
   1. ENTRADA Y SALIDA DEL MODO CORRECCIÓN
   ========================================================= */

function abrirCorreccionDeEncuesta(id) {
  const encuesta = obtenerEncuestas().find(function (e) { return e.id === id; });

  if (!encuesta) {
    mostrarNotificacion('No se encontró la encuesta que se quiere corregir.', 'error');
    return;
  }

  cambiarVista('nueva');
  cargarEncuestaEnFormulario(encuesta);

  encuestaEnCorreccion = id;
  mostrarAvisoDeCorreccion(encuesta);

  mostrarNotificacion(
    'Ficha ' + (encuesta.codigoFicha || '') + ' cargada para corregir. ' +
    'Ajuste lo necesario y vuelva a guardar.', 'info');
}

function salirDeCorreccion() {
  encuestaEnCorreccion = null;
  const aviso = document.getElementById('avisoCorreccion');
  if (aviso) aviso.hidden = true;
}

/** Cinta superior que recuerda que no se está capturando una visita nueva. */
function mostrarAvisoDeCorreccion(encuesta) {
  let aviso = document.getElementById('avisoCorreccion');

  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'avisoCorreccion';
    aviso.className = 'aviso-correccion';

    const texto = document.createElement('span');
    texto.id = 'avisoCorreccionTexto';

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'btn btn--ghost btn--icon';
    cancelar.textContent = 'Cancelar corrección';
    cancelar.addEventListener('click', function () {
      salirDeCorreccion();
      document.getElementById('encuestaForm').reset();
      reiniciarEstadoFormulario();
      cambiarVista('historial');
    });

    aviso.appendChild(texto);
    aviso.appendChild(cancelar);

    const formulario = document.getElementById('encuestaForm');
    formulario.parentNode.insertBefore(aviso, formulario);
  }

  document.getElementById('avisoCorreccionTexto').textContent =
    'Corrigiendo la ficha ' + (encuesta.codigoFicha || encuesta.id) +
    '. Al guardar se reemplaza el registro existente, no se crea uno nuevo.';
  aviso.hidden = false;
}

/* =========================================================
   2. CARGA DE LA FICHA EN EL FORMULARIO
   ========================================================= */

function cargarEncuestaEnFormulario(encuesta) {
  const formulario = document.getElementById('encuestaForm');

  formulario.reset();
  reiniciarEstadoFormulario();

  /* Los planes se guardan colgados de su familia o su integrante; el
     formulario los pinta en listas aparte. Hay que deshacer ese enrutado
     antes de poder colocarlos. */
  const planes = desenrutarPlanes(encuesta);

  prepararEstructura(encuesta, planes);

  /* El consentimiento va primero y solo: mientras esté sin responder, el
     `fieldset` de captura ignora cualquier valor que se le ponga. */
  aplicarValorEnFormulario(formulario, 'consentimiento', encuesta.consentimiento || 'si');
  aplicarBloqueoPorConsentimiento();

  const valores = aplanarEncuesta(encuesta, planes);

  /* Varias pasadas, mientras la anterior haya colocado algo. Hay dos motivos
     por los que un valor no entra a la primera y sí a la siguiente: la lista
     todavía no tiene sus opciones —el microterritorio depende del territorio—
     o el control nace deshabilitado hasta que se responde el campo que lo
     gobierna —la EAPB hasta el régimen, el número de perros hasta marcar
     "perros"—. Repetir mientras haya avance es más robusto que declarar a mano
     qué campo depende de cuál, y termina solo cuando lo que queda no lo
     admite ningún control. */
  let pendientes = aplicarValores(formulario, valores);
  let anteriores = valores.length;

  while (pendientes.length > 0 && pendientes.length < anteriores) {
    anteriores = pendientes.length;
    pendientes = aplicarValores(formulario, pendientes);
  }

  restaurarDireccion(encuesta.direccionComponentes);
  restaurarProcedenciaDeCoordenadas(encuesta);

  recalcularFormularioCompleto();
  actualizarTableroDeRiesgo(recolectarDatosFormulario(formulario));

  document.getElementById('seccion-1').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* --- 2.1 Estructura repetible ------------------------------------------ */

function prepararEstructura(encuesta, planes) {
  const familias = encuesta.familias || [];

  ajustarBloques('#contenedorFamilias', '[data-bloque="familia"]', 'familia', familias.length);

  document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]')
    .forEach(function (bloqueFamilia, i) {
      const contenedor = bloqueFamilia.querySelector('[data-rol="contenedorIntegrantes"]');
      const cuantos = (familias[i] && familias[i].integrantes) ? familias[i].integrantes.length : 1;
      ajustarBloquesEn(contenedor, '[data-bloque="integrante"]', 'integrante', cuantos);
    });

  ajustarBloques('#contenedorPlanFamilia', '[data-bloque="planFamilia"]', 'planFamilia',
    Math.max(planes.planesFamilia.length, 1));
  ajustarBloques('#contenedorPlanPersona', '[data-bloque="planPersona"]', 'planPersona',
    Math.max(planes.planesPersona.length, 1));

  /* Filas de acciones y seguimientos, plan por plan. */
  ajustarFilasDePlan(document.querySelector('#seccion-6-1').closest('.card'), encuesta.planVivienda);

  document.querySelectorAll('#contenedorPlanFamilia > [data-bloque="planFamilia"]')
    .forEach(function (bloque, i) { ajustarFilasDePlan(bloque, planes.planesFamilia[i]); });

  document.querySelectorAll('#contenedorPlanPersona > [data-bloque="planPersona"]')
    .forEach(function (bloque, i) { ajustarFilasDePlan(bloque, planes.planesPersona[i]); });

  renumerarFormulario();
  actualizarSelectoresDePlan();
}

function ajustarBloques(selectorContenedor, selectorBloque, clavePrototipo, cuantos) {
  ajustarBloquesEn(document.querySelector(selectorContenedor), selectorBloque, clavePrototipo, cuantos);
}

/** Deja exactamente `cuantos` bloques, agregando o quitando los que sobren. */
function ajustarBloquesEn(contenedor, selectorBloque, clavePrototipo, cuantos) {
  if (!contenedor) return;

  const objetivo = Math.max(cuantos, 1);
  let bloques = contenedor.querySelectorAll(':scope > ' + selectorBloque);

  for (let i = bloques.length; i < objetivo; i++) {
    const clon = crearDesdePrototipo(clavePrototipo);
    if (clon) contenedor.appendChild(clon);
  }

  bloques = contenedor.querySelectorAll(':scope > ' + selectorBloque);
  for (let i = bloques.length - 1; i >= objetivo; i--) bloques[i].remove();
}

/** Ajusta las filas de acciones y seguimientos de un bloque de plan. */
function ajustarFilasDePlan(ambito, plan) {
  if (!ambito || !plan) return;

  [['accion', 'filaAccion', plan.acciones],
   ['seguimiento', 'filaSeguimiento', plan.seguimientos]].forEach(function (par) {
    const marca = par[0];
    const prototipo = par[1];
    const cuantas = Array.isArray(par[2]) ? par[2].length : 0;
    if (cuantas === 0) return;

    const fila = ambito.querySelector('tr[data-fila="' + marca + '"]');
    if (!fila) return;
    const cuerpo = fila.parentElement;

    let filas = cuerpo.querySelectorAll('tr[data-fila="' + marca + '"]');
    for (let i = filas.length; i < cuantas; i++) {
      const clon = crearDesdePrototipo(prototipo);
      if (clon) cuerpo.appendChild(clon);
    }
    filas = cuerpo.querySelectorAll('tr[data-fila="' + marca + '"]');
    for (let i = filas.length - 1; i >= cuantas; i--) filas[i].remove();
  });
}

/* --- 2.2 Del modelo a los nombres del formulario ----------------------- */

/**
 * Deshace el enrutado de `enrutarPlanes`: los planes vuelven a ser listas
 * planas con la referencia que el formulario usa para atarlos.
 */
function desenrutarPlanes(encuesta) {
  const planesFamilia = [];
  const planesPersona = [];

  (encuesta.familias || []).forEach(function (familia, i) {
    if (familia && familia.planFamilia) {
      planesFamilia.push(Object.assign({}, familia.planFamilia, { familiaRef: String(i) }));
    }
    ((familia && familia.integrantes) || []).forEach(function (integrante, j) {
      if (integrante && integrante.planPersona) {
        planesPersona.push(Object.assign({}, integrante.planPersona,
          { integranteRef: i + ':' + j }));
      }
    });
  });

  return { planesFamilia: planesFamilia, planesPersona: planesPersona };
}

/* Claves que no corresponden a ningún control: metadatos de la ficha o
   valores que el propio formulario recalcula. Ponerlas sería inofensivo pero
   ensucia el diagnóstico de lo que no se pudo aplicar. */
const CLAVES_NO_EDITABLES = [
  'id', 'fechaRegistro', 'fechasModificacion', 'sincronizada',
  'departamento', 'municipio', 'microterritorioNombre', 'comuna',
  'direccion', 'direccionLegible', 'direccionComponentes', 'direccionNormalizada',
  'consultaGeocodificacion', 'origenCoordenadas', 'precisionCoordenadas',
  'referenciaCoordenadas', 'personasPorHabitacion', 'hacinamiento',
  'riesgoFamiliar', 'alertas', 'edadTexto', 'imc', 'planFamilia', 'planPersona',
  'consentimiento'
];

function aplanarEncuesta(encuesta, planes) {
  const salida = [];

  const copia = Object.assign({}, encuesta, {
    planesFamilia: planes.planesFamilia,
    planesPersona: planes.planesPersona
  });

  aplanar(copia, '', salida);
  return salida;
}

function aplanar(objeto, prefijo, salida) {
  Object.keys(objeto).forEach(function (clave) {
    if (CLAVES_NO_EDITABLES.indexOf(clave) !== -1) return;

    const valor = objeto[clave];
    if (valor === null || valor === undefined) return;

    const ruta = prefijo ? prefijo + '.' + clave : clave;

    if (Array.isArray(valor)) {
      /* Una lista de objetos es una colección repetible —integrantes,
         acciones—; una de textos es una selección múltiple. */
      if (valor.length > 0 && typeof valor[0] === 'object') {
        valor.forEach(function (item, i) {
          if (item && typeof item === 'object') aplanar(item, ruta + '[' + i + ']', salida);
        });
      } else if (valor.length > 0) {
        salida.push({ nombre: ruta, valor: valor });
      }
      return;
    }

    if (typeof valor === 'object') {
      aplanar(valor, ruta, salida);
      return;
    }

    salida.push({ nombre: ruta, valor: valor });
  });
}

/* --- 2.3 Aplicación sobre los controles -------------------------------- */

/** @returns {Array} los pares que ningún control aceptó, para reintentarlos. */
function aplicarValores(formulario, pares) {
  const pendientes = [];

  pares.forEach(function (par) {
    if (!aplicarValorEnFormulario(formulario, par.nombre, par.valor)) {
      pendientes.push(par);
    }
  });

  return pendientes;
}

function aplicarValorEnFormulario(formulario, nombre, valor) {
  const controles = formulario.querySelectorAll('[name="' + nombre + '"]');
  if (controles.length === 0) return false;

  const primero = controles[0];

  if (primero.type === 'checkbox' || primero.type === 'radio') {
    const buscados = (Array.isArray(valor) ? valor : [valor]).map(String);
    let alguno = false;

    controles.forEach(function (control) {
      const marcado = buscados.indexOf(control.value) !== -1;
      if (marcado) alguno = true;
      if (control.checked !== marcado) {
        control.checked = marcado;
        dispararCambio(control);
      }
    });

    /* Una casilla suelta guarda `true`/`false`, no un valor de catálogo. */
    if (!alguno && controles.length === 1 && primero.type === 'checkbox') {
      primero.checked = valor === true || valor === 'true' || valor === 'si';
      dispararCambio(primero);
      return true;
    }

    return alguno;
  }

  /* Los derivados los recalcula el formulario; escribirlos sería pisar el
     cálculo con un valor que puede haber quedado viejo. */
  if (primero.readOnly) return true;

  /* Deshabilitado no es «este dato no va»: es «todavía no». El control se abre
     cuando se responda el campo que lo gobierna, así que el valor se devuelve
     como pendiente para la pasada siguiente. Darlo por aplicado era perderlo
     en silencio. */
  if (primero.disabled) return false;

  const texto = String(valor);

  /* Un <select> sólo acepta lo que tiene: si la opción aún no está —porque
     depende de otra lista— se devuelve como pendiente para la segunda pasada. */
  if (primero.tagName === 'SELECT') {
    const existe = Array.prototype.some.call(primero.options, function (o) {
      return o.value === texto;
    });
    if (!existe) return false;
  }

  primero.value = texto;
  dispararCambio(primero);
  return true;
}

function dispararCambio(control) {
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

/* --- 2.4 Procedencia de las coordenadas (ítem 22) ---------------------- */

/**
 * De dónde salieron la latitud y la longitud —geocodificación, GPS o dígito
 * del encuestador— no tiene control en el formulario: vive en variables del
 * módulo que `reiniciarEstadoFormulario` deja en blanco, y reponer los campos
 * de coordenadas las marca como digitadas a mano. Sin esto, corregir una tilde
 * degradaba a «manual» una ubicación que se había geocodificado, y con ella se
 * perdían la precisión y la referencia del servicio.
 *
 * También se cancela la geocodificación pendiente: recomponer la dirección
 * programó una consulta, y su respuesta llegaría a pisar lo que acabamos de
 * reponer.
 */
function restaurarProcedenciaDeCoordenadas(encuesta) {
  clearTimeout(temporizadorGeocodificacion);

  origenCoordenadas = encuesta.origenCoordenadas || null;
  precisionCoordenadas = encuesta.precisionCoordenadas === undefined
    ? null : encuesta.precisionCoordenadas;
  referenciaCoordenadas = encuesta.referenciaCoordenadas || null;

  if (referenciaCoordenadas) {
    establecerEstadoGeo('Coordenadas de la ficha guardada: ' + referenciaCoordenadas);
  } else if (origenCoordenadas === 'gps') {
    establecerEstadoGeo('Coordenadas tomadas del dispositivo en la visita.');
  } else if (origenCoordenadas === 'manual') {
    establecerEstadoGeo('Coordenadas digitadas manualmente.');
  }
}

/* --- 2.5 Dirección (ítem 21) ------------------------------------------- */

/**
 * La dirección no viaja como un campo sino como sus componentes, y el modo
 * —urbana o rural— decide cuáles de ellos están visibles. Se restaura el modo
 * primero, para que los campos existan cuando se les ponga el valor.
 */
function restaurarDireccion(componentes) {
  if (!componentes) return;

  if (componentes.modo) {
    modoDireccionElegidoManualmente = true;
    seleccionarModoDireccion(componentes.modo);
    aplicarModoDireccion();
  }

  const simples = ['viaTipo', 'viaNumero', 'viaLetra', 'viaLetraBis', 'viaCuadrante',
    'genNumero', 'genLetra', 'genCuadrante', 'placa',
    'ruralViaTipo', 'ruralViaNombre', 'ruralKm',
    'ruralPredioTipo', 'ruralPredioNombre', 'ruralSector'];

  simples.forEach(function (id) {
    const campo = document.getElementById(id);
    if (!campo || componentes[id] === undefined || componentes[id] === null) return;
    campo.value = componentes[id];
    dispararCambio(campo);
  });

  const bis = document.getElementById('viaBis');
  if (bis) {
    bis.checked = componentes.viaBis === true;
    dispararCambio(bis);
  }

  reiniciarComplementos();
  (componentes.complementos || []).forEach(function (complemento) {
    agregarFilaComplemento();
    const filas = document.getElementById('complementosDireccion')
      .querySelectorAll('.complemento-fila');
    const fila = filas[filas.length - 1];
    if (!fila) return;
    fila.querySelector('.complemento-tipo').value = complemento.tipo || '';
    fila.querySelector('.complemento-valor').value = complemento.valor || '';
  });

  actualizarVistaPreviaDireccion();
}
