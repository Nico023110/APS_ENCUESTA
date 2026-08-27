/* =========================================================================
   Utilidades para las pruebas de navegador
   -------------------------------------------------------------------------
   Dos ideas gobiernan este archivo:

   1. La prueba no se detiene en el primer tropiezo. Si un campo no existe,
      está deshabilitado o no acepta el valor, se anota y se sigue. Al final
      se entrega la lista completa; parar en el primer fallo obligaría a
      correr la prueba una y otra vez para ir descubriendo los siguientes.

   2. Se interactúa como una persona: clic, selección, escritura. Nada de
      asignar `.value` por JavaScript. Un campo tapado por otro elemento, o
      deshabilitado, tiene que doler aquí igual que le duele a quien
      diligencia en campo.
   ========================================================================= */

'use strict';

/* ---------------------------------------------------------
   1. DIARIO DE LA CORRIDA
   --------------------------------------------------------- */

function crearDiario() {
  const diario = {
    zona: '—',
    diligenciados: 0,
    omitidos: 0,
    problemas: [],
    omitidosPorEdad: [],
    consola: [],
    peticiones: [],
    externas: [],
    hitos: []
  };

  diario.entrarA = function (zona) {
    diario.zona = zona;
    console.log('\n──── ' + zona + ' ' + '─'.repeat(Math.max(0, 62 - zona.length)));
  };

  diario.ok = function (etiqueta, valor) {
    diario.diligenciados++;
    console.log('   ✓ ' + etiqueta + (valor !== undefined ? '  →  ' + valor : ''));
  };

  diario.problema = function (etiqueta, motivo, detalle) {
    diario.omitidos++;
    diario.problemas.push({
      zona: diario.zona, etiqueta: etiqueta, motivo: motivo, detalle: detalle || ''
    });
    console.log('   ✗ ' + etiqueta + '  →  ' + motivo + (detalle ? '\n       ' + detalle : ''));
  };

  /* Un campo que el formulario esconde a propósito —la tensión arterial de
     una niña de ocho años— no es un fallo. Se deja constancia de que se
     revisó y no aplicaba, sin ensuciar la lista de problemas. */
  diario.noAplica = function (etiqueta, motivo) {
    diario.omitidosPorEdad.push({ zona: diario.zona, etiqueta: etiqueta, motivo: motivo });
    console.log('   – ' + etiqueta + '  →  no aplica (' + motivo + ')');
  };

  diario.hito = function (texto) {
    diario.hitos.push(texto);
    console.log('\n   ▸ ' + texto);
  };

  return diario;
}

/* ---------------------------------------------------------
   2. VIGILANCIA DEL NAVEGADOR
   ---------------------------------------------------------
   Todo lo que el navegador reporta por su cuenta: excepciones sin capturar,
   `console.error`, peticiones caídas y respuestas 4xx/5xx. Es la mitad de
   los fallos que una prueba sobre JSDOM nunca ve.
   --------------------------------------------------------- */

/* El favicon no existe en el proyecto y su 404 es ruido en cada corrida. */
const RUIDO = [/favicon\.ico/];

function esRuido(url) {
  return RUIDO.some(function (patron) { return patron.test(url); });
}

/* La geocodificación consulta OpenStreetMap. Que ese servicio no responda es
   un dato útil —la app depende de una red externa— pero no un defecto del
   formulario, así que se anota aparte y no cuenta para el veredicto. */
function esExterna(url) {
  return url.indexOf('http') === 0 && url.indexOf('localhost') === -1;
}

