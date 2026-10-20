/* =========================================================================
   Encuesta_APS — Completar integrantes de una ficha guardada (RN-051)
   -------------------------------------------------------------------------
   Si un integrante declarado en el ítem 51 no estaba en la visita, la ficha
   se guarda con los que sí estaban (RN-051 advierte, no bloquea) y el resto
   se agrega después desde el historial, con «Completar integrantes». Lo
   puede hacer quien evoluciona el plan de esa ficha, sin autorización,
   porque no cambia nada de lo registrado: sólo agrega.

   Se compara la ficha que está en la base con la que llega y se decide:

     familias              las mismas, en el mismo orden; no se agregan ni
                           se quitan.
     integrantes guardados los mismos, en su orden (por tipo y número de
                           documento). Lo que llegue de ellos se ignora: el
                           servidor no los vuelve a escribir.
     integrantes nuevos    los que llegan después de los guardados; no
                           pueden ser alguien que ya esté en la ficha.
     ítem 51               puede aumentar —apareció alguien que no se
                           declaró—, no disminuir: bajarlo es corregir la
                           ficha, y eso pide autorización (RN-228).

   Función pura sobre dos fichas ya leídas: no toca la base.
   ========================================================================= */

'use strict';

function texto(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' ? null : t;
}

function documentoDe(integrante) {
  return (texto(integrante && integrante.tipoId) || '') + ' ' + (texto(integrante && integrante.numeroId) || '');
}

function bloqueo(ruta, campo, mensaje) {
  return { codigo: 'RN-051', ruta: ruta, campo: campo, severidad: 'bloqueo', mensaje: mensaje };
}

/**
 * @param guardada  la ficha como está en la base (leerFichaCompleta)
 * @param recibida  la ficha que llega para completar sus integrantes
 * @returns {{ bloqueos, nuevos, aumentos }}
 *   nuevos   [{ familia, desde, hasta }]: índices de los integrantes nuevos
 *            de cada familia (desde incluido, hasta excluido)
 *   aumentos [{ familia, numeroIntegrantes }]: ítem 51 que subió
 */
function revisarIntegrantesNuevos(guardada, recibida) {
  const bloqueos = [];
  const nuevos = [];
  const aumentos = [];

  const familiasGuardadas = Array.isArray(guardada && guardada.familias) ? guardada.familias : [];
  const familiasRecibidas = Array.isArray(recibida && recibida.familias) ? recibida.familias : [];

  if (familiasRecibidas.length !== familiasGuardadas.length) {
    bloqueos.push(bloqueo('familias', 'familias',
      'Al completar integrantes no se agregan ni se quitan familias: la ficha tiene ' +
      familiasGuardadas.length + '. Para cambiarlas hace falta corregir la ficha, con autorización.'));
    return { bloqueos: bloqueos, nuevos: nuevos, aumentos: aumentos };
  }

  const registrados = new Set();
  familiasGuardadas.forEach(function (familia) {
    (familia.integrantes || []).forEach(function (integrante) { registrados.add(documentoDe(integrante)); });
  });
  const vistosNuevos = new Set();

  familiasGuardadas.forEach(function (guardadaFamilia, fi) {
    const recibidaFamilia = familiasRecibidas[fi] || {};
    const base = 'familias[' + fi + ']';
    const antes = Array.isArray(guardadaFamilia.integrantes) ? guardadaFamilia.integrantes : [];
    const ahora = Array.isArray(recibidaFamilia.integrantes) ? recibidaFamilia.integrantes : [];
    const declaradoAntes = Number(guardadaFamilia.numeroIntegrantes) || antes.length;
    const declarado = Number(recibidaFamilia.numeroIntegrantes);

    if (!Number.isInteger(declarado) || declarado < declaradoAntes) {
      bloqueos.push(bloqueo(base + '.numeroIntegrantes', 'numeroIntegrantes',
        'La familia tenía ' + declaradoAntes + ' integrantes declarados (ítem 51): al completar integrantes ' +
        'puede aumentar, no disminuir.'));
    } else if (declarado > declaradoAntes) {
      aumentos.push({ familia: fi, numeroIntegrantes: declarado });
    }

    if (ahora.length < antes.length) {
      bloqueos.push(bloqueo(base + '.integrantes', 'integrantes',
        'Los integrantes ya registrados no se quitan al completar integrantes.'));
      return;
    }

    let cambiaron = false;
    antes.forEach(function (integrante, ii) {
      if (documentoDe(integrante) !== documentoDe(ahora[ii])) {
        cambiaron = true;
        bloqueos.push(bloqueo(base + '.integrantes[' + ii + ']', 'numeroId',
          'Los integrantes ya registrados no cambian al completar integrantes: sólo se agregan los que faltaban.'));
      }
    });
    if (cambiaron) return;

    for (let ii = antes.length; ii < ahora.length; ii++) {
      const documento = documentoDe(ahora[ii]);
      if (texto(ahora[ii] && ahora[ii].numeroId) && (registrados.has(documento) || vistosNuevos.has(documento))) {
        bloqueos.push(bloqueo(base + '.integrantes[' + ii + '].numeroId', 'numeroId',
          'Esta persona ya está en la ficha: no se agrega dos veces.'));
      }
      vistosNuevos.add(documento);
    }

    if (ahora.length > antes.length) nuevos.push({ familia: fi, desde: antes.length, hasta: ahora.length });
  });

  if (bloqueos.length === 0 && nuevos.length === 0 && aumentos.length === 0) {
    bloqueos.push(bloqueo('familias', 'integrantes',
      'No agregó ningún integrante: complete el bloque del integrante que faltaba antes de guardar.'));
  }

  return { bloqueos: bloqueos, nuevos: nuevos, aumentos: aumentos };
}

/* ¿La ruta es de un integrante nuevo? (`familias[0].integrantes[2].peso`) */
function esDeIntegranteNuevo(ruta, nuevos) {
  const coincidencia = /^familias\[(\d+)\]\.integrantes\[(\d+)\]/.exec(String(ruta || ''));
  if (!coincidencia) return false;
  const fi = Number(coincidencia[1]);
  const ii = Number(coincidencia[2]);
  return (nuevos || []).some(function (n) { return n.familia === fi && ii >= n.desde && ii < n.hasta; });
}

/* Lo que se revisa al completar integrantes: el plan, los integrantes nuevos,
   el ítem 51 y lo que los nuevos pueden romper aunque viva en otra parte de
   la ficha —más integrantes que personas en la vivienda (RN-029)—. El resto
   ya está registrado y no se vuelve a escribir. */
function cuentaAlCompletar(item, nuevos, esDelPlan) {
  const ruta = item && item.ruta;
  return esDelPlan(ruta) ||
    esDeIntegranteNuevo(ruta, nuevos) ||
    /^familias\[\d+\]\.numeroIntegrantes$/.test(String(ruta || '')) ||
    (item && item.codigo === 'RN-029');
}

module.exports = { revisarIntegrantesNuevos, esDeIntegranteNuevo, cuentaAlCompletar };
