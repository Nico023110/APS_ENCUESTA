/* =========================================================================
   Encuesta_APS — Clasificación del estado nutricional (RN-096, ítem 96)
   -------------------------------------------------------------------------
   Resolución 2465 de 2016 (Minsalud), anexo técnico:
     menores de 5 años   peso para la talla (P/T)          Cuadro 2
     5 a 17 años         IMC para la edad (IMC/E)          Cuadro 3
     18 a 64 años        IMC                               Cuadro 7
     gestantes adultas   IMC para la edad gestacional      Cuadro 12 (Atalah)
   con las tablas de la OMS (antropometria_tablas.js).

   Sólo calcula y dice por qué. Cuando la norma no alcanza —65 años o más,
   gestante sin fecha probable de parto o menor de 18 años, medidas fuera de
   las tablas— devuelve valor null y el motivo: la elige quien caracteriza. La
   misma norma exceptúa a quien tiene una condición que altere sus medidas
   (art. 3, par. 1), así que el resultado siempre se puede cambiar.

   No es una regla que bloquee: el servidor no la exige (un teléfono con la
   versión anterior manda la clasificación marcada a mano).

   `clasificarEstadoNutricional({ sexo, edad, peso, talla, gestante, semanas })`
     sexo    'hombre' | 'mujer' (el del ítem de la persona)
     edad    la de calcularEdad(): { anios, meses, dias, totalMeses }
     peso    kg     talla  cm
     semanas de gestación (semanasDeGestacion), sólo si gestante
   → { valor, etiqueta?, indicador, detalle, extremo, motivo }
   ========================================================================= */

