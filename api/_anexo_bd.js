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
  let filas = 0;

  for (const pregunta of preguntas) {
    const aplica = m.esVisibleAnexo(pregunta, lector);
    const valor = objeto[pregunta.clave];

    if (pregunta.tipo === 'multiple') {
      const puente = m.tablaPuenteDePregunta(pregunta);
      const padre = m.columnaPadreDePregunta(pregunta);
      await cliente.query('DELETE FROM ' + puente + ' WHERE ' + padre + ' = $1', [id]);
      if (!aplica) continue;

      const codigos = (Array.isArray(valor) ? valor : [valor]).map(texto).filter(function (c) { return c !== null; });
      for (const codigo of Array.from(new Set(codigos))) {
        await cliente.query('INSERT INTO ' + puente + ' (' + padre + ', codigo) VALUES ($1, $2)', [id, codigo]);
        filas++;
      }
      continue;
    }

    parametros.push(aplica ? valorSql(pregunta, valor) : null);
    asignaciones.push(m.columnaDePregunta(pregunta) + ' = $' + parametros.length);
  }

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

/**
 * Lee las respuestas del anexo de varias filas de una tabla a la vez.
 * @returns Map id → { clave: valor } con listas para la selección múltiple.
 */
async function leerAnexo(cliente, m, tabla, ids) {
  const resultado = new Map();
  const lista = (ids || []).map(String);
  lista.forEach(function (id) { resultado.set(id, {}); });
  if (lista.length === 0) return resultado;

  const preguntas = m.PREGUNTAS_ANEXO.filter(function (p) { return m.tablaDePregunta(p) === tabla; });
  const simples = preguntas.filter(function (p) { return p.tipo !== 'multiple'; });
  const llave = LLAVE_POR_TABLA[tabla];

  if (simples.length > 0) {
    const columnas = simples.map(function (p) {
      const col = m.columnaDePregunta(p);
      return p.tipo === 'fecha' ? "to_char(" + col + ", 'YYYY-MM-DD') AS " + col : col;
    });
    const filas = await cliente.query(
      'SELECT ' + llave + ' AS id, ' + columnas.join(', ') + ' FROM aps.' + tabla +
      ' WHERE ' + llave + ' = ANY($1::bigint[])', [lista]);
    filas.rows.forEach(function (fila) {
      const destino = resultado.get(String(fila.id));
      if (!destino) return;
      simples.forEach(function (p) {
        const valor = fila[m.columnaDePregunta(p)];
        destino[p.clave] = valor === undefined ? null : valor;
      });
    });
  }

  /* Todas las tablas puente del nivel en una sola consulta: el archivo plano
     lee cientos de fichas y una consulta por pregunta no escala. */
  const multiples = preguntas.filter(function (p) { return p.tipo === 'multiple'; });
  if (multiples.length > 0) {
    resultado.forEach(function (destino) {
      multiples.forEach(function (p) { destino[p.clave] = []; });
    });
    const partes = multiples.map(function (pregunta, i) {
      const padre = m.columnaPadreDePregunta(pregunta);
      return 'SELECT ' + i + ' AS n, ' + padre + ' AS id, codigo FROM ' + m.tablaPuenteDePregunta(pregunta) +
        ' WHERE ' + padre + ' = ANY($1::bigint[])';
    });
    const filas = await cliente.query(partes.join(' UNION ALL ') + ' ORDER BY n, codigo', [lista]);
    filas.rows.forEach(function (fila) {
      const destino = resultado.get(String(fila.id));
      if (destino) destino[multiples[fila.n].clave].push(fila.codigo);
    });
  }

  return resultado;
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
  let filas = 0;
  for (const def of LISTAS_CONVERTIDAS) {
    if (def.nivel !== nivel || objeto[def.campo] === undefined) continue;
    await cliente.query('DELETE FROM ' + def.tabla + ' WHERE ' + def.padre + ' = $1', [id]);
    for (const codigo of Array.from(new Set(comoLista(objeto[def.campo])))) {
      await cliente.query('INSERT INTO ' + def.tabla + ' (' + def.padre + ', codigo) VALUES ($1, $2)', [id, codigo]);
      filas++;
    }
  }
  return filas;
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
  escribirListasConvertidas,
  leerListasConvertidas,
  opcionPrincipal,
  comoLista
};
