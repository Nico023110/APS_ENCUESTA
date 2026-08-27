/* =========================================================
   Encuesta_APS — Comportamiento dinámico del formulario
   ---------------------------------------------------------
   Responsabilidades:
     1. Bloques repetibles (familias, integrantes, planes, filas)
     2. Exclusividad de opciones ("Ninguno" / "Ninguna")
     3. Campos calculados (edad, IMC, tensión, cobertura antirrábica)
     4. Habilitación condicionada por edad, sexo y respuestas previas
     5. Filtrado de atenciones RPMS por perfil (RN-087)
     6. Herencia de llaves del plan de cuidado
     7. Recolección del modelo anidado que consume reglas.js

   Este módulo NO decide si un dato es válido: sólo gobierna qué se
   muestra, qué se calcula y cómo se arma el objeto de datos. Toda
   la validación y la evaluación de alertas viven en reglas.js.
   ========================================================= */

'use strict';

/* =========================================================
   1. UTILIDADES DE ÍNDICES Y CLONADO
   ========================================================= */

/** Reescribe `coleccion[N]` por `coleccion[indice]` en name y data-name. */
function fijarIndiceEnAmbito(ambito, coleccion, indice) {
  const patron = new RegExp(coleccion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\[\\d+\\]', 'g');
  const reemplazo = coleccion + '[' + indice + ']';

  const elementos = ambito.querySelectorAll('[name], [data-name]');
  Array.prototype.forEach.call(elementos, function (el) {
    if (el.getAttribute('name')) {
      el.setAttribute('name', el.getAttribute('name').replace(patron, reemplazo));
    }
    if (el.dataset.name) {
      el.dataset.name = el.dataset.name.replace(patron, reemplazo);
    }
  });
}

/** Deja un clon en blanco: limpia valores y vuelve a pintar los catálogos. */
function limpiarClon(clon) {
  Array.prototype.forEach.call(clon.querySelectorAll('input, select, textarea'), function (campo) {
    if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = false;
    else if (campo.tagName === 'SELECT') campo.selectedIndex = 0;
    else if (!campo.readOnly) campo.value = '';
    else campo.value = '';
  });

  /* Los catálogos se repintan en el clon: las pastillas para que hereden el
     nuevo data-name, y los <select> porque el prototipo puede haberse guardado
     antes de que llegara su catálogo. Es el caso del código de acción del plan,
     que se pide a la base al arrancar: la fila o el bloque nuevos nacían con el
     desplegable vacío, así que no admitían ningún código —ni el que el
     encuestador quería elegir, ni el que traía una ficha puesta a corregir—. */
  Array.prototype.forEach.call(clon.querySelectorAll('[data-catalogo]'), function (grupo) {
    if (grupo.tagName !== 'SELECT') grupo.innerHTML = '';
    delete grupo.dataset.renderizado;
  });

  /* El buscador de CUPS deja dos rastros fuera de los controles: la lista de
     resultados y el nombre del procedimiento bajo el campo. Sin limpiarlos, la
     fila nueva nace mostrando el nombre de la acción de la fila de la que se
     clonó, con el código ya vacío. */
  Array.prototype.forEach.call(clon.querySelectorAll('[data-rol="comboCups"]'), function (combo) {
    const lista = combo.querySelector('.combo-cups__lista');
    const nombre = combo.querySelector('.combo-cups__nombre');
    if (lista) { lista.innerHTML = ''; lista.hidden = true; }
    if (nombre) {
      nombre.textContent = '';
      nombre.className = 'combo-cups__nombre';
      delete nombre.dataset.codigo;
    }
  });

  renderizarCatalogosDeclarativos(clon);
}

/**
 * Renumera todos los bloques repetibles según su posición en el DOM.
 * Es la fuente de verdad de los índices: se ejecuta tras agregar o quitar,
 * de modo que los nombres nunca queden con huecos.
 */
function renumerarFormulario() {
  const familias = document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]');

  Array.prototype.forEach.call(familias, function (familia, i) {
    familia.dataset.indice = i;
    fijarIndiceEnAmbito(familia, 'familias', i);

    const integrantes = familia.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]');
    Array.prototype.forEach.call(integrantes, function (integrante, j) {
      integrante.dataset.indice = j;
      fijarIndiceEnAmbito(integrante, 'integrantes', j);
    });
  });

  renumerarColeccionDeBloques('#contenedorPlanFamilia', 'planFamilia', 'planesFamilia');
  renumerarColeccionDeBloques('#contenedorPlanPersona', 'planPersona', 'planesPersona');

  // Filas de acciones y seguimientos dentro de cualquier tabla del plan.
  Array.prototype.forEach.call(document.querySelectorAll('tbody'), function (cuerpo) {
    renumerarFilas(cuerpo);
  });

  actualizarEncabezadosDeBloques();
}

function renumerarColeccionDeBloques(selectorContenedor, tipoBloque, coleccion) {
  const contenedor = document.querySelector(selectorContenedor);
  if (!contenedor) return;

  const bloques = contenedor.querySelectorAll(':scope > [data-bloque="' + tipoBloque + '"]');
  Array.prototype.forEach.call(bloques, function (bloque, i) {
    bloque.dataset.indice = i;
    fijarIndiceEnAmbito(bloque, coleccion, i);
  });
}

/**
 * A qué plan pertenece una tabla de filas: `planVivienda`, `planesFamilia[i]`
 * o `planesPersona[i]`.
 *
 * Hace falta porque las filas de acción y de seguimiento se clonan siempre del
 * plan de la vivienda —es la primera del documento y de ahí sale el prototipo—.
 * Renumerar sólo el índice dejaba a una fila añadida en 6.2 o en 6.3 llamándose
 * `planVivienda.acciones[N]`: dos controles distintos con el mismo nombre. Al
 * recolectar ganaba el último, que es el clon en blanco, así que agregar una
 * acción a una familia borraba la acción de la vivienda.
 */
function rutaDelPlan(cuerpoTabla) {
  const bloque = cuerpoTabla.closest('[data-bloque="planFamilia"], [data-bloque="planPersona"]');
  if (!bloque) return 'planVivienda';

  const coleccion = bloque.dataset.bloque === 'planFamilia' ? 'planesFamilia' : 'planesPersona';
  return coleccion + '[' + (bloque.dataset.indice || 0) + ']';
}

/** El último segmento de una ruta: `planVivienda.acciones[0].peso` -> `peso`. */
function hojaDeRuta(nombre) {
  const punto = nombre.lastIndexOf('.');
  return punto === -1 ? nombre : nombre.slice(punto + 1);
}

/** Reescribe la ruta completa de los controles de una fila del plan. */
function fijarRutaDeFila(fila, ruta) {
  const elementos = fila.querySelectorAll('[name], [data-name]');
  Array.prototype.forEach.call(elementos, function (el) {
    const nombre = el.getAttribute('name');
    if (nombre) el.setAttribute('name', ruta + '.' + hojaDeRuta(nombre));
    if (el.dataset.name) el.dataset.name = ruta + '.' + hojaDeRuta(el.dataset.name);
  });
}