function vigilar(page, diario) {
  page.on('pageerror', function (error) {
    diario.consola.push({
      tipo: 'excepción', zona: diario.zona,
      texto: error.message, pila: (error.stack || '').split('\n').slice(1, 4).join('\n')
    });
    console.log('   ⚠ EXCEPCIÓN EN LA PÁGINA: ' + error.message);
  });

  page.on('console', function (mensaje) {
    const tipo = mensaje.type();
    if (tipo !== 'error' && tipo !== 'warning') return;
    const texto = mensaje.text();
    if (esRuido(texto)) return;

    /* «Failed to load resource» no dice qué recurso, así que no se puede
       distinguir el favicon de algo que importe. Los oyentes de `response` y
       `requestfailed` ya registran esas mismas caídas con su URL y con el
       filtro de ruido aplicado; anotarlas aquí sólo duplicaría sin datos. */
    if (/Failed to load resource/i.test(texto)) return;

    diario.consola.push({ tipo: tipo === 'error' ? 'consola.error' : 'consola.warn', zona: diario.zona, texto: texto });
    console.log('   ⚠ ' + tipo.toUpperCase() + ' EN CONSOLA: ' + texto.slice(0, 220));
  });

  page.on('requestfailed', function (peticion) {
    const url = peticion.url();
    if (esRuido(url)) return;
    const fallo = peticion.failure();
    const registro = {
      zona: diario.zona, url: url,
      estado: 'sin respuesta', detalle: fallo ? fallo.errorText : ''
    };
    (esExterna(url) ? diario.externas : diario.peticiones).push(registro);
    console.log('   ⚠ PETICIÓN CAÍDA: ' + url + ' (' + (fallo ? fallo.errorText : '') + ')');
  });

  page.on('response', async function (respuesta) {
    const url = respuesta.url();
    if (respuesta.status() < 400 || esRuido(url)) return;
    let cuerpo = '';
    try { cuerpo = (await respuesta.text()).slice(0, 700); } catch (error) { /* ya se cerró */ }
    const registro = {
      zona: diario.zona, url: url,
      estado: String(respuesta.status()), detalle: cuerpo
    };
    (esExterna(url) ? diario.externas : diario.peticiones).push(registro);
    console.log('   ⚠ RESPUESTA ' + respuesta.status() + ': ' + url);
  });
}

/* ---------------------------------------------------------
   3. LETRERO DE SEGUIMIENTO
   ---------------------------------------------------------
   Con la ventana abierta, la prueba avanza sola y es fácil perder el hilo
   de en qué parte del formulario va. Este letrero lo dice en pantalla y
   queda grabado en el vídeo.
   --------------------------------------------------------- */

async function anunciar(page, texto) {
  await page.evaluate(function (mensaje) {
    let letrero = document.getElementById('__letreroPrueba');
    if (!letrero) {
      letrero = document.createElement('div');
      letrero.id = '__letreroPrueba';
      letrero.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
        'background:#0f172a', 'color:#f8fafc', 'font:600 14px/1.5 system-ui,sans-serif',
        'padding:10px 18px', 'letter-spacing:.2px',
        'box-shadow:0 -2px 12px rgba(0,0,0,.25)', 'pointer-events:none'
      ].join(';');
      document.body.appendChild(letrero);
    }
    letrero.textContent = '▶  ' + mensaje;
  }, texto).catch(function () { /* la página pudo navegar */ });
}

/* ---------------------------------------------------------
   4. INTERACCIONES
   --------------------------------------------------------- */

function aSelector(campo) {
  /* Un `#id` se usa tal cual; cualquier otra cosa se toma como el atributo
     name, que es como el formulario nombra casi todos sus controles. */
  return campo.charAt(0) === '#' || campo.charAt(0) === '[' ? campo : '[name="' + campo + '"]';
}

