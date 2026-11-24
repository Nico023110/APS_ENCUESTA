/* =========================================================================
   Estado nutricional según la Resolución 2465 de 2016 (RN-096, ítem 96)
       node pruebas/antropometria.test.js

   1. El cálculo: los cuadros 2, 3, 7 y 12, con sus signos, justo a un lado y
      al otro de cada corte; las tablas de la OMS, la edad y lo que se deja a
      mano (65 años o más, gestantes sin semanas, tallas fuera de tabla).
   2. El formulario: se marca solo, se puede cambiar, lo cambiado no se toca,
      «Usar la calculada» lo devuelve, y una ficha guardada se respeta.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const roles = require('../roles.js');
const TABLAS = require('../antropometria_tablas.js');
const A = require('../antropometria.js');

const RAIZ = path.join(__dirname, '..');
let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK    ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + JSON.stringify(detalle) : '')); }
}

/* Edad en el formato de calcularEdad(). */
function edad(anios, meses, dias) { return { anios: anios, meses: meses || 0, dias: dias || 0, totalMeses: anios * 12 + (meses || 0) }; }
function clasificar(d) { return A.clasificarEstadoNutricional(d); }
/* Peso en kg que da exactamente el IMC pedido a esa talla (cm). */
function pesoDe(imc, talla) { return imc * Math.pow(talla / 100, 2); }
/* El peso de una tabla de la OMS en un puntaje z. */
function pesoZ(tabla, medida, z) {
  const i = Math.round((medida - tabla.inicio) / tabla.paso);
  const l = Array.isArray(tabla.L) ? tabla.L[i] : tabla.L;
  return tabla.M[i] * Math.pow(1 + l * tabla.S[i] * z, 1 / l);
}

console.log('\n=== 1. Adultos de 18 a 64 años: IMC (Cuadro 7) ===');
const adulto = function (imc, anios) { return clasificar({ sexo: 'mujer', edad: edad(anios === undefined ? 40 : anios), peso: pesoDe(imc, 160), talla: 160 }); };
[[18.49, 'delgadez'], [18.5, 'normal'], [24.99, 'normal'], [25, 'sobrepeso'], [29.99, 'sobrepeso'], [30, 'obesidad'], [45, 'obesidad']].forEach(function (c) {
  check('IMC ' + c[0] + ' → ' + c[1], adulto(c[0]).valor === c[1], adulto(c[0]));
});
check('a los 18 años cumplidos ya es adulto', adulto(26, 18).valor === 'sobrepeso' && adulto(26, 18).indicador === 'IMC');
check('a los 64 todavía', adulto(26, 64).valor === 'sobrepeso');
check('a los 65 no: se elige a mano y dice por qué', adulto(26, 65).valor === null && /Mayor de 64/.test(adulto(26, 65).motivo), adulto(26, 65));
check('a los 98 tampoco', adulto(26, 98).valor === null);
check('un adulto sin sexo elegido igual se calcula', clasificar({ sexo: '', edad: edad(40), peso: 65, talla: 160 }).valor === 'sobrepeso');
check('los resultados extremos avisan', adulto(75).extremo === true && adulto(9).extremo === true && adulto(25).extremo === false);

console.log('\n=== 2. Menores de 5 años: peso para la talla (Cuadro 2) ===');
const BEBE = { sexo: 'hombre', edad: edad(0, 10) };
const enZ = function (z, sexo) {
  const t = TABLAS.longitud[sexo || 'hombre'];
  return clasificar({ sexo: sexo || 'hombre', edad: edad(0, 10), peso: pesoZ(t, 72, z), talla: 72 }).valor;
};
[[3.001, 'obesidad'], [3 - 0.001, 'sobrepeso'], [2.001, 'sobrepeso'], [2 - 0.001, 'riesgo_sobrepeso'], [1.001, 'riesgo_sobrepeso'],
  [1 - 0.001, 'peso_adecuado'], [0, 'peso_adecuado'], [-1 + 0.001, 'peso_adecuado'], [-1.001, 'riesgo_desnutricion'],
  [-2 + 0.001, 'riesgo_desnutricion'], [-2.001, 'desnutricion_moderada'], [-3 + 0.001, 'desnutricion_moderada'], [-3.001, 'desnutricion_severa']]
  .forEach(function (c) { check('z = ' + c[0] + ' → ' + c[1], enZ(c[0]) === c[1], enZ(c[0])); });
