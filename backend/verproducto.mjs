import client from './elasticsearch.mjs';

async function verPrimerProducto() {
  try {
    const response = await client.search({
      index: 'productos',
      size: 1,
      query: {
        match_all: {}
      }
    });

    const producto = response.hits.hits[0]?._source;

    if (!producto) {
      console.log('No se encontraron productos.');
    } else {
      console.log(JSON.stringify(producto, null, 2));
    }

  } catch (error) {
    console.error('Error al obtener el producto:', error.meta?.body?.error || error.message);
  }
}

verPrimerProducto();
