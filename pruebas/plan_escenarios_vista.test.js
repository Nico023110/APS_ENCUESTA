/* =========================================================================
   Plan de pruebas de la encuesta — escenarios en el formulario (jsdom)
   -------------------------------------------------------------------------
       node pruebas/plan_escenarios_vista.test.js

   Los casos del plan que dependen de la pantalla: qué se muestra u oculta
   según la edad, el sexo y las respuestas, qué se recoge al guardar cuando
   un campo se ocultó, cascadas (territorio → microterritorio) y textos que
   no deben ejecutarse. Monta index.html con los mismos scripts que el
   navegador; no necesita servidor ni base de datos.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(BASE, 'index.html'), 'utf8'),
  { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const w = dom.window;
const almacen = {};
Object.defineProperty(w, 'localStorage', { value: {
  getItem: (k) => (k in almacen ? almacen[k] : null),
  setItem: (k, v) => { almacen[k] = String(v); },
  removeItem: (k) => { delete almacen[k]; }
}, configurable: true });
w.navigator.geolocation = { getCurrentPosition() {} };
w.fetch = () => Promise.reject(new Error('sin red'));
w.HTMLElement.prototype.scrollIntoView = function () {};
const erroresJs = [];
w.addEventListener('error', (e) => erroresJs.push(e.message));
const silencio = console.log;
console.log = function () {};   // la app escribe avisos en consola sin Swal
w.eval(['catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js', 'reglas.js',
  'formulario.js', 'cups.js', 'correccion.js', 'captura_local.js', 'guia_campos.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8')).join('\n;\n') +
  ';\nwindow.__api = { recolectarDatosFormulario, CAT_TERRITORIOS: typeof CAT_TERRITORIOS !== "undefined" ? CAT_TERRITORIOS : null };');
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
console.log = silencio;

const doc = w.document;
const $ = (s, r) => (r || doc).querySelector(s);
const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));

const resultados = new Map();
let pasadas = 0, fallidas = 0;
function verificar(id, nombre, condicion, detalle) {
  if (!resultados.has(id)) resultados.set(id, { pasa: true, fallas: [] });
  if (condicion) { pasadas++; silencio('  OK    ' + id + '  ' + nombre); return; }
  fallidas++;
  resultados.get(id).pasa = false;
  resultados.get(id).fallas.push(nombre + (detalle ? ' -> ' + detalle : ''));
  silencio('  FALLA ' + id + '  ' + nombre + (detalle ? '  -> ' + detalle : ''));
}

function setVal(el, v) {
  el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function marcar(raiz, sufijo, valor, marcado) {
  const el = $('input[name$="' + sufijo + '"][value="' + valor + '"]', raiz);
  if (!el) return false;
  el.checked = marcado !== false;
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
  return true;
}

const HOY = new Date(); HOY.setHours(0, 0, 0, 0);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function haceMeses(m) { const d = new Date(HOY); d.setMonth(d.getMonth() - m); return iso(d); }
setVal($('#fechaDiligenciamiento'), iso(HOY));

const integ = () => $('#contenedorFamilias [data-bloque="integrante"]');
const visible = (rol) => { const el = $('[data-rol="' + rol + '"]', integ()); return !!el && !el.hidden; };
const anexoVisible = (clave, raiz) => { const el = $('[data-anexo="' + clave + '"]', raiz || doc); return !!el && !el.hidden; };

function edad(meses, sexo) {
  setVal($('[data-rol="fechaNacimiento"]', integ()), haceMeses(meses));
  if (sexo) marcar(integ(), '.sexo', sexo);
}

/* ---------- C: visibilidad por edad y sexo ---------- */
silencio('\n=== C. Visibilidad por edad y sexo ===');

edad(4, 'mujer');
verificar('C01', 'Bebé de 4 meses: lactancia y signos visibles', visible('campoLactancia') && visible('campoSignos'));
verificar('C01', 'Bebé de 4 meses: sin tensión, cintura, orientación, SPA ni ideación',
  !visible('campoTension') && !visible('campoCintura') && !visible('campoOrientacion') && !visible('campoConsumo') && !visible('campoIdeacion'));
verificar('C01', 'Bebé de 4 meses: sin intención reproductiva ni gestación',
  !visible('campoIntencion') && !visible('campoGestacion'));
