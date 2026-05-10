// tivana-backend/testElastic.js
const client = require('./elasticsearch.mjs');

async function checkConnection() {
  try {
    const info = await client.info();
    console.log('✅ Conectado a ElasticSearch:', info);
  } catch (err) {
    console.error('❌ Error al conectar:', err);
  }
}

checkConnection();
