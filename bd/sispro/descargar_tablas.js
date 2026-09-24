/* =========================================================================
   Descarga de tablas de referencia públicas de SISPRO
   -------------------------------------------------------------------------
       node bd/sispro/descargar_tablas.js [Pais SGDCIUO ...]

   El anexo técnico del reporte SI-APS (APS124CCFP) enumera la mayoría de
   sus listas, pero para cuatro remite a tablas de SISPRO: el país de origen
   (Pais), la ocupación (SGDCIUO), la EAPB (SGDCodigoEAPB) y el tipo de
   documento (TipoIDAfiliado). Esas tablas cambian —se habilitan EAPB, se
   liquidan otras— y copiarlas a mano es como se llenaron de errores los
   catálogos provisionales: ESS024 figuraba como Emssanar y es Coosalud.

   La página pública es un GridView de ASP.NET: se pide con el tamaño de
   página más grande y se recorre el paginador. Sólo se lee HTML público.

   Detrás del proxy de la red institucional Node no usa HTTPS_PROXY por su
   cuenta; se ejecuta con NODE_USE_ENV_PROXY=1 (Node 24).

   Después de descargar, regenere el catálogo del navegador y el seed:
       node bd/sispro/gen_catalogos_sispro.js && node bd/gen_seed.js

   OJO: algunas tablas «APS…» publicadas en SISPRO son anteriores al anexo
   versión 7 (APSTipoVivienda trae «Casa Indígena» como 2; el anexo, como 4).
   Para las listas que el anexo enumera manda el anexo: no se descargan.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE = 'https://web.sispro.gov.co/WebPublico/Consultas/ConsultarDetalleReferenciaBasica.aspx?Code=';
const DESTINO = path.join(__dirname, 'tablas');
const PREDETERMINADAS = ['Pais', 'SGDCIUO', 'SGDCodigoEAPB', 'TipoIDAfiliado', 'MDECEtnia', 'SGDNivEducativo'];

function campoOculto(html, nombre) {
  const m = new RegExp('name="' + nombre + '"[^>]*value="([^"]*)"').exec(html);
  return m ? m[1].replace(/&#43;/g, '+').replace(/&#47;/g, '/').replace(/&amp;/g, '&') : '';
}

function decodificar(texto) {
  return texto.replace(/&nbsp;/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); }).trim();
}

function leerGrilla(html) {
  const tabla = /<table[^>]*grvGrid[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tabla) return [];
  const limpiar = function (celda) { return decodificar(celda.replace(/<[^>]+>/g, '')); };
  const cabeceras = Array.from(tabla[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)).map(function (m) { return limpiar(m[1]); });
  const filas = [];
  for (const tr of tabla[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas = Array.from(tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(function (m) { return limpiar(m[1]); });
    if (celdas.length !== cabeceras.length || celdas.length < 4) continue;
    const fila = {};
    cabeceras.forEach(function (c, i) { fila[c] = celdas[i]; });
    filas.push(fila);
  }
  return filas;
}

async function pedir(url, formulario, cookies) {
  const opciones = { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookies.join('; ') } };
  if (formulario) {
    opciones.method = 'POST';
    opciones.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opciones.body = new URLSearchParams(formulario).toString();
  }
  const respuesta = await fetch(url, opciones);
  (respuesta.headers.getSetCookie ? respuesta.headers.getSetCookie() : []).forEach(function (c) {
    const par = c.split(';')[0];
    if (cookies.indexOf(par) === -1) cookies.push(par);
  });
  if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
  return respuesta.text();
}

function estado(html) {
  return {
    __VIEWSTATE: campoOculto(html, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: campoOculto(html, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: campoOculto(html, '__EVENTVALIDATION')
  };
}

async function descargar(codigo) {
  const url = BASE + encodeURIComponent(codigo);
  const cookies = [];
  let html = await pedir(url, null, cookies);

  const tamano = /<select[^>]*name="([^"]*ddlPageSize)"[^>]*>([\s\S]*?)<\/select>/i.exec(html);
  if (tamano) {
    const mayor = Array.from(tamano[2].matchAll(/value="([^"]*)"/g))
      .map(function (m) { return m[1]; })
      .sort(function (a, b) { return Number(b) - Number(a); })[0];
    const formulario = Object.assign({ __EVENTTARGET: tamano[1], __EVENTARGUMENT: '' }, estado(html));
    formulario[tamano[1]] = mayor;
    html = await pedir(url, formulario, cookies);
  }

  let filas = leerGrilla(html);
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const siguiente = /__doPostBack\(&#39;([^&]*imgNext)&#39;/.exec(html);
    if (!siguiente) break;
    const formulario = Object.assign({ __EVENTTARGET: siguiente[1], __EVENTARGUMENT: '' }, estado(html));
    const nuevo = await pedir(url, formulario, cookies);
    const nuevas = leerGrilla(nuevo).filter(function (f) {
      return !filas.some(function (g) { return g.Codigo === f.Codigo; });
    });
    if (nuevas.length === 0) break;
    filas = filas.concat(nuevas);
    html = nuevo;
  }

  const salida = filas.map(function (f) {
    const fila = { codigo: f.Codigo, nombre: f.Nombre, habilitado: f.Habilitado };
    if (f.Extra_I) fila.extra1 = f.Extra_I;
    if (f.Extra_II) fila.extra2 = f.Extra_II;
    if (f.Extra_III) fila.extra3 = f.Extra_III;
    return fila;
  }).sort(function (a, b) { return a.codigo.localeCompare(b.codigo); });

  if (salida.length === 0) throw new Error('la página no trajo filas');
  fs.writeFileSync(path.join(DESTINO, codigo + '.json'), JSON.stringify(salida, null, 1) + '\n');
  console.log('  ' + codigo.padEnd(18) + salida.length + ' filas');
}

(async function () {
  fs.mkdirSync(DESTINO, { recursive: true });
  const pedidas = process.argv.slice(2);
  for (const codigo of (pedidas.length ? pedidas : PREDETERMINADAS)) {
    try {
      await descargar(codigo);
    } catch (error) {
      console.error('  ' + codigo.padEnd(18) + 'ERROR ' + error.message +
        (error.cause ? ' (' + (error.cause.code || error.cause.message) + ')' : ''));
      process.exitCode = 1;
    }
  }
})();