edad(6);
verificar('C02', 'Bebé de 6 meses: lactancia oculta', !visible('campoLactancia'));
edad(2);
verificar('C03', 'Bebé de 2 meses: signos de desnutrición ocultos', !visible('campoSignos'));
edad(8 * 12, 'hombre');
verificar('C05', 'Niño de 8 años: tabaco oculto', !anexoVisible('consumoTabaco', integ()));
edad(12 * 12, 'mujer');
verificar('C07', 'Niña de 12 años: tabaco, gestación y módulo materno visibles; sin orientación ni SPA',
  anexoVisible('consumoTabaco', integ()) && visible('campoGestacion') && anexoVisible('fechaUltimaMenstruacion', integ()) &&
  !visible('campoOrientacion') && !visible('campoConsumo'));
edad(9 * 12, 'mujer');
verificar('C01', 'Niña de 9 años: sin intención reproductiva ni gestación', !visible('campoIntencion') && !visible('campoGestacion'));
edad(10 * 12, 'hombre');
verificar('C01', 'Niño de 10 años: intención reproductiva visible, gestación oculta', visible('campoIntencion') && !visible('campoGestacion'));
edad(13 * 12);
verificar('C08', '13 años: orientación sexual visible', visible('campoOrientacion'));
edad(14 * 12);
verificar('C09', '14 años: depresión, ideación y SPA visibles', visible('campoDepresiva') && visible('campoIdeacion') && visible('campoConsumo'));
const hint = $('[data-rol="hintConsumo"]', integ());
verificar('C09', '14 años: ayuda de SPA «alguna vez en su vida»', hint && /alguna vez/.test(hint.textContent), hint && hint.textContent);
edad(18 * 12);
verificar('C12', 'Cumple 18 hoy: tensión y cintura visibles', visible('campoTension') && visible('campoCintura'));
verificar('C12', '18 años: ayuda de SPA «últimos tres meses»', hint && /tres meses/.test(hint.textContent), hint && hint.textContent);
edad(55 * 12, 'mujer');
verificar('C16', 'Mujer de 55: módulo materno oculto', !anexoVisible('fechaUltimaMenstruacion', integ()));
edad(30 * 12, 'hombre');
verificar('C17', 'Hombre: pregunta de gestación oculta', !visible('campoGestacion'));

/* C19 / C20: lo que se oculta no se guarda. */
edad(30 * 12, 'mujer');
setVal($('[data-rol="sistolica"]', integ()), '120');
setVal($('[data-rol="diastolica"]', integ()), '80');
edad(3);
let datos = w.__api.recolectarDatosFormulario($('#encuestaForm'));
let i0 = datos.familias[0].integrantes[0];
verificar('C19', 'Adulto con TA cambiado a bebé de 3 meses: la tensión no se recoge',
  i0.tensionSistolica === undefined || i0.tensionSistolica === null, JSON.stringify([i0.tensionSistolica, i0.tensionDiastolica]));

edad(30 * 12, 'mujer');
marcar(integ(), '.gestacionActual', 'si');
marcar(integ(), '.sexo', 'hombre');
datos = w.__api.recolectarDatosFormulario($('#encuestaForm'));
i0 = datos.familias[0].integrantes[0];
verificar('C20', 'Mujer gestante cambiada a hombre: la gestación no se recoge',
  i0.gestacionActual === undefined || i0.gestacionActual === null || i0.gestacionActual === '', String(i0.gestacionActual));
marcar(integ(), '.sexo', 'mujer');
marcar(integ(), '.gestacionActual', 'no');

/* ---------- B: bloques ---------- */
silencio('\n=== B. Bloques del instrumento ===');

const opciones = $$('#territorio option').map(o => o.value).filter(Boolean);
const numero = (t) => Number(String(t).replace('T', ''));
verificar('B02', 'La lista de territorios sólo ofrece T48 a T84', opciones.length === 37 && opciones.every(t => numero(t) >= 48 && numero(t) <= 84),
  opciones.length + ': ' + opciones.slice(0, 3).join(',') + '…' + opciones.slice(-2).join(','));
