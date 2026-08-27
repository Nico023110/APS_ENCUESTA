/* =========================================================
   Encuesta_APS — Lógica de la aplicación
   ---------------------------------------------------------
   Depende de: catalogos.js (listas parametrizadas)
               reglas.js   (motor de reglas de negocio)
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   1. CONSTANTES Y ESTADO GLOBAL
   --------------------------------------------------------- */
const STORAGE_KEY = 'aps_encuestas';

let encuestaSeleccionadaId = null; // usada por el modal de confirmación de eliminación

/* ---------------------------------------------------------
   2. UTILIDADES GENERALES
   --------------------------------------------------------- */

function generarId() {
  return 'enc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// Convierte cadenas numéricas (lat/long) a flotante; retorna null si no es válido.
function aFloatOrNull(valor) {
  if (valor === '' || valor === undefined || valor === null) return null;
  const normalizado = String(valor).replace(',', '.').trim();
  const numero = parseFloat(normalizado);
  return Number.isNaN(numero) ? null : numero;
}

function aIntOrNull(valor) {
  if (valor === '' || valor === undefined || valor === null) return null;
  const numero = parseInt(valor, 10);
  return Number.isNaN(numero) ? null : numero;
}

function valorOrNull(valor) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return '—';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function textoOguion(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textoSeguro(valor) {
  const texto = textoOguion(valor);
  return texto === '—' ? texto : escaparHtml(texto);
}

/* ---------------------------------------------------------
   3. CONSTRUCCIÓN DE CONTROLES A PARTIR DE CATÁLOGOS
   --------------------------------------------------------- */

function llenarSelect(idSelect, catalogo, opciones) {
  const config = opciones || {};
  const select = document.getElementById(idSelect);
  const placeholder = config.placeholder === undefined ? 'Seleccione...' : config.placeholder;

  const partes = [];
  if (placeholder !== null) partes.push('<option value="">' + placeholder + '</option>');

  catalogo.forEach(function (opcion) {
    partes.push(
      '<option value="' + escaparHtml(opcion.valor) + '"' + (opcion.valor === config.seleccionado ? ' selected' : '') + '>' +
        escaparHtml(opcion.etiqueta) +
      '</option>'
    );
  });

  select.innerHTML = partes.join('');
}

function llenarGrupoRadio(idContenedor, nombreCampo, catalogo) {
  const contenedor = document.getElementById(idContenedor);
  contenedor.innerHTML = catalogo.map(function (opcion) {
    return (
      '<label class="radio-pill">' +
        '<input type="radio" name="' + nombreCampo + '" value="' + escaparHtml(opcion.valor) + '"> ' +
        escaparHtml(opcion.etiqueta) +
      '</label>'
    );
  }).join('');
}

function llenarGrupoCasillas(idContenedor, nombreCampo, catalogo) {
  const contenedor = document.getElementById(idContenedor);
  contenedor.innerHTML = catalogo.map(function (opcion) {
    return (
      '<label class="check-pill' + (opcion.excluyente ? ' check-pill--excluyente' : '') + '">' +
        '<input type="checkbox" name="' + nombreCampo + '" value="' + escaparHtml(opcion.valor) + '"' +
          (opcion.excluyente ? ' data-excluyente="true"' : '') + '> ' +
        escaparHtml(opcion.etiqueta) +
      '</label>'
    );
  }).join('');
}

/* ---------------------------------------------------------
   Renderizado declarativo de catálogos.
   Cualquier elemento con data-catalogo se llena desde el catálogo
   indicado, sin necesidad de un id fijo. Es lo que permite clonar
   los bloques repetibles de familias e integrantes.
   Sólo presentación: la validación vive en reglas.js.
   --------------------------------------------------------- */

const CATALOGOS_DECLARATIVOS = {
  /* Se llena en marcha desde /api/catalogo_acciones; el arreglo se comparte
     por referencia, así que basta con repintar los selects al cargarlo. */
  CAT_ACCION_PLAN: CAT_ACCION_PLAN,
  CAT_SI_NO: CAT_SI_NO,
  CAT_SI_NO_NA: CAT_SI_NO_NA,
  CAT_UZPE: CAT_UZPE_VIGENTES,
  CAT_EAPB: CAT_EAPB,
  CAT_OCUPACION_CIUO: CAT_OCUPACION_CIUO,
  CAT_PRESTADOR: CAT_PRESTADOR,
  CAT_ANIMALES: CAT_ANIMALES,
  CAT_FUENTE_AGUA: CAT_FUENTE_AGUA,
  CAT_DISPOSICION_EXCRETAS: CAT_DISPOSICION_EXCRETAS,
  CAT_AGUAS_RESIDUALES: CAT_AGUAS_RESIDUALES,
  CAT_RESIDUOS_SOLIDOS: CAT_RESIDUOS_SOLIDOS,
  CAT_TIPO_FAMILIA: CAT_TIPO_FAMILIA,
  CAT_ZARIT: CAT_ZARIT,
  CAT_SITUACIONES_RIESGO_FAMILIAR: CAT_SITUACIONES_RIESGO_FAMILIAR,
  CAT_PRACTICAS_VINCULO: CAT_PRACTICAS_VINCULO,
  CAT_REDES_APOYO: CAT_REDES_APOYO,
  CAT_PRACTICAS_CUIDADO_HOGAR: CAT_PRACTICAS_CUIDADO_HOGAR,
  CAT_TIPO_ID_INTEGRANTE: CAT_TIPO_ID_INTEGRANTE,
  CAT_NACIONALIDAD: CAT_NACIONALIDAD,
  CAT_SEXO: CAT_SEXO,
  CAT_GENERO: CAT_GENERO,
  CAT_AUTOIDENTIFICACION_GENERO: CAT_AUTOIDENTIFICACION_GENERO,
  CAT_ORIENTACION_SEXUAL: CAT_ORIENTACION_SEXUAL,
  CAT_ROL_FAMILIAR: CAT_ROL_FAMILIAR,
  CAT_NIVEL_EDUCATIVO: CAT_NIVEL_EDUCATIVO,
  CAT_REGIMEN_AFILIACION: CAT_REGIMEN_AFILIACION,
  CAT_SUJETO_ESPECIAL_PROTECCION: CAT_SUJETO_ESPECIAL_PROTECCION,
  CAT_MODALIDAD_VIOLENCIA: CAT_MODALIDAD_VIOLENCIA,
  CAT_PERTENENCIA_ETNICA: CAT_PERTENENCIA_ETNICA,
  CAT_SABERES_ANCESTRALES: CAT_SABERES_ANCESTRALES,
  CAT_DISCAPACIDAD: CAT_DISCAPACIDAD,
  CAT_PRACTICAS_CUIDADO: CAT_PRACTICAS_CUIDADO,
  CAT_ATENCIONES_RPMS: CAT_ATENCIONES_RPMS,
  CAT_ATENCIONES_MATERNO: CAT_ATENCIONES_MATERNO,
  CAT_BARRERAS_ACCESO: CAT_BARRERAS_ACCESO,
  CAT_CONOCIMIENTO_DERECHO: CAT_CONOCIMIENTO_DERECHO,
  CAT_CLASIFICACION_ANTROPOMETRICA: CAT_CLASIFICACION_ANTROPOMETRICA,
  CAT_SIGNOS_DESNUTRICION: CAT_SIGNOS_DESNUTRICION,
  CAT_ENFERMEDADES_NO_TRANSMISIBLES: CAT_ENFERMEDADES_NO_TRANSMISIBLES,
  CAT_CONDICIONES_TRANSMISIBLES: CAT_CONDICIONES_TRANSMISIBLES,
  CAT_ZONA_ENDEMICA: CAT_ZONA_ENDEMICA,
  CAT_MOTIVO_NO_TRATAMIENTO: CAT_MOTIVO_NO_TRATAMIENTO,
  CAT_RIESGOS_SALUD_MENTAL_JOVEN: CAT_RIESGOS_SALUD_MENTAL_JOVEN,
  CAT_SINTOMATOLOGIA_DEPRESIVA: CAT_SINTOMATOLOGIA_DEPRESIVA,
  CAT_IDEACION_SUICIDA: CAT_IDEACION_SUICIDA,
  CAT_TIPO_ID_EJECUTOR: CAT_TIPO_ID_EJECUTOR,
  CAT_TIPO_RESPUESTA: CAT_TIPO_RESPUESTA,
  CAT_ESTADO_SEGUIMIENTO: CAT_ESTADO_SEGUIMIENTO
};

function opcionesSelectHtml(catalogo, placeholder) {
  const partes = [];
  if (placeholder !== null) partes.push('<option value="">' + (placeholder || 'Seleccione...') + '</option>');
  catalogo.forEach(function (opcion) {
    partes.push('<option value="' + escaparHtml(opcion.valor) + '">' + escaparHtml(opcion.etiqueta) + '</option>');
  });
  return partes.join('');
}

function pastillasHtml(catalogo, nombreCampo, tipo) {
  const esRadio = tipo === 'radio';
  return catalogo.map(function (opcion) {
    const clase = esRadio
      ? 'radio-pill'
      : 'check-pill' + (opcion.excluyente ? ' check-pill--excluyente' : '');
    return (
      '<label class="' + clase + '">' +
        '<input type="' + (esRadio ? 'radio' : 'checkbox') + '"' +
          ' name="' + escaparHtml(nombreCampo) + '"' +
          ' value="' + escaparHtml(opcion.valor) + '"' +
          (opcion.excluyente ? ' data-excluyente="true"' : '') + '> ' +
        escaparHtml(opcion.etiqueta) +
      '</label>'
    );
  }).join('');
}

function renderizarCatalogosDeclarativos(raiz) {
  const ambito = raiz || document;
  ambito.querySelectorAll('[data-catalogo]').forEach(function (elemento) {
    if (elemento.dataset.renderizado === 'si') return;

    const catalogo = CATALOGOS_DECLARATIVOS[elemento.dataset.catalogo];
    if (!catalogo) return;

    if (elemento.tagName === 'SELECT') {
      elemento.innerHTML = opcionesSelectHtml(catalogo, elemento.dataset.placeholder);
    } else {
      const nombre = elemento.dataset.name || '';
      // Un grupo de casillas puede comportarse como selección única (ítem 96).
      const esRadio = elemento.dataset.tipo === 'radio' || elemento.classList.contains('radio-group');
      elemento.innerHTML = pastillasHtml(catalogo, nombre, esRadio ? 'radio' : 'checkbox');
    }

    elemento.dataset.renderizado = 'si';
  });
}

/* ---------------------------------------------------------
   CATÁLOGO DE ACCIONES DEL PLAN (ítems 114, 124 y 136a)
   ---------------------------------------------------------
   Es el único catálogo que no viene en `catalogos.js`: son los códigos CUPS
   y NoCUPS de `cat.cups`, que cambian con cada actualización del catálogo
   oficial. Se pide al servidor y se guarda en el navegador, de modo que una
   visita sin señal siga ofreciendo la lista de la última vez.
   --------------------------------------------------------- */

const CLAVE_CACHE_ACCIONES = 'aps_catalogo_acciones';

/**
 * El catálogo de acciones ya no llena ningún desplegable: los ítems 114, 124 y
 * 136a se buscan contra la tabla conforme se escribe (ver `cups.js`). Sigue
 * descargándose porque es lo que permite seguir buscando sin señal, y al
 * llegar se repasan los códigos ya escritos: puede que uno que no se había
 * podido resolver tenga ahora nombre.
 */
function repintarSelectsDeAccion() {
  if (typeof resolverCombosCups === 'function') resolverCombosCups();
}

async function cargarCatalogoDeAcciones() {
  /* Primero lo guardado: la lista aparece de inmediato y sin depender de que
     la red conteste. */
  try {
    const cacheado = localStorage.getItem(CLAVE_CACHE_ACCIONES);
    if (cacheado) {
      fijarCatalogoAcciones(JSON.parse(cacheado));
      repintarSelectsDeAccion();
    }
  } catch (error) {
    console.warn('No fue posible leer el catálogo de acciones guardado:', error);
  }

  try {
    const respuesta = await fetch('/api/catalogo_acciones');
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

    const filas = await respuesta.json();
    if (!Array.isArray(filas) || filas.length === 0) throw new Error('catálogo vacío');

    fijarCatalogoAcciones(filas);
    localStorage.setItem(CLAVE_CACHE_ACCIONES, JSON.stringify(filas));
    repintarSelectsDeAccion();
  } catch (error) {
    /* Sin red y sin copia guardada el desplegable queda vacío. Se avisa, en
       vez de dejar al encuestador frente a una lista sin opciones y sin
       explicación. */
    if (CAT_ACCION_PLAN.length === 0) {
      console.error('No fue posible cargar el catálogo de acciones:', error);
      mostrarNotificacion(
        'No se pudo cargar el catálogo de acciones del plan de cuidado. ' +
        'Conéctese al menos una vez para descargarlo.', 'warning');
    }
  }
}

/* RN-222 — El cierre por causa externa exige registrar el motivo. */
function inicializarCierreIncompleto() {
  const casilla = document.getElementById('visitaIncompleta');
  const campo = document.getElementById('campoMotivoIncompleta');
  if (!casilla || !campo) return;

  casilla.addEventListener('change', function () {
    campo.hidden = !casilla.checked;
    if (!casilla.checked) document.getElementById('motivoVisitaIncompleta').value = '';
  });
}

/* Ayuda de revisión: revela los campos condicionados que en operación
   normal permanecen ocultos. No altera la captura ni las reglas. */
function inicializarModoRevision() {
  const interruptor = document.getElementById('modoRevision');
  const aviso = document.getElementById('avisoRevision');
  const formulario = document.getElementById('encuestaForm');
  if (!interruptor || !formulario) return;

  interruptor.addEventListener('change', function () {
    formulario.classList.toggle('revelar-condicionados', interruptor.checked);
    if (aviso) aviso.hidden = !interruptor.checked;
  });
}

function inicializarCatalogosDelFormulario() {
  // Bloques 4 a 12: se resuelven por data-catalogo, sin ids fijos.
  renderizarCatalogosDeclarativos(document);

  /* El catálogo de acciones vive en la base, no en `catalogos.js`. Se pide sin
     bloquear el arranque: los selects se repintan cuando llegue. */
  cargarCatalogoDeAcciones();

  // RN-005: entidad territorial fija (un único valor posible en cada select).
  llenarSelect('departamento', [{ valor: CAT_DEPARTAMENTO.codigo, etiqueta: CAT_DEPARTAMENTO.codigo + ' — ' + CAT_DEPARTAMENTO.nombre }],
    { placeholder: null, seleccionado: CAT_DEPARTAMENTO.codigo });
  llenarSelect('municipio', [{ valor: CAT_MUNICIPIO.codigo, etiqueta: CAT_MUNICIPIO.codigo + ' — ' + CAT_MUNICIPIO.nombre }],
    { placeholder: null, seleccionado: CAT_MUNICIPIO.codigo });

  llenarSelect('areaUbicacion', CAT_AREA_UBICACION);                 // RN-006
  llenarSelect('territorio', catalogoTerritorios());                 // RN-009
  llenarSelect('responsableTipoId', CAT_TIPO_ID_RESPONSABLE);        // RN-012
  llenarSelect('perfilProfesional', CAT_PERFIL_PROFESIONAL);         // RN-014
  llenarSelect('entornoAbordaje', CAT_ENTORNO);                      // RN-017
  llenarSelect('jovenesEnPaz', CAT_SI_NO);                           // RN-020
  llenarSelect('estrato', CAT_ESTRATO);                              // RN-027
  llenarSelect('tipoVivienda', CAT_TIPO_VIVIENDA);                   // RN-034
  llenarSelect('materialTecho', CAT_MATERIAL_TECHO);                 // RN-035

  llenarGrupoRadio('grupoSituacionInminente', 'situacionInminente', CAT_SITUACION_INMINENTE); // RN-002
  llenarGrupoRadio('grupoVectores', 'vectores', CAT_SI_NO_NA);                                // RN-037

  llenarGrupoCasillas('grupoRiesgosAccidente', 'riesgosAccidente', CAT_RIESGOS_ACCIDENTE);             // RN-036
  llenarGrupoCasillas('grupoFactoresContaminacion', 'factoresContaminacion', CAT_FACTORES_CONTAMINACION); // RN-038

  // RN-004: sólo se ofrecen las UZPE vigentes en el catálogo. Ofrecer las diez
  // hacía que el encuestador escogiera una que la base no acepta.
  llenarSelect('uzpe', CAT_UZPE_VIGENTES, { placeholder: null, seleccionado: UZPE_PREDETERMINADA });
  llenarSelect('fuenteAgua', CAT_FUENTE_AGUA);                       // RN-046
  llenarSelect('disposicionExcretas', CAT_DISPOSICION_EXCRETAS);     // RN-047
  llenarSelect('aguasResiduales', CAT_AGUAS_RESIDUALES);             // RN-048
  llenarSelect('residuosSolidos', CAT_RESIDUOS_SOLIDOS);             // RN-049

  llenarGrupoRadio('grupoActividadEconomica', 'actividadEconomica', CAT_SI_NO);       // RN-039
  llenarGrupoRadio('grupoCarnetAntirrabico', 'carnetAntirrabico', CAT_SI_NO_NA);      // RN-045
  llenarGrupoCasillas('grupoAnimales', 'animales', CAT_ANIMALES);                     // RN-040

  // RN-021 — componentes de la nomenclatura de dirección (ítem 21)
  llenarGrupoRadio('grupoModoDireccion', 'modoDireccion', CAT_MODO_DIRECCION);
  llenarSelect('viaTipo', CAT_TIPO_VIA, { placeholder: 'Tipo...' });
  llenarSelect('viaLetra', CAT_LETRAS, { placeholder: '—' });
  llenarSelect('viaLetraBis', CAT_LETRAS, { placeholder: '—' });
  llenarSelect('viaCuadrante', CAT_CUADRANTE, { placeholder: '—' });
  llenarSelect('genLetra', CAT_LETRAS, { placeholder: '—' });
  llenarSelect('genCuadrante', CAT_CUADRANTE, { placeholder: '—' });
  llenarSelect('ruralViaTipo', CAT_TIPO_VIA_RURAL, { placeholder: 'Tipo...' });
  llenarSelect('ruralPredioTipo', CAT_TIPO_PREDIO_RURAL, { placeholder: '—' });
}

function catalogoTerritorios() {
  return Object.keys(CAT_TERRITORIOS).map(function (codigo) {
    return { valor: codigo, etiqueta: etiquetaTerritorio(codigo) };
  });
}

/* ---------------------------------------------------------
   4. RN-001 — CONSENTIMIENTO INFORMADO Y BLOQUEO DE CAPTURA
   --------------------------------------------------------- */

function obtenerConsentimiento() {
  const seleccionado = document.querySelector('input[name="consentimiento"]:checked');
  return seleccionado ? seleccionado.value : null;
}

function aplicarBloqueoPorConsentimiento() {
  const consentimiento = obtenerConsentimiento();
  const bloqueado = consentimiento === 'no';

  document.getElementById('bloquesCaptura').disabled = bloqueado;
  document.getElementById('alertaConsentimiento').hidden = !bloqueado;
  document.getElementById('btnGuardar').disabled = bloqueado;

  if (bloqueado) {
    mostrarNotificacion('Sin consentimiento informado no es posible capturar datos (RN-001).', 'warning');
  }
}

/* ---------------------------------------------------------
   5. RN-002 — ALERTA DE ATENCIÓN PRIORITARIA
   --------------------------------------------------------- */

function actualizarAlertaSituacionInminente() {
  const seleccionado = document.querySelector('input[name="situacionInminente"]:checked');
  const valor = seleccionado ? seleccionado.value : null;
  const alerta = document.getElementById('alertaSituacion');

  if (!requiereAtencionPrioritaria(valor)) {
    alerta.hidden = true;
    return;
  }

  document.getElementById('alertaSituacionTexto').textContent =
    'Se registró: ' + etiquetaDeCatalogo(CAT_SITUACION_INMINENTE, valor) + '.';
  alerta.hidden = false;
}

/* ---------------------------------------------------------
   6. RN-009 — TERRITORIO → MICROTERRITORIO → COMUNA
   --------------------------------------------------------- */

function actualizarMicroterritorios() {
  const codigoTerritorio = document.getElementById('territorio').value;
  const selectMicro = document.getElementById('microterritorio');
  const campoComuna = document.getElementById('comuna');

  const microterritorios = CAT_TERRITORIOS[codigoTerritorio];

  if (!microterritorios) {
    selectMicro.innerHTML = '<option value="">Seleccione un territorio primero</option>';
    selectMicro.disabled = true;
    campoComuna.value = '';
    return;
  }

  llenarSelect('microterritorio', microterritorios.map(function (mt) {
    return { valor: mt.codigo, etiqueta: mt.codigo + ' — ' + mt.nombre };
  }));
  selectMicro.disabled = false;

  const comuna = comunaDeTerritorio(codigoTerritorio);
  campoComuna.value = comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna;
}

/* ---------------------------------------------------------
   7. RN-036 / RN-038 — GRUPOS CON OPCIÓN EXCLUYENTE "NINGUNO"
   --------------------------------------------------------- */

function inicializarGrupoExcluyente(idContenedor) {
  const contenedor = document.getElementById(idContenedor);

  contenedor.addEventListener('change', function (evento) {
    const casilla = evento.target;
    if (casilla.type !== 'checkbox') return;

    const casillas = Array.prototype.slice.call(contenedor.querySelectorAll('input[type="checkbox"]'));
    const esExcluyente = casilla.dataset.excluyente === 'true';

    if (esExcluyente && casilla.checked) {
      // "Ninguno" desmarca automáticamente el resto de opciones.
      casillas.forEach(function (otra) {
        if (otra !== casilla) otra.checked = false;
      });
      return;
    }

    if (!esExcluyente && casilla.checked) {
      // Marcar cualquier riesgo anula la opción "Ninguno".
      casillas.forEach(function (otra) {
        if (otra.dataset.excluyente === 'true') otra.checked = false;
      });
    }
  });
}

/* ---------------------------------------------------------
   8. CAMPOS CONDICIONADOS (RN-014 y RN-018)
   --------------------------------------------------------- */

function actualizarCampoPerfilOtro() {
  const esOtro = document.getElementById('perfilProfesional').value === 'otro';
  const contenedor = document.getElementById('contenedorPerfilOtro');
  contenedor.hidden = !esOtro;
  if (!esOtro) document.getElementById('perfilProfesionalOtro').value = '';
}

function actualizarCampoInstitucion() {
  const entorno = document.getElementById('entornoAbordaje').value;
  const esObligatorio = ENTORNOS_CON_INSTITUCION.indexOf(entorno) !== -1;
  document.getElementById('marcaInstitucion').textContent = esObligatorio ? '(obligatorio)' : '(no aplica en entorno Hogar)';
}

/* ---------------------------------------------------------
   9. RN-021 — DIRECCIÓN NORMALIZADA POR COMPONENTES (ítem 21)
   --------------------------------------------------------- */

const MAX_COMPLEMENTOS = 4;

// Se marca cuando el encuestador cambia el modo a mano, para no
// sobrescribir su decisión al modificar el ítem 6.
let modoDireccionElegidoManualmente = false;

function obtenerModoDireccion() {
  const seleccionado = document.querySelector('input[name="modoDireccion"]:checked');
  return seleccionado ? seleccionado.value : 'urbana';
}

function seleccionarModoDireccion(modo) {
  const radio = document.querySelector('input[name="modoDireccion"][value="' + modo + '"]');
  if (radio) radio.checked = true;
}

// El modo se sugiere a partir del ítem 6 (área de ubicación de la vivienda).
function sincronizarModoDireccionConArea() {
  if (modoDireccionElegidoManualmente) return;
  const area = document.getElementById('areaUbicacion').value;
  const modoSugerido = MODO_DIRECCION_POR_AREA[area];
  if (modoSugerido) seleccionarModoDireccion(modoSugerido);
  aplicarModoDireccion();
}

function aplicarModoDireccion() {
  const modo = obtenerModoDireccion();
  document.getElementById('panelDireccionUrbana').hidden = modo !== 'urbana';
  document.getElementById('panelDireccionRural').hidden = modo !== 'rural';

  const area = document.getElementById('areaUbicacion').value;
  const sugerido = MODO_DIRECCION_POR_AREA[area];
  document.getElementById('marcaModoDireccion').textContent =
    sugerido && sugerido !== modo ? '(el área seleccionada en el ítem 6 sugiere nomenclatura ' + sugerido + ')' : '';

  actualizarVistaPreviaDireccion();
}

/* --- Complementos: unidad, torre, interior, apartamento… --- */

function filaComplementoHtml() {
  const opciones = CAT_COMPLEMENTO.map(function (opcion) {
    return '<option value="' + escaparHtml(opcion.valor) + '">' + escaparHtml(opcion.etiqueta) + '</option>';
  }).join('');

  return (
    '<div class="complemento-fila">' +
      '<select class="complemento-tipo" aria-label="Tipo de complemento">' +
        '<option value="">Tipo...</option>' + opciones +
      '</select>' +
      '<input type="text" class="complemento-valor" maxlength="20" placeholder="N.° o nombre" aria-label="Valor del complemento">' +
      '<button type="button" class="btn btn--danger btn--icon complemento-quitar" aria-label="Quitar complemento">✕</button>' +
    '</div>'
  );
}

function agregarFilaComplemento() {
  const contenedor = document.getElementById('complementosDireccion');
  if (contenedor.querySelectorAll('.complemento-fila').length >= MAX_COMPLEMENTOS) {
    mostrarNotificacion('Se admiten máximo ' + MAX_COMPLEMENTOS + ' complementos de dirección.', 'warning');
    return;
  }
  contenedor.insertAdjacentHTML('beforeend', filaComplementoHtml());
  actualizarBotonComplemento();
}

function actualizarBotonComplemento() {
  const total = document.getElementById('complementosDireccion').querySelectorAll('.complemento-fila').length;
  document.getElementById('btnAgregarComplemento').disabled = total >= MAX_COMPLEMENTOS;
}

function leerComplementos() {
  const filas = document.getElementById('complementosDireccion').querySelectorAll('.complemento-fila');
  return Array.prototype.map.call(filas, function (fila) {
    return {
      tipo: fila.querySelector('.complemento-tipo').value,
      valor: fila.querySelector('.complemento-valor').value
    };
  });
}

function reiniciarComplementos() {
  document.getElementById('complementosDireccion').innerHTML = '';
  actualizarBotonComplemento();
}

/* --- Lectura y composición --- */

function recolectarComponentesDireccion() {
  const leer = function (id) { return document.getElementById(id).value; };

  return {
    modo: obtenerModoDireccion(),

    viaTipo: leer('viaTipo'),
    viaNumero: leer('viaNumero'),
    viaLetra: leer('viaLetra'),
    viaBis: document.getElementById('viaBis').checked,
    viaLetraBis: leer('viaLetraBis'),
    viaCuadrante: leer('viaCuadrante'),
    genNumero: leer('genNumero'),
    genLetra: leer('genLetra'),
    genCuadrante: leer('genCuadrante'),
    placa: leer('placa'),

    ruralViaTipo: leer('ruralViaTipo'),
    ruralViaNombre: leer('ruralViaNombre'),
    ruralKm: leer('ruralKm'),
    ruralPredioTipo: leer('ruralPredioTipo'),
    ruralPredioNombre: leer('ruralPredioNombre'),
    ruralSector: leer('ruralSector'),

    complementos: leerComplementos()
  };
}

function actualizarVistaPreviaDireccion() {
  const componentes = recolectarComponentesDireccion();
  const resultado = normalizarDireccion(componentes);

  document.getElementById('direccionCanonica').textContent = resultado.canonica || '—';
  document.getElementById('direccionLegible').textContent = resultado.legible || '—';

  const aviso = document.getElementById('direccionAviso');
  if (resultado.completa) {
    aviso.hidden = true;
  } else {
    aviso.textContent = 'Falta por diligenciar: ' + resultado.faltantes.join(', ') + '.';
    aviso.hidden = false;
  }

  document.getElementById('direccionResultado')
    .classList.toggle('is-completa', resultado.completa);

  programarGeocodificacion(resultado.completa);

  return resultado;
}

/* ---------------------------------------------------------
   10. ÍTEMS 22 Y 23 — COORDENADAS GEOGRÁFICAS
   Fuente principal: la dirección del ítem 21, geocodificada
   automáticamente. El GPS del dispositivo queda como respaldo.
   --------------------------------------------------------- */

let origenCoordenadas = null;    // 'geocodificacion' | 'gps' | 'manual'
let precisionCoordenadas = null; // metros (GPS) o nivel de precisión (geocodificación)
let referenciaCoordenadas = null;

let temporizadorGeocodificacion = null;
let ultimaConsultaGeocodificada = null;
const RETARDO_GEOCODIFICACION_MS = 900;

function establecerEstadoGeo(texto) {
  document.getElementById('geoEstado').textContent = texto || '';
}

function establecerAvisoGeo(texto) {
  const aviso = document.getElementById('geoAviso');
  if (!texto) {
    aviso.hidden = true;
    return;
  }
  aviso.textContent = texto;
  aviso.hidden = false;
}

/**
 * Programa la búsqueda automática de coordenadas cuando la dirección
 * queda completa. Se agrupa con un retardo para no consultar el
 * servicio en cada tecla.
 */
function programarGeocodificacion(direccionCompleta) {
  clearTimeout(temporizadorGeocodificacion);

  if (!direccionCompleta) return;

  temporizadorGeocodificacion = setTimeout(function () {
    geocodificarDesdeFormulario(false);
  }, RETARDO_GEOCODIFICACION_MS);
}

function geocodificarDesdeFormulario(forzar) {
  const componentes = recolectarComponentesDireccion();
  const via = textoViaParaGeocodificar(componentes);
  const ancla = textoAnclaParaGeocodificar(
    document.getElementById('divisionTerritorial').value,
    componentes
  );

  const firma = via + '||' + ancla;
  if (!forzar && firma === ultimaConsultaGeocodificada) return;

  if (!origenEsSeguro()) {
    establecerEstadoGeo('Sin coordenadas automáticas.');
    establecerAvisoGeo(
      'La búsqueda automática de coordenadas y el GPS requieren que la aplicación se abra ' +
      'desde un servidor (http://localhost o https://). Abierta con doble clic sobre el archivo, ' +
      'el navegador las bloquea. Digite las coordenadas manualmente o publique la aplicación.'
    );
    return;
  }

  ultimaConsultaGeocodificada = firma;
  establecerEstadoGeo('Buscando coordenadas de la dirección…');
  establecerAvisoGeo('');
  document.getElementById('btnGeocodificar').disabled = true;

  geocodificarDireccion(via, ancla)
    .then(function (resultado) {
      if (!resultado.encontrada) {
        establecerEstadoGeo('Dirección no ubicada.');
        establecerAvisoGeo(resultado.mensaje);
        return;
      }

      document.getElementById('latitud').value = resultado.latitud.toFixed(6);
      document.getElementById('longitud').value = resultado.longitud.toFixed(6);

      origenCoordenadas = 'geocodificacion';
      precisionCoordenadas = resultado.precision;
      referenciaCoordenadas = resultado.referencia || null;

      establecerEstadoGeo('Coordenadas obtenidas de la dirección (precisión: ' +
        (ETIQUETA_PRECISION[resultado.precision] || resultado.precision) + ').');
      establecerAvisoGeo(resultado.precision === 'via' ? '' : resultado.mensaje);
      actualizarAvisoCoordenadas();
    })
    .catch(function (error) {
      console.error('Falló la geocodificación:', error);
      // Un fallo de red no es una respuesta: se olvida la firma para que
      // el siguiente cambio en la dirección vuelva a intentarlo.
      ultimaConsultaGeocodificada = null;
      establecerEstadoGeo('No fue posible consultar el servicio.');
      establecerAvisoGeo(
        'No hay conexión con el servicio de geocodificación. Capture las coordenadas con el ' +
        'botón de GPS o digítelas manualmente.'
      );
    })
    .finally(function () {
      document.getElementById('btnGeocodificar').disabled = false;
    });
}

function capturarCoordenadasGps() {
  if (!origenEsSeguro()) {
    establecerEstadoGeo('GPS no disponible.');
    establecerAvisoGeo(
      'El navegador solo entrega la ubicación cuando la aplicación se sirve desde ' +
      'http://localhost o https://. Abierta con doble clic sobre el archivo, el GPS queda bloqueado.'
    );
    mostrarNotificacion('El GPS requiere abrir la aplicación desde un servidor local o https.', 'warning');
    return;
  }

  if (!navigator.geolocation) {
    establecerEstadoGeo('Este dispositivo o navegador no expone geolocalización.');
    mostrarNotificacion('El dispositivo no permite capturar coordenadas por GPS.', 'error');
    return;
  }

  establecerEstadoGeo('Obteniendo ubicación del dispositivo…');
  document.getElementById('btnCapturarGps').disabled = true;

  navigator.geolocation.getCurrentPosition(
    function (posicion) {
      document.getElementById('latitud').value = posicion.coords.latitude.toFixed(6);
      document.getElementById('longitud').value = posicion.coords.longitude.toFixed(6);

      origenCoordenadas = 'gps';
      precisionCoordenadas = posicion.coords.accuracy === null ? null : Math.round(posicion.coords.accuracy);
      referenciaCoordenadas = null;

      establecerEstadoGeo(precisionCoordenadas === null
        ? 'Coordenadas capturadas por GPS.'
        : 'Coordenadas capturadas por GPS (precisión ≈ ' + precisionCoordenadas + ' m).');

      document.getElementById('btnCapturarGps').disabled = false;
      establecerAvisoGeo('');
      actualizarAvisoCoordenadas();
      mostrarNotificacion('Coordenadas capturadas desde el dispositivo.', 'success');
    },
    function (error) {
      const motivos = {
        1: 'El usuario denegó el permiso de ubicación.',
        2: 'No fue posible determinar la ubicación (sin señal GPS).',
        3: 'Se agotó el tiempo de espera del GPS.'
      };
      establecerEstadoGeo(motivos[error.code] || 'No fue posible obtener la ubicación.');
      document.getElementById('btnCapturarGps').disabled = false;
      mostrarNotificacion('No se pudieron capturar las coordenadas. Digítelas manualmente.', 'warning');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

// Advertencia (no bloqueante): las coordenadas caen fuera del municipio.
function actualizarAvisoCoordenadas() {
  const latitud = aFloatOrNull(document.getElementById('latitud').value);
  const longitud = aFloatOrNull(document.getElementById('longitud').value);
  const aviso = document.getElementById('geoAviso');

  const dentro = coordenadasDentroDeCali(latitud, longitud);

  if (dentro === null || dentro === true) {
    aviso.hidden = true;
    return;
  }

  aviso.textContent = 'Las coordenadas registradas quedan por fuera del área aproximada de ' +
    CAT_MUNICIPIO.nombre + '. Verifique los valores antes de guardar.';
  aviso.hidden = false;
}

function marcarCoordenadasManuales() {
  origenCoordenadas = 'manual';
  precisionCoordenadas = null;
  referenciaCoordenadas = null;
  establecerEstadoGeo('Coordenadas digitadas manualmente.');
  actualizarAvisoCoordenadas();
}

/* ---------------------------------------------------------
   11. CÁLCULO AUTOMÁTICO — Hacinamiento (ítems 32 y 33)
   --------------------------------------------------------- */

// RN-032 y RN-033: el cálculo vive en reglas.js para que el umbral DANE
// (> 2 personas por habitación) sea único en toda la aplicación.
function calcularHacinamiento(personasEnVivienda, habitacionesVivienda) {
  return evaluarHacinamiento(personasEnVivienda, habitacionesVivienda);
}

function actualizarCalculoHacinamientoEnFormulario() {
  const personas = aIntOrNull(document.getElementById('personasEnVivienda').value);
  const habitaciones = aIntOrNull(document.getElementById('habitacionesVivienda').value);
  const resultado = calcularHacinamiento(personas, habitaciones);

  const campoPersonasPorHabitacion = document.getElementById('personasPorHabitacion');
  const badge = document.getElementById('hacinamientoBadge');

  if (resultado.personasPorHabitacion === null) {
    campoPersonasPorHabitacion.value = '';
    badge.textContent = 'Sin calcular';
    badge.className = 'badge badge--neutral';
    return;
  }

  campoPersonasPorHabitacion.value = resultado.personasPorHabitacion;

  if (resultado.hacinamiento === 'si') {
    badge.textContent = 'Sí — Hacinamiento crítico';
    badge.className = 'badge badge--danger';
  } else {
    badge.textContent = 'No';
    badge.className = 'badge badge--success';
  }
}

/* ---------------------------------------------------------
   10. PERSISTENCIA (localStorage)
   --------------------------------------------------------- */

function obtenerEncuestas() {
  const datos = localStorage.getItem(STORAGE_KEY);
  if (!datos) return [];
  try {
    return JSON.parse(datos);
  } catch (error) {
    console.error('No fue posible leer las encuestas almacenadas:', error);
    return [];
  }
}

function guardarEncuestas(encuestas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encuestas));
}

function agregarEncuesta(encuesta) {
  const encuestas = obtenerEncuestas();
  encuestas.unshift(encuesta);
  guardarEncuestas(encuestas);
}

/**
 * Sustituye una ficha por su versión corregida, en su mismo sitio del
 * historial y conservando su identidad: el registro es la misma visita, no
 * una nueva. Se deja constancia de la fecha de corrección.
 */
function reemplazarEncuesta(id, encuestaCorregida) {
  const encuestas = obtenerEncuestas();
  const indice = encuestas.findIndex(function (e) { return e.id === id; });

  if (indice === -1) {
    encuestas.unshift(encuestaCorregida);
    guardarEncuestas(encuestas);
    return;
  }

  const anterior = encuestas[indice];
  const fechas = (anterior.fechasModificacion || []).slice();
  fechas.push(new Date().toISOString());

  encuestas[indice] = Object.assign({}, encuestaCorregida, {
    id: anterior.id,
    fechaRegistro: anterior.fechaRegistro,
    fechasModificacion: fechas
  });

  guardarEncuestas(encuestas);
}

function eliminarEncuestaPorId(id) {
  const encuestas = obtenerEncuestas().filter(function (encuesta) {
    return encuesta.id !== id;
  });
  guardarEncuestas(encuestas);
}

function actualizarEncuesta(id, datosActualizados) {
  const encuestas = obtenerEncuestas();
  const indice = encuestas.findIndex(function(e) { return e.id === id; });
  if (indice !== -1) {
    const encuestaAntigua = encuestas[indice];
    const fechasModificacion = encuestaAntigua.fechasModificacion || [];
    fechasModificacion.push(new Date().toISOString());
    
    encuestas[indice] = Object.assign({}, encuestaAntigua, datosActualizados, {
      fechasModificacion: fechasModificacion,
      sincronizada: false
    });
    guardarEncuestas(encuestas);
  }
}

// Nueva función de sincronización con la API (Backend en Vercel)
async function sincronizarEncuestas() {
  const encuestasLocales = obtenerEncuestas();

  /* Sólo lo que falta por subir. Antes se reenviaba todo el historial en cada
     pulsación —incluidas las fichas ya guardadas en la base—, así que un
     rechazo antiguo volvía a contarse como error nuevo y el resumen final
     nunca reflejaba lo que acababa de pasar. */
  const pendientes = encuestasLocales.filter(function (e) { return e.sincronizada !== true; });

  if (pendientes.length === 0) {
    mostrarNotificacion(
      encuestasLocales.length === 0
        ? 'No hay encuestas para sincronizar.'
        : 'Todas las encuestas ya están guardadas en la base.', 'info');
    return;
  }

  mostrarNotificacion('Sincronizando encuestas con la nube...', 'info');

  let exitosas = 0;
  const rechazadas = [];

  try {
    for (const encuesta of pendientes) {
      try {
        const respuesta = await fetch('/api/guardar_encuesta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encuesta)
        });

        if (respuesta.ok) {
          encuesta.sincronizada = true;
          exitosas++;
        } else {
          const errorData = await respuesta.json().catch(function () { return {}; });
          console.error('Error al sincronizar encuesta', encuesta.id, errorData);
          rechazadas.push({
            codigo: encuesta.codigoFicha || encuesta.id,
            bloqueos: errorData.bloqueos || [],
            /* Un 500 no es un rechazo por reglas: el servidor sí contestó, y
               contestó que falló. Se guarda su explicación para poder decirla,
               en vez de achacárselo a la red. */
            fallaDelServidor: respuesta.status >= 500
              ? (errorData.detalles || errorData.error || 'error interno')
              : null
          });
        }
      } catch (fetchError) {
        console.error('Error de red para encuesta', encuesta.id, fetchError);
        rechazadas.push({
          codigo: encuesta.codigoFicha || encuesta.id, bloqueos: [], fallaDelServidor: null
        });
      }
    }

    // Guardar los estados actualizados en localStorage
    guardarEncuestas(encuestasLocales);

    if (exitosas > 0) {
      mostrarNotificacion('Se sincronizaron ' + exitosas + ' encuesta(s) correctamente.' +
        (rechazadas.length > 0 ? ' (' + rechazadas.length + ' con error)' : ''), 'success');
    }

    /* El aviso decía «revise la consola (F12)». Un encuestador no abre la
       consola: se queda sin saber qué corregir y la ficha no sube nunca. El
       servidor ya devuelve qué campo falla; se muestra. */
    if (rechazadas.length > 0) {
      const primera = rechazadas[0];

      /* Tres desenlaces distintos y tres mensajes distintos. Decir «no hubo
         respuesta del servidor» ante un 500 manda a revisar la red o la base
         cuando el servidor ya dijo exactamente qué falló. */
      let detalle;
      if (primera.bloqueos.length > 0) {
        detalle = ' ' + primera.codigo + ': ' + primera.bloqueos[0].mensaje;
      } else if (primera.fallaDelServidor) {
        detalle = ' ' + primera.codigo + ': el servidor no pudo guardarla — ' +
          primera.fallaDelServidor;
      } else {
        detalle = ' ' + primera.codigo + ': no hubo respuesta del servidor.';
      }

      mostrarNotificacion(
        rechazadas.length + ' encuesta(s) no se pudieron guardar.' + detalle, 'error');

      console.table(rechazadas.map(function (r) {
        return {
          ficha: r.codigo,
          bloqueos: r.bloqueos.length,
          primero: r.bloqueos.length > 0 ? r.bloqueos[0].ruta + ': ' + r.bloqueos[0].mensaje : '—'
        };
      }));
    }
    
    renderizarInicio(); 
    renderizarHistorial();
  } catch (error) {
    console.error('Fallo en sincronización:', error);
    mostrarNotificacion('Error de red al sincronizar. Reintente cuando tenga conexión.', 'error');
  }
}

/* ---------------------------------------------------------
   11. RETIRO DE LOS DATOS DE DEMOSTRACIÓN
   ---------------------------------------------------------
   La aplicación sembraba tres fichas de ejemplo la primera vez que se abría,
   para que Inicio e Historial no se vieran vacíos. Salió más caro de lo que
   valía: eran fichas incompletas a propósito —fechas fuera del plazo de
   RN-016, valores que ya no están en los catálogos, familias sin
   caracterizar—, así que la API las rechazaba una y otra vez. Quien pulsaba
   «Sincronizar a la Nube» recibía un error que no venía de su trabajo y no
   tenía forma de resolver.

   Con el guardado directo contra la base, además, ya no hacen falta: la
   primera encuesta registrada llena las dos vistas.

   Esto no siembra nada; sólo retira lo sembrado antes, una sola vez, de los
   navegadores que ya lo tienen.
   --------------------------------------------------------- */

const CLAVE_SEMILLA_RETIRADA = 'aps_semilla_retirada';
const CODIGOS_SEMILLA = ['F-00123', 'F-00456', 'F-00789'];

function retirarDatosDemostracion() {
  if (localStorage.getItem(CLAVE_SEMILLA_RETIRADA) === 'si') return;

  const encuestas = obtenerEncuestas();

  /* Sólo las de demostración que nunca llegaron a la base. Si alguna se
     sincronizó, es un registro real que reutilizó el código y no se toca. */
  const conservadas = encuestas.filter(function (encuesta) {
    return !(CODIGOS_SEMILLA.indexOf(encuesta.codigoFicha) !== -1 &&
             encuesta.sincronizada !== true);
  });

  const retiradas = encuestas.length - conservadas.length;
  if (retiradas > 0) {
    guardarEncuestas(conservadas);
    console.info('Se retiraron ' + retiradas + ' ficha(s) de demostración del almacenamiento local.');
  }

  localStorage.setItem(CLAVE_SEMILLA_RETIRADA, 'si');
}

/* ---------------------------------------------------------
   12. NOTIFICACIONES VISUALES (toasts)
   --------------------------------------------------------- */

const TITULOS_TOAST = {
  success: 'Éxito',
  error: 'Error',
  warning: 'Atención',
  info: 'Información'
};

function mostrarNotificacion(mensaje, tipo) {
  tipo = tipo || 'info';
  const contenedor = document.getElementById('toastContainer');

  const toast = document.createElement('div');
  toast.className = 'toast toast--' + tipo;
  toast.innerHTML = '<strong>' + TITULOS_TOAST[tipo] + '</strong>' + escaparHtml(mensaje);

  contenedor.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('is-leaving');
    setTimeout(function () { toast.remove(); }, 250);
  }, 4200);
}

