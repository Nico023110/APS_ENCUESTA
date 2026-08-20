/* Prueba de integración: carga la app completa en un DOM real y ejercita
   el clonado de bloques, los campos calculados, los condicionados y el
   guardado con aplicación de reglas. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const BASE = require('path').join(__dirname, '..');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'http://localhost/',
  pretendToBeVisual: true
});
const { window } = dom;

// localStorage mínimo
const almacen = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k) => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: (k) => { delete almacen[k]; }
  },
  configurable: true
});
window.navigator.geolocation = { getCurrentPosition() {} };
window.fetch = () => Promise.reject(new Error('sin red'));
window.HTMLElement.prototype.scrollIntoView = function () {};

const errores = [];
window.addEventListener('error', (e) => errores.push(e.message));

// Los <script> del navegador comparten el alcance global: se concatenan
// en un solo eval para reproducir esa semántica con const/let.
const fuentes = ['catalogos.js', 'direccion.js', 'geocodificacion.js', 'reglas.js', 'formulario.js', 'app.js']
  .map((f) => fs.readFileSync(path.join(BASE, f), 'utf8'))
  .join('\n;\n');
window.eval(fuentes + ';\nwindow.__api = { recolectarDatosFormulario, actualizarTableroDeRiesgo };');

window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const doc = window.document;
let ok = 0, fail = 0;
function check(nombre, cond, detalle) {
  if (cond) { ok++; console.log('  OK   ' + nombre); }
  else { fail++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));

function setVal(sel, v) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  el.value = v;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
  return el;
}
function marcar(nombreSufijo, valor, ambito) {
  const raiz = ambito || doc;
  const el = raiz.querySelector('input[name$="' + nombreSufijo + '"][value="' + valor + '"]');
  if (!el) return null;
  el.checked = true;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
  return el;
}

console.log('\n=== 1. Carga inicial ===');
check('La app se inicializa sin errores de JS', errores.length === 0, errores.join(' | '));
check('Los catálogos se renderizaron', $$('#grupoAnimales .check-pill').length > 10);
check('UZPE006 viene preseleccionada', $('#uzpe').value === 'UZPE006', $('#uzpe').value);
check('Hay 1 familia inicial', $$('#contenedorFamilias > [data-bloque="familia"]').length === 1);

console.log('\n=== 2. Bloques repetibles ===');
$('#btnAgregarFamilia').click();
check('Agregar familia crea un segundo bloque',
  $$('#contenedorFamilias > [data-bloque="familia"]').length === 2);

const fam2 = $$('#contenedorFamilias > [data-bloque="familia"]')[1];
check('El clon se renumeró a familias[1]',
  !!fam2.querySelector('[name="familias[1].tipoFamilia"]'),
  fam2.querySelector('select') && fam2.querySelector('select').name);
check('Los grupos del clon tienen data-name reindexado',
  fam2.querySelector('[data-catalogo="CAT_SITUACIONES_RIESGO_FAMILIAR"]').dataset.name ===
  'familias[1].situacionesRiesgo');
check('Las pastillas del clon se repintaron con el nombre nuevo',
  !!fam2.querySelector('input[name="familias[1].situacionesRiesgo"]'));

const fam1 = $('#contenedorFamilias > [data-bloque="familia"]');
fam1.querySelector('[data-accion="agregarIntegrante"]').click();
check('Agregar integrante en familia 1',
  fam1.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]').length === 2);
check('El integrante 2 quedó como familias[0].integrantes[1]',
  !!fam1.querySelector('[name="familias[0].integrantes[1].primerNombre"]'));

fam2.querySelector('[data-accion="quitarFamilia"]').click();
check('Eliminar familia deja 1 bloque',
  $$('#contenedorFamilias > [data-bloque="familia"]').length === 1);

console.log('\n=== 3. RN-051 — el ítem 51 genera bloques de integrante ===');
setVal(fam1.querySelector('[data-rol="numeroIntegrantes"]'), '4');
check('Declarar 4 integrantes genera 4 bloques',
  fam1.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]').length === 4);
const contarIntegrantes = () =>
  fam1.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]').length;
const campoNum = fam1.querySelector('[data-rol="numeroIntegrantes"]');
const modalAbierto = () => $('#modalConfirmar').hidden === false;

// Bloques vacíos: se retiran sin preguntar, no hay nada que perder.
setVal(campoNum, '2');
check('Reducir con bloques vacíos elimina sin preguntar',
  contarIntegrantes() === 2 && !modalAbierto(), 'bloques: ' + contarIntegrantes());

// Con datos capturados: exige confirmación.
setVal(campoNum, '4');
const ultimo = fam1.querySelectorAll('[data-rol="contenedorIntegrantes"] > [data-bloque="integrante"]')[3];
setVal(ultimo.querySelector('[name$=".primerNombre"]'), 'Pedro');

setVal(campoNum, '2');
check('Reducir con datos capturados abre el modal', modalAbierto());
check('El modal explica cuántos se eliminan y cuántos tienen datos',
  $('#modalConfirmarMensaje').textContent.indexOf('2 integrantes') !== -1 &&
  $('#modalConfirmarMensaje').textContent.indexOf('1 tiene') !== -1,
  $('#modalConfirmarMensaje').textContent);
check('Mientras se confirma no se eliminó nada aún', contarIntegrantes() === 4);

$('#btnCancelarEliminar').click();
check('Cancelar conserva los bloques', contarIntegrantes() === 4);
check('Cancelar restablece el ítem 51 al número real', campoNum.value === '4', campoNum.value);
check('Cancelar cierra el modal', !modalAbierto());

setVal(campoNum, '2');
$('#btnConfirmarEliminar').click();
check('Confirmar elimina los sobrantes', contarIntegrantes() === 2);
check('Los bloques restantes quedan renumerados',
  !!fam1.querySelector('[name="familias[0].integrantes[1].primerNombre"]') &&
  !fam1.querySelector('[name="familias[0].integrantes[2].primerNombre"]'));
check('El ítem 51 conserva el valor confirmado', campoNum.value === '2');

// El modal genérico sigue sirviendo para eliminar encuestas
check('El título del modal es reutilizable',
  $('#modalConfirmarTitulo').textContent.indexOf('Reducir integrantes') !== -1);

setVal(campoNum, '1');
const integrante = fam1.querySelector('[data-bloque="integrante"]');

console.log('\n=== 4. Campos calculados ===');
setVal('#fechaDiligenciamiento', '2026-08-12');
setVal(integrante.querySelector('[data-rol="fechaNacimiento"]'), '1990-02-10');
check('Edad calculada 36 años, 6 meses',
  integrante.querySelector('[data-rol="edadCalculada"]').value === '36 años, 6 meses',
  integrante.querySelector('[data-rol="edadCalculada"]').value);

setVal(integrante.querySelector('[data-rol="peso"]'), '70');
setVal(integrante.querySelector('[data-rol="talla"]'), '170');
check('IMC = 24.22', integrante.querySelector('[data-rol="imc"]').value === '24.22',
  integrante.querySelector('[data-rol="imc"]').value);

setVal(integrante.querySelector('[data-rol="sistolica"]'), '190');
setVal(integrante.querySelector('[data-rol="diastolica"]'), '125');
check('Tensión 190/125 => Crisis hipertensiva',
  integrante.querySelector('[data-rol="badgeTension"]').textContent === 'Crisis hipertensiva');
check('La clasificación se guarda en el campo oculto',
  integrante.querySelector('input[name$=".clasificacionTension"]').value === 'crisis');

setVal('#personasEnVivienda', '7');
setVal('#habitacionesVivienda', '2');
check('7/2 = 3.5 => badge de hacinamiento',
  $('#hacinamientoBadge').textContent.toLowerCase().indexOf('s') !== -1,
  $('#hacinamientoBadge').textContent);

console.log('\n=== 5. Campos condicionados ===');
check('Cintura visible en adulto (RN-094)',
  integrante.querySelector('[data-rol="campoCintura"]').hidden === false);
check('Lactancia oculta en adulto (RN-091)',
  integrante.querySelector('[data-rol="campoLactancia"]').hidden === true);
check('Ideación suicida visible en adulto (RN-107)',
  integrante.querySelector('[data-rol="campoIdeacion"]').hidden === false);
check('Signos de desnutrición ocultos en adulto (RN-097)',
  integrante.querySelector('[data-rol="campoSignos"]').hidden === true);

setVal(integrante.querySelector('[data-rol="fechaNacimiento"]'), '2026-05-12');
check('Bebé de 3 meses: lactancia visible',
  integrante.querySelector('[data-rol="campoLactancia"]').hidden === false);
check('Bebé de 3 meses: tensión oculta',
  integrante.querySelector('[data-rol="campoTension"]').hidden === true);
check('Bebé de 3 meses: signos de desnutrición visibles',
  integrante.querySelector('[data-rol="campoSignos"]').hidden === false);
check('Bebé de 3 meses: consumo SPA oculto',
  integrante.querySelector('[data-rol="campoConsumo"]').hidden === true);

setVal(integrante.querySelector('[data-rol="fechaNacimiento"]'), '1990-02-10');

marcar('.sexo', 'mujer', integrante);
check('Sexo mujer => gestación visible (RN-085)',
  integrante.querySelector('[data-rol="campoGestacion"]').hidden === false);
marcar('.sexo', 'hombre', integrante);
check('Sexo hombre => gestación oculta',
  integrante.querySelector('[data-rol="campoGestacion"]').hidden === true);
marcar('.sexo', 'mujer', integrante);

const selEtnia = integrante.querySelector('select[name$=".pertenenciaEtnica"]');
setVal(selEtnia, 'indigena');
check('Etnia distinta de Ninguna => pueblo étnico visible (RN-080)',
  integrante.querySelector('[data-rol="campoPuebloEtnico"]').hidden === false);
setVal(selEtnia, 'ninguna');
check('Etnia Ninguna => pueblo étnico oculto',
  integrante.querySelector('[data-rol="campoPuebloEtnico"]').hidden === true);

const selRegimen = integrante.querySelector('select[name$=".regimenAfiliacion"]');
setVal(selRegimen, 'no_afiliado');
check('No afiliado => EAPB inhabilitada (RN-076)',
  integrante.querySelector('[data-rol="eapb"]').disabled === true);
setVal(selRegimen, 'subsidiado');
check('Afiliado => EAPB habilitada',
  integrante.querySelector('[data-rol="eapb"]').disabled === false);

marcar('.sujetoEspecialProteccion', 'victima_violencia_genero', integrante);
check('Víctima de violencia => modalidad visible (RN-078)',
  integrante.querySelector('[data-rol="campoViolencia"]').hidden === false);

console.log('\n=== 6. RN-087 — tamizajes filtrados por perfil ===');
const rpms = integrante.querySelector('[data-rol="grupoRpms"]');
let valores = Array.from(rpms.querySelectorAll('input')).map((i) => i.value);
check('Mujer de 36: sin tamizaje de próstata', valores.indexOf('tamizaje_prostata') === -1);
check('Mujer de 36: sin tamizaje de mama (<40)', valores.indexOf('tamizaje_mama') === -1);
check('Mujer de 36: con tamizaje cardiovascular', valores.indexOf('tamizaje_cardiovascular') !== -1);

marcar('.sexo', 'hombre', integrante);
setVal(integrante.querySelector('[data-rol="fechaNacimiento"]'), '1970-02-10');
valores = Array.from(rpms.querySelectorAll('input')).map((i) => i.value);
check('Hombre de 56: con próstata y colon',
  valores.indexOf('tamizaje_prostata') !== -1 && valores.indexOf('tamizaje_colon') !== -1);
check('Hombre de 56: sin cuello uterino', valores.indexOf('tamizaje_cuello_uterino') === -1);

console.log('\n=== 7. Exclusividad de "Ninguno" ===');
const grupoAnim = $('#grupoAnimales');
marcar('animales', 'perros');
marcar('animales', 'gatos');
check('Perros y gatos marcados',
  grupoAnim.querySelectorAll('input:checked').length === 2);
marcar('animales', 'ninguno');
check('Marcar Ninguno desmarca el resto',
  grupoAnim.querySelectorAll('input:checked').length === 1);
marcar('animales', 'perros');
check('Marcar una opción desmarca Ninguno',
  !grupoAnim.querySelector('input[value="ninguno"]').checked);

console.log('\n=== 8. Condicionales de zoonosis (RN-041 a RN-045) ===');
check('Con perros => panel de mascotas visible', $('#panelMascotas').hidden === false);
check('Campo perros habilitado', $('#perros').disabled === false);
check('Campo gatos deshabilitado (no se marcó)', $('#gatos').disabled === true);
setVal('#perros', '4');
setVal('#perrosVacunados', '1');
check('Cobertura antirrábica 25% con 3 sin vacuna',
  $('#badgeCoberturaAntirrabica').textContent.indexOf('25%') === 0 &&
  $('#badgeCoberturaAntirrabica').textContent.indexOf('3 sin vacuna') !== -1,
  $('#badgeCoberturaAntirrabica').textContent);

console.log('\n=== 9. Herencia de llaves del plan (RN-111 a RN-134) ===');
setVal('#equipoSaludId', 'EBS-001');
setVal('#idHogar', 'HOG-001');
setVal('#idFamilia', 'FAM-001');
check('Código de EBS heredado en 6.1', $('#planViviendaEbs').value === 'EBS-001');
check('Código de vivienda heredado en 6.1', $('#planViviendaHogar').value === 'HOG-001');
check('Código heredado también en 6.2',
  $('#contenedorPlanFamilia [name$=".codigoEbs"]').value === 'EBS-001');

setVal(integrante.querySelector('[name$=".primerNombre"]'), 'Ana');
setVal(integrante.querySelector('[name$=".primerApellido"]'), 'Gomez');
marcar('.tipoId', 'CC', integrante);
setVal(integrante.querySelector('[name$=".numeroId"]'), '1144099887');

const selInteg = $('[data-rol="selectorIntegrante"]');
check('El selector de 6.3 lista al integrante',
  selInteg.options.length === 2 && selInteg.options[1].textContent.indexOf('Ana Gomez') !== -1,
  Array.from(selInteg.options).map((o) => o.textContent).join(' | '));

setVal(selInteg, '0:0');
check('Al elegir integrante se autocompleta el ítem 134 (RN-134)',
  $('#contenedorPlanPersona [name$=".numeroIdIntegrante"]').value === '1144099887');
check('El ítem 134 queda de sólo lectura',
  $('#contenedorPlanPersona [name$=".numeroIdIntegrante"]').readOnly === true);

console.log('\n=== 10. Recolección del modelo anidado ===');
const datos = window.__api.recolectarDatosFormulario($('#encuestaForm'));
check('Se construyó el arreglo de familias', Array.isArray(datos.familias) && datos.familias.length === 1);
check('La familia tiene su arreglo de integrantes',
  Array.isArray(datos.familias[0].integrantes) && datos.familias[0].integrantes.length === 1);
check('El integrante conserva su nombre', datos.familias[0].integrantes[0].primerNombre === 'Ana');
check('El peso llega como número', typeof datos.familias[0].integrantes[0].peso === 'number');
check('El plan de persona se enrutó al integrante (6.3 -> anidado)',
  !!datos.familias[0].integrantes[0].planPersona,
  JSON.stringify(Object.keys(datos.familias[0].integrantes[0])));
check('planesPersona plano ya no existe', datos.planesPersona === undefined);
check('El hacinamiento derivado viaja en los datos', datos.hacinamiento === 'si');
check('Sección de saneamiento incorporada', datos.fuenteAgua !== undefined);

console.log('\n=== 11. Aplicación de reglas al guardar ===');
// La app siembra registros de ejemplo al arrancar: se mide el delta, no el total.
const antesDeGuardar = JSON.parse(almacen['aps_encuestas'] || '[]').length;
$('#encuestaForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check('Ficha incompleta => no se guardó',
  JSON.parse(almacen['aps_encuestas'] || '[]').length === antesDeGuardar,
  'antes ' + antesDeGuardar + ', ahora ' + JSON.parse(almacen['aps_encuestas'] || '[]').length);
check('Se marcaron campos con error en pantalla', $$('.field.has-error').length > 0);
check('Se listaron impedimentos de cierre (RN-222)',
  $$('#listaImpedimentos .alerta-item').length > 0);

console.log('\n=== 12. Tablero de riesgo (RN-200 / RN-221) ===');
marcar('.ideacionSuicida', 'ha_pensado', integrante);
const datos2 = window.__api.recolectarDatosFormulario($('#encuestaForm'));
window.__api.actualizarTableroDeRiesgo(datos2);
check('Ideación suicida => alerta en el tablero',
  $$('#listaAlertas .alerta-item--inmediata').length > 0);
check('Semáforo en riesgo alto', $('#semaforoEtiqueta').textContent === 'Riesgo alto',
  $('#semaforoEtiqueta').textContent);
check('Conteo de inmediatas mayor a cero', Number($('#conteoInmediatas').textContent) > 0);
check('La alerta muestra la etiqueta de SIVIGILA',
  $('#listaAlertas').innerHTML.indexOf('SIVIGILA') !== -1);
check('La alerta muestra que bloquea la sincronización',
  $('#listaAlertas').innerHTML.indexOf('Bloquea sincronización') !== -1);

console.log('\n=== 13. Cierre por causa externa (RN-222) ===');
const casilla = $('#visitaIncompleta');
casilla.checked = true;
casilla.dispatchEvent(new window.Event('change', { bubbles: true }));
check('Marcar cierre incompleto revela el motivo',
  $('#campoMotivoIncompleta').hidden === false);
setVal('#motivoVisitaIncompleta', 'Informante rechazó continuar');
$('#encuestaForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
const guardadas = JSON.parse(almacen['aps_encuestas'] || '[]');
check('Se guardó la visita incompleta pese a los faltantes',
  guardadas.length === antesDeGuardar + 1,
  'antes ' + antesDeGuardar + ', ahora ' + guardadas.length);
const nueva = guardadas.find((e) => e.visitaIncompleta === true);
check('Quedó marcada como incompleta', !!nueva);
check('Se persistió el nivel de riesgo (RN-221)',
  nueva && nueva.riesgoFamiliar && nueva.riesgoFamiliar.nivel === 'alto',
  nueva && JSON.stringify(nueva.riesgoFamiliar));
check('Se persistieron las alertas', nueva && nueva.alertas.length > 0);

console.log('\n=== 14. Sin errores de JS en toda la sesión ===');
check('Ningún error capturado', errores.length === 0, errores.join(' | '));

console.log('\n---------------------------------------------');
console.log('Pasadas: ' + ok + '   Fallidas: ' + fail);
process.exit(fail > 0 ? 1 : 0);
