// elasticsearch.mjs
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

const cloudId = process.env.ELASTIC_CLOUD_ID;

let client = null;

if (cloudId && cloudId !== 'disabled') {
  client = new Client({
    cloud: {
      id: cloudId,
    },
    auth: {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD,
    },
  });
  console.log('🔗 Elasticsearch conectado');
} else {
  console.warn('⚠️ Elasticsearch deshabilitado temporalmente');
}

export { client };