/* ---------------------------------------------------------
   13. NAVEGACIÓN ENTRE VISTAS (tabs)
   --------------------------------------------------------- */

function cambiarVista(nombreVista) {
  document.querySelectorAll('.view').forEach(function (vista) {
    vista.classList.toggle('is-active', vista.id === 'view-' + nombreVista);
  });
  document.querySelectorAll('.app-tabs__btn').forEach(function (boton) {
    boton.classList.toggle('is-active', boton.dataset.view === nombreVista);
  });

  if (nombreVista === 'inicio') renderizarInicio();
  if (nombreVista === 'historial') renderizarHistorial();
}

function inicializarNavegacion() {
  document.querySelectorAll('.app-tabs__btn').forEach(function (boton) {
    boton.addEventListener('click', function () {
      cambiarVista(boton.dataset.view);
    });
  });

  document.querySelectorAll('[data-goto]').forEach(function (elemento) {
    elemento.addEventListener('click', function () {
      cambiarVista(elemento.dataset.goto);
    });
  });
}

/* ---------------------------------------------------------
   14. RENDERIZADO — VISTA INICIO (indicadores + últimos registros)
   --------------------------------------------------------- */

function calcularIndicadores(encuestas) {
  const conHacinamiento = encuestas.filter(function (e) { return e.hacinamiento === 'si'; }).length;
  const situacionesInminentes = encuestas.filter(function (e) {
    return requiereAtencionPrioritaria(e.situacionInminente);
  }).length;
  const territorios = new Set(
    encuestas.map(function (e) { return e.territorio; }).filter(Boolean)
  );

  return {
    totalEncuestas: encuestas.length,
    conHacinamiento: conHacinamiento,
    situacionesInminentes: situacionesInminentes,
    territoriosCubiertos: territorios.size
  };
}

