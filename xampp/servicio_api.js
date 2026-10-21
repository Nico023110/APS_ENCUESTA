/* =========================================================
   Encuesta_APS — Supervisor de la API para XAMPP
   ---------------------------------------------------------
   Lo arranca la tarea programada "APS_Encuesta_API" al
   encender el equipo (ver xampp/instalar.ps1). Mantiene vivo
   servidor.js, que atiende /api detrás de Apache.

   POR QUÉ UN SUPERVISOR Y NO LA TAREA SOLA
   El Programador de tareas sólo reintenta cuando la tarea no
   logra *arrancar*; si Node se cae después, no lo vuelve a
   levantar. Aquí se relanza con una espera creciente para no
   entrar en un bucle si la base no responde.

   Además escribe la salida en logs/api.log con fecha y hora,
   porque una tarea que corre como SYSTEM no tiene consola.

   Uso manual (desde la carpeta de la aplicación):
          node xampp/servicio_api.js
   ========================================================= */

'use strict';

const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR_LOGS = path.join(RAIZ, 'logs');
const LOG = path.join(DIR_LOGS, 'api.log');

/* Al pasar este tamaño el registro se renombra a api.log.1 (se conserva un
   solo histórico): sin tope, meses de peticiones llenan el disco. */
const TOPE_LOG = 10 * 1024 * 1024;

const ESPERA_MIN_MS = 1000;
const ESPERA_MAX_MS = 60 * 1000;
/* Si el proceso duró al menos esto, la caída no viene de un arranque roto
   y la espera vuelve al mínimo. */
const VIDA_ESTABLE_MS = 60 * 1000;

fs.mkdirSync(DIR_LOGS, { recursive: true });

let salida = null;

function abrirLog() {
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > TOPE_LOG) {
      if (salida) salida.end();
      salida = null;
      fs.renameSync(LOG, LOG + '.1');
    }
  } catch (error) {
    /* Si no se pudo rotar se sigue escribiendo en el mismo archivo. */
  }
  if (!salida) salida = fs.createWriteStream(LOG, { flags: 'a' });
  return salida;
}

function escribir(texto) {
  const marca = new Date().toISOString();
  const lineas = String(texto).replace(/\r?\n$/, '').split(/\r?\n/);
  abrirLog().write(lineas.map(function (l) { return marca + '  ' + l; }).join('\n') + '\n');
}

let espera = ESPERA_MIN_MS;

function arrancar() {
  const inicio = Date.now();
  escribir('[supervisor] iniciando servidor.js');

  const hijo = fork(path.join(RAIZ, 'servidor.js'), [], {
    cwd: RAIZ,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  hijo.stdout.on('data', escribir);
  hijo.stderr.on('data', escribir);

  hijo.on('exit', function (codigo, senal) {
    const vivio = Date.now() - inicio;
    espera = vivio >= VIDA_ESTABLE_MS ? ESPERA_MIN_MS : Math.min(espera * 2, ESPERA_MAX_MS);
    escribir('[supervisor] servidor.js terminó (código ' + codigo + (senal ? ', señal ' + senal : '') +
      '). Se relanza en ' + Math.round(espera / 1000) + ' s');
    setTimeout(arrancar, espera);
  });
}

arrancar();
