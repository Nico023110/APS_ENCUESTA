/* =========================================================
   Encuesta_APS — Apartado «Reportes» y tableros de población
   ---------------------------------------------------------
   Para la coordinación del EBS (la coordinadora y los líderes de zona), el
   administrador y el maestro. Se abre desde el menú del chip de usuario
   (sesion.js) con «Reportes».

   El apartado reúne tres vistas bajo un mismo menú lateral (#reportesMenu):
     - Tableros de población (esta vista): Tablero principal, Hogares (tres
       páginas) y Personas (cinco), con la estructura de los tableros SI-APS
       del Ministerio y el aspecto de la aplicación;
     - Productividad (productividad.js);
     - Descargas: el archivo plano SI-APS y las fichas en Excel (reporte.js).

   Los tableros piden a /api/productividad?tablero=1 las cuentas de un
   período —de cada vivienda, su visita más reciente— con filtros de EBS,
   comuna y territorio. Una sola consulta trae todo: cambiar de tablero o de
   página vuelve a pintar sin pedir nada. El servidor manda códigos de
   catálogo y aquí se nombran con catalogos.js, la misma fuente que el
   formulario.

   Cada panel se describe primero como datos (una «especificación») y
   después se pinta; la tabla de cada panel y la descarga para Excel salen
   de la misma especificación, así que las cifras siempre coinciden.

   Todo lo que viene del servidor se pinta con textContent.
   ========================================================= */

