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
    const cacheCatalogos = localStorage.getItem('aps_catalogos_dinamicos');
    if (cacheCatalogos) {
      fijarCatalogosDinamicos(JSON.parse(cacheCatalogos));
    }
  } catch (error) {
    console.warn('No fue posible leer los catálogos dinámicos guardados:', error);
  }

  try {
    const [resAcciones, resCatalogos] = await Promise.all([
      fetch('/api/catalogo_acciones'),
      fetch('/api/catalogo_dinamico')
    ]);

    if (resAcciones.ok) {
      const filas = await resAcciones.json();
      if (Array.isArray(filas) && filas.length > 0) {
        fijarCatalogoAcciones(filas);
        localStorage.setItem(CLAVE_CACHE_ACCIONES, JSON.stringify(filas));
        repintarSelectsDeAccion();
      }
    }

    if (resCatalogos.ok) {
      const dataCatalogos = await resCatalogos.json();
      fijarCatalogosDinamicos(dataCatalogos);
      localStorage.setItem('aps_catalogos_dinamicos', JSON.stringify(dataCatalogos));
      /* El select del ítem 7 se llenó al arrancar con el catálogo que hubiera
         (el estático o la copia guardada); si la base trae territorios nuevos
         hay que repintarlo, conservando lo ya elegido. */
      repintarTerritorios();
      // Re-render components that might have been initialized empty
      if (typeof ventana === 'undefined' && typeof document !== 'undefined') {
        const eapbSelects = document.querySelectorAll('[data-catalogo="CAT_EAPB"]');
        eapbSelects.forEach(select => llenarSelect(select.id, CAT_EAPB));
        const prestadorSelects = document.querySelectorAll('[data-catalogo="CAT_PRESTADOR"]');
        prestadorSelects.forEach(select => llenarSelect(select.id, CAT_PRESTADOR));
      }
    }
  } catch (error) {
    if (CAT_ACCION_PLAN.length === 0) {
      console.error('No fue posible cargar catálogos:', error);
      mostrarNotificacion(
        'No se pudieron cargar algunos catálogos. ' +
        'Conéctese al menos una vez para descargarlos.', 'warning');
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

  /* RN-011: la ficha la diligencia únicamente la E.S.E. Ladera, así que el
     prestador es un valor fijo, igual que la entidad territorial. El resto
     del catálogo sigue en la base por si otra ESE llega a usar la herramienta. */
  llenarSelect('prestadorPrimario', [{ valor: PRESTADOR_FIJO.valor, etiqueta: PRESTADOR_FIJO.etiqueta }],
    { placeholder: null, seleccionado: PRESTADOR_FIJO.valor });
  document.getElementById('prestadorPrimario').classList.add('is-fijo');

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

/** Vuelve a llenar el ítem 7 con el catálogo vigente sin perder la selección. */
function repintarTerritorios() {
  const select = document.getElementById('territorio');
  if (!select) return;
  const elegido = select.value;
  const micro = document.getElementById('microterritorio');
  const microElegido = micro ? micro.value : '';
  llenarSelect('territorio', catalogoTerritorios());
  if (elegido && CAT_TERRITORIOS[elegido]) {
    select.value = elegido;
    actualizarMicroterritorios();
    if (micro && microElegido) micro.value = microElegido;
  }
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
    return { valor: mt.codigo, etiqueta: etiquetaMicroterritorio(mt) };
  }));
  selectMicro.disabled = false;

  const comuna = comunaDeTerritorio(codigoTerritorio);
  // Sin comuna en el catálogo (territorios fuera del Anexo A) el derivado queda vacío.
  campoComuna.value = !comuna ? '' : (comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna);
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

/* RN-018 / RN-019 — Lo que depende del entorno del ítem 17.
   En Hogar el ítem 18 se bloquea (no hay institución que nombrar) y el 19
   deja de ser obligatorio: la cabeza de familia es el responsable económico
   del ítem 72 y se toma de allí al guardar si se deja vacío. */
