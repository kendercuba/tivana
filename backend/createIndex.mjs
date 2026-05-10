import client from './elasticsearch.mjs';

async function createIndex() {
  const indexName = 'productos';

  const exists = await client.indices.exists({ index: indexName });

  if (!exists) {
    await client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            product_id: { type: "keyword" },
            title: { type: "text" },
            description: { type: "text" },
            price: { type: "float" },
            image: { type: "keyword" },
          }
        }
      }
    });

    console.log(`✅ Índice '${indexName}' creado correctamente.`);
  } else {
    console.log(`ℹ️ El índice '${indexName}' ya existe.`);
  }
}

createIndex().catch(console.error);

