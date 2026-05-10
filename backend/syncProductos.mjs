// tivana-backend/syncProductos.mjs
import dotenv from 'dotenv';
dotenv.config({
  path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env'
});

import { client } from './elasticsearch.mjs';
import { pool } from './db.mjs';

async function syncProductos() {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, o.name AS origin
      FROM products p
      LEFT JOIN origins o ON p.origin_id = o.id
    `);

    const body = rows.flatMap(product => {
      const enrichedProduct = {
        product_id: product.product_id,
        title: product.title,
        description: product.description || "",
        price: parseFloat(product.price),
        image: product.image || "",
        images: product.images || [],
        sizes: product.sizes || [],
        brand: product.brand || "Shein",
        category_id: product.category_id || null,
        subcategory_id: product.subcategory_id || null,
        origin: product.origin || "Amazon"
      };

      return [
        { index: { _index: 'productos', _id: product.product_id } },
        enrichedProduct
      ];
    });

    const { errors, items } = await client.bulk({ refresh: true, body });

    if (errors) {
      const fallidos = items
        .filter(item => item.index && item.index.error)
        .map(item => ({
          id: item.index._id,
          error: item.index.error
        }));

      console.error(`❌ ${fallidos.length} productos fallaron al sincronizar:\n`);
      console.dir(fallidos, { depth: null });
    } else {
      console.log(`✅ Se sincronizaron ${rows.length} productos a ElasticSearch.`);
    }

    const invalid = rows.filter(p =>
      !p.title || !p.price || isNaN(p.price) || !p.image || !p.product_id
    );

    if (invalid.length > 0) {
      console.warn(`⚠️ ${invalid.length} productos con datos inválidos en PostgreSQL:\n`);
      console.table(invalid, ['product_id', 'title', 'price', 'image']);
    }

  } catch (err) {
    console.error("❌ Error al sincronizar:", err);
  }
}

syncProductos();
