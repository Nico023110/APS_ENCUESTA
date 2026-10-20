/* =========================================================================
   Encuesta_APS — Bloqueo del plan de cuidado registrado (RN-228)
   -------------------------------------------------------------------------
   Lo que ya está guardado en el plan de cuidado de una ficha no se cambia:
   sólo se completa. Se compara el plan que está en la base con el que llega
   y se devuelve lo que se cambió o se quitó de lo registrado:

     acción o seguimiento     no se quita; lo que tiene escrito no se
     registrado               cambia; lo que tiene vacío se completa.
     plan de un ámbito        no desaparece si tenía algo registrado.

   Nada del plan es obligatorio (RN-222): la base guarda toda fila con algo
   escrito, aunque esté a medias, y ésa es la que cuenta como registrada.
   Las filas se comparan en su orden —el formulario conserva el de la base y
   agrega lo nuevo al final—.

   Cambiar lo registrado exige autorización (aps.permiso_plan); quien decide
   si la hay es guardar_encuesta.js. Esto sólo dice qué cambió.

   Función pura sobre dos fichas ya leídas: no toca la base.
   ========================================================================= */

'use strict';

const CAMPOS_ACCION = [
  'ejecutorTipoId', 'ejecutorNumeroId', 'codigoAccion', 'procedimientoRealizado',
  'tipoRespuesta', 'institucionDestino', 'fechaCita'
];

const CAMPOS_SEGUIMIENTO = ['seguimientoTipoId', 'seguimientoNumeroId', 'accionConcertada'];

const TRAMOS_SEGUIMIENTO = [
  { nombre: 'primer seguimiento', fecha: 'seg1Fecha', campos: ['seg1Fecha', 'seg1Estado', 'seg1MotivoNc'] },
  { nombre: 'segundo seguimiento', fecha: 'seg2Fecha', campos: ['seg2Fecha', 'seg2Estado', 'seg2MotivoNc'] }
];

/* Vacío, espacios y null valen lo mismo; una fecha con hora se compara por
   su día, que es lo que guarda la base. */
function normal(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (texto === '') return null;
  return /^\d{4}-\d{2}-\d{2}T/.test(texto) ? texto.slice(0, 10) : texto;
}

/* RN-222: nada del plan es obligatorio, así que la base guarda toda fila
   con algo escrito, aunque esté a medias. Ésas son las registradas; dentro de
   ellas, lo que ya tiene valor no se cambia y lo vacío se completa. Cada una
   lleva su posición en el arreglo original para que el aviso señale el campo
   exacto en el formulario. */
function filaConAlgo(fila) {
  return Object.keys(fila || {}).some(function (campo) {
    const valor = fila[campo];
    return Array.isArray(valor) ? valor.length > 0 : normal(valor) !== null;
  });
}

function accionesGuardadas(plan) {
  return ((plan && Array.isArray(plan.acciones)) ? plan.acciones : [])
    .map(function (accion, indice) { return { item: accion || {}, indice: indice }; })
    .filter(function (a) { return filaConAlgo(a.item); });
}

function seguimientosGuardados(plan) {
  return ((plan && Array.isArray(plan.seguimientos)) ? plan.seguimientos : [])
    .map(function (seguimiento, indice) { return { item: seguimiento || {}, indice: indice }; })
    .filter(function (s) { return filaConAlgo(s.item); });
}

/* El primer campo que tenía valor y ya no lo tiene igual. */
function campoCambiado(campos, antes, despues) {
  return campos.find(function (campo) {
    return normal(antes[campo]) !== null && normal(antes[campo]) !== normal(despues[campo]);
  });
}

function nombreDe(integrante) {
  const nombre = [integrante.primerNombre, integrante.primerApellido].filter(Boolean).join(' ').trim();
  return nombre || 'el integrante';
}

/* Los planes de una ficha por ámbito. La familia se reconoce por su posición
   —es su consecutivo F— y la persona por su documento dentro de esa familia;
   si el documento se corrigió, por su posición. */
function planesDe(encuesta) {
  const planes = [];
  if (!encuesta) return planes;

  if (encuesta.planVivienda) {
    planes.push({ claves: ['vivienda'], ruta: 'planVivienda', etiqueta: 'el plan de la vivienda',
      plan: encuesta.planVivienda });
  }

  (encuesta.familias || []).forEach(function (familia, fi) {
    if (!familia) return;
    if (familia.planFamilia) {
      planes.push({ claves: ['familia:' + fi], ruta: 'familias[' + fi + '].planFamilia',
        etiqueta: 'el plan de la familia ' + (fi + 1), plan: familia.planFamilia });
    }
    (familia.integrantes || []).forEach(function (integrante, ii) {
      if (!integrante || !integrante.planPersona) return;
      planes.push({
        claves: ['persona:' + fi + ':' + normal(integrante.tipoId) + '|' + normal(integrante.numeroId),
          'persona:' + fi + ':#' + ii],
        ruta: 'familias[' + fi + '].integrantes[' + ii + '].planPersona',
        etiqueta: 'el plan de ' + nombreDe(integrante),
        plan: integrante.planPersona
      });
    });
  });

  return planes;
}

