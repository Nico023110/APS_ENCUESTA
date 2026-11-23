/* =========================================================================
   Mudanza — ¿qué llegó a Neon después de la copia final? (SÓLO LECTURA)
   -------------------------------------------------------------------------
   Después del corte, Vercel sigue abierto sólo para que quien se atrasó suba
   lo que tenía en el teléfono. Eso llega a Neon, no al servidor nuevo. Este
   script dice cuánto llegó después de la copia final, para pasarlo.

   Uso (en el equipo de desarrollo, con la DATABASE_URL de Neon en .env.local):

     node bd/fichas_despues_del_corte.js --desde "2026-11-27 22:00"

   --desde es la hora de Colombia en que se sacó la copia final (está en el
   nombre del archivo: neon_20261127_2200.dump → "2026-11-27 22:00").

   La sesión va con default_transaction_read_only: no puede cambiar nada.
   Sólo muestra cantidades, códigos de ficha y EBS: ni nombres ni documentos.
   ========================================================================= */

'use strict';

require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });

const path = require('path');
const { Client } = require('pg');
const { opcionesConexion } = require(path.join(__dirname, '..', 'api', '_db.js'));

function argumento(nombre) {
  const i = process.argv.indexOf('--' + nombre);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
}

const desdeTexto = argumento('desde');
const coincide = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(desdeTexto);
if (!coincide) {
  console.error('\n  Uso: node bd/fichas_despues_del_corte.js --desde "AAAA-MM-DD HH:MM"   (hora de Colombia)\n');
  process.exit(1);
}
const desde = coincide[1] + 'T' + coincide[2] + ':' + coincide[3] + ':00-05:00';

(async function () {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!cadena) throw new Error('No hay DATABASE_URL.');
  const cliente = new Client(Object.assign({}, opcionesConexion(cadena), { options: '-c default_transaction_read_only=on' }));
  await cliente.connect();
  try {
    const fichas = await cliente.query(
      `SELECT f.codigo, eq.codigo AS ebs,
              to_char(f.capturada_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS subida
         FROM aps.ficha f JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
        WHERE f.capturada_en > $1::timestamptz
        ORDER BY f.capturada_en`, [desde]);
    const visitas = await cliente.query(
      `SELECT f.codigo, v.numero, eq.codigo AS ebs
         FROM aps.visita_ficha v JOIN aps.ficha f ON f.id = v.ficha_id
         JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
        WHERE v.registrada_en > $1::timestamptz
        ORDER BY v.registrada_en`, [desde]);
    const cambios = await cliente.query(
      `SELECT DISTINCT f.codigo, eq.codigo AS ebs
         FROM aud.evento e JOIN aps.ficha f ON f.id = e.ficha_id
         JOIN aps.equipo_salud eq ON eq.id = f.equipo_salud_id
        WHERE e.ocurrido_en > $1::timestamptz
          AND e.tipo IN ('creacion', 'modificacion', 'cierre')
          AND f.capturada_en <= $1::timestamptz
        ORDER BY 1`, [desde]);
    const ingresos = await cliente.query(
      `SELECT count(*)::int AS sesiones, count(DISTINCT s.usuario_id)::int AS personas
         FROM aps.sesion s WHERE s.creada_en > $1::timestamptz`, [desde]);

    console.log('\n  Neon después de ' + desdeTexto + ' (hora de Colombia) — sólo lectura');
    console.log('  ' + '-'.repeat(60));
    console.log('  Fichas nuevas:                 ' + fichas.rows.length);
    console.log('  Segundas visitas nuevas:       ' + visitas.rows.length);
    console.log('  Fichas anteriores con cambios: ' + cambios.rows.length);
    console.log('  Ingresos a Vercel:             ' + ingresos.rows[0].sesiones + ' (de ' + ingresos.rows[0].personas + ' personas)');

    const lista = function (titulo, filas, texto) {
      if (!filas.length) return;
      console.log('\n  ' + titulo);
      filas.forEach(function (f) { console.log('    ' + texto(f)); });
    };
    lista('Fichas nuevas (código · EBS · subida):', fichas.rows, function (f) { return f.codigo + ' · ' + f.ebs + ' · ' + f.subida; });
    lista('Segundas visitas (código · visita · EBS):', visitas.rows, function (f) { return f.codigo + ' · ' + f.numero + ' · ' + f.ebs; });
    lista('Fichas anteriores con cambios (código · EBS):', cambios.rows, function (f) { return f.codigo + ' · ' + f.ebs; });

    const total = fichas.rows.length + visitas.rows.length + cambios.rows.length;
    console.log('\n  ' + (total === 0
      ? 'Nada que pasar al servidor nuevo.'
      : 'Hay ' + total + ' cosas que pasar al servidor nuevo. Avise a quien mantiene la app.'));
    console.log('');
  } finally {
    await cliente.end();
  }
})().catch(function (error) {
  console.error('\n  ERROR: ' + error.message + '\n');
  process.exit(1);
});