check('niñas con su tabla', enZ(-2.5, 'mujer') === 'desnutricion_moderada' && enZ(0, 'mujer') === 'peso_adecuado');
check('antes de los 24 meses usa la longitud', clasificar(Object.assign({ peso: 9, talla: 72 }, BEBE)).indicador === 'peso para la longitud');
check('desde los 24 meses usa la talla', clasificar({ sexo: 'hombre', edad: edad(2, 0), peso: 12, talla: 86 }).indicador === 'peso para la talla');
check('a los 4 años 11 meses todavía es peso para la talla', clasificar({ sexo: 'mujer', edad: edad(4, 11, 29), peso: 16, talla: 104 }).indicador === 'peso para la talla');
check('talla fuera de la tabla: se elige a mano', clasificar({ sexo: 'hombre', edad: edad(0, 1), peso: 2, talla: 40 }).valor === null);
check('y con la de 2 a 5 años también', clasificar({ sexo: 'hombre', edad: edad(3, 0), peso: 25, talla: 130 }).valor === null);
check('sin sexo no se puede', clasificar({ sexo: '', edad: edad(0, 10), peso: 9, talla: 72 }).valor === null);
check('intersexual: no hay tabla, se elige a mano', clasificar({ sexo: 'intersexual', edad: edad(8), peso: 25, talla: 125 }).valor === null);
check('una desnutrición severa extrema avisa que se verifique', clasificar({ sexo: 'hombre', edad: edad(0, 10), peso: pesoZ(TABLAS.longitud.hombre, 72, -6), talla: 72 }).extremo === true);

console.log('\n=== 3. De 5 a 17 años: IMC para la edad (Cuadro 3) ===');
/* El IMC que corresponde a un z en un mes de la tabla de la OMS. */
const imcDe = function (sexo, mes, z) {
  const t = TABLAS.imc[sexo];
  const i = mes - t.inicio;
  const l = Array.isArray(t.L) ? t.L[i] : t.L;
  return t.M[i] * Math.pow(1 + l * t.S[i] * z, 1 / l);
};
const escolar = function (z, dias) {
  const talla = 125;
  return clasificar({ sexo: 'hombre', edad: edad(8, 0, dias || 0), peso: pesoDe(imcDe('hombre', 96 + (dias >= 21 ? 1 : 0), z), talla), talla: talla });
};
[[2.02, 'obesidad'], [1.98, 'sobrepeso'], [1.02, 'sobrepeso'], [0.98, 'peso_adecuado'], [-0.98, 'peso_adecuado'], [-1.02, 'riesgo_delgadez'],
  [-1.98, 'riesgo_delgadez'], [-2.02, 'delgadez']].forEach(function (c) { check('z = ' + c[0] + ' → ' + c[1], escolar(c[0]).valor === c[1], escolar(c[0])); });
check('a los 17 años 11 meses sigue siendo IMC para la edad', clasificar({ sexo: 'mujer', edad: edad(17, 11, 29), peso: 55, talla: 160 }).indicador === 'IMC para la edad');
check('a los 5 años cumplidos empieza', clasificar({ sexo: 'mujer', edad: edad(5, 0), peso: 18, talla: 110 }).indicador === 'IMC para la edad');
check('se aproxima la edad: 21 días o más es el mes siguiente', /IMC para la edad/.test(escolar(0.5, 25).indicador) && escolar(0.5, 25).valor === 'peso_adecuado');
check('un adolescente de 17 no usa los cortes de adulto', clasificar({ sexo: 'hombre', edad: edad(17), peso: pesoDe(24, 170), talla: 170 }).indicador === 'IMC para la edad');