function actualizarCampoInstitucion() {
  const entorno = document.getElementById('entornoAbordaje').value;
  const esHogar = entorno === ENTORNO_HOGAR;
  const esObligatorio = ENTORNOS_CON_INSTITUCION.indexOf(entorno) !== -1;

  const institucion = document.getElementById('nombreInstitucion');
  institucion.disabled = esHogar;
  if (esHogar) institucion.value = '';
  document.getElementById('marcaInstitucion').textContent = esObligatorio ? '(obligatorio)' : (esHogar ? '(no aplica en Hogar)' : '');
  document.getElementById('ayudaInstitucion').hidden = !esHogar;

  document.getElementById('marcaCabezaFamilia').textContent = esHogar ? '(opcional en Hogar)' : '*';
  document.getElementById('ayudaCabezaFamilia').hidden = !esHogar;
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

/* ---------------------------------------------------------
   10.1 FICHAS GUARDADAS DESDE OTRO DISPOSITIVO
   ---------------------------------------------------------
   `obtenerEncuestas()` sólo ve `localStorage`, que es de este navegador y de
   ningún otro. Una ficha diligenciada y sincronizada desde otro equipo
   llegaba a la base, pero nada volvía a pedirla: el historial de cualquier
   otro dispositivo la mostraba como si no existiera.

   Este bloque trae el resto —lo que hay en la base y no está en este
   dispositivo— y lo combina con lo local sólo para MOSTRARLO. La base sigue
   sin ser la fuente de verdad de las funciones que escriben
   (agregarEncuesta, reemplazarEncuesta, eliminarEncuestaPorId): esas siguen
   operando sobre localStorage exactamente igual que antes.
   --------------------------------------------------------- */

/* `null` antes de la primera consulta; luego, el último listado que
   contestó el servidor. Se conserva entre renders para que aplicar un
   filtro no dispare una petición de red en cada tecla. */
let cacheFichasDelServidor = null;

/**
 * Vuelve a pedir el listado a la base y lo deja en la caché. Se llama al
 * entrar a Inicio o Historial, no en cada render: son las dos vistas que
 * necesitan verlo, y volver a pedirlo en cada filtro sería tan lento como
 * inútil, porque el filtro no cambia lo que hay en la base.
 */
async function refrescarFichasDelServidor() {
  try {
    const respuesta = await fetch('/api/listar_fichas');
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

    const filas = await respuesta.json();
    if (!Array.isArray(filas)) throw new Error('respuesta con forma inesperada');

    cacheFichasDelServidor = filas.map(function (fila) {
      /* El endpoint sólo trae los códigos de territorio y microterritorio; el
         nombre lo resuelve el catálogo que el navegador ya tiene cargado,
         igual que hace `recolectarDatosFormulario` con lo que sale del
         formulario. Sin esto, el historial mostraría "MT02" en vez de
         "MT02 — Meléndez", y el buscador de texto no lo encontraría por
         nombre. */
      const datosMicro = buscarMicroterritorio(fila.territorio, fila.microterritorio);

      return Object.assign({}, fila, {
        /* El id local es el que genera `generarId()`; una fila de la base no
           tiene ninguno propio y no lo necesita para escribir, así que se usa
           el código de la ficha —único por columna `codigo`— como su
           identificador en pantalla. */
        id: fila.codigoFicha,
        sincronizada: true,
        microterritorioNombre: datosMicro ? datosMicro.nombre : null,
        /* Marca que distingue una fila que sólo existe en la base de una
           diligenciada en este dispositivo: la primera no trae familias,
           integrantes ni planes, así que Corregir no tiene de dónde
           repoblar el formulario, y Eliminar no borra nada real. */
        soloEnServidor: true
      });
    });
  } catch (error) {
    /* Sin red, o el servidor caído: se seguirá mostrando la última copia
       que sí llegó a responder, si la hay. No es un error del encuestador
       y no interrumpe con un aviso; es exactamente el caso para el que
       existe la cola de sincronización. */
    console.warn('No fue posible traer las fichas de la base:', error);
  }

  return cacheFichasDelServidor || [];
}

/**
 * Lo local, más lo que hay en la base y no está local, en un solo listado
 * ordenado por fecha. Es lo que leen las vistas; no lee red por sí mismo,
 * usa lo que dejó `refrescarFichasDelServidor()`.
 *
 * La preferencia es del registro local cuando el mismo código aparece en
 * los dos lados: es el mismo que ya tiene su detalle completo —familias,
 * integrantes, planes— y puede seguir corrigiéndose y eliminándose desde
 * aquí. Traer la versión resumida de la base lo empobrecería sin necesidad.
 */
function obtenerEncuestasParaMostrar() {
  const locales = obtenerEncuestas();
  const codigosLocales = new Set(
    locales.map(function (e) { return e.codigoFicha; }).filter(Boolean)
  );

  const remotas = (cacheFichasDelServidor || []).filter(function (e) {
    return !codigosLocales.has(e.codigoFicha);
  });

  return locales.concat(remotas).sort(function (a, b) {
    return new Date(b.fechaRegistro || 0) - new Date(a.fechaRegistro || 0);
  });
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

/**
 * `alCerrar` se ejecuta cuando el aviso ya se cerró del todo. Es el momento
 * para desplazar la página: mientras el aviso está abierto el cuerpo no se
 * puede desplazar, y al cerrarse devuelve el foco a donde estaba, lo que
 * desharía cualquier salto hecho antes.
 */
function mostrarNotificacion(mensaje, tipo, alCerrar) {
  tipo = tipo || 'info';

  /* Sin SweetAlert (pruebas en jsdom, CDN caído) el aviso no puede bloquear
     el flujo: se deja constancia en consola y se sigue. */
  if (typeof Swal === 'undefined') {
    console.log('[' + TITULOS_TOAST[tipo] + '] ' + mensaje);
    if (typeof alCerrar === 'function') setTimeout(alCerrar, 0);
    return;
  }

  Swal.fire({
    title: TITULOS_TOAST[tipo],
    text: mensaje,
    icon: tipo,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#0060a0',
    background: '#ffffff',
    color: '#0b1220',
    didClose: typeof alCerrar === 'function' ? alCerrar : undefined
  });
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
  moverIndicadorDeTabs();

  if (nombreVista === 'inicio') {
    renderizarInicio();
    /* Se repinta otra vez cuando conteste la base: la primera pintura usa la
       caché que ya hubiera (o nada, la primera vez), para que la pestaña no
       se vea vacía mientras la red contesta. */
    refrescarFichasDelServidor().then(renderizarInicio);
  }
  if (nombreVista === 'historial') {
    renderizarHistorial();
    refrescarFichasDelServidor().then(renderizarHistorial);
  }
}

/* El indicador azul de las pestañas es un solo elemento que se desliza
   hasta la pestaña activa, en vez de pintar y despintar cada botón. Se
   mide en pantalla porque las etiquetas cambian de ancho con la fuente y
   se ocultan en móvil. */
function moverIndicadorDeTabs() {
  const tabs = document.getElementById('appTabs');
  const activa = tabs && tabs.querySelector('.app-tabs__btn.is-active');
  if (!tabs || !activa) return;
  tabs.style.setProperty('--tab-x', activa.offsetLeft + 'px');
  tabs.style.setProperty('--tab-w', activa.offsetWidth + 'px');
  tabs.style.setProperty('--tab-ready', '1');
  tabs.classList.add('app-tabs--listo');
}

function inicializarNavegacion() {
  document.querySelectorAll('.app-tabs__btn').forEach(function (boton) {
    boton.addEventListener('click', function () {
      cambiarVista(boton.dataset.view);
    });
  });

  document.querySelectorAll('[data-goto]').forEach(function (elemento) {
    elemento.addEventListener('click', function (evento) {
      evento.preventDefault();
      cambiarVista(elemento.dataset.goto);
    });
  });

  /* La medida depende de la fuente cargada y del ancho de la ventana. */
  window.addEventListener('resize', moverIndicadorDeTabs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moverIndicadorDeTabs);
  moverIndicadorDeTabs();
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

  const planPendiente = encuestas.filter(function (e) {
    return e.planCuidado && e.planCuidado.pendiente === true;
  }).length;

  return {
    totalEncuestas: encuestas.length,
    conHacinamiento: conHacinamiento,
    situacionesInminentes: situacionesInminentes,
    territoriosCubiertos: territorios.size,
    planPendiente: planPendiente
  };
}

/* Dice si el equipo pidió menos movimiento. Se consulta en cada uso y no se
   guarda en caché: se puede cambiar en el sistema con la página abierta. */
function prefiereMenosMovimiento() {
  return window.matchMedia &&
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lleva la cifra de un indicador desde lo que hay en pantalla hasta su nuevo
 * valor contando. No es adorno: Inicio se repinta dos veces seguidas (primero
 * con la caché, después con lo que conteste la base) y el conteo es lo que
 * hace visible que una cifra acaba de cambiar, en vez de que salte sin aviso.
 *
 * Arranca desde el valor que se esté mostrando, no desde cero: si la base
 * contesta a mitad de cuenta, la cifra sigue desde donde va en lugar de
 * reiniciarse.
 */
function animarCifra(elemento, destino, retardo) {
  const actual = Number(elemento.dataset.valor || 0);

  if (elemento.rafCifra) cancelAnimationFrame(elemento.rafCifra);
  elemento.dataset.valor = destino;

  if (actual === destino || prefiereMenosMovimiento()) {
    elemento.textContent = destino;
    elemento.rafCifra = null;
    return;
  }

  /* 90 ms por unidad con techo de 900: contar tres fichas no puede tardar lo
     mismo que contar trescientas. */
  const distancia = Math.abs(destino - actual);
  const duracion = Math.min(900, 320 + distancia * 90);
  const arranque = performance.now() + (retardo || 0);

  function paso(ahora) {
    const t = Math.max(0, Math.min(1, (ahora - arranque) / duracion));
    const suave = 1 - Math.pow(1 - t, 3);        /* ease-out cúbico */
    elemento.textContent = Math.round(actual + (destino - actual) * suave);
    if (t < 1) {
      elemento.rafCifra = requestAnimationFrame(paso);
    } else {
      elemento.textContent = destino;
      elemento.rafCifra = null;
    }
  }

  elemento.textContent = actual;
  elemento.rafCifra = requestAnimationFrame(paso);
}

function plantillaIndicador(tarjeta, orden) {
  return (
    '<div class="indicator-card entra" style="--orden: ' + orden + '">' +
      '<div class="indicator-card__icon indicator-card__icon--' + tarjeta.clase + '">' + tarjeta.icono + '</div>' +
      '<div class="indicator-card__datos">' +
        '<div class="indicator-card__cifra">' +
          '<span class="indicator-card__value">0</span>' +
        '</div>' +
        '<div class="indicator-card__label">' +
          '<span>' + tarjeta.etiqueta + '</span>' +
          '<span class="indicator-card__punto" aria-hidden="true"></span>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderizarIndicadores(encuestas) {
  const indicadores = calcularIndicadores(encuestas);
  const contenedor = document.getElementById('indicatorsGrid');
  if (!contenedor) return;

  /* El total ya no es una teja más: vive en el marcador del bento, con su
     propio peso. Aquí quedan las cuatro cifras de estado del territorio.

     "estado" tiñe la cifra y enciende el punto de 6 px, pero sólo cuando el
     valor es mayor que cero: «0 situaciones inminentes» es una buena noticia,
     no una alerta. Territorios cubiertos no es un estado, es un recuento, y
     por eso no lleva "estado". */
  const marcador = document.getElementById('totalFichas');
  if (marcador) animarCifra(marcador, indicadores.totalEncuestas, 0);

  const tarjetas = [
    { icono: '<i class="ph ph-bed"></i>', clase: 'red', valor: indicadores.conHacinamiento, etiqueta: 'Hogares con hacinamiento', estado: 'alerta' },
    { icono: '<i class="ph ph-warning-circle"></i>', clase: 'amber', valor: indicadores.situacionesInminentes, etiqueta: 'Situaciones inminentes', estado: 'alerta' },
    { icono: '<i class="ph ph-map-pin"></i>', clase: 'blue', valor: indicadores.territoriosCubiertos, etiqueta: 'Territorios cubiertos' },
    { icono: '<i class="ph ph-clock-countdown"></i>', clase: 'amber', valor: indicadores.planPendiente, etiqueta: 'Plan de cuidado pendiente', estado: 'aviso' }
  ];

  /* Las tejas se construyen una sola vez y después se parchean en sitio. Si
     se reescribiera el innerHTML en cada repintado, la entrada escalonada se
     dispararía otra vez cada vez que contesta la base y la pantalla parecería
     estar recargándose sola. */
  const primeraPintura = contenedor.children.length !== tarjetas.length;
  if (primeraPintura) {
    contenedor.innerHTML = tarjetas.map(function (tarjeta, i) {
      return plantillaIndicador(tarjeta, i + 1);
    }).join('');
  }

  tarjetas.forEach(function (tarjeta, i) {
    const teja = contenedor.children[i];
    if (!teja) return;
    const activo = tarjeta.valor > 0;

    teja.classList.toggle('indicator-card--cero', !activo);
    teja.classList.toggle('indicator-card--alerta', activo && tarjeta.estado === 'alerta');
    teja.classList.toggle('indicator-card--aviso', activo && tarjeta.estado === 'aviso');

    const cifra = teja.querySelector('.indicator-card__value');
    /* El conteo empieza cuando la teja termina de entrar (55 ms por hermano,
       el mismo --stagger del CSS), para que no cuente detrás de una tarjeta
       que todavía se está desplazando. */
    if (cifra) animarCifra(cifra, tarjeta.valor, primeraPintura ? (i + 1) * 55 : 0);
  });
}

/**
 * Píldora de sincronización del encabezado de Inicio. Cuenta exactamente lo
 * mismo que cuenta sincronizarEncuestas(): fichas de este equipo que aún no
 * están en la base. Verde y quieta cuando no queda nada; ámbar y pulsable
 * cuando sí, con la acción que resuelve el estado en el mismo sitio donde se
 * lee el estado.
 */
function renderizarEstadoSync() {
  const caja = document.getElementById('estadoSync');
  if (!caja) return;

  const locales = obtenerEncuestas();
  const pendientes = locales.filter(function (e) { return e.sincronizada !== true; }).length;
  const punto = '<span class="estado-sync__punto" aria-hidden="true"></span>';

  if (pendientes === 0) {
    caja.innerHTML =
      '<span class="estado-sync estado-sync--listo">' + punto +
        (locales.length === 0 ? 'Sin fichas por subir' : 'Todo sincronizado') +
      '</span>';
    return;
  }

  caja.innerHTML =
    '<button type="button" class="estado-sync estado-sync--pendiente" ' +
      'onclick="sincronizarEncuestas()" ' +
      'title="Subir ahora las fichas que sólo están en este equipo">' + punto +
      '<span><span class="estado-sync__contador">' + pendientes + '</span> ' +
        (pendientes === 1 ? 'ficha sin subir' : 'fichas sin subir') +
      '</span>' +
    '</button>';
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

/* RN-220 (plan diferido): distintivo del historial. Es una muestra, no un
   error: ámbar para el pendiente, verde para el registrado, y un guion
   cuando la fila no trae el dato (fichas anteriores a esta marca). */
function badgePlanCuidado(encuesta) {
  const plan = encuesta && encuesta.planCuidado;
  if (!plan || typeof plan.pendiente !== 'boolean') return '<span class="badge badge--neutral">—</span>';

  if (plan.pendiente) {
    const detalle = plan.alertasSinConducta > 0
      ? plan.alertasSinConducta + ' alerta(s) sin conducta'
      : 'sin acciones registradas';
    return '<span class="badge badge--plan-pendiente" title="' + escaparHtml(detalle) +
      '. Complételo desde Corregir."><i class="ph ph-clock-countdown"></i>Pendiente</span>';
  }
  return '<span class="badge badge--plan-registrado" title="' + plan.accionesRegistradas +
    ' acción(es) registrada(s)">Registrado</span>';
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
  if (fechas.length === 0) return '<span class="badge badge--neutral">Sin modificaciones</span>';
  const ultima = fechas[fechas.length - 1];
  return '<span class="badge badge--info" title="' + fechas.length + ' modificaciones">' + formatearFecha(ultima) + ' (' + fechas.length + ')</span>';
}

function textoMicroterritorio(encuesta) {
  if (!encuesta.microterritorio) return '—';
  const nombre = encuesta.microterritorioNombre;
  return escaparHtml(encuesta.microterritorio + (nombre ? ' — ' + nombre : ''));
}

function renderizarInicio() {
  const encuestas = obtenerEncuestasParaMostrar();
  renderizarIndicadores(encuestas);
  renderizarEstadoSync();

  /* El panel de «todavía no hay fichas» sólo tiene sentido cuando de verdad
     no hay ninguna: en cuanto entra la primera, los indicadores ya cuentan la
     historia y el panel estorba. */
  const vacio = document.getElementById('inicioVacio');
  if (vacio) vacio.hidden = encuestas.length > 0;
}

/* ---------------------------------------------------------
   15. RENDERIZADO — VISTA HISTORIAL (tabla + filtros)
   --------------------------------------------------------- */

function obtenerEncuestasFiltradas() {
  const texto = document.getElementById('filtroTexto').value.trim().toLowerCase();
  const filtroHacinamiento = document.getElementById('filtroHacinamiento').value;
  const filtroPlan = document.getElementById('filtroPlanCuidado').value;

  return obtenerEncuestasParaMostrar().filter(function (encuesta) {
    const coincideTexto = !texto || String(encuesta.codigoFicha).toLowerCase().includes(texto);

    const coincideHacinamiento = !filtroHacinamiento || encuesta.hacinamiento === filtroHacinamiento;

    const plan = encuesta.planCuidado;
    const coincidePlan = !filtroPlan ||
      (filtroPlan === 'pendiente' ? !!(plan && plan.pendiente) : !!(plan && plan.pendiente === false));

    return coincideTexto && coincideHacinamiento && coincidePlan;
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
    estadoVacio.textContent = obtenerEncuestasParaMostrar().length === 0
      ? 'Todavía no hay encuestas registradas. Diligencie la primera desde la pestaña «Nueva Encuesta».'
      : 'No se encontraron registros con los filtros seleccionados.';
    estadoVacio.hidden = false;
    return;
  }
  estadoVacio.hidden = true;

  cuerpoTabla.innerHTML = encuestas.map(function (encuesta) {
    const personasPorHabitacion = encuesta.personasPorHabitacion === null || encuesta.personasPorHabitacion === undefined
      ? '—' : encuesta.personasPorHabitacion;

    /* Una fila que sólo existe en la base —diligenciada en otro dispositivo—
       no trae familias, integrantes ni planes: no hay de dónde repoblar el
       formulario. Corregir queda deshabilitado con el motivo en el título en
       vez de abrir un formulario a medio llenar. Eliminar también: borraría
       sólo de este navegador y la fila volvería a aparecer en el siguiente
       refresco, dando a entender que se eliminó cuando no fue así. */
    const remota = encuesta.soloEnServidor === true;
    const deshabilitado = remota ? ' disabled title="Diligenciada desde otro dispositivo: sólo se puede ver desde aquí."' : '';

    return (
      '<tr>' +
        /* El código y el estado hacen falta para poder actuar sobre la fila:
           los rechazos de la API nombran la ficha por su código, y sin verlo
           aquí no había manera de saber cuál de todas hay que corregir. */
        '<td data-label="Ficha">' + textoSeguro(encuesta.codigoFicha) + '</td>' +
        '<td data-label="Estado">' + badgeSincronizacion(encuesta.sincronizada) + '</td>' +
        '<td data-label="Plan de cuidado">' + badgePlanCuidado(encuesta) + '</td>' +
        '<td data-label="Fecha">' + formatearFecha(encuesta.fechaRegistro) + '</td>' +
        '<td data-label="Modificación">' + textoModificacion(encuesta) + '</td>' +
        '<td data-label="Territorio">' + textoTerritorio(encuesta) + '</td>' +
        '<td data-label="Microterritorio">' + textoMicroterritorio(encuesta) + '</td>' +
        '<td data-label="Dirección">' + textoSeguro(encuesta.direccion) + '</td>' +
        '<td data-label="Personas/Hab.">' + personasPorHabitacion + '</td>' +
        '<td data-label="Hacinamiento">' + badgeHacinamiento(encuesta.hacinamiento) + '</td>' +
        '<td data-label="Situación inminente">' + badgeSituacion(encuesta.situacionInminente) + '</td>' +
        '<td class="actions-cell">' +
          '<button type="button" class="btn btn--ghost btn--icon" data-ver="' + encuesta.id + '">Ver</button>' +
          '<button type="button" class="btn btn--ghost btn--icon" data-corregir="' + encuesta.id + '"' + deshabilitado + '>Corregir</button>' +
          '<button type="button" class="btn btn--danger btn--icon" data-eliminar="' + encuesta.id + '"' + deshabilitado + '>Eliminar</button>' +
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
  document.getElementById('filtroPlanCuidado').addEventListener('change', renderizarHistorial);
  document.getElementById('btnLimpiarFiltros').addEventListener('click', function () {
    document.getElementById('filtroTexto').value = '';
    document.getElementById('filtroHacinamiento').value = '';
    document.getElementById('filtroPlanCuidado').value = '';
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

async function abrirModalDetalle(id) {
  let encuesta = obtenerEncuestasParaMostrar().find(function (e) { return e.id === id; });
  if (!encuesta) {
    mostrarNotificacion('No se encontró la encuesta seleccionada.', 'error');
    return;
  }

  /* Una fila de la base sólo trae lo que necesita la tabla del historial
     (`listar_fichas`); lo que pinta este modal es bastante más. Se completa
     aquí, en el momento de abrirlo, para no traer el detalle de cientos de
     filas que nadie va a mirar. */
  if (encuesta.soloEnServidor) {
    try {
      const respuesta = await fetch('/api/obtener_ficha?codigo=' + encodeURIComponent(encuesta.codigoFicha));
      if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

      /* El endpoint trae los códigos, no los nombres: departamento y
         municipio son fijos en toda la aplicación —esta ficha es de un solo
         municipio— y el navegador ya los tiene como constantes. Es lo mismo
         que hace `recolectarDatosFormulario` con lo que sale del formulario;
         sin esto el modal mostraba «76 — undefined». */
      encuesta = Object.assign({}, encuesta, await respuesta.json(), {
        departamento: CAT_DEPARTAMENTO.nombre,
        municipio: CAT_MUNICIPIO.nombre
      });
    } catch (error) {
      console.error('No fue posible traer el detalle de la ficha:', error);
      mostrarNotificacion(
        'No fue posible traer el detalle de esta ficha. Verifique la conexión e intente de nuevo.',
        'error');
      return;
    }
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
    ]) +
    construirSeccionDetalle('Plan de cuidado (RN-220)', [
      { etiqueta: 'Estado', valor: describirEstadoPlan(encuesta.planCuidado) },
      { etiqueta: 'Acciones registradas', valor: encuesta.planCuidado ? encuesta.planCuidado.accionesRegistradas : null },
      { etiqueta: 'Alertas sin conducta', valor: encuesta.planCuidado ? encuesta.planCuidado.alertasSinConducta : null }
    ]);

  document.getElementById('modalDetalle').hidden = false;
}

function describirEstadoPlan(plan) {
  if (!plan || typeof plan.pendiente !== 'boolean') return null;
  return plan.pendiente
    ? 'Pendiente — puede completarse desde Historial → Corregir'
    : 'Registrado';
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
  /* El botón que llama a esto está deshabilitado para las filas que sólo
     existen en la base (ver renderizarHistorial), pero se comprueba también
     aquí: eliminar algo que no está en este dispositivo no borraría nada
     real y, peor, diría «eliminada correctamente» sobre una ficha que va a
     seguir apareciendo en el próximo refresco. */
  const encuesta = obtenerEncuestas().find(function (e) { return e.id === id; });
  if (!encuesta) {
    mostrarNotificacion(
      'Esta ficha se diligenció desde otro dispositivo: no se puede eliminar desde aquí.',
      'warning');
    return;
  }

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
  formulario.querySelectorAll('.has-error, .has-warning').forEach(limpiarMarcaDeCampo);
}

/** Quita de un contenedor la marca de error o de advertencia y su mensaje. */
function limpiarMarcaDeCampo(contenedor) {
  contenedor.classList.remove('has-error', 'has-warning');
  contenedor.querySelectorAll('.field-error-msg, .field-warning-msg').forEach(function (aviso) {
    aviso.remove();
  });
}

/**
 * Traduce la ruta con la que las reglas nombran un control a la que lleva en
 * el DOM. Coinciden salvo en los planes 6.2 y 6.3: las reglas los ven colgados
 * de su familia o integrante (`familias[0].planFamilia.acciones[0].x`), pero
 * en pantalla viven en su propia colección (`planesFamilia[2].acciones[0].x`)
 * y se enlazan por el selector de familia o de integrante.
 */
function rutaEnPantalla(formulario, ruta) {
  if (!ruta) return ruta;

  const planFamilia = /^familias\[(\d+)\]\.planFamilia(.*)$/.exec(ruta);
  if (planFamilia) {
    const selector = Array.prototype.find.call(
      formulario.querySelectorAll('[data-rol="selectorFamilia"]'),
      function (s) { return s.value === planFamilia[1]; });
    if (!selector) return ruta;
    return selector.name.replace(/\.familiaRef$/, '') + planFamilia[2];
  }

  const planPersona = /^familias\[(\d+)\]\.integrantes\[(\d+)\]\.planPersona(.*)$/.exec(ruta);
  if (planPersona) {
    const clave = planPersona[1] + ':' + planPersona[2];
    const selector = Array.prototype.find.call(
      formulario.querySelectorAll('[data-rol="selectorIntegrante"]'),
      function (s) { return s.value === clave; });
    if (!selector) return ruta;
    return selector.name.replace(/\.integranteRef$/, '') + planPersona[3];
  }

  return ruta;
}

/** El control que una regla señala por su ruta, o null si no hay uno con ese nombre. */
function controlPorRuta(formulario, ruta) {
  if (!ruta) return null;
  return formulario.querySelector('[name="' + rutaEnPantalla(formulario, ruta) + '"]');
}

/** El contenedor donde se pinta el error de un control, buscado por su ruta. */
function contenedorPorRuta(formulario, ruta) {
  const control = controlPorRuta(formulario, ruta);
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

/** Igual que marcarIncumplimiento, en ámbar: la advertencia no bloquea. */
function marcarAdvertencia(formulario, advertencia) {
  const contenedor = contenedorPorRuta(formulario, advertencia.ruta) ||
    formulario.querySelector('[data-campo="' + advertencia.campo + '"]');

  // Un error ya visible manda sobre la advertencia.
  if (!contenedor || contenedor.querySelector('.field-error-msg, .field-warning-msg')) return contenedor;

  contenedor.classList.add('has-warning');
  const aviso = document.createElement('span');
  aviso.className = 'field-warning-msg';
  aviso.textContent = advertencia.codigo + ': ' + advertencia.mensaje;
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
    /* RN-220 (plan diferido): la ficha lleva consigo si su plan de cuidado
       quedó pendiente, para distinguirla en el historial sin reevaluarla. */
    planCuidado: resumenPlanParaGuardar(resumirPlanCuidado(datos, alertas)),
    alertas: alertas.map(function (alerta) {
      return {
        codigo: alerta.codigo, prioridad: alerta.prioridad, titulo: alerta.titulo,
        referencia: alerta.referencia, notificaSivigila: alerta.notificaSivigila
      };
    })
  });

  // RN-019: en Hogar, la cabeza de familia se toma del responsable económico si quedó vacía.
  encuesta.cabezaFamilia = liderDelEntorno(datos) || encuesta.cabezaFamilia;

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
    if (alerta.bloqueaSincronizacion) pies.push('<span class="pill-meta pill-meta--bloquea">Conducta obligatoria</span>');
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

/** Lo que de `resumirPlanCuidado` se persiste con la ficha. */
function resumenPlanParaGuardar(resumen) {
  return {
    pendiente: resumen.pendiente,
    accionesRegistradas: resumen.accionesRegistradas,
    alertasSinConducta: resumen.alertasSinConducta
  };
}

/**
 * RN-220 (plan diferido) — Pinta el estado del plan de cuidado en el cierre.
 * Es un pendiente, no un impedimento: la ficha se guarda igual y queda
 * marcada hasta que el plan se complete.
 */
function renderizarPlanCuidado(resumen) {
  const estado = document.getElementById('estadoPlanCuidado');
  const lista = document.getElementById('listaPendientesPlan');
  if (!estado || !lista) return;

  const pendiente = !resumen || resumen.pendiente;
  estado.className = 'estado-plan ' + (pendiente ? 'estado-plan--pendiente' : 'estado-plan--registrado');
  document.getElementById('estadoPlanIcono').className =
    'estado-plan__icono ph ' + (pendiente ? 'ph-clock-countdown' : 'ph-check-circle');

  const acciones = resumen ? resumen.accionesRegistradas : 0;
  const sinConducta = resumen ? resumen.alertasSinConducta : 0;
  const textoAcciones = acciones === 1 ? '1 acción registrada' : acciones + ' acciones registradas';

  let detalle;
  if (!pendiente) {
    detalle = textoAcciones + ' y todas las alertas tienen conducta.';
  } else if (acciones === 0 && sinConducta === 0) {
    detalle = 'No impide guardar. No hay ninguna acción registrada. ' +
      'Puede completarlo ahora en la sección 6 o después desde Historial → Corregir.';
  } else {
    detalle = 'No impide guardar. ' + textoAcciones + ' y ' + sinConducta +
      ' alerta(s) sin conducta. Puede completarlo ahora en la sección 6 o después desde Historial → Corregir.';
  }

  document.getElementById('estadoPlanTitulo').textContent = pendiente
    ? 'Plan de cuidado pendiente' : 'Plan de cuidado registrado';
  document.getElementById('estadoPlanDetalle').textContent = detalle;

  lista.innerHTML = pendiente && resumen
    ? resumen.pendientes.map(function (item) {
        const referencia = item.referencia
          ? '<span class="pill-meta">' + escaparHtml(item.referencia) + '</span>' : '';
        const prioridad = item.prioridad
          ? '<span class="pill-meta">' + escaparHtml(ETIQUETA_PRIORIDAD[item.prioridad] || item.prioridad) + '</span>' : '';
        return '<div class="alerta-item alerta-item--pendiente-plan">' +
          '<div class="alerta-item__cuerpo">' +
            '<span class="alerta-item__titulo">' + escaparHtml(item.mensaje) + '</span>' +
            '<div class="alerta-item__pies">' +
              '<span class="pill-meta">' + escaparHtml(item.codigo) + '</span>' + prioridad + referencia +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('')
    : '';
}

/* Los impedimentos de la lista de cierre se pintan en el orden que los devuelve
   validarCierre, mientras que el navegador los ordena por posición; al hacer
   clic en uno se resuelve su destino desde aquí y no por índice del navegador. */
let ultimosImpedimentos = [];

/** RN-222 — Lista los impedimentos que bloquean el cierre. */
function renderizarImpedimentos(impedimentos) {
  const contenedor = document.getElementById('listaImpedimentos');
  ultimosImpedimentos = impedimentos;

  if (impedimentos.length === 0) {
    contenedor.innerHTML = estadoVacioHtml('impedimentosEmptyState', TEXTO_SIN_IMPEDIMENTOS);
    return;
  }

  /* Cada impedimento es un enlace al campo que lo causa: el índice en
     `data-pendiente` lo conecta con el navegador de pendientes. */
  contenedor.innerHTML = impedimentos.map(function (item, indice) {
    const referencia = item.referencia
      ? '<span class="pill-meta">' + escaparHtml(item.referencia) + '</span>' : '';
    return '<div class="alerta-item alerta-item--inmediata alerta-item--enlace" role="button" tabindex="0" ' +
        'data-pendiente="' + indice + '" title="Ir al campo">' +
      '<div class="alerta-item__cuerpo">' +
        '<span class="alerta-item__titulo">' + escaparHtml(item.mensaje) + '</span>' +
        '<div class="alerta-item__pies">' +
          '<span class="pill-meta">' + escaparHtml(item.codigo) + '</span>' +
          (item.bloque ? '<span class="pill-meta">' + escaparHtml(item.bloque) + '</span>' : '') +
          referencia +
        '</div>' +
      '</div>' +
      '<i class="ph ph-arrow-bend-up-left alerta-item__ir" aria-hidden="true"></i>' +
    '</div>';
  }).join('');
}

/* ---------------------------------------------------------
   18.2 NAVEGADOR DE PENDIENTES
   Al intentar guardar con errores aparece una barra fija al pie que recorre
   los campos pendientes de uno en uno, lista todos y, cuando ya no queda
   ninguno, devuelve al botón Guardar. Se recalcula con cada cambio del
   formulario para que el conteo baje a medida que se corrige.
   --------------------------------------------------------- */

const navegadorPendientes = {
  activo: false,       // se enciende al intentar guardar con errores
  origen: 'local',     // 'local': reglas del navegador · 'servidor': rechazo del API
  items: [],           // [{ destino, control, codigo, mensaje, referencia, etiqueta }]
  indice: -1,
  temporizador: null
};

/* Sección a la que se salta cuando un impedimento no señala un control
   concreto (familias sin caracterizar, alertas sin conducta, etc.). */
const SECCION_POR_BLOQUE = {
  'Autorización': 'seccion-1',
  ficha: 'seccion-2',
  vivienda: 'seccion-3', Vivienda: 'seccion-3',
  saneamiento: 'seccion-3-3',
  familia: 'seccion-4', Familia: 'seccion-4', integrante: 'seccion-4',
  plan: 'seccion-6', 'Plan de cuidado': 'seccion-6',
  'Salud mental': 'seccion-6-3'
};

function bloquesDeFamilia() {
  return document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]');
}

/** El bloque de familia que nombra una referencia («Familia 2 · Ana Pérez»). */
function familiaPorReferencia(referencia) {
  const coincidencia = /Familia\s+(\d+)/.exec(referencia || '');
  return coincidencia ? bloquesDeFamilia()[parseInt(coincidencia[1], 10) - 1] || null : null;
}

/** El bloque (familia, integrante o plan) al que apunta una ruta sin control propio. */
function bloquePorRuta(formulario, ruta) {
  const enPantalla = rutaEnPantalla(formulario, ruta || '');

  const plan = /^(planesFamilia|planesPersona)\[(\d+)\]/.exec(enPantalla);
  if (plan) {
    const tipo = plan[1] === 'planesFamilia' ? 'planFamilia' : 'planPersona';
    return formulario.querySelector('[data-bloque="' + tipo + '"][data-indice="' + plan[2] + '"]');
  }
  if (/^planVivienda/.test(enPantalla)) return document.getElementById('seccion-6-1');

  const familia = /^familias\[(\d+)\]/.exec(enPantalla);
  if (!familia) return null;
  const bloqueFamilia = bloquesDeFamilia()[parseInt(familia[1], 10)];
  if (!bloqueFamilia) return null;

  const integrante = /integrantes\[(\d+)\]/.exec(enPantalla);
  if (!integrante) return bloqueFamilia;
  return bloqueFamilia.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]')[
    parseInt(integrante[1], 10)] || bloqueFamilia;
}

/**
 * Resuelve a qué elemento de la pantalla lleva un impedimento. Devuelve
 * `{ destino, control }`: `destino` es lo que se enfoca y resalta; `control`
 * el input que recibe el foco del teclado, si lo hay.
 */
function destinoDePendiente(formulario, item) {
  const control = controlPorRuta(formulario, item.ruta);
  if (control) {
    return { destino: control.closest('.field, td') || control, control: control };
  }

  const bloque = bloquePorRuta(formulario, item.ruta);
  if (bloque) return { destino: bloque, control: null };

  const familia = familiaPorReferencia(item.referencia);
  switch (item.codigo) {
    case 'RN-028': {
      const boton = document.getElementById('btnAgregarFamilia');
      return { destino: boton, control: boton };
    }
    case 'RN-051': {
      const boton = familia && familia.querySelector('[data-accion="agregarIntegrante"]');
      if (boton) return { destino: boton, control: boton };
      break;
    }
    case 'RN-070': {
      const casilla = familia && familia.querySelector('[name$=".sinContactoTelefonico"]');
      if (casilla) return { destino: casilla.closest('.field') || casilla, control: casilla };
      break;
    }
    case 'RN-022': {
      const motivo = document.getElementById('campoMotivoGeo');
      if (motivo && !motivo.hidden) {
        return { destino: motivo, control: document.getElementById('motivoSinGeorreferenciacion') };
      }
      const latitud = document.getElementById('latitud');
      if (latitud) return { destino: latitud.closest('.field') || latitud, control: null };
      break;
    }
  }

  if (item.campo) {
    const porCampo = formulario.querySelector('[data-campo="' + item.campo + '"]');
    if (porCampo) return { destino: porCampo, control: null };
  }

  if (familia) return { destino: familia, control: null };

  const seccion = document.getElementById(SECCION_POR_BLOQUE[item.bloque] || 'seccion-cierre');
  return { destino: seccion, control: null };
}

/** Texto corto con el que se presenta un pendiente en la lista. */
function etiquetaDePendiente(destino, control) {
  const campo = destino && destino.closest ? destino.closest('.field, td') : null;
  if (campo) {
    if (campo.tagName === 'TD') {
      const columna = campo.getAttribute('data-label');
      if (columna) return columna;
    }
    const etiqueta = campo.querySelector('label');
    if (etiqueta) {
      return etiqueta.textContent.replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim().slice(0, 90);
    }
  }
  if (control && control.tagName === 'BUTTON') return control.textContent.trim();
  if (destino && destino.matches) {
    if (destino.matches('.section-banner')) return destino.textContent.replace(/\s+/g, ' ').trim().slice(0, 90);
    const titulo = destino.querySelector('summary, .card__header h2, h2, h3');
    if (titulo) return titulo.textContent.replace(/\s+/g, ' ').trim().slice(0, 90);
  }
  return '';
}

/** Compara dos nodos por su posición en el documento, para recorrer de arriba abajo. */
function ordenEnDocumento(a, b) {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Enciende el navegador con la lista de impedimentos dada. Cada uno se
 * resuelve a un elemento en pantalla y se ordena de arriba abajo, que es el
 * orden natural para corregir.
 */
function activarNavegadorPendientes(formulario, impedimentos, origen) {
  navegadorPendientes.activo = true;
  navegadorPendientes.origen = origen || 'local';
  navegadorPendientes.indice = -1;
  navegadorPendientes.items = (impedimentos || []).map(function (item) {
    const resuelto = destinoDePendiente(formulario, item);
    return {
      destino: resuelto.destino,
      control: resuelto.control,
      codigo: item.codigo,
      mensaje: item.mensaje,
      referencia: item.referencia || null,
      etiqueta: etiquetaDePendiente(resuelto.destino, resuelto.control)
    };
  }).filter(function (item) { return !!item.destino; })
    .sort(function (a, b) { return ordenEnDocumento(a.destino, b.destino); });

  renderizarNavegadorPendientes();
}

function apagarNavegadorPendientes() {
  navegadorPendientes.activo = false;
  navegadorPendientes.items = [];
  navegadorPendientes.indice = -1;
  clearTimeout(navegadorPendientes.temporizador);

  const barra = document.getElementById('navErrores');
  if (barra) barra.hidden = true;
  desplegarListaPendientes(false);
}

function desplegarListaPendientes(abierta) {
  const lista = document.getElementById('navErroresLista');
  const resumen = document.getElementById('navErroresResumen');
  if (!lista || !resumen) return;
  lista.hidden = !abierta;
  resumen.setAttribute('aria-expanded', abierta ? 'true' : 'false');
}

function renderizarNavegadorPendientes() {
  const barra = document.getElementById('navErrores');
  if (!barra) return;

  const items = navegadorPendientes.items;
  const total = items.length;
  const listo = total === 0;

  barra.hidden = !navegadorPendientes.activo;
  barra.classList.toggle('nav-errores--listo', listo);

  const icono = document.getElementById('navErroresIcono');
  icono.className = 'nav-errores__icono ph ' + (listo ? 'ph-check-circle' : 'ph-warning-circle');

  document.getElementById('navErroresTexto').textContent = listo
    ? 'Sin pendientes: ya puede guardar'
    : total + (total === 1 ? ' pendiente' : ' pendientes');

  document.getElementById('navErroresPosicion').textContent =
    !listo && navegadorPendientes.indice >= 0
      ? '· ' + (navegadorPendientes.indice + 1) + ' de ' + total : '';

  document.getElementById('navErroresAnterior').disabled = listo;
  document.getElementById('navErroresSiguiente').disabled = listo;

  const lista = document.getElementById('navErroresLista');
  if (listo) {
    lista.innerHTML = '';
    desplegarListaPendientes(false);
    return;
  }

  lista.innerHTML = items.map(function (item, indice) {
    const activo = indice === navegadorPendientes.indice ? ' is-activo' : '';
    const referencia = item.referencia
      ? '<span class="nav-errores__item-ref">' + escaparHtml(item.referencia) + '</span>' : '';
    const titulo = item.etiqueta || item.codigo;
    return '<button type="button" class="nav-errores__item' + activo + '" data-indice="' + indice + '">' +
      '<span class="nav-errores__item-num">' + (indice + 1) + '</span>' +
      '<span class="nav-errores__item-cuerpo">' +
        '<span class="nav-errores__item-titulo">' + escaparHtml(titulo) + referencia + '</span>' +
        '<span class="nav-errores__item-detalle">' + escaparHtml(item.codigo + ': ' + item.mensaje) + '</span>' +
      '</span>' +
    '</button>';
  }).join('');
}

/**
 * Hace visible un elemento: abre los bloques plegados que lo contienen y, si
 * está dentro de un campo condicionado oculto, enciende el modo revisión.
 */
function revelarElemento(elemento) {
  let nodo = elemento;
  let oculto = false;
  while (nodo && nodo !== document.body) {
    if (nodo.tagName === 'DETAILS' && !nodo.open) nodo.open = true;
    if (nodo.hidden) oculto = true;
    nodo = nodo.parentElement;
  }

  if (oculto) {
    const interruptor = document.getElementById('modoRevision');
    if (interruptor && !interruptor.checked) {
      interruptor.checked = true;
      interruptor.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

/** Lleva la vista hasta un elemento, lo destaca y le da el foco. */
function enfocarElemento(destino, control) {
  if (!destino) return;
  revelarElemento(destino);

  if (typeof destino.scrollIntoView === 'function') {
    destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  destino.classList.remove('is-error-foco');
  void destino.offsetWidth; // reinicia la animación si se salta dos veces al mismo campo
  destino.classList.add('is-error-foco');
  setTimeout(function () { destino.classList.remove('is-error-foco'); }, 1700);

  const objetivo = control || (destino.matches && destino.matches('input, select, textarea, button')
    ? destino
    : destino.querySelector && destino.querySelector('input:not([type="hidden"]), select, textarea'));
  if (objetivo && typeof objetivo.focus === 'function' && !objetivo.disabled) {
    try { objetivo.focus({ preventScroll: true }); } catch (e) { objetivo.focus(); }
  }
}

function irAPendiente(indice) {
  const items = navegadorPendientes.items;
  if (items.length === 0) return;

  navegadorPendientes.indice = ((indice % items.length) + items.length) % items.length;
  const item = items[navegadorPendientes.indice];
  enfocarElemento(item.destino, item.control);
  renderizarNavegadorPendientes();
}

function irAlSiguientePendiente() {
  irAPendiente(navegadorPendientes.indice + 1);
}

function irAlPendienteAnterior() {
  irAPendiente(navegadorPendientes.indice <= 0 ? -1 : navegadorPendientes.indice - 1);
}

function irAGuardar() {
  desplegarListaPendientes(false);
  const acciones = document.getElementById('accionesFormulario');
  const boton = document.getElementById('btnGuardar');
  enfocarElemento(acciones || boton, boton);
}

/**
 * Vuelve a evaluar la ficha tras un cambio y refresca marcas, resumen de
 * cierre y navegador. Sólo aplica a los errores locales: los que señaló el
 * servidor no pueden recalcularse aquí, así que en ese caso se retira la
 * marca del campo tocado y se confía en el siguiente envío.
 */
function refrescarPendientesTrasCambio(formulario, objetivo) {
  if (!navegadorPendientes.activo) return;

  if (navegadorPendientes.origen === 'servidor') {
    const contenedor = objetivo && objetivo.closest ? objetivo.closest('.has-error') : null;
    if (!contenedor) return;
    contenedor.classList.remove('has-error');
    const aviso = contenedor.querySelector('.field-error-msg');
    if (aviso) aviso.remove();
    navegadorPendientes.items = navegadorPendientes.items.filter(function (item) {
      return item.destino !== contenedor && !contenedor.contains(item.destino);
    });
    if (navegadorPendientes.indice >= navegadorPendientes.items.length) navegadorPendientes.indice = -1;
    renderizarNavegadorPendientes();
    return;
  }

  const posicionActual = navegadorPendientes.items[navegadorPendientes.indice];
  const datos = recolectarDatosFormulario(formulario);

  limpiarErroresFormulario(formulario);
  validarReglas(datos).forEach(function (incumplimiento) {
    marcarIncumplimiento(formulario, incumplimiento);
  });
  evaluarAdvertencias(datos).forEach(function (advertencia) {
    marcarAdvertencia(formulario, advertencia);
  });

  const cierre = validarCierre(datos);
  renderizarImpedimentos(cierre.impedimentos);
  renderizarPlanCuidado(cierre.planCuidado);
  activarNavegadorPendientes(formulario, cierre.impedimentos, 'local');

  /* Conserva la posición para que «Siguiente» avance desde donde el
     encuestador está y no vuelva al principio: si el campo corregido ya no
     está en la lista, se queda justo antes del que le seguía. */
  if (posicionActual) {
    const items = navegadorPendientes.items;
    let indice = items.findIndex(function (item) { return item.destino === posicionActual.destino; });
    if (indice === -1) {
      const siguiente = items.findIndex(function (item) {
        return ordenEnDocumento(posicionActual.destino, item.destino) < 0;
      });
      indice = (siguiente === -1 ? items.length : siguiente) - 1;
    }
    navegadorPendientes.indice = indice;
    renderizarNavegadorPendientes();
  }
}

function programarRefrescoDePendientes(formulario, objetivo) {
  if (!navegadorPendientes.activo) return;
  clearTimeout(navegadorPendientes.temporizador);
  navegadorPendientes.temporizador = setTimeout(function () {
    refrescarPendientesTrasCambio(formulario, objetivo);
  }, 120);
}

/* ---------------------------------------------------------
   18.3 VALIDACIÓN EN VIVO
   Mientras se diligencia, cada campo que el encuestador ya tocó se valida
   con el mismo motor que corre al guardar (reglas.js): el aviso aparece al
   confirmar el dato y desaparece en cuanto se corrige. Los campos que aún
   no ha tocado se dejan en paz hasta que intente guardar, para no llenar
   de rojo un formulario que apenas empieza.

   Es lo que hace que una cédula en un menor de edad (RN-064) se vea al
   momento de digitar la fecha de nacimiento, y no al final de la visita.
   --------------------------------------------------------- */

const validacionEnVivo = { tocados: new Set(), temporizador: null };

function registrarCampoTocado(control) {
  const nombre = control && control.getAttribute ? control.getAttribute('name') : null;
  if (nombre) validacionEnVivo.tocados.add(nombre);
}

function olvidarCamposTocados() {
  validacionEnVivo.tocados.clear();
  clearTimeout(validacionEnVivo.temporizador);
}

function validarEnVivo(formulario) {
  /* Tras intentar guardar, el navegador de pendientes ya repinta el
     formulario entero con cada cambio; aquí no hay nada que añadir. */
  if (navegadorPendientes.activo) return;
  if (validacionEnVivo.tocados.size === 0) return;

  const datos = recolectarDatosFormulario(formulario);
  const incumplimientos = validarReglas(datos);
  const advertencias = evaluarAdvertencias(datos);

  validacionEnVivo.tocados.forEach(function (nombre) {
    const contenedor = contenedorPorRuta(formulario, nombre);
    // Un control tocado que ya no existe (bloque eliminado) se olvida.
    if (!contenedor) { validacionEnVivo.tocados.delete(nombre); return; }
    limpiarMarcaDeCampo(contenedor);
  });

  const tocado = function (item) {
    return validacionEnVivo.tocados.has(rutaEnPantalla(formulario, item.ruta));
  };
  incumplimientos.filter(tocado).forEach(function (incumplimiento) {
    marcarIncumplimiento(formulario, incumplimiento);
  });
  advertencias.filter(tocado).forEach(function (advertencia) {
    marcarAdvertencia(formulario, advertencia);
  });
}

function programarValidacionEnVivo(formulario) {
  clearTimeout(validacionEnVivo.temporizador);
  validacionEnVivo.temporizador = setTimeout(function () { validarEnVivo(formulario); }, 150);
}

function inicializarValidacionEnVivo() {
  const formulario = document.getElementById('encuestaForm');
  if (!formulario) return;

  // Al confirmar un dato (salir del campo, elegir una opción) se valida.
  formulario.addEventListener('change', function (evento) {
    registrarCampoTocado(evento.target);
    programarValidacionEnVivo(formulario);
  });

  /* Mientras se escribe sólo se revalida lo que ya está marcado: así el aviso
     desaparece en cuanto el dato queda bien, sin aparecer antes de terminar
     de escribirlo. */
  formulario.addEventListener('input', function (evento) {
    const marcado = evento.target.closest ? evento.target.closest('.has-error, .has-warning') : null;
    if (marcado) programarValidacionEnVivo(formulario);
  });

  formulario.addEventListener('reset', olvidarCamposTocados);
}

function inicializarNavegadorPendientes() {
  const formulario = document.getElementById('encuestaForm');
  const barra = document.getElementById('navErrores');
  if (!formulario || !barra) return;

  document.getElementById('navErroresSiguiente').addEventListener('click', irAlSiguientePendiente);
  document.getElementById('navErroresAnterior').addEventListener('click', irAlPendienteAnterior);
  document.getElementById('navErroresGuardar').addEventListener('click', irAGuardar);
  document.getElementById('navErroresCerrar').addEventListener('click', apagarNavegadorPendientes);

  document.getElementById('navErroresResumen').addEventListener('click', function () {
    const lista = document.getElementById('navErroresLista');
    if (navegadorPendientes.items.length === 0) return;
    desplegarListaPendientes(lista.hidden);
  });

  document.getElementById('navErroresLista').addEventListener('click', function (evento) {
    const item = evento.target.closest('[data-indice]');
    if (!item) return;
    desplegarListaPendientes(false);
    irAPendiente(parseInt(item.dataset.indice, 10));
  });

  // El mensaje rojo bajo un campo y los impedimentos del cierre llevan al campo.
  formulario.addEventListener('click', function (evento) {
    const aviso = evento.target.closest('.field-error-msg');
    if (aviso) {
      const contenedor = aviso.closest('.has-error') || aviso.parentElement;
      enfocarElemento(contenedor, null);
      return;
    }

    const impedimento = evento.target.closest('[data-pendiente]');
    if (impedimento) irAImpedimento(formulario, parseInt(impedimento.dataset.pendiente, 10));
  });

  formulario.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const impedimento = evento.target.closest ? evento.target.closest('[data-pendiente]') : null;
    if (!impedimento) return;
    evento.preventDefault();
    irAImpedimento(formulario, parseInt(impedimento.dataset.pendiente, 10));
  });

  /* Cada cambio confirmado (change: al salir de un texto, al marcar una
     opción) recalcula el conteo, para que baje a medida que se corrige. */
  formulario.addEventListener('change', function (evento) {
    programarRefrescoDePendientes(formulario, evento.target);
  });

  // Atajos: Alt + ↓ siguiente, Alt + ↑ anterior, Alt + G ir a guardar.
  document.addEventListener('keydown', function (evento) {
    if (!navegadorPendientes.activo || !evento.altKey || barra.hidden) return;
    if (evento.key === 'ArrowDown') { evento.preventDefault(); irAlSiguientePendiente(); }
    else if (evento.key === 'ArrowUp') { evento.preventDefault(); irAlPendienteAnterior(); }
    else if (evento.key === 'g' || evento.key === 'G') { evento.preventDefault(); irAGuardar(); }
  });
}

function irAImpedimento(formulario, indice) {
  const item = ultimosImpedimentos[indice];
  if (!item) return;
  const resuelto = destinoDePendiente(formulario, item);
  enfocarElemento(resuelto.destino, resuelto.control);

  const posicion = navegadorPendientes.items.findIndex(function (p) { return p.destino === resuelto.destino; });
  if (posicion !== -1) {
    navegadorPendientes.indice = posicion;
    renderizarNavegadorPendientes();
  }
}

/** Evalúa y pinta el estado completo de la ficha sin guardarla. */
function actualizarTableroDeRiesgo(datos) {
  const alertas = evaluarAlertas(datos);
  const sinAccion = verificarTrazabilidadAlertas(datos, alertas);

  renderizarSemaforo(clasificarRiesgoFamiliar(datos, alertas));
  renderizarAlertas(alertas, sinAccion);
  renderizarPlanCuidado(resumirPlanCuidado(datos, alertas));

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
      mostrarNotificacion('Registre el motivo del cierre por causa externa.', 'error', function () {
        enfocarElemento(document.getElementById('campoMotivoIncompleta'), document.getElementById('motivoVisitaIncompleta'));
      });
      return;
    }
    await guardarYReiniciar(datos, formulario, 'La visita se guardó como incompleta por causa externa.');
    return;
  }

  const resultadoCierre = validarCierre(datos);
  const incumplimientos = validarReglas(datos);

  renderizarImpedimentos(resultadoCierre.impedimentos);

  incumplimientos.forEach(function (incumplimiento) {
    marcarIncumplimiento(formulario, incumplimiento);
  });
  /* Las advertencias se pintan en ámbar junto al campo; no impiden guardar.
     Van después de los errores: donde ya hay uno, el error manda. */
  const advertencias = evaluarAdvertencias(datos);
  advertencias.forEach(function (advertencia) {
    marcarAdvertencia(formulario, advertencia);
  });

  if (incumplimientos.length > 0) {
    /* La barra de pendientes recorre todos los impedimentos (los de reglas y
       los de cierre) de arriba abajo. El salto al primero espera a que se
       cierre el aviso: mientras está abierto la página no puede desplazarse. */
    activarNavegadorPendientes(formulario, resultadoCierre.impedimentos, 'local');
    mostrarNotificacion(
      'Se encontraron ' + incumplimientos.length + ' incumplimientos de reglas de negocio. ' +
      'Use la barra inferior para ir de un pendiente al siguiente.',
      'error',
      function () { irAPendiente(0); }
    );
    return;
  }

  if (!resultadoCierre.puedeCerrar) {
    activarNavegadorPendientes(formulario, resultadoCierre.impedimentos, 'local');
    mostrarNotificacion(
      'La ficha no puede cerrarse: ' + resultadoCierre.impedimentos.length +
      ' impedimento(s) pendiente(s). Use la barra inferior para ir a cada uno.',
      'error',
      function () { irAPendiente(0); }
    );
    return;
  }

  apagarNavegadorPendientes();

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

  /* El plan diferido no es error: se avisa una vez, al guardar, dónde se
     completa después. */
  if (encuesta.planCuidado && encuesta.planCuidado.pendiente) {
    mensaje += ' El plan de cuidado quedó pendiente: puede completarlo desde Historial → Corregir.';
  }

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

  lista.forEach(function (b) {
    if (!b.ruta) return;
    const control = controlPorRuta(formulario, b.ruta);
    if (!control) return;

    const contenedor = control.closest('.field, td');
    if (contenedor && !contenedor.querySelector('.field-error-msg')) {
      contenedor.classList.add('has-error');
      const aviso = document.createElement('span');
      aviso.className = 'field-error-msg';
      aviso.textContent = (b.codigo || 'BD') + ': ' + b.mensaje;
      contenedor.appendChild(aviso);
    }
  });

  activarNavegadorPendientes(formulario, lista.map(function (b) {
    return {
      codigo: b.codigo || 'BD',
      mensaje: b.mensaje,
      bloque: b.ambito || null,
      ruta: b.ruta || null,
      referencia: b.referencia || null
    };
  }), 'servidor');

  mostrarNotificacion(
    'El servidor no aceptó la ficha: ' + lista.length + ' campo(s) por corregir. ' +
    'Use la barra inferior para ir a cada uno.', 'error',
    function () {
      if (navegadorPendientes.items.length > 0) {
        irAPendiente(0);
      } else {
        document.getElementById('seccion-cierre').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  );
}

function reiniciarEstadoFormulario() {
  const formulario = document.getElementById('encuestaForm');
  limpiarErroresFormulario(formulario);
  apagarNavegadorPendientes();
  olvidarCamposTocados();
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
  renderizarPlanCuidado(resumirPlanCuidado(vacio, []));
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

/**
 * La cabecera es plana mientras la página está arriba del todo y se eleva en
 * cuanto hay contenido pasando por debajo. La sombra deja de ser un adorno
 * permanente y pasa a decir algo: «esto está flotando sobre la página».
 *
 * El listener es pasivo y sólo toca el DOM cuando el estado cambia de verdad;
 * classList.toggle en cada scroll invalidaría estilos sesenta veces por
 * segundo en las tablets del terreno.
 */
function inicializarCabeceraAlDesplazar() {
  const cabecera = document.querySelector('.app-header');
  if (!cabecera) return;

  let elevada = null;

  function revisar() {
    const debeElevarse = window.scrollY > 8;
    if (debeElevarse === elevada) return;
    elevada = debeElevarse;
    cabecera.classList.toggle('is-scrolled', debeElevarse);
  }

  revisar();
  window.addEventListener('scroll', revisar, { passive: true });
}

/**
 * Enciende en el índice el enlace de la sección que se está mirando. El
 * formulario mide varias pantallas y el índice sólo decía a dónde se puede
 * ir, nunca dónde se está.
 *
 * Con IntersectionObserver y no con un listener de scroll: el observador
 * avisa sólo cuando una sección cruza el umbral, mientras que un listener de
 * scroll obliga a medir posiciones en cada fotograma —justo lo que tumba los
 * fps en las tablets del terreno.
 *
 * El margen superior descuenta la cabecera más la isla del índice, para que
 * la sección se considere «actual» cuando llega bajo ellas, no cuando asoma
 * por el borde de la ventana.
 */
function inicializarIndiceActivo() {
  const indice = document.getElementById('formNav');
  if (!indice || typeof IntersectionObserver === 'undefined') return;

  const enlaces = new Map();
  indice.querySelectorAll('.form-nav__link[href^="#"]').forEach(function (enlace) {
    const seccion = document.getElementById(enlace.getAttribute('href').slice(1));
    if (seccion) enlaces.set(seccion, enlace);
  });
  if (enlaces.size === 0) return;

  const visibles = new Set();

  function repintar() {
    /* Cuando hay varias secciones a la vista gana la más alta, que es la que
       el usuario percibe como «en la que estoy». */
    let elegida = null;
    enlaces.forEach(function (_, seccion) {
      if (!visibles.has(seccion)) return;
      if (!elegida || seccion.offsetTop < elegida.offsetTop) elegida = seccion;
    });
    enlaces.forEach(function (enlace, seccion) {
      enlace.classList.toggle('is-actual', seccion === elegida);
    });
  }

  const observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (entrada.isIntersecting) visibles.add(entrada.target);
      else visibles.delete(entrada.target);
    });
    repintar();
  }, { rootMargin: '-140px 0px -55% 0px' });

  enlaces.forEach(function (_, seccion) { observador.observe(seccion); });
}

function inicializarAplicacion() {
  inicializarCabeceraAlDesplazar();
  inicializarIndiceActivo();
  inicializarCatalogosDelFormulario();
  inicializarModoRevision();
  inicializarFormularioDinamico();
  inicializarBuscadorCups();
  inicializarCierreIncompleto();
  inicializarNavegadorPendientes();
  inicializarValidacionEnVivo();
  retirarDatosDemostracion();
  inicializarNavegacion();
  inicializarFiltrosHistorial();
  inicializarFormulario();
  inicializarModales();
  reiniciarEstadoFormulario();

  renderizarInicio();
  renderizarHistorial();

  /* Primer vistazo a lo que hay en la base, para que abrir la aplicación ya
     muestre lo que otros dispositivos hayan guardado y no sólo lo que hay en
     este navegador. */
  refrescarFichasDelServidor().then(function () {
    renderizarInicio();
    renderizarHistorial();
  });

}

document.addEventListener('DOMContentLoaded', inicializarAplicacion);