(function () {
  'use strict';

  if (typeof SESION === 'undefined') return;

  const $ = function (id) { return document.getElementById(id); };
  const PERMISO = 'productividad.ver';
  const VISTAS_DEL_APARTADO = ['tableros', 'productividad', 'reporte'];
  /* «Todo el registro» empieza con el SI-APS (2024). */
  const INICIO_DEL_REGISTRO = '2024-01-01';

  /* ---------------------------------------------------------
     Utilidades
     --------------------------------------------------------- */

  function elemento(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function icono(nombre) {
    const i = elemento('i', 'ph ' + nombre);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function fechaIso(fecha) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
      String(fecha.getDate()).padStart(2, '0');
  }

  function deIso(texto) {
    const p = String(texto || '').split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function fechaCorta(iso) {
    if (!iso) return '—';
    return deIso(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function cantidad(n) {
    return typeof formatearCantidad === 'function' ? formatearCantidad(n) : String(n);
  }

  /* «45,5 %»: coma decimal y espacio antes del signo, como se escribe en
     Colombia. Sin base no hay porcentaje. */
  function porcentaje(parte, total) {
    if (!total) return '—';
    return (parte / total * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %';
  }

  function segun(n, uno, varios) { return n === 1 ? uno : varios; }

  /* ---------------------------------------------------------
     Catálogos que el instrumento no trae como lista
     --------------------------------------------------------- */

  /* Curso de vida de la Resolución 3280 de 2018, del mayor al menor: así se
     lee una pirámide. */
  const CURSOS_DE_VIDA = [
    { valor: 'vejez', etiqueta: 'Vejez (60 años y más)' },
    { valor: 'adultez', etiqueta: 'Adultez (29 a 59)' },
    { valor: 'juventud', etiqueta: 'Juventud (18 a 28)' },
    { valor: 'adolescencia', etiqueta: 'Adolescencia (12 a 17)' },
    { valor: 'infancia', etiqueta: 'Infancia (6 a 11)' },
    { valor: 'primera_infancia', etiqueta: 'Primera infancia (0 a 5)' }
  ];

  /* Grupos de cinco años, del mayor al menor; el último abierto. */
  const QUINQUENIOS = [];
  for (let edad = 80; edad >= 0; edad -= 5) {
    QUINQUENIOS.push({ valor: String(edad), etiqueta: edad === 80 ? '80 y más' : edad + ' a ' + (edad + 4) });
  }

  /* RN-221: la misma escala y los mismos nombres del semáforo del plan. */
  const RIESGO_FAMILIAR = [
    { valor: 'sin_riesgo', etiqueta: 'Sin riesgo', tono: 'ok' },
    { valor: 'bajo', etiqueta: 'Riesgo bajo', tono: 'bajo' },
    { valor: 'medio', etiqueta: 'Riesgo medio', tono: 'medio' },
    { valor: 'alto', etiqueta: 'Riesgo alto', tono: 'alto' }
  ];

  const INTEGRANTES_FAMILIA = [];
  for (let n = 1; n <= 10; n++) INTEGRANTES_FAMILIA.push({ valor: String(n), etiqueta: n === 10 ? '10 o más' : String(n) });

  /* En la escala de estudios, «Ninguno» es el primer peldaño, no un resto. */
  function nivelesEducativos() {
    return CAT_NIVEL_EDUCATIVO.filter(function (o) { return o.valor === 'ninguno'; })
      .concat(CAT_NIVEL_EDUCATIVO.filter(function (o) { return o.valor !== 'ninguno'; }));
  }

  /* Lo que no es una categoría del dato sino su ausencia: va al final y
     apagado, para que no compita con lo que sí se registró. */
  const RESIDUALES = ['ninguna', 'no_aplica', 'sin_dato', 'sin_discapacidad', 'no_registra'];
  const ETIQUETAS_SUELTAS = { sin_dato: 'Sin dato', no_aplica: 'No aplica', ninguna: 'Ninguna', sin: 'Sin comuna' };

  function esResidual(valor) { return RESIDUALES.indexOf(valor) !== -1; }

  /* Una opción que el catálogo ya no ofrece sólo aparece si tiene datos. */
  function ofrecida(opcion, n) { return opcion.vigente !== false || n > 0; }

  function etiquetaComuna(valor) {
    if (!valor || valor === 'sin') return 'Sin comuna';
    return valor === 'Rural' ? 'Zona rural' : 'Comuna ' + valor;
  }

  /* ---------------------------------------------------------
     De la respuesta a las filas de un panel
     --------------------------------------------------------- */

  function serie(d, dim) { return (d.dimensiones && d.dimensiones[dim]) || []; }

  function total(d, clave) { return (d.totales && d.totales[clave]) || 0; }

  /* Cuenta por valor, sumando los sexos. */
  function conteoPorValor(d, dim, filtro) {
    const conteo = new Map();
    serie(d, dim).forEach(function (f) {
      if (filtro && !filtro(f)) return;
      conteo.set(f.valor, (conteo.get(f.valor) || 0) + f.n);
    });
    return conteo;
  }

  /* Filas con la etiqueta del catálogo. `escala`: la dimensión es una escala
     ordenada (estrato, curso de vida…) y se muestra completa, en su orden y
     con sus ceros; si no, sólo lo registrado, de mayor a menor. Lo residual
     siempre al final. */
  function filasDe(d, dim, lista, opciones) {
    const o = opciones || {};
    const conteo = conteoPorValor(d, dim, o.filtro);
    const filas = [];
    (lista || []).forEach(function (op, i) {
      if (o.excluir && o.excluir.indexOf(op.valor) !== -1) return;
      const n = conteo.get(op.valor) || 0;
      if (!ofrecida(op, n)) return;
      filas.push({ valor: op.valor, etiqueta: op.etiqueta, tono: op.tono, n: n, orden: i });
    });
    conteo.forEach(function (n, valor) {
      if (filas.some(function (f) { return f.valor === valor; })) return;
      if (o.excluir && o.excluir.indexOf(valor) !== -1) return;
      filas.push({ valor: valor, etiqueta: o.nombrar ? o.nombrar(valor) : (ETIQUETAS_SUELTAS[valor] || valor), n: n, orden: 900 });
    });
    const visibles = filas.filter(function (f) { return o.escala ? (f.n > 0 || f.orden < 900) && !(esResidual(f.valor) && f.n === 0) : f.n > 0; });
    visibles.forEach(function (f) { f.apagada = esResidual(f.valor); });
    return visibles.sort(function (a, b) {
      if (a.apagada !== b.apagada) return a.apagada ? 1 : -1;
      if (o.escala) return a.orden - b.orden;
      return b.n - a.n || a.orden - b.orden || String(a.etiqueta).localeCompare(String(b.etiqueta), 'es');
    });
  }

  /* Filas por sexo para las pirámides y los espejos. */
  function filasPorSexo(d, dim, lista, opciones) {
    const o = opciones || {};
    const porValor = new Map();
    serie(d, dim).forEach(function (f) {
      if (o.excluir && o.excluir.indexOf(f.valor) !== -1) return;
      const fila = porValor.get(f.valor) || { hombre: 0, mujer: 0, intersexual: 0 };
      if (f.sexo === 'hombre' || f.sexo === 'mujer' || f.sexo === 'intersexual') fila[f.sexo] += f.n;
      porValor.set(f.valor, fila);
    });
    const filas = [];
    (lista || []).forEach(function (op, i) {
      if (o.excluir && o.excluir.indexOf(op.valor) !== -1) return;
      const c = porValor.get(op.valor) || { hombre: 0, mujer: 0, intersexual: 0 };
      if (!ofrecida(op, c.hombre + c.mujer + c.intersexual)) return;
      filas.push({ valor: op.valor, etiqueta: op.etiqueta, hombre: c.hombre, mujer: c.mujer, intersexual: c.intersexual, orden: i });
    });
    porValor.forEach(function (c, valor) {
      if (filas.some(function (f) { return f.valor === valor; })) return;
      filas.push({ valor: valor, etiqueta: ETIQUETAS_SUELTAS[valor] || valor, hombre: c.hombre, mujer: c.mujer,
        intersexual: c.intersexual, orden: 900 });
    });
    const suma = function (f) { return f.hombre + f.mujer + f.intersexual; };
    const visibles = filas.filter(function (f) { return o.escala ? suma(f) > 0 || f.orden < 900 : suma(f) > 0; });
    visibles.forEach(function (f) { f.apagada = esResidual(f.valor); });
    return visibles.sort(function (a, b) {
      if (a.apagada !== b.apagada) return a.apagada ? 1 : -1;
      if (o.escala) return a.orden - b.orden;
      return suma(b) - suma(a) || a.orden - b.orden;
    });
  }

  function sumaDe(filas) { return filas.reduce(function (s, f) { return s + f.n; }, 0); }

  /* ---------------------------------------------------------
     Los tableros y sus paneles
     ---------------------------------------------------------
     Cada panel: id, ancho (columnas de 12) y construir(d) → especificación
     { tipo, titulo, sub, item, nota, ... } que pinta y tabula lo mismo. */

  const TABLEROS = {
    principal: {
      titulo: 'Tablero principal',
      descripcion: 'La población caracterizada en el período y quiénes requieren atención prioritaria.',
      paginas: [{ id: 'principal', titulo: 'Tablero principal' }]
    },
    hogares: {
      titulo: 'Hogares',
      descripcion: 'Cómo son las familias caracterizadas: su estructura, su funcionalidad, el cuidado y sus prácticas protectoras.',
      paginas: [
        { id: 'estructura', titulo: 'Estructura y contexto' },
        { id: 'desafios', titulo: 'Desafíos de salud' },
        { id: 'practicas', titulo: 'Prácticas protectoras' }
      ]
    },
    personas: {
      titulo: 'Personas',
      descripcion: 'Los integrantes caracterizados: edad y sexo, salud materna, afiliación, condiciones de salud y pertenencia étnica.',
      paginas: [
        { id: 'demografia', titulo: 'Condiciones demográficas' },
        { id: 'materna', titulo: 'Salud materna e infantil' },
        { id: 'cobertura', titulo: 'Cobertura y acceso' },
        { id: 'salud', titulo: 'Hábitos y condiciones de salud' },
        { id: 'etnia', titulo: 'Población étnica' }
      ]
    }
  };

  const PANELES = {
    principal: [
      { id: 'cadena', ancho: 12, construir: function (d) {
        const viviendas = total(d, 'viviendas');
        const hogares = total(d, 'hogares');
        const familias = total(d, 'familias');
        const personas = total(d, 'personas');
        const razon = function (parte, todo, de) {
          const r = typeof formatearRazon === 'function' ? formatearRazon(parte, todo) : null;
          return r ? r + ' por ' + de : '';
        };
        const sinCaracterizar = Math.max(0, total(d, 'hogaresDeclarados') - hogares);
        return {
          tipo: 'cadena', titulo: 'Población caracterizada', sub: 'Según la última visita a cada vivienda',
          niveles: [
            { clave: 'viviendas', etiqueta: 'Viviendas', icono: 'ph-house-line', valor: viviendas, detalle: '' },
            { clave: 'hogares', etiqueta: 'Hogares', icono: 'ph-door-open', valor: hogares, detalle: razon(hogares, viviendas, 'vivienda'),
              aviso: sinCaracterizar ? cantidad(sinCaracterizar) + segun(sinCaracterizar, ' hogar declarado sin caracterizar', ' hogares declarados sin caracterizar') : '' },
            { clave: 'familias', etiqueta: 'Familias', icono: 'ph-users-three', valor: familias, detalle: razon(familias, hogares, 'hogar') },
            { clave: 'personas', etiqueta: 'Personas', icono: 'ph-user', valor: personas, detalle: razon(personas, familias, 'familia') }
          ]
        };
      } },
      { id: 'prioritarios', ancho: 12, construir: function (d) {
        const personas = total(d, 'personas');
        const parte = function (n) { return porcentaje(n, personas) + ' de las personas'; };
        const preguntadas = total(d, 'preguntadasGestacion');
        return {
          tipo: 'tejas', titulo: 'Atención prioritaria', sub: 'Personas de los grupos que el plan de cuidado atiende primero',
          tejas: [
            { etiqueta: 'Gestantes', icono: 'ph-baby-carriage', valor: total(d, 'gestantes'),
              detalle: preguntadas ? 'de ' + cantidad(preguntadas) + segun(preguntadas, ' mujer a quien se preguntó', ' mujeres a quienes se preguntó') : 'nadie respondió la pregunta' },
            { etiqueta: 'Con discapacidad', icono: 'ph-wheelchair', valor: total(d, 'discapacidad'), detalle: parte(total(d, 'discapacidad')) },
            { etiqueta: 'Primera infancia', icono: 'ph-baby', valor: total(d, 'primeraInfancia'), detalle: '0 a 5 años · ' + porcentaje(total(d, 'primeraInfancia'), personas) },
            { etiqueta: 'Personas mayores', icono: 'ph-person-simple-walk', valor: total(d, 'mayores'), detalle: '60 años y más · ' + porcentaje(total(d, 'mayores'), personas) },
            { etiqueta: 'Víctimas del conflicto armado', icono: 'ph-hand-heart', valor: total(d, 'victimas'), detalle: parte(total(d, 'victimas')) }
          ]
        };
      } },
      { id: 'cursoVida', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Personas por curso de vida y sexo', sub: 'Edad cumplida a la fecha de la visita',
          item: '64 y 66', filas: filasPorSexo(d, 'cursoVida', CURSOS_DE_VIDA, { escala: true }) };
      } },
      { id: 'comunas', ancho: 5, construir: function (d) {
        const filas = filasDe(d, 'comuna', [], { nombrar: etiquetaComuna });
        return { tipo: 'barras', titulo: 'Viviendas por comuna', sub: 'Dónde están las viviendas caracterizadas',
          filas: filas, base: total(d, 'viviendas'), unidad: ['vivienda', 'viviendas'] };
      } },
      { id: 'estrato', ancho: 5, construir: function (d) {
        return { tipo: 'columnas', titulo: 'Estrato socioeconómico', sub: 'Viviendas por estrato', item: '27',
          filas: filasDe(d, 'estrato', CAT_ESTRATO, { escala: true }), base: total(d, 'viviendas'), unidad: ['vivienda', 'viviendas'] };
      } },
      { id: 'etnia', ancho: 7, construir: function (d) {
        return { tipo: 'barras', titulo: 'Pertenencia étnica', sub: 'Personas según su autorreconocimiento', item: '79',
          filas: filasDe(d, 'etnia', CAT_PERTENENCIA_ETNICA), base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } },
      { id: 'visita', ancho: 12, construir: function (d) {
        return { tipo: 'medidores', titulo: 'Lo que encontró la visita', sub: 'Proporciones sobre lo caracterizado en el período',
          medidores: [
            { etiqueta: 'Menores de 6 meses con lactancia materna exclusiva', item: '91',
              n: conteoPorValor(d, 'lactancia').get('si') || 0, total: total(d, 'menores6m'), unidad: ['menor de 6 meses', 'menores de 6 meses'] },
            { etiqueta: 'Viviendas con hacinamiento', item: '33',
              n: total(d, 'hacinamiento'), total: total(d, 'viviendas'), unidad: ['vivienda', 'viviendas'] },
            { etiqueta: 'Familias con cuidador principal identificado', item: '52',
              n: total(d, 'conCuidador'), total: total(d, 'familias'), unidad: ['familia', 'familias'] }
          ] };
      } }
    ],

    'hogares/estructura': [
      { id: 'tipoFamilia', ancho: 7, construir: function (d) {
        return { tipo: 'barras', titulo: 'Tipo de familia', sub: 'Familias por su composición', item: '50',
          filas: filasDe(d, 'tipoFamilia', CAT_TIPO_FAMILIA), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'apgar', ancho: 5, construir: function (d) {
        const tonos = { alta: 'ok', moderada: 'aviso', disfuncion: 'alerta' };
        const lista = CAT_APGAR.map(function (o) { return { valor: o.valor, etiqueta: o.etiqueta, tono: tonos[o.valor] }; });
        return { tipo: 'composicion', titulo: 'Funcionalidad familiar', sub: 'Resultado del APGAR familiar', item: 'A2.113',
          filas: filasDe(d, 'apgar', lista, { escala: true }), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'integrantes', ancho: 7, construir: function (d) {
        return { tipo: 'columnas', titulo: 'Personas que conforman la familia', sub: 'Familias según su número de integrantes', item: '51',
          filas: filasDe(d, 'integrantesFamilia', INTEGRANTES_FAMILIA, { escala: true }), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'riesgo', ancho: 5, construir: function (d) {
        return { tipo: 'composicion', titulo: 'Riesgo familiar', sub: 'Clasificación que calcula la ficha con lo registrado',
          filas: filasDe(d, 'riesgoFamiliar', RIESGO_FAMILIAR, { escala: true }), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'agua', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Fuente de agua para consumo humano', sub: 'Viviendas según de dónde toman el agua', item: '46',
          filas: filasDe(d, 'fuenteAgua', CAT_FUENTE_AGUA), base: total(d, 'viviendas'), unidad: ['vivienda', 'viviendas'] };
      } }
    ],

    'hogares/desafios': [
      { id: 'cuidador', ancho: 5, construir: function (d) {
        return { tipo: 'medidores', titulo: 'Cuidador principal', sub: 'Niñas y niños, personas mayores u otros que dependen de alguien',
          medidores: [{ etiqueta: 'Familias con cuidador principal identificado', item: '52',
            n: total(d, 'conCuidador'), total: total(d, 'familias'), unidad: ['familia', 'familias'] }] };
      } },
      { id: 'zarit', ancho: 7, construir: function (d) {
        const tonos = { ausencia: 'ok', ligera: 'aviso', intensa: 'alerta' };
        const lista = CAT_ZARIT.map(function (o) { return { valor: o.valor, etiqueta: o.etiqueta, tono: tonos[o.valor] }; });
        return { tipo: 'composicion', titulo: 'Sobrecarga del cuidador', sub: 'Escala de Zarit, en las familias con cuidador principal', item: '53',
          filas: filasDe(d, 'zarit', lista, { escala: true }), base: total(d, 'conCuidador'), unidad: ['familia', 'familias'] };
      } },
      { id: 'situaciones', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Situaciones o condiciones de riesgo para la salud', sub: 'Familias que las viven; una familia puede marcar varias', item: '54',
          filas: filasDe(d, 'situacionesRiesgo', CAT_SITUACIONES_RIESGO_FAMILIAR), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'redes', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Redes de apoyo social', sub: 'Familias según sus redes para el cuidado de la salud', item: '56',
          filas: filasDe(d, 'redesApoyo', CAT_REDES_APOYO, { escala: true }), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } }
    ],

    'hogares/practicas': [
      { id: 'vinculo', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Prácticas que favorecen los vínculos familiares', sub: 'Familias que las realizan; una familia puede marcar varias', item: '55',
          filas: filasDe(d, 'practicasVinculo', CAT_PRACTICAS_VINCULO), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } },
      { id: 'hogar', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Prácticas para el cuidado de la salud y protección en el hogar', sub: 'Familias que las realizan; una familia puede marcar varias', item: '57',
          filas: filasDe(d, 'practicasHogar', CAT_PRACTICAS_CUIDADO_HOGAR), base: total(d, 'familias'), unidad: ['familia', 'familias'] };
      } }
    ],

    'personas/demografia': [
      { id: 'piramide', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Pirámide poblacional', sub: 'Personas por grupo de edad y sexo', item: '64 y 66',
          filas: filasPorSexo(d, 'quinquenio', QUINQUENIOS, { escala: true }) };
      } },
      { id: 'fertil', ancho: 5, construir: function (d) {
        const grupos = QUINQUENIOS.filter(function (q) { return Number(q.valor) >= 10 && Number(q.valor) <= 50; }).reverse();
        const filas = filasDe(d, 'quinquenio', grupos, { escala: true, filtro: function (f) { return f.sexo === 'mujer'; } });
        return { tipo: 'barras', titulo: 'Mujeres en edad fértil', sub: 'Mujeres de 10 a 54 años por grupo de edad', item: '64 y 66',
          filas: filas, base: sumaDe(filas), unidad: ['mujer', 'mujeres'] };
      } },
      { id: 'educacion', ancho: 12, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Nivel educativo', sub: 'Personas de 5 años o más por nivel alcanzado y sexo', item: '74',
          filas: filasPorSexo(d, 'nivelEducativo', nivelesEducativos(), { escala: true }) };
      } },
      { id: 'discapacidad', ancho: 6, construir: function (d) {
        const sin = conteoPorValor(d, 'discapacidad').get('sin_discapacidad') || 0;
        return { tipo: 'espejo', titulo: 'Discapacidad', sub: 'Personas por tipo de discapacidad y sexo', item: '82',
          filas: filasPorSexo(d, 'discapacidad', CAT_DISCAPACIDAD, { excluir: ['sin_discapacidad'] }),
          nota: sin ? cantidad(sin) + segun(sin, ' persona no se reconoce', ' personas no se reconocen') + ' con discapacidad.' : '' };
      } },
      { id: 'proteccion', ancho: 6, construir: function (d) {
        return { tipo: 'barras', titulo: 'Sujetos de especial protección', sub: 'Personas por condición; una persona puede tener varias', item: '77',
          filas: filasDe(d, 'sujetoProteccion', CAT_SUJETO_ESPECIAL_PROTECCION), base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } }
    ],

    'personas/materna': [
      { id: 'indicadores', ancho: 5, construir: function (d) {
        return { tipo: 'medidores', titulo: 'Gestación y lactancia', sub: 'Sobre quienes respondieron cada pregunta',
          medidores: [
            { etiqueta: 'Gestación actual confirmada', item: '85',
              n: total(d, 'gestantes'), total: total(d, 'preguntadasGestacion'), unidad: ['mujer a quien se preguntó', 'mujeres a quienes se preguntó'] },
            { etiqueta: 'Lactancia materna exclusiva en menores de 6 meses', item: '91',
              n: conteoPorValor(d, 'lactancia').get('si') || 0, total: total(d, 'menores6m'), unidad: ['menor de 6 meses', 'menores de 6 meses'] }
          ] };
      } },
      { id: 'lactancia', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Lactancia materna exclusiva', sub: 'Menores de 6 meses por respuesta y sexo', item: '91',
          filas: filasPorSexo(d, 'lactancia', CAT_SI_NO_NA, { escala: true }) };
      } },
      { id: 'atenciones', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Atenciones pendientes de la ruta materno perinatal', sub: 'Personas que respondieron la pregunta; una persona puede tener varias pendientes', item: '88',
          filas: filasDe(d, 'atencionesMaterno', CAT_ATENCIONES_MATERNO), base: total(d, 'respondieronMaterno'), unidad: ['persona', 'personas'] };
      } }
    ],

    'personas/cobertura': [
      { id: 'regimen', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Régimen de afiliación', sub: 'Personas por régimen y sexo', item: '75',
          filas: filasPorSexo(d, 'regimen', CAT_REGIMEN_AFILIACION, { escala: true }) };
      } },
      { id: 'acceso', ancho: 5, construir: function (d) {
        return { tipo: 'medidores', titulo: 'Acceso a los servicios', sub: 'Proporciones sobre las personas caracterizadas',
          medidores: [
            { etiqueta: 'Personas sin afiliación al sistema de salud', item: '75',
              n: conteoPorValor(d, 'regimen').get('no_afiliado') || 0, total: total(d, 'personas'), unidad: ['persona', 'personas'] },
            { etiqueta: 'Personas con alguna barrera para recibir sus atenciones', item: '89',
              n: total(d, 'conBarreras'), total: total(d, 'respondieronBarreras'), unidad: ['persona que respondió', 'personas que respondieron'] }
          ] };
      } },
      { id: 'barreras', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Motivos por los que no ha recibido las atenciones', sub: 'Personas que respondieron; una persona puede marcar varios', item: '89',
          filas: filasDe(d, 'barreras', CAT_BARRERAS_ACCESO), base: total(d, 'respondieronBarreras'), unidad: ['persona', 'personas'] };
      } }
    ],

    'personas/salud': [
      { id: 'practicas', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Prácticas rutinarias para el cuidado de la salud', sub: 'Personas que las realizan, entre ellas la actividad física; una persona puede marcar varias', item: '86',
          filas: filasDe(d, 'practicasCuidado', CAT_PRACTICAS_CUIDADO), base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } },
      { id: 'nutricion', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Estado nutricional', sub: 'Clasificación antropométrica por sexo', item: '96',
          filas: filasPorSexo(d, 'antropometria', CAT_CLASIFICACION_ANTROPOMETRICA) };
      } },
      { id: 'conEnfermedad', ancho: 5, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Enfermedad no transmisible diagnosticada', sub: '¿Algún profesional le ha dicho que tiene alguna? Personas por respuesta y sexo', item: '100',
          filas: filasPorSexo(d, 'conEnfermedadNT', CAT_SI_NO, { escala: true }) };
      } },
      { id: 'enfermedades', ancho: 7, construir: function (d) {
        return { tipo: 'barras', titulo: 'Enfermedades no transmisibles diagnosticadas', sub: 'Personas por enfermedad; una persona puede tener varias', item: '100',
          filas: filasDe(d, 'enfermedadesNT', CAT_ENFERMEDADES_NO_TRANSMISIBLES, { excluir: ['ninguna'] }),
          base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } },
      { id: 'tratamiento', ancho: 5, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Atención y tratamiento', sub: '¿Recibe atención y tratamiento para la enfermedad actual? Personas por respuesta y sexo', item: '103',
          filas: filasPorSexo(d, 'tratamiento', CAT_SI_NO_NA, { escala: true }) };
      } },
      { id: 'transmisibles', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Situaciones o condiciones de salud transmisible', sub: 'Personas por condición', item: '101',
          filas: filasDe(d, 'transmisibles', CAT_CONDICIONES_TRANSMISIBLES), base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } }
    ],

    'personas/etnia': [
      { id: 'etnia', ancho: 7, construir: function (d) {
        return { tipo: 'espejo', titulo: 'Pertenencia étnica', sub: 'Personas según su autorreconocimiento y sexo', item: '79',
          filas: filasPorSexo(d, 'etnia', CAT_PERTENENCIA_ETNICA) };
      } },
      { id: 'reconocimiento', ancho: 5, construir: function (d) {
        const conteo = conteoPorValor(d, 'etnia');
        let con = 0;
        conteo.forEach(function (n, valor) { if (valor !== 'ninguna') con += n; });
        const saberes = conteoPorValor(d, 'saberes');
        let practican = 0;
        saberes.forEach(function (n, valor) { if (valor !== 'ninguna') practican += n; });
        return { tipo: 'medidores', titulo: 'Reconocimiento étnico', sub: 'Proporciones sobre las personas caracterizadas',
          medidores: [
            { etiqueta: 'Personas que se reconocen en un grupo étnico', item: '79', n: con, total: total(d, 'personas'), unidad: ['persona', 'personas'] },
            { etiqueta: 'Prácticas desde los saberes ancestrales registradas', item: '81', n: practican, total: 0, soloCifra: true,
              detalle: 'una persona puede tener varias' }
          ] };
      } },
      { id: 'saberes', ancho: 12, construir: function (d) {
        return { tipo: 'barras', titulo: 'Prácticas de cuidado desde los saberes ancestrales o tradicionales', sub: 'Personas que las realizan; una persona puede marcar varias', item: '81',
          filas: filasDe(d, 'saberes', CAT_SABERES_ANCESTRALES), base: total(d, 'personas'), unidad: ['persona', 'personas'] };
      } }
    ]
  };

  function clavePagina(tablero, pagina) { return tablero === 'principal' ? 'principal' : tablero + '/' + pagina; }

  /* ---------------------------------------------------------
     Tabla de una especificación (la misma para la vista de tabla y el CSV)
     --------------------------------------------------------- */

  function tablaDe(spec) {
    if (spec.tipo === 'cadena') {
      return { columnas: ['Nivel', 'Cantidad', 'Razón'],
        filas: spec.niveles.map(function (n) { return [n.etiqueta, n.valor, n.detalle || '']; }) };
    }
    if (spec.tipo === 'tejas') {
      return { columnas: ['Grupo', 'Personas', 'Detalle'],
        filas: spec.tejas.map(function (t) { return [t.etiqueta, t.valor, t.detalle || '']; }) };
    }
    if (spec.tipo === 'medidores') {
      return { columnas: ['Indicador', 'Cantidad', 'De', 'Porcentaje'],
        filas: spec.medidores.map(function (m) {
          return [m.etiqueta, m.n, m.soloCifra ? '' : m.total, m.soloCifra ? '' : porcentaje(m.n, m.total)];
        }) };
    }
    if (spec.tipo === 'espejo') {
      const conIntersexual = spec.filas.some(function (f) { return f.intersexual > 0; });
      return { columnas: ['Categoría', 'Hombres', 'Mujeres'].concat(conIntersexual ? ['Intersexual'] : []).concat(['Total']),
        filas: spec.filas.map(function (f) {
          return [f.etiqueta, f.hombre, f.mujer].concat(conIntersexual ? [f.intersexual] : []).concat([f.hombre + f.mujer + f.intersexual]);
        }) };
    }
    /* La composición reparte su propio total: los grados suman el 100 %. */
    const base = spec.tipo === 'composicion' ? sumaDe(spec.filas) : spec.base;
    return { columnas: ['Categoría', 'Cantidad', 'Porcentaje'],
      filas: spec.filas.map(function (f) { return [f.etiqueta, f.n, porcentaje(f.n, base)]; }) };
  }

  function sinDatos(spec) {
    if (spec.tipo === 'cadena' || spec.tipo === 'tejas') return false;
    if (spec.tipo === 'medidores') return spec.medidores.every(function (m) { return !m.n && !m.total; });
    if (spec.tipo === 'espejo') return spec.filas.every(function (f) { return !(f.hombre + f.mujer + f.intersexual); });
    return spec.filas.every(function (f) { return !f.n; });
  }

  /* ---------------------------------------------------------
     Pintar las especificaciones
     --------------------------------------------------------- */

  function pintarCadena(spec) {
    const lista = elemento('ol', 'cadena tablero-cadena');
    spec.niveles.forEach(function (n, i) {
      const li = elemento('li', 'cadena__nivel' + (n.valor === 0 ? ' cadena__nivel--cero' : ''));
      if (i > 0) {
        const conector = elemento('span', 'cadena__conector');
        conector.setAttribute('aria-hidden', 'true');
        conector.appendChild(icono('ph-caret-right'));
        li.appendChild(conector);
      }
      const chip = elemento('span', 'cadena__icono');
      chip.setAttribute('aria-hidden', 'true');
      chip.appendChild(icono(n.icono));
      li.appendChild(chip);
      const valor = elemento('span', 'cadena__valor', cantidad(n.valor));
      valor.dataset.cifra = String(n.valor);
      li.appendChild(valor);
      li.appendChild(elemento('span', 'cadena__etiqueta', n.etiqueta));
      li.appendChild(elemento('span', 'cadena__detalle', n.detalle || ''));
      if (n.aviso) {
        const aviso = elemento('span', 'cadena__aviso');
        const punto = elemento('span', 'cadena__aviso-punto');
        punto.setAttribute('aria-hidden', 'true');
        aviso.appendChild(punto);
        aviso.appendChild(elemento('span', 'cadena__aviso-texto', n.aviso));
        li.appendChild(aviso);
      }
      lista.appendChild(li);
    });
    return lista;
  }

  function pintarTejas(spec) {
    const lista = elemento('ul', 'tejas');
    spec.tejas.forEach(function (t, i) {
      const li = elemento('li', 'teja' + (t.valor === 0 ? ' is-cero' : ''));
      li.style.setProperty('--orden', i);
      const chip = elemento('span', 'teja__icono');
      chip.setAttribute('aria-hidden', 'true');
      chip.appendChild(icono(t.icono));
      li.appendChild(chip);
      const valor = elemento('span', 'teja__valor', cantidad(t.valor));
      valor.dataset.cifra = String(t.valor);
      li.appendChild(valor);
      li.appendChild(elemento('span', 'teja__etiqueta', t.etiqueta));
      li.appendChild(elemento('span', 'teja__detalle', t.detalle || ''));
      lista.appendChild(li);
    });
    return lista;
  }

  /* Barras horizontales de una sola serie: la etiqueta arriba (se parte en
     renglones si es larga, nunca se corta), la cifra y su porcentaje a la
     derecha, y la barra de 10 px debajo. */
  function pintarBarras(spec) {
    const lista = elemento('ul', 'tbarras');
    const maximo = spec.filas.reduce(function (m, f) { return Math.max(m, f.n); }, 0) || 1;
    spec.filas.forEach(function (f, i) {
      const li = elemento('li', 'tbarra' + (f.apagada ? ' is-apagada' : '') + (f.n === 0 ? ' is-cero' : ''));
      li.style.setProperty('--orden', i);
      li.appendChild(elemento('span', 'tbarra__nombre', f.etiqueta));
      const cifras = elemento('span', 'tbarra__cifras');
      cifras.appendChild(elemento('strong', null, cantidad(f.n)));
      if (spec.base) cifras.appendChild(document.createTextNode(' · ' + porcentaje(f.n, spec.base)));
      li.appendChild(cifras);
      const carril = elemento('span', 'tbarra__carril');
      carril.setAttribute('aria-hidden', 'true');
      const relleno = elemento('span', 'tbarra__relleno');
      relleno.style.setProperty('--proporcion', (f.n / maximo).toFixed(4));
      carril.appendChild(relleno);
      li.appendChild(carril);
      lista.appendChild(li);
    });
    return lista;
  }

  /* Columnas para las escalas cortas (estrato, integrantes): la cifra en la
     punta y la categoría debajo. */
  function pintarColumnas(spec) {
    const bloque = elemento('div', 'tcolumnas');
    bloque.style.setProperty('--columnas', spec.filas.length);
    const maximo = spec.filas.reduce(function (m, f) { return Math.max(m, f.n); }, 0) || 1;
    spec.filas.forEach(function (f, i) {
      const col = elemento('div', 'tcolumna' + (f.n === 0 ? ' is-cero' : ''));
      col.style.setProperty('--orden', i);
      const area = elemento('div', 'tcolumna__area');
      const valor = elemento('span', 'tcolumna__valor', cantidad(f.n));
      const barra = elemento('span', 'tcolumna__barra');
      barra.setAttribute('aria-hidden', 'true');
      barra.style.setProperty('--proporcion', (f.n / maximo).toFixed(4));
      area.appendChild(valor);
      area.appendChild(barra);
      col.appendChild(area);
      col.appendChild(elemento('span', 'tcolumna__nombre', f.etiqueta));
      bloque.appendChild(col);
    });
    return bloque;
  }

  /* Espejo: hombres a la izquierda (azul Ladera), mujeres a la derecha
     (frambuesa), la categoría en el eje. Las dos alas comparten la escala.
     Con etiquetas largas, la categoría pasa encima de las barras. */
  function pintarEspejo(spec) {
    const maximo = spec.filas.reduce(function (m, f) { return Math.max(m, f.hombre, f.mujer); }, 0) || 1;
    const largas = spec.filas.some(function (f) { return String(f.etiqueta).length > 26; });
    const bloque = elemento('div', 'espejo' + (largas ? ' espejo--arriba' : ''));

    const leyenda = elemento('div', 'espejo__leyenda');
    [['hombre', 'Hombres'], ['mujer', 'Mujeres']].forEach(function (s) {
      const item = elemento('span', 'espejo__serie espejo__serie--' + s[0]);
      const muestra = elemento('span', 'espejo__muestra');
      muestra.setAttribute('aria-hidden', 'true');
      item.appendChild(muestra);
      item.appendChild(elemento('span', null, s[1]));
      leyenda.appendChild(item);
    });
    bloque.appendChild(leyenda);

    const lista = elemento('ul', 'espejo__filas');
    spec.filas.forEach(function (f, i) {
      const li = elemento('li', 'espejo__fila' + (f.apagada ? ' is-apagada' : ''));
      li.style.setProperty('--orden', i);
      const lectura = elemento('span', 'tablero-sr', f.etiqueta + ': ' + cantidad(f.hombre) + segun(f.hombre, ' hombre', ' hombres') +
        ' y ' + cantidad(f.mujer) + segun(f.mujer, ' mujer', ' mujeres') + '.');
      li.appendChild(lectura);
      const ala = function (sexo) {
        const lado = elemento('span', 'espejo__ala espejo__ala--' + sexo);
        lado.setAttribute('aria-hidden', 'true');
        const cifra = elemento('span', 'espejo__cifra' + (f[sexo] === 0 ? ' is-cero' : ''), cantidad(f[sexo]));
        const barra = elemento('span', 'espejo__barra');
        barra.style.setProperty('--proporcion', (f[sexo] / maximo).toFixed(4));
        if (f[sexo] === 0) barra.classList.add('is-cero');
        /* La barra nace en el eje y la cifra queda en su punta, por fuera. */
        if (sexo === 'hombre') { lado.appendChild(cifra); lado.appendChild(barra); }
        else { lado.appendChild(barra); lado.appendChild(cifra); }
        return lado;
      };
      const nombre = elemento('span', 'espejo__nombre', f.etiqueta);
      nombre.setAttribute('aria-hidden', 'true');
      li.appendChild(ala('hombre'));
      li.appendChild(nombre);
      li.appendChild(ala('mujer'));
      lista.appendChild(li);
    });
    bloque.appendChild(lista);

    const intersexual = spec.filas.reduce(function (s, f) { return s + f.intersexual; }, 0);
    if (intersexual) {
      bloque.appendChild(elemento('p', 'tpanel__nota', 'Además, ' + cantidad(intersexual) +
        segun(intersexual, ' persona intersexual', ' personas intersexuales') + '; están en la tabla.'));
    }
    return bloque;
  }

  /* Composición de una escala graduada (APGAR, Zarit, riesgo): una barra
     partida con los colores del semáforo y, debajo, cada grado con su
     punto, su nombre y su cifra. El color nunca va solo. */
  function pintarComposicion(spec) {
    const bloque = elemento('div', 'composicion-barra');
    const suma = sumaDe(spec.filas) || 1;
    const barra = elemento('div', 'composicion-barra__barra');
    barra.setAttribute('aria-hidden', 'true');
    spec.filas.forEach(function (f) {
      if (!f.n) return;
      const tramo = elemento('span', 'composicion-barra__tramo tono--' + (f.tono || 'sin'));
      tramo.style.setProperty('--parte', (f.n / suma).toFixed(4));
      barra.appendChild(tramo);
    });
    bloque.appendChild(barra);
    const lista = elemento('ul', 'composicion-barra__lista');
    spec.filas.forEach(function (f) {
      const li = elemento('li', 'composicion-barra__grado' + (f.n === 0 ? ' is-cero' : ''));
      const punto = elemento('span', 'composicion-barra__punto tono--' + (f.tono || 'sin'));
      punto.setAttribute('aria-hidden', 'true');
      li.appendChild(punto);
      li.appendChild(elemento('span', 'composicion-barra__nombre', f.etiqueta));
      const cifras = elemento('span', 'composicion-barra__cifras');
      cifras.appendChild(elemento('strong', null, cantidad(f.n)));
      cifras.appendChild(document.createTextNode(' · ' + porcentaje(f.n, suma)));
      li.appendChild(cifras);
      lista.appendChild(li);
    });
    bloque.appendChild(lista);
    return bloque;
  }

  /* Medidores en lugar de donas: una proporción contra su total, en una
     pista del mismo azul más claro. */
  function pintarMedidores(spec) {
    const lista = elemento('ul', 'medidores');
    spec.medidores.forEach(function (m, i) {
      const li = elemento('li', 'medidor' + (m.n === 0 ? ' is-cero' : ''));
      li.style.setProperty('--orden', i);
      const cabeza = elemento('div', 'medidor__cabeza');
      cabeza.appendChild(elemento('span', 'medidor__valor', m.soloCifra ? cantidad(m.n) : porcentaje(m.n, m.total)));
      cabeza.appendChild(elemento('span', 'medidor__etiqueta', m.etiqueta));
      li.appendChild(cabeza);
      if (!m.soloCifra) {
        const pista = elemento('span', 'medidor__pista');
        pista.setAttribute('aria-hidden', 'true');
        const relleno = elemento('span', 'medidor__relleno');
        relleno.style.setProperty('--proporcion', m.total ? Math.min(1, m.n / m.total).toFixed(4) : '0');
        pista.appendChild(relleno);
        li.appendChild(pista);
      }
      const detalle = m.soloCifra ? (m.detalle || '') :
        cantidad(m.n) + ' de ' + cantidad(m.total) + ' ' + (m.unidad ? segun(m.total, m.unidad[0], m.unidad[1]) : '');
      li.appendChild(elemento('span', 'medidor__detalle', detalle));
      lista.appendChild(li);
    });
    return lista;
  }

  function pintarTabla(spec) {
    const t = tablaDe(spec);
    const envoltura = elemento('div', 'table-wrapper tpanel__tabla');
    const tabla = elemento('table', 'data-table tablero-tabla');
    const thead = elemento('thead');
    const cabecera = elemento('tr');
    t.columnas.forEach(function (c, i) {
      const th = elemento('th', i > 0 ? 'tablero-tabla__num' : null, c);
      th.setAttribute('scope', 'col');
      cabecera.appendChild(th);
    });
    thead.appendChild(cabecera);
    tabla.appendChild(thead);
    const cuerpo = elemento('tbody');
    t.filas.forEach(function (fila) {
      const tr = elemento('tr');
      fila.forEach(function (celda, i) {
        const td = elemento(i === 0 ? 'th' : 'td', i > 0 ? 'tablero-tabla__num' : null,
          typeof celda === 'number' ? cantidad(celda) : String(celda));
        if (i === 0) td.setAttribute('scope', 'row');
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
    tabla.appendChild(cuerpo);
    envoltura.appendChild(tabla);
    return envoltura;
  }

  const PINTORES = {
    cadena: pintarCadena, tejas: pintarTejas, barras: pintarBarras, columnas: pintarColumnas,
    espejo: pintarEspejo, composicion: pintarComposicion, medidores: pintarMedidores
  };

  let consecutivoTitulo = 0;

  function pintarPanel(panel, spec, orden, entra) {
    const seccion = elemento('section', 'tpanel tpanel--' + spec.tipo + (entra ? ' entra' : ''));
    seccion.style.setProperty('--ancho', panel.ancho);
    seccion.style.setProperty('--orden', Math.min(orden, 6));
    seccion.dataset.panel = panel.id;
    const idTitulo = 'tpanelTitulo' + (++consecutivoTitulo);
    seccion.setAttribute('aria-labelledby', idTitulo);

    const cabecera = elemento('header', 'tpanel__cabecera');
    const textos = elemento('div', 'tpanel__textos');
    const titulo = elemento('h3', 'tpanel__titulo', spec.titulo);
    titulo.id = idTitulo;
    textos.appendChild(titulo);
    if (spec.sub) textos.appendChild(elemento('p', 'tpanel__sub', spec.sub));
    cabecera.appendChild(textos);

    const acciones = elemento('div', 'tpanel__acciones');
    if (spec.item) acciones.appendChild(elemento('span', 'tpanel__item', 'Ítem ' + spec.item));
    const vacio = sinDatos(spec);
    let alternar = null;
    if (!vacio && spec.tipo !== 'cadena' && spec.tipo !== 'tejas') {
      alternar = elemento('button', 'tpanel__alternar');
      alternar.type = 'button';
      alternar.setAttribute('aria-pressed', 'false');
      alternar.appendChild(icono('ph-table'));
      alternar.appendChild(elemento('span', null, 'Tabla'));
      alternar.setAttribute('aria-label', 'Ver «' + spec.titulo + '» como tabla');
      acciones.appendChild(alternar);
    }
    cabecera.appendChild(acciones);
    seccion.appendChild(cabecera);

    if (vacio) {
      seccion.appendChild(elemento('p', 'tpanel__vacio', 'Nada registrado en este período con estos filtros.'));
      if (spec.nota) seccion.appendChild(elemento('p', 'tpanel__nota', spec.nota));
      return seccion;
    }

    const grafico = elemento('div', 'tpanel__grafico');
    grafico.appendChild(PINTORES[spec.tipo](spec));
    seccion.appendChild(grafico);
    if (spec.nota) seccion.appendChild(elemento('p', 'tpanel__nota', spec.nota));

    if (alternar) {
      const tabla = pintarTabla(spec);
      tabla.hidden = true;
      seccion.appendChild(tabla);
      alternar.addEventListener('click', function () {
        const verTabla = alternar.getAttribute('aria-pressed') !== 'true';
        alternar.setAttribute('aria-pressed', verTabla ? 'true' : 'false');
        alternar.querySelector('i').className = 'ph ' + (verTabla ? 'ph-chart-bar' : 'ph-table');
        alternar.querySelector('span').textContent = verTabla ? 'Gráfico' : 'Tabla';
        alternar.setAttribute('aria-label', 'Ver «' + spec.titulo + '» como ' + (verTabla ? 'gráfico' : 'tabla'));
        tabla.hidden = !verTabla;
        grafico.hidden = verTabla;
      });
    }
    return seccion;
  }

  /* ---------------------------------------------------------
     Estado, consulta y pintado
     --------------------------------------------------------- */

  const estado = {
    tablero: 'principal',
    pagina: { hogares: 'estructura', personas: 'demografia' },
    datos: null,
    version: 0,
    consultando: false,
    consultadoEn: null
  };

  function paginaActual() {
    return estado.tablero === 'principal' ? 'principal' : estado.pagina[estado.tablero];
  }

  function mostrarError(texto) {
    $('tableroError').textContent = texto;
    $('tableroError').hidden = !texto;
  }

  function ocupado(activo) {
    estado.consultando = activo;
    const contenido = $('tableroContenido');
    contenido.classList.toggle('is-actualizando', activo && !!estado.datos);
    contenido.setAttribute('aria-busy', activo ? 'true' : 'false');
    $('tableroFiltros').setAttribute('aria-busy', activo ? 'true' : 'false');
  }

  function filtros() {
    return {
      desde: $('tableroDesde').value,
      hasta: $('tableroHasta').value,
      ebs: $('tableroEbs').value,
      comuna: $('tableroComuna').value,
      territorio: $('tableroTerritorio').value
    };
  }

  function validar(f) {
    if (!f.desde || !f.hasta) return 'Indique las dos fechas del período.';
    if (f.desde > f.hasta) return 'La fecha inicial es posterior a la final.';
    return null;
  }

  function pintarPaginas() {
    const def = TABLEROS[estado.tablero];
    const nav = $('tableroPaginas');
    nav.innerHTML = '';
    nav.hidden = def.paginas.length < 2;
    if (nav.hidden) return;
    def.paginas.forEach(function (p, i) {
      const boton = elemento('button', 'tablero-paginas__item');
      boton.type = 'button';
      boton.dataset.pagina = p.id;
      boton.appendChild(elemento('span', 'tablero-paginas__numero', String(i + 1)));
      boton.appendChild(elemento('span', null, p.titulo));
      if (p.id === paginaActual()) boton.setAttribute('aria-current', 'page');
      boton.addEventListener('click', function () {
        if (p.id === paginaActual()) return;
        estado.pagina[estado.tablero] = p.id;
        pintar('pagina');
      });
      nav.appendChild(boton);
    });
  }

  function pintarFuente() {
    const fuente = $('tableroFuente');
    const d = estado.datos;
    if (!d) { fuente.hidden = true; return; }
    const partes = ['Fuente: fichas de Encuesta APS con consentimiento; de cada vivienda, su visita más reciente.'];
    if (d.rango && d.rango.primera) {
      partes.push(d.rango.primera === d.rango.ultima ? 'Fichas del ' + fechaCorta(d.rango.primera) + '.'
        : 'Fichas del ' + fechaCorta(d.rango.primera) + ' al ' + fechaCorta(d.rango.ultima) + '.');
    }
    if (estado.consultadoEn) {
      /* «3:18 p. m.» ya termina en punto: no se le pone otro. */
      const hora = estado.consultadoEn.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
      partes.push('Consultado a las ' + hora + (/\.$/.test(hora) ? '' : '.'));
    }
    fuente.textContent = partes.join(' ');
    fuente.hidden = false;
  }

  /* Las cifras de la cadena y de las tejas cuentan desde cero cuando llegan
     datos nuevos: dice que acaban de cambiar (animarCifra, app.js). */
  function contarCifras(destino) {
    if (typeof animarCifra !== 'function') return;
    Array.from(destino.querySelectorAll('[data-cifra]')).forEach(function (el, i) {
      el.dataset.valor = '0';
      animarCifra(el, Number(el.dataset.cifra), 120 + i * 40);
    });
  }

  /* `motivo`: 'pagina' (otro tablero u otra página: los paneles entran),
     'datos' (respuesta nueva con los mismos paneles: las cifras cuentan y las
     barras crecen, sin volver a entrar) o 'primera' (las dos cosas). */
  function pintar(motivo) {
    const def = TABLEROS[estado.tablero];
    $('tableroTitulo').textContent = def.titulo;
    $('tableroDescripcion').textContent = def.descripcion;
    pintarPaginas();

    const destino = $('tableroContenido');
    destino.innerHTML = '';
    destino.classList.remove('tablero--crece');
    const d = estado.datos;
    $('btnTableroDescargar').disabled = !d || !total(d, 'viviendas');
    pintarFuente();

    if (!d) {
      if (estado.consultando) destino.appendChild(elemento('p', 'tablero__espera', 'Consultando la base…'));
      return;
    }

    if (!total(d, 'viviendas')) {
      const vacio = elemento('div', 'tablero__vacio');
      vacio.appendChild(icono('ph-magnifying-glass'));
      vacio.appendChild(elemento('p', 'tablero__vacio-titulo', 'No hay viviendas caracterizadas con estos filtros'));
      vacio.appendChild(elemento('p', 'tablero__vacio-texto',
        'Entran las fichas con consentimiento diligenciadas en el período. Amplíe el período o quite algún filtro.'));
      destino.appendChild(vacio);
      return;
    }

    const entra = motivo === 'pagina' || motivo === 'primera';
    (PANELES[clavePagina(estado.tablero, paginaActual())] || []).forEach(function (panel, i) {
      destino.appendChild(pintarPanel(panel, panel.construir(d), i, entra));
    });
    /* Las barras crecen desde su base al pintarse: una vez por pintado, nunca
       mientras se mira. */
    void destino.offsetWidth;
    destino.classList.add('tablero--crece');
    if (motivo === 'datos' || motivo === 'primera') contarCifras(destino);
  }

  async function consultar() {
    const f = filtros();
    const problema = validar(f);
    if (problema) { mostrarError(problema); return; }
    mostrarError('');
    const mia = ++estado.version;
    ocupado(true);
    if (!estado.datos) pintar();
    try {
      const consulta = new URLSearchParams({ tablero: '1' });
      Object.keys(f).forEach(function (k) { if (f[k]) consulta.set(k, f[k]); });
      const respuesta = await fetch('/api/productividad?' + consulta.toString());
      const cuerpo = await respuesta.json().catch(function () { return {}; });
      /* Si mientras tanto se pidió otra cosa, esta respuesta ya no vale. */
      if (mia !== estado.version) return;
      if (!respuesta.ok) throw new Error(cuerpo.error || 'HTTP ' + respuesta.status);
      const primera = !estado.datos;
      estado.datos = cuerpo;
      estado.consultadoEn = new Date();
      pintarOpciones(cuerpo.opciones || {});
      ocupado(false);
      pintar(primera ? 'primera' : 'datos');
    } catch (error) {
      if (mia !== estado.version) return;
      ocupado(false);
      mostrarError('No fue posible consultar el tablero: ' + error.message);
      if (!estado.datos) pintar();
    }
  }

  /* ---------------------------------------------------------
     Filtros
     --------------------------------------------------------- */

  const combos = new Map();

  function llenarSelect(select, opciones, todos) {
    const actual = select.value;
    const textoActual = select.selectedIndex >= 0 ? select.options[select.selectedIndex].textContent : actual;
    select.innerHTML = '';
    select.appendChild(elemento('option', null, todos)).value = '';
    opciones.forEach(function (o) {
      const opcion = elemento('option', null, o.etiqueta);
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
    if (combos.has(select.id)) combos.get(select.id)();
  }

  let opcionesRecibidas = { ebs: [], comunas: [], territorios: [] };

  function pintarOpciones(op) {
    opcionesRecibidas = {
      ebs: op.ebs || [], comunas: op.comunas || [], territorios: op.territorios || []
    };
    llenarSelect($('tableroEbs'), opcionesRecibidas.ebs.map(function (c) { return { valor: c, etiqueta: c }; }), 'Todos los EBS');
    llenarSelect($('tableroComuna'), opcionesRecibidas.comunas, 'Todas las comunas');
    pintarTerritorios();
  }

  /* Con una comuna elegida, sólo sus territorios. */
  function pintarTerritorios() {
    const comuna = $('tableroComuna').value;
    const lista = opcionesRecibidas.territorios
      .filter(function (t) { return !comuna || t.comuna === comuna; })
      .map(function (t) {
        return { valor: t.valor, etiqueta: typeof etiquetaTerritorio === 'function' ? etiquetaTerritorio(t.valor) : t.valor };
      });
    llenarSelect($('tableroTerritorio'), lista, 'Todos los territorios');
  }

  function hayFiltros() {
    return !!($('tableroEbs').value || $('tableroComuna').value || $('tableroTerritorio').value);
  }

  function actualizarQuitar() {
    $('btnTableroQuitar').hidden = !hayFiltros();
  }

  function periodoRapido(cual) {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    if (cual === 'mes') return { desde: fechaIso(new Date(y, m, 1)), hasta: fechaIso(hoy) };
    if (cual === 'trimestre') return { desde: fechaIso(new Date(y, m - 2, 1)), hasta: fechaIso(hoy) };
    if (cual === 'anio') return { desde: fechaIso(new Date(y, 0, 1)), hasta: fechaIso(hoy) };
    return { desde: INICIO_DEL_REGISTRO, hasta: fechaIso(hoy) };
  }

  function fijarPeriodo(cual) {
    const p = periodoRapido(cual);
    $('tableroDesde').value = p.desde;
    $('tableroHasta').value = p.hasta;
    document.querySelectorAll('[data-periodo-tablero]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.periodoTablero === cual ? 'true' : 'false');
    });
  }

  /* ---------------------------------------------------------
     Descarga para Excel: todos los paneles del tablero abierto, en todas sus
     páginas. «;» como separador y BOM, como el CSV de productividad.
     --------------------------------------------------------- */

  function celdaCsv(valor) {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    /* Una celda que empieza por = + - @ Excel la toma por fórmula. */
    if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
    return /[";\r\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  }

  function describirFiltros() {
    const partes = [];
    ['tableroEbs', 'tableroComuna', 'tableroTerritorio'].forEach(function (id) {
      const s = $(id);
      if (s.value) partes.push(s.options[s.selectedIndex].textContent);
    });
    return partes.join(' · ') || 'Ninguno';
  }

  function descargar() {
    const d = estado.datos;
    if (!d) return;
    const def = TABLEROS[estado.tablero];
    const lineas = [];
    const fila = function (celdas) { lineas.push(celdas.map(celdaCsv).join(';')); };
    fila(['Tablero de población · ' + def.titulo]);
    fila(['Período', d.periodo.desde + ' a ' + d.periodo.hasta]);
    fila(['Filtros', describirFiltros()]);
    fila(['Fuente', 'Fichas con consentimiento; de cada vivienda, su visita más reciente']);
    def.paginas.forEach(function (pagina) {
      (PANELES[clavePagina(estado.tablero, pagina.id)] || []).forEach(function (panel) {
        const spec = panel.construir(d);
        const t = tablaDe(spec);
        lineas.push('');
        fila([(def.paginas.length > 1 ? pagina.titulo + ' · ' : '') + spec.titulo + (spec.item ? ' (ítem ' + spec.item + ')' : '')]);
        fila(t.columnas);
        t.filas.forEach(fila);
      });
    });
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'tablero_' + estado.tablero + '_' + d.periodo.desde + '_' + d.periodo.hasta + '.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------
     El apartado: menú lateral y entrada
     --------------------------------------------------------- */

  const DESTINOS = {
    principal: { vista: 'tableros', tablero: 'principal', permiso: PERMISO },
    hogares: { vista: 'tableros', tablero: 'hogares', permiso: PERMISO },
    personas: { vista: 'tableros', tablero: 'personas', permiso: PERMISO },
    productividad: { vista: 'productividad', permiso: 'productividad.ver' },
    descargas: { vista: 'reporte', permiso: 'reporte.generar' }
  };

  function puedeEntrar() {
    return Object.keys(DESTINOS).some(function (k) { return SESION.puede(DESTINOS[k].permiso); });
  }

  function abrirTablero(cual) {
    if (!SESION.puede(PERMISO)) return;
    estado.tablero = TABLEROS[cual] ? cual : 'principal';
    cambiarVista('tableros');
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    if (!estado.datos && !estado.consultando) consultar();
    else pintar('pagina');
  }

  function abrirReportes(destino) {
    const disponibles = Object.keys(DESTINOS).filter(function (k) { return SESION.puede(DESTINOS[k].permiso); });
    if (disponibles.length === 0) return;
    const clave = disponibles.indexOf(destino) !== -1 ? destino : disponibles[0];
    const d = DESTINOS[clave];
    if (d.vista === 'tableros') abrirTablero(d.tablero);
    else if (d.vista === 'productividad' && window.PRODUCTIVIDAD) window.PRODUCTIVIDAD.abrir();
    else if (d.vista === 'reporte' && window.REPORTE_SISPRO) window.REPORTE_SISPRO.abrir();
  }

  /* Lo llama cambiarVista (app.js) en cada cambio de vista: el menú lateral
     aparece en las tres vistas del apartado, con la actual marcada, y la
     página se ensancha para el menú. */
  function alCambiarVista(nombre) {
    const enApartado = VISTAS_DEL_APARTADO.indexOf(nombre) !== -1 && puedeEntrar();
    const principal = document.querySelector('.app-main');
    if (principal) principal.classList.toggle('app-main--reportes', enApartado);
    const menu = $('reportesMenu');
    if (!menu) return;
    menu.hidden = !enApartado;
    const actual = nombre === 'tableros' ? estado.tablero : nombre === 'productividad' ? 'productividad' :
      nombre === 'reporte' ? 'descargas' : null;
    menu.querySelectorAll('[data-reporte]').forEach(function (item) {
      if (item.dataset.reporte === actual) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  let iniciado = false;

  document.addEventListener('DOMContentLoaded', function () {
    /* Una sola vez: un segundo DOMContentLoaded duplicaría los oyentes. */
    if (iniciado || !$('reportesMenu') || !puedeEntrar()) return;
    iniciado = true;

    $('reportesMenu').querySelectorAll('[data-reporte]').forEach(function (item) {
      const destino = DESTINOS[item.dataset.reporte];
      if (!destino || !SESION.puede(destino.permiso)) { item.hidden = true; return; }
      item.addEventListener('click', function () { abrirReportes(item.dataset.reporte); });
    });
    $('reportesMenu').querySelectorAll('.reportes-menu__grupo').forEach(function (grupo) {
      grupo.hidden = !grupo.querySelector('[data-reporte]:not([hidden])');
    });

    if (!SESION.puede(PERMISO) || !$('tableroFiltros')) return;

    /* Los filtros con búsqueda son los de productividad (crearCombo). */
    if (window.PRODUCTIVIDAD && typeof window.PRODUCTIVIDAD.crearCombo === 'function') {
      ['tableroEbs', 'tableroComuna', 'tableroTerritorio'].forEach(function (id) {
        combos.set(id, window.PRODUCTIVIDAD.crearCombo($(id)));
      });
    }
    fijarPeriodo('todo');

    $('tableroFiltros').addEventListener('submit', function (evento) { evento.preventDefault(); consultar(); });
    document.querySelectorAll('[data-periodo-tablero]').forEach(function (boton) {
      boton.addEventListener('click', function () { fijarPeriodo(boton.dataset.periodoTablero); consultar(); });
    });
    ['tableroDesde', 'tableroHasta'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        document.querySelectorAll('[data-periodo-tablero]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        consultar();
      });
    });
    $('tableroEbs').addEventListener('change', function () { actualizarQuitar(); consultar(); });
    $('tableroComuna').addEventListener('change', function () {
      /* Un territorio de otra comuna deja de valer. */
      const territorio = $('tableroTerritorio').value;
      const comuna = $('tableroComuna').value;
      if (territorio && comuna && !opcionesRecibidas.territorios.some(function (t) { return t.valor === territorio && t.comuna === comuna; })) {
        $('tableroTerritorio').value = '';
      }
      pintarTerritorios();
      actualizarQuitar();
      consultar();
    });
    $('tableroTerritorio').addEventListener('change', function () { actualizarQuitar(); consultar(); });
    $('btnTableroQuitar').addEventListener('click', function () {
      ['tableroEbs', 'tableroComuna', 'tableroTerritorio'].forEach(function (id) {
        $(id).value = '';
        if (combos.has(id)) combos.get(id)();
      });
      pintarTerritorios();
      actualizarQuitar();
      consultar();
    });
    $('btnTableroDescargar').addEventListener('click', descargar);
  });

  window.REPORTES = { abrir: abrirReportes, alCambiarVista: alCambiarVista };
  window.TABLEROS = { abrir: abrirTablero };
})();