function renderizarIndicadores(encuestas) {
  const indicadores = calcularIndicadores(encuestas);
  const contenedor = document.getElementById('indicatorsGrid');

  const tarjetas = [
    { icono: '📋', clase: 'teal', valor: indicadores.totalEncuestas, etiqueta: 'Encuestas registradas' },
    { icono: '🛏️', clase: 'red', valor: indicadores.conHacinamiento, etiqueta: 'Hogares con hacinamiento' },
    { icono: '🚨', clase: 'amber', valor: indicadores.situacionesInminentes, etiqueta: 'Situaciones inminentes detectadas' },
    { icono: '📍', clase: 'blue', valor: indicadores.territoriosCubiertos, etiqueta: 'Territorios cubiertos' }
  ];

  contenedor.innerHTML = tarjetas.map(function (tarjeta) {
    return (
      '<div class="indicator-card">' +
        '<div class="indicator-card__icon indicator-card__icon--' + tarjeta.clase + '">' + tarjeta.icono + '</div>' +
        '<div>' +
          '<div class="indicator-card__value">' + tarjeta.valor + '</div>' +
          '<div class="indicator-card__label">' + tarjeta.etiqueta + '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function badgeHacinamiento(valor) {
  if (valor === 'si') return '<span class="badge badge--danger">Sí</span>';
  if (valor === 'no') return '<span class="badge badge--success">No</span>';
  return '<span class="badge badge--neutral">—</span>';
}

/**
 * Dice si la ficha llegó a la base o sigue sólo en este dispositivo. Es la
 * diferencia entre un dato a salvo y uno que se pierde si se borra el
 * navegador, y hasta ahora no se veía en ninguna parte.
 */
function badgeSincronizacion(sincronizada) {
  return sincronizada === true
    ? '<span class="badge badge--success">En la base</span>'
    : '<span class="badge badge--warning">Pendiente</span>';
}

function badgeSituacion(valor) {
  if (!requiereAtencionPrioritaria(valor)) return '<span class="badge badge--neutral">No aplica</span>';
  return '<span class="badge badge--warning">' + escaparHtml(etiquetaDeCatalogo(CAT_SITUACION_INMINENTE, valor)) + '</span>';
}

function textoTerritorio(encuesta) {
  if (!encuesta.territorio) return '—';
  return escaparHtml(etiquetaTerritorio(encuesta.territorio));
}

function textoModificacion(encuesta) {
  const fechas = encuesta.fechasModificacion || [];
  if (fechas.length === 0) return '<span class="badge badge--neutral" style="font-size: 0.75rem; color: #666; background: #eee;">Sin modificaciones</span>';
  const ultima = fechas[fechas.length - 1];
  return '<span class="badge badge--info" title="' + fechas.length + ' modificaciones" style="font-size: 0.75rem; color: #0056b3; background: #cce5ff;">' + formatearFecha(ultima) + ' (' + fechas.length + ')</span>';
}

function textoMicroterritorio(encuesta) {
  if (!encuesta.microterritorio) return '—';
  const nombre = encuesta.microterritorioNombre;
  return escaparHtml(encuesta.microterritorio + (nombre ? ' — ' + nombre : ''));
}

function renderizarInicio() {
  const encuestas = obtenerEncuestas();
  renderizarIndicadores(encuestas);

  const cuerpoTabla = document.getElementById('recentTableBody');
  const recientes = encuestas.slice(0, 5);

  if (recientes.length === 0) {
    cuerpoTabla.innerHTML = '<tr><td colspan="5" class="empty-state">Aún no hay encuestas registradas.</td></tr>';
    return;
  }

  cuerpoTabla.innerHTML = recientes.map(function (encuesta) {
    return (
      '<tr>' +
        '<td>' + formatearFecha(encuesta.fechaRegistro) + '</td>' +
        '<td>' + textoModificacion(encuesta) + '</td>' +
        '<td>' + textoTerritorio(encuesta) + '</td>' +
        '<td>' + textoSeguro(encuesta.direccion) + '</td>' +
        '<td>' + badgeHacinamiento(encuesta.hacinamiento) + '</td>' +
        '<td>' + badgeSituacion(encuesta.situacionInminente) + '</td>' +
      '</tr>'
    );
  }).join('');
}

/* ---------------------------------------------------------
   15. RENDERIZADO — VISTA HISTORIAL (tabla + filtros)
   --------------------------------------------------------- */

function obtenerEncuestasFiltradas() {
  const texto = document.getElementById('filtroTexto').value.trim().toLowerCase();
  const filtroHacinamiento = document.getElementById('filtroHacinamiento').value;

  return obtenerEncuestas().filter(function (encuesta) {
    const campos = [
      encuesta.direccion,
      encuesta.territorio,
      encuesta.microterritorioNombre,
      encuesta.divisionTerritorial
    ];

    const coincideTexto = !texto || campos
      .filter(Boolean)
      .some(function (campo) { return String(campo).toLowerCase().includes(texto); });

    const coincideHacinamiento = !filtroHacinamiento || encuesta.hacinamiento === filtroHacinamiento;

    return coincideTexto && coincideHacinamiento;
  });
}

function renderizarHistorial() {
  const encuestas = obtenerEncuestasFiltradas();
  const cuerpoTabla = document.getElementById('historialTableBody');
  const estadoVacio = document.getElementById('historialEmptyState');

  if (encuestas.length === 0) {
    cuerpoTabla.innerHTML = '';
    /* Sin fichas de demostración, el historial vacío es lo primero que ve
       quien abre la aplicación. Decirle «no se encontraron registros con los
       filtros seleccionados» cuando no ha filtrado nada lo manda a buscar un
       filtro que no existe. */
    estadoVacio.textContent = obtenerEncuestas().length === 0
      ? 'Todavía no hay encuestas registradas. Diligencie la primera desde la pestaña «Nueva Encuesta».'
      : 'No se encontraron registros con los filtros seleccionados.';
    estadoVacio.hidden = false;
    return;
  }
  estadoVacio.hidden = true;

  cuerpoTabla.innerHTML = encuestas.map(function (encuesta) {
    const personasPorHabitacion = encuesta.personasPorHabitacion === null || encuesta.personasPorHabitacion === undefined
      ? '—' : encuesta.personasPorHabitacion;

    return (
      '<tr>' +
        /* El código y el estado hacen falta para poder actuar sobre la fila:
           los rechazos de la API nombran la ficha por su código, y sin verlo
           aquí no había manera de saber cuál de todas hay que corregir. */
        '<td>' + textoSeguro(encuesta.codigoFicha) + '</td>' +
        '<td>' + badgeSincronizacion(encuesta.sincronizada) + '</td>' +
        '<td>' + formatearFecha(encuesta.fechaRegistro) + '</td>' +
        '<td>' + textoModificacion(encuesta) + '</td>' +
        '<td>' + textoTerritorio(encuesta) + '</td>' +
        '<td>' + textoMicroterritorio(encuesta) + '</td>' +
        '<td>' + textoSeguro(encuesta.direccion) + '</td>' +
        '<td>' + personasPorHabitacion + '</td>' +
        '<td>' + badgeHacinamiento(encuesta.hacinamiento) + '</td>' +
        '<td>' + badgeSituacion(encuesta.situacionInminente) + '</td>' +
        '<td class="actions-cell">' +
          '<button type="button" class="btn btn--ghost btn--icon" data-ver="' + encuesta.id + '">Ver</button>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-corregir="' + encuesta.id + '">Corregir</button>' +
          '<button type="button" class="btn btn--danger btn--icon" data-eliminar="' + encuesta.id + '">Eliminar</button>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  cuerpoTabla.querySelectorAll('[data-ver]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirModalDetalle(boton.dataset.ver); });
  });
  cuerpoTabla.querySelectorAll('[data-corregir]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirCorreccionDeEncuesta(boton.dataset.corregir); });
  });
  cuerpoTabla.querySelectorAll('[data-eliminar]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirModalConfirmarEliminacion(boton.dataset.eliminar); });
  });
}