(function (raiz, fabrica) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = fabrica(require('./antropometria_tablas.js'));
  else raiz.ANTROPOMETRIA = fabrica(raiz.TABLAS_OMS);
})(typeof window !== 'undefined' ? window : this, function (TABLAS) {
  'use strict';

  const MESES_LONGITUD = 24;              // acostado antes de los 2 años; de pie desde ahí
  const MESES_5_ANIOS = 60;
  const MESES_18_ANIOS = 216;
  const EDAD_MAXIMA_ADULTO = 64;
  const SEMANA_MINIMA = 6;
  const SEMANA_MAXIMA = 42;

  /* Cuadro 12 (Atalah): para cada semana, el límite superior de bajo peso, el
     superior de adecuado y el superior de sobrepeso, en kg/m² con un decimal. La
     resolución trae la semana 26 con 27,2 en dos franjas: se toma como adecuado. */
  const ATALAH = {
    6: [20.0, 24.9, 30.0], 7: [20.1, 24.9, 30.0], 8: [20.2, 25.0, 30.1], 9: [20.2, 25.1, 30.2],
    10: [20.3, 25.2, 30.2], 11: [20.4, 25.3, 30.3], 12: [20.5, 25.4, 30.3], 13: [20.7, 25.6, 30.4],
    14: [20.8, 25.7, 30.5], 15: [20.9, 25.8, 30.6], 16: [21.1, 25.9, 30.7], 17: [21.2, 26.0, 30.8],
    18: [21.3, 26.1, 30.9], 19: [21.5, 26.2, 30.9], 20: [21.6, 26.3, 31.0], 21: [21.8, 26.4, 31.1],
    22: [21.9, 26.6, 31.2], 23: [22.1, 26.7, 31.3], 24: [22.3, 26.9, 31.5], 25: [22.5, 27.0, 31.6],
    26: [22.7, 27.2, 31.7], 27: [22.8, 27.3, 31.8], 28: [23.0, 27.5, 31.9], 29: [23.2, 27.6, 32.0],
    30: [23.4, 27.8, 32.1], 31: [23.5, 27.9, 32.2], 32: [23.7, 28.0, 32.3], 33: [23.9, 28.1, 32.4],
    34: [24.0, 28.3, 32.5], 35: [24.2, 28.4, 32.6], 36: [24.3, 28.5, 32.7], 37: [24.5, 28.7, 32.8],
    38: [24.6, 28.8, 32.9], 39: [24.8, 28.9, 33.0], 40: [25.0, 29.1, 33.1], 41: [25.1, 29.2, 33.2],
    42: [25.1, 29.2, 33.2]
  };

  function esPositivo(n) { return typeof n === 'number' && isFinite(n) && n > 0; }

  function redondear(n, decimales) {
    const factor = Math.pow(10, decimales);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  function texto(n, decimales) { return n.toFixed(decimales).replace('.', ','); }

  /* z de Cole (LMS) de la medida `y`. */
  function puntajeZ(y, l, m, s) {
    return Math.abs(l) < 1e-9 ? Math.log(y / m) / s : (Math.pow(y / m, l) - 1) / (l * s);
  }

  function lecturaLms(tabla, i) {
    return { l: Array.isArray(tabla.L) ? tabla.L[i] : tabla.L, m: tabla.M[i], s: tabla.S[i] };
  }

  /* La fila de una medida en una tabla con paso fijo; null si está fuera. */
  function filaDe(tabla, valor) {
    const i = Math.round((valor - tabla.inicio) / tabla.paso);
    return i < 0 || i >= tabla.M.length ? null : i;
  }

  function sinClasificar(motivo, indicador) {
    return { valor: null, indicador: indicador || null, detalle: null, extremo: false, motivo: motivo };
  }

  function resultado(valor, indicador, detalle, extremo) {
    return { valor: valor, indicador: indicador, detalle: detalle, extremo: Boolean(extremo), motivo: null };
  }

  /* -------- menores de 5 años: peso para la talla (Cuadro 2) -------- */
  function clasificarPesoTalla(sexo, meses, peso, talla) {
    const acostado = meses < MESES_LONGITUD;
    const tabla = (acostado ? TABLAS.longitud : TABLAS.talla)[sexo];
    const indicador = 'peso para la ' + (acostado ? 'longitud' : 'talla');
    const i = filaDe(tabla, talla);
    if (i === null) {
      return sinClasificar('La talla (' + texto(talla, 1) + ' cm) está fuera de la tabla de la OMS para su edad (' +
        texto(tabla.inicio, 0) + ' a ' + texto(tabla.inicio + (tabla.M.length - 1) * tabla.paso, 0) + ' cm): revísela o elija la clasificación.', indicador);
    }
    const f = lecturaLms(tabla, i);
    const z = puntajeZ(peso, f.l, f.m, f.s);
    const valor = z > 3 ? 'obesidad' : z > 2 ? 'sobrepeso' : z > 1 ? 'riesgo_sobrepeso'
      : z >= -1 ? 'peso_adecuado' : z >= -2 ? 'riesgo_desnutricion' : z >= -3 ? 'desnutricion_moderada' : 'desnutricion_severa';
    return resultado(valor, indicador, 'z = ' + texto(z, 2), Math.abs(z) > 5);
  }

  /* -------- 5 a 17 años: IMC para la edad (Cuadro 3) -------- */

  /* Criterio de aproximación de la edad (Cuadro 5): hasta 10 días, el mes
     cumplido; de 11 a 20, el mes y medio; de 21 en adelante, el siguiente. */
  function edadAproximada(edad) {
    const dias = Number(edad.dias) || 0;
    return edad.totalMeses + (dias >= 21 ? 1 : dias >= 11 ? 0.5 : 0);
  }

  function clasificarImcEdad(sexo, edad, imc) {
    const tabla = TABLAS.imc[sexo];
    const indicador = 'IMC para la edad';
    const meses = Math.max(tabla.inicio, Math.min(tabla.inicio + tabla.M.length - 1, edadAproximada(edad)));
    const abajo = lecturaLms(tabla, Math.floor(meses) - tabla.inicio);
    const arriba = lecturaLms(tabla, Math.ceil(meses) - tabla.inicio);
    const medio = meses !== Math.floor(meses);
    const f = {
      l: medio ? (abajo.l + arriba.l) / 2 : abajo.l,
      m: medio ? (abajo.m + arriba.m) / 2 : abajo.m,
      s: medio ? (abajo.s + arriba.s) / 2 : abajo.s
    };
    const z = puntajeZ(imc, f.l, f.m, f.s);
    const valor = z > 2 ? 'obesidad' : z > 1 ? 'sobrepeso' : z >= -1 ? 'peso_adecuado' : z >= -2 ? 'riesgo_delgadez' : 'delgadez';
    return resultado(valor, indicador, 'IMC ' + texto(imc, 1) + ', z = ' + texto(z, 2), Math.abs(z) > 5);
  }

  /* -------- 18 a 64 años: IMC (Cuadro 7) -------- */
  function clasificarAdulto(imc) {
    const valor = imc < 18.5 ? 'delgadez' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad';
    return resultado(valor, 'IMC', 'IMC ' + texto(imc, 1), imc < 10 || imc > 70);
  }

  /* -------- gestantes adultas: IMC para la edad gestacional (Cuadro 12) -------- */
  function clasificarGestante(semanas, imc) {
    const limites = ATALAH[semanas];
    const unDecimal = redondear(imc, 1);
    const valor = unDecimal < limites[0] ? 'bajo_peso_gestacional'
      : unDecimal <= limites[1] ? 'peso_adecuado' : unDecimal <= limites[2] ? 'sobrepeso' : 'obesidad';
    return resultado(valor, 'IMC para la edad gestacional', 'IMC ' + texto(unDecimal, 1) + ', semana ' + semanas, imc < 10 || imc > 70);
  }

  /* Semanas cumplidas de gestación el día de la visita según la fecha probable
     de parto (280 días). null si no se puede. */
  function semanasDeGestacion(diasHastaElParto) {
    if (typeof diasHastaElParto !== 'number' || !isFinite(diasHastaElParto)) return null;
    const semanas = Math.floor((280 - diasHastaElParto) / 7);
    return semanas >= SEMANA_MINIMA && semanas <= SEMANA_MAXIMA ? semanas : null;
  }

  function clasificarEstadoNutricional(d) {
    if (!d || !esPositivo(d.peso) || !esPositivo(d.talla)) return sinClasificar(null);
    if (!d.edad) return sinClasificar('Escriba la fecha de nacimiento para calcularla.');
    /* Los adultos no dependen del sexo; los menores de 18 años sí. */
    if (d.edad.totalMeses < MESES_18_ANIOS && d.gestante !== true) {
      if (d.sexo === 'intersexual') return sinClasificar('La OMS sólo trae tablas para hombre y mujer. Elija la clasificación.');
      if (d.sexo !== 'hombre' && d.sexo !== 'mujer') return sinClasificar('Elija el sexo de la persona para calcularla.');
    }

    const imc = redondear(d.peso / Math.pow(d.talla / 100, 2), 2);
    const anios = d.edad.anios;

    if (d.gestante === true) {
      if (anios < 18) return sinClasificar('Gestante menor de 18 años: la Resolución 2465 sólo clasifica a las gestantes adultas. Elija la clasificación.', 'gestante');
      if (anios > EDAD_MAXIMA_ADULTO) return sinClasificar('La Resolución 2465 no clasifica a gestantes de esta edad. Elija la clasificación.', 'gestante');
      if (!d.semanas) return sinClasificar('Falta la fecha probable de parto (o no da entre las semanas 6 y 42) para calcularla. Elija la clasificación.', 'gestante');
      return clasificarGestante(d.semanas, imc);
    }

    if (d.edad.totalMeses < MESES_5_ANIOS) return clasificarPesoTalla(d.sexo, d.edad.totalMeses, d.peso, d.talla);
    if (d.edad.totalMeses < MESES_18_ANIOS) return clasificarImcEdad(d.sexo, d.edad, imc);
    if (anios <= EDAD_MAXIMA_ADULTO) return clasificarAdulto(imc);
    return sinClasificar('Mayor de 64 años: la Resolución 2465 no trae puntos de corte. Elija la clasificación.');
  }

  return { clasificarEstadoNutricional: clasificarEstadoNutricional, semanasDeGestacion: semanasDeGestacion, ATALAH: ATALAH };
});
