/* =========================================================================
   Respuestas válidas para las variables del anexo técnico SI-APS
   -------------------------------------------------------------------------
   Las pruebas arman fichas completas a mano. Desde que el anexo técnico
   añadió sus variables obligatorias (anexo.js), una ficha sin ellas ya no
   cierra, y cada prueba tendría que repetir las mismas decenas de campos.
   Aquí quedan una vez, con la forma del modelo que produce el formulario.

   Sólo las OBLIGATORIAS y visibles en una ficha típica: una vivienda urbana
   sin tanque, con transporte público, y un integrante adulto colombiano.
   ========================================================================= */

'use strict';

function viviendaAnexo() {
  return {
    tipoUbicacion: 'barrio',
    ambientesLuzNatural: ['cocina', 'sala_comedor'],
    ambientesVentilacion: ['cocina', 'sala_comedor'],
    elementosVivienda: ['lavamanos', 'lavaplatos'],
    alumbrado: 'electrica',
    cocinaSeparada: 'si',
    banoSeparado: 'si',
    dormitoriosSeparados: 'si',
    accesoVivienda: 'transporte',
    mediosTransporte: ['publico'],
    seguridadDesplazamiento: ['ninguno'],
    desplazamientoMayor30: ['distancias'],
    horasSuministroAgua: '24h',
    tanqueAlmacenamiento: 'no_tiene',
    almacenamientoResiduos: ['con_tapa'],
    conocePracticasResiduos: 'si',
    realizaReduccionResiduos: 'no',
    realizaAprovechamientoResiduos: 'no',
    disposicionResiduosPeligrosos: ['con_ordinarios'],
    reduccionSeparacionRural: 'no',
    limpiezaSuperficies: 'agua_jabon',
    energiaCocinar: ['gas_natural'],
    fuentesHumo: ['no_aplica'],
    practicasCalidadAire: ['polvillo'],
    tipoEstufa: ['convencional_buena'],
    vectoresPresentes: ['cucarachas'],
    medidasControlVectores: ['residuos_higienicos'],
    animalesPonzonosos: ['no_aplica'],
    lugarQuimicos: 'tienda_barrio',
    disposicionQuimicos: ['con_ordinarios'],
    instruccionesQuimicos: 'si',
    envaseOriginalQuimicos: 'si',
    proteccionLimpieza: 'si'
  };
}

function familiaAnexo() {
  return {
    aliasFamilia: 'Familia Gomez',
    apgarFamiliar: 'alta',
    medidasRespiratorias: 'tapabocas',
    higieneCompartida: 'no'
  };
}

function integranteAnexo() {
  return {
    lavadoManos: 'si',
    urgenciasAccidente: ['no_aplica'],
    tieneDiagnostico: 'no',
    sintomasSinDiagnostico: 'no',
    consumoTabaco: 'no_aplica'
  };
}

/* Completa una ficha del modelo con lo que le falte del anexo, sin pisar lo
   que la prueba haya puesto a propósito. */
function completarAnexo(datos) {
  const completar = function (destino, fuente) {
    Object.keys(fuente).forEach(function (clave) {
      if (destino[clave] === undefined) destino[clave] = fuente[clave];
    });
    return destino;
  };
  completar(datos, viviendaAnexo());
  (datos.familias || []).forEach(function (familia) {
    completar(familia, familiaAnexo());
    (familia.integrantes || []).forEach(function (integrante) {
      completar(integrante, integranteAnexo());
      if (integrante.riesgosSaludMentalJoven === undefined) integrante.riesgosSaludMentalJoven = ['ninguna'];
    });
  });
  return datos;
}

module.exports = { viviendaAnexo, familiaAnexo, integranteAnexo, completarAnexo };