function inicializarFiltrosHistorial() {
  document.getElementById('filtroTexto').addEventListener('input', renderizarHistorial);
  document.getElementById('filtroHacinamiento').addEventListener('change', renderizarHistorial);
  document.getElementById('btnLimpiarFiltros').addEventListener('click', function () {
    document.getElementById('filtroTexto').value = '';
    document.getElementById('filtroHacinamiento').value = '';
    renderizarHistorial();
  });
}

/* ---------------------------------------------------------
   16. MODAL DE DETALLE
   --------------------------------------------------------- */

function construirSeccionDetalle(titulo, items) {
  const filas = items.map(function (item) {
    return (
      '<div class="detail-item">' +
        '<span class="detail-label">' + escaparHtml(item.etiqueta) + '</span>' +
        '<span class="detail-value">' + textoSeguro(item.valor) + '</span>' +
      '</div>'
    );
  }).join('');

  return (
    '<div class="detail-section">' +
      '<h3>' + escaparHtml(titulo) + '</h3>' +
      '<div class="detail-grid">' + filas + '</div>' +
    '</div>'
  );
}

function describirOrigenCoordenadas(encuesta) {
  if (encuesta.origenCoordenadas === 'geocodificacion') {
    const nivel = ETIQUETA_PRECISION[encuesta.precisionCoordenadas] || encuesta.precisionCoordenadas;
    return 'Calculadas desde la dirección' + (nivel ? ' (precisión: ' + nivel + ')' : '');
  }
  if (encuesta.origenCoordenadas === 'gps') {
    return 'GPS del dispositivo' +
      (encuesta.precisionCoordenadas ? ' (± ' + encuesta.precisionCoordenadas + ' m)' : '');
  }
  if (encuesta.origenCoordenadas === 'manual') return 'Digitadas manualmente';
  return null;
}