function renumerarFilas(cuerpoTabla) {
  const filas = cuerpoTabla.querySelectorAll('tr[data-fila]');
  if (filas.length === 0) return;

  const ruta = rutaDelPlan(cuerpoTabla);

  Array.prototype.forEach.call(filas, function (fila, i) {
    const coleccion = fila.dataset.fila === 'accion' ? 'acciones' : 'seguimientos';
    fila.dataset.indice = i;
    fijarRutaDeFila(fila, ruta + '.' + coleccion + '[' + i + ']');
  });
}

/* Prototipos: la primera instancia de cada bloque sirve de plantilla. */
const PROTOTIPOS = {};

function guardarPrototipos() {
  const mapa = {
    familia: '#contenedorFamilias > [data-bloque="familia"]',
    integrante: '[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]',
    planFamilia: '#contenedorPlanFamilia > [data-bloque="planFamilia"]',
    planPersona: '#contenedorPlanPersona > [data-bloque="planPersona"]',
    filaAccion: 'tr[data-fila="accion"]',
    filaSeguimiento: 'tr[data-fila="seguimiento"]'
  };

  Object.keys(mapa).forEach(function (clave) {
    const original = document.querySelector(mapa[clave]);
    if (original) PROTOTIPOS[clave] = original.cloneNode(true);
  });
}

function crearDesdePrototipo(clave) {
  if (!PROTOTIPOS[clave]) return null;
  const clon = PROTOTIPOS[clave].cloneNode(true);
  limpiarClon(clon);
  if (clon.tagName !== 'TR') clon.setAttribute('open', '');
  return clon;
}

/* =========================================================
   2. ENCABEZADOS DE LOS BLOQUES
   ========================================================= */

function actualizarEncabezadosDeBloques() {
  const familias = document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]');

  Array.prototype.forEach.call(familias, function (familia, i) {
    const titulo = familia.querySelector('[data-rol="tituloFamilia"]');
    const meta = familia.querySelector('[data-rol="metaFamilia"]');
    const integrantes = familia.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]');
    const declarados = familia.querySelector('[data-rol="numeroIntegrantes"]');

    if (titulo) titulo.textContent = 'Familia ' + (i + 1);
    if (meta) {
      const total = integrantes.length;
      const esperados = declarados && declarados.value ? Number(declarados.value) : null;
      let texto = total === 0 ? 'Sin integrantes'
        : total + (total === 1 ? ' integrante' : ' integrantes');
      if (esperados !== null && esperados !== total) {
        texto += ' · faltan ' + Math.max(esperados - total, 0) + ' de ' + esperados;
        meta.classList.add('bloque__meta--pendiente');
      } else {
        meta.classList.remove('bloque__meta--pendiente');
      }
      meta.textContent = texto;
    }

    Array.prototype.forEach.call(integrantes, function (integrante, j) {
      const tituloI = integrante.querySelector('[data-rol="tituloIntegrante"]');
      const metaI = integrante.querySelector('[data-rol="metaIntegrante"]');
      const nombre = valorPorRol(integrante, 'primerNombre');
      const apellido = valorPorRol(integrante, 'primerApellido');
      const completo = [nombre, apellido].filter(Boolean).join(' ').trim();

      if (tituloI) tituloI.textContent = completo || 'Integrante ' + (j + 1);
      if (metaI) {
        const edad = integrante.querySelector('[data-rol="edadCalculada"]');
        metaI.textContent = edad && edad.value ? edad.value : 'Sin datos';
      }
    });
  });

  actualizarEncabezadosDePlanes('#contenedorPlanFamilia', 'planFamilia', 'tituloPlanFamilia', 'metaPlanFamilia', 'Cuidado de la familia ');
  actualizarEncabezadosDePlanes('#contenedorPlanPersona', 'planPersona', 'tituloPlanPersona', 'metaPlanPersona', 'Cuidado de la persona ');
}

function actualizarEncabezadosDePlanes(selector, tipo, rolTitulo, rolMeta, prefijo) {
  const contenedor = document.querySelector(selector);
  if (!contenedor) return;

  const bloques = contenedor.querySelectorAll(':scope > [data-bloque="' + tipo + '"]');
  Array.prototype.forEach.call(bloques, function (bloque, i) {
    const titulo = bloque.querySelector('[data-rol="' + rolTitulo + '"]');
    const meta = bloque.querySelector('[data-rol="' + rolMeta + '"]');
    const selectorRef = bloque.querySelector('[data-rol="selectorFamilia"], [data-rol="selectorIntegrante"]');

    if (titulo) {
      const etiqueta = selectorRef && selectorRef.selectedIndex > 0
        ? selectorRef.options[selectorRef.selectedIndex].textContent
        : prefijo + (i + 1);
      titulo.textContent = etiqueta;
    }

    if (meta) {
      const acciones = bloque.querySelectorAll('tr[data-fila="accion"] input[name$=".codigoAccion"]');
      const conCodigo = Array.prototype.filter.call(acciones, function (c) { return c.value.trim() !== ''; });
      meta.textContent = conCodigo.length === 0
        ? 'Sin acciones registradas'
        : conCodigo.length + (conCodigo.length === 1 ? ' acción' : ' acciones');
    }
  });
}

function valorPorRol(ambito, rol) {
  const campo = ambito.querySelector('[data-rol="' + rol + '"]');
  return campo ? campo.value.trim() : '';
}

/* =========================================================
   3. EXCLUSIVIDAD DE OPCIONES
   ========================================================= */

/** "Ninguno"/"Ninguna" desmarca el resto; marcar otra desmarca la exclusión. */
function aplicarExclusividad(contenedor, casillaCambiada) {
  const casillas = contenedor.querySelectorAll('input[type="checkbox"]');
  const esExcluyente = casillaCambiada.dataset.excluyente === 'true';

  if (esExcluyente && casillaCambiada.checked) {
    Array.prototype.forEach.call(casillas, function (otra) {
      if (otra !== casillaCambiada) otra.checked = false;
    });
    return;
  }

  if (!esExcluyente && casillaCambiada.checked) {
    Array.prototype.forEach.call(casillas, function (otra) {
      if (otra.dataset.excluyente === 'true') otra.checked = false;
    });
  }
}

/* =========================================================
   4. CAMPOS CALCULADOS
   ========================================================= */

function numeroDe(campo) {
  if (!campo || campo.value.trim() === '') return null;
  const n = Number(campo.value);
  return isFinite(n) ? n : null;
}

/* =========================================================
   3.1 LÍMITES DE FECHA (RN-016 / RN-064)
   ---------------------------------------------------------
   Ninguna fecha capturada puede ser posterior al día en que se diligencia la
   ficha, y la ficha misma no puede fecharse en el futuro. Las reglas ya lo
   dicen —y el servidor lo vuelve a decir—, pero avisaban al cerrar la visita,
   con doscientos campos de por medio. Poniendo el tope en el propio control,
   el calendario del navegador no deja siquiera elegir el día, y si la fecha
   entra escrita a mano queda señalada en el acto.
   ========================================================= */

function fechaDeHoyIso() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return ahora.getFullYear() + '-' + mes + '-' + dia;
}

/**
 * La fecha contra la que se contrastan las demás: la de diligenciamiento si el
 * ítem 16 ya está respondido, y hoy mientras tanto. Una fecha de ficha futura
 * no sirve de tope —la rechaza RN-016—, así que también cae a hoy.
 */
