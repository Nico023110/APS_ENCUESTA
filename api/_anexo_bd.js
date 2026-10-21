/* =========================================================================
   Encuesta_APS — Persistencia de las variables del anexo técnico SI-APS
   -------------------------------------------------------------------------
   Las preguntas que añadió el anexo (anexo.js) no tienen SQL escrito a mano:
   su columna o su tabla puente salen de la misma declaración que generó la
   estructura (bd/gen_anexo.js). Aquí se escriben y se leen.

   Reglas de escritura, las mismas del resto de guardar_encuesta.js:
     - una respuesta AUSENTE (undefined) no toca la base: la ficha viene de un
       cliente anterior que no conoce la pregunta;
     - una pregunta que NO APLICA (su `visible` es falso) se guarda vacía
       aunque el cuerpo traiga un valor: el formulario la limpia al ocultarla,
       y un POST a mano no debe poder dejar respuestas incoherentes;
     - la selección múltiple se reemplaza completa (borrar y volver a
       insertar), para que una opción desmarcada desaparezca.

   Los nombres de tabla y columna salen de anexo.js, nunca del cuerpo de la
   petición: no hay datos del usuario concatenados en el SQL.
   ========================================================================= */

'use strict';

const { reemplazarPuentes } = require('./_puentes');
const { aLaVez } = require('./_db');

const LLAVE_POR_TABLA = {
  ficha: 'id',
  hogar: 'id',
  vivienda: 'ficha_id',
  familia_ficha: 'id',
  integrante: 'id'
};

function texto(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' ? null : t;
}

function entero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = parseInt(valor, 10);
  return Number.isNaN(n) ? null : n;
}

function valorSql(pregunta, valor) {
  return pregunta.tipo === 'entero' ? entero(valor) : texto(Array.isArray(valor) ? valor[0] : valor);
}

/**
 * Escribe las respuestas del anexo que viven en `tabla` para la fila `id`.
 * @param m        motor de reglas (obtenerMotor): trae anexo.js cargado
 * @param objeto   el nivel del modelo donde están las respuestas
 * @param lector   lector de respuestas para evaluar `visible`
 * @returns        cuántas filas de selección múltiple escribió
 */
async function escribirAnexo(cliente, m, tabla, id, objeto, lector) {
  if (!objeto || typeof objeto !== 'object') return 0;

  const preguntas = m.PREGUNTAS_ANEXO.filter(function (p) {
    return m.tablaDePregunta(p) === tabla && objeto[p.clave] !== undefined;
  });
  if (preguntas.length === 0) return 0;

  const asignaciones = [];
  const parametros = [];
  const puentes = [];
  let filas = 0;

  for (const pregunta of preguntas) {
    const aplica = m.esVisibleAnexo(pregunta, lector);
    const valor = objeto[pregunta.clave];

    if (pregunta.tipo === 'multiple') {
      /* Si no aplica, sólo se borra (lista vacía). */
      const codigos = aplica
        ? Array.from(new Set((Array.isArray(valor) ? valor : [valor]).map(texto).filter(function (c) { return c !== null; })))
        : [];
      puentes.push({
        tabla: m.tablaPuenteDePregunta(pregunta),
        columnaDueno: m.columnaPadreDePregunta(pregunta),
        codigos: codigos
      });
      filas += codigos.length;
      continue;
    }

    parametros.push(aplica ? valorSql(pregunta, valor) : null);
    asignaciones.push(m.columnaDePregunta(pregunta) + ' = $' + parametros.length);
  }

  /* Todas las selecciones múltiples de esta fila en una sola consulta. */
  await reemplazarPuentes(cliente, id, puentes);

  if (asignaciones.length > 0) {
    parametros.push(id);
    await cliente.query(
      'UPDATE aps.' + tabla + ' SET ' + asignaciones.join(', ') +
      ' WHERE ' + LLAVE_POR_TABLA[tabla] + ' = $' + parametros.length,
      parametros
    );
  }

  return filas;
}