/** Estado real del control, tal como lo ve quien diligencia. */
async function inspeccionar(locator) {
  return locator.evaluate(function (el) {
    /* `offsetParent === null` atrapa de una vez el `display:none` propio y el
       de cualquier antepasado, que es como el formulario esconde los campos
       que no aplican a la edad o al sexo del integrante. */
    const estilo = getComputedStyle(el);
    const oculto = el.offsetParent === null ||
      estilo.visibility === 'hidden' ||
      el.closest('[hidden]') !== null;

    /* El motivo importa para el informe: un campo condicionado que no aplica
       no es lo mismo que un campo que debería estar y no se ve. */
    const contenedor = el.closest('[data-campo], [data-rol]');
    return {
      etiqueta: el.tagName.toLowerCase(),
      tipo: el.type || '',
      deshabilitado: el.disabled,
      soloLectura: !!el.readOnly,
      oculto: oculto,
      condicionado: oculto && !!contenedor &&
        (contenedor.hasAttribute('hidden') || contenedor.classList.contains('is-oculto')),
      opciones: el.tagName === 'SELECT'
        ? Array.from(el.options).map(function (o) { return o.value; })
        : null
    };
  });
}

function motivoOculto(estado) {
  return estado.condicionado
    ? 'el campo está oculto porque no aplica a esta persona (campo condicionado)'
    : 'el campo está oculto y no se puede diligenciar';
}

/* Milisegundos entre tecla y tecla. Se escribe carácter a carácter, no de
   un golpe, por dos razones: se ve el proceso, y cada pulsación dispara los
   `input` que el formulario escucha para recalcular edad, IMC y hacinamiento.
   Un `fill` los dispara una sola vez y esconde los fallos de recálculo. */
const DEMORA_TECLA = Number(process.env.PW_TECLA || 45);

/** Escribe en un campo de texto, número o fecha. */
async function escribir(page, diario, campo, valor, etiqueta, opciones) {
  etiqueta = etiqueta || campo;
  opciones = opciones || {};
  const locator = page.locator(aSelector(campo)).first();

  if (await locator.count() === 0) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'el campo no está presente'); return false; }
    diario.problema(etiqueta, 'el campo no existe en el formulario');
    return false;
  }

  const estado = await inspeccionar(locator);

  if (estado.oculto) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'campo condicionado, oculto'); return false; }
    diario.problema(etiqueta, motivoOculto(estado));
    return false;
  }
  if (estado.deshabilitado) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'campo deshabilitado'); return false; }
    diario.problema(etiqueta, 'el campo está deshabilitado');
    return false;
  }
  if (estado.soloLectura) {
    diario.problema(etiqueta, 'el campo es de sólo lectura');
    return false;
  }

  try {
    await locator.scrollIntoViewIfNeeded();

    if (estado.tipo === 'date') {
      /* Los campos de fecha de Chromium se editan por segmentos (día, mes,
         año) y no aceptan una cadena ISO tecleada de corrido. */
      await locator.fill(String(valor));
    } else {
      await locator.click();
      await locator.press('Control+a');
      await locator.press('Delete');
      await locator.pressSequentially(String(valor), { delay: DEMORA_TECLA });
    }

    await locator.dispatchEvent('change');
    await locator.blur().catch(function () { /* el foco pudo moverse solo */ });
  } catch (error) {
    diario.problema(etiqueta, 'no fue posible escribir', String(error.message).split('\n')[0]);
    return false;
  }

  /* El campo puede rechazar o transformar lo escrito (maxlength, filtros de
     entrada, normalizadores). Se comprueba lo que quedó, no lo que se pidió. */
  const quedo = await locator.inputValue();
  if (quedo !== String(valor)) {
    diario.problema(etiqueta, 'el campo no conservó el valor escrito',
      'se escribió "' + valor + '" y quedó "' + quedo + '"');
    return false;
  }

  diario.ok(etiqueta, valor);
  return true;
}

/**
 * Busca un procedimiento CUPS / NoCUPS y lo elige de la lista (ítems 114, 124
 * y 136a).
 *
 * No vale con escribir el código y ya: lo que hay que comprobar es que al
 * teclear se consulte la tabla y que lo que ofrece contenga el procedimiento.
 * Se teclea, se espera a que aparezca la opción y se hace clic en ella, que es
 * lo que hace una persona.
 */