function textoSiNo(valor) {
  if (valor === 'si') return 'Sí';
  if (valor === 'no') return 'No';
  if (valor === 'no_aplica') return 'No aplica';
  return null;
}

function abrirModalDetalle(id) {
  const encuesta = obtenerEncuestas().find(function (e) { return e.id === id; });
  if (!encuesta) {
    mostrarNotificacion('No se encontró la encuesta seleccionada.', 'error');
    return;
  }

  const microterritorio = buscarMicroterritorio(encuesta.territorio, encuesta.microterritorio);
  const perfil = encuesta.perfilProfesional === 'otro'
    ? 'Otro: ' + (encuesta.perfilProfesionalOtro || '')
    : etiquetaDeCatalogo(CAT_PERFIL_PROFESIONAL, encuesta.perfilProfesional);

  const cuerpo = document.getElementById('modalDetalleBody');
  cuerpo.innerHTML =
    construirSeccionDetalle('Consentimiento y situación inminente', [
      { etiqueta: 'Consentimiento informado (RN-001)', valor: textoSiNo(encuesta.consentimiento) },
      { etiqueta: 'Situación inminente (RN-002)', valor: etiquetaDeCatalogo(CAT_SITUACION_INMINENTE, encuesta.situacionInminente) }
    ]) +
    construirSeccionDetalle('Identificación geográfica', [
      { etiqueta: 'Departamento', valor: encuesta.departamentoCodigo + ' — ' + encuesta.departamento },
      { etiqueta: 'Municipio', valor: encuesta.municipioCodigo + ' — ' + encuesta.municipio },
      { etiqueta: 'UZPE', valor: encuesta.uzpe },
      { etiqueta: 'Área de ubicación', valor: etiquetaDeCatalogo(CAT_AREA_UBICACION, encuesta.areaUbicacion) },
      { etiqueta: 'Territorio', valor: encuesta.territorio ? etiquetaTerritorio(encuesta.territorio) : null },
      { etiqueta: 'Microterritorio', valor: microterritorio ? microterritorio.codigo + ' — ' + microterritorio.nombre : null },
      { etiqueta: 'División territorial menor', valor: encuesta.divisionTerritorial }
    ]) +
    construirSeccionDetalle('Equipo de salud', [
      { etiqueta: 'N.° Identificación del equipo', valor: encuesta.equipoSaludId },
      { etiqueta: 'Prestador primario', valor: encuesta.prestadorPrimario }
    ]) +
    construirSeccionDetalle('Personal y abordaje', [
      { etiqueta: 'Tipo identificación responsable', valor: encuesta.responsableTipoId },
      { etiqueta: 'N.° identificación responsable', valor: encuesta.responsableNumeroId },
      { etiqueta: 'Perfil profesional', valor: perfil },
      { etiqueta: 'Código de la ficha', valor: encuesta.codigoFicha },
      { etiqueta: 'Fecha diligenciamiento', valor: encuesta.fechaDiligenciamiento },
      { etiqueta: 'Entorno de abordaje', valor: etiquetaDeCatalogo(CAT_ENTORNO, encuesta.entornoAbordaje) },
      { etiqueta: 'Institución / entidad', valor: encuesta.nombreInstitucion },
      { etiqueta: 'Cabeza de familia / Líder', valor: encuesta.cabezaFamilia },
      { etiqueta: 'Programa Jóvenes en Paz', valor: textoSiNo(encuesta.jovenesEnPaz) }
    ]) +
    construirSeccionDetalle('Dirección y ubicación geográfica', [
      { etiqueta: '21. Dirección normalizada', valor: encuesta.direccion },
      { etiqueta: 'Lectura', valor: encuesta.direccionLegible },
      { etiqueta: 'Nomenclatura', valor: encuesta.direccionComponentes
        ? etiquetaDeCatalogo(CAT_MODO_DIRECCION, encuesta.direccionComponentes.modo) : null },
      { etiqueta: '22. Latitud', valor: encuesta.latitud },
      { etiqueta: '23. Longitud', valor: encuesta.longitud },
      { etiqueta: 'Origen de las coordenadas', valor: describirOrigenCoordenadas(encuesta) },
      { etiqueta: 'Referencia encontrada', valor: encuesta.referenciaCoordenadas },
      { etiqueta: 'Consulta enviada al geocodificador', valor: encuesta.consultaGeocodificacion }
    ]) +
    construirSeccionDetalle('Datos generales de la vivienda', [
      { etiqueta: 'Punto de referencia', valor: encuesta.ubicacionReferencia },
      { etiqueta: 'N.° Identificación del hogar', valor: encuesta.idHogar },
      { etiqueta: 'N.° Identificación de la familia', valor: encuesta.idFamilia },
      { etiqueta: 'Estrato socioeconómico', valor: etiquetaDeCatalogo(CAT_ESTRATO, encuesta.estrato) },
      { etiqueta: 'N.° hogares en la vivienda', valor: encuesta.hogaresEnVivienda },
      { etiqueta: 'N.° personas en la vivienda', valor: encuesta.personasEnVivienda },
      { etiqueta: 'N.° habitaciones', valor: encuesta.habitacionesVivienda },
      { etiqueta: 'N.° elementos para dormir', valor: encuesta.elementosParaDormir },
      { etiqueta: 'N.° personas por habitación', valor: encuesta.personasPorHabitacion },
      { etiqueta: 'Hacinamiento', valor: textoSiNo(encuesta.hacinamiento) }
    ]) +
    construirSeccionDetalle('Caracterización del entorno', [
      { etiqueta: 'Tipo de vivienda', valor: etiquetaDeCatalogo(CAT_TIPO_VIVIENDA, encuesta.tipoVivienda) },
      { etiqueta: 'Material del techo', valor: etiquetaDeCatalogo(CAT_MATERIAL_TECHO, encuesta.materialTecho) },
      { etiqueta: 'Escenarios de riesgo de accidente', valor: etiquetasDeCatalogo(CAT_RIESGOS_ACCIDENTE, encuesta.riesgosAccidente) },
      { etiqueta: 'Criaderos o reservorios de vectores', valor: textoSiNo(encuesta.vectores) },
      { etiqueta: 'Factores de contaminación', valor: etiquetasDeCatalogo(CAT_FACTORES_CONTAMINACION, encuesta.factoresContaminacion) }
    ]);

  document.getElementById('modalDetalle').hidden = false;
}