setVal($('#territorio'), 'T50');
setVal($('#microterritorio'), 'MT02');
const comuna1 = $('#comuna').value;
setVal($('#territorio'), 'T60');
verificar('B02', 'Al cambiar el territorio se limpia el microterritorio', $('#microterritorio').value === '', $('#microterritorio').value);
verificar('B02', 'La comuna se llenó sola al elegir el microterritorio', comuna1 !== '', comuna1);

marcar(doc, 'situacionInminente', 'fisica');
marcar(doc, 'situacionInminente', 'psicologica');
marcar(doc, 'situacionInminente', 'no_aplica');
const marcadas = $$('input[name="situacionInminente"]:checked').map(x => x.value);
verificar('B01', 'Marcar «No aplica» desmarca Física y Psicológica', marcadas.length === 1 && marcadas[0] === 'no_aplica', marcadas.join(','));

setVal($('#entornoAbordaje'), 'institucional');
setVal($('#nombreInstitucion'), 'Colegio X');
setVal($('#entornoAbordaje'), 'hogar');
verificar('B05', 'Entorno Hogar: el nombre de la institución se bloquea y vacía',
  ($('#nombreInstitucion').disabled || $('#nombreInstitucion').readOnly) && $('#nombreInstitucion').value === '',
  JSON.stringify([$('#nombreInstitucion').disabled, $('#nombreInstitucion').value]));

setVal($('#personasEnVivienda'), '7');
setVal($('#habitacionesVivienda'), '2');
verificar('B09', '7 personas en 2 habitaciones: 3.5 y hacinamiento Sí',
  $('#personasPorHabitacion').value.indexOf('3.5') !== -1 && /s[ií]/i.test($('#hacinamientoBadge').textContent),
  $('#personasPorHabitacion').value + ' / ' + $('#hacinamientoBadge').textContent);
setVal($('#personasEnVivienda'), '4');
verificar('B09', '4 personas en 2 habitaciones: sin hacinamiento', /no/i.test($('#hacinamientoBadge').textContent), $('#hacinamientoBadge').textContent);

marcar(doc, 'animales', 'ninguno');
verificar('B15', 'Animales Ninguno: perros y gatos inactivos', $('#perros').disabled && $('#gatos').disabled);
marcar(doc, 'animales', 'perros');
verificar('B15', 'Al marcar perros se habilita su conteo', !$('#perros').disabled);
verificar('A09', 'Con animales: aparecen las preguntas de tenencia (A2.97)', anexoVisible('finalidadTenencia'));
marcar(doc, 'animales', 'perros', false);
marcar(doc, 'animales', 'ninguno');

const regimen = $('select[name$=".regimenAfiliacion"]', integ());
const eapb = $('select[data-rol="eapb"]', integ());
setVal(regimen, 'subsidiado');
if (eapb.options.length > 1) setVal(eapb, eapb.options[1].value);
setVal(regimen, 'no_afiliado');
verificar('B25', 'No afiliado: EAPB inactiva y vacía', eapb.disabled && eapb.value === '', JSON.stringify([eapb.disabled, eapb.value]));
setVal(regimen, 'subsidiado');
verificar('B25', 'Subsidiado: EAPB se reactiva', !eapb.disabled);

const nac = $('select[name$=".nacionalidad"]', integ());
setVal(nac, 'VE');
verificar('B23', 'Venezuela: aparece el estatus migratorio', anexoVisible('estatusMigratorio', integ()));
setVal(nac, 'CO');
verificar('B23', 'Colombia: el estatus se oculta', !anexoVisible('estatusMigratorio', integ()));

marcar(integ(), '.sujetoEspecialProteccion', 'victima_violencia_interpersonal');
verificar('B26', 'Víctima de violencia interpersonal: modalidad visible', visible('campoViolencia'));
marcar(integ(), '.sujetoEspecialProteccion', 'ninguna');

/* ---------- A: anexo ---------- */
silencio('\n=== A. Anexo SI-APS ===');
marcar(doc, 'actividadEconomica', 'si');
verificar('A07', 'Actividad económica Sí: A2.51 y A2.52 visibles', anexoVisible('areaTrabajoIndependiente') && anexoVisible('familiarAfectadoActividad'));
marcar(doc, 'actividadEconomica', 'no');
verificar('A07', 'Actividad económica No: se ocultan', !anexoVisible('areaTrabajoIndependiente') && !anexoVisible('familiarAfectadoActividad'));

