/* =========================================================================
   Encuesta_APS — Fichas de caracterización en Excel
   -------------------------------------------------------------------------
   Arma el libro que se descarga desde «Reporte SI-APS → Fichas en Excel»:
   una hoja por nivel de la ficha, con las preguntas en el orden y con el
   número y el nombre del instrumento (api/_campos_ficha.js) y las respuestas
   escritas, no en código.

     Resumen         período, quién lo generó, totales y qué trae cada hoja
     Fichas          una fila por ficha: entorno, vivienda y resumen
     Familias        una fila por familia caracterizada
     Integrantes     una fila por persona
     Acciones        acciones del plan de cuidado (vivienda, familia, persona)
     Seguimientos    seguimientos a la acción concertada
     Alertas         lo que el motor de reglas detecta en cada ficha

   El código de la ficha encabeza todas las hojas para cruzarlas. Función
   pura: recibe las fichas ya leídas y el motor; no toca la base.
   ========================================================================= */

'use strict';

const vm = require('vm');
const { crearLibro, ESTILO } = require('./_xlsx');
const { CAMPOS_FICHA } = require('./_campos_ficha');

const PRIORIDADES = { inmediata: 'Inmediata', prioritaria: 'Prioritaria', regular: 'Regular' };
const PLANES = { vivienda: 'Vivienda', familia: 'Familia', persona: 'Persona' };
const ESTADOS = {
  borrador: 'En captura', interrumpida_urgencia: 'Interrumpida por urgencia',
  incompleta_causa_externa: 'Incompleta por causa externa', cerrada: 'Cerrada', sincronizada: 'Sincronizada'
};

/* Los códigos de regla (RN-…) no van en lo que lee la gente. */
function sinCodigoDeRegla(texto) {
  if (!texto) return texto;
  const limpio = String(texto)
    .replace(/\s*\((?:ver\s+)?RN-\d+[a-z]?(?:\.\d+)?(?:\s*(?:,|y|a|·|\/)\s*RN-\d+[a-z]?(?:\.\d+)?)*\)/g, '')
    .replace(/^\s*RN-\d+[a-z]?(?:\.\d+)?\s*:\s*/, '');
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function vacio(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0); }

/* «2026-10-28 09:41» en la hora de Colombia. */
function fechaHora(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return String(valor);
  const partes = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(fecha).reduce(function (a, p) { a[p.type] = p.value; return a; }, {});
  return partes.year + '-' + partes.month + '-' + partes.day + ' ' + partes.hour + ':' + partes.minute;
}

function crearFormateador(motor) {
  const cache = {};
  function catalogo(nombre) {
    if (!nombre) return null;
    if (cache[nombre] !== undefined) return cache[nombre];
    let lista = null;
    try { lista = vm.runInContext(nombre, motor); } catch (e) { lista = null; }
    if (!Array.isArray(lista) && motor.CATALOGOS_ANEXO) lista = motor.CATALOGOS_ANEXO[nombre] || null;
    cache[nombre] = Array.isArray(lista) ? lista : null;
    return cache[nombre];
  }
  function etiqueta(nombreCatalogo, valor) {
    const lista = catalogo(nombreCatalogo);
    if (!lista) return valor;
    const opcion = lista.find(function (o) { return o.valor === valor; });
    return opcion ? opcion.etiqueta : valor;
  }
  /* Valor de una pregunta: texto de la opción, lista con «; », Sí/No,
     número tal cual. Los números de documento y teléfono vienen como texto
     y así se quedan (Excel no les quita ceros ni los vuelve notación). */
  function valor(nombreCatalogo, crudo) {
    if (vacio(crudo)) return null;
    if (Array.isArray(crudo)) return crudo.map(function (v) { return etiqueta(nombreCatalogo, v); }).join('; ');
    if (typeof crudo === 'boolean') return crudo ? 'Sí' : 'No';
    if (nombreCatalogo) return etiqueta(nombreCatalogo, crudo);
    if (typeof crudo === 'number') return crudo;
    return String(crudo);
  }
  return { catalogo: catalogo, etiqueta: etiqueta, valor: valor };
}

/* Ancho de columna según lo que suele contener. */
function anchoDe(campo) {
  if (campo.multiple) return 34;
  if (/observ|descrip|direccion|referencia|division|institucion|cabeza|lugar|empleador|otro|otra|cual/i.test(campo.campo)) return 30;
  if (campo.catalogo) return 22;
  return 16;
}

function tituloDe(campo) {
  return (campo.item ? campo.item + '. ' : '') + campo.etiqueta;
}