function fechaDeReferencia() {
  const hoy = fechaDeHoyIso();
  const campo = document.getElementById('fechaDiligenciamiento');
  const fecha = campo ? campo.value : '';
  return fecha && fecha <= hoy ? fecha : hoy;
}

/** Pone el tope en cada control de fecha y revisa lo que ya estuviera puesto. */
function actualizarLimitesDeFecha() {
  const campoFicha = document.getElementById('fechaDiligenciamiento');
  if (campoFicha) {
    campoFicha.max = fechaDeHoyIso();
    revisarLimiteDeFecha(campoFicha);
  }

  const referencia = fechaDeReferencia();
  Array.prototype.forEach.call(
    document.querySelectorAll('[data-rol="fechaNacimiento"]'),
    function (campo) {
      campo.max = referencia;
      revisarLimiteDeFecha(campo);
    }
  );
}

/** Señala la fecha que se sale del tope, sin esperar al cierre de la visita. */
function revisarLimiteDeFecha(campo) {
  if (!campo || !campo.max) return;

  const contenedor = campo.closest('.field, td');
  if (!contenedor) return;

  /* Sólo se retira el aviso propio: los que puso el motor de reglas o el
     servidor los limpia el guardado, no este repaso. */
  const previo = contenedor.querySelector('.field-error-msg[data-origen="fecha"]');
  if (previo) previo.remove();
  if (!contenedor.querySelector('.field-error-msg')) contenedor.classList.remove('has-error');

  if (!campo.value || campo.value <= campo.max) return;

  contenedor.classList.add('has-error');
  const aviso = document.createElement('span');
  aviso.className = 'field-error-msg';
  aviso.dataset.origen = 'fecha';
  aviso.textContent = campo.id === 'fechaDiligenciamiento'
    ? 'RN-016: la ficha no puede fecharse después de hoy (' + campo.max + ').'
    : 'RN-064: la fecha no puede ser posterior al día en que se diligencia la ficha (' +
      campo.max + ').';
  contenedor.appendChild(aviso);
}

/** RN-064 — Edad en años, meses y días a partir de la fecha de nacimiento. */
function actualizarEdad(bloque) {
  const campoFecha = bloque.querySelector('[data-rol="fechaNacimiento"]');
  const campoEdad = bloque.querySelector('[data-rol="edadCalculada"]');
  if (!campoFecha || !campoEdad) return null;

  const fechaFicha = document.getElementById('fechaDiligenciamiento');
  const edad = calcularEdad(campoFecha.value, fechaFicha ? fechaFicha.value : null);

  if (!edad) {
    campoEdad.value = '';
    return null;
  }

  const partes = [];
  if (edad.anios > 0) partes.push(edad.anios + (edad.anios === 1 ? ' año' : ' años'));
  if (edad.meses > 0) partes.push(edad.meses + (edad.meses === 1 ? ' mes' : ' meses'));
  if (edad.anios === 0) partes.push(edad.dias + (edad.dias === 1 ? ' día' : ' días'));

  campoEdad.value = partes.join(', ');
  return edad;
}

/** RN-095 — IMC = peso / (talla/100)². Se muestra desde los 5 años. */
function actualizarImc(bloque, edad) {
  const campoImc = bloque.querySelector('[data-rol="imc"]');
  if (!campoImc) return;

  const peso = numeroDe(bloque.querySelector('[data-rol="peso"]'));
  const talla = numeroDe(bloque.querySelector('[data-rol="talla"]'));
  const mayorDeCinco = edad && edad.totalMeses > 60;

  if (!mayorDeCinco || peso === null || talla === null) {
    campoImc.value = '';
    return;
  }

  const imc = calcularImc(peso, talla);
  campoImc.value = imc === null ? '' : String(imc);
}

/** RN-099 — Clasificación AHA 2024 derivada de la tensión registrada. */
function actualizarTension(bloque) {
  const badge = bloque.querySelector('[data-rol="badgeTension"]');
  const oculto = bloque.querySelector('input[name$=".clasificacionTension"]');
  if (!badge) return;

  const sistolica = numeroDe(bloque.querySelector('[data-rol="sistolica"]'));
  const diastolica = numeroDe(bloque.querySelector('[data-rol="diastolica"]'));
  const clasificacion = clasificarTensionArterial(sistolica, diastolica);

  if (oculto) oculto.value = clasificacion || '';

  if (!clasificacion) {
    badge.className = 'badge badge--neutral';
    badge.textContent = 'Sin calcular';
    return;
  }

  const estilos = {
    crisis: ['badge badge--danger', 'Crisis hipertensiva'],
    nivel2: ['badge badge--danger', 'Hipertensión nivel 2'],
    nivel1: ['badge badge--warning', 'Hipertensión nivel 1'],
    elevada: ['badge badge--warning', 'Elevada'],
    normal: ['badge badge--success', 'Normal']
  };
  badge.className = estilos[clasificacion][0];
  badge.textContent = estilos[clasificacion][1];
}

/** RN-042 / RN-044 — Déficit de cobertura antirrábica de caninos y felinos. */
function actualizarCoberturaAntirrabica() {
  const strip = document.getElementById('stripCoberturaAntirrabica');
  const badge = document.getElementById('badgeCoberturaAntirrabica');
  if (!strip || !badge) return;

  const perros = numeroDe(document.getElementById('perros')) || 0;
  const gatos = numeroDe(document.getElementById('gatos')) || 0;
  const perrosVac = numeroDe(document.getElementById('perrosVacunados')) || 0;
  const gatosVac = numeroDe(document.getElementById('gatosVacunados')) || 0;
  const total = perros + gatos;

  if (total === 0) {
    strip.hidden = true;
    return;
  }

  strip.hidden = false;
  const vacunados = Math.min(perrosVac, perros) + Math.min(gatosVac, gatos);
  const porcentaje = Math.round((vacunados / total) * 100);
  const sinVacuna = total - vacunados;

  badge.textContent = porcentaje + '% (' + vacunados + ' de ' + total + ')' +
    (sinVacuna > 0 ? ' · ' + sinVacuna + ' sin vacuna' : '');
  badge.className = 'badge ' + (sinVacuna === 0 ? 'badge--success'
    : porcentaje >= 50 ? 'badge--warning' : 'badge--danger');
}

/* =========================================================
   5. CAMPOS CONDICIONADOS
   ========================================================= */

/** Muestra u oculta un campo; al ocultarlo limpia lo capturado. */
function mostrarCampo(elemento, visible) {
  if (!elemento) return;
  if (elemento.hidden === !visible) return;

  elemento.hidden = !visible;

  if (!visible) {
    Array.prototype.forEach.call(elemento.querySelectorAll('input, select, textarea'), function (campo) {
      if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = false;
      else if (campo.tagName === 'SELECT') campo.selectedIndex = 0;
      else campo.value = '';
    });
  }
}

function habilitarCampo(elemento, habilitado) {
  if (!elemento) return;
  elemento.disabled = !habilitado;
  if (!habilitado) elemento.value = '';
}