function cerrarModalDetalle() {
  document.getElementById('modalDetalle').hidden = true;
}

/* ---------------------------------------------------------
   17. MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
   --------------------------------------------------------- */

/* ---------------------------------------------------------
   Confirmación reutilizable.
   El mismo modal atiende la eliminación de encuestas y la
   reducción de integrantes del ítem 51.
   --------------------------------------------------------- */

let confirmacionPendiente = null;

/**
 * Muestra el modal de confirmación.
 * @param {{titulo:string, mensaje:string, textoConfirmar?:string,
 *          alConfirmar:Function, alCancelar?:Function}} opciones
 */
function pedirConfirmacion(opciones) {
  confirmacionPendiente = opciones;

  document.getElementById('modalConfirmarTitulo').textContent = opciones.titulo;
  document.getElementById('modalConfirmarMensaje').textContent = opciones.mensaje;
  document.getElementById('btnConfirmarEliminar').textContent = opciones.textoConfirmar || 'Eliminar';
  document.getElementById('modalConfirmar').hidden = false;
}

function resolverConfirmacion(aceptada) {
  const pendiente = confirmacionPendiente;
  confirmacionPendiente = null;
  document.getElementById('modalConfirmar').hidden = true;

  if (!pendiente) return;
  if (aceptada) pendiente.alConfirmar();
  else if (pendiente.alCancelar) pendiente.alCancelar();
}

function abrirModalConfirmarEliminacion(id) {
  encuestaSeleccionadaId = id;
  pedirConfirmacion({
    titulo: 'Eliminar registro',
    mensaje: '¿Está seguro de que desea eliminar esta encuesta? Esta acción no se puede deshacer.',
    textoConfirmar: 'Eliminar',
    alConfirmar: function () {
      eliminarEncuestaPorId(encuestaSeleccionadaId);
      encuestaSeleccionadaId = null;
      renderizarHistorial();
      mostrarNotificacion('La encuesta fue eliminada correctamente.', 'success');
    },
    alCancelar: function () { encuestaSeleccionadaId = null; }
  });
}

/* ---------------------------------------------------------
   18. RECOLECCIÓN, VALIDACIÓN Y ENVÍO DEL FORMULARIO
   --------------------------------------------------------- */

function recolectarDatosFormulario(formulario) {
  const fd = new FormData(formulario);
  const territorio = valorOrNull(fd.get('territorio'));
  const microterritorio = valorOrNull(fd.get('microterritorio'));
  const datosMicro = buscarMicroterritorio(territorio, microterritorio);

  const componentesDireccion = recolectarComponentesDireccion();
  const direccionNormalizada = normalizarDireccion(componentesDireccion);

  const base = {
    consentimiento: obtenerConsentimiento(),
    situacionInminente: valorOrNull(fd.get('situacionInminente')),

    departamentoCodigo: valorOrNull(fd.get('departamento')),
    departamento: CAT_DEPARTAMENTO.nombre,
    municipioCodigo: valorOrNull(fd.get('municipio')),
    municipio: CAT_MUNICIPIO.nombre,
    uzpe: valorOrNull(fd.get('uzpe')),
    areaUbicacion: valorOrNull(fd.get('areaUbicacion')),
    territorio: territorio,
    microterritorio: microterritorio,
    microterritorioNombre: datosMicro ? datosMicro.nombre : null,
    comuna: territorio ? comunaDeTerritorio(territorio) : null,
    divisionTerritorial: valorOrNull(fd.get('divisionTerritorial')),

    equipoSaludId: valorOrNull(fd.get('equipoSaludId')),
    prestadorPrimario: valorOrNull(fd.get('prestadorPrimario')),

    responsableTipoId: valorOrNull(fd.get('responsableTipoId')),
    responsableNumeroId: valorOrNull(fd.get('responsableNumeroId')),
    perfilProfesional: valorOrNull(fd.get('perfilProfesional')),
    perfilProfesionalOtro: valorOrNull(fd.get('perfilProfesionalOtro')),
    codigoFicha: valorOrNull(fd.get('codigoFicha')),
    fechaDiligenciamiento: valorOrNull(fd.get('fechaDiligenciamiento')),

    entornoAbordaje: valorOrNull(fd.get('entornoAbordaje')),
    nombreInstitucion: valorOrNull(fd.get('nombreInstitucion')),
    cabezaFamilia: valorOrNull(fd.get('cabezaFamilia')),
    jovenesEnPaz: valorOrNull(fd.get('jovenesEnPaz')),

    // Ítem 21 — la dirección se persiste normalizada y también por componentes,
    // para poder reeditarla y para alimentar una geocodificación posterior.
    direccion: direccionNormalizada.canonica || null,
    direccionLegible: direccionNormalizada.legible || null,
    direccionComponentes: componentesDireccion,
    direccionNormalizada: direccionNormalizada,
    consultaGeocodificacion: direccionNormalizada.completa
      ? construirConsultaGeocodificacion(componentesDireccion, valorOrNull(fd.get('divisionTerritorial')))
      : null,

    latitudTexto: valorOrNull(fd.get('latitud')),
    longitudTexto: valorOrNull(fd.get('longitud')),
    latitud: aFloatOrNull(fd.get('latitud')),
    longitud: aFloatOrNull(fd.get('longitud')),
    origenCoordenadas: origenCoordenadas,
    precisionCoordenadas: precisionCoordenadas,
    referenciaCoordenadas: referenciaCoordenadas,
    ubicacionReferencia: valorOrNull(fd.get('ubicacionReferencia')),
    idHogar: valorOrNull(fd.get('idHogar')),
    idFamilia: valorOrNull(fd.get('idFamilia')),
    estrato: valorOrNull(fd.get('estrato')),
    hogaresEnVivienda: aIntOrNull(fd.get('hogaresEnVivienda')),
    personasEnVivienda: aIntOrNull(fd.get('personasEnVivienda')),
    habitacionesVivienda: aIntOrNull(fd.get('habitacionesVivienda')),
    elementosParaDormir: aIntOrNull(fd.get('elementosParaDormir')),

    tipoVivienda: valorOrNull(fd.get('tipoVivienda')),
    materialTecho: valorOrNull(fd.get('materialTecho')),
    riesgosAccidente: fd.getAll('riesgosAccidente'),
    vectores: valorOrNull(fd.get('vectores')),
    factoresContaminacion: fd.getAll('factoresContaminacion')
  };

  // Bloque 4 (ítems 39-49): sólo se incorpora si la sección está diligenciada,
  // para que el motor de reglas active esa parte del articulado (RN-039 a RN-049).
  const saneamiento = recolectarSaneamiento(fd);
  if (saneamiento) Object.assign(base, saneamiento);

  // Bloques repetibles y plan de cuidado (ítems 50-140).
  Object.assign(base, recolectarBloquesRepetibles(formulario));

  // Campos derivados que las reglas contrastan contra su cálculo.
  const hacinamiento = evaluarHacinamiento(base.personasEnVivienda, base.habitacionesVivienda);
  base.personasPorHabitacion = hacinamiento.personasPorHabitacion;
  base.hacinamiento = hacinamiento.hacinamiento;
  base.motivoSinGeorreferenciacion = valorOrNull(fd.get('motivoSinGeorreferenciacion'));
  base.visitaIncompleta = formulario.querySelector('#visitaIncompleta').checked;
  base.motivoVisitaIncompleta = valorOrNull(fd.get('motivoVisitaIncompleta'));

  return base;
}

/* Ítems 39 a 49. Devuelve null mientras la sección esté intacta. */
function recolectarSaneamiento(fd) {
  const actividad = valorOrNull(fd.get('actividadEconomica'));
  const animales = fd.getAll('animales');
  const fuenteAgua = valorOrNull(fd.get('fuenteAgua'));

  const seDiligencio = actividad !== null || animales.length > 0 || fuenteAgua !== null ||
    valorOrNull(fd.get('disposicionExcretas')) !== null ||
    valorOrNull(fd.get('aguasResiduales')) !== null ||
    valorOrNull(fd.get('residuosSolidos')) !== null;

  if (!seDiligencio) return null;

  return {
    actividadEconomica: actividad,
    animales: animales,
    animalesOtro: valorOrNull(fd.get('animalesOtro')),
    perros: aIntOrNull(fd.get('perros')),
    perrosVacunados: aIntOrNull(fd.get('perrosVacunados')),
    gatos: aIntOrNull(fd.get('gatos')),
    gatosVacunados: aIntOrNull(fd.get('gatosVacunados')),
    carnetAntirrabico: valorOrNull(fd.get('carnetAntirrabico')),
    fuenteAgua: fuenteAgua,
    disposicionExcretas: valorOrNull(fd.get('disposicionExcretas')),
    aguasResiduales: valorOrNull(fd.get('aguasResiduales')),
    residuosSolidos: valorOrNull(fd.get('residuosSolidos'))
  };
}

