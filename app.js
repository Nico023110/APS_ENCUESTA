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

/**
 * Hora (24 h, la misma de la captura local) de un instante ISO. El ítem 16 del
 * instrumento es sólo fecha: la hora sale del momento exacto en que se
 * diligenció la ficha y sirve de control, no de dato del reporte.
 */
function formatearHora(fechaIso, conSegundos) {
  if (!fechaIso) return '';
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return '';
  const opciones = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  if (conSegundos) opciones.second = '2-digit';
  return fecha.toLocaleTimeString('es-CO', opciones);
}

function formatearFechaHora(fechaIso, conSegundos) {
  if (!fechaIso) return '—';
  const hora = formatearHora(fechaIso, conSegundos);
  return formatearFecha(fechaIso) + (hora ? ', ' + hora : '');
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

function llenarSelect(idSelectOElemento, catalogo, opciones) {
  const config = opciones || {};
  /* Los `<select data-catalogo>` de los bloques repetibles (ítem 76 entre
     ellos) no llevan `id` propio: clonarlos con un id fijo duplicaría el
     id en cada familia. Aceptar el elemento directamente evita el
     document.getElementById('') que antes fallaba en silencio y dejaba
     ese select sin repintar cuando llegaba el catálogo del servidor. */
  const select = typeof idSelectOElemento === 'string'
    ? document.getElementById(idSelectOElemento)
    : idSelectOElemento;
  if (!select) return;
  const placeholder = config.placeholder === undefined ? 'Seleccione...' : config.placeholder;

  const partes = [];
  if (placeholder !== null) partes.push('<option value="">' + placeholder + '</option>');

  opcionesVigentes(catalogo).forEach(function (opcion) {
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
  contenedor.innerHTML = opcionesVigentes(catalogo).map(function (opcion) {
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
  contenedor.innerHTML = opcionesVigentes(catalogo).map(function (opcion) {
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

const CATALOGOS_DECLARATIVOS = Object.assign({
  /* Se llena en marcha desde /api/catalogo_acciones; el arreglo se comparte
     por referencia, así que basta con repintar los selects al cargarlo. */
  CAT_ACCION_PLAN: CAT_ACCION_PLAN,
  CAT_SI_NO: CAT_SI_NO,
  CAT_SI_NO_NA: CAT_SI_NO_NA,
  CAT_UZPE: CAT_UZPE_VIGENTES,
  CAT_EAPB: CAT_EAPB,
  CAT_PRESTADOR: CAT_PRESTADOR,
  CAT_SITUACION_INMINENTE: CAT_SITUACION_INMINENTE,
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
  CAT_PAIS: CAT_PAIS,
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
}, CATALOGOS_ANEXO);

function opcionesSelectHtml(catalogo, placeholder) {
  const partes = [];
  if (placeholder !== null) partes.push('<option value="">' + (placeholder || 'Seleccione...') + '</option>');
  opcionesVigentes(catalogo).forEach(function (opcion) {
    partes.push('<option value="' + escaparHtml(opcion.valor) + '">' + escaparHtml(opcion.etiqueta) + '</option>');
  });
  return partes.join('');
}

function pastillasHtml(catalogo, nombreCampo, tipo) {
  const esRadio = tipo === 'radio';
  return opcionesVigentes(catalogo).map(function (opcion) {
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
      pintarListaDeEquipos();
      pintarListaDeBarrios();
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
      pintarListaDeEquipos();
      pintarListaDeBarrios();
      localStorage.setItem('aps_catalogos_dinamicos', JSON.stringify(dataCatalogos));
      /* El select del ítem 7 se llenó al arrancar con el catálogo que hubiera
         (el estático o la copia guardada); si la base trae territorios nuevos
         hay que repintarlo, conservando lo ya elegido. */
      repintarTerritorios();
      // Re-render components that might have been initialized empty
      if (typeof ventana === 'undefined' && typeof document !== 'undefined') {
        /* Conserva lo ya elegido: sin esto, repintar a mitad de captura
           borraría la EAPB o el prestador que el encuestador ya seleccionó. */
        const eapbSelects = document.querySelectorAll('[data-catalogo="CAT_EAPB"]');
        eapbSelects.forEach(function (select) {
          llenarSelect(select, CAT_EAPB, { seleccionado: select.value });
        });
        const prestadorSelects = document.querySelectorAll('[data-catalogo="CAT_PRESTADOR"]');
        prestadorSelects.forEach(function (select) {
          llenarSelect(select, CAT_PRESTADOR, { seleccionado: select.value });
        });
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

/* RN-010 — Los EBS registrados, para el ítem 10 de quien lidera una zona y
   elige el EBS de cada visita (sesion.js le deja el campo abierto). */
function pintarListaDeEquipos() {
  const lista = document.getElementById('listaEquiposEbs');
  if (!lista || typeof CAT_EQUIPOS_EBS === 'undefined') return;
  lista.innerHTML = CAT_EQUIPOS_EBS.map(function (codigo) {
    return '<option value="' + escaparHtml(codigo) + '"></option>';
  }).join('');
}

/* Ítem 9 — Barrios de Cali: el navegador filtra la lista mientras se
   escribe y deja en el campo el nombre; la comuna va como ayuda. */
function pintarListaDeBarrios() {
  const lista = document.getElementById('listaBarrios');
  if (!lista || typeof CAT_BARRIOS === 'undefined') return;
  lista.innerHTML = CAT_BARRIOS.map(function (barrio) {
    return '<option value="' + escaparHtml(barrio.nombre) + '" label="Comuna ' +
      escaparHtml(barrio.comuna) + '"></option>';
  }).join('');
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
  /* Las preguntas del anexo técnico SI-APS se pintan primero: son parte de
     las plantillas de familia e integrante, que se guardan como prototipo
     justo después (inicializarFormularioDinamico) y de ellas se clonan los
     bloques que se agreguen. */
  renderizarPreguntasAnexo(document);

  // Bloques 4 a 12: se resuelven por data-catalogo, sin ids fijos.
  renderizarCatalogosDeclarativos(document);

  /* Ítem 73 — ocupaciones CIUO de SISPRO (catalogos_sispro.js). Una sola
     lista para todos los integrantes: el navegador la ofrece al escribir,
     por código o por nombre, y deja en el campo el código. */
  const listaCiuo = document.getElementById('listaOcupacionesCiuo');
  if (listaCiuo) {
    listaCiuo.innerHTML = CAT_OCUPACION_CIUO.map(function (ocupacion) {
      return '<option value="' + escaparHtml(ocupacion.valor) + '" label="' +
        escaparHtml(ocupacion.valor + ' — ' + ocupacion.etiqueta) + '"></option>';
    }).join('');
  }

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

  llenarGrupoRadio('grupoVectores', 'vectores', CAT_SI_NO_NA);                                // RN-037

  llenarGrupoCasillas('grupoRiesgosAccidente', 'riesgosAccidente', CAT_RIESGOS_ACCIDENTE);             // RN-036
  llenarGrupoCasillas('grupoFactoresContaminacion', 'factoresContaminacion', CAT_FACTORES_CONTAMINACION); // RN-038

  // RN-004: sólo se ofrecen las UZPE vigentes en el catálogo. Ofrecer las diez
  // hacía que el encuestador escogiera una que la base no acepta.
  llenarSelect('uzpe', CAT_UZPE_VIGENTES, { placeholder: null, seleccionado: UZPE_PREDETERMINADA });

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

/* Sólo se ofrecen los territorios vigentes (TERRITORIOS_VIGENTES). `incluir`
   añade uno no vigente cuando ya viene en la ficha —una corrección de una
   ficha antigua—: sin la opción, el <select> no podría mostrarlo. */
function catalogoTerritorios(incluir) {
  return Object.keys(CAT_TERRITORIOS).map(function (codigo) {
    return {
      valor: codigo,
      etiqueta: etiquetaTerritorio(codigo),
      vigente: territorioVigente(codigo) || codigo === incluir
    };
  });
}

/** Vuelve a llenar el ítem 7 con el catálogo vigente sin perder la selección. */
function repintarTerritorios(incluir) {
  const select = document.getElementById('territorio');
  if (!select) return;
  const elegido = select.value;
  const micro = document.getElementById('microterritorio');
  const microElegido = micro ? micro.value : '';
  llenarSelect('territorio', catalogoTerritorios(incluir || elegido));
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

/* El anexo reporta la variable 23 como selección múltiple: la alerta nombra
   todas las situaciones marcadas, no sólo la primera. */
function actualizarAlertaSituacionInminente() {
  const valores = Array.prototype.map.call(
    document.querySelectorAll('input[name="situacionInminente"]:checked'),
    function (casilla) { return casilla.value; });
  const alerta = document.getElementById('alertaSituacion');

  if (!requiereAtencionPrioritaria(valores)) {
    alerta.hidden = true;
    return;
  }

  document.getElementById('alertaSituacionTexto').textContent =
    'Se registró: ' + etiquetasDeCatalogo(CAT_SITUACION_INMINENTE, situacionesPrioritarias(valores)) + '.';
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
  const sinDireccion = modo === MODO_SIN_DIRECCION;
  document.getElementById('panelDireccionUrbana').hidden = modo !== 'urbana';
  document.getElementById('panelDireccionRural').hidden = modo !== 'rural';
  document.getElementById('lineaComplementosDireccion').hidden = sinDireccion;
  document.getElementById('avisoSinDireccion').hidden = !sinDireccion;

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

  /* Sin dirección no hay vía que buscar: la consulta caería en el centro del
     barrio y lo dejaría como si fuera la vivienda. Ahí las coordenadas salen
     del GPS (o del botón «Buscar dir.», si el encuestador lo decide). */
  if (obtenerModoDireccion() === MODO_SIN_DIRECCION) return;

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

  /* Lo que se digitó a mano no lo pisa el cálculo automático; sólo «Buscar
     dir.» (forzar) lo reemplaza. */
  if (!forzar && origenCoordenadas === 'manual' &&
      document.getElementById('latitud').value && document.getElementById('longitud').value) return;

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
      habilitarCoordenadasManuales(false);
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
      habilitarCoordenadasManuales(false);
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

function marcarCoordenadasManuales(evento) {
  /* Lo que se copia de Google Maps llega como «3.451647, -76.531985» en un
     solo campo: se reparte entre la latitud y la longitud. */
  const campo = evento && evento.target;
  if (campo && /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(campo.value)) {
    const partes = campo.value.split(',');
    document.getElementById('latitud').value = partes[0].trim();
    document.getElementById('longitud').value = partes[1].trim();
  }

  origenCoordenadas = 'manual';
  precisionCoordenadas = null;
  referenciaCoordenadas = null;
  establecerEstadoGeo('Coordenadas digitadas manualmente.');
  actualizarAvisoCoordenadas();
}

/* Las coordenadas son de sólo lectura: las llena la dirección, el GPS o, con
   este botón, quien diligencia —en zona rural casi siempre; en urbana cuando
   el cálculo no las encuentra—. El botón dice en qué estado están. */
function habilitarCoordenadasManuales(activar) {
  const latitud = document.getElementById('latitud');
  const longitud = document.getElementById('longitud');
  const boton = document.getElementById('btnDigitarCoordenadas');
  if (!latitud || !longitud || !boton) return;

  latitud.readOnly = !activar;
  longitud.readOnly = !activar;
  boton.setAttribute('aria-pressed', activar ? 'true' : 'false');
  boton.classList.toggle('btn--activo', activar);
  boton.innerHTML = activar
    ? '<i class="ph ph-check" aria-hidden="true"></i> Coordenadas habilitadas'
    : '<i class="ph ph-pencil-simple-line" aria-hidden="true"></i> Digitar coordenadas';
  boton.title = activar
    ? 'La latitud y la longitud se pueden escribir. Pulse de nuevo para bloquearlas.'
    : 'Habilita la latitud y la longitud para escribirlas';

  if (activar) {
    establecerEstadoGeo('Escriba la latitud y la longitud (por ejemplo 3.451647 y -76.531985), o pegue las dos ' +
      'separadas por coma en la latitud.');
    latitud.focus();
  }
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

/* La subida en curso: el módulo de Inicio la cuenta («Subiendo 2 de 5») y
   un segundo toque no la lanza otra vez. null cuando no hay ninguna. */
let sincronizacionEnCurso = null;

/* Cómo terminó la última sincronización de esta sesión, para decirlo en el
   módulo («3 fichas subidas») en vez de abrir un aviso. */
let ultimoResultadoSync = null;

/* Cuándo terminó la última sincronización en este dispositivo. Es una
   comodidad de pantalla («Sincronizado hoy a las 10:42»): si el navegador la
   pierde, el módulo sólo deja de decirlo. */
const CLAVE_ULTIMA_SINCRONIZACION = 'aps_ultima_sincronizacion';

function leerUltimaSincronizacion() {
  try { return localStorage.getItem(CLAVE_ULTIMA_SINCRONIZACION); } catch (e) { return null; }
}

function anotarUltimaSincronizacion() {
  try { localStorage.setItem(CLAVE_ULTIMA_SINCRONIZACION, new Date().toISOString()); } catch (e) { /* sin almacenamiento */ }
}

function haySenal() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/* Sincronizar es subir lo que sólo está en este equipo y, después, traer lo
   que haya en la base: así también aparece lo que otros dispositivos del
   equipo guardaron. Con nada pendiente, el toque sólo trae. */
async function sincronizarEncuestas() {
  if (sincronizacionEnCurso) return;

  /* Sin señal no se intenta: cada ficha fallaría por separado y el resumen
     lo achacaría al servidor. Las fichas siguen a salvo en el equipo. */
  if (!haySenal()) {
    mostrarNotificacion('No hay conexión. Las fichas siguen guardadas en este equipo; ' +
      'sincronice cuando vuelva la señal.', 'info');
    renderizarEstadoSync();
    return;
  }

  const encuestasLocales = obtenerEncuestas();

  /* Sólo lo que falta por subir. Antes se reenviaba todo el historial en cada
     pulsación —incluidas las fichas ya guardadas en la base—, así que un
     rechazo antiguo volvía a contarse como error nuevo y el resumen final
     nunca reflejaba lo que acababa de pasar. */
  const pendientes = encuestasLocales.filter(function (e) { return e.sincronizada !== true; });

  /* El progreso se ve en el módulo de Inicio, donde se pulsó: un aviso
     modal de «sincronizando…» lo tapaba durante toda la subida. */
  sincronizacionEnCurso = { hechas: 0, total: pendientes.length };
  renderizarEstadoSync();

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
          /* Una ficha capturada sin señal recibe aquí sus códigos. */
          const cuerpo = await respuesta.json().catch(function () { return {}; });
          aplicarCodigosAsignados(encuesta, cuerpo.codigos);
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
      sincronizacionEnCurso.hechas++;
      renderizarEstadoSync();
    }

    // Guardar los estados actualizados en localStorage
    guardarEncuestas(encuestasLocales);

    /* Lo que hay en la base, incluido lo que acaba de subir y lo que otros
       dispositivos del equipo guardaron. */
    sincronizacionEnCurso.trayendo = true;
    renderizarEstadoSync();
    await refrescarFichasDelServidor();

    /* Lo que salió bien se dice en el mismo módulo, sin aviso modal: no hay
       nada que decidir. Sólo un rechazo abre aviso, porque hay que leer qué
       ficha y qué campo corregir. */
    ultimoResultadoSync = { subidas: exitosas, rechazadas: rechazadas.length };
    if (rechazadas.length === 0) anotarUltimaSincronizacion();

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
        (exitosas > 0 ? textoCantidad(exitosas, 'ficha subió', 'fichas subieron') + ' a la base. ' : '') +
        textoCantidad(rechazadas.length, 'ficha no se pudo guardar.', 'fichas no se pudieron guardar.') + detalle,
        'error');

      console.table(rechazadas.map(function (r) {
        return {
          ficha: r.codigo,
          bloqueos: r.bloqueos.length,
          primero: r.bloqueos.length > 0 ? r.bloqueos[0].ruta + ': ' + r.bloqueos[0].mensaje : '—'
        };
      }));
    }
    
  } catch (error) {
    console.error('Fallo en sincronización:', error);
    mostrarNotificacion('Error de red al sincronizar. Reintente cuando tenga conexión.', 'error');
  } finally {
    sincronizacionEnCurso = null;
    renderizarInicio();
    renderizarHistorial();
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

/**
 * Aviso breve que no bloquea la pantalla: aparece en la esquina, se lee y se
 * va solo. Para confirmar algo que salió bien y no exige decisión —como
 * «Guardar avance»—, donde un aviso modal interrumpiría el diligenciamiento.
 */
function mostrarAvisoBreve(mensaje, tipo, duracionMs) {
  tipo = tipo || 'success';
  const contenedor = document.getElementById('toastContainer');
  if (!contenedor) return;

  /* El mismo aviso ya en pantalla (p. ej. «Guardar avance» pulsado varias
     veces seguidas) no se apila: se deja el que está y se reinicia su
     tiempo. */
  const existente = Array.prototype.find.call(contenedor.children, function (otro) {
    return otro.dataset.mensaje === mensaje && !otro.classList.contains('is-leaving');
  });
  if (existente) {
    clearTimeout(existente._temporizador);
    existente._temporizador = programarSalidaDeAviso(existente, duracionMs);
    return;
  }

  const aviso = document.createElement('div');
  aviso.dataset.mensaje = mensaje;
  aviso.className = 'toast toast--' + tipo;
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  const textos = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = TITULOS_TOAST[tipo] || TITULOS_TOAST.info;
  textos.appendChild(titulo);
  textos.appendChild(document.createTextNode(mensaje));
  aviso.appendChild(textos);
  contenedor.appendChild(aviso);
  aviso._temporizador = programarSalidaDeAviso(aviso, duracionMs);
}

function programarSalidaDeAviso(aviso, duracionMs) {
  return setTimeout(function () {
    aviso.classList.add('is-leaving');
    setTimeout(function () { aviso.remove(); }, 400);
  }, duracionMs || 3500);
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
  if (!tabs) return;
  const activa = tabs.querySelector('.app-tabs__btn.is-active');
  /* Una vista sin pestaña (Usuarios, desde el menú) apaga el indicador. */
  if (!activa) { tabs.style.setProperty('--tab-ready', '0'); return; }
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

  /* Las filas de «Fichas que requieren atención» abren el historial ya
     filtrado, con los demás filtros limpios: la lista muestra exactamente
     las fichas que contaba la fila. */
  document.querySelectorAll('[data-filtro-historial]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      ['filtroTexto', 'filtroHacinamiento', 'filtroPlanCuidado'].forEach(function (id) {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
      });
      const filtro = document.getElementById(boton.dataset.filtroHistorial);
      if (filtro) filtro.value = boton.dataset.valor;
      cambiarVista('historial');
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

/* La vivienda de una ficha. El NUV no se repite ni se reinicia; el código
   de la vivienda lo reemplaza en una fila que no lo traiga. Una ficha que
   todavía no sube no tiene ninguno de los dos: cuenta como su propia vivienda
   hasta que la base le asigne la suya. */
function claveDeVivienda(encuesta) {
  if (encuesta.nuv) return 'nuv:' + encuesta.nuv;
  if (encuesta.idHogar) return 'vivienda:' + encuesta.idHogar;
  return 'ficha:' + (encuesta.codigoFicha || encuesta.id);
}

/* Hogares, familias y personas de la vivienda según una ficha. La fila que
   viene de la base trae las cuentas hechas (listar_fichas.js); la ficha del
   dispositivo trae sus familias completas y se cuentan aquí con el mismo
   criterio de RN-028: una familia sin hogar (fichas anteriores al ítem) es un
   hogar propio. */
function composicionDeFicha(encuesta) {
  const resumen = encuesta.composicion;
  if (resumen) {
    return {
      declarados: Number(resumen.hogaresDeclarados) || 0,
      hogares: Number(resumen.hogares) || 0,
      familias: Number(resumen.familias) || 0,
      personas: Number(resumen.personas) || 0
    };
  }

  const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];
  const hogares = new Set(familias.map(function (familia, i) {
    return Number(familia.hogarNumero) >= 1 ? Number(familia.hogarNumero) : 'familia' + i;
  }));
  return {
    declarados: Number(encuesta.hogaresEnVivienda) || 0,
    hogares: hogares.size,
    familias: familias.length,
    personas: familias.reduce(function (total, familia) {
      return total + (Array.isArray(familia.integrantes) ? familia.integrantes.length : 0);
    }, 0)
  };
}

function calcularIndicadores(encuestas) {
  /* Volver a una vivienda deja otra ficha, no otra vivienda: de cada una se
     toma su última visita, que es la que dice cómo está hoy. */
  const ultimaVisita = new Map();
  encuestas.forEach(function (encuesta) {
    const clave = claveDeVivienda(encuesta);
    const previa = ultimaVisita.get(clave);
    if (!previa || new Date(encuesta.fechaRegistro || 0) > new Date(previa.fechaRegistro || 0)) {
      ultimaVisita.set(clave, encuesta);
    }
  });

  let hogares = 0;
  let hogaresSinCaracterizar = 0;
  let familias = 0;
  let personas = 0;
  const porTerritorio = new Map();

  ultimaVisita.forEach(function (encuesta) {
    const c = composicionDeFicha(encuesta);
    hogares += c.hogares;
    /* RN-028: un hogar declarado en el ítem 28 que no estaba en la visita. */
    hogaresSinCaracterizar += Math.max(0, c.declarados - c.hogares);
    familias += c.familias;
    personas += c.personas;

    if (!encuesta.territorio) return;
    const territorio = porTerritorio.get(encuesta.territorio) ||
      { codigo: encuesta.territorio, viviendas: 0, familias: 0 };
    territorio.viviendas += 1;
    territorio.familias += c.familias;
    porTerritorio.set(encuesta.territorio, territorio);
  });

  const territorios = Array.from(porTerritorio.values()).sort(function (a, b) {
    return b.viviendas - a.viviendas || b.familias - a.familias || a.codigo.localeCompare(b.codigo);
  });

  /* Lo que pide atención se cuenta por ficha, no por vivienda: así la cifra
     es la misma que deja el filtro del historial al que lleva. */
  return {
    totalEncuestas: encuestas.length,
    viviendas: ultimaVisita.size,
    hogares: hogares,
    hogaresSinCaracterizar: hogaresSinCaracterizar,
    familias: familias,
    personas: personas,
    territorios: territorios,
    conHacinamiento: encuestas.filter(function (e) { return e.hacinamiento === 'si'; }).length,
    situacionesInminentes: encuestas.filter(function (e) {
      return requiereAtencionPrioritaria(e.situacionInminente);
    }).length,
    planPendiente: encuestas.filter(function (e) {
      return e.planCuidado && e.planCuidado.pendiente === true;
    }).length
  };
}

/* Cifras con el separador de miles de Colombia (1.284) y razones con un
   decimal y coma (1,2). */
function formatearCantidad(n) {
  return Number(n).toLocaleString('es-CO');
}

function formatearRazon(parte, todo) {
  if (!todo) return null;
  return (parte / todo).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
    elemento.textContent = formatearCantidad(destino);
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
    elemento.textContent = formatearCantidad(Math.round(actual + (destino - actual) * suave));
    if (t < 1) {
      elemento.rafCifra = requestAnimationFrame(paso);
    } else {
      elemento.textContent = formatearCantidad(destino);
      elemento.rafCifra = null;
    }
  }

  elemento.textContent = formatearCantidad(actual);
  elemento.rafCifra = requestAnimationFrame(paso);
}

function textoRazon(parte, todo, unidad) {
  const razon = formatearRazon(parte, todo);
  return razon === null ? '' : razon + ' ' + unidad;
}

/* La cadena de Inicio: vivienda → hogar → familia → persona, el mismo
   anidamiento del instrumento. Cada nivel dice cuántos le caben del anterior
   («1,2 por vivienda»): es lo que hace que cuatro cifras sueltas se lean
   como una sola población.

   El marcado es fijo (index.html) y aquí sólo se parchean cifras y textos:
   reescribirlo en cada repintado volvería a disparar la entrada cada vez que
   contesta la base, y la pantalla parecería recargarse sola. */
function renderizarComposicion(indicadores) {
  const territorios = indicadores.territorios.length;
  const niveles = [
    {
      nivel: 'viviendas',
      valor: indicadores.viviendas,
      detalle: indicadores.viviendas === 0 ? 'Aún sin visitas'
        : (territorios > 0 ? 'en ' + textoCantidad(territorios, 'territorio', 'territorios') : '')
    },
    { nivel: 'hogares', valor: indicadores.hogares, detalle: textoRazon(indicadores.hogares, indicadores.viviendas, 'por vivienda') },
    { nivel: 'familias', valor: indicadores.familias, detalle: textoRazon(indicadores.familias, indicadores.hogares, 'por hogar') },
    { nivel: 'personas', valor: indicadores.personas, detalle: textoRazon(indicadores.personas, indicadores.familias, 'por familia') }
  ];

  niveles.forEach(function (nivel, i) {
    const caja = document.querySelector('.cadena__nivel[data-nivel="' + nivel.nivel + '"]');
    if (!caja) return;
    caja.classList.toggle('cadena__nivel--cero', nivel.valor === 0);
    const cifra = caja.querySelector('.cadena__valor');
    /* El conteo arranca cuando la cadena termina de entrar (--orden 2 por
       el --stagger de 55 ms) y avanza un nivel cada 55 ms más. */
    if (cifra) animarCifra(cifra, nivel.valor, 110 + i * 55);
    const detalle = caja.querySelector('.cadena__detalle');
    if (detalle) detalle.textContent = nivel.detalle;
  });

  /* RN-028: los hogares declarados que no estaban en la visita. Ámbar con
     punto, como todo lo pendiente; no se muestra cuando no hay ninguno. */
  const aviso = document.getElementById('hogaresSinCaracterizar');
  if (aviso) {
    const pendientes = indicadores.hogaresSinCaracterizar;
    aviso.hidden = pendientes === 0;
    aviso.querySelector('.cadena__aviso-texto').textContent =
      textoCantidad(pendientes, 'declarado sin caracterizar', 'declarados sin caracterizar');
  }
}

const TERRITORIOS_VISIBLES = 6;

/* Viviendas por territorio: una sola serie, así que no lleva leyenda (el
   título dice qué se mide) y cada barra lleva su cifra escrita al lado. Las
   barras se miden contra el territorio con más viviendas, no contra un
   total: no hay un «100 %» de cobertura que se conozca. */
function renderizarTerritorios(territorios) {
  const lista = document.getElementById('barrasTerritorio');
  if (!lista) return;

  const nota = document.getElementById('notaTerritorios');
  if (nota) nota.textContent = territorios.length ? textoCantidad(territorios.length, 'territorio', 'territorios') : '';

  if (territorios.length === 0) {
    lista.innerHTML = '<li class="barras__vacio">Cada vivienda caracterizada se suma aquí a su territorio.</li>';
    return;
  }

  /* Las barras crecen desde la base sólo en la primera pintura. Al repintar
     con lo que conteste la base, volver a crecer parecería una recarga. */
  lista.classList.toggle('barras--crece', !lista.dataset.pintado);
  lista.dataset.pintado = '1';

  const visibles = territorios.slice(0, TERRITORIOS_VISIBLES);
  const maximo = visibles[0].viviendas;
  const filas = visibles.map(function (territorio, i) {
    const etiqueta = etiquetaTerritorio(territorio.codigo);
    const nombre = etiqueta.indexOf(' · ') === -1 ? '' : etiqueta.split(' · ')[1];
    return (
      '<li class="barra" style="--proporcion: ' + (territorio.viviendas / maximo).toFixed(4) + '; --orden: ' + i + '">' +
        '<span class="barra__nombre">' +
          '<span class="barra__codigo">' + escaparHtml(territorio.codigo) + '</span>' +
          escaparHtml(nombre) +
        '</span>' +
        '<span class="barra__cifras">' +
          '<strong>' + formatearCantidad(territorio.viviendas) + '</strong> ' +
          (territorio.viviendas === 1 ? 'vivienda' : 'viviendas') +
          '<span class="barra__secundaria"> · ' + textoCantidad(territorio.familias, 'familia', 'familias') + '</span>' +
        '</span>' +
        '<span class="barra__carril" aria-hidden="true"><span class="barra__relleno"></span></span>' +
      '</li>'
    );
  });

  const resto = territorios.length - visibles.length;
  if (resto > 0) {
    filas.push('<li class="barras__resto">y ' + textoCantidad(resto, 'territorio más', 'territorios más') + '</li>');
  }
  lista.innerHTML = filas.join('');
}

/* Lo que requiere atención. "estado" tiñe la fila sólo cuando hay algo que
   contar: «0 situaciones inminentes» es una buena noticia, no una alerta. */
function renderizarAtencion(indicadores) {
  [
    { id: 'atencionInminente', valor: indicadores.situacionesInminentes, estado: 'alerta' },
    { id: 'atencionHacinamiento', valor: indicadores.conHacinamiento, estado: 'alerta' },
    { id: 'atencionPlan', valor: indicadores.planPendiente, estado: 'aviso' }
  ].forEach(function (fila, i) {
    const caja = document.getElementById(fila.id);
    if (!caja) return;
    const activo = fila.valor > 0;
    caja.classList.toggle('atencion__fila--alerta', activo && fila.estado === 'alerta');
    caja.classList.toggle('atencion__fila--aviso', activo && fila.estado === 'aviso');
    const cifra = caja.querySelector('.atencion__valor');
    if (cifra) animarCifra(cifra, fila.valor, 220 + i * 55);
  });
}

function renderizarIndicadores(encuestas) {
  const indicadores = calcularIndicadores(encuestas);

  const marcador = document.getElementById('totalFichas');
  if (marcador) animarCifra(marcador, indicadores.totalEncuestas, 0);

  renderizarComposicion(indicadores);
  renderizarTerritorios(indicadores.territorios);
  renderizarAtencion(indicadores);
}

/* «hoy a las 10:42», «ayer a las 16:05» o «el 12 oct a las 09:30». */
function textoCuando(fechaIso) {
  const fecha = new Date(fechaIso);
  if (!fechaIso || isNaN(fecha.getTime())) return '';
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const hora = ' a las ' + formatearHora(fechaIso);
  if (fecha.toDateString() === hoy.toDateString()) return 'hoy' + hora;
  if (fecha.toDateString() === ayer.toDateString()) return 'ayer' + hora;
  return 'el ' + fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + hora;
}

/* Icono del estado y contenido del botón en cada estado del módulo. */
const VISTA_SINCRONIA = {
  listo: { icono: 'ph-cloud-check', boton: 'Sincronizar ahora', botonIcono: 'ph-arrows-clockwise' },
  pendiente: { icono: 'ph-cloud-arrow-up', boton: 'Sincronizar ahora', botonIcono: 'ph-arrow-right' },
  subiendo: { icono: 'ph-arrows-clockwise', boton: 'Sincronizando…', botonIcono: null },
  'sin-red': { icono: 'ph-cloud-slash', boton: 'Esperando señal', botonIcono: null }
};

/**
 * Módulo de sincronización de Inicio, junto al total de fichas: lo primero
 * que se ve al abrir. Cuenta exactamente lo mismo que sincronizarEncuestas()
 * —fichas de este equipo que aún no están en la base— y dice en el mismo
 * sitio qué pasa y qué hacer:
 *   pendiente  ámbar, con el único punto que late, y el botón en azul lleno;
 *   listo      verde, con cuándo se sincronizó, y el botón en segundo plano;
 *   subiendo   «Subiendo 2 de 5…» con su barra de avance, botón ocupado;
 *   sin-red    las fichas esperan la señal, botón deshabilitado.
 * Sólo se parchea el marcado fijo de index.html: el estado cambia en cada
 * ficha que sube y reescribirlo haría parpadear el botón bajo el dedo.
 */
function renderizarEstadoSync() {
  const modulo = document.getElementById('sincronia');
  if (!modulo) return;

  const locales = obtenerEncuestas();
  const pendientes = locales.filter(function (e) { return e.sincronizada !== true; }).length;
  const curso = sincronizacionEnCurso;
  const ultima = leerUltimaSincronizacion();

  let estado;
  let titulo;
  let detalle;
  let avance = 0;

  if (curso) {
    estado = 'subiendo';
    if (curso.trayendo || curso.total === 0) {
      titulo = 'Consultando la base…';
      detalle = 'Trayendo lo que guardó el equipo';
      avance = 1;
    } else {
      titulo = 'Subiendo ' + Math.min(curso.hechas + 1, curso.total) + ' de ' + curso.total + '…';
      detalle = 'No cierre la aplicación';
      avance = curso.hechas / curso.total;
    }
  } else if (!haySenal()) {
    estado = 'sin-red';
    titulo = 'Sin conexión';
    detalle = pendientes > 0
      ? textoCantidad(pendientes, 'ficha espera', 'fichas esperan') + ' la señal'
      : 'Puede seguir capturando fichas';
  } else if (pendientes > 0) {
    estado = 'pendiente';
    titulo = textoCantidad(pendientes, 'ficha sin subir', 'fichas sin subir');
    detalle = 'Sólo están en este equipo';
  } else {
    estado = 'listo';
    if (locales.length === 0 && !ultima) {
      titulo = 'Nada por subir';
      detalle = 'Lo que guarde sin señal esperará aquí';
    } else {
      titulo = 'Todo está en la base';
      if (ultimoResultadoSync && ultimoResultadoSync.subidas > 0 && ultima) {
        detalle = textoCantidad(ultimoResultadoSync.subidas, 'ficha subida', 'fichas subidas') + ' ' + textoCuando(ultima);
      } else if (ultima) {
        detalle = 'Sincronizado ' + textoCuando(ultima);
      } else {
        detalle = 'Las fichas de este equipo ya subieron';
      }
    }
  }

  const vista = VISTA_SINCRONIA[estado];
  modulo.dataset.estado = estado;
  modulo.setAttribute('aria-busy', estado === 'subiendo' ? 'true' : 'false');

  const icono = modulo.querySelector('.sincronia__icono i');
  if (icono) icono.className = 'ph ' + vista.icono;
  modulo.querySelector('.sincronia__titulo').textContent = titulo;
  modulo.querySelector('.sincronia__detalle').textContent = detalle;

  const barra = modulo.querySelector('.sincronia__barra');
  barra.hidden = estado !== 'subiendo';
  barra.querySelector('.sincronia__avance').style.transform = 'scaleX(' + avance + ')';

  const boton = document.getElementById('btnSincronizar');
  boton.disabled = estado === 'subiendo' || estado === 'sin-red';
  boton.querySelector('.btn-sync__texto').textContent = vista.boton;
  const isla = boton.querySelector('.btn-sync__icono');
  isla.hidden = !vista.botonIcono;
  if (vista.botonIcono) isla.firstElementChild.className = 'ph ' + vista.botonIcono;
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

/* RN-200: plazo de atención por prioridad, contado desde que se detecta la
   alerta. Es el mismo de aps.plazo_prioridad() en la base. */
const HORAS_PLAZO_PRIORIDAD = { inmediata: 0, prioritaria: 72, regular: 30 * 24 };

/* Los planes de una ficha completa: el de la vivienda, el de cada familia y
   el de cada integrante. */
function planesDeFicha(encuesta) {
  const planes = [encuesta.planVivienda];
  (encuesta.familias || []).forEach(function (familia) {
    planes.push(familia.planFamilia);
    (familia.integrantes || []).forEach(function (integrante) { planes.push(integrante.planPersona); });
  });
  return planes.filter(Boolean);
}

/**
 * Lo que el historial muestra del plan de cuidado: alertas por prioridad, el
 * plazo más próximo de las que siguen sin conducta, derivaciones con su
 * próxima cita y seguimientos realizados. La fila de la base lo trae hecho
 * (api/_plan_cuidado.js); la ficha del dispositivo trae el plan completo y
 * se calcula aquí con el mismo motor de reglas que decidió si está
 * pendiente. Una fila sin lo uno ni lo otro devuelve null.
 */
function detallePlanDeFicha(encuesta) {
  const plan = encuesta && encuesta.planCuidado;
  if (plan && plan.detalle) return plan.detalle;
  if (!encuesta || !Array.isArray(encuesta.familias) || typeof evaluarAlertas !== 'function') return null;

  let alertas;
  let sinConducta;
  try {
    alertas = evaluarAlertas(encuesta);
    sinConducta = verificarTrazabilidadAlertas(encuesta, alertas);
  } catch (error) {
    return null;
  }

  const porPrioridad = { inmediata: 0, prioritaria: 0, regular: 0 };
  alertas.forEach(function (alerta) {
    if (porPrioridad[alerta.prioridad] !== undefined) porPrioridad[alerta.prioridad]++;
  });

  const detectada = new Date(encuesta.fechaRegistro || Date.now()).getTime();
  let vence = null;
  sinConducta.forEach(function (alerta) {
    const horas = HORAS_PLAZO_PRIORIDAD[alerta.prioridad];
    if (horas === undefined) return;
    const limite = detectada + horas * 3600000;
    if (vence === null || limite < vence) vence = limite;
  });

  const hoy = new Date().toISOString().split('T')[0];
  let derivadas = 0;
  let proximaCita = null;
  let hechos = 0;
  let esperados = 0;
  planesDeFicha(encuesta).forEach(function (p) {
    (p.acciones || []).forEach(function (accion) {
      if (!accion || !accion.codigoAccion) return;
      if (accion.tipoRespuesta === 'derivada') derivadas++;
      if (accion.fechaCita && accion.fechaCita >= hoy && (!proximaCita || accion.fechaCita < proximaCita)) {
        proximaCita = accion.fechaCita;
      }
    });
    (p.seguimientos || []).forEach(function (seg) {
      if (!seg || !seg.accionConcertada) return;
      esperados += 2;
      if (seg.seg1Fecha) hechos++;
      if (seg.seg2Fecha) hechos++;
    });
  });

  return {
    alertas: porPrioridad,
    venceSinConducta: vence === null ? null : new Date(vence).toISOString(),
    derivadas: derivadas,
    proximaCita: proximaCita,
    seguimientosHechos: hechos,
    seguimientosEsperados: esperados
  };
}

/* «Plazo vencido hace 3 días», «Vence en 2 días»… y qué tan urgente es:
   vencido (rojo), cerca —tres días o menos— (ámbar) o con tiempo. */
function plazoDeAtencion(venceIso) {
  const vence = new Date(venceIso);
  if (!venceIso || isNaN(vence.getTime())) return null;
  const DIA = 86400000;
  const resta = vence.getTime() - Date.now();
  if (resta <= 0) {
    const dias = Math.floor(-resta / DIA);
    return {
      nivel: 'vencido',
      texto: dias === 0 ? 'Plazo vencido hoy' : 'Plazo vencido hace ' + textoCantidad(dias, 'día', 'días')
    };
  }
  const dias = Math.ceil(resta / DIA);
  return {
    nivel: dias <= 3 ? 'cerca' : 'a-tiempo',
    texto: resta < DIA ? 'Vence en menos de un día' : 'Vence en ' + textoCantidad(dias, 'día', 'días')
  };
}

/**
 * El plan de cuidado en la tarjeta del historial: el estado (y la
 * autorización, si la hay) y, si quedan alertas sin conducta, el plazo de la
 * más urgente. El detalle de alertas, acciones y seguimientos está en «Ver».
 */
function resumenPlanEnHistorial(encuesta) {
  const plan = encuesta.planCuidado;
  const cabecera = badgePlanCuidado(encuesta) + badgeAutorizacionPlan(encuesta);
  const detalle = plan && plan.pendiente === true ? detallePlanDeFicha(encuesta) : null;
  const plazo = detalle ? plazoDeAtencion(detalle.venceSinConducta) : null;
  if (!plazo) return cabecera;

  return (
    '<div class="plan-resumen__cabecera">' + cabecera +
      '<span class="plan-resumen__plazo plan-resumen__plazo--' + plazo.nivel + '"' +
      ' title="Plazo de atención (RN-200) de la alerta sin conducta más urgente: ' +
      escaparHtml(formatearFechaHora(detalle.venceSinConducta)) + '">' +
      '<i class="ph ph-timer" aria-hidden="true"></i>' + escaparHtml(plazo.texto) + '</span>' +
    '</div>'
  );
}

/* RN-051 — Integrantes declarados en el ítem 51 que no estaban en la visita.
   La fila de la base trae la cuenta hecha (listar_fichas.js); la ficha del
   dispositivo se cuenta aquí, familia por familia. */
function integrantesPendientesDe(encuesta) {
  if (!encuesta) return 0;
  if (typeof encuesta.integrantesPendientes === 'number' && !Array.isArray(encuesta.familias)) {
    return encuesta.integrantesPendientes;
  }
  return (Array.isArray(encuesta.familias) ? encuesta.familias : []).reduce(function (total, familia) {
    const declarados = Number(familia && familia.numeroIntegrantes) || 0;
    const capturados = Array.isArray(familia && familia.integrantes) ? familia.integrantes.length : 0;
    return total + Math.max(0, declarados - capturados);
  }, 0);
}

function badgeSituacion(valor) {
  if (!requiereAtencionPrioritaria(valor)) return '<span class="badge badge--neutral">No aplica</span>';
  return '<span class="badge badge--warning">' +
    escaparHtml(etiquetasDeCatalogo(CAT_SITUACION_INMINENTE, situacionesPrioritarias(valor))) + '</span>';
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

/* Las fichas empezadas y guardadas sólo en este equipo (captura_local.js),
   arriba del historial: todavía no están cargadas a la base y hay que
   completarlas. «Continuar» las devuelve al formulario donde se dejaron. */
function renderizarFichasEnCurso() {
  const seccion = document.getElementById('fichasEnCurso');
  const lista = document.getElementById('listaEnCurso');
  if (!seccion || !lista || typeof obtenerFichasEnCurso !== 'function') return;

  const fichas = obtenerFichasEnCurso();
  seccion.hidden = fichas.length === 0;
  if (fichas.length === 0) {
    lista.innerHTML = '';
    return;
  }

  lista.innerHTML = fichas.map(function (borrador) {
    const datos = borrador.datos || {};
    const familias = Array.isArray(datos.familias) ? datos.familias : [];
    const personas = familias.reduce(function (total, f) {
      return total + (Array.isArray(f.integrantes) ? f.integrantes.length : 0);
    }, 0);
    const lugar = [datos.territorio ? etiquetaTerritorio(datos.territorio) : null,
      datos.direccion || datos.direccionLegible || null].filter(Boolean).join(' · ');
    const contenido = familias.length > 0
      ? textoCantidad(familias.length, 'familia', 'familias') + ' · ' + textoCantidad(personas, 'integrante', 'integrantes')
      : 'Sin familias todavía';
    const esCorreccion = Boolean(borrador.correccion && borrador.correccion.id);
    const clave = escaparHtml(borrador.clave);

    return (
      '<li class="en-curso__ficha">' +
        '<div class="en-curso__datos">' +
          '<p class="en-curso__codigo">' +
            '<span class="badge badge--warning">' + (esCorreccion ? 'Corrección sin terminar' : 'Sin terminar') + '</span>' +
            (borrador.codigoFicha ? '<span class="mono">' + escaparHtml(borrador.codigoFicha) + '</span>' : '') +
          '</p>' +
          (lugar ? '<p class="en-curso__lugar">' + escaparHtml(lugar) + '</p>' : '') +
          '<p class="en-curso__meta">' + escaparHtml(contenido) + ' · guardada en este equipo ' +
            escaparHtml(textoCuando(borrador.guardadoEn)) + '. No está en la base: complétela y pulse «Guardar todo».</p>' +
        '</div>' +
        '<div class="en-curso__acciones">' +
          '<button type="button" class="btn acciones-ficha__destacada" data-continuar="' + clave + '">' +
            '<i class="ph ph-arrow-right" aria-hidden="true"></i>Continuar</button>' +
          '<button type="button" class="btn acciones-ficha__boton" data-descartar-en-curso="' + clave + '">' +
            '<i class="ph ph-trash" aria-hidden="true"></i>Descartar</button>' +
        '</div>' +
      '</li>'
    );
  }).join('');

  lista.querySelectorAll('[data-continuar]').forEach(function (boton) {
    boton.addEventListener('click', function () { continuarFichaEnCurso(boton.dataset.continuar); });
  });
  lista.querySelectorAll('[data-descartar-en-curso]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      descartarFichaEnCurso(boton.dataset.descartarEnCurso, renderizarFichasEnCurso);
    });
  });
}

function renderizarHistorial() {
  renderizarFichasEnCurso();
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

    /* RN-228: una ficha que ya está en la base sólo se completa —«Evolucionar
       plan», si el plan quedó pendiente—. Corregirla es de la coordinación,
       el administrador y el maestro; el personal asistencial la corrige con
       una autorización vigente. Una ficha que todavía no sube se corrige
       libremente: aún no está registrada. Una fila que sólo existe en la base
       se trae entera de /api/ficha_completa. */
    const remota = encuesta.soloEnServidor === true;
    const enLaBase = remota || encuesta.sincronizada === true;
    const sinCorregir = enLaBase && !puedeCorregirEnLaBase(encuesta)
      ? ' disabled title="Ya está guardada: para corregirla necesita la autorización de la coordinación del EBS o del ' +
        'usuario maestro."' : '';
    const plan = encuesta.planCuidado || {};
    const sinEvolucionar = enLaBase && !puedeEvolucionarEnLaBase(encuesta)
      ? ' disabled title="Diligenciada por otra persona: su rol no permite evolucionar su plan."' : '';
    const id = escaparHtml(encuesta.id);
    /* La acción pendiente va primero y a lo ancho; las de consulta, en una
       fila de píldoras; eliminar, como ícono al final: es la menos frecuente
       y la única destructiva, y en rojo lleno pesaba más que las útiles. */
    /* RN-051: integrantes declarados que no estaban en la visita. Se agregan
       con «Completar integrantes», con el mismo alcance que evolucionar el
       plan; una ficha que aún no sube se corrige libremente. */
    const faltan = integrantesPendientesDe(encuesta);
    const sinCompletar = enLaBase && !puedeEvolucionarEnLaBase(encuesta) && !puedeCorregirEnLaBase(encuesta)
      ? ' disabled title="Diligenciada por otra persona: su rol no permite completar sus integrantes."' : '';
    const botonCompletar = faltan > 0
      ? '<button type="button" class="btn acciones-ficha__destacada acciones-ficha__destacada--integrantes" ' +
        'data-completar="' + id + '"' + sinCompletar + '>' +
        '<i class="ph ph-user-plus" aria-hidden="true"></i>Completar integrantes' +
        '<span class="acciones-ficha__conteo">' + (faltan === 1 ? 'falta 1' : 'faltan ' + faltan) + '</span></button>'
      : '';
    const botonEvolucionar = enLaBase && plan.pendiente === true
      ? '<button type="button" class="btn acciones-ficha__destacada" data-evolucionar="' + id + '"' + sinEvolucionar + '>' +
        '<i class="ph ph-clipboard-text" aria-hidden="true"></i>Evolucionar plan de cuidado</button>'
      : '';
    const botonAutorizar = enLaBase && puedeAutorizarPlan()
      ? '<button type="button" class="btn acciones-ficha__boton" data-autorizar="' + id + '"' +
        ' title="Autorizar a una persona a corregir esta ficha">' +
        '<i class="ph ph-shield-check" aria-hidden="true"></i>Autorizar</button>'
      : '';
    /* Eliminar es sólo del maestro: de la base, con motivo, si ya subió. */
    const botonEliminar = puedeEliminarFichas()
      ? '<button type="button" class="btn acciones-ficha__eliminar" data-eliminar="' + id + '" aria-label="Eliminar"' +
        ' title="' + (enLaBase ? 'Eliminar de la base' : 'Eliminar del dispositivo') + '">' +
        '<i class="ph ph-trash" aria-hidden="true"></i></button>'
      : '';

    return (
      '<tr>' +
        /* El código y el estado hacen falta para poder actuar sobre la fila:
           los rechazos de la API nombran la ficha por su código, y sin verlo
           aquí no había manera de saber cuál de todas hay que corregir. */
        '<td data-label="Ficha">' + textoSeguro(encuesta.codigoFicha) + '</td>' +
        '<td data-label="Estado">' + badgeSincronizacion(encuesta.sincronizada) + '</td>' +
        '<td data-label="Plan de cuidado" class="celda-plan">' + resumenPlanEnHistorial(encuesta) + '</td>' +
        '<td data-label="Fecha y hora">' + formatearFecha(encuesta.fechaRegistro) +
          (formatearHora(encuesta.fechaRegistro)
            ? '<span class="celda-hora">' + formatearHora(encuesta.fechaRegistro) + '</span>'
            : '') + '</td>' +
        '<td data-label="Modificación">' + textoModificacion(encuesta) + '</td>' +
        '<td data-label="Territorio">' + textoTerritorio(encuesta) + '</td>' +
        '<td data-label="Microterritorio">' + textoMicroterritorio(encuesta) + '</td>' +
        '<td data-label="Dirección">' + textoSeguro(encuesta.direccion) + '</td>' +
        '<td data-label="Personas/Hab.">' + personasPorHabitacion + '</td>' +
        '<td data-label="Hacinamiento">' + badgeHacinamiento(encuesta.hacinamiento) + '</td>' +
        '<td data-label="Situación inminente">' + badgeSituacion(encuesta.situacionInminente) + '</td>' +
        '<td class="actions-cell">' +
          '<div class="acciones-ficha">' +
            botonCompletar +
            botonEvolucionar +
            '<div class="acciones-ficha__fila">' +
              '<button type="button" class="btn acciones-ficha__boton" data-ver="' + id + '">' +
                '<i class="ph ph-eye" aria-hidden="true"></i>Ver</button>' +
              '<button type="button" class="btn acciones-ficha__boton" data-corregir="' + id + '"' + sinCorregir + '>' +
                '<i class="ph ph-pencil-simple" aria-hidden="true"></i>Corregir</button>' +
              botonAutorizar +
              botonEliminar +
            '</div>' +
          '</div>' +
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
  cuerpoTabla.querySelectorAll('[data-evolucionar]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirEvolucionDePlan(boton.dataset.evolucionar); });
  });
  cuerpoTabla.querySelectorAll('[data-completar]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirCompletarIntegrantes(boton.dataset.completar); });
  });
  cuerpoTabla.querySelectorAll('[data-autorizar]').forEach(function (boton) {
    boton.addEventListener('click', function () { abrirAutorizacionDePlan(boton.dataset.autorizar); });
  });
}

/* ---------------------------------------------------------
   15b. AUTORIZACIÓN PARA CORREGIR UNA FICHA GUARDADA (RN-228)
   ---------------------------------------------------------
   Una ficha guardada sólo se completa. Para corregirla —incluido lo
   registrado en su plan de cuidado—, la coordinación del EBS o el usuario
   maestro autorizan a una persona sobre esa ficha; la autorización sirve
   para un guardado (api/permisos_plan.js, guardar_encuesta.js).
   --------------------------------------------------------- */

function puedeAutorizarPlan() {
  if (typeof SESION === 'undefined' || typeof puede !== 'function') return false;
  const usuario = SESION.usuario();
  return Boolean(usuario) && puede(usuario.rol, 'ficha.autorizar');
}

/* La fila de la base de una ficha, también cuando el historial muestra la
   copia del dispositivo: la autorización vigente viaja en la de la base. */
function filaDelServidor(codigoFicha) {
  return (cacheFichasDelServidor || []).find(function (e) { return e.codigoFicha === codigoFicha; }) || null;
}

/* Elimina de la base una ficha registrada (sólo el maestro). Si además hay
   copia en este dispositivo, se borra también, para que no vuelva a subir. */
async function eliminarFichaDeLaBase(ficha, copiaLocal, motivo) {
  let respuesta;
  let cuerpo;
  try {
    respuesta = await fetch('/api/ficha_completa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', codigo: ficha.codigoFicha, motivo: motivo })
    });
    cuerpo = await respuesta.json().catch(function () { return {}; });
  } catch (error) {
    mostrarNotificacion('Sin conexión: para eliminar una ficha de la base hace falta red.', 'warning');
    return;
  }

  if (!respuesta.ok) {
    mostrarNotificacion(cuerpo.error || 'No fue posible eliminar la ficha.', 'error');
    return;
  }

  if (copiaLocal) eliminarEncuestaPorId(copiaLocal.id);
  cacheFichasDelServidor = (cacheFichasDelServidor || []).filter(function (e) {
    return e.codigoFicha !== ficha.codigoFicha;
  });
  renderizarHistorial();
  mostrarNotificacion('La ficha ' + ficha.codigoFicha + ' se eliminó de la base. El motivo quedó en la auditoría.',
    'success');
}

/* El usuario de la sesión en la forma que esperan las reglas de roles.js
   (el equipo va como código, igual que en las filas del historial). */
function usuarioParaReglas() {
  if (typeof SESION === 'undefined' || !SESION.usuario) return null;
  const usuario = SESION.usuario();
  return usuario ? { rol: usuario.rol, equipoSaludId: usuario.equipoCodigo, funcionarioId: usuario.funcionarioId } : null;
}

/* RN-228 — Corregir una ficha que ya está en la base: por el rol
   (coordinación, administrador, maestro) o con una autorización vigente,
   que llega en la fila del historial. La misma regla que aplica el servidor;
   aquí sólo decide si el botón se ofrece. */
function puedeCorregirEnLaBase(encuesta) {
  const usuario = usuarioParaReglas();
  if (!usuario || typeof puedeCorregir !== 'function') return encuesta.soloEnServidor !== true;
  const fila = encuesta.soloEnServidor === true ? encuesta : filaDelServidor(encuesta.codigoFicha);
  if (fila && fila.permisoPlan === true) return true;
  if (!fila) return puede(usuario.rol, 'ficha.corregir.todas');
  return puedeCorregir(usuario, { equipoSaludId: fila.equipoSaludId, responsableId: fila.responsableId });
}

/* «Evolucionar plan»: completar el plan pendiente, dentro del alcance del rol
   (las fichas del equipo, o las propias para el personal técnico). Sin la
   fila del servidor no se puede saber de quién es; evolucionar necesita red
   de todos modos y el servidor decide. */
function puedeEvolucionarEnLaBase(encuesta) {
  const usuario = usuarioParaReglas();
  if (!usuario || typeof puedeEvolucionar !== 'function') return encuesta.soloEnServidor !== true;
  const fila = encuesta.soloEnServidor === true ? encuesta : filaDelServidor(encuesta.codigoFicha);
  if (!fila) return true;
  return fila.permisoPlan === true ||
    puedeEvolucionar(usuario, { equipoSaludId: fila.equipoSaludId, responsableId: fila.responsableId });
}

function badgeAutorizacionPlan(encuesta) {
  const fila = encuesta.permisoPlan === true ? encuesta : filaDelServidor(encuesta.codigoFicha);
  if (!fila || fila.permisoPlan !== true) return '';
  return ' <span class="badge badge--info" title="La coordinación del EBS o el usuario maestro le autorizó ' +
    'corregir esta ficha, incluido lo ya registrado en su plan de cuidado. Sirve para un guardado: ábrala con ' +
    'Corregir.">Corrección autorizada</span>';
}

async function pedirPermisosPlan(metodo, cuerpo, codigo) {
  const respuesta = metodo === 'GET'
    ? await fetch('/api/permisos_plan?codigo=' + encodeURIComponent(codigo))
    : await fetch('/api/permisos_plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
  const datos = await respuesta.json().catch(function () { return {}; });
  if (!respuesta.ok) throw new Error(datos.error || 'HTTP ' + respuesta.status);
  return datos;
}

function htmlAutorizacionPlan(datos) {
  const etiquetaRol = function (rol) {
    return typeof etiquetaDeRol === 'function' ? etiquetaDeRol(rol) : rol;
  };
  const iniciales = function (nombre) {
    return String(nombre || '').trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  };

  const vigentes = datos.permisos.length === 0
    ? '<div class="autorizacion-plan__vacio"><i class="ph ph-lock-simple" aria-hidden="true"></i>' +
        '<span>Nadie tiene autorización vigente: la ficha sólo se completa con «Evolucionar plan».</span></div>'
    : '<ul class="autorizacion-plan__lista">' + datos.permisos.map(function (permiso) {
      return '<li class="autorizacion-plan__permiso">' +
        '<span class="autorizacion-plan__avatar" aria-hidden="true">' + escaparHtml(iniciales(permiso.usuario.nombre)) + '</span>' +
        '<span class="autorizacion-plan__persona">' +
          '<strong>' + escaparHtml(permiso.usuario.nombre) + '</strong>' +
          '<span class="autorizacion-plan__detalle"><span class="mono">' + escaparHtml(permiso.usuario.documento) + '</span>' +
            ' · desde el ' + escaparHtml(formatearFecha(permiso.otorgadoEn)) + '</span>' +
          (permiso.motivo ? '<span class="autorizacion-plan__motivo">' + escaparHtml(permiso.motivo) + '</span>' : '') +
        '</span>' +
        '<button type="button" class="btn autorizacion-plan__revocar" data-revocar-permiso="' + permiso.id + '">Revocar</button>' +
      '</li>';
    }).join('') + '</ul>';

  /* Agrupadas por perfil: en un equipo hay varias personas y el rol es lo
     primero que se busca. */
  const porRol = {};
  datos.candidatos.forEach(function (c) {
    const rol = etiquetaRol(c.rol);
    (porRol[rol] = porRol[rol] || []).push(c);
  });
  const opciones = Object.keys(porRol).sort().map(function (rol) {
    return '<optgroup label="' + escaparHtml(rol) + '">' + porRol[rol].map(function (c) {
      return '<option value="' + c.id + '">' + escaparHtml(c.nombre + ' — ' + c.documento) + '</option>';
    }).join('') + '</optgroup>';
  }).join('');

  const nuevo = datos.candidatos.length === 0
    ? '<div class="autorizacion-plan__vacio"><i class="ph ph-user-circle-minus" aria-hidden="true"></i>' +
        '<span>No hay a quién autorizar: quienes ven esta ficha ya pueden corregirla.</span></div>'
    : '<div class="autorizacion-plan__campo">' +
        '<label for="autorizarUsuario">Persona</label>' +
        '<select id="autorizarUsuario"><option value="">Seleccione a quién autoriza…</option>' + opciones + '</select>' +
        '<span class="autorizacion-plan__ayuda">Solo aparecen quienes ven esta ficha en su historial y no pueden ' +
          'corregirla por sí mismos.</span>' +
      '</div>' +
      '<div class="autorizacion-plan__campo">' +
        '<label for="autorizarMotivo">Motivo <span class="autorizacion-plan__opcional">(opcional)</span>' +
          '<span class="autorizacion-plan__contador" id="autorizarContador">0/300</span></label>' +
        '<textarea id="autorizarMotivo" maxlength="300" rows="3" ' +
          'placeholder="Ej.: el código de la acción quedó mal registrado"></textarea>' +
      '</div>' +
      '<div class="autorizacion-plan__nota"><i class="ph ph-info" aria-hidden="true"></i>' +
        '<span>La autorización sirve para <strong>un solo guardado</strong>: al guardar, la ficha vuelve a ' +
        'quedar bloqueada.</span></div>';

  return '<div class="autorizacion-plan">' +
    '<p class="autorizacion-plan__intro">Permita que una persona corrija la ficha —incluido lo ya registrado en su ' +
      'plan de cuidado— ' +
      '<span class="autorizacion-plan__ficha mono">' + escaparHtml(datos.ficha.codigo) + '</span></p>' +
    '<section class="autorizacion-plan__bloque">' +
      '<h4 class="autorizacion-plan__titulo">Autorizaciones vigentes' +
        '<span class="autorizacion-plan__conteo">' + datos.permisos.length + '</span></h4>' + vigentes +
    '</section>' +
    '<section class="autorizacion-plan__bloque">' +
      '<h4 class="autorizacion-plan__titulo">Nueva autorización</h4>' + nuevo +
    '</section>' +
  '</div>';
}

async function abrirAutorizacionDePlan(id) {
  const encuesta = obtenerEncuestasParaMostrar().find(function (e) { return e.id === id; });
  if (!encuesta || typeof Swal === 'undefined') return;

  let datos;
  try {
    datos = await pedirPermisosPlan('GET', null, encuesta.codigoFicha);
  } catch (error) {
    mostrarNotificacion('No fue posible consultar las autorizaciones de la ficha: ' + error.message, 'error');
    return;
  }

  const resultado = await Swal.fire({
    title: 'Autorizar corrección de la ficha',
    html: htmlAutorizacionPlan(datos),
    width: 540,
    customClass: { popup: 'swal-autorizacion' },
    showCancelButton: true,
    showConfirmButton: datos.candidatos.length > 0,
    confirmButtonText: '<i class="ph ph-shield-check" aria-hidden="true"></i> Autorizar',
    cancelButtonText: 'Cerrar',
    reverseButtons: true,
    confirmButtonColor: '#0060a0',
    background: '#ffffff',
    color: '#0b1220',
    focusConfirm: false,
    didOpen: function (popup) {
      const motivo = popup.querySelector('#autorizarMotivo');
      const contador = popup.querySelector('#autorizarContador');
      if (motivo && contador) {
        motivo.addEventListener('input', function () {
          contador.textContent = motivo.value.length + '/300';
        });
      }
      popup.querySelectorAll('[data-revocar-permiso]').forEach(function (boton) {
        boton.addEventListener('click', async function () {
          boton.disabled = true;
          try {
            await pedirPermisosPlan('POST', { accion: 'revocar', permisoId: Number(boton.dataset.revocarPermiso) });
            Swal.close();
            mostrarNotificacion('Se revocó la autorización sobre la ficha ' + encuesta.codigoFicha + '.', 'success',
              function () { abrirAutorizacionDePlan(id); });
          } catch (error) {
            boton.disabled = false;
            Swal.showValidationMessage('No fue posible revocarla: ' + error.message);
          }
        });
      });
    },
    preConfirm: function () {
      const usuarioId = Number((document.getElementById('autorizarUsuario') || {}).value);
      if (!usuarioId) {
        Swal.showValidationMessage('Seleccione a quién autoriza.');
        return false;
      }
      return {
        usuarioId: usuarioId,
        motivo: ((document.getElementById('autorizarMotivo') || {}).value || '').trim()
      };
    }
  });

  if (!resultado.isConfirmed || !resultado.value) return;

  const elegido = datos.candidatos.find(function (c) { return c.id === resultado.value.usuarioId; });
  try {
    await pedirPermisosPlan('POST', {
      accion: 'otorgar', codigo: encuesta.codigoFicha,
      usuarioId: resultado.value.usuarioId, motivo: resultado.value.motivo
    });
  } catch (error) {
    mostrarNotificacion('No fue posible dar la autorización: ' + error.message, 'error');
    return;
  }

  mostrarNotificacion('Se autorizó a ' + (elegido ? elegido.nombre : 'la persona elegida') +
    ' a modificar lo registrado en el plan de cuidado de la ficha ' + encuesta.codigoFicha +
    '. La autorización sirve para un guardado.', 'success');
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

/**
 * Cuándo recibió el servidor la ficha, sólo si difiere de cuándo se
 * diligenció: una visita tomada sin señal se sincroniza después, y ese desfase
 * es lo que el control quiere ver. Con menos de dos minutos son lo mismo.
 */
function recepcionSiDifiere(encuesta) {
  if (!encuesta.recibidaEn || !encuesta.fechaRegistro) return null;
  const desfase = Math.abs(new Date(encuesta.recibidaEn) - new Date(encuesta.fechaRegistro));
  return desfase > 2 * 60 * 1000 ? formatearFechaHora(encuesta.recibidaEn, true) : null;
}

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

function textoCantidad(n, singular, plural) {
  return n + ' ' + (n === 1 ? singular : plural);
}

/* Un integrante en dos líneas: el nombre, y «Responsable económico de la
   familia · Mujer · 40 años · CC 1144099887». La edad es la que tenía el día
   de la visita, como la calculan las reglas. */
function construirIntegranteDetalle(integrante, fechaReferencia) {
  const nombre = [integrante.primerNombre, integrante.segundoNombre,
    integrante.primerApellido, integrante.segundoApellido].filter(Boolean).join(' ');
  const documento = [integrante.tipoId, integrante.numeroId].filter(Boolean).join(' ');
  const edad = calcularEdad(integrante.fechaNacimiento, fechaReferencia);

  const datos = [
    etiquetaDeCatalogo(CAT_ROL_FAMILIAR, integrante.rolFamiliar),
    etiquetaDeCatalogo(CAT_SEXO, integrante.sexo),
    edad ? describirEdad(edad) : null
  ].filter(Boolean).map(escaparHtml);
  if (documento) datos.push('<span class="mono">' + escaparHtml(documento) + '</span>');

  return (
    '<li class="detalle-integrante">' +
      '<span class="detalle-integrante__nombre">' + textoSeguro(nombre) + '</span>' +
      (datos.length > 0 ? '<span class="detalle-integrante__datos">' + datos.join(' · ') + '</span>' : '') +
    '</li>'
  );
}

/* Una familia dentro de su hogar: el núcleo con su código, su tipo y la lista
   de sus integrantes. */
function construirFamiliaDetalle(familia, fechaReferencia) {
  const integrantes = Array.isArray(familia.integrantes) ? familia.integrantes : [];
  const declarados = Number(familia.numeroIntegrantes) || 0;
  const conteo = declarados > integrantes.length
    ? integrantes.length + ' de ' + declarados + ' integrantes caracterizados'
    : textoCantidad(integrantes.length, 'integrante', 'integrantes');
  const meta = [etiquetaDeCatalogo(CAT_TIPO_FAMILIA, familia.tipoFamilia), conteo]
    .filter(Boolean).map(escaparHtml).join(' · ');

  return (
    '<div class="detalle-familia">' +
      '<h5 class="detalle-familia__titulo">Familia' +
        (familia.idFamilia ? ' <span class="mono">' + escaparHtml(familia.idFamilia) + '</span>' : '') +
        (familia.codigoCf ? ' · ficha <span class="mono">' + escaparHtml(familia.codigoCf) + '</span>' : '') +
      '</h5>' +
      '<p class="detalle-familia__meta">' + meta + '</p>' +
      (integrantes.length > 0
        ? '<p class="detalle-familia__etiqueta">Integrantes</p>' +
          '<ul class="detalle-integrantes">' + integrantes.map(function (integrante) {
            return construirIntegranteDetalle(integrante, fechaReferencia);
          }).join('') + '</ul>'
        : '') +
    '</div>'
  );
}

/* Un hogar contiene una o varias familias y cada familia a sus integrantes:
   el hogar es la carcasa y cada familia un núcleo dentro de él. Sin familias
   es un hogar declarado en el ítem 28 que no estaba en la visita. */
function construirHogarDetalle(numero, familias, fechaReferencia) {
  if (familias.length === 0) {
    return (
      '<li class="detalle-hogar">' +
        '<div class="detalle-hogar__cabecera">' +
          '<h4 class="detalle-hogar__titulo">Hogar ' + numero + '</h4>' +
          '<span class="badge badge--warning">Sin caracterizar</span>' +
        '</div>' +
        '<p class="detalle-hogar__nota">Declarado en el ítem 28; no estaba en la visita. ' +
          'Se caracteriza desde Historial → Corregir (RN-028).</p>' +
      '</li>'
    );
  }

  return (
    '<li class="detalle-hogar">' +
      '<div class="detalle-hogar__cabecera">' +
        '<h4 class="detalle-hogar__titulo">Hogar ' + numero + '</h4>' +
        (familias.length > 1
          ? '<span class="detalle-hogar__conteo">' + textoCantidad(familias.length, 'familia', 'familias') + '</span>'
          : '') +
      '</div>' +
      familias.map(function (familia) {
        return construirFamiliaDetalle(familia, fechaReferencia);
      }).join('') +
    '</li>'
  );
}

/* Secciones 4 y 5 del instrumento como se ven en terreno: la vivienda alberga
   uno o varios hogares (ítem 28), cada hogar una o varias familias y cada
   familia a sus integrantes. Las familias se agrupan por el hogar que
   declaran; una sin hogar (fichas anteriores al campo) es un hogar propio.
   Los hogares declarados sin familias quedan a la vista como pendientes
   (RN-028). */
function construirSeccionHogares(encuesta) {
  const familias = Array.isArray(encuesta.familias) ? encuesta.familias : [];
  const declarados = Number(encuesta.hogaresEnVivienda) || 0;
  const personas = familias.reduce(function (total, familia) {
    return total + (Array.isArray(familia.integrantes) ? familia.integrantes.length : 0);
  }, 0);

  const porHogar = new Map();
  familias.forEach(function (familia, i) {
    const numero = Number(familia.hogarNumero) >= 1 ? Number(familia.hogarNumero) : i + 1;
    if (!porHogar.has(numero)) porHogar.set(numero, []);
    porHogar.get(numero).push(familia);
  });
  const ultimo = Math.max.apply(null, [declarados].concat(Array.from(porHogar.keys())));

  const resumen = declarados > porHogar.size
    ? [textoCantidad(declarados, 'hogar declarado', 'hogares declarados'),
      textoCantidad(porHogar.size, 'caracterizado', 'caracterizados')]
    : [textoCantidad(porHogar.size, 'hogar', 'hogares')];
  resumen.push(textoCantidad(familias.length, 'familia', 'familias'));
  resumen.push(textoCantidad(personas, 'persona', 'personas'));

  const hogares = [];
  for (let numero = 1; numero <= ultimo; numero++) {
    hogares.push(construirHogarDetalle(numero, porHogar.get(numero) || [], encuesta.fechaDiligenciamiento));
  }

  return (
    '<div class="detail-section">' +
      '<h3>Hogares y familias de la vivienda</h3>' +
      '<p class="detalle-hogares__resumen">' + escaparHtml(resumen.join(' · ')) + '</p>' +
      (hogares.length > 0 ? '<ol class="detalle-hogares">' + hogares.join('') + '</ol>' : '') +
    '</div>'
  );
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

  const fichaConPlan = await fichaConPlanCompleto(encuesta);

  const microterritorio = buscarMicroterritorio(encuesta.territorio, encuesta.microterritorio);
  const perfil = encuesta.perfilProfesional === 'otro'
    ? 'Otro: ' + (encuesta.perfilProfesionalOtro || '')
    : etiquetaDeCatalogo(CAT_PERFIL_PROFESIONAL, encuesta.perfilProfesional);

  const cuerpo = document.getElementById('modalDetalleBody');
  cuerpo.innerHTML =
    construirSeccionDetalle('Consentimiento y situación inminente', [
      { etiqueta: 'Consentimiento informado (RN-001)', valor: textoSiNo(encuesta.consentimiento) },
      { etiqueta: 'Situación inminente (RN-002)', valor: etiquetasDeCatalogo(CAT_SITUACION_INMINENTE, comoLista(encuesta.situacionInminente)) },
      { etiqueta: 'Observaciones de la situación', valor: encuesta.observacionesSituacion }
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
      { etiqueta: 'Fecha y hora de diligenciamiento', valor: formatearFechaHora(encuesta.fechaRegistro, true) },
      ...(recepcionSiDifiere(encuesta)
        ? [{ etiqueta: 'Recibida en el servidor', valor: recepcionSiDifiere(encuesta) }]
        : []),
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
      { etiqueta: 'NUV (número único de vivienda)', valor: encuesta.nuv },
      { etiqueta: 'N.° Identificación del hogar', valor: encuesta.idHogar },
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
    construirSeccionHogares(encuesta) +
    construirSeccionPlan(encuesta, fichaConPlan);

  document.getElementById('modalDetalle').hidden = false;
}

/**
 * La ficha con sus planes de cuidado completos, para la sección del plan del
 * detalle. La del dispositivo ya los trae. La que sólo está en la base se
 * pide a /api/ficha_completa, que decide si este usuario puede verlos —quien
 * corrige la ficha o evoluciona su plan— y deja la consulta en auditoría;
 * si no puede, o no hay red, el detalle muestra sólo el resumen.
 */
async function fichaConPlanCompleto(encuesta) {
  if (!encuesta.soloEnServidor) return encuesta;
  if (!puedeEvolucionarEnLaBase(encuesta) && !puedeCorregirEnLaBase(encuesta)) return null;
  try {
    const respuesta = await fetch('/api/ficha_completa?codigo=' + encodeURIComponent(encuesta.codigoFicha));
    if (!respuesta.ok) return null;
    const cuerpo = await respuesta.json();
    if (!cuerpo || !cuerpo.encuesta) return null;
    return Object.assign({}, cuerpo.encuesta, { fechaRegistro: encuesta.fechaRegistro });
  } catch (error) {
    console.warn('No fue posible traer el plan de cuidado de la ficha:', error);
    return null;
  }
}

const NOMBRE_PRIORIDAD = { inmediata: 'Inmediata', prioritaria: 'Prioritaria', regular: 'Regular' };
const ETIQUETA_AMBITO_PLAN = { vivienda: 'Plan de la vivienda', familia: 'Plan de la familia', persona: 'Plan de la persona' };

/* Fecha de una columna date ('2026-10-19' → «19 oct 2026»), leída como fecha
   local para que no retroceda un día por la zona horaria. */
function fechaDeColumna(fechaTexto) {
  const partes = String(fechaTexto || '').split('-').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return '';
  return new Date(partes[0], partes[1] - 1, partes[2])
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Nombre CUPS / NoCUPS de un código, si el dispositivo ya lo conoce (el
   catálogo descargado o los códigos ya resueltos por el buscador). */
function nombreDeAccion(codigo) {
  const opcion = (typeof CAT_ACCION_PLAN !== 'undefined' ? CAT_ACCION_PLAN : [])
    .find(function (o) { return o.valor === codigo; });
  if (opcion) return opcion.etiqueta.replace(codigo + ' — ', '');
  if (typeof CUPS_RESUELTOS !== 'undefined' && CUPS_RESUELTOS.get(codigo)) return CUPS_RESUELTOS.get(codigo);
  return null;
}

function accionesDelPlan(plan) {
  return (plan && plan.acciones || []).filter(function (a) { return a && a.codigoAccion; });
}

function seguimientosDelPlan(plan) {
  return (plan && plan.seguimientos || []).filter(function (s) { return s && s.accionConcertada; });
}

/* Los planes de la ficha que tienen algo registrado, con el nombre de a quién
   pertenecen: la vivienda, cada familia por su código, cada persona. */
function planesConNombre(encuesta) {
  const lista = [{ titulo: 'Plan de la vivienda', plan: encuesta.planVivienda }];
  (encuesta.familias || []).forEach(function (familia, i) {
    lista.push({ titulo: 'Plan de la familia', codigo: familia.idFamilia || String(i + 1), plan: familia.planFamilia });
    (familia.integrantes || []).forEach(function (integrante, j) {
      lista.push({ titulo: 'Plan de ' + nombreIntegrante(integrante, j), plan: integrante.planPersona });
    });
  });
  return lista.filter(function (item) {
    return accionesDelPlan(item.plan).length > 0 || seguimientosDelPlan(item.plan).length > 0;
  });
}

function construirAccionDetalle(accion) {
  const nombre = nombreDeAccion(accion.codigoAccion);
  const ejecutor = [accion.ejecutorTipoId, accion.ejecutorNumeroId].filter(Boolean).join(' ');
  const respuesta = accion.tipoRespuesta === 'derivada'
    ? 'Derivada' + (accion.institucionDestino ? ' a ' + escaparHtml(accion.institucionDestino) : '') +
      (accion.fechaCita ? ' · cita el ' + escaparHtml(fechaDeColumna(accion.fechaCita)) : ' · sin cita asignada')
    : escaparHtml(etiquetaDeCatalogo(CAT_TIPO_RESPUESTA, accion.tipoRespuesta) || 'Sin tipo de respuesta');

  return (
    '<li class="detalle-plan__item">' +
      '<p class="detalle-plan__accion">' +
        '<span class="mono detalle-plan__codigo">' + escaparHtml(accion.codigoAccion) + '</span>' +
        (nombre ? '<span>' + escaparHtml(nombre) + '</span>' : '') +
      '</p>' +
      (accion.procedimientoRealizado
        ? '<p class="detalle-plan__texto">' + escaparHtml(accion.procedimientoRealizado) + '</p>' : '') +
      '<p class="detalle-plan__meta">' +
        '<span class="detalle-plan__respuesta detalle-plan__respuesta--' +
          (accion.tipoRespuesta === 'derivada' ? 'derivada' : 'sitio') + '">' + respuesta + '</span>' +
        (ejecutor ? '<span>Ejecutó <span class="mono">' + escaparHtml(ejecutor) + '</span></span>' : '') +
      '</p>' +
    '</li>'
  );
}

/* Un seguimiento: el acuerdo y sus dos controles (ítems 118-119), cada uno
   con su fecha y su estado C / CP / NC, o «pendiente» si aún no se hizo. */
function construirSeguimientoDetalle(seg) {
  const control = function (orden, fecha, estado, motivo) {
    if (!fecha) {
      return '<span class="detalle-plan__control detalle-plan__control--pendiente">' + orden + ': pendiente</span>';
    }
    const cumple = estado === 'C';
    return (
      '<span class="detalle-plan__control detalle-plan__control--' + (cumple ? 'cumple' : 'parcial') + '">' +
        orden + ': ' + escaparHtml(fechaDeColumna(fecha)) +
        (estado ? ' · ' + escaparHtml(etiquetaDeCatalogo(CAT_ESTADO_SEGUIMIENTO, estado)) : '') +
      '</span>' +
      (motivo ? '<span class="detalle-plan__motivo">Motivo: ' + escaparHtml(motivo) + '</span>' : '')
    );
  };
  const responsable = [seg.seguimientoTipoId, seg.seguimientoNumeroId].filter(Boolean).join(' ');

  return (
    '<li class="detalle-plan__item">' +
      '<p class="detalle-plan__texto detalle-plan__texto--fuerte">' + escaparHtml(seg.accionConcertada) + '</p>' +
      '<p class="detalle-plan__meta">' +
        control('1.er seguimiento', seg.seg1Fecha, seg.seg1Estado, seg.seg1MotivoNc) +
        control('2.º seguimiento', seg.seg2Fecha, seg.seg2Estado, seg.seg2MotivoNc) +
        (responsable ? '<span>Responsable <span class="mono">' + escaparHtml(responsable) + '</span></span>' : '') +
      '</p>' +
    '</li>'
  );
}

/* Cada alerta con su prioridad, a quién se refiere y si ya tiene conducta en
   su plan (RN-220); las que no, con su plazo de atención (RN-200). */
function construirAlertasDetalle(completa) {
  let alertas;
  let sinConducta;
  try {
    alertas = evaluarAlertas(completa);
    sinConducta = verificarTrazabilidadAlertas(completa, alertas);
  } catch (error) {
    return '';
  }
  if (alertas.length === 0) {
    return '<p class="detalle-plan__vacio">La ficha no generó alertas.</p>';
  }

  const clave = function (a) { return [a.codigo, a.plan, a.referencia, a.ruta].join('|'); };
  const pendientes = new Set(sinConducta.map(clave));
  const detectada = new Date(completa.fechaRegistro || Date.now()).getTime();

  const filas = alertas.slice().sort(function (a, b) {
    /* ORDEN_PRIORIDAD viene de reglas.js: más alto, más urgente. */
    return (ORDEN_PRIORIDAD[b.prioridad] || 0) - (ORDEN_PRIORIDAD[a.prioridad] || 0);
  }).map(function (alerta) {
    const pendiente = pendientes.has(clave(alerta));
    const horas = HORAS_PLAZO_PRIORIDAD[alerta.prioridad];
    const plazo = pendiente && horas !== undefined
      ? plazoDeAtencion(new Date(detectada + horas * 3600000).toISOString()) : null;
    /* A quién se refiere (familia, integrante) y qué plan debe responderla. */
    const meta = [alerta.referencia, ETIQUETA_AMBITO_PLAN[alerta.plan]].filter(Boolean).map(escaparHtml).join(' · ');

    return (
      '<li class="detalle-plan__alerta">' +
        '<span class="prioridad-chip prioridad-chip--' + escaparHtml(alerta.prioridad) + '">' +
          escaparHtml(NOMBRE_PRIORIDAD[alerta.prioridad] || alerta.prioridad) + '</span>' +
        '<span class="detalle-plan__alerta-texto">' +
          '<span class="detalle-plan__alerta-titulo">' + escaparHtml(alerta.titulo) + '</span>' +
          '<span class="detalle-plan__alerta-meta">' +
            (alerta.codigo ? '<span class="mono">' + escaparHtml(alerta.codigo) + '</span> · ' : '') +
            meta +
          '</span>' +
        '</span>' +
        '<span class="detalle-plan__alerta-estado">' +
          (pendiente
            ? '<span class="badge badge--plan-pendiente">Sin conducta</span>' +
              (plazo ? '<span class="plan-resumen__plazo plan-resumen__plazo--' + plazo.nivel + '">' +
                escaparHtml(plazo.texto) + '</span>' : '')
            : '<span class="badge badge--plan-registrado">Con conducta</span>') +
        '</span>' +
      '</li>'
    );
  });

  return '<ul class="detalle-plan__alertas">' + filas.join('') + '</ul>';
}

/**
 * Sección «Plan de cuidado» del detalle. Con los planes a la mano: el estado,
 * el plazo y las cuentas arriba; las alertas una por una; y cada plan con sus
 * acciones (código, procedimiento, en sitio o derivada con su cita, quién la
 * hizo) y sus seguimientos (acuerdo, dos controles con fecha y estado). Sin
 * ellos —una ficha de la base que este rol no corrige ni evoluciona—, el
 * resumen que trajo el historial y por qué no hay más.
 */
function construirSeccionPlan(encuesta, completa) {
  const plan = encuesta.planCuidado;
  const detalle = completa ? detallePlanDeFicha(completa) : detallePlanDeFicha(encuesta);

  const cabecera = [];
  if (plan && typeof plan.pendiente === 'boolean') cabecera.push(badgePlanCuidado(encuesta));
  const plazo = plan && plan.pendiente && detalle ? plazoDeAtencion(detalle.venceSinConducta) : null;
  if (plazo) {
    cabecera.push('<span class="plan-resumen__plazo plan-resumen__plazo--' + plazo.nivel + '">' +
      '<i class="ph ph-timer" aria-hidden="true"></i>' + escaparHtml(plazo.texto) + '</span>');
  }

  const cuentas = [];
  if (plan) cuentas.push(textoCantidad(plan.accionesRegistradas || 0, 'acción', 'acciones'));
  if (detalle && detalle.derivadas > 0) cuentas.push(textoCantidad(detalle.derivadas, 'derivación', 'derivaciones'));
  if (detalle && detalle.seguimientosEsperados > 0) {
    cuentas.push(detalle.seguimientosHechos + ' de ' + detalle.seguimientosEsperados + ' seguimientos');
  }
  if (plan && plan.alertasSinConducta > 0) {
    cuentas.push(textoCantidad(plan.alertasSinConducta, 'alerta sin conducta', 'alertas sin conducta'));
  }

  let cuerpo;
  if (completa) {
    const planes = planesConNombre(completa).map(function (item) {
      const acciones = accionesDelPlan(item.plan);
      const seguimientos = seguimientosDelPlan(item.plan);
      return (
        '<li class="detalle-plan__plan">' +
          '<h5 class="detalle-plan__plan-titulo">' + escaparHtml(item.titulo) +
            (item.codigo ? ' <span class="mono">' + escaparHtml(item.codigo) + '</span>' : '') + '</h5>' +
          (acciones.length > 0
            ? '<p class="detalle-plan__subtitulo">Acciones</p><ul class="detalle-plan__lista">' +
              acciones.map(construirAccionDetalle).join('') + '</ul>'
            : '') +
          (seguimientos.length > 0
            ? '<p class="detalle-plan__subtitulo">Seguimientos</p><ul class="detalle-plan__lista">' +
              seguimientos.map(construirSeguimientoDetalle).join('') + '</ul>'
            : '') +
        '</li>'
      );
    });

    cuerpo =
      '<p class="detalle-plan__bloque">Alertas</p>' + construirAlertasDetalle(completa) +
      '<p class="detalle-plan__bloque">Acciones y seguimientos</p>' +
      (planes.length > 0
        ? '<ol class="detalle-plan__planes">' + planes.join('') + '</ol>'
        : '<p class="detalle-plan__vacio">No hay acciones ni seguimientos registrados. ' +
          'Se registran desde Historial → Evolucionar plan de cuidado.</p>');
  } else {
    cuerpo = '<p class="detalle-plan__vacio">El detalle de alertas, acciones y seguimientos lo ve quien puede ' +
      'corregir la ficha o evolucionar su plan, con conexión.</p>';
  }

  return (
    '<div class="detail-section detalle-plan">' +
      '<h3>Plan de cuidado (RN-220)</h3>' +
      (cabecera.length > 0 || cuentas.length > 0
        ? '<div class="detalle-plan__resumen">' +
            cabecera.join('') +
            (cuentas.length > 0 ? '<span class="detalle-plan__cuentas">' + escaparHtml(cuentas.join(' · ')) + '</span>' : '') +
          '</div>'
        : '') +
      cuerpo +
    '</div>'
  );
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
const LARGO_MINIMO_MOTIVO = 10;

function pedirConfirmacion(opciones) {
  confirmacionPendiente = opciones;
  confirmacionPendiente.focoPrevio = document.activeElement;

  /* El mismo modal confirma eliminar (rojo) y guardar (azul): el tono del
     botón dice si la acción destruye algo o no. */
  const confirmar = document.getElementById('btnConfirmarEliminar');
  const primario = opciones.tono === 'primario';
  confirmar.classList.toggle('btn--primary', primario);
  confirmar.classList.toggle('btn--danger', !primario);

  /* Con `pedirMotivo`, la acción no se confirma sin decir por qué: el motivo
     va a la auditoría (eliminar una ficha de la base). */
  const campoMotivo = document.getElementById('modalConfirmarMotivoCampo');
  const motivo = document.getElementById('modalConfirmarMotivo');
  campoMotivo.hidden = opciones.pedirMotivo !== true;
  motivo.value = '';
  confirmar.disabled = opciones.pedirMotivo === true;

  document.getElementById('modalConfirmarTitulo').textContent = opciones.titulo;
  document.getElementById('modalConfirmarMensaje').textContent = opciones.mensaje;
  confirmar.textContent = opciones.textoConfirmar || 'Eliminar';
  document.getElementById('btnCancelarEliminar').textContent = opciones.textoCancelar || 'Cancelar';
  document.getElementById('modalConfirmar').hidden = false;
  if (opciones.pedirMotivo === true) motivo.focus();
  else if (primario) confirmar.focus();
}

function motivoDeConfirmacion() {
  return document.getElementById('modalConfirmarMotivo').value.trim();
}

function resolverConfirmacion(aceptada) {
  const pendiente = confirmacionPendiente;
  if (aceptada && pendiente && pendiente.pedirMotivo === true &&
      motivoDeConfirmacion().length < LARGO_MINIMO_MOTIVO) return;
  confirmacionPendiente = null;
  document.getElementById('modalConfirmar').hidden = true;

  if (!pendiente) return;
  /* Al cancelar, el foco vuelve a donde estaba (el botón Guardar), no al
     principio de la página. */
  if (!aceptada && pendiente.focoPrevio && pendiente.focoPrevio.focus) pendiente.focoPrevio.focus();
  if (aceptada) pendiente.alConfirmar(motivoDeConfirmacion());
  else if (pendiente.alCancelar) pendiente.alCancelar();
}

/* Sólo el usuario maestro elimina fichas (ficha.eliminar): las que siguen sólo
   en el dispositivo, de aquí; las que ya están en la base, de la base, con
   motivo y en la auditoría (RN-225). Sin sesión cargada (pruebas) se
   conserva el borrado local de siempre. */
function puedeEliminarFichas() {
  if (typeof SESION === 'undefined' || typeof puede !== 'function') return true;
  const usuario = SESION.usuario();
  return Boolean(usuario) && puede(usuario.rol, 'ficha.eliminar');
}

function abrirModalConfirmarEliminacion(id) {
  if (!puedeEliminarFichas()) {
    mostrarNotificacion('Sólo el usuario maestro puede eliminar fichas.', 'warning');
    return;
  }

  const encuesta = obtenerEncuestas().find(function (e) { return e.id === id; });
  const remota = encuesta ? null
    : (cacheFichasDelServidor || []).find(function (e) { return e.id === id; }) || null;
  if (!encuesta && !remota) {
    mostrarNotificacion('No se encontró la ficha que se quiere eliminar.', 'error');
    return;
  }

  /* Una ficha que ya llegó a la base se elimina de la base: borrarla sólo de
     este navegador diría «eliminada» sobre una ficha que sigue registrada. */
  if (remota || encuesta.sincronizada === true) {
    const ficha = remota || encuesta;
    pedirConfirmacion({
      titulo: 'Eliminar ficha de la base',
      mensaje: 'Se eliminará definitivamente la ficha ' + ficha.codigoFicha + ' con sus familias, integrantes ' +
        'y plan de cuidado, para todos los usuarios. Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar definitivamente',
      pedirMotivo: true,
      alConfirmar: function (motivo) { eliminarFichaDeLaBase(ficha, encuesta, motivo); }
    });
    return;
  }

  encuestaSeleccionadaId = id;
  pedirConfirmacion({
    titulo: 'Eliminar registro',
    mensaje: '¿Está seguro de que desea eliminar esta encuesta? Aún no se ha sincronizado: se borra de este ' +
      'dispositivo y no se puede deshacer.',
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
    situacionInminente: fd.getAll('situacionInminente'),

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
    nuv: valorOrNull(fd.get('nuv')),
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

  // Variables del anexo técnico SI-APS de la ficha y la vivienda (anexo.js).
  Object.assign(base, recolectarAnexoVivienda(fd));

  // Bloques repetibles y plan de cuidado (ítems 50-140).
  Object.assign(base, recolectarBloquesRepetibles(formulario));

  // Campos derivados que las reglas contrastan contra su cálculo.
  const hacinamiento = evaluarHacinamiento(base.personasEnVivienda, base.habitacionesVivienda);
  base.personasPorHabitacion = hacinamiento.personasPorHabitacion;
  base.hacinamiento = hacinamiento.hacinamiento;
  base.motivoSinGeorreferenciacion = valorOrNull(fd.get('motivoSinGeorreferenciacion'));
  base.visitaIncompleta = formulario.querySelector('#visitaIncompleta').checked;
  base.motivoVisitaIncompleta = valorOrNull(fd.get('motivoVisitaIncompleta'));

  /* RN-016 no limita la antigüedad al corregir una ficha que ya está en la
     base (ver reglas.js). El servidor ignora este valor y lo decide él. */
  if (typeof fichaEnCorreccionYaRegistrada === 'function' && fichaEnCorreccionYaRegistrada()) {
    base.yaRegistradaEnLaBase = true;
  }

  return base;
}

/* Ítems 39 a 49. Devuelve null mientras la sección esté intacta.
   Los ítems 46 a 49 son selección múltiple desde el anexo técnico
   (variables 53, 58, 59 y 62). */
function recolectarSaneamiento(fd) {
  const actividad = valorOrNull(fd.get('actividadEconomica'));
  const animales = fd.getAll('animales');
  const fuenteAgua = fd.getAll('fuenteAgua');
  const disposicionExcretas = fd.getAll('disposicionExcretas');
  const aguasResiduales = fd.getAll('aguasResiduales');
  const residuosSolidos = fd.getAll('residuosSolidos');

  const seDiligencio = actividad !== null || animales.length > 0 || fuenteAgua.length > 0 ||
    disposicionExcretas.length > 0 || aguasResiduales.length > 0 || residuosSolidos.length > 0;

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
    disposicionExcretas: disposicionExcretas,
    aguasResiduales: aguasResiduales,
    residuosSolidos: residuosSolidos
  };
}

/* Preguntas del anexo de la ficha y la vivienda: nombres planos, así que
   vienen por FormData. Las de familia e integrante van anidadas y las recoge
   recolectarBloquesRepetibles. Un campo oculto por su condición queda en
   blanco (mostrarCampo lo limpia) y así se recoge: null o lista vacía. */
function recolectarAnexoVivienda(fd) {
  const salida = {};
  PREGUNTAS_ANEXO.forEach(function (pregunta) {
    if (pregunta.nivel !== 'ficha' && pregunta.nivel !== 'vivienda') return;
    const clave = pregunta.clave;
    if (pregunta.tipo === 'multiple') salida[clave] = fd.getAll(clave);
    else if (pregunta.tipo === 'entero') salida[clave] = aIntOrNull(fd.get(clave));
    else salida[clave] = valorOrNull(fd.get(clave));
  });
  return salida;
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

/* El bloque de familia o de integrante que nombra una ruta
   (`familias[0].integrantes[1].x`), o el formulario si no nombra ninguno. */
function bloqueDeRuta(formulario, ruta) {
  const coincidencia = /^familias\[(\d+)\](?:\.integrantes\[(\d+)\])?/.exec(String(ruta || ''));
  if (!coincidencia) return formulario;
  const familia = formulario.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]')[Number(coincidencia[1])];
  if (!familia) return formulario;
  if (coincidencia[2] === undefined) return familia;
  const integrante = familia.querySelectorAll(
    '[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]')[Number(coincidencia[2])];
  return integrante || familia;
}

/* Respaldo por `data-campo`, buscado dentro del bloque de la ruta: un grupo
   que aún no tiene casillas —las atenciones RPMS antes de la fecha de
   nacimiento y el sexo— no tiene control con ese nombre, y buscar en todo
   el formulario marcaba el campo del primer integrante, no el de éste. */
function contenedorDeRespaldo(formulario, item) {
  return bloqueDeRuta(formulario, item.ruta).querySelector('[data-campo="' + item.campo + '"]');
}

function marcarIncumplimiento(formulario, incumplimiento) {
  /* La `ruta` nombra el control exacto —`planVivienda.acciones[0].ejecutorNumeroId`
     señala esa casilla y no las tres del plan a la vez—, así que se prefiere
     cuando hay un control con ese nombre. `data-campo` queda de respaldo para
     las reglas que marcan un bloque entero y no un control concreto. */
  const contenedor = contenedorPorRuta(formulario, incumplimiento.ruta) ||
    contenedorDeRespaldo(formulario, incumplimiento);

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
    contenedorDeRespaldo(formulario, advertencia);

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

/* Quién recibe la conducta de cada alerta, en el orden del plan (6.1, 6.2,
   6.3): la vivienda, cada familia, cada persona. */
function destinoDeAlerta(alerta) {
  if (alerta.plan === 'vivienda') return { orden: '0', titulo: '6.1 Vivienda' };
  const familia = /^Familia \d+/.exec(alerta.referencia || '');
  if (alerta.plan === 'familia') {
    return { orden: '1' + (familia ? familia[0] : ''), titulo: '6.2 ' + (familia ? familia[0] : 'Familia') };
  }
  return { orden: '2' + (alerta.referencia || ''), titulo: '6.3 ' + (alerta.referencia || 'Persona') };
}

/**
 * Las alertas de la ficha al comienzo de la sección 6, agrupadas por a quién
 * le toca la conducta y con su prioridad, para estructurar el plan de cuidado
 * con ellas a la vista. Se recalcula mientras se diligencia (ver
 * programarRiesgoEnVivo): antes sólo se veían al pulsar «Guardar».
 */
function renderizarResumenAlertasPlan(alertas, sinAccion, riesgo) {
  const cuerpo = document.getElementById('resumenAlertasCuerpo');
  const etiquetaRiesgo = document.getElementById('resumenAlertasRiesgo');
  if (!cuerpo) return;

  if (etiquetaRiesgo) {
    etiquetaRiesgo.className = 'resumen-alertas__riesgo resumen-alertas__riesgo--' +
      (CLASE_SEMAFORO[riesgo && riesgo.nivel] || 'gris');
    etiquetaRiesgo.textContent = riesgo ? riesgo.etiqueta : '';
  }

  if (!alertas || alertas.length === 0) {
    cuerpo.innerHTML = '<p class="resumen-alertas__vacio">Aún no hay alertas. Aparecen aquí mientras se ' +
      'diligencian la vivienda, las familias y los integrantes.</p>';
    return;
  }

  const sinConducta = new Set(sinAccion.map(function (a) { return a.codigo + '|' + (a.referencia || '') + '|' + a.plan; }));
  const grupos = new Map();
  alertas.slice().sort(function (a, b) {
    return (ORDEN_PRIORIDAD[b.prioridad] || 0) - (ORDEN_PRIORIDAD[a.prioridad] || 0);
  }).forEach(function (alerta) {
    const destino = destinoDeAlerta(alerta);
    if (!grupos.has(destino.orden)) grupos.set(destino.orden, { titulo: destino.titulo, alertas: [] });
    grupos.get(destino.orden).alertas.push(alerta);
  });

  const conteo = { inmediata: 0, prioritaria: 0, regular: 0 };
  alertas.forEach(function (a) { if (conteo[a.prioridad] !== undefined) conteo[a.prioridad]++; });
  const etiquetas = { inmediata: ['inmediata', 'inmediatas'], prioritaria: ['prioritaria', 'prioritarias'],
    regular: ['regular', 'regulares'] };
  const resumen = ['inmediata', 'prioritaria', 'regular'].filter(function (p) { return conteo[p] > 0; })
    .map(function (p) {
      return '<span class="prioridad-chip prioridad-chip--' + p + '">' +
        textoCantidad(conteo[p], etiquetas[p][0], etiquetas[p][1]) + '</span>';
    }).join('');

  cuerpo.innerHTML =
    '<p class="resumen-alertas__conteo">' + resumen +
      '<span class="resumen-alertas__pendientes">' +
        textoCantidad(sinAccion.length, 'sin conducta', 'sin conducta') + '</span></p>' +
    Array.from(grupos.keys()).sort().map(function (clave) {
      const grupo = grupos.get(clave);
      return (
        '<div class="resumen-alertas__grupo">' +
          '<p class="resumen-alertas__destino">' + escaparHtml(grupo.titulo) + '</p>' +
          '<ul class="resumen-alertas__lista">' + grupo.alertas.map(function (alerta) {
            const pendiente = sinConducta.has(alerta.codigo + '|' + (alerta.referencia || '') + '|' + alerta.plan);
            return (
              '<li class="resumen-alertas__item">' +
                '<span class="prioridad-chip prioridad-chip--' + escaparHtml(alerta.prioridad) + '">' +
                  escaparHtml(NOMBRE_PRIORIDAD[alerta.prioridad] || alerta.prioridad) + '</span>' +
                '<span class="resumen-alertas__texto">' +
                  '<span class="resumen-alertas__alerta">' + escaparHtml(alerta.titulo) + '</span>' +
                  '<span class="resumen-alertas__descripcion">' + escaparHtml(alerta.descripcion) + '</span>' +
                '</span>' +
                (pendiente
                  ? '<span class="badge badge--plan-pendiente">Sin conducta</span>'
                  : '<span class="badge badge--plan-registrado">Con conducta</span>') +
              '</li>'
            );
          }).join('') + '</ul>' +
        '</div>'
      );
    }).join('');
}

/* Las alertas, el resumen de riesgo y el cierre se recalculan mientras se
   diligencia, un momento después de la última tecla: recalcular a cada
   pulsación recogería el formulario entero doscientas veces por minuto. */
let temporizadorRiesgoEnVivo = null;

function programarRiesgoEnVivo() {
  if (temporizadorRiesgoEnVivo) clearTimeout(temporizadorRiesgoEnVivo);
  temporizadorRiesgoEnVivo = setTimeout(function () {
    temporizadorRiesgoEnVivo = null;
    const formulario = document.getElementById('encuestaForm');
    if (!formulario) return;
    try {
      actualizarTableroDeRiesgo(recolectarDatosFormulario(formulario));
    } catch (error) {
      console.warn('No fue posible recalcular las alertas en vivo:', error);
    }
  }, 600);
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
    const porCampo = contenedorDeRespaldo(formulario, item);
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

  const riesgo = clasificarRiesgoFamiliar(datos, alertas);
  renderizarSemaforo(riesgo);
  renderizarAlertas(alertas, sinAccion);
  renderizarPlanCuidado(resumirPlanCuidado(datos, alertas));
  renderizarResumenAlertasPlan(alertas, sinAccion, riesgo);

  // RN-022: el motivo sólo se pide cuando falta la georreferenciación.
  const faltaGeo = typeof datos.latitud !== 'number' || typeof datos.longitud !== 'number';
  document.getElementById('campoMotivoGeo').hidden = !faltaGeo;

  return { alertas: alertas, sinAccion: sinAccion };
}

/**
 * Confirmación antes de guardar la ficha, como promesa: true si quien
 * diligencia confirma. Usa el modal propio de la página y no SweetAlert,
 * que se carga desde internet: guardar tiene que funcionar sin señal.
 */
function confirmarGuardado(opciones) {
  return new Promise(function (resolver) {
    pedirConfirmacion(Object.assign({}, opciones, {
      tono: 'primario',
      textoCancelar: 'Seguir revisando',
      alConfirmar: function () { resolver(true); },
      alCancelar: function () { resolver(false); }
    }));
  });
}

function textoCantidad(n, singular, plural) {
  return n + ' ' + (n === 1 ? singular : plural);
}

/**
 * Qué se va a guardar, dicho antes de guardarlo. El texto cambia según el
 * caso: una ficha nueva, una corrección, una visita incompleta (RN-222) o la
 * evolución del plan, que deja lo registrado bloqueado (RN-228).
 */
function opcionesDeConfirmacionDeGuardado(datos, caso, advertencias) {
  const codigo = datos.codigoFicha ? ' ' + datos.codigoFicha : '';
  const familias = Array.isArray(datos.familias) ? datos.familias : [];
  const personas = familias.reduce(function (total, familia) {
    return total + (Array.isArray(familia.integrantes) ? familia.integrantes.length : 0);
  }, 0);
  const contenido = familias.length > 0
    ? ' con ' + textoCantidad(familias.length, 'familia', 'familias') + ' y ' +
      textoCantidad(personas, 'integrante', 'integrantes')
    : '';
  const avisos = advertencias > 0
    ? ' Tiene ' + textoCantidad(advertencias, 'advertencia', 'advertencias') + ' que no impiden guardar.'
    : '';

  if (caso === 'plan') {
    return {
      titulo: 'Guardar el plan de cuidado',
      mensaje: '¿Está seguro de que desea guardar el plan de cuidado de la ficha' + codigo + '? ' +
        'Lo que registre quedará bloqueado: después sólo podrá cambiarse con autorización.',
      textoConfirmar: 'Sí, guardar el plan'
    };
  }
  if (caso === 'integrantes') {
    const nuevos = typeof integrantesNuevosEn === 'function' ? integrantesNuevosEn(datos) : 0;
    return {
      titulo: 'Agregar integrantes',
      mensaje: '¿Está seguro de que desea agregar ' + textoCantidad(nuevos, 'integrante', 'integrantes') +
        ' a la ficha' + codigo + '? Quedarán registrados con lo demás de la visita.' + avisos,
      textoConfirmar: 'Sí, agregar'
    };
  }
  if (caso === 'incompleta') {
    return {
      titulo: 'Guardar visita incompleta',
      mensaje: '¿Está seguro de que desea guardar la ficha' + codigo + ' como visita incompleta por causa externa? ' +
        'No entra en la cobertura y queda en cola para una nueva visita.',
      textoConfirmar: 'Sí, guardar como incompleta'
    };
  }
  if (caso === 'correccion') {
    return {
      titulo: 'Guardar cambios',
      mensaje: '¿Está seguro de que desea guardar los cambios de la ficha' + codigo + '?' + avisos,
      textoConfirmar: 'Sí, guardar cambios'
    };
  }
  return {
    titulo: 'Guardar encuesta',
    mensaje: '¿Está seguro de que desea guardar la encuesta? Se registrará la ficha' + codigo + contenido + '.' + avisos,
    textoConfirmar: 'Sí, guardar'
  };
}

async function manejarEnvioFormulario(evento) {
  evento.preventDefault();
  const formulario = evento.target;

  /* Con la confirmación abierta, otro envío (doble clic) no abre una segunda. */
  if (confirmacionPendiente) return;

  limpiarErroresFormulario(formulario);

  const datos = recolectarDatosFormulario(formulario);
  actualizarTableroDeRiesgo(datos);

  /* RN-228: evolucionando el plan sólo cuenta el plan. El resto de la ficha
     ya está registrado, no se vuelve a escribir y no se puede tocar: sus
     pendientes —por ejemplo, reglas que cambiaron después de la visita— no
     detienen el plan. */
  const enPlan = typeof enEvolucionDePlan === 'function' && enEvolucionDePlan();
  /* RN-051: completando integrantes cuentan los nuevos, el ítem 51, el plan
     y RN-029, con el mismo criterio que el servidor. */
  const enCompletar = typeof enCompletarIntegrantes === 'function' && enCompletarIntegrantes();
  const delPlan = function (item) {
    if (enPlan) return esRutaDelPlan(item && item.ruta);
    if (enCompletar) return esRutaDeCompletar(item);
    return true;
  };

  // RN-222: cierre por causa externa. Se admite la ficha incompleta siempre
  // que quede registrado el motivo, y no entra al denominador de cobertura.
  if (datos.visitaIncompleta && !enPlan && !enCompletar) {
    if (esVacioTexto(datos.motivoVisitaIncompleta)) {
      mostrarNotificacion('Registre el motivo del cierre por causa externa.', 'error', function () {
        enfocarElemento(document.getElementById('campoMotivoIncompleta'), document.getElementById('motivoVisitaIncompleta'));
      });
      return;
    }
    if (!await confirmarGuardado(opcionesDeConfirmacionDeGuardado(datos, 'incompleta', 0))) return;
    await guardarYReiniciar(datos, formulario, 'La visita se guardó como incompleta por causa externa.');
    return;
  }

  const resultadoCierre = validarCierre(datos);
  const incumplimientos = validarReglas(datos).filter(delPlan);
  if (enPlan || enCompletar) {
    resultadoCierre.impedimentos = resultadoCierre.impedimentos.filter(delPlan);
    resultadoCierre.puedeCerrar = resultadoCierre.impedimentos.length === 0;
  }

  renderizarImpedimentos(resultadoCierre.impedimentos);

  incumplimientos.forEach(function (incumplimiento) {
    marcarIncumplimiento(formulario, incumplimiento);
  });
  /* Las advertencias se pintan en ámbar junto al campo; no impiden guardar.
     Van después de los errores: donde ya hay uno, el error manda. */
  const advertencias = evaluarAdvertencias(datos).filter(delPlan);
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

  /* Sólo se pregunta cuando de verdad se puede guardar: con pendientes, lo
     que corresponde es corregirlos, y eso ya lo dicen el aviso y la barra. */
  const caso = enPlan ? 'plan' : enCompletar ? 'integrantes' : (encuestaEnCorreccion ? 'correccion' : 'nueva');
  if (!await confirmarGuardado(opcionesDeConfirmacionDeGuardado(datos, caso, advertencias.length))) return;

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

  /* Al corregir se envía el historial de modificaciones más la de ahora: la
     base lo reemplaza con lo que llegue, y antes llegaba vacío. */
  if (encuestaEnCorreccion) encuesta.fechasModificacion = fechasDeModificacionDeLaCorreccion();

  /* El servidor necesita distinguir una corrección de una visita nueva que
     trae un código de ficha ya usado en otra vivienda: la primera reemplaza
     el registro, la segunda no puede pisarlo (ver guardar_encuesta.js). */
  encuesta.esCorreccion = !!encuestaEnCorreccion;

  /* RN-228: evolucionando el plan, el servidor escribe sólo los planes. */
  const enPlan = typeof enEvolucionDePlan === 'function' && enEvolucionDePlan();
  if (enPlan) {
    encuesta.soloPlan = true;
    mensaje = 'El plan de cuidado se guardó.';
  }

  /* RN-051: completando integrantes, el servidor escribe sólo los nuevos. */
  const enCompletar = typeof enCompletarIntegrantes === 'function' && enCompletarIntegrantes();
  if (enCompletar) {
    encuesta.completarIntegrantes = true;
    mensaje = 'Se agregaron ' + textoCantidad(integrantesNuevosEn(datos), 'integrante', 'integrantes') + '.';
  }

  const resultado = await enviarFichaAlServidor(encuesta, boton);

  /* Rechazo por reglas de negocio: la ficha NO se guarda ni se limpia el
     formulario. El encuestador tiene que poder corregir lo que el servidor
     señala, y para eso necesita sus respuestas en pantalla. */
  if (resultado.estado === 'rechazada') {
    mostrarBloqueosDelServidor(formulario, resultado.bloqueos, resultado.mensaje);
    return false;
  }

  encuesta.sincronizada = resultado.estado === 'guardada';
  aplicarCodigosAsignados(encuesta, resultado.codigos);
  if (encuesta.nuv && encuesta.idHogar && !enPlan) {
    mensaje += ' Vivienda ' + encuesta.nuv + ' · código ' + encuesta.idHogar + '.';
  }

  /* El plan diferido no es error: se avisa una vez, al guardar, dónde se
     completa después. */
  if (encuesta.planCuidado && encuesta.planCuidado.pendiente) {
    mensaje += enPlan
      ? ' Sigue pendiente: puede volver a evolucionarlo desde el historial.'
      : ' El plan de cuidado quedó pendiente: puede completarlo desde Historial → Evolucionar plan.';
  }

  /* Corrigiendo se reemplaza la ficha existente; capturando se agrega una
     nueva. Sin esta distinción, arreglar un dato dejaría dos copias de la
     misma visita en el historial.

     Una ficha traída de la base que se guardó bien no se copia a este
     dispositivo: ya está en la base y el historial la muestra desde ahí, y
     no hay por qué dejar en el navegador los datos de una visita ajena. Si
     no se pudo guardar, sí se conserva aquí, pendiente de sincronizar, para
     no perder la corrección. */
  const eraCorreccion = Boolean(encuestaEnCorreccion);
  if (encuestaEnCorreccion) {
    /* El plan se evoluciona desde la base; si además hay una copia en el
       dispositivo, se pone al día para que el historial no muestre el plan
       de antes. */
    const hayCopiaLocal = obtenerEncuestas().some(function (e) { return e.id === encuestaEnCorreccion; });
    if (!(correccionDesdeServidor && encuesta.sincronizada) || ((enPlan || enCompletar) && hayCopiaLocal)) {
      reemplazarEncuesta(encuestaEnCorreccion, encuesta);
    }
    salirDeCorreccion();
  } else {
    agregarEncuesta(encuesta);
  }

  if (encuesta.sincronizada && enPlan) {
    mostrarNotificacion(mensaje + ' Lo registrado ya no se puede cambiar sin autorización de la coordinación del ' +
      'EBS o del usuario maestro.',
      'success');
  } else if (encuesta.sincronizada) {
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

  /* La ficha ya quedó en el dispositivo o en la base: su consecutivo queda
     usado y el borrador automático ya no hace falta. */
  if (!eraCorreccion) confirmarCodigoFicha(encuesta.codigoFicha);
  descartarBorrador();

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
/**
 * Escribe en la copia local de la ficha los códigos que asignó el servidor al
 * guardarla: NUV, ítems 25 y 26, el código de cada familia y las llaves que
 * heredan los planes de cuidado. Así el historial los muestra y una
 * corrección posterior los conserva. Sin códigos (no hubo conexión) no toca
 * nada: llegarán al sincronizar.
 */
function aplicarCodigosAsignados(encuesta, codigos) {
  if (!encuesta || !codigos || !codigos.idHogar) return;

  encuesta.nuv = codigos.nuv || null;
  encuesta.idHogar = codigos.idHogar;
  encuesta.idFamilia = codigos.idFamilia || null;

  const llaves = function (plan, codigoFamilia) {
    if (!plan || typeof plan !== 'object') return;
    if (plan.codigoVivienda !== undefined) plan.codigoVivienda = codigos.idHogar;
    if (codigoFamilia && plan.codigoFamilia !== undefined) plan.codigoFamilia = codigoFamilia;
  };

  llaves(encuesta.planVivienda);
  (Array.isArray(encuesta.familias) ? encuesta.familias : []).forEach(function (familia, i) {
    const codigoFamilia = (codigos.familias || [])[i];
    if (!familia || !codigoFamilia) return;
    familia.idFamilia = codigoFamilia;
    if (codigos.codigosCf && codigos.codigosCf[i]) familia.codigoCf = codigos.codigosCf[i];
    llaves(familia.planFamilia, codigoFamilia);
    (Array.isArray(familia.integrantes) ? familia.integrantes : []).forEach(function (integrante) {
      llaves(integrante && integrante.planPersona, codigoFamilia);
    });
  });
}

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

    if (respuesta.ok) {
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      return { estado: 'guardada', codigos: cuerpo.codigos || null };
    }

    /* 409: lo ya registrado en el plan de cuidado no se cambia sin
       autorización (RN-228). Es un rechazo de la ficha, no un fallo del
       servidor: se corrige en pantalla, no se deja en cola. */
    if (respuesta.status === 400 || respuesta.status === 409) {
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      return {
        estado: 'rechazada',
        bloqueos: cuerpo.bloqueos || [],
        mensaje: respuesta.status === 409 ? (cuerpo.error || null) : null
      };
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
function mostrarBloqueosDelServidor(formulario, bloqueos, encabezado) {
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
    (encabezado ? encabezado + ' ' : 'El servidor no aceptó la ficha: ' + lista.length + ' campo(s) por corregir. ') +
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
  habilitarCoordenadasManuales(false);
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

  /* Los ítems 10 y 12-14 los firma la sesión (sesion.js); tras un reset hay
     que volver a escribirlos. Sin sesión cargada (pruebas jsdom) no hay nada
     que aplicar. */
  if (typeof SESION !== 'undefined' && SESION.aplicarEnFormulario) SESION.aplicarEnFormulario(formulario);

  /* RN-015: cada ficha nueva nace con su código (ver captura_local.js). Va
     después de la firma, porque el código lleva el equipo. Lo que queda en
     pantalla es el punto de partida del borrador automático. */
  asignarCodigoFicha();
  marcarFormularioLimpio();
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

/* Ficha técnica APS124CCFP. El código del equipo (variable 15) va en
   mayúscula y sin espacios cuando lo digita un administrador; los de la
   ficha, la vivienda y la familia los asigna el sistema. El número de
   documento (variable 54) va sin puntos, comas ni guiones: «1.144.000.000»
   es 1144000000. */
const CAMPOS_CODIGO_FICHA_TECNICA = ['equipoSaludId'];

function normalizarCampoCapturado(evento) {
  const campo = evento.target;
  if (!campo || campo.tagName !== 'INPUT' || campo.readOnly) return;

  const nombre = campo.name || '';
  let limpio = campo.value;
  if (nombre === 'responsableNumeroId' || /\.numeroId$/.test(nombre)) {
    limpio = limpiarNumeroDocumento(campo.value);
  } else if (CAMPOS_CODIGO_FICHA_TECNICA.indexOf(nombre) !== -1) {
    limpio = campo.value.toUpperCase().replace(/\s+/g, '');
  }

  if (limpio !== campo.value) campo.value = limpio;
}

/**
 * Enter dentro de un campo no envía la ficha. El navegador envía el
 * formulario con Enter desde cualquier casilla (en el celular, con la tecla
 * «Ir» del teclado): la ficha a medio diligenciar se validaba entera, la
 * página saltaba al final y todos los campos aún vacíos quedaban en rojo.
 * Guardar es sólo el botón. En un área de texto Enter sigue siendo un salto
 * de línea, en un botón sigue activándolo, y la lista de CUPS sigue usando
 * Enter para elegir (cups.js lo atiende en el mismo evento).
 */
function evitarEnvioConEnter(evento) {
  if (evento.key !== 'Enter' || evento.isComposing) return;
  const campo = evento.target;
  if (!campo || campo.tagName !== 'INPUT') return;
  if (['submit', 'button', 'reset', 'image'].indexOf(campo.type) !== -1) return;
  evento.preventDefault();
}

function inicializarFormulario() {
  const formulario = document.getElementById('encuestaForm');
  formulario.addEventListener('submit', manejarEnvioFormulario);
  formulario.addEventListener('keydown', evitarEnvioConEnter);

  /* En fase de captura: la validación en vivo escucha el mismo `change` en
     burbuja y tiene que recibir ya el valor limpio. */
  formulario.addEventListener('change', normalizarCampoCapturado, true);

  /* Alertas y resumen de riesgo en vivo, para estructurar el plan de cuidado
     con los riesgos a la vista (observación de la E.S.E., 19-10-2026). */
  formulario.addEventListener('input', programarRiesgoEnVivo);
  formulario.addEventListener('change', programarRiesgoEnVivo);
  programarRiesgoEnVivo();

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
  document.getElementById('btnDigitarCoordenadas').addEventListener('click', function () {
    habilitarCoordenadasManuales(document.getElementById('latitud').readOnly);
  });
  document.getElementById('latitud').addEventListener('input', marcarCoordenadasManuales);
  document.getElementById('longitud').addEventListener('input', marcarCoordenadasManuales);

  // RN-036 / RN-038 — opción excluyente "Ninguno"
  inicializarGrupoExcluyente('grupoRiesgosAccidente');
  inicializarGrupoExcluyente('grupoFactoresContaminacion');

  // Cálculo automático de hacinamiento
  document.getElementById('personasEnVivienda').addEventListener('input', actualizarCalculoHacinamientoEnFormulario);
  document.getElementById('habitacionesVivienda').addEventListener('input', actualizarCalculoHacinamientoEnFormulario);

  /* Limpiar ahora también borra el borrador automático, y con él la última
     copia de la ficha: se pregunta antes, si hay algo que perder. */
  document.getElementById('btnLimpiar').addEventListener('click', function (evento) {
    evento.preventDefault();
    if (!fichaTieneDatos()) {
      reiniciarFichaEnCurso();
      return;
    }
    pedirConfirmacion({
      titulo: 'Limpiar formulario',
      mensaje: 'Se borrarán todas las respuestas de esta ficha y no se podrán recuperar.',
      textoConfirmar: 'Limpiar',
      alConfirmar: reiniciarFichaEnCurso
    });
  });
}

function inicializarModales() {
  document.getElementById('cerrarModalDetalle').addEventListener('click', cerrarModalDetalle);
  document.getElementById('modalDetalle').addEventListener('click', function (evento) {
    if (evento.target.id === 'modalDetalle') cerrarModalDetalle();
  });

  const cancelar = function () { resolverConfirmacion(false); };

  /* Con motivo obligatorio, confirmar se habilita cuando el motivo alcanza. */
  document.getElementById('modalConfirmarMotivo').addEventListener('input', function () {
    if (!confirmacionPendiente || confirmacionPendiente.pedirMotivo !== true) return;
    document.getElementById('btnConfirmarEliminar').disabled = motivoDeConfirmacion().length < LARGO_MINIMO_MOTIVO;
  });

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
  /* Lo que hay en la base se pide antes de armar el formulario: así la red
     trabaja mientras el navegador construye los bloques, en vez de esperar
     a que termine (en un teléfono modesto son cientos de milisegundos). La
     respuesta no puede procesarse antes de que acabe esta función, que es
     síncrona, así que el resultado se pinta igual que antes, al final. */
  const primeraLecturaDeLaBase = refrescarFichasDelServidor();

  inicializarCabeceraAlDesplazar();
  inicializarIndiceActivo();
  inicializarCatalogosDelFormulario();
  inicializarModoRevision();
  /* La guía va antes del formulario dinámico: ahí se guardan los prototipos
     de familia e integrante, y los bloques que se clonen deben traerla. */
  if (typeof inicializarGuiaCampos === 'function') inicializarGuiaCampos();
  inicializarFormularioDinamico();
  inicializarBuscadorCups();
  inicializarCierreIncompleto();
  inicializarNavegadorPendientes();
  inicializarValidacionEnVivo();
  retirarDatosDemostracion();
  inicializarNavegacion();
  /* El módulo de sincronización dice si hay señal: se repinta al perderla y
     al recuperarla. */
  window.addEventListener('online', renderizarEstadoSync);
  window.addEventListener('offline', renderizarEstadoSync);
  inicializarFiltrosHistorial();
  inicializarFormulario();
  inicializarModales();
  reiniciarEstadoFormulario();

  renderizarInicio();
  renderizarHistorial();

  /* Primer vistazo a lo que hay en la base, para que abrir la aplicación ya
     muestre lo que otros dispositivos hayan guardado y no sólo lo que hay en
     este navegador. */
  primeraLecturaDeLaBase.then(function () {
    renderizarInicio();
    renderizarHistorial();
  });

  /* Borrador automático y, si quedó una ficha sin terminar, su recuperación.
     Va al final: necesita el formulario ya armado y los catálogos puestos. */
  inicializarCapturaLocal();
}

document.addEventListener('DOMContentLoaded', inicializarAplicacion);