function buscar(planes, claves) {
  for (let i = 0; i < claves.length; i++) {
    const encontrado = planes.find(function (p) { return p.claves.indexOf(claves[i]) !== -1; });
    if (encontrado) return encontrado;
  }
  return null;
}

function bloqueo(ruta, mensaje) {
  return {
    codigo: 'RN-228',
    ruta: ruta,
    campo: ruta.split('.').pop().replace(/\[\d+\]$/, ''),
    mensaje: mensaje,
    severidad: 'bloqueo',
    ambito: 'plan'
  };
}

/**
 * Lo que `nueva` cambia o quita de lo registrado en el plan de `anterior`.
 * @returns {Array} bloqueos RN-228; vacío si sólo se completó lo que faltaba.
 */
function cambiosEnPlanRegistrado(anterior, nueva) {
  const cambios = [];
  const ahora = planesDe(nueva);

  planesDe(anterior).forEach(function (registrado) {
    const accionesAntes = accionesGuardadas(registrado.plan);
    const seguimientosAntes = seguimientosGuardados(registrado.plan);
    if (accionesAntes.length === 0 && seguimientosAntes.length === 0) return;

    const actual = buscar(ahora, registrado.claves);
    if (!actual) {
      cambios.push(bloqueo(registrado.ruta,
        'Se quitó ' + registrado.etiqueta + ', que ya tiene acciones o seguimientos registrados.'));
      return;
    }

    const accionesAhora = accionesGuardadas(actual.plan);
    accionesAntes.forEach(function (antes, n) {
      const despues = accionesAhora[n];
      if (!despues) {
        cambios.push(bloqueo(actual.ruta + '.acciones[' + antes.indice + ']',
          'Se quitó la acción ' + (n + 1) + ' de ' + actual.etiqueta + ', que ya está registrada.'));
        return;
      }
      const distinto = campoCambiado(CAMPOS_ACCION, antes.item, despues.item);
      if (distinto) {
        cambios.push(bloqueo(actual.ruta + '.acciones[' + despues.indice + '].' + distinto,
          'La acción ' + (n + 1) + ' de ' + actual.etiqueta + ' ya está registrada: lo que tiene escrito ' +
          'no se puede cambiar; sólo se completa lo que falta.'));
      }
    });

    const seguimientosAhora = seguimientosGuardados(actual.plan);
    seguimientosAntes.forEach(function (antes, n) {
      const despues = seguimientosAhora[n];
      if (!despues) {
        cambios.push(bloqueo(actual.ruta + '.seguimientos[' + antes.indice + ']',
          'Se quitó el seguimiento ' + (n + 1) + ' de ' + actual.etiqueta + ', que ya está registrado.'));
        return;
      }
      const prefijo = actual.ruta + '.seguimientos[' + despues.indice + '].';
      const distinto = campoCambiado(CAMPOS_SEGUIMIENTO, antes.item, despues.item);
      if (distinto) {
        cambios.push(bloqueo(prefijo + distinto,
          'El seguimiento ' + (n + 1) + ' de ' + actual.etiqueta + ' ya está registrado: ' +
          'su responsable y la acción concertada, una vez escritos, no se pueden cambiar.'));
      }
      TRAMOS_SEGUIMIENTO.forEach(function (tramo) {
        const cambiado = campoCambiado(tramo.campos, antes.item, despues.item);
        if (cambiado) {
          cambios.push(bloqueo(prefijo + cambiado,
            'El ' + tramo.nombre + ' del seguimiento ' + (n + 1) + ' de ' + actual.etiqueta +
            ' ya está registrado y no se puede cambiar.'));
        }
      });
    });
  });

  return cambios;
}

/* Las rutas del plan dentro de una ficha enrutada, para separar sus
   bloqueos de los del resto de la ficha cuando sólo se evoluciona el plan. */
const RUTA_DEL_PLAN = /^planVivienda\b|\.planFamilia\b|\.planPersona\b/;

function esDelPlan(ruta) {
  return RUTA_DEL_PLAN.test(String(ruta || ''));
}

module.exports = { cambiosEnPlanRegistrado, esDelPlan, accionesGuardadas, seguimientosGuardados };