function limpiarErroresFormulario(formulario) {
  formulario.querySelectorAll('.field.has-error').forEach(function (campo) {
    campo.classList.remove('has-error');
    const mensaje = campo.querySelector('.field-error-msg');
    if (mensaje) mensaje.remove();
  });
}

/** El contenedor donde se pinta el error de un control, buscado por su ruta. */
function contenedorPorRuta(formulario, ruta) {
  if (!ruta) return null;
  const control = formulario.querySelector('[name="' + ruta + '"]');
  return control ? control.closest('.field, td') : null;
}

function marcarIncumplimiento(formulario, incumplimiento) {
  /* La `ruta` nombra el control exacto —`planVivienda.acciones[0].ejecutorNumeroId`
     señala esa casilla y no las tres del plan a la vez—, así que se prefiere
     cuando hay un control con ese nombre. `data-campo` queda de respaldo para
     las reglas que marcan un bloque entero y no un control concreto. */
  const contenedor = contenedorPorRuta(formulario, incumplimiento.ruta) ||
    formulario.querySelector('[data-campo="' + incumplimiento.campo + '"]');

  if (!contenedor || contenedor.querySelector('.field-error-msg')) return contenedor;

  contenedor.classList.add('has-error');
  const aviso = document.createElement('span');
  aviso.className = 'field-error-msg';
  aviso.textContent = incumplimiento.codigo + ': ' + incumplimiento.mensaje;
  contenedor.appendChild(aviso);
  return contenedor;
}

function construirEncuestaDesdeDatos(datos) {
  const resultadoCalculo = calcularHacinamiento(datos.personasEnVivienda, datos.habitacionesVivienda);
  const alertas = evaluarAlertas(datos);

  const encuesta = Object.assign({}, datos, {
    id: generarId(),
    fechaRegistro: new Date().toISOString(),
    fechasModificacion: [],
    personasPorHabitacion: resultadoCalculo.personasPorHabitacion,
    hacinamiento: resultadoCalculo.hacinamiento,
    // RN-221: el nivel de riesgo se persiste para priorizar la agenda del EBS.
    riesgoFamiliar: clasificarRiesgoFamiliar(datos, alertas),
    alertas: alertas.map(function (alerta) {
      return {
        codigo: alerta.codigo, prioridad: alerta.prioridad, titulo: alerta.titulo,
        referencia: alerta.referencia, notificaSivigila: alerta.notificaSivigila
      };
    })
  });

  // Campos auxiliares de validación que no se persisten.
  delete encuesta.latitudTexto;
  delete encuesta.longitudTexto;
  delete encuesta.direccionNormalizada; // se guardan `direccion` y `direccionLegible`

  return encuesta;
}

/* ---------------------------------------------------------
   18.1 PRESENTACIÓN DE LAS REGLAS DE DECISIÓN (RN-200 a RN-222)
   --------------------------------------------------------- */

const ETIQUETA_PRIORIDAD = {
  inmediata: 'Inmediata · en el momento de la visita',
  prioritaria: 'Prioritaria · 72 horas',
  regular: 'Regular · 30 días'
};

const CLASE_SEMAFORO = {
  alto: 'rojo', medio: 'naranja', bajo: 'amarillo', sin_riesgo: 'verde'
};

/** RN-221 — Pinta el semáforo de riesgo familiar y los conteos por nivel. */
function renderizarSemaforo(riesgo) {
  const punto = document.getElementById('semaforoPunto');
  const etiqueta = document.getElementById('semaforoEtiqueta');
  const detalle = document.getElementById('semaforoDetalle');

  punto.className = 'semaforo__punto semaforo__punto--' + (CLASE_SEMAFORO[riesgo.nivel] || 'gris');
  etiqueta.textContent = riesgo.etiqueta;
  detalle.textContent = riesgo.nivel === 'sin_riesgo'
    ? 'Nueva caracterización en ' + riesgo.diasSeguimiento + ' días.'
    : 'Seguimiento en ' + riesgo.diasSeguimiento + ' días' +
      (riesgo.gestorDeCaso ? ' · requiere asignación a gestor de caso.' : '.');

  document.getElementById('conteoInmediatas').textContent = riesgo.inmediatas;
  document.getElementById('conteoPrioritarias').textContent = riesgo.prioritarias;
  document.getElementById('conteoRegulares').textContent = riesgo.regulares;
}

/* El estado vacío se regenera desde su texto original: pintar la lista con
   innerHTML destruye el nodo, así que no puede conservarse por referencia. */
const TEXTO_SIN_ALERTAS =
  'No se han identificado alertas. Las que se detecten aparecerán aquí con su nivel de ' +
  'prioridad, el plazo máximo de respuesta y la acción que deben generar en el plan de cuidado.';

const TEXTO_SIN_IMPEDIMENTOS =
  'Al intentar guardar se listarán aquí los campos obligatorios pendientes, las familias o ' +
  'integrantes sin caracterizar y las alertas sin conducta registrada.';

function estadoVacioHtml(id, texto) {
  return '<p class="empty-state empty-state--compacto" id="' + id + '">' + texto + '</p>';
}