async function buscarCups(page, diario, campo, codigo, etiqueta) {
  etiqueta = etiqueta || campo;
  const entrada = page.locator(aSelector(campo)).first();

  if (await entrada.count() === 0) {
    diario.problema(etiqueta, 'el campo de búsqueda de CUPS no existe en el formulario');
    return false;
  }

  const combo = entrada.locator('xpath=ancestor::*[@data-rol="comboCups"][1]');
  const opcion = combo.locator('.combo-cups__opcion[data-codigo="' + codigo + '"]');

  try {
    await entrada.scrollIntoViewIfNeeded();
    await entrada.click();
    await entrada.press('Control+a');
    await entrada.press('Delete');
    await entrada.pressSequentially(String(codigo), { delay: DEMORA_TECLA });

    /* El buscador espera a que se deje de teclear y luego consulta: la opción
       no puede estar antes de que el servidor conteste. */
    await opcion.waitFor({ state: 'visible', timeout: 10000 });
    await opcion.click();
  } catch (error) {
    const ofrecidos = await combo.locator('.combo-cups__opcion').evaluateAll(function (nodos) {
      return nodos.map(function (n) { return n.dataset.codigo; });
    }).catch(function () { return []; });

    diario.problema(etiqueta, 'la búsqueda no ofreció el código "' + codigo + '"',
      ofrecidos.length > 0 ? 'ofreció: ' + ofrecidos.join(', ') : String(error.message).split('\n')[0]);
    return false;
  }

  const quedo = await entrada.inputValue();
  if (quedo !== String(codigo)) {
    diario.problema(etiqueta, 'elegir de la lista no dejó el código en el campo',
      'se eligió "' + codigo + '" y quedó "' + quedo + '"');
    return false;
  }

  /* El nombre bajo el campo es la confirmación que ve el profesional. */
  const nombre = await combo.locator('.combo-cups__nombre').textContent().catch(function () { return ''; });
  diario.ok(etiqueta, codigo + (nombre ? ' — ' + nombre.trim() : ''));
  return true;
}

/** Elige una opción de un `<select>`. */
async function elegir(page, diario, campo, valor, etiqueta, opciones) {
  etiqueta = etiqueta || campo;
  opciones = opciones || {};
  const locator = page.locator(aSelector(campo)).first();

  if (await locator.count() === 0) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'la lista no está presente'); return false; }
    diario.problema(etiqueta, 'la lista desplegable no existe en el formulario');
    return false;
  }

  const estado = await inspeccionar(locator);

  if (estado.oculto) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'lista condicionada, oculta'); return false; }
    diario.problema(etiqueta, motivoOculto(estado));
    return false;
  }
  if (estado.deshabilitado) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'lista deshabilitada'); return false; }
    diario.problema(etiqueta, 'la lista está deshabilitada');
    return false;
  }
  /* Una lista con una sola opción no está rota si esa opción es la que se
     busca: hay catálogos con un único valor vigente (la UZPE del despliegue,
     el departamento, el municipio). Vacía de verdad es no tener ninguna. */
  if (!estado.opciones || estado.opciones.length === 0) {
    diario.problema(etiqueta, 'la lista llegó vacía (no se pobló desde el catálogo)');
    return false;
  }
  if (estado.opciones.indexOf(String(valor)) === -1) {
    diario.problema(etiqueta, 'la lista no ofrece el valor "' + valor + '"',
      'ofrece: ' + estado.opciones.filter(Boolean).slice(0, 12).join(', ') +
      (estado.opciones.length > 12 ? ' …(' + estado.opciones.length + ' en total)' : ''));
    return false;
  }

  try {
    await locator.scrollIntoViewIfNeeded();
    await locator.selectOption(String(valor));
  } catch (error) {
    diario.problema(etiqueta, 'no fue posible seleccionar', String(error.message).split('\n')[0]);
    return false;
  }

  diario.ok(etiqueta, valor);
  return true;
}

