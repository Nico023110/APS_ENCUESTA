/* =========================================================
   Encuesta_APS — Reportes de productividad (vista «Productividad»)
   ---------------------------------------------------------
   Para la coordinación del EBS (la coordinadora y los líderes de zona), el
   administrador y el maestro: «productividad.ver». Es una de las vistas del
   apartado «Reportes» y se abre desde su menú lateral (tableros.js).

   Pide a /api/productividad las cuentas de un período agrupadas por EBS,
   comuna, territorio, barrio, persona o fecha, con filtros de EBS, comuna y
   persona, y pinta:
     - las cifras del período (fichas, viviendas, hogares, familias,
       personas, días con actividad, promedio por día, plan pendiente);
     - las fichas por día (o por semana, si el período es largo);
     - la tabla del agrupamiento, ordenable, con quienes no tienen fichas en
       cero y apagados;
   y descarga lo mismo como CSV para Excel.

   Todo lo que viene del servidor se pinta con textContent.
   ========================================================= */

(function () {
  'use strict';

  if (typeof SESION === 'undefined') return;

  const $ = function (id) { return document.getElementById(id); };
  const PERMISO = 'productividad.ver';
  /* Más días que esto y el gráfico pasa a semanas: barras de un día en un
     año no se leen. */
  const MAX_DIAS_POR_DIA = 62;

  const AGRUPACIONES = {
    ebs: 'EBS', comuna: 'Comuna', territorio: 'Territorio', barrio: 'Barrio',
    persona: 'Persona', dia: 'Día', semana: 'Semana', mes: 'Mes'
  };
  const POR_FECHA = ['dia', 'semana', 'mes'];

  /* Columnas de la tabla y del CSV, en orden. */
  const COLUMNAS = [
    { clave: 'fichas', titulo: 'Fichas' },
    { clave: 'viviendas', titulo: 'Viviendas' },
    { clave: 'hogares', titulo: 'Hogares' },
    { clave: 'familias', titulo: 'Familias' },
    { clave: 'personas', titulo: 'Personas' },
    { clave: 'planPendiente', titulo: 'Plan pendiente' },
    { clave: 'incompletas', titulo: 'Incompletas' },
    { clave: 'diasActivos', titulo: 'Días con fichas' },
    { clave: 'promedio', titulo: 'Fichas por día' },
    { clave: 'ultima', titulo: 'Última ficha' }
  ];

  let ultimo = null;
  let orden = null;
  /* Lo escrito en el buscador de la tabla: se conserva al reordenar y al
     cambiar los filtros. */
  let busquedaTabla = '';

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */

  function elemento(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function fechaIso(fecha) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
      String(fecha.getDate()).padStart(2, '0');
  }

  function deIso(texto) {
    const p = String(texto || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function cantidad(n) {
    return typeof formatearCantidad === 'function' ? formatearCantidad(n) : String(n);
  }

  function decimal(n) {
    return n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function fechaCorta(iso, conAnio) {
    if (!iso) return '—';
    const opciones = { day: 'numeric', month: 'short' };
    if (conAnio) opciones.year = 'numeric';
    return deIso(iso).toLocaleDateString('es-CO', opciones);
  }

  function nombreMes(iso) {
    const texto = deIso(iso + '-01').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  /* Períodos de un toque. La semana empieza el lunes. */
  function periodoRapido(cual) {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    if (cual === 'hoy') return { desde: fechaIso(hoy), hasta: fechaIso(hoy) };
    if (cual === 'semana') {
      const lunes = new Date(y, m, hoy.getDate() - ((hoy.getDay() + 6) % 7));
      return { desde: fechaIso(lunes), hasta: fechaIso(hoy) };
    }
    if (cual === 'mes-anterior') return { desde: fechaIso(new Date(y, m - 1, 1)), hasta: fechaIso(new Date(y, m, 0)) };
    return { desde: fechaIso(new Date(y, m, 1)), hasta: fechaIso(hoy) };
  }

  function mostrarError(texto) {
    $('productividadError').textContent = texto;
    $('productividadError').hidden = !texto;
  }

  function ocupado(activo) {
    ['btnProductividadGenerar', 'btnProductividadDescargar'].forEach(function (id) { $(id).disabled = activo; });
    $('formProductividad').setAttribute('aria-busy', activo ? 'true' : 'false');
    $('productividadResultado').classList.toggle('is-actualizando', activo);
  }

  function filtros() {
    return {
      desde: $('productividadDesde').value,
      hasta: $('productividadHasta').value,
      agrupar: $('productividadAgrupar').value,
      ebs: $('productividadEbs').value,
      comuna: $('productividadComuna').value,
      persona: $('productividadPersona').value
    };
  }

  function validar(f) {
    if (!f.desde || !f.hasta) return 'Indique las dos fechas del período.';
    if (f.desde > f.hasta) return 'La fecha inicial es posterior a la final.';
    return null;
  }

  /* Cómo se nombra un grupo de fecha. */
  function etiquetaDeGrupo(fila, agrupar) {
    if (agrupar === 'dia') return fechaCorta(fila.clave, true);
    if (agrupar === 'semana') return 'Semana del ' + fechaCorta(fila.clave, true);
    if (agrupar === 'mes') return nombreMes(fila.clave);
    return fila.etiqueta;
  }

  function promedio(fila) {
    return fila.diasActivos > 0 ? fila.fichas / fila.diasActivos : 0;
  }

  /* ---------------------------------------------------------
     Búsqueda por texto: sin mayúsculas ni tildes, y cada palabra escrita
     debe aparecer («ana ebs007» encuentra «Ana Pérez — … · EBS007»).
     --------------------------------------------------------- */

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function coincide(texto, consulta) {
    const t = normalizar(texto);
    return normalizar(consulta).split(/\s+/).filter(Boolean).every(function (palabra) { return t.indexOf(palabra) !== -1; });
  }

  /* ---------------------------------------------------------
     Filtros con búsqueda
     ---------------------------------------------------------
     Cada <select> sigue siendo el valor real —lo que se envía y lo que se
     restaura—, oculto. Encima va un campo que filtra sus opciones mientras
     se escribe: flechas para moverse, Enter para elegir, Escape para dejar
     lo que estaba, y una «x» para quitar el filtro. Reusa el aspecto de la
     lista del buscador de CUPS (combo-cups). */

  const combos = new Map();

  function crearCombo(select) {
    const campo = select.closest('.field');
    const etiqueta = campo && campo.querySelector('label[for="' + select.id + '"]');
    const contenedor = elemento('div', 'combo-cups combo-filtro');
    const entrada = elemento('input', 'combo-filtro__entrada');
    entrada.type = 'text';
    entrada.id = select.id + 'Buscar';
    entrada.autocomplete = 'off';
    entrada.spellcheck = false;
    entrada.setAttribute('role', 'combobox');
    entrada.setAttribute('aria-autocomplete', 'list');
    entrada.setAttribute('aria-expanded', 'false');
    const lista = elemento('ul', 'combo-cups__lista combo-filtro__lista');
    lista.id = select.id + 'Lista';
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;
    entrada.setAttribute('aria-controls', lista.id);
    const limpiar = elemento('button', 'combo-filtro__limpiar');
    limpiar.type = 'button';
    limpiar.setAttribute('aria-label', 'Quitar el filtro' + (etiqueta ? ' de ' + etiqueta.textContent.toLowerCase() : ''));
    limpiar.appendChild(elemento('i', 'ph ph-x')).setAttribute('aria-hidden', 'true');
    /* Sin filtro elegido, la flecha dice que es una lista; con filtro, la
       «x» ocupa su lugar. */
    const flecha = elemento('i', 'ph ph-caret-down combo-filtro__flecha');
    flecha.setAttribute('aria-hidden', 'true');
    contenedor.appendChild(entrada);
    contenedor.appendChild(flecha);
    contenedor.appendChild(limpiar);
    contenedor.appendChild(lista);
    select.parentNode.insertBefore(contenedor, select);
    select.hidden = true;
    select.tabIndex = -1;
    if (etiqueta) etiqueta.htmlFor = entrada.id;

    let visibles = [];
    let activa = -1;

    const opcionTodos = function () { return select.querySelector('option[value=""]'); };

    function sincronizar() {
      const elegida = select.options[select.selectedIndex];
      entrada.value = elegida && (elegida.value || !opcionTodos()) ? elegida.textContent : '';
      entrada.placeholder = opcionTodos() ? opcionTodos().textContent : '';
      limpiar.hidden = !select.value || !opcionTodos();
      flecha.hidden = !limpiar.hidden;
    }

    function marcar(i) {
      activa = i;
      Array.from(lista.children).forEach(function (li, j) {
        li.classList.toggle('combo-cups__opcion--activa', j === i);
      });
      const li = lista.children[i];
      if (li && li.id) {
        entrada.setAttribute('aria-activedescendant', li.id);
        if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
      } else {
        entrada.removeAttribute('aria-activedescendant');
      }
    }

    function pintarLista(consulta) {
      visibles = Array.from(select.options).filter(function (o) { return !consulta || coincide(o.textContent, consulta); });
      lista.innerHTML = '';
      if (visibles.length === 0) {
        lista.appendChild(elemento('li', 'combo-cups__aviso', 'Nada coincide con «' + consulta + '».'));
      }
      visibles.forEach(function (opcion, i) {
        const li = elemento('li', 'combo-cups__opcion combo-filtro__opcion' + (opcion.value ? '' : ' combo-filtro__todos'),
          opcion.textContent);
        li.id = lista.id + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', opcion.value === select.value ? 'true' : 'false');
        /* mousedown y no click: el campo no pierde el foco antes de elegir. */
        li.addEventListener('mousedown', function (evento) { evento.preventDefault(); elegir(opcion); });
        lista.appendChild(li);
      });
      marcar(consulta ? (visibles.length ? 0 : -1) : visibles.findIndex(function (o) { return o.value === select.value; }));
    }

    function abrir(consulta) {
      pintarLista(consulta);
      lista.hidden = false;
      entrada.setAttribute('aria-expanded', 'true');
    }

    function cerrar() {
      lista.hidden = true;
      entrada.setAttribute('aria-expanded', 'false');
      entrada.removeAttribute('aria-activedescendant');
    }

    function elegir(opcion) {
      const cambio = select.value !== opcion.value;
      select.value = opcion.value;
      cerrar();
      sincronizar();
      if (cambio) select.dispatchEvent(new Event('change'));
    }

    entrada.addEventListener('focus', function () { entrada.select(); abrir(''); });
    entrada.addEventListener('input', function () { abrir(entrada.value); });
    entrada.addEventListener('blur', function () { cerrar(); sincronizar(); });
    entrada.addEventListener('keydown', function (evento) {
      if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
        evento.preventDefault();
        if (lista.hidden) { abrir(''); return; }
        const paso = evento.key === 'ArrowDown' ? 1 : -1;
        marcar(Math.max(0, Math.min(visibles.length - 1, activa + paso)));
      } else if (evento.key === 'Enter') {
        /* Enter elige; no envía el formulario. */
        evento.preventDefault();
        if (!lista.hidden && visibles[activa]) elegir(visibles[activa]);
      } else if (evento.key === 'Escape' && !lista.hidden) {
        evento.preventDefault();
        cerrar();
        sincronizar();
      }
    });
    limpiar.addEventListener('click', function () {
      if (opcionTodos()) elegir(opcionTodos());
      entrada.focus();
    });
    /* Si el valor cambia por código (al restaurar o al repintar las
       opciones), el texto lo sigue. */
    select.addEventListener('change', sincronizar);

    combos.set(select.id, { sincronizar: sincronizar });
    sincronizar();
    /* Quien lo crea (también los tableros, tableros.js) lo resincroniza
       cuando cambia las opciones o el valor por código. */
    return sincronizar;
  }

  /* ---------------------------------------------------------
     Filtros que dependen de lo que hay en el período
     --------------------------------------------------------- */

  function llenarSelect(select, opciones, todos) {
    const actual = select.value;
    const textoActual = select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : actual;
    select.innerHTML = '';
    select.appendChild(elemento('option', null, todos)).value = '';
    opciones.forEach(function (o) {
      const opcion = elemento('option', null, o.detalle ? o.etiqueta + ' — ' + o.detalle : o.etiqueta);
      opcion.value = o.valor;
      select.appendChild(opcion);
    });
    /* Conserva lo elegido aunque en este período no aparezca. */
    if (actual && !opciones.some(function (o) { return o.valor === actual; })) {
      const opcion = elemento('option', null, textoActual);
      opcion.value = actual;
      select.appendChild(opcion);
    }
    select.value = actual;
    if (combos.has(select.id)) combos.get(select.id).sincronizar();
  }

  function pintarOpciones(op) {
    llenarSelect($('productividadEbs'), op.ebs.map(function (c) { return { valor: c, etiqueta: c }; }), 'Todos los EBS');
    llenarSelect($('productividadComuna'), op.comunas, 'Todas las comunas');
    llenarSelect($('productividadPersona'), op.personas, 'Todo el personal');
  }

  /* ---------------------------------------------------------
     Cifras del período
     --------------------------------------------------------- */

  function cifra(valor, etiqueta, apagada) {
    const caja = elemento('div', 'reporte__cifra' + (apagada ? ' is-cero' : ''));
    caja.appendChild(elemento('span', 'reporte__cifra-valor', valor));
    caja.appendChild(elemento('span', 'reporte__cifra-etiqueta', etiqueta));
    return caja;
  }

  function pintarCifras(destino, t) {
    const cifras = elemento('div', 'reporte__cifras');
    const prom = t.diasActivos > 0 ? t.fichas / t.diasActivos : 0;
    const segun = function (n, uno, varios) { return n === 1 ? uno : varios; };
    [
      [cantidad(t.fichas), segun(t.fichas, 'ficha', 'fichas'), t.fichas === 0],
      [cantidad(t.viviendas), segun(t.viviendas, 'vivienda', 'viviendas'), t.viviendas === 0],
      [cantidad(t.hogares), segun(t.hogares, 'hogar', 'hogares'), t.hogares === 0],
      [cantidad(t.familias), segun(t.familias, 'familia', 'familias'), t.familias === 0],
      [cantidad(t.personas), segun(t.personas, 'persona', 'personas'), t.personas === 0],
      [cantidad(t.diasActivos), segun(t.diasActivos, 'día con fichas', 'días con fichas'), t.diasActivos === 0],
      [decimal(prom), 'fichas por día con actividad', prom === 0],
      [cantidad(t.planPendiente), 'con plan de cuidado pendiente', t.planPendiente === 0]
    ].forEach(function (c) { cifras.appendChild(cifra(c[0], c[1], c[2])); });
    destino.appendChild(cifras);

    const notas = [];
    if (t.incompletas) notas.push(cantidad(t.incompletas) + ' visitas cerradas como incompletas');
    if (t.sinConsentimiento) notas.push(cantidad(t.sinConsentimiento) + ' sin consentimiento');
    if (t.integrantesPendientes) notas.push(cantidad(t.integrantesPendientes) + ' integrantes declarados por completar');
    if (notas.length) destino.appendChild(elemento('p', 'field-hint productividad__notas', 'Además: ' + notas.join(' · ') + '.'));
  }

  /* ---------------------------------------------------------
     Gráfico: fichas por día (o por semana)
     --------------------------------------------------------- */

  function serieDelPeriodo(datos) {
    const conteo = new Map(datos.porDia.map(function (d) { return [d.fecha, d.fichas]; }));
    const desde = deIso(datos.periodo.desde);
    const hasta = deIso(datos.periodo.hasta);
    const dias = Math.round((hasta - desde) / 86400000) + 1;
    const porSemana = dias > MAX_DIAS_POR_DIA;
    const serie = [];
    const cursor = new Date(desde);
    while (cursor <= hasta) {
      const iso = fechaIso(cursor);
      const valor = conteo.get(iso) || 0;
      if (porSemana) {
        const lunes = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - ((cursor.getDay() + 6) % 7));
        const clave = fechaIso(lunes);
        const ultimaSemana = serie[serie.length - 1];
        if (ultimaSemana && ultimaSemana.clave === clave) ultimaSemana.valor += valor;
        else serie.push({ clave: clave, valor: valor, texto: 'Semana del ' + fechaCorta(clave, true) });
      } else {
        serie.push({ clave: iso, valor: valor, texto: fechaCorta(iso, true) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { serie: serie, porSemana: porSemana };
  }

  function topeRedondo(maximo) {
    if (maximo <= 4) return Math.max(maximo, 1);
    const paso = Math.pow(10, Math.floor(Math.log10(maximo)));
    return Math.ceil(maximo / (paso / 2)) * (paso / 2);
  }

  function pintarGrafico(destino, datos) {
    const { serie, porSemana } = serieDelPeriodo(datos);
    const bloque = elemento('section', 'productividad__bloque');
    bloque.appendChild(elemento('h3', 'reporte__subtitulo', porSemana ? 'Fichas por semana' : 'Fichas por día'));

    const maximo = serie.reduce(function (m, p) { return Math.max(m, p.valor); }, 0);
    if (maximo === 0) {
      bloque.appendChild(elemento('p', 'productividad__vacio', 'No hay fichas diligenciadas en este período.'));
      destino.appendChild(bloque);
      return;
    }

    const tope = topeRedondo(maximo);
    const NS = 'http://www.w3.org/2000/svg';
    const ancho = 720;
    const alto = 168;
    const margenIzq = 30;
    const margenInf = 22;
    const area = ancho - margenIzq;
    const ranura = area / serie.length;
    /* Barras finas: hasta 24 px, con el resto de la ranura como aire; 2 px de
       separación mínima entre vecinas. */
    const grosor = Math.max(1, Math.min(24, ranura - 2));
    const escala = (alto - margenInf - 8) / tope;

    const contenedor = elemento('div', 'productividad__grafico');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', (porSemana ? 'Fichas por semana' : 'Fichas por día') + '; máximo ' +
      maximo + '. El detalle está en la tabla.');

    const linea = function (y, clase) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', margenIzq); l.setAttribute('x2', ancho);
      l.setAttribute('y1', y); l.setAttribute('y2', y);
      l.setAttribute('class', clase);
      svg.appendChild(l);
    };
    const texto = function (x, y, contenido, ancla) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor', ancla || 'start');
      t.setAttribute('class', 'productividad__eje');
      t.textContent = contenido;
      svg.appendChild(t);
    };

    const base = alto - margenInf;
    linea(base - tope * escala, 'productividad__guia');
    texto(margenIzq - 6, base - tope * escala + 4, String(tope), 'end');
    texto(margenIzq - 6, base + 4, '0', 'end');

    const aviso = elemento('div', 'productividad__tooltip');
    aviso.hidden = true;

    serie.forEach(function (punto, i) {
      const x = margenIzq + i * ranura + (ranura - grosor) / 2;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'productividad__columna');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', punto.texto + ': ' + punto.valor + (punto.valor === 1 ? ' ficha' : ' fichas'));

      /* El blanco del cursor es toda la ranura, no sólo la barra. */
      const zona = document.createElementNS(NS, 'rect');
      zona.setAttribute('x', margenIzq + i * ranura); zona.setAttribute('y', 0);
      zona.setAttribute('width', ranura); zona.setAttribute('height', base);
      zona.setAttribute('class', 'productividad__zona');
      g.appendChild(zona);

      if (punto.valor > 0) {
        const h = Math.max(2, punto.valor * escala);
        const r = Math.min(4, grosor / 2, h);
        const y = base - h;
        const barra = document.createElementNS(NS, 'path');
        /* Punta redondeada de 4 px, cuadrada en la base. */
        barra.setAttribute('d', 'M' + x + ',' + base + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
          'H' + (x + grosor - r) + 'Q' + (x + grosor) + ',' + y + ' ' + (x + grosor) + ',' + (y + r) + 'V' + base + 'Z');
        barra.setAttribute('class', 'productividad__barra');
        g.appendChild(barra);
      }

      const mostrar = function () {
        aviso.textContent = '';
        aviso.appendChild(elemento('strong', null, String(punto.valor)));
        aviso.appendChild(document.createTextNode(punto.valor === 1 ? ' ficha · ' : ' fichas · '));
        aviso.appendChild(document.createTextNode(punto.texto));
        aviso.hidden = false;
        aviso.style.left = ((margenIzq + (i + 0.5) * ranura) / ancho * 100) + '%';
        g.classList.add('is-activa');
      };
      const ocultar = function () { aviso.hidden = true; g.classList.remove('is-activa'); };
      g.addEventListener('mouseenter', mostrar);
      g.addEventListener('focus', mostrar);
      g.addEventListener('mouseleave', ocultar);
      g.addEventListener('blur', ocultar);
      svg.appendChild(g);
    });

    linea(base, 'productividad__base');
    /* Los extremos del eje son los del período, aunque la primera semana
       empiece antes. */
    texto(margenIzq, alto - 6, fechaCorta(datos.periodo.desde, true));
    if (datos.periodo.hasta !== datos.periodo.desde) texto(ancho, alto - 6, fechaCorta(datos.periodo.hasta, true), 'end');

    contenedor.appendChild(svg);
    contenedor.appendChild(aviso);
    bloque.appendChild(contenedor);
    destino.appendChild(bloque);
  }

  /* ---------------------------------------------------------
     Tabla
     --------------------------------------------------------- */

  function valorDe(fila, clave) {
    if (clave === 'promedio') return promedio(fila);
    if (clave === 'ultima') return fila.ultima || '';
    if (clave === 'grupo') return fila.clave || '';
    return fila[clave] || 0;
  }

  function ordenarFilas(filas, agrupar) {
    const o = orden || (POR_FECHA.indexOf(agrupar) !== -1
      ? { clave: 'grupo', asc: true } : { clave: 'fichas', asc: false });
    return filas.slice().sort(function (a, b) {
      let d;
      if (o.clave === 'grupo' && POR_FECHA.indexOf(agrupar) === -1) {
        d = String(a.etiqueta || '').localeCompare(String(b.etiqueta || ''), 'es', { numeric: true });
      } else {
        const va = valorDe(a, o.clave);
        const vb = valorDe(b, o.clave);
        d = va < vb ? -1 : va > vb ? 1 : 0;
      }
      if (d === 0) d = String(a.etiqueta || '').localeCompare(String(b.etiqueta || ''), 'es', { numeric: true });
      return o.asc ? d : -d;
    });
  }

  function pintarTabla(destino, datos) {
    const bloque = elemento('section', 'productividad__bloque');
    const nombreGrupo = AGRUPACIONES[datos.agrupar];
    const cabeceraTabla = elemento('div', 'productividad__cabecera-tabla');
    const titulo = elemento('h3', 'reporte__subtitulo', 'Por ' + (nombreGrupo === 'EBS' ? nombreGrupo : nombreGrupo.toLowerCase()));
    const conCeros = datos.filas.filter(function (f) { return f.fichas === 0; }).length;
    if (conCeros) {
      titulo.appendChild(elemento('span', 'productividad__ceros',
        cantidad(conCeros) + ' sin fichas en el período'));
    }
    cabeceraTabla.appendChild(titulo);
    bloque.appendChild(cabeceraTabla);

    if (datos.filas.length === 0) {
      bloque.appendChild(elemento('p', 'productividad__vacio', 'No hay nada que mostrar con estos filtros.'));
      destino.appendChild(bloque);
      return;
    }

    const filas = ordenarFilas(datos.filas, datos.agrupar);
    const maximo = filas.reduce(function (m, f) { return Math.max(m, f.fichas); }, 0) || 1;
    const o = orden || {};

    const envoltura = elemento('div', 'table-wrapper');
    const tabla = elemento('table', 'data-table productividad__tabla');
    const thead = elemento('thead');
    const cabecera = elemento('tr');
    [{ clave: 'grupo', titulo: AGRUPACIONES[datos.agrupar] }].concat(COLUMNAS).forEach(function (col) {
      const th = elemento('th');
      th.setAttribute('scope', 'col');
      if (col.clave !== 'grupo') th.className = 'productividad__num';
      const boton = elemento('button', 'productividad__orden', col.titulo);
      boton.type = 'button';
      if (o.clave === col.clave) {
        th.setAttribute('aria-sort', o.asc ? 'ascending' : 'descending');
        boton.appendChild(elemento('i', 'ph ' + (o.asc ? 'ph-caret-up' : 'ph-caret-down')));
      }
      boton.addEventListener('click', function () {
        orden = { clave: col.clave, asc: o.clave === col.clave ? !o.asc : col.clave === 'grupo' };
        pintar(ultimo);
      });
      th.appendChild(boton);
      cabecera.appendChild(th);
    });
    thead.appendChild(cabecera);
    tabla.appendChild(thead);

    const cuerpo = elemento('tbody');
    filas.forEach(function (f) {
      const tr = elemento('tr', f.fichas === 0 ? 'is-cero' : null);
      /* Lo que encuentra el buscador de la tabla: el nombre del grupo, su
         detalle (rol y EBS de una persona, comuna de un territorio) y su
         clave (la fecha AAAA-MM-DD de un día, el código de un EBS). */
      tr.dataset.texto = [etiquetaDeGrupo(f, datos.agrupar), f.detalle, f.clave].filter(Boolean).join(' ');
      const grupo = elemento('th', 'productividad__grupo');
      grupo.setAttribute('scope', 'row');
      grupo.appendChild(elemento('span', 'productividad__nombre', etiquetaDeGrupo(f, datos.agrupar)));
      if (f.detalle) grupo.appendChild(elemento('span', 'productividad__detalle', f.detalle));
      tr.appendChild(grupo);

      COLUMNAS.forEach(function (col) {
        const td = elemento('td', 'productividad__num');
        if (col.clave === 'fichas') {
          td.className += ' productividad__fichas';
          td.appendChild(elemento('span', null, cantidad(f.fichas)));
          const carril = elemento('span', 'productividad__carril');
          carril.setAttribute('aria-hidden', 'true');
          const relleno = elemento('span', 'productividad__relleno');
          relleno.style.setProperty('--proporcion', (f.fichas / maximo).toFixed(4));
          carril.appendChild(relleno);
          td.appendChild(carril);
        } else if (col.clave === 'promedio') {
          td.textContent = f.diasActivos ? decimal(promedio(f)) : '—';
        } else if (col.clave === 'ultima') {
          td.textContent = f.ultima ? fechaCorta(f.ultima, true) : '—';
        } else {
          td.textContent = cantidad(f[col.clave] || 0);
        }
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
    const sinCoincidencias = elemento('tr', 'productividad__sin-coincidencias');
    const celda = elemento('td');
    celda.colSpan = COLUMNAS.length + 1;
    sinCoincidencias.appendChild(celda);
    sinCoincidencias.hidden = true;
    cuerpo.appendChild(sinCoincidencias);
    tabla.appendChild(cuerpo);
    envoltura.appendChild(tabla);
    bloque.appendChild(envoltura);
    destino.appendChild(bloque);

    /* Buscador de la tabla: oculta las filas que no coinciden mientras se
       escribe, sin volver a pedir nada. Las cifras de arriba y la descarga
       siguen siendo del reporte completo. */
    const buscador = elemento('label', 'productividad__buscador');
    buscador.appendChild(elemento('i', 'ph ph-magnifying-glass')).setAttribute('aria-hidden', 'true');
    const caja = elemento('input');
    caja.type = 'search';
    caja.id = 'productividadBuscarTabla';
    caja.autocomplete = 'off';
    caja.spellcheck = false;
    caja.placeholder = 'Buscar en la tabla…';
    caja.setAttribute('aria-label', 'Buscar en la tabla');
    caja.value = busquedaTabla;
    buscador.appendChild(caja);
    const cuenta = elemento('span', 'productividad__cuenta');
    cuenta.setAttribute('aria-live', 'polite');
    buscador.appendChild(cuenta);
    cabeceraTabla.appendChild(buscador);

    const filasDeDatos = Array.from(cuerpo.querySelectorAll('tr[data-texto]'));
    function filtrarFilas() {
      busquedaTabla = caja.value;
      let vistas = 0;
      filasDeDatos.forEach(function (tr) {
        const visible = !busquedaTabla.trim() || coincide(tr.dataset.texto, busquedaTabla);
        tr.hidden = !visible;
        if (visible) vistas++;
      });
      sinCoincidencias.hidden = vistas > 0;
      celda.textContent = 'Nada en la tabla coincide con «' + busquedaTabla.trim() + '».';
      cuenta.textContent = busquedaTabla.trim() ? cantidad(vistas) + ' de ' + cantidad(filasDeDatos.length) : '';
    }
    caja.addEventListener('input', filtrarFilas);
    filtrarFilas();
  }

  /* ---------------------------------------------------------
     Pintado y pedido
     --------------------------------------------------------- */

  function describirFiltros(datos) {
    const partes = [fechaCorta(datos.periodo.desde, true) + ' a ' + fechaCorta(datos.periodo.hasta, true)];
    const elegido = function (id) {
      const s = $(id);
      return s.value ? s.options[s.selectedIndex].textContent : null;
    };
    ['productividadEbs', 'productividadComuna', 'productividadPersona'].forEach(function (id) {
      const t = elegido(id);
      if (t) partes.push(t);
    });
    return partes.join(' · ');
  }

  function pintar(datos) {
    const destino = $('productividadResultado');
    destino.innerHTML = '';
    destino.appendChild(elemento('p', 'productividad__alcance', describirFiltros(datos)));
    pintarCifras(destino, datos.totales);
    pintarGrafico(destino, datos);
    pintarTabla(destino, datos);
    destino.hidden = false;
    $('btnProductividadDescargar').hidden = false;
  }

  async function generar(evento) {
    if (evento) evento.preventDefault();
    const f = filtros();
    const problema = validar(f);
    if (problema) { mostrarError(problema); return; }
    mostrarError('');
    ocupado(true);
    try {
      const consulta = new URLSearchParams();
      Object.keys(f).forEach(function (k) { if (f[k]) consulta.set(k, f[k]); });
      const respuesta = await fetch('/api/productividad?' + consulta.toString());
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      if (!respuesta.ok) throw new Error(cuerpo.error || 'HTTP ' + respuesta.status);
      if (!ultimo || ultimo.agrupar !== cuerpo.agrupar) orden = null;
      ultimo = cuerpo;
      pintarOpciones(cuerpo.opciones);
      pintar(cuerpo);
    } catch (error) {
      mostrarError('No fue posible generar el reporte: ' + error.message);
    } finally {
      ocupado(false);
    }
  }

  /* ---------------------------------------------------------
     CSV para Excel: «;» como separador (Excel en español lo abre en
     columnas) y BOM para que respete las tildes.
     --------------------------------------------------------- */

  function celdaCsv(valor) {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    /* Una celda que empieza por = + - @ Excel la toma por fórmula. */
    if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
    return /[";\r\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  }

  function descargar() {
    if (!ultimo) return;
    const d = ultimo;
    const lineas = [];
    lineas.push(['Reporte de productividad'].map(celdaCsv).join(';'));
    lineas.push(['Período', d.periodo.desde + ' a ' + d.periodo.hasta].map(celdaCsv).join(';'));
    lineas.push(['Filtros', describirFiltros(d).split(' · ').slice(1).join(' · ') || 'Ninguno'].map(celdaCsv).join(';'));
    lineas.push('');
    const titulos = [AGRUPACIONES[d.agrupar], 'Detalle'].concat(COLUMNAS.map(function (c) { return c.titulo; }))
      .concat(['Sin consentimiento', 'Integrantes por completar', 'Primera ficha']);
    lineas.push(titulos.map(celdaCsv).join(';'));
    const fila = function (nombre, detalle, f) {
      return [nombre, detalle || '', f.fichas, f.viviendas, f.hogares, f.familias, f.personas, f.planPendiente,
        f.incompletas, f.diasActivos, f.diasActivos ? decimal(promedio(f)) : '', f.ultima || '',
        f.sinConsentimiento, f.integrantesPendientes, f.primera || ''].map(celdaCsv).join(';');
    };
    ordenarFilas(d.filas, d.agrupar).forEach(function (f) {
      lineas.push(fila(etiquetaDeGrupo(f, d.agrupar), f.detalle, f));
    });
    lineas.push(fila('Total', '', d.totales));

    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'productividad_' + d.agrupar + '_' + d.periodo.desde + '_' + d.periodo.hasta + '.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------
     Entrada
     --------------------------------------------------------- */

  function fijarPeriodo(cual) {
    const p = periodoRapido(cual);
    $('productividadDesde').value = p.desde;
    $('productividadHasta').value = p.hasta;
    document.querySelectorAll('[data-periodo-rapido]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.periodoRapido === cual ? 'true' : 'false');
    });
  }

  function abrirVista() {
    if (!SESION.puede(PERMISO)) return;
    cambiarVista('productividad');
    /* La primera vez se genera sola, con el mes en curso por EBS. */
    if (!ultimo) generar();
  }

  let iniciado = false;

  document.addEventListener('DOMContentLoaded', function () {
    /* Una sola vez: un segundo DOMContentLoaded duplicaría los oyentes y
       cada cambio de filtro pediría el reporte dos veces. */
    if (iniciado || !SESION.puede(PERMISO) || !$('formProductividad')) return;
    iniciado = true;
    ['productividadAgrupar', 'productividadEbs', 'productividadComuna', 'productividadPersona'].forEach(function (id) {
      crearCombo($(id));
    });
    fijarPeriodo('mes');
    $('formProductividad').addEventListener('submit', generar);
    $('btnProductividadDescargar').addEventListener('click', descargar);
    document.querySelectorAll('[data-periodo-rapido]').forEach(function (boton) {
      boton.addEventListener('click', function () { fijarPeriodo(boton.dataset.periodoRapido); generar(); });
    });
    ['productividadDesde', 'productividadHasta'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        document.querySelectorAll('[data-periodo-rapido]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      });
    });
    /* Agrupar y filtrar responden al cambiar, sin pulsar «Generar». */
    ['productividadAgrupar', 'productividadEbs', 'productividadComuna', 'productividadPersona'].forEach(function (id) {
      $(id).addEventListener('change', function () { generar(); });
    });
  });

  window.PRODUCTIVIDAD = { abrir: abrirVista, crearCombo: crearCombo };
})();