/** RN-200 / RN-220 — Lista las alertas con su plazo y su obligación. */
function renderizarAlertas(alertas, sinAccion) {
  const contenedor = document.getElementById('listaAlertas');

  if (alertas.length === 0) {
    contenedor.innerHTML = estadoVacioHtml('alertasEmptyState', TEXTO_SIN_ALERTAS);
    return;
  }

  const codigosSinAccion = sinAccion.map(function (a) { return a.codigo + '|' + (a.referencia || ''); });

  contenedor.innerHTML = alertas.map(function (alerta) {
    const pendiente = codigosSinAccion.indexOf(alerta.codigo + '|' + (alerta.referencia || '')) !== -1;
    const pies = [];

    pies.push('<span class="pill-meta">' + escaparHtml(alerta.codigo) + '</span>');
    pies.push('<span class="pill-meta">' + escaparHtml(ETIQUETA_PRIORIDAD[alerta.prioridad]) + '</span>');
    pies.push('<span class="pill-meta">Plan: ' + escaparHtml(alerta.plan) + '</span>');
    if (alerta.referencia) pies.push('<span class="pill-meta">' + escaparHtml(alerta.referencia) + '</span>');
    if (alerta.notificaSivigila) pies.push('<span class="pill-meta pill-meta--sivigila">Notificar a SIVIGILA</span>');
    if (alerta.bloqueaSincronizacion) pies.push('<span class="pill-meta pill-meta--bloquea">Bloquea sincronización</span>');
    if (pendiente) pies.push('<span class="pill-meta pill-meta--bloquea">Sin acción registrada</span>');

    return '<div class="alerta-item alerta-item--' + alerta.prioridad + '">' +
      '<div class="alerta-item__cuerpo">' +
        '<span class="alerta-item__titulo">' + escaparHtml(alerta.titulo) + '</span>' +
        '<span class="alerta-item__descripcion">' + escaparHtml(alerta.descripcion) + '</span>' +
        '<div class="alerta-item__pies">' + pies.join('') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/** RN-222 — Lista los impedimentos que bloquean el cierre. */
function renderizarImpedimentos(impedimentos) {
  const contenedor = document.getElementById('listaImpedimentos');

  if (impedimentos.length === 0) {
    contenedor.innerHTML = estadoVacioHtml('impedimentosEmptyState', TEXTO_SIN_IMPEDIMENTOS);
    return;
  }

  contenedor.innerHTML = impedimentos.map(function (item) {
    const referencia = item.referencia
      ? '<span class="pill-meta">' + escaparHtml(item.referencia) + '</span>' : '';
    return '<div class="alerta-item alerta-item--inmediata">' +
      '<div class="alerta-item__cuerpo">' +
        '<span class="alerta-item__titulo">' + escaparHtml(item.mensaje) + '</span>' +
        '<div class="alerta-item__pies">' +
          '<span class="pill-meta">' + escaparHtml(item.codigo) + '</span>' +
          (item.bloque ? '<span class="pill-meta">' + escaparHtml(item.bloque) + '</span>' : '') +
          referencia +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/** Evalúa y pinta el estado completo de la ficha sin guardarla. */
function actualizarTableroDeRiesgo(datos) {
  const alertas = evaluarAlertas(datos);
  const sinAccion = verificarTrazabilidadAlertas(datos, alertas);

  renderizarSemaforo(clasificarRiesgoFamiliar(datos, alertas));
  renderizarAlertas(alertas, sinAccion);

  // RN-022: el motivo sólo se pide cuando falta la georreferenciación.
  const faltaGeo = typeof datos.latitud !== 'number' || typeof datos.longitud !== 'number';
  document.getElementById('campoMotivoGeo').hidden = !faltaGeo;

  return { alertas: alertas, sinAccion: sinAccion };
}

async function manejarEnvioFormulario(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  limpiarErroresFormulario(formulario);

  const datos = recolectarDatosFormulario(formulario);
  actualizarTableroDeRiesgo(datos);

  // RN-222: cierre por causa externa. Se admite la ficha incompleta siempre
  // que quede registrado el motivo, y no entra al denominador de cobertura.
  if (datos.visitaIncompleta) {
    if (esVacioTexto(datos.motivoVisitaIncompleta)) {
      mostrarNotificacion('Registre el motivo del cierre por causa externa.', 'error');
      document.getElementById('campoMotivoIncompleta').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    await guardarYReiniciar(datos, formulario, 'La visita se guardó como incompleta por causa externa.');
    return;
  }

  const resultadoCierre = validarCierre(datos);
  const incumplimientos = validarReglas(datos);

  renderizarImpedimentos(resultadoCierre.impedimentos);

  if (incumplimientos.length > 0) {
    let primerContenedor = null;
    incumplimientos.forEach(function (incumplimiento) {
      const contenedor = marcarIncumplimiento(formulario, incumplimiento);
      if (!primerContenedor && contenedor) primerContenedor = contenedor;
    });

    if (primerContenedor) primerContenedor.scrollIntoView({ behavior: 'smooth', block: 'center' });

    mostrarNotificacion(
      'Se encontraron ' + incumplimientos.length + ' incumplimientos de reglas de negocio. Revise los campos marcados.',
      'error'
    );
    return;
  }

  if (!resultadoCierre.puedeCerrar) {
    document.getElementById('seccion-cierre').scrollIntoView({ behavior: 'smooth', block: 'start' });
    mostrarNotificacion(
      'La ficha no puede cerrarse: ' + resultadoCierre.impedimentos.length +
      ' impedimento(s) pendiente(s). Revise el resumen de cierre.',
      'error'
    );
    return;
  }

  const advertencias = evaluarAdvertencias(datos);
  if (advertencias.length > 0) {
    mostrarNotificacion(
      advertencias.length + ' advertencia(s) registrada(s): ' + advertencias[0].mensaje,
      'warning'
    );
  }

  await guardarYReiniciar(datos, formulario, 'La encuesta fue guardada correctamente.');
}

function esVacioTexto(valor) {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

/* ---------------------------------------------------------
   GUARDADO DE LA FICHA
   ---------------------------------------------------------
   Guardar escribe en la base. La sincronización es el plan B para las
   visitas sin señal, no el camino normal.

   Antes «Guardar encuesta» sólo escribía en `localStorage` y anunciaba «La
   encuesta fue guardada correctamente». Para quien está en campo eso se lee
   como «ya quedó», y no había quedado en ninguna parte fuera de su
   dispositivo: había que acordarse de pulsar «Sincronizar a la Nube» después,
   y si el servidor rechazaba la ficha el aviso llegaba mucho después de haber
   cerrado la visita, sin el formulario delante para corregirla.
   --------------------------------------------------------- */

async function guardarYReiniciar(datos, formulario, mensaje) {
  const encuesta = construirEncuestaDesdeDatos(datos);
  const boton = document.getElementById('btnGuardar');

  const resultado = await enviarFichaAlServidor(encuesta, boton);

  /* Rechazo por reglas de negocio: la ficha NO se guarda ni se limpia el
     formulario. El encuestador tiene que poder corregir lo que el servidor
     señala, y para eso necesita sus respuestas en pantalla. */
  if (resultado.estado === 'rechazada') {
    mostrarBloqueosDelServidor(formulario, resultado.bloqueos);
    return false;
  }

  encuesta.sincronizada = resultado.estado === 'guardada';

  /* Corrigiendo se reemplaza la ficha existente; capturando se agrega una
     nueva. Sin esta distinción, arreglar un dato dejaría dos copias de la
     misma visita en el historial. */
  if (encuestaEnCorreccion) {
    reemplazarEncuesta(encuestaEnCorreccion, encuesta);
    salirDeCorreccion();
  } else {
    agregarEncuesta(encuesta);
  }

  if (encuesta.sincronizada) {
    mostrarNotificacion(mensaje + ' Quedó registrada en la base de datos.', 'success');
  } else if (resultado.estado === 'error_servidor') {
    /* La ficha se conserva igual —el trabajo del encuestador no se pierde—,
       pero el aviso nombra la causa real en vez de culpar a la red. */
    mostrarNotificacion(
      mensaje + ' El servidor no pudo registrarla: ' + resultado.detalle +
      ' Quedó pendiente de sincronizar.', 'error');
  } else {
    /* Sin red. La ficha se conserva en el dispositivo y queda en cola: es
       exactamente el caso para el que existe la sincronización. */
    mostrarNotificacion(
      mensaje + ' No hubo conexión con el servidor: quedó pendiente de sincronizar.',
      'warning');
  }

  formulario.reset();
  reiniciarEstadoFormulario();
  cambiarVista('historial');
  return true;
}

/**
 * Envía la ficha y traduce la respuesta a tres desenlaces:
 *   guardada    quedó escrita en la base
 *   rechazada   el servidor la devolvió por incumplir reglas (400)
 *   sin_red     no se pudo hablar con el servidor
 */
async function enviarFichaAlServidor(encuesta, boton) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { estado: 'sin_red' };
  }

  /* Se bloquea el botón mientras la petición viaja: sin esto, un segundo clic
     manda la ficha dos veces. */
  const textoOriginal = boton ? boton.textContent : null;
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Guardando…';
  }

  try {
    const respuesta = await fetch('/api/guardar_encuesta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encuesta)
    });

    if (respuesta.ok) return { estado: 'guardada' };

    if (respuesta.status === 400) {
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      return { estado: 'rechazada', bloqueos: cuerpo.bloqueos || [] };
    }

    /* 500 y demás: el problema es del servidor, no de la ficha. No se pierde
       el trabajo del encuestador; queda en cola. Pero no es lo mismo que
       quedarse sin señal, y decirlo así mandaba a buscar cobertura cuando lo
       que hay que mirar es el registro del servidor. */
    const cuerpo = await respuesta.json().catch(function () { return {}; });
    console.error('El servidor respondió ' + respuesta.status + ' al guardar la ficha:', cuerpo);
    return {
      estado: 'error_servidor',
      detalle: cuerpo.detalles || cuerpo.error || 'error interno del servidor'
    };
  } catch (error) {
    console.error('No fue posible hablar con el servidor:', error);
    return { estado: 'sin_red' };
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  }
}

/**
 * Pinta en el formulario lo que el servidor rechazó, con el mismo aspecto que
 * los incumplimientos detectados en el navegador. La ruta que devuelve la API
 * —`familias[0].integrantes[1].planPersona.acciones[0].codigoAccion`— se usa
 * para señalar el control exacto; el `campo` a secas marcaría los tres planes
 * a la vez y no diría cuál corregir.
 */
function mostrarBloqueosDelServidor(formulario, bloqueos) {
  const lista = bloqueos || [];

  renderizarImpedimentos(lista.map(function (b) {
    return {
      codigo: b.codigo || 'BD',
      mensaje: b.mensaje,
      bloque: b.ambito || null,
      referencia: b.referencia || b.ruta || null
    };
  }));

  let primerControl = null;

  lista.forEach(function (b) {
    if (!b.ruta) return;
    const control = formulario.querySelector('[name="' + b.ruta + '"]');
    if (!control) return;

    const contenedor = control.closest('.field, td');
    if (contenedor && !contenedor.querySelector('.field-error-msg')) {
      contenedor.classList.add('has-error');
      const aviso = document.createElement('span');
      aviso.className = 'field-error-msg';
      aviso.textContent = (b.codigo || 'BD') + ': ' + b.mensaje;
      contenedor.appendChild(aviso);
    }
    if (!primerControl) primerControl = control;
  });

  if (primerControl) {
    primerControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    document.getElementById('seccion-cierre').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  mostrarNotificacion(
    'El servidor no aceptó la ficha: ' + lista.length + ' campo(s) por corregir. ' +
    'Revise lo señalado en rojo.', 'error');
}

function reiniciarEstadoFormulario() {
  const formulario = document.getElementById('encuestaForm');
  limpiarErroresFormulario(formulario);
  aplicarBloqueoPorConsentimiento();
  actualizarAlertaSituacionInminente();
  actualizarMicroterritorios();
  actualizarCampoPerfilOtro();
  actualizarCampoInstitucion();

  modoDireccionElegidoManualmente = false;
  seleccionarModoDireccion('urbana');
  reiniciarComplementos();
  aplicarModoDireccion();

  origenCoordenadas = null;
  precisionCoordenadas = null;
  referenciaCoordenadas = null;
  ultimaConsultaGeocodificada = null;
  clearTimeout(temporizadorGeocodificacion);
  establecerEstadoGeo('');
  establecerAvisoGeo('');

  actualizarCalculoHacinamientoEnFormulario();

  // Deja un solo bloque de familia, integrante y plan, y repinta el tablero.
  reiniciarBloquesRepetibles();
  recalcularFormularioCompleto();

  const vacio = { consentimiento: 'si', familias: [] };
  renderizarSemaforo(clasificarRiesgoFamiliar(vacio, []));
  renderizarAlertas([], []);
  renderizarImpedimentos([]);
  document.getElementById('campoMotivoIncompleta').hidden = true;
}

/** Devuelve las colecciones repetibles a una sola instancia en blanco. */
function reiniciarBloquesRepetibles() {
  [
    ['#contenedorFamilias', '[data-bloque="familia"]'],
    ['#contenedorPlanFamilia', '[data-bloque="planFamilia"]'],
    ['#contenedorPlanPersona', '[data-bloque="planPersona"]']
  ].forEach(function (par) {
    const contenedor = document.querySelector(par[0]);
    if (!contenedor) return;
    const bloques = contenedor.querySelectorAll(':scope > ' + par[1]);
    for (let i = bloques.length - 1; i >= 1; i--) bloques[i].remove();
  });

  document.querySelectorAll('[data-rol="contenedorIntegrantes"]').forEach(function (contenedor) {
    const bloques = contenedor.querySelectorAll(':scope > [data-bloque="integrante"]');
    for (let i = bloques.length - 1; i >= 1; i--) bloques[i].remove();
  });

  document.querySelectorAll('tbody').forEach(function (cuerpo) {
    const filas = cuerpo.querySelectorAll('tr[data-fila]');
    for (let i = filas.length - 1; i >= 1; i--) filas[i].remove();
  });

  renumerarFormulario();
}

/* ---------------------------------------------------------
   19. INICIALIZACIÓN GENERAL
   --------------------------------------------------------- */

function inicializarFormulario() {
  const formulario = document.getElementById('encuestaForm');
  formulario.addEventListener('submit', manejarEnvioFormulario);

  // RN-001 — bloqueo de captura sin consentimiento
  document.querySelectorAll('input[name="consentimiento"]').forEach(function (radio) {
    radio.addEventListener('change', aplicarBloqueoPorConsentimiento);
  });

  // RN-002 — alerta de atención prioritaria
  document.getElementById('grupoSituacionInminente')
    .addEventListener('change', actualizarAlertaSituacionInminente);

  // RN-009 — encadenamiento territorio → microterritorio → comuna
  document.getElementById('territorio').addEventListener('change', actualizarMicroterritorios);

  // RN-014 / RN-018 — campos condicionados
  document.getElementById('perfilProfesional').addEventListener('change', actualizarCampoPerfilOtro);
  document.getElementById('entornoAbordaje').addEventListener('change', actualizarCampoInstitucion);

  // RN-021 — dirección por componentes (ítem 21)
  document.getElementById('areaUbicacion').addEventListener('change', sincronizarModoDireccionConArea);

  document.getElementById('grupoModoDireccion').addEventListener('change', function () {
    modoDireccionElegidoManualmente = true;
    aplicarModoDireccion();
  });

  ['panelDireccionUrbana', 'panelDireccionRural'].forEach(function (idPanel) {
    const panel = document.getElementById(idPanel);
    panel.addEventListener('input', actualizarVistaPreviaDireccion);
    panel.addEventListener('change', actualizarVistaPreviaDireccion);
  });

  const contenedorComplementos = document.getElementById('complementosDireccion');
  contenedorComplementos.addEventListener('input', actualizarVistaPreviaDireccion);
  contenedorComplementos.addEventListener('change', actualizarVistaPreviaDireccion);
  contenedorComplementos.addEventListener('click', function (evento) {
    if (!evento.target.classList.contains('complemento-quitar')) return;
    evento.target.closest('.complemento-fila').remove();
    actualizarBotonComplemento();
    actualizarVistaPreviaDireccion();
  });

  document.getElementById('btnAgregarComplemento').addEventListener('click', agregarFilaComplemento);

  // El barrio del ítem 9 es el ancla territorial de la geocodificación.
  document.getElementById('divisionTerritorial').addEventListener('input', function () {
    programarGeocodificacion(normalizarDireccion(recolectarComponentesDireccion()).completa);
  });

  // Ítems 22 y 23 — coordenadas geográficas
  document.getElementById('btnGeocodificar').addEventListener('click', function () {
    geocodificarDesdeFormulario(true);
  });
  document.getElementById('btnCapturarGps').addEventListener('click', capturarCoordenadasGps);
  document.getElementById('latitud').addEventListener('input', marcarCoordenadasManuales);
  document.getElementById('longitud').addEventListener('input', marcarCoordenadasManuales);

  // RN-036 / RN-038 — opción excluyente "Ninguno"
  inicializarGrupoExcluyente('grupoRiesgosAccidente');
  inicializarGrupoExcluyente('grupoFactoresContaminacion');

  // Cálculo automático de hacinamiento
  document.getElementById('personasEnVivienda').addEventListener('input', actualizarCalculoHacinamientoEnFormulario);
  document.getElementById('habitacionesVivienda').addEventListener('input', actualizarCalculoHacinamientoEnFormulario);

  document.getElementById('btnLimpiar').addEventListener('click', function () {
    setTimeout(reiniciarEstadoFormulario, 0);
  });
}

function inicializarModales() {
  document.getElementById('cerrarModalDetalle').addEventListener('click', cerrarModalDetalle);
  document.getElementById('modalDetalle').addEventListener('click', function (evento) {
    if (evento.target.id === 'modalDetalle') cerrarModalDetalle();
  });

  const cancelar = function () { resolverConfirmacion(false); };

  document.getElementById('cerrarModalConfirmar').addEventListener('click', cancelar);
  document.getElementById('btnCancelarEliminar').addEventListener('click', cancelar);
  document.getElementById('btnConfirmarEliminar').addEventListener('click', function () {
    resolverConfirmacion(true);
  });
  document.getElementById('modalConfirmar').addEventListener('click', function (evento) {
    if (evento.target.id === 'modalConfirmar') cancelar();
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') {
      cerrarModalDetalle();
      cancelar();
    }
  });
}

function inicializarAplicacion() {
  inicializarCatalogosDelFormulario();
  inicializarModoRevision();
  inicializarFormularioDinamico();
  inicializarBuscadorCups();
  inicializarCierreIncompleto();
  retirarDatosDemostracion();
  inicializarNavegacion();
  inicializarFiltrosHistorial();
  inicializarFormulario();
  inicializarModales();
  reiniciarEstadoFormulario();

  renderizarInicio();
  renderizarHistorial();

  mostrarNotificacion('Bienvenido a Encuesta_APS. Se cargaron datos de demostración.', 'info');
}

document.addEventListener('DOMContentLoaded', inicializarAplicacion);