console.log('\n=== 4. Gestantes adultas (Cuadro 12, Atalah) ===');
const gestante = function (imc, semanas, anios) {
  return clasificar({ sexo: 'mujer', edad: edad(anios || 28), gestante: true, semanas: semanas, peso: pesoDe(imc, 160), talla: 160 });
};
check('semana 20, IMC 21,5 → bajo peso', gestante(21.5, 20).valor === 'bajo_peso_gestacional');
check('semana 20, IMC 21,6 → adecuado', gestante(21.6, 20).valor === 'peso_adecuado');
check('semana 20, IMC 26,3 → adecuado', gestante(26.3, 20).valor === 'peso_adecuado');
check('semana 20, IMC 26,4 → sobrepeso', gestante(26.4, 20).valor === 'sobrepeso');
check('semana 20, IMC 31,0 → sobrepeso', gestante(31.0, 20).valor === 'sobrepeso');
check('semana 20, IMC 31,1 → obesidad', gestante(31.1, 20).valor === 'obesidad');
check('sin semanas: a mano', gestante(25, null).valor === null && /fecha probable/.test(gestante(25, null).motivo));
check('menor de 18 años: a mano', gestante(25, 20, 16).valor === null && /menor de 18/.test(gestante(25, 20, 16).motivo));
check('semanas según la fecha probable: 140 días antes son 20', A.semanasDeGestacion(140) === 20);
check('a 238 días son 6 semanas', A.semanasDeGestacion(238) === 6);
check('antes de la semana 6 no se clasifica', A.semanasDeGestacion(240) === null && A.semanasDeGestacion(400) === null);
check('después de la 42 tampoco', A.semanasDeGestacion(-14) === 42 && A.semanasDeGestacion(-30) === null);
check('sin fecha no hay semanas', A.semanasDeGestacion(null) === null);
check('las 37 semanas del cuadro están', Object.keys(A.ATALAH).length === 37);

console.log('\n=== 5. Datos incompletos: no estorba ===');
check('sin peso no dice nada', clasificar({ sexo: 'mujer', edad: edad(40), peso: null, talla: 160 }).motivo === null);
check('sin talla tampoco', clasificar({ sexo: 'mujer', edad: edad(40), peso: 60, talla: null }).valor === null);
check('sin fecha de nacimiento la pide', /fecha de nacimiento/.test(clasificar({ sexo: 'mujer', edad: null, peso: 60, talla: 160 }).motivo));