/**
 * @param opciones.fichas          [{ encuesta, meta }] de leerFichasCompletas
 * @param opciones.motor           obtenerMotor() de _validacion.js
 * @param opciones.nombresAcciones { codigo: nombre } del catálogo de acciones
 * @param opciones.desde, hasta    período (AAAA-MM-DD)
 * @param opciones.generadoPor     nombre de quien descarga
 * @param opciones.ahora           fecha de generación (para pruebas)
 * @returns { nombreArchivo, contenido (Buffer), totales }
 */
function construirExcel(opciones) {
  const m = opciones.motor;
  const f = crearFormateador(m);
  const nombresAcciones = opciones.nombresAcciones || {};
  const ahora = opciones.ahora || new Date();
  const fichas = opciones.fichas || [];

  /* Preguntas que la ficha no guarda tal cual y se calculan o se toman de
     otro lado; el resto sale de su clave con su catálogo. */
  const especiales = {
    ficha: {
      departamento: function (e) { return e.departamentoCodigo ? e.departamentoCodigo + ' — ' + (m.CAT_DEPARTAMENTO && m.CAT_DEPARTAMENTO.codigo === e.departamentoCodigo ? m.CAT_DEPARTAMENTO.nombre : '') : null; },
      municipio: function (e) { return e.municipioCodigo ? e.municipioCodigo + ' — ' + (m.CAT_MUNICIPIO && m.CAT_MUNICIPIO.codigo === e.municipioCodigo ? m.CAT_MUNICIPIO.nombre : '') : null; },
      territorio: function (e) { return e.territorio ? m.etiquetaTerritorio(e.territorio) : null; },
      microterritorio: function (e) {
        const mt = e.territorio && e.microterritorio ? m.buscarMicroterritorio(e.territorio, e.microterritorio) : null;
        return mt ? m.etiquetaMicroterritorio(mt) : e.microterritorio || null;
      },
      comuna: function (e) {
        const comuna = e.territorio ? m.comunaDeTerritorio(e.territorio) : null;
        return !comuna ? null : comuna === 'Rural' ? 'Zona rural' : 'Comuna ' + comuna;
      },
      prestadorPrimario: function (e) { return f.valor('CAT_PRESTADOR', e.prestadorPrimario); },
      personasPorHabitacion: function (e, ctx) { return vacio(ctx.meta.personasPorHabitacion) ? null : Number(ctx.meta.personasPorHabitacion); }
    },
    familia: {
      idFamiliaBloque: function (fam) { return fam.idFamilia || null; }
    },
    integrante: {
      edadCalculada: function (i, ctx) { return ctx.contexto.edadMeses === null ? null : m.describirEdad(m.calcularEdad(i.fechaNacimiento, ctx.encuesta.fechaDiligenciamiento)); },
      ocupacion: function (i) {
        if (vacio(i.ocupacion)) return null;
        const o = (m.CAT_OCUPACION_CIUO || []).find(function (x) { return x.valor === String(i.ocupacion); });
        return o ? o.valor + ' — ' + o.etiqueta : String(i.ocupacion);
      }
    }
  };
  /* Columnas que se agregan detrás de una pregunta. */
  const despues = {
    ficha: { personasPorHabitacion: [{ titulo: '33. Hacinamiento', valor: function (e, ctx) { return vacio(ctx.meta.hacinamiento) ? null : ctx.meta.hacinamiento ? 'Sí' : 'No'; } }] },
    familia: { zaritPuntaje: [{ titulo: '53. Clasificación ZARIT', valor: function (fam) { return f.valor('CAT_ZARIT', fam.zarit); } }] },
    integrante: {}
  };

  function columnasDe(nivel, fijas, omitir) {
    const columnas = fijas.slice();
    CAMPOS_FICHA[nivel].forEach(function (campo) {
      if (omitir.indexOf(campo.campo) !== -1) return;
      const especial = especiales[nivel][campo.campo];
      columnas.push({
        titulo: tituloDe(campo), grupo: campo.seccion, ancho: anchoDe(campo),
        valor: especial || function (objeto) { return f.valor(campo.catalogo, objeto[campo.campo]); }
      });
      (despues[nivel][campo.campo] || []).forEach(function (extra) {
        columnas.push({ titulo: extra.titulo, grupo: campo.seccion, ancho: 16, valor: extra.valor });
      });
    });
    return columnas;
  }

  /* ---------- Fichas ---------- */
  const columnasFicha = columnasDe('ficha', [
    { titulo: '15. Código de la ficha', grupo: 'Ficha', ancho: 34, valor: function (e) { return e.codigoFicha; } },
    { titulo: '16. Fecha de diligenciamiento', grupo: 'Ficha', ancho: 14, valor: function (e) { return e.fechaDiligenciamiento; } },
    { titulo: 'Fecha y hora de registro', grupo: 'Ficha', ancho: 17, valor: function (e) { return fechaHora(e.fechaRegistro); } },
    { titulo: 'Estado de la ficha', grupo: 'Ficha', ancho: 14, valor: function (e, ctx) { return ESTADOS[ctx.meta.estado] || ctx.meta.estado || null; } }
  ], ['codigoFicha', 'fechaDiligenciamiento']).concat([
    { titulo: 'Familias caracterizadas', grupo: 'Resumen de la ficha', ancho: 13, valor: function (e) { return (e.familias || []).length; } },
    { titulo: 'Personas caracterizadas', grupo: 'Resumen de la ficha', ancho: 13,
      valor: function (e) { return (e.familias || []).reduce(function (s, fam) { return s + (fam.integrantes || []).length; }, 0); } },
    { titulo: 'Alertas inmediatas', grupo: 'Resumen de la ficha', ancho: 12, valor: function (e, ctx) { return ctx.riesgo.inmediatas; } },
    { titulo: 'Alertas prioritarias', grupo: 'Resumen de la ficha', ancho: 12, valor: function (e, ctx) { return ctx.riesgo.prioritarias; } },
    { titulo: 'Alertas regulares', grupo: 'Resumen de la ficha', ancho: 12, valor: function (e, ctx) { return ctx.riesgo.regulares; } },
    { titulo: 'Riesgo familiar', grupo: 'Resumen de la ficha', ancho: 16, valor: function (e, ctx) { return ctx.riesgo.etiqueta; } },
    { titulo: 'Plan de cuidado', grupo: 'Resumen de la ficha', ancho: 16,
      valor: function (e, ctx) { return ctx.plan.pendiente ? 'Pendiente' : 'Registrado'; } }
  ]);

  const columnasFamilia = columnasDe('familia', [
    { titulo: '15. Código de la ficha', grupo: 'Ficha', ancho: 34, valor: function (fam, ctx) { return ctx.encuesta.codigoFicha; } },
    { titulo: 'N.° de familia en la ficha', grupo: 'Ficha', ancho: 10, valor: function (fam, ctx) { return ctx.numeroFamilia; } }
  ], []).concat([
    { titulo: 'Integrantes caracterizados', grupo: 'Resumen', ancho: 13, valor: function (fam) { return (fam.integrantes || []).length; } }
  ]);

  const columnasIntegrante = columnasDe('integrante', [
    { titulo: '15. Código de la ficha', grupo: 'Ficha', ancho: 34, valor: function (i, ctx) { return ctx.encuesta.codigoFicha; } },
    { titulo: 'N.° de familia', grupo: 'Ficha', ancho: 9, valor: function (i, ctx) { return ctx.numeroFamilia; } },
    { titulo: '26. ID de la familia', grupo: 'Ficha', ancho: 22, valor: function (i, ctx) { return ctx.familia.idFamilia || null; } },
    { titulo: 'N.° de integrante', grupo: 'Ficha', ancho: 10, valor: function (i, ctx) { return ctx.numeroIntegrante; } },
    { titulo: 'Nombre completo', grupo: 'Ficha', ancho: 30,
      valor: function (i) { return [i.primerNombre, i.segundoNombre, i.primerApellido, i.segundoApellido].filter(function (p) { return !vacio(p); }).join(' ') || null; } }
  ], []);

  const columnasAccion = [
    { titulo: '15. Código de la ficha', ancho: 34 }, { titulo: 'Plan', ancho: 12 }, { titulo: 'Familia o persona', ancho: 30 },
    { titulo: 'Tipo de identificación de quien ejecuta', ancho: 14 }, { titulo: 'N.° de identificación de quien ejecuta', ancho: 16 },
    { titulo: 'Código de la acción', ancho: 14 }, { titulo: 'Acción', ancho: 40 }, { titulo: 'Procedimiento realizado', ancho: 30 },
    { titulo: 'Tipo de respuesta', ancho: 14 }, { titulo: 'Institución a la que se deriva', ancho: 26 }, { titulo: 'Fecha de la cita', ancho: 14 }
  ];
  const columnasSeguimiento = [
    { titulo: '15. Código de la ficha', ancho: 34 }, { titulo: 'Plan', ancho: 12 }, { titulo: 'Familia o persona', ancho: 30 },
    { titulo: 'Tipo de identificación del responsable', ancho: 14 }, { titulo: 'N.° de identificación del responsable', ancho: 16 },
    { titulo: 'Acción de cuidado concertada', ancho: 40 },
    { titulo: 'Fecha del seguimiento 1', ancho: 14 }, { titulo: 'Estado del seguimiento 1', ancho: 16 }, { titulo: 'Motivo («No cumple») 1', ancho: 26 },
    { titulo: 'Fecha del seguimiento 2', ancho: 14 }, { titulo: 'Estado del seguimiento 2', ancho: 16 }, { titulo: 'Motivo («No cumple») 2', ancho: 26 }
  ];
  const columnasAlerta = [
    { titulo: '15. Código de la ficha', ancho: 34 }, { titulo: 'Familia o persona', ancho: 30 }, { titulo: 'Plan que la atiende', ancho: 12 },
    { titulo: 'Prioridad', ancho: 12 }, { titulo: 'Alerta', ancho: 32 }, { titulo: 'Descripción', ancho: 60 },
    { titulo: 'Plazo de atención (días)', ancho: 12 }, { titulo: 'Notificar a SIVIGILA', ancho: 12 }, { titulo: 'Conducta registrada', ancho: 12 }
  ];

  const filas = { ficha: [], familia: [], integrante: [], accion: [], seguimiento: [], alerta: [] };
  const totales = { fichas: 0, familias: 0, personas: 0, acciones: 0, seguimientos: 0, alertas: 0, inmediatas: 0 };

  function filaDePlanVacia(fila) {
    return !fila || Object.keys(fila).every(function (k) { return vacio(fila[k]); });
  }
  function agregarPlan(plan, codigo, tipo, quien) {
    if (!plan) return;
    (plan.acciones || []).forEach(function (a) {
      if (filaDePlanVacia(a)) return;
      totales.acciones++;
      filas.accion.push([codigo, tipo, quien, f.valor('CAT_TIPO_ID_EJECUTOR', a.ejecutorTipoId), a.ejecutorNumeroId || null,
        a.codigoAccion || null, a.codigoAccion ? nombresAcciones[a.codigoAccion] || null : null, a.procedimientoRealizado || null,
        f.valor('CAT_TIPO_RESPUESTA', a.tipoRespuesta), a.institucionDestino || null, a.fechaCita || null]);
    });
    (plan.seguimientos || []).forEach(function (s) {
      if (filaDePlanVacia(s)) return;
      totales.seguimientos++;
      filas.seguimiento.push([codigo, tipo, quien, f.valor('CAT_TIPO_ID_EJECUTOR', s.seguimientoTipoId), s.seguimientoNumeroId || null,
        s.accionConcertada || null, s.seg1Fecha || null, f.valor('CAT_ESTADO_SEGUIMIENTO', s.seg1Estado), s.seg1MotivoNc || null,
        s.seg2Fecha || null, f.valor('CAT_ESTADO_SEGUIMIENTO', s.seg2Estado), s.seg2MotivoNc || null]);
    });
  }

  fichas.forEach(function (leida) {
    const e = leida.encuesta;
    const meta = leida.meta || {};
    const alertas = typeof m.evaluarAlertas === 'function' ? m.evaluarAlertas(e) : [];
    const riesgo = m.clasificarRiesgoFamiliar(e, alertas);
    const plan = m.resumirPlanCuidado(e, alertas);
    const sinConducta = new Set(m.verificarTrazabilidadAlertas(e, alertas).map(function (a) { return a.codigo + '|' + a.ruta + '|' + a.titulo; }));
    const ctxFicha = { encuesta: e, meta: meta, riesgo: riesgo, plan: plan };
    totales.fichas++;

    filas.ficha.push(columnasFicha.map(function (c) { return c.valor(e, ctxFicha); }));
    agregarPlan(e.planVivienda, e.codigoFicha, PLANES.vivienda, 'Vivienda');

    (e.familias || []).forEach(function (familia, k) {
      totales.familias++;
      const ctxFamilia = { encuesta: e, meta: meta, familia: familia, numeroFamilia: k + 1 };
      filas.familia.push(columnasFamilia.map(function (c) { return c.valor(familia, ctxFamilia); }));
      agregarPlan(familia.planFamilia, e.codigoFicha, PLANES.familia, 'Familia ' + (k + 1) + (familia.idFamilia ? ' · ' + familia.idFamilia : ''));

      (familia.integrantes || []).forEach(function (integrante, j) {
        totales.personas++;
        const ctxIntegrante = { encuesta: e, meta: meta, familia: familia, numeroFamilia: k + 1, numeroIntegrante: j + 1,
          contexto: m.contextoIntegrante(integrante, e) };
        filas.integrante.push(columnasIntegrante.map(function (c) { return c.valor(integrante, ctxIntegrante); }));
        const nombre = [integrante.primerNombre, integrante.primerApellido].filter(function (p) { return !vacio(p); }).join(' ');
        agregarPlan(integrante.planPersona, e.codigoFicha, PLANES.persona, 'Familia ' + (k + 1) + ' · ' + (nombre || 'Integrante ' + (j + 1)));
      });
    });

    alertas.forEach(function (a) {
      totales.alertas++;
      if (a.prioridad === 'inmediata') totales.inmediatas++;
      filas.alerta.push([e.codigoFicha, a.referencia || 'Vivienda', PLANES[a.plan] || a.plan || null, PRIORIDADES[a.prioridad] || a.prioridad,
        a.titulo, sinCodigoDeRegla(a.descripcion), a.plazoDias || null, a.notificaSivigila ? 'Sí' : 'No',
        sinConducta.has(a.codigo + '|' + a.ruta + '|' + a.titulo) ? 'No' : 'Sí']);
    });
  });

  const resumen = {
    nombre: 'Resumen',
    antes: [
      [['Fichas de caracterización — Red de Salud de Ladera E.S.E.', ESTILO.tituloLibro]],
      [],
      [['Período', ESTILO.etiqueta], opciones.desde + ' a ' + opciones.hasta],
      [['Generado el', ESTILO.etiqueta], fechaHora(ahora)],
      [['Generado por', ESTILO.etiqueta], opciones.generadoPor || null],
      [['Qué entra', ESTILO.etiqueta], 'Las fichas con consentimiento diligenciadas en el período (todas las visitas).'],
      [],
      [['Fichas', ESTILO.etiqueta], totales.fichas],
      [['Familias', ESTILO.etiqueta], totales.familias],
      [['Personas', ESTILO.etiqueta], totales.personas],
      [['Acciones del plan de cuidado', ESTILO.etiqueta], totales.acciones],
      [['Seguimientos', ESTILO.etiqueta], totales.seguimientos],
      [['Alertas', ESTILO.etiqueta], totales.alertas],
      [['Alertas inmediatas', ESTILO.etiqueta], totales.inmediatas],
      [],
      [['Hojas', ESTILO.etiqueta]],
      [['Fichas', ESTILO.etiqueta], 'Una fila por ficha: entorno, equipo, vivienda y resumen de alertas y plan.'],
      [['Familias', ESTILO.etiqueta], 'Una fila por familia caracterizada.'],
      [['Integrantes', ESTILO.etiqueta], 'Una fila por persona, con su caracterización de salud.'],
      [['Acciones', ESTILO.etiqueta], 'Acciones e intervenciones del plan de cuidado de la vivienda, la familia y la persona.'],
      [['Seguimientos', ESTILO.etiqueta], 'Seguimientos a la acción de cuidado concertada.'],
      [['Alertas', ESTILO.etiqueta], 'Lo que la ficha activa: prioridad, qué hacer y si ya tiene conducta registrada.'],
      [],
      [['Uso de la información', ESTILO.etiqueta], 'Contiene datos personales y datos sensibles de salud (Ley 1581 de 2012). ' +
        'Úselo sólo para la gestión institucional, no lo comparta por canales no autorizados y elimínelo cuando ya no lo necesite.']
    ],
    anchos: [30, 110]
  };

  const hoja = function (nombre, columnas, datos) {
    return { nombre: nombre, columnas: columnas.map(function (c) { return { titulo: c.titulo, grupo: c.grupo, ancho: c.ancho }; }), filas: datos };
  };
  const libro = crearLibro({
    titulo: 'Fichas de caracterización ' + opciones.desde + ' a ' + opciones.hasta,
    autor: 'Encuesta APS — Red de Salud de Ladera E.S.E.',
    fecha: ahora,
    hojas: [
      resumen,
      hoja('Fichas', columnasFicha, filas.ficha),
      hoja('Familias', columnasFamilia, filas.familia),
      hoja('Integrantes', columnasIntegrante, filas.integrante),
      hoja('Acciones', columnasAccion, filas.accion),
      hoja('Seguimientos', columnasSeguimiento, filas.seguimiento),
      hoja('Alertas', columnasAlerta, filas.alerta)
    ]
  });

  return {
    nombreArchivo: 'Fichas_caracterizacion_' + opciones.desde.replace(/-/g, '') + '_' + opciones.hasta.replace(/-/g, '') + '.xlsx',
    contenido: libro,
    totales: totales
  };
}

module.exports = { construirExcel, sinCodigoDeRegla };