function seleccionados(ambito, sufijoNombre) {
  const casillas = ambito.querySelectorAll('input[name$="' + sufijoNombre + '"]:checked');
  return Array.prototype.map.call(casillas, function (c) { return c.value; });
}

function valorSeleccionado(ambito, sufijoNombre) {
  const marcado = ambito.querySelector('input[name$="' + sufijoNombre + '"]:checked');
  if (marcado) return marcado.value;
  const select = ambito.querySelector('select[name$="' + sufijoNombre + '"]');
  return select ? select.value : '';
}

/** Condicionales de la vivienda: ítems 40 a 45. */
function actualizarCondicionalesVivienda() {
  const animales = Array.prototype.map.call(
    document.querySelectorAll('input[name="animales"]:checked'),
    function (casilla) { return casilla.value; }
  );

  const hayPerros = animales.indexOf('perros') !== -1;
  const hayGatos = animales.indexOf('gatos') !== -1;
  const hayOtro = animales.indexOf('otro') !== -1;

  mostrarCampo(document.getElementById('contenedorAnimalesOtro'), hayOtro);

  const panel = document.getElementById('panelMascotas');
  if (panel) panel.hidden = !(hayPerros || hayGatos);

  habilitarCampo(document.getElementById('perros'), hayPerros);
  habilitarCampo(document.getElementById('perrosVacunados'), hayPerros);
  habilitarCampo(document.getElementById('gatos'), hayGatos);
  habilitarCampo(document.getElementById('gatosVacunados'), hayGatos);

  // RN-045: sin caninos ni felinos la pregunta se autoasigna "No aplica".
  const grupoCarnet = document.getElementById('grupoCarnetAntirrabico');
  if (grupoCarnet) {
    const aplica = hayPerros || hayGatos;
    Array.prototype.forEach.call(grupoCarnet.querySelectorAll('input'), function (radio) {
      radio.disabled = !aplica && radio.value !== 'no_aplica';
      if (!aplica && radio.value === 'no_aplica') autoasignar(radio);
      if (aplica && radio.value === 'no_aplica' && radio.checked) radio.checked = false;
    });
  }

  actualizarCoberturaAntirrabica();
}

/** Condicionales de la familia: ítem 53 según el 52. */
function actualizarCondicionalesFamilia(familia) {
  const tieneCuidador = valorSeleccionado(familia, '.cuidadorPrincipal') === 'si';
  mostrarCampo(familia.querySelector('[data-rol="campoZarit"]'), tieneCuidador);
}

/**
 * Condicionales del integrante. La edad calculada y el sexo gobiernan
 * la habilitación de 14 preguntas; el resto depende de respuestas previas.
 */
function actualizarCondicionalesIntegrante(bloque) {
  const edad = actualizarEdad(bloque);
  const meses = edad ? edad.totalMeses : null;
  const sexo = valorSeleccionado(bloque, '.sexo');
  const gestante = valorSeleccionado(bloque, '.gestacionActual') === 'si' ||
                   seleccionados(bloque, '.sujetoEspecialProteccion').indexOf(SUJETO_GESTANTE) !== -1;

  const tieneEdad = meses !== null;
  const entre = function (min, max) {
    return tieneEdad && meses >= min && (max === null || meses <= max);
  };

  // ---- Por edad ----
  mostrarCampo(bloque.querySelector('[data-rol="campoOrientacion"]'), entre(13 * 12, null));
  mostrarCampo(bloque.querySelector('[data-rol="campoLactancia"]'), entre(0, 5));
  mostrarCampo(bloque.querySelector('[data-rol="campoCintura"]'), entre(18 * 12, null));
  mostrarCampo(bloque.querySelector('[data-rol="campoSignos"]'), entre(3, 60));
  mostrarCampo(bloque.querySelector('[data-rol="campoTension"]'), entre(18 * 12, null));
  mostrarCampo(bloque.querySelector('[data-rol="campoRiesgoJoven"]'), entre(14 * 12, 28 * 12 + 11));
  mostrarCampo(bloque.querySelector('[data-rol="campoDepresiva"]'), entre(14 * 12, null));
  mostrarCampo(bloque.querySelector('[data-rol="campoIdeacion"]'), entre(14 * 12, null));
  mostrarCampo(bloque.querySelector('[data-rol="campoConsumo"]'), entre(14 * 12, null));

  // RN-108: el período indagado cambia entre adolescentes y adultos.
  const hint = bloque.querySelector('[data-rol="hintConsumo"]');
  if (hint && tieneEdad) {
    hint.textContent = entre(14 * 12, 17 * 12 + 11)
      ? 'Pregunte si ha consumido alguna vez en su vida.'
      : 'Pregunte por el consumo en los últimos tres meses.';
  }

  // ---- Por sexo (RN-085) ----
  mostrarCampo(
    bloque.querySelector('[data-rol="campoGestacion"]'),
    SEXOS_CON_CAPACIDAD_GESTAR.indexOf(sexo) !== -1
  );

  // ---- Por respuesta previa ----
  mostrarCampo(
    bloque.querySelector('[data-rol="campoGeneroOtro"]'),
    valorSeleccionado(bloque, '.autoidentificacionGenero') === 'otro'
  );
  mostrarCampo(
    bloque.querySelector('[data-rol="campoOrientacionOtro"]'),
    valorSeleccionado(bloque, '.orientacionSexual') === 'otro'
  );
  mostrarCampo(
    bloque.querySelector('[data-rol="campoProteccionOtro"]'),
    seleccionados(bloque, '.sujetoEspecialProteccion').indexOf('otro') !== -1
  );
  mostrarCampo(
    bloque.querySelector('[data-rol="campoViolencia"]'),
    seleccionados(bloque, '.sujetoEspecialProteccion').indexOf(SUJETO_VIOLENCIA_GENERO) !== -1
  );
  mostrarCampo(
    bloque.querySelector('[data-rol="campoPuebloEtnico"]'),
    valorSeleccionado(bloque, '.pertenenciaEtnica') !== '' &&
    valorSeleccionado(bloque, '.pertenenciaEtnica') !== ETNIA_NINGUNA
  );
  mostrarCampo(bloque.querySelector('[data-rol="campoMaterno"]'), gestante);
  mostrarCampo(
    bloque.querySelector('[data-rol="panelTamizajeSpa"]'),
    valorSeleccionado(bloque, '.consumoSpa') === 'si'
  );

  // RN-076: la EAPB se inactiva cuando no hay afiliación.
  const eapb = bloque.querySelector('[data-rol="eapb"]');
  if (eapb) {
    const noAfiliado = valorSeleccionado(bloque, '.regimenAfiliacion') === REGIMEN_NO_AFILIADO;
    eapb.disabled = noAfiliado;
    if (noAfiliado) eapb.value = '';
  }

  // RN-083: sin discapacidad la certificación se autoasigna "No aplica".
  const discapacidades = seleccionados(bloque, '.discapacidad');
  const tieneDiscapacidad = discapacidades.some(function (d) { return d !== SIN_DISCAPACIDAD; });
  const grupoRlcpd = bloque.querySelector('[data-rol="campoRlcpd"]');
  if (grupoRlcpd) {
    Array.prototype.forEach.call(grupoRlcpd.querySelectorAll('input'), function (radio) {
      radio.disabled = !tieneDiscapacidad && radio.value !== VALOR_NO_APLICA;
      if (!tieneDiscapacidad && radio.value === VALOR_NO_APLICA) autoasignar(radio);
    });
  }

  // RN-103 / RN-104: adherencia sólo si hay condición activa.
  const hayCondicion = ['.enfermedadesNoTransmisibles', '.condicionesTransmisibles', '.zonaEndemica']
    .some(function (sufijo) {
      return seleccionados(bloque, sufijo).some(function (v) { return v !== VALOR_NINGUNA; });
    });
  mostrarCampo(bloque.querySelector('[data-rol="campoAdherencia"]'), hayCondicion);
  mostrarCampo(
    bloque.querySelector('[data-rol="campoMotivoNoTratamiento"]'),
    hayCondicion && valorSeleccionado(bloque, '.adherenciaTratamiento') === 'no'
  );

  // RN-089: la barrera es obligatoria si quedaron atenciones pendientes.
  const pendientes = seleccionados(bloque, '.atencionesPendientesRpms')
    .concat(seleccionados(bloque, '.atencionesPendientesMaterno'))
    .some(function (v) { return v !== VALOR_NINGUNA; });
  const campoBarreras = bloque.querySelector('[data-rol="campoBarreras"]');
  if (campoBarreras) campoBarreras.classList.toggle('campo-requerido', pendientes);

  actualizarAtencionesRpms(bloque, meses, sexo, gestante);
  actualizarImc(bloque, edad);
  actualizarTension(bloque);
}