/* ---------- el formulario ---------- */
function montar() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  const perfil = { id: 7, rol: 'enfermeria', nivel: roles.nivelDe('enfermeria'), rolEtiqueta: roles.etiquetaDeRol('enfermeria'),
    nombre: 'Prueba', tipoId: 'CC', documento: '1144099001', equipoCodigo: 'EBS004', equiposApoyoCodigos: [],
    permisos: roles.permisosDe('enfermeria'), debeCambiarClave: false };
  const almacen = { aps_sesion_usuario: JSON.stringify(perfil) };
  Object.defineProperty(w, 'localStorage', { value: {
    getItem: function (k) { return k in almacen ? almacen[k] : null; },
    setItem: function (k, v) { almacen[k] = String(v); },
    removeItem: function (k) { delete almacen[k]; } }, configurable: true });
  w.navigator.geolocation = { getCurrentPosition: function () {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Headers = Headers; w.Request = Request;
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
    'antropometria_tablas.js', 'antropometria.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js',
    'captura_local.js', 'app.js'].map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); }).join('\n;\n');
  w.eval(fuentes + '\n;window.__cargar = cargarEncuestaEnFormulario; window.__datos = recolectarDatosFormulario;');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  const $ = function (s) { return w.document.querySelector(s); };
  const bloque = function () { return $('[data-bloque="integrante"]'); };
  const poner = function (sel, valor, ambito) {
    const el = (ambito || w.document).querySelector(sel);
    el.value = valor;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const elegir = function (sufijo, valor) {
    const r = Array.prototype.find.call(bloque().querySelectorAll('input[name$="' + sufijo + '"]'), function (x) { return x.value === valor; });
    r.checked = true;
    r.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  return {
    w: w, $: $, bloque: bloque, poner: poner, elegir: elegir,
    marcado: function () { const m = bloque().querySelector('input[name$=".clasificacionAntropometrica"]:checked'); return m ? m.value : null; },
    aviso: function () { const a = bloque().querySelector('[data-rol="nutricionCalculada"]'); return a.hidden ? '' : a.firstElementChild.textContent; },
    botonUsar: function () { return bloque().querySelector('[data-accion="usarNutricionCalculada"]'); },
    datos: function () { return w.__datos(w.document.getElementById('encuestaForm')); }
  };
}
function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  console.log('\n=== 6. El formulario ===');
  let m = montar();
  await esperar(60);
  check('el formulario en blanco no dice nada y no marca nada', m.aviso() === '' && m.marcado() === null);
  m.poner('[name$=".fechaNacimiento"]', '1986-05-10', m.bloque());
  m.elegir('.sexo', 'mujer');
  m.poner('[data-rol="peso"]', '70', m.bloque());
  check('con sólo el peso todavía no', m.marcado() === null && m.aviso() === '');
  m.poner('[data-rol="talla"]', '160', m.bloque());
  check('al completar la talla se marca sola (IMC 27,3)', m.marcado() === 'sobrepeso', m.marcado());
  check('dice que es calculada y que se puede cambiar', /^Calculada: «Sobrepeso»/.test(m.aviso()) && /Puede cambiarla/.test(m.aviso()), m.aviso());
  check('y va en los datos', m.datos().familias[0].integrantes[0].clasificacionAntropometrica === 'sobrepeso');
  m.poner('[data-rol="peso"]', '60', m.bloque());
  check('si cambia el peso, cambia la clasificación', m.marcado() === 'normal', m.marcado());
  m.elegir('.clasificacionAntropometrica', 'obesidad');
  check('se puede cambiar a mano', m.marcado() === 'obesidad');
  check('y avisa cuál daba el cálculo', /Eligió «Obesidad»/.test(m.aviso()) && /da «Normal»/.test(m.aviso()), m.aviso());
  check('ofrece volver al calculado', m.botonUsar().hidden === false);
  m.poner('[data-rol="peso"]', '80', m.bloque());
  check('lo elegido a mano no lo toca un cambio de peso', m.marcado() === 'obesidad');
  m.botonUsar().click();
  check('«Usar la calculada» vuelve al resultado (IMC 31,3: obesidad)', m.marcado() === 'obesidad' && m.botonUsar().hidden === true, m.aviso());
  m.poner('[data-rol="peso"]', '60', m.bloque());
  check('y desde ahí vuelve a seguir al peso', m.marcado() === 'normal', m.marcado());

  console.log('\n=== 7. Edad y gestación en el formulario ===');
  m.poner('[name$=".fechaNacimiento"]', '1950-05-10', m.bloque());
  check('a los 76 años se quita lo calculado y se explica', m.marcado() === null && /Mayor de 64/.test(m.aviso()), m.aviso());
  m.elegir('.clasificacionAntropometrica', 'normal');
  check('y se elige a mano sin estorbar', m.marcado() === 'normal' && m.botonUsar().hidden === true);
  m.poner('[name$=".fechaNacimiento"]', '1996-05-10', m.bloque());
  m.elegir('.gestacionActual', 'si');
  check('gestante sin fecha probable: a mano y lo dice', /fecha probable de parto/.test(m.aviso()), m.aviso());
  const enAlgo = m.bloque().querySelector('[name$=".fechaEventoObstetrico"]');
  check('tiene el campo de la fecha probable', enAlgo !== null);

  console.log('\n=== 8. Una ficha guardada se respeta ===');
  m = montar();
  await esperar(60);
  const persona = {
    tipoId: 'CC', numeroId: '1000001', primerNombre: 'A', primerApellido: 'B', fechaNacimiento: '1986-05-10', sexo: 'mujer',
    peso: 70, talla: 160, clasificacionAntropometrica: 'peso_adecuado'
  };
  const ficha = function (c96) {
    return { codigoFicha: '76001-EBS004-AAAA-0001-20261120', equipoSaludId: 'EBS004', consentimiento: 'si', fechaDiligenciamiento: '2026-11-20',
      familias: [{ numeroIntegrantes: 1, integrantes: [Object.assign({}, persona, { clasificacionAntropometrica: c96 })] }] };
  };
  m.w.__cargar(ficha('peso_adecuado'));
  check('lo registrado a mano no cambia al abrirla', m.marcado() === 'peso_adecuado', m.marcado());
  check('aunque no coincida con el cálculo, sólo lo dice', /Con el peso y la talla da «Sobrepeso»/.test(m.aviso()), m.aviso());
  m.poner('[data-rol="peso"]', '90', m.bloque());
  check('y un cambio de peso no toca lo registrado', m.marcado() === 'peso_adecuado');
  m.w.__cargar(ficha('sobrepeso'));
  check('si coincide, sigue al cálculo', m.marcado() === 'sobrepeso');
  m.poner('[data-rol="peso"]', '90', m.bloque());
  check('y cambia con el peso (IMC 35,2)', m.marcado() === 'obesidad', m.marcado());

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas ? 1 : 0);
})().catch(function (error) { console.error(error); process.exit(1); });