/** Marca una o varias opciones de un grupo de radios o casillas. */
async function marcar(page, diario, nombre, valores, etiqueta, opciones) {
  etiqueta = etiqueta || nombre;
  opciones = opciones || {};
  const lista = Array.isArray(valores) ? valores : [valores];
  const grupo = page.locator('[name="' + nombre + '"]');

  if (await grupo.count() === 0) {
    if (opciones.opcional) { diario.noAplica(etiqueta, 'el grupo no está presente'); return false; }
    diario.problema(etiqueta, 'el grupo de opciones no existe en el formulario');
    return false;
  }

  const disponibles = await grupo.evaluateAll(function (els) {
    return els.map(function (el) { return el.value; });
  });

  let todas = true;

  for (const valor of lista) {
    const opcion = page.locator('[name="' + nombre + '"][value="' + valor + '"]');

    if (await opcion.count() === 0) {
      diario.problema(etiqueta + ' = ' + valor, 'el grupo no ofrece esa opción',
        'ofrece: ' + disponibles.slice(0, 12).join(', ') +
        (disponibles.length > 12 ? ' …(' + disponibles.length + ' en total)' : ''));
      todas = false;
      continue;
    }

    const estado = await inspeccionar(opcion.first());
    if (estado.oculto) {
      if (opciones.opcional) { diario.noAplica(etiqueta, 'grupo condicionado, oculto'); return false; }
      diario.problema(etiqueta + ' = ' + valor, motivoOculto(estado));
      todas = false;
      continue;
    }
    if (estado.deshabilitado) {
      if (opciones.opcional) { diario.noAplica(etiqueta, 'grupo deshabilitado'); return false; }
      diario.problema(etiqueta + ' = ' + valor, 'la opción está deshabilitada');
      todas = false;
      continue;
    }

    try {
      await opcion.first().scrollIntoViewIfNeeded();
      await opcion.first().check();
    } catch (error) {
      /* El caso interesante: la opción existe pero algo la tapa. Sobre
         JSDOM esto es invisible; aquí es justo el fallo que se busca. */
      diario.problema(etiqueta + ' = ' + valor, 'no fue posible marcarla',
        String(error.message).split('\n')[0]);
      todas = false;
      continue;
    }

    diario.ok(etiqueta, valor);
  }

  return todas;
}

/* ---------------------------------------------------------
   5. LECTURA DE LO QUE LA APLICACIÓN RESPONDE
   --------------------------------------------------------- */

/** Avisos flotantes (`mostrarNotificacion`). */
async function leerAvisos(page) {
  return page.locator('#toastContainer .toast').evaluateAll(function (els) {
    return els.map(function (el) {
      const clase = el.className || '';
      const tipo = (clase.match(/toast--(\w+)/) || [])[1] || 'info';
      return { tipo: tipo, texto: (el.textContent || '').trim() };
    });
  });
}

/** Errores pintados junto a cada campo (`marcarIncumplimiento`). */
async function leerErroresDeCampo(page) {
  return page.locator('#encuestaForm .field.has-error').evaluateAll(function (els) {
    return els.map(function (el) {
      const mensaje = el.querySelector('.field-error-msg');
      return {
        campo: el.getAttribute('data-campo') || '(sin data-campo)',
        mensaje: mensaje ? mensaje.textContent.trim() : '(sin mensaje)'
      };
    });
  });
}

/** Impedimentos de cierre (`renderizarImpedimentos`, RN-222). */
async function leerImpedimentos(page) {
  return page.locator('#listaImpedimentos .alerta-item').evaluateAll(function (els) {
    return els.map(function (el) {
      const titulo = el.querySelector('.alerta-item__titulo');
      const pies = Array.from(el.querySelectorAll('.pill-meta'))
        .map(function (p) { return p.textContent.trim(); });
      return { mensaje: titulo ? titulo.textContent.trim() : '', pies: pies };
    });
  });
}