/**
 * RN-087 — Reconstruye el listado de atenciones dejando sólo las
 * exigibles para la edad y el sexo del integrante. Conserva lo ya
 * marcado que siga siendo aplicable.
 */
function actualizarAtencionesRpms(bloque, meses, sexo, gestante) {
  const grupo = bloque.querySelector('[data-rol="grupoRpms"]');
  if (!grupo) return;

  const marcadas = seleccionados(bloque, '.atencionesPendientesRpms');
  const nombre = grupo.dataset.name || '';

  if (meses === null || !sexo) {
    grupo.innerHTML = '<p class="aviso-perfil">Complete la fecha de nacimiento (ítem 64) y el sexo ' +
      '(ítem 66) para conocer las atenciones exigibles.</p>';
    return;
  }

  const exigibles = atencionesRpmsExigibles(meses, sexo, gestante);

  grupo.innerHTML = exigibles.map(function (opcion) {
    const clase = 'check-pill' + (opcion.excluyente ? ' check-pill--excluyente' : '');
    const marcada = marcadas.indexOf(opcion.valor) !== -1 ? ' checked' : '';
    return '<label class="' + clase + '">' +
      '<input type="checkbox" name="' + escaparHtml(nombre) + '" value="' + escaparHtml(opcion.valor) + '"' +
      (opcion.excluyente ? ' data-excluyente="true"' : '') + marcada + '> ' +
      escaparHtml(opcion.etiqueta) + '</label>';
  }).join('');
}

/* Un nombre es plano cuando no anida: ni índice ni punto. Los planos los
   recoge FormData; los anidados los arma `asignarEnRuta`. */
function esNombrePlano(nombre) {
  return nombre.indexOf('[') === -1 && nombre.indexOf('.') === -1;
}

/* =========================================================
   6. HERENCIA DE LLAVES DEL PLAN DE CUIDADO
   ========================================================= */

/** RN-111 a RN-134 — Propaga los códigos de origen a todos los planes. */
function propagarLlavesHeredadas() {
  const origenes = {
    equipoSaludId: valorDeId('equipoSaludId'),
    idHogar: valorDeId('idHogar'),
    idFamilia: valorDeId('idFamilia')
  };

  /* RN-026: el código de la familia no es el ítem 26 que se digita, sino uno
     derivado del hogar y del consecutivo —el mismo que el servidor termina
     escribiendo en `aps.familia.codigo`—. Los planes 6.2 y 6.3 tienen que
     heredar ése.

     Heredando el ítem 26, el plan apuntaba a un código de familia que no
     existía en la base y el disparador RN-122/132 tumbaba la ficha entera con
     un 500. El ítem 26 sigue siendo el número que la familia usa como
     referencia; no es su llave. */
  const codigoDeFamilia = function (indice) {
    return origenes.idHogar ? origenes.idHogar + '-F' + (indice + 1) : '';
  };

  /* Cada familia muestra desde ya el código que se le va a asignar, en lugar
     de dejar el campo en «Se asigna al guardar» hasta después de guardar. */
  Array.prototype.forEach.call(
    document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]'),
    function (familia, i) {
      const campo = familia.querySelector('input[name$=".idFamilia"]');
      if (campo) campo.value = codigoDeFamilia(i);
    }
  );

  Array.prototype.forEach.call(document.querySelectorAll('[data-hereda]'), function (campo) {
    const clave = campo.dataset.hereda;
    if (clave === 'documentoIntegrante') return; // se resuelve en el selector de 6.3

    if (clave === 'idFamilia') {
      campo.value = codigoDeFamilia(familiaDelPlan(campo));
      return;
    }

    campo.value = origenes[clave] || '';
  });
}

/**
 * Índice de la familia a la que apunta el plan que contiene a este campo.
 * En 6.2 el selector vale «0»; en 6.3 vale «0:2» —familia e integrante—, y en
 * los dos casos la familia va de primera. Sin selección, la primera familia.
 */
function familiaDelPlan(campo) {
  const bloque = campo.closest('[data-bloque="planFamilia"], [data-bloque="planPersona"]');
  if (!bloque) return 0;

  const selector = bloque.querySelector('[data-rol="selectorFamilia"], [data-rol="selectorIntegrante"]');
  if (!selector || !selector.value) return 0;

  const indice = parseInt(String(selector.value).split(':')[0], 10);
  return isFinite(indice) ? indice : 0;
}

function valorDeId(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* =========================================================
   7. SELECTORES DE LOS PLANES 6.2 Y 6.3
   ========================================================= */

/** Alimenta los selectores con las familias e integrantes ya caracterizados. */
function actualizarSelectoresDePlan() {
  const familias = document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]');

  const opcionesFamilia = [];
  const opcionesIntegrante = [];

  Array.prototype.forEach.call(familias, function (familia, i) {
    opcionesFamilia.push({ valor: String(i), etiqueta: 'Familia ' + (i + 1) });

    const integrantes = familia.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]');
    Array.prototype.forEach.call(integrantes, function (integrante, j) {
      const nombre = [valorPorRol(integrante, 'primerNombre'), valorPorRol(integrante, 'primerApellido')]
        .filter(Boolean).join(' ').trim();
      opcionesIntegrante.push({
        valor: i + ':' + j,
        etiqueta: 'Familia ' + (i + 1) + ' · ' + (nombre || 'Integrante ' + (j + 1)),
        tipoId: valorSeleccionado(integrante, '.tipoId'),
        numeroId: (integrante.querySelector('input[name$=".numeroId"]') || {}).value || ''
      });
    });
  });

  refrescarSelector('[data-rol="selectorFamilia"]', opcionesFamilia, 'Seleccione una familia registrada...');
  refrescarSelector('[data-rol="selectorIntegrante"]', opcionesIntegrante, 'Seleccione un integrante registrado...');

  // RN-133 / RN-134: el documento del integrante se autocompleta, no se digita.
  Array.prototype.forEach.call(document.querySelectorAll('[data-rol="selectorIntegrante"]'), function (selector) {
    const bloque = selector.closest('[data-bloque="planPersona"]');
    if (!bloque) return;

    const elegido = opcionesIntegrante.find(function (o) { return o.valor === selector.value; });
    const campoTipo = bloque.querySelector('select[name$=".tipoIdIntegrante"]');
    const campoNumero = bloque.querySelector('input[name$=".numeroIdIntegrante"]');

    if (campoTipo) {
      campoTipo.value = elegido ? elegido.tipoId : '';
      campoTipo.disabled = true;
      espejarCampoDeshabilitado(campoTipo);
    }
    if (campoNumero) {
      campoNumero.value = elegido ? elegido.numeroId : '';
      campoNumero.readOnly = true;
    }
  });
}

