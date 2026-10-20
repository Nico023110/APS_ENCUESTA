/* =========================================================================
   Encuesta_APS — Tablas puente en una sola ida y vuelta
   -------------------------------------------------------------------------
   POR QUÉ EXISTE

   Cada respuesta de selección múltiple vive en su tabla puente y se
   reescribe entera al guardar: se borra lo que había y se inserta lo que
   llegó (ver sincronizarPuentes en guardar_encuesta.js). Hasta octubre de
   2026 eso era un DELETE por campo y un INSERT por cada opción marcada:
   unas 140 de las 190 consultas de una ficha de tres integrantes. Contra
   Neon desde Cali cada consulta tarda ~125 ms, y guardar una ficha se iba a
   más de 20 segundos.

   Aquí todas las tablas puente de un mismo dueño se reescriben en una sola
   sentencia: por cada tabla, un DELETE y un INSERT con las opciones en un
   arreglo, encadenados con WITH. El INSERT lee lo que devolvió su DELETE,
   así que se ejecuta después de él: el resultado es el mismo de antes, en
   el mismo orden, dentro de la misma transacción.

   SEGURIDAD

   Los nombres de tabla y de columna salen de definiciones del servidor
   (constantes de guardar_encuesta.js y del anexo), nunca de la petición. Lo
   que escribe el encuestador viaja sólo como parámetro: el id del dueño en
   $1 y cada lista de opciones como $n::text[].
   ========================================================================= */

'use strict';

/* Defensa adicional: un identificador SQL de las definiciones tiene que ser
   «esquema.tabla» o «columna» en minúsculas. Si algún día una definición se
   arma con datos externos, esto falla en vez de inyectar. */
const IDENTIFICADOR = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

function identificador(nombre) {
  if (!IDENTIFICADOR.test(String(nombre))) {
    throw new Error('Identificador de tabla puente no válido: ' + nombre);
  }
  return nombre;
}

/**
 * Reescribe varias tablas puente de un mismo dueño en una sola consulta.
 *
 * @param cliente   conexión dentro de la transacción del guardado
 * @param duenoId   id de la fila dueña (ficha, familia_ficha o integrante)
 * @param cambios   [{ tabla, columnaDueno, codigos, otroCual?, sinConflicto? }]
 *                  codigos: lista ya depurada; vacía = sólo borrar.
 *                  otroCual (opcional): texto del aclaratorio de «Otro»; si
 *                  viene la clave, se escribe en otro_cual sólo para 'otro'.
 *                  sinConflicto: añade ON CONFLICT DO NOTHING.
 */
async function reemplazarPuentes(cliente, duenoId, cambios) {
  if (!Array.isArray(cambios) || cambios.length === 0) return;

  const parametros = [duenoId];
  const partes = [];

  cambios.forEach(function (cambio, i) {
    const tabla = identificador(cambio.tabla);
    const columna = identificador(cambio.columnaDueno);

    partes.push('b' + i + ' AS (DELETE FROM ' + tabla + ' WHERE ' + columna + ' = $1::bigint RETURNING 1)');
    if (!Array.isArray(cambio.codigos) || cambio.codigos.length === 0) return;

    parametros.push(cambio.codigos.map(function (c) { return c === null || c === undefined ? null : String(c); }));
    const lista = '$' + parametros.length + '::text[]';

    let columnas = columna + ', codigo';
    let valores = '$1::bigint, u.codigo';
    if (Object.prototype.hasOwnProperty.call(cambio, 'otroCual')) {
      parametros.push(cambio.otroCual === undefined ? null : cambio.otroCual);
      columnas += ', otro_cual';
      valores += ", CASE WHEN u.codigo = 'otro' THEN $" + parametros.length + '::text END';
    }

    partes.push('i' + i + ' AS (INSERT INTO ' + tabla + ' (' + columnas + ') SELECT ' + valores +
      ' FROM unnest(' + lista + ') WITH ORDINALITY AS u(codigo, n)' +
      ' WHERE (SELECT count(*) FROM b' + i + ') >= 0 ORDER BY u.n' +
      (cambio.sinConflicto ? ' ON CONFLICT DO NOTHING' : '') + ' RETURNING 1)');
  });

  await cliente.query('WITH ' + partes.join(',\n') + '\nSELECT 1', parametros);
}

module.exports = { reemplazarPuentes };