const tanque = $('select[name="tanqueAlmacenamiento"]');
setVal(tanque, 'no_tiene');
verificar('A08', 'Sin tanque: frecuencia y distancia ocultas', !anexoVisible('frecuenciaLimpiezaTanque') && !anexoVisible('distanciaTanque'));
setVal(tanque, 'aereo');
verificar('A08', 'Tanque aéreo: frecuencia y distancia visibles', anexoVisible('frecuenciaLimpiezaTanque') && anexoVisible('distanciaTanque'));

marcar(doc, 'mediosTransporte', 'otro');
verificar('A06', 'Transporte «Otro»: aparece «¿Qué otro medio?»', anexoVisible('mediosTransporteOtro'));

edad(30 * 12, 'mujer');
marcar(integ(), '.consumoTabaco', 'activo');
verificar('A14', 'Fumador activo: cigarrillos y años visibles', anexoVisible('cigarrillosDiarios', integ()) && anexoVisible('aniosFumando', integ()));
marcar(integ(), '.enfermedadesUltimoMes', 'otra');
const algunaEnfermedad = $('input[name$=".enfermedadesUltimoMes"]', integ());
if (algunaEnfermedad && !algunaEnfermedad.checked) { algunaEnfermedad.checked = true; algunaEnfermedad.dispatchEvent(new w.Event('change', { bubbles: true })); }
verificar('A13', 'Con una enfermedad del último mes: aparece qué hizo', anexoVisible('accionAfeccion', integ()));

const codigos = $$('[data-anexo] .item-num--anexo').map(e => e.textContent.trim());
verificar('A01', 'Cada pregunta del anexo muestra su código (A2.x / A3.x)', codigos.length > 50 && codigos.every(c => /^A[23]\.\d+$/.test(c)),
  codigos.length + ' códigos; raros: ' + codigos.filter(c => !/^A[23]\.\d+$/.test(c)).slice(0, 3).join(','));

/* ---------- N y S ---------- */
silencio('\n=== N / S. Límites y seguridad en pantalla ===');
const campoNum = $('[data-rol="numeroIntegrantes"]');
console.log = function () {};
setVal(campoNum, '31');
console.log = silencio;
verificar('N05', 'Ítem 51 en 31: lo baja a 30', campoNum.value === '30', campoNum.value);
verificar('N05', 'Y crea 30 bloques de integrante', $$('#contenedorFamilias [data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]').length === 30,
  String($$('#contenedorFamilias [data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]').length));
console.log = function () {};
setVal(campoNum, '1');
if (!$('#modalConfirmar').hidden) $('#btnConfirmarEliminar').click();
console.log = silencio;

setVal($('[data-rol="primerNombre"]', integ()), '<img src=x onerror="window.__xss=1">');
const titulo = $('[data-rol="tituloIntegrante"]', integ());
verificar('S09', 'Nombre con HTML: el título lo muestra como texto', titulo && !$('img', titulo) && titulo.textContent.indexOf('<img') !== -1 && w.__xss === undefined,
  titulo && titulo.innerHTML);

verificar('N15', 'Sin errores de JavaScript en toda la sesión', erroresJs.length === 0, erroresJs.join(' | '));

/* ---------- Resumen ---------- */
silencio('\n---------------------------------------------');
const ids = Array.from(resultados.keys()).sort();
const fallan = ids.filter(id => !resultados.get(id).pasa);
silencio('Casos evaluados: ' + ids.length + '   Pasan: ' + (ids.length - fallan.length) + '   Fallan: ' + fallan.length);
fallan.forEach(id => silencio('  ' + id + ': ' + resultados.get(id).fallas.join(' || ')));
silencio('Verificaciones: ' + pasadas + ' pasadas, ' + fallidas + ' fallidas');
/* El detalle por caso, para pasarlo al documento del plan, queda fuera del repositorio. */
fs.writeFileSync(path.join(require('os').tmpdir(), 'resultados_plan_vista.json'),
  JSON.stringify(Object.fromEntries(ids.map(id => [id, resultados.get(id)])), null, 2));
process.exit(fallidas > 0 ? 1 : 0);