function preguntasDeTabla(m, tabla) {
  const preguntas = m.PREGUNTAS_ANEXO.filter(function (p) { return m.tablaDePregunta(p) === tabla; });
  return {
    simples: preguntas.filter(function (p) { return p.tipo !== 'multiple'; }),
    multiples: preguntas.filter(function (p) { return p.tipo === 'multiple'; })
  };
}

/* Condición «columna = ANY($1)» sobre una lista de ids. */
function porIds(columna) {
  return columna + ' = ANY($1::bigint[])';
}

/**
 * Las consultas de leerAnexo, sin armar el resultado. `condicion(columna)`
 * devuelve el filtro SQL sobre la llave de la tabla o sobre la columna padre
 * de cada puente, con sus valores en `parametros` ($1…): por ids (porIds) o
 * por una subconsulta, para leer las filas de una ficha sin conocer aún sus
 * ids. La condición sale siempre del código, nunca de la petición.
 * Las respuestas únicas y las de selección múltiple se leen a la vez cuando
 * `cliente` es el pool (ver aLaVez en _db.js). Todas las tablas puente del
 * nivel van en una sola consulta: el archivo plano lee cientos de fichas y
 * una consulta por pregunta no escala.
 */
async function consultarAnexo(cliente, m, tabla, condicion, parametros) {
  const { simples, multiples } = preguntasDeTabla(m, tabla);
  const llave = LLAVE_POR_TABLA[tabla];

  const [filasSimples, filasMultiples] = await aLaVez(cliente, [
    function () {
      if (simples.length === 0) return null;
      const columnas = simples.map(function (p) {
        const col = m.columnaDePregunta(p);
        return p.tipo === 'fecha' ? "to_char(" + col + ", 'YYYY-MM-DD') AS " + col : col;
      });
      return cliente.query(
        'SELECT ' + llave + ' AS id, ' + columnas.join(', ') + ' FROM aps.' + tabla +
        ' WHERE ' + condicion(llave), parametros);
    },
    function () {
      if (multiples.length === 0) return null;
      const partes = multiples.map(function (pregunta, i) {
        const padre = m.columnaPadreDePregunta(pregunta);
        return 'SELECT ' + i + ' AS n, ' + padre + ' AS id, codigo FROM ' + m.tablaPuenteDePregunta(pregunta) +
          ' WHERE ' + condicion(padre);
      });
      return cliente.query(partes.join(' UNION ALL ') + ' ORDER BY n, codigo', parametros);
    }
  ]);
  return { filasSimples: filasSimples, filasMultiples: filasMultiples };
}

/**
 * Arma, con lo que trajo consultarAnexo, el resultado de leerAnexo para los
 * `ids` dados: cada uno con sus respuestas, y listas vacías en la selección
 * múltiple que no tenga filas.
 * @returns Map id → { clave: valor } con listas para la selección múltiple.
 */
function armarAnexo(m, tabla, ids, consulta) {
  const resultado = new Map();
  const lista = (ids || []).map(String);
  lista.forEach(function (id) { resultado.set(id, {}); });
  if (lista.length === 0) return resultado;

  const { simples, multiples } = preguntasDeTabla(m, tabla);
  const filasSimples = consulta.filasSimples;
  const filasMultiples = consulta.filasMultiples;

  if (filasSimples) {
    filasSimples.rows.forEach(function (fila) {
      const destino = resultado.get(String(fila.id));
      if (!destino) return;
      simples.forEach(function (p) {
        const valor = fila[m.columnaDePregunta(p)];
        destino[p.clave] = valor === undefined ? null : valor;
      });
    });
  }

  if (filasMultiples) {
    resultado.forEach(function (destino) {
      multiples.forEach(function (p) { destino[p.clave] = []; });
    });
    filasMultiples.rows.forEach(function (fila) {
      const destino = resultado.get(String(fila.id));
      if (destino) destino[multiples[fila.n].clave].push(fila.codigo);
    });
  }

  return resultado;
}

/**
 * Lee las respuestas del anexo de varias filas de una tabla a la vez.
 * @returns Map id → { clave: valor } con listas para la selección múltiple.
 */
