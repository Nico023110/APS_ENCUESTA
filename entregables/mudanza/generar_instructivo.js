/* =========================================================================
   Mudanza — imagen para WhatsApp con la dirección nueva y los pasos
   -------------------------------------------------------------------------
     node entregables/mudanza/generar_instructivo.js

   Toma las fechas y la dirección de mudanza.json (las mismas que muestra la
   aplicación) y deja dos imágenes de 1080 × 1350 en esta carpeta:
     instructivo_1_antes.png   para el aviso previo: suba todo antes del corte
     instructivo_2_ya.png      para la apertura: entre, instale, desinstale la vieja
   Si cambian las fechas en mudanza.json, se vuelve a correr y ya.
   ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', '..');
const configuracion = JSON.parse(fs.readFileSync(path.join(RAIZ, 'mudanza.json'), 'utf8'));
const host = new URL(configuracion.nuevaDireccion).host;

/* Igual que mudanza.js: «viernes 27 de noviembre a las 4:00 p. m.». */
function cuando(texto) {
  const partes = {};
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(new Date(Date.parse(texto))).forEach(function (p) { partes[p.type] = p.value; });
  const periodo = String(partes.dayPeriod || '').replace(/\s+/g, ' ').trim();
  return {
    dia: partes.weekday + ' ' + partes.day + ' de ' + partes.month,
    hora: partes.hour + ':' + partes.minute + ' ' + periodo
  };
}
const corte = cuando(configuracion.corte);

function pagina(titulo, subtitulo, pasos, pie) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../vendor/fuentes/fuentes.css">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1080px; height: 1350px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #f6f7f9; color: #0b1220;
         display: flex; flex-direction: column; padding: 64px 72px; gap: 40px; }
  .marca { display: flex; align-items: center; gap: 24px; }
  .marca img { width: 120px; }
  .marca span { font-size: 30px; font-weight: 600; color: #414d60; line-height: 1.3; }
  h1 { font-size: 66px; line-height: 1.08; letter-spacing: -1.5px; color: #00365a; }
  .sub { font-size: 34px; line-height: 1.4; color: #2b3648; }
  .sub b { color: #004a7c; }
  .link { background: #004a7c; color: #fff; border-radius: 28px; padding: 40px 48px; }
  .link small { display: block; font-size: 26px; font-weight: 600; opacity: .8; margin-bottom: 8px; }
  .link strong { font-size: 58px; letter-spacing: -0.5px; word-break: break-all; }
  ol { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 22px; }
  li { display: flex; gap: 24px; align-items: flex-start; font-size: 33px; line-height: 1.35; }
  li i { flex: none; width: 58px; height: 58px; border-radius: 50%; background: #dfecf8; color: #004a7c; font-style: normal;
         font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 30px; }
  li b { color: #00365a; }
  .pie { margin-top: auto; background: #fcf4e8; color: #8a4e05; border-radius: 22px; padding: 28px 36px; font-size: 29px; line-height: 1.4; font-weight: 600; }
  .puntos { display: flex; gap: 10px; } .puntos u { width: 18px; height: 18px; border-radius: 50%; display: block; }
</style></head><body>
  <div class="marca"><img src="../../logo-ladera.png" alt=""><span>Red de Salud de Ladera E.S.E.<br>Encuesta APS</span></div>
  <h1>${titulo}</h1>
  <p class="sub">${subtitulo}</p>
  <div class="link"><small>Dirección nueva</small><strong>${host}</strong></div>
  <ol>${pasos.map(function (p, i) { return '<li><i>' + (i + 1) + '</i><span>' + p + '</span></li>'; }).join('')}</ol>
  <p class="pie">${pie}</p>
</body></html>`;
}

const IMAGENES = [
  {
    archivo: 'instructivo_1_antes.png',
    html: pagina(
      'La aplicación cambia de dirección',
      'Desde el <b>' + corte.dia + ', ' + corte.hora + '</b>, con el <b>mismo usuario y contraseña</b>.',
      [
        'Termine sus <b>borradores</b>.',
        'Abra la app con señal y toque <b>Sincronizar ahora</b> hasta que diga <b>Todo está en la base</b>.',
        'Si comparte el teléfono, <b>cada persona</b> entra y sube lo suyo.'
      ],
      'Lo que quede sin subir en el teléfono no pasa solo a la dirección nueva. Súbalo antes del ' + corte.dia + '.'
    )
  },
  {
    archivo: 'instructivo_2_ya.png',
    html: pagina(
      'Ya está abierta la nueva dirección',
      'Entre con su <b>usuario y contraseña de siempre</b>.',
      [
        'Abra <b>' + host + '</b> con señal y entre.',
        'Instálela: menú del navegador › <b>Instalar aplicación</b> (o la página <b>Instalar</b>).',
        'Espere el aviso <b>lista para trabajar sin señal</b>.',
        'Si en la app vieja le quedó algo, ábrala, <b>súbalo</b> y después <b>desinstálela</b>.'
      ],
      'La dirección vieja (aps-encuesta.vercel.app) ya no recibe fichas nuevas.'
    )
  }
];

(async function () {
  const navegador = await chromium.launch();
  try {
    const pagina1 = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
    for (const imagen of IMAGENES) {
      const temporal = path.join(__dirname, '_temporal_' + imagen.archivo + '.html');
      fs.writeFileSync(temporal, imagen.html);
      try {
        await pagina1.goto('file:///' + temporal.replace(/\\/g, '/'));
        await pagina1.evaluate(function () { return document.fonts.ready; });
        await pagina1.screenshot({ path: path.join(__dirname, imagen.archivo) });
        console.log('  Lista: entregables/mudanza/' + imagen.archivo);
      } finally {
        fs.unlinkSync(temporal);
      }
    }
  } finally {
    await navegador.close();
  }
})().catch(function (error) { console.error(error); process.exit(1); });