/**
 * Mantiene un `input` oculto con el valor de un control deshabilitado.
 *
 * Un control `disabled` no viaja en el `FormData` —lo manda el estándar—, y
 * `recolectarDatosFormulario` construye la ficha justamente a partir de un
 * `FormData`. El tipo de documento del ítem 133 se veía en pantalla, se
 * bloqueaba para que nadie lo cambiara, y desaparecía al guardar: RN-133
 * rechazaba la ficha señalando un campo que el usuario no podía tocar, y la
 * sección 6.3 no había manera de cerrarla.
 *
 * El número del ítem 134 nunca tuvo el problema porque usa `readOnly`, que sí
 * se envía. `readOnly` no existe para `<select>`, así que el equivalente es
 * dejarlo deshabilitado y acompañarlo de este espejo.
 */
function espejarCampoDeshabilitado(campo) {
  const contenedor = campo.parentNode;
  if (!contenedor) return;

  let espejo = contenedor.querySelector(':scope > input[data-espejo="si"]');

  /* Sin valor no se escribe nada: un espejo vacío metería la clave en la
     ficha con cadena vacía en vez de dejarla ausente. */
  if (!campo.value) {
    if (espejo) espejo.remove();
    return;
  }

  if (!espejo) {
    espejo = document.createElement('input');
    espejo.type = 'hidden';
    espejo.setAttribute('data-espejo', 'si');
    contenedor.appendChild(espejo);
  }

  /* El nombre se copia en cada pasada y no una sola vez: al agregar o quitar
     planes, `fijarIndiceEnAmbito` renumera el select y el espejo debe seguirlo. */
  espejo.name = campo.name;
  espejo.value = campo.value;
}

function refrescarSelector(selectorCss, opciones, placeholder) {
  Array.prototype.forEach.call(document.querySelectorAll(selectorCss), function (select) {
    const anterior = select.value;
    const partes = ['<option value="">' + placeholder + '</option>'];
    opciones.forEach(function (o) {
      partes.push('<option value="' + escaparHtml(o.valor) + '">' + escaparHtml(o.etiqueta) + '</option>');
    });
    select.innerHTML = partes.join('');
    if (anterior && opciones.some(function (o) { return o.valor === anterior; })) {
      select.value = anterior;
    }
  });
}

/* =========================================================
   8. SINCRONIZACIÓN DEL NÚMERO DE INTEGRANTES (RN-051)
   ========================================================= */

const MAXIMO_INTEGRANTES = 30;

/**
 * ¿El bloque tiene algún dato capturado por el encuestador?
 * Se ignoran los valores que el propio sistema autoasigna (por ejemplo el
 * "No aplica" de RN-083), porque de lo contrario un bloque recién creado
 * parecería diligenciado y pediría confirmación siempre.
 */
function bloqueTieneDatos(bloque) {
  const campos = bloque.querySelectorAll('input, select, textarea');
  return Array.prototype.some.call(campos, function (campo) {
    if (campo.readOnly || campo.disabled) return false;
    if (campo.dataset.autoasignado === 'si') return false;
    if (campo.type === 'checkbox' || campo.type === 'radio') return campo.checked;
    if (campo.tagName === 'SELECT') return campo.selectedIndex > 0;
    return campo.value.trim() !== '';
  });
}

/** Marca un control como completado por el sistema, no por el encuestador. */
function autoasignar(control) {
  if (!control) return;
  control.checked = true;
  control.dataset.autoasignado = 'si';
}

/**
 * Genera o retira bloques de integrante para igualar el ítem 51 (RN-051).
 * Al reducir se pide confirmación explícita, porque los bloques sobrantes
 * pueden contener información ya capturada. Si se cancela, el ítem 51
 * vuelve al número de integrantes realmente caracterizados.
 */
function sincronizarIntegrantes(familia) {
  const campo = familia.querySelector('[data-rol="numeroIntegrantes"]');
  const contenedor = familia.querySelector('[data-rol="contenedorIntegrantes"]');
  if (!campo || !contenedor) return;

  const declarados = Number(campo.value);
  if (!isFinite(declarados) || declarados < 1) return;

  const bloques = contenedor.querySelectorAll(':scope > [data-bloque="integrante"]');
  const actuales = bloques.length;

  if (declarados > MAXIMO_INTEGRANTES) {
    campo.value = MAXIMO_INTEGRANTES;
    mostrarNotificacion('El máximo admitido es ' + MAXIMO_INTEGRANTES + ' integrantes por familia.', 'warning');
    return sincronizarIntegrantes(familia);
  }

  if (declarados > actuales) {
    for (let i = actuales; i < declarados; i++) {
      const clon = crearDesdePrototipo('integrante');
      if (clon) contenedor.appendChild(clon);
    }
    finalizarSincronizacion();
    return;
  }

  if (declarados < actuales) {
    const sobrantes = Array.prototype.slice.call(bloques, declarados);
    const conDatos = sobrantes.filter(bloqueTieneDatos).length;

    // Sin información capturada no hay nada que perder: se retiran directamente.
    if (conDatos === 0) {
      sobrantes.forEach(function (bloque) { bloque.remove(); });
      finalizarSincronizacion();
      return;
    }

    pedirConfirmacion({
      titulo: 'Reducir integrantes de la familia',
      mensaje: 'Se eliminarán los últimos ' + sobrantes.length +
        (sobrantes.length === 1 ? ' integrante' : ' integrantes') + ' de esta familia, de los cuales ' +
        conDatos + (conDatos === 1 ? ' tiene' : ' tienen') +
        ' información capturada. Esta acción no se puede deshacer. ¿Desea continuar?',
      textoConfirmar: 'Eliminar integrantes',
      alConfirmar: function () {
        sobrantes.forEach(function (bloque) { bloque.remove(); });
        finalizarSincronizacion();
        mostrarNotificacion(
          sobrantes.length + (sobrantes.length === 1 ? ' integrante eliminado.' : ' integrantes eliminados.'),
          'success'
        );
      },
      alCancelar: function () {
        // Se restablece el ítem 51 al número de bloques realmente presentes.
        campo.value = actuales;
        finalizarSincronizacion();
      }
    });
    return;
  }

  finalizarSincronizacion();
}

