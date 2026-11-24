/* =========================================================================
   Ítem 10 — el EBS de la visita según la cuenta (sesion.js)
       node pruebas/ebs_lista.test.js

   Con un solo EBS el campo trae el de la persona y queda fijo. Con varios es
   una lista de los suyos, sin ninguno elegido. La coordinación lo indica con
   la lista de los registrados. Nada de eso puede romper el código de la ficha,
   la herencia a los planes, el borrador ni las correcciones.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const roles = require('../roles.js');

const RAIZ = path.join(__dirname, '..');
let pasadas = 0;
let fallidas = 0;
function check(nombre, condicion, detalle) {
  if (condicion) { pasadas++; console.log('  OK    ' + nombre); }
  else { fallidas++; console.log('  FALLA ' + nombre + (detalle !== undefined ? '  -> ' + JSON.stringify(detalle) : '')); }
}

function montar(cuenta) {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  const rol = cuenta.rol || 'enfermeria';
  const perfil = Object.assign({
    id: 7, rol: rol, nivel: roles.nivelDe(rol), rolEtiqueta: roles.etiquetaDeRol(rol), nombre: 'Prueba',
    tipoId: 'CC', documento: '1144099001', equipoCodigo: null, equiposApoyoCodigos: [],
    permisos: roles.permisosDe(rol), debeCambiarClave: false
  }, cuenta);
  const almacen = { aps_sesion_usuario: JSON.stringify(perfil) };
  Object.defineProperty(w, 'localStorage', {
    value: {
      getItem: function (k) { return k in almacen ? almacen[k] : null; },
      setItem: function (k, v) { almacen[k] = String(v); },
      removeItem: function (k) { delete almacen[k]; }
    },
    configurable: true
  });
  w.navigator.geolocation = { getCurrentPosition: function () {} };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Headers = Headers;
  w.Request = Request;
  w.fetch = function () { return Promise.reject(new Error('sin red')); };
  const fuentes = ['sesion.js', 'catalogos_sispro.js', 'catalogos.js', 'anexo.js', 'direccion.js', 'geocodificacion.js',
    'reglas.js', 'formulario.js', 'cups.js', 'correccion.js', 'pruebas/_boveda_abierta.js', 'captura_local.js', 'app.js']
    .map(function (f) { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); })
    .join('\n;\n');
  w.eval(fuentes + '\n;window.__datos = recolectarDatosFormulario; window.__cargar = cargarEncuestaEnFormulario;' +
    'window.__reiniciar = function () { document.getElementById("encuestaForm").reset(); reiniciarEstadoFormulario(); };');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  const campo = function () { return w.document.getElementById('equipoSaludId'); };
  return {
    w: w,
    campo: campo,
    codigos: function () { return Array.prototype.map.call(campo().options, function (o) { return o.value; }).join(); },
    elegir: function (valor) {
      campo().value = valor;
      campo().dispatchEvent(new w.Event('input', { bubbles: true }));
      campo().dispatchEvent(new w.Event('change', { bubbles: true }));
    },
    codigoFicha: function () { return w.document.getElementById('codigoFicha').value; },
    heredado: function () { return w.document.getElementById('planViviendaEbs').value; },
    datos: function () { return w.__datos(w.document.getElementById('encuestaForm')); }
  };
}

function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  console.log('\n=== Un solo EBS: igual que siempre ===');
  let m = montar({ equipoCodigo: 'EBS004' });
  await esperar(60);
  check('es un texto con el EBS de la persona', m.campo().tagName === 'INPUT' && m.campo().value === 'EBS004', m.campo().value);
  check('fijo: sólo lectura', m.campo().readOnly === true && m.campo().classList.contains('is-sesion'));
  check('el código de la ficha lo lleva', /^76001-EBS004-/.test(m.codigoFicha()), m.codigoFicha());
  check('y el plan lo hereda', m.heredado() === 'EBS004', m.heredado());
  m.w.__reiniciar();
  check('tras limpiar el formulario sigue ahí', m.campo().value === 'EBS004' && m.campo().readOnly);

  m = montar({ equipoCodigo: null, equiposApoyoCodigos: ['EBS064'] });
  await esperar(60);
  check('quien apoya a uno solo lo tiene fijo', m.campo().tagName === 'INPUT' && m.campo().value === 'EBS064' && m.campo().readOnly);
  m = montar({ equipoCodigo: 'EBS004', equiposApoyoCodigos: ['EBS004'] });
  await esperar(60);
  check('el mismo EBS repetido no cuenta como dos', m.campo().tagName === 'INPUT' && m.campo().value === 'EBS004');

  console.log('\n=== Varios EBS: lista de los suyos ===');
  m = montar({ equipoCodigo: 'EBS004', equiposApoyoCodigos: ['EBS017', 'EBS006'] });
  await esperar(60);
  check('es una lista', m.campo().tagName === 'SELECT');
  check('con los suyos, el principal primero, y sin ninguno elegido',
    m.codigos() === ',EBS004,EBS017,EBS006' && m.campo().value === '', m.codigos());
  check('conserva id, nombre y un solo control', m.campo().name === 'equipoSaludId' &&
    m.w.document.querySelectorAll('[name="equipoSaludId"]').length === 1);
  check('la etiqueta del ítem 10 sigue siendo la suya', m.campo().labels && m.campo().labels.length === 1);
  check('dejarla vacía no manda ningún EBS', !m.datos().equipoSaludId, m.datos().equipoSaludId);
  m.elegir('EBS017');
  check('elegir cambia el código de la ficha', /^76001-EBS017-/.test(m.codigoFicha()), m.codigoFicha());
  check('y el plan lo hereda', m.heredado() === 'EBS017', m.heredado());
  check('y va en los datos', m.datos().equipoSaludId === 'EBS017', m.datos().equipoSaludId);
  m.elegir('EBS006');
  check('se puede cambiar de elección', /^76001-EBS006-/.test(m.codigoFicha()) && m.datos().equipoSaludId === 'EBS006');
  m.w.SESION.aplicarEnFormulario(m.w.document.getElementById('encuestaForm'));
  check('confirmar la sesión no borra lo elegido', m.campo().value === 'EBS006' && m.codigos() === ',EBS004,EBS017,EBS006');
  m.w.__reiniciar();
  check('una ficha nueva vuelve a pedirlo', m.campo().value === '' && m.codigos() === ',EBS004,EBS017,EBS006', m.codigos());

  m = montar({ equipoCodigo: null, equiposApoyoCodigos: ['EBS006', 'EBS074', 'EBS064', 'EBS035'] });
  await esperar(60);
  check('enfoque diferencial: sin principal, los cuatro que apoya', m.codigos() === ',EBS006,EBS074,EBS064,EBS035', m.codigos());

  console.log('\n=== Corregir una ficha de otro EBS ===');
  m = montar({ equipoCodigo: 'EBS004', equiposApoyoCodigos: ['EBS017'] });
  await esperar(60);
  m.w.__cargar({ codigoFicha: '76001-EBS090-AAAA-0001-20261120', equipoSaludId: 'EBS090', consentimiento: 'si', familias: [] });
  check('muestra el EBS de la ficha aunque no sea suyo', m.campo().value === 'EBS090', m.campo().value);
  check('y va en los datos', m.datos().equipoSaludId === 'EBS090', m.datos().equipoSaludId);
  m.w.SESION.aplicarEnFormulario(m.w.document.getElementById('encuestaForm'));
  check('confirmar la sesión a media corrección no lo pierde', m.campo().value === 'EBS090', m.campo().value);
  m.w.__reiniciar();
  check('al salir de la corrección ese EBS ya no está en la lista', m.codigos() === ',EBS004,EBS017' && m.campo().value === '', m.codigos());
  m.w.__cargar({ codigoFicha: '76001-EBS017-AAAA-0002-20261120', equipoSaludId: 'EBS017', consentimiento: 'si', familias: [] });
  check('una ficha de uno de los suyos lo muestra', m.campo().value === 'EBS017' && m.codigos() === ',EBS004,EBS017');

  console.log('\n=== La coordinación y el administrador: igual que antes ===');
  m = montar({ rol: 'lider_ebs' });
  await esperar(60);
  check('la coordinación escribe el EBS con la lista de los registrados',
    m.campo().tagName === 'INPUT' && !m.campo().readOnly && m.campo().getAttribute('list') === 'listaEquiposEbs');
  m = montar({ rol: 'administrador' });
  await esperar(60);
  check('el administrador lo sigue escribiendo', m.campo().tagName === 'INPUT' && !m.campo().readOnly);

  console.log('\n---------------------------------------------');
  console.log('Pasadas: ' + pasadas + '   Fallidas: ' + fallidas);
  process.exit(fallidas ? 1 : 0);
})().catch(function (error) { console.error(error); process.exit(1); });