async function leerAnexo(cliente, m, tabla, ids) {
  const lista = (ids || []).map(String);
  if (lista.length === 0) return armarAnexo(m, tabla, lista, {});
  return armarAnexo(m, tabla, lista, await consultarAnexo(cliente, m, tabla, porIds, [lista]));
}

/* =========================================================================
   Ítems del instrumento que el anexo volvió selección múltiple
   -------------------------------------------------------------------------
   La columna de siempre se conserva con la opción principal y la lista
   completa va a su tabla puente (ver 07_anexo_sispro.sql).
   ========================================================================= */

const LISTAS_CONVERTIDAS = [
  { campo: 'situacionInminente', tabla: 'aps.ficha_situacion_inminente', padre: 'ficha_id', nivel: 'ficha' },
  { campo: 'fuenteAgua', tabla: 'aps.vivienda_fuente_agua', padre: 'ficha_id', nivel: 'vivienda' },
  { campo: 'disposicionExcretas', tabla: 'aps.vivienda_disposicion_excretas', padre: 'ficha_id', nivel: 'vivienda' },
  { campo: 'aguasResiduales', tabla: 'aps.vivienda_aguas_residuales', padre: 'ficha_id', nivel: 'vivienda' },
  { campo: 'residuosSolidos', tabla: 'aps.vivienda_residuos_solidos', padre: 'ficha_id', nivel: 'vivienda' }
];

function comoLista(valor) {
  if (Array.isArray(valor)) return valor.map(texto).filter(function (v) { return v !== null; });
  const t = texto(valor);
  return t === null ? [] : [t];
}

/**
 * La opción que va en la columna de siempre. Para la situación inminente, la
 * primera que exige atención prioritaria (la que decide la alerta RN-201);
 * para lo demás, la primera marcada.
 */
function opcionPrincipal(m, campo, valor) {
  const lista = comoLista(valor);
  if (lista.length === 0) return null;
  if (campo === 'situacionInminente' && typeof m.situacionesPrioritarias === 'function') {
    return m.situacionesPrioritarias(lista)[0] || lista[0];
  }
  return lista[0];
}

async function escribirListasConvertidas(cliente, nivel, id, objeto) {
  const puentes = LISTAS_CONVERTIDAS
    .filter(function (def) { return def.nivel === nivel && objeto[def.campo] !== undefined; })
    .map(function (def) {
      return { tabla: def.tabla, columnaDueno: def.padre, codigos: Array.from(new Set(comoLista(objeto[def.campo]))) };
    });
  await reemplazarPuentes(cliente, id, puentes);
  return puentes.reduce(function (total, p) { return total + p.codigos.length; }, 0);
}

/** @returns Map fichaId → { campo: [códigos] }, para varias fichas a la vez. */
async function leerListasConvertidas(cliente, fichaIds) {
  const salida = new Map();
  const lista = (fichaIds || []).map(String);
  lista.forEach(function (id) {
    const vacio = {};
    LISTAS_CONVERTIDAS.forEach(function (def) { vacio[def.campo] = []; });
    salida.set(id, vacio);
  });
  if (lista.length === 0) return salida;

  const partes = LISTAS_CONVERTIDAS.map(function (def, i) {
    return 'SELECT ' + i + ' AS n, ' + def.padre + ' AS id, codigo FROM ' + def.tabla +
      ' WHERE ' + def.padre + ' = ANY($1::bigint[])';
  });
  const r = await cliente.query(partes.join(' UNION ALL ') + ' ORDER BY n, codigo', [lista]);
  r.rows.forEach(function (fila) {
    const destino = salida.get(String(fila.id));
    if (destino) destino[LISTAS_CONVERTIDAS[fila.n].campo].push(fila.codigo);
  });
  return salida;
}

module.exports = {
  escribirAnexo,
  leerAnexo,
  consultarAnexo,
  armarAnexo,
  escribirListasConvertidas,
  leerListasConvertidas,
  opcionPrincipal,
  comoLista
};
