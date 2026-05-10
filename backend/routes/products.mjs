// Comentario de prueba para webhook automático

import express from 'express';
import { pool } from '../db.mjs';

const router = express.Router();

/*
// 🔕 Elasticsearch desactivado temporalmente
let client;
try {
  const elastic = await import('../elasticsearch.mjs');
  client = elastic.default;
} catch (e) {
  console.warn('⚠️ Elasticsearch deshabilitado temporalmente');
}
*/

// ✅ Ruta principal para listar productos
router.get('/', async (req, res) => {
  const { q, category_id, brand, origin_id, minPrice, maxPrice } = req.query;

  /*
  // 🔍 Elasticsearch activo (comentado temporalmente)
  if (client) {
    const must = [];
    const filter = [];

    if (q) {
      must.push({
        multi_match: {
          query: q.toLowerCase(),
          fields: ['title', 'description'],
          fuzziness: 'AUTO'
        }
      });
    }

    if (brand) {
      filter.push({ match: { brand: { query: brand, operator: 'and' } } });
    }

    if (category_id) {
      filter.push({ term: { category_id: parseInt(category_id) } });
    }

    if (origin_id) {
      filter.push({ term: { origin_id: parseInt(origin_id) } });
    }

    if (minPrice || maxPrice) {
      filter.push({
        range: {
          price: {
            gte: minPrice ? parseFloat(minPrice) : 0,
            lte: maxPrice ? parseFloat(maxPrice) : 99999
          }
        }
      });
    }

    try {
      const { hits } = await client.search({
        index: 'productos',
        size: 40,
        query: {
          bool: { must, filter }
        }
      });

      const resultados = hits.hits.map(hit => hit._source);
      return res.json(resultados);
    } catch (error) {
      console.error('❌ Error en Elasticsearch:', error.meta?.body?.error || error);
      return res.status(500).json({ error: 'Error al buscar productos en Elasticsearch' });
    }
  }
  */

  // ✅ PostgreSQL activo
  try {
    const filters = [];
    const values = [];
    let index = 1;

    if (q) {
      filters.push(`LOWER(title) LIKE $${index}`);
      values.push(`%${q.toLowerCase()}%`);
      index++;
    }

    if (category_id) {
      filters.push(`category_id = $${index}`);
      values.push(parseInt(category_id));
      index++;
    }

    if (brand) {
      filters.push(`brand ILIKE $${index}`);
      values.push(brand);
      index++;
    }

    if (origin_id) {
      filters.push(`origin_id = $${index}`);
      values.push(parseInt(origin_id));
      index++;
    }

    if (minPrice) {
      filters.push(`price >= $${index}`);
      values.push(parseFloat(minPrice));
      index++;
    }

    if (maxPrice) {
      filters.push(`price <= $${index}`);
      values.push(parseFloat(maxPrice));
      index++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(`
  SELECT 
    id,
    title,
    description,
    price,
    images[1] AS image,  -- usa la primera imagen del array
    brand,
    category_id,
    origin_id
  FROM products
  ${whereClause}
  ORDER BY id DESC
  LIMIT 40
`, values);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error en PostgreSQL:', error.message || error);
    res.status(500).json({ error: 'Error al buscar productos' });
  }
});



// ✅ esta es la Ruta de detalle por ID
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: '❌ ID inválido: debe ser un número' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        id, external_id, title, price, images, sizes, category_id, origin_id, 
        brand, description, gender, created_at 
      FROM products
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '❌ Producto no encontrado' });
    }

    const producto = result.rows[0];
    producto.price = parseFloat(producto.price);
    res.json(producto);
  } catch (error) {
    console.error('❌ Error al buscar producto por ID:', error); // 👈 Este debe mostrar algo en la terminal
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

export default router;