function finalizarSincronizacion() {
  renumerarFormulario();
  actualizarSelectoresDePlan();
  actualizarEncabezadosDeBloques();
}

/* =========================================================
   9. RECOLECCIÓN DEL MODELO ANIDADO
   ========================================================= */

/** Asigna un valor en una ruta tipo `familias[0].integrantes[1].peso`. */
function asignarEnRuta(objeto, ruta, valor, esLista) {
  const segmentos = ruta.replace(/\[(\d+)\]/g, '.$1').split('.');
  let actual = objeto;

  for (let i = 0; i < segmentos.length - 1; i++) {
    const clave = segmentos[i];
    const siguienteEsIndice = /^\d+$/.test(segmentos[i + 1]);
    if (actual[clave] === undefined) actual[clave] = siguienteEsIndice ? [] : {};
    actual = actual[clave];
  }

  const ultima = segmentos[segmentos.length - 1];
  if (esLista) {
    if (!Array.isArray(actual[ultima])) actual[ultima] = [];
    actual[ultima].push(valor);
  } else {
    actual[ultima] = valor;
  }
}

const CAMPOS_ENTEROS = [
  'hogaresEnVivienda', 'personasEnVivienda', 'habitacionesVivienda', 'elementosParaDormir',
  'perros', 'perrosVacunados', 'gatos', 'gatosVacunados', 'numeroIntegrantes',
  'tensionSistolica', 'tensionDiastolica', 'puntajeAssist', 'puntajeAudit', 'puntajeCrafft'
];

const CAMPOS_DECIMALES = ['peso', 'talla', 'circunferenciaCintura', 'imc'];

function convertirValor(nombreCampo, valor) {
  const hoja = nombreCampo.split('.').pop();
  if (valor === '') return null;

  if (CAMPOS_ENTEROS.indexOf(hoja) !== -1) {
    const n = parseInt(valor, 10);
    return isFinite(n) ? n : null;
  }
  if (CAMPOS_DECIMALES.indexOf(hoja) !== -1) {
    const n = Number(valor);
    return isFinite(n) ? n : null;
  }
  return valor;
}

/**
 * Recorre el formulario y construye el objeto anidado que espera reglas.js.
 * Los planes 6.2 y 6.3 se capturan planos (`planesFamilia`, `planesPersona`)
 * y aquí se enrutan a la familia o el integrante que les corresponde.
 */
function recolectarBloquesRepetibles(formulario) {
  const datos = {};
  const campos = formulario.querySelectorAll('[name]');
  Array.prototype.forEach.call(campos, function (campo) {
    const nombre = campo.getAttribute('name');
    /* Se recogen los nombres anidados y se dejan los planos, que ya vienen
       por FormData. Anidan de dos formas: con índice —familias[0].tipoFamilia—
       y con punto a secas —planVivienda.codigoEbs—. Exigir el corchete dejaba
       fuera las llaves heredadas del plan (RN-111, RN-112, RN-121, RN-131),
       de modo que llegaban vacías al motor y la ficha no podía cerrarse. */
    if (!nombre || esNombrePlano(nombre)) return;
    if (campo.disabled) return;

    if (campo.type === 'checkbox') {
      if (!campo.checked) return;
      asignarEnRuta(datos, nombre, campo.value, true);
      return;
    }
    if (campo.type === 'radio') {
      if (!campo.checked) return;
      asignarEnRuta(datos, nombre, campo.value, false);
      return;
    }
    asignarEnRuta(datos, nombre, convertirValor(nombre, campo.value.trim()), false);
  });

  normalizarListasVacias(formulario, datos);
  enrutarPlanes(datos);

  return datos;
}

/** Deja en [] los grupos de selección múltiple sin ninguna casilla marcada. */
function normalizarListasVacias(formulario, datos) {
  Array.prototype.forEach.call(formulario.querySelectorAll('[data-catalogo]'), function (grupo) {
    if (grupo.tagName === 'SELECT') return;
    if (grupo.classList.contains('radio-group') || grupo.dataset.tipo === 'radio') return;

    const nombre = grupo.dataset.name;
    if (!nombre || esNombrePlano(nombre)) return;

    const segmentos = nombre.replace(/\[(\d+)\]/g, '.$1').split('.');
    let actual = datos;
    for (let i = 0; i < segmentos.length - 1; i++) {
      if (actual[segmentos[i]] === undefined) return;
      actual = actual[segmentos[i]];
    }
    const hoja = segmentos[segmentos.length - 1];
    if (!Array.isArray(actual[hoja])) actual[hoja] = [];
  });
}

/** Lleva `planesFamilia[]` y `planesPersona[]` al modelo anidado. */
function enrutarPlanes(datos) {
  const familias = datos.familias || [];

  (datos.planesFamilia || []).forEach(function (plan) {
    if (!plan || plan.familiaRef === null || plan.familiaRef === undefined || plan.familiaRef === '') return;
    const indice = parseInt(plan.familiaRef, 10);
    if (!familias[indice]) return;
    familias[indice].planFamilia = plan;
  });

  (datos.planesPersona || []).forEach(function (plan) {
    if (!plan || !plan.integranteRef) return;
    const partes = String(plan.integranteRef).split(':');
    const familia = familias[parseInt(partes[0], 10)];
    if (!familia || !familia.integrantes) return;
    const integrante = familia.integrantes[parseInt(partes[1], 10)];
    if (!integrante) return;
    integrante.planPersona = plan;
  });

  delete datos.planesFamilia;
  delete datos.planesPersona;
}

/* =========================================================
   10. RECÁLCULO GLOBAL Y DELEGACIÓN DE EVENTOS
   ========================================================= */

function recalcularFormularioCompleto() {
  actualizarCondicionalesVivienda();

  Array.prototype.forEach.call(
    document.querySelectorAll('#contenedorFamilias > [data-bloque="familia"]'),
    function (familia) {
      actualizarCondicionalesFamilia(familia);
      Array.prototype.forEach.call(
        familia.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]'),
        actualizarCondicionalesIntegrante
      );
    }
  );

  propagarLlavesHeredadas();
  actualizarSelectoresDePlan();
  actualizarLimitesDeFecha();

  /* Los códigos que llegan puestos —una ficha abierta para corregir— no los
     tecleó nadie, así que nadie disparó su búsqueda. Resolverlos aquí les pone
     el nombre debajo. Es barato: lo ya resuelto no se vuelve a preguntar. */
  if (typeof resolverCombosCups === 'function') resolverCombosCups();

  actualizarEncabezadosDeBloques();
}