/** Alertas calculadas (`renderizarAlertas`, RN-200 y siguientes). */
async function leerAlertas(page) {
  return page.locator('#listaAlertas .alerta-item').evaluateAll(function (els) {
    return els.map(function (el) {
      const titulo = el.querySelector('.alerta-item__titulo');
      const pies = Array.from(el.querySelectorAll('.pill-meta'))
        .map(function (p) { return p.textContent.trim(); });
      return { titulo: titulo ? titulo.textContent.trim() : '', pies: pies };
    });
  });
}

/* ---------------------------------------------------------
   6. INFORME FINAL
   --------------------------------------------------------- */

function imprimirInforme(diario) {
  const linea = '='.repeat(74);

  console.log('\n' + linea);
  console.log('  INFORME DEL DILIGENCIAMIENTO');
  console.log(linea);
  console.log('  Campos diligenciados con éxito : ' + diario.diligenciados);
  console.log('  Campos que no aplicaban         : ' + diario.omitidosPorEdad.length +
    '  (condicionados por edad o sexo)');
  console.log('  Campos que no se pudieron llenar: ' + diario.omitidos);
  console.log('  Errores del navegador           : ' + diario.consola.length);
  console.log('  Peticiones fallidas de la app   : ' + diario.peticiones.length);
  console.log('  Servicios externos caídos       : ' + diario.externas.length + '  (informativo)');

  if (diario.problemas.length > 0) {
    console.log('\n  ── PROBLEMAS AL DILIGENCIAR ' + '─'.repeat(45));
    diario.problemas.forEach(function (p, i) {
      console.log('  ' + String(i + 1).padStart(2) + '. [' + p.zona + '] ' + p.etiqueta);
      console.log('      ' + p.motivo);
      if (p.detalle) console.log('      ' + p.detalle);
    });
  }

  if (diario.omitidosPorEdad.length > 0) {
    console.log('\n  ── CAMPOS QUE EL FORMULARIO OCULTÓ POR NO APLICAR ' + '─'.repeat(24));
    diario.omitidosPorEdad.forEach(function (o, i) {
      console.log('  ' + String(i + 1).padStart(2) + '. [' + o.zona + '] ' + o.etiqueta +
        '  (' + o.motivo + ')');
    });
  }

  if (diario.consola.length > 0) {
    console.log('\n  ── ERRORES DEL NAVEGADOR ' + '─'.repeat(48));
    diario.consola.forEach(function (c, i) {
      console.log('  ' + String(i + 1).padStart(2) + '. [' + c.zona + '] ' + c.tipo + ': ' + c.texto);
      if (c.pila) console.log('      ' + c.pila.replace(/\n/g, '\n      '));
    });
  }

  if (diario.peticiones.length > 0) {
    console.log('\n  ── PETICIONES FALLIDAS DE LA APLICACIÓN ' + '─'.repeat(33));
    diario.peticiones.forEach(function (r, i) {
      console.log('  ' + String(i + 1).padStart(2) + '. [' + r.zona + '] ' + r.estado + '  ' + r.url);
      if (r.detalle) console.log('      ' + r.detalle);
    });
  }

  if (diario.externas.length > 0) {
    console.log('\n  ── SERVICIOS EXTERNOS QUE NO RESPONDIERON (informativo) ' + '─'.repeat(17));
    diario.externas.forEach(function (r, i) {
      console.log('  ' + String(i + 1).padStart(2) + '. [' + r.zona + '] ' + r.estado + '  ' +
        r.url.slice(0, 110));
      if (r.detalle) console.log('      ' + r.detalle);
    });
  }

  console.log('\n' + linea + '\n');
}

module.exports = {
  crearDiario: crearDiario,
  vigilar: vigilar,
  anunciar: anunciar,
  escribir: escribir,
  elegir: elegir,
  buscarCups: buscarCups,
  marcar: marcar,
  leerAvisos: leerAvisos,
  leerErroresDeCampo: leerErroresDeCampo,
  leerImpedimentos: leerImpedimentos,
  leerAlertas: leerAlertas,
  imprimirInforme: imprimirInforme
};
