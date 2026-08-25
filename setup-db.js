require('dotenv').config({ path: ['.env.local', '.env'] });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runScripts() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('ERROR: No se encontró DATABASE_URL ni POSTGRES_URL en el entorno.');
    console.error('Ejecuta "npx vercel env pull" primero o define la variable.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado a PostgreSQL en Neon.');

    const scripts = [
      '05_nocups.sql'
    ];

    for (const file of scripts) {
      const filePath = path.join(__dirname, 'bd', file);
      console.log(`Ejecutando ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log(`✅ ${file} ejecutado con éxito.`);
    }

    console.log('¡Todos los scripts se ejecutaron correctamente!');
  } catch (err) {
    console.error('Error ejecutando scripts:', err);
  } finally {
    await client.end();
  }
}

runScripts();