function manejarCambioEnFormulario(evento) {
  const objetivo = evento.target;

  /* La fecha de la ficha es el tope de todas las demás, así que al cambiarla
     hay que repasar el formulario entero (RN-016 / RN-064). */
  if (objetivo.type === 'date') {
    if (objetivo.id === 'fechaDiligenciamiento') actualizarLimitesDeFecha();
    else revisarLimiteDeFecha(objetivo);
  }

  // Si el encuestador interviene el campo, deja de ser un valor autoasignado.
  if (objetivo.dataset && objetivo.dataset.autoasignado === 'si') {
    delete objetivo.dataset.autoasignado;
  }

  // Exclusividad de "Ninguno" / "Ninguna"
  if (objetivo.type === 'checkbox') {
    const grupo = objetivo.closest('.check-group');
    if (grupo) aplicarExclusividad(grupo, objetivo);
  }

  const bloqueIntegrante = objetivo.closest('[data-bloque="integrante"]');
  const bloqueFamilia = objetivo.closest('[data-bloque="familia"]');

  if (bloqueIntegrante) actualizarCondicionalesIntegrante(bloqueIntegrante);
  if (bloqueFamilia) actualizarCondicionalesFamilia(bloqueFamilia);

  if (!bloqueIntegrante && !bloqueFamilia) actualizarCondicionalesVivienda();

  if (['equipoSaludId', 'idHogar', 'idFamilia'].indexOf(objetivo.id) !== -1) {
    propagarLlavesHeredadas();
  }

  // Sólo al confirmar el campo (change), nunca en cada tecla: al reescribir
  // "12" por "1" se pasa por valores intermedios que dispararían borrados.
  if (objetivo.dataset.rol === 'numeroIntegrantes' && evento.type === 'change' && bloqueFamilia) {
    sincronizarIntegrantes(bloqueFamilia);
  }

  // Los selectores de 6.2 y 6.3 se alimentan de los datos de identificación,
  // así que deben repintarse ante cualquier cambio dentro de una familia.
  if (bloqueFamilia || objetivo.dataset.rol === 'selectorIntegrante' ||
      objetivo.dataset.rol === 'selectorFamilia') {
    actualizarSelectoresDePlan();
    /* Elegir otra familia en el plan cambia el código que hereda (RN-122/132),
       así que las llaves se vuelven a propagar. */
    propagarLlavesHeredadas();
  }

  actualizarEncabezadosDeBloques();
}

function manejarClicEnFormulario(evento) {
  const boton = evento.target.closest('[data-accion], #btnAgregarFamilia, #btnAgregarPlanFamilia, ' +
    '#btnAgregarPlanPersona, #btnAgregarAccionVivienda, #btnAgregarSeguimientoVivienda');
  if (!boton) return;

  const accion = boton.dataset.accion || boton.id;

  switch (accion) {
    case 'btnAgregarFamilia':
      agregarBloque('#contenedorFamilias', 'familia');
      break;

    case 'agregarIntegrante': {
      const familia = boton.closest('[data-bloque="familia"]');
      const contenedor = familia && familia.querySelector('[data-rol="contenedorIntegrantes"]');
      if (contenedor) {
        const clon = crearDesdePrototipo('integrante');
        if (clon) contenedor.appendChild(clon);
      }
      break;
    }

    case 'btnAgregarPlanFamilia':
      agregarBloque('#contenedorPlanFamilia', 'planFamilia');
      break;

    case 'btnAgregarPlanPersona':
      agregarBloque('#contenedorPlanPersona', 'planPersona');
      break;

    case 'quitarFamilia':
      quitarBloque(boton, '[data-bloque="familia"]', '#contenedorFamilias', 'familia');
      break;

    case 'quitarIntegrante':
      quitarBloque(boton, '[data-bloque="integrante"]', '[data-rol="contenedorIntegrantes"]', 'integrante');
      break;

    case 'quitarPlanFamilia':
      quitarBloque(boton, '[data-bloque="planFamilia"]', '#contenedorPlanFamilia', 'planFamilia');
      break;

    case 'quitarPlanPersona':
      quitarBloque(boton, '[data-bloque="planPersona"]', '#contenedorPlanPersona', 'planPersona');
      break;

    case 'quitarFila': {
      const fila = boton.closest('tr[data-fila]');
      const cuerpo = fila && fila.parentElement;
      if (cuerpo && cuerpo.querySelectorAll('tr[data-fila]').length > 1) fila.remove();
      else mostrarNotificacion('Debe conservar al menos una fila.', 'warning');
      break;
    }

    case 'agregarAccionVivienda':
    case 'btnAgregarAccionVivienda':
      agregarFila(document.getElementById('filasAccionVivienda'), 'filaAccion');
      break;

    case 'agregarSeguimientoVivienda':
    case 'btnAgregarSeguimientoVivienda':
      agregarFila(document.getElementById('filasSeguimientoVivienda'), 'filaSeguimiento');
      break;

    case 'agregarAccionFamilia':
    case 'agregarAccionPersona':
      agregarFila(boton.parentElement.querySelector('[data-rol^="filasAccion"]') ||
        boton.previousElementSibling.querySelector('tbody'), 'filaAccion');
      break;

    case 'agregarSeguimientoFamilia':
    case 'agregarSeguimientoPersona':
      agregarFila(boton.parentElement.querySelector('[data-rol^="filasSeguimiento"]') ||
        boton.previousElementSibling.querySelector('tbody'), 'filaSeguimiento');
      break;

    default:
      return;
  }

  renumerarFormulario();
  recalcularFormularioCompleto();
}

function agregarBloque(selectorContenedor, clavePrototipo) {
  const contenedor = document.querySelector(selectorContenedor);
  const clon = crearDesdePrototipo(clavePrototipo);
  if (contenedor && clon) contenedor.appendChild(clon);
}

function quitarBloque(boton, selectorBloque, selectorContenedor, etiqueta) {
  const bloque = boton.closest(selectorBloque);
  if (!bloque) return;

  const contenedor = bloque.parentElement;
  const hermanos = contenedor.querySelectorAll(':scope > ' + selectorBloque);

  if (hermanos.length <= 1) {
    mostrarNotificacion('Debe conservar al menos un bloque de ' + etiqueta + '.', 'warning');
    return;
  }
  bloque.remove();
}

function agregarFila(cuerpoTabla, clavePrototipo) {
  if (!cuerpoTabla) return;
  const clon = crearDesdePrototipo(clavePrototipo);
  if (clon) cuerpoTabla.appendChild(clon);
}

/* =========================================================
   11. INICIALIZACIÓN
   ========================================================= */

function inicializarFormularioDinamico() {
  const formulario = document.getElementById('encuestaForm');
  if (!formulario) return;

  guardarPrototipos();

  formulario.addEventListener('change', manejarCambioEnFormulario);
  formulario.addEventListener('input', function (evento) {
    const objetivo = evento.target;
    // Sólo los campos que alimentan cálculos o encabezados.
    const rolesRelevantes = ['peso', 'talla', 'sistolica', 'diastolica', 'fechaNacimiento',
      'primerNombre', 'primerApellido', 'numeroIntegrantes'];
    if (rolesRelevantes.indexOf(objetivo.dataset.rol) !== -1) {
      manejarCambioEnFormulario(evento);
    } else if (['equipoSaludId', 'idHogar', 'idFamilia'].indexOf(objetivo.id) !== -1) {
      propagarLlavesHeredadas();
    } else if (['perros', 'perrosVacunados', 'gatos', 'gatosVacunados'].indexOf(objetivo.id) !== -1) {
      actualizarCoberturaAntirrabica();
    }
  });
  formulario.addEventListener('click', manejarClicEnFormulario);

  renumerarFormulario();
  recalcularFormularioCompleto();
}
