import express from 'express';
import { pool } from '../db.mjs';

const router = express.Router();


// Obtener usuarios
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, first_name AS nombre, last_name AS apellido, email, created_at AS fecha_creacion FROM users ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Estadísticas del dashboard
router.get("/stats", async (req, res) => {
  try {
    const [users, orders, searches, products] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM orders"),
      pool.query("SELECT COUNT(*) FROM search_logs"),
      pool.query("SELECT COUNT(*) FROM products"),
    ]);

    res.json({
      users: parseInt(users.rows[0].count),
      orders: parseInt(orders.rows[0].count),
      searches: parseInt(searches.rows[0].count),
      products: parseInt(products.rows[0].count),
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

// Guardar búsqueda
router.post("/search-logs", async (req, res) => {
  try {
    const { user_id, termino } = req.body;

    if (!termino) return res.status(400).json({ error: "No search term provided" });

    await pool.query(
      "INSERT INTO search_logs (user_id, query) VALUES ($1, $2)",
      [user_id || null, termino]
    );

    res.status(201).json({ message: "Search saved" });
  } catch (error) {
    console.error("Error saving search:", error);
    res.status(500).json({ error: "Failed to save search" });
  }
});

// Obtener logs de búsqueda (corregido: usar query en lugar de term)
router.get("/search-logs/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sl.id, 
        sl.query AS termino, 
        sl.created_at AS fecha, 
        u.first_name AS nombre, 
        u.last_name AS apellido
      FROM search_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      ORDER BY sl.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting search logs:", error);
    res.status(500).json({ error: "Failed to fetch search logs" });
  }
});

// Obtener productos
router.get("/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
      p.id, p.title, p.price, p.brand, 
      p.category_id,
      c.name AS categoria, 
      o.name AS origen
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN origins o ON p.origin_id = o.id
      ORDER BY p.id DESC
    `);

    const productos = result.rows;

    const productosConSubcategorias = await Promise.all(
      productos.map(async (producto) => {
        const subRes = await pool.query(`
          SELECT s.id AS subcategoria_id, s.name
          FROM product_subcategories ps
          JOIN subcategories s ON ps.subcategory_id = s.id
          WHERE ps.product_id = $1
        `, [producto.id]);

        return {
          ...producto,
          subcategorias: subRes.rows
        };
      })
    );

    res.json(productosConSubcategorias);
  } catch (error) {
    console.error("❌ Error getting products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});



router.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        u.first_name AS nombre,
        o.product,
        o.price,
        o.status,
        o.created_at
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching admin orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});



router.get("/taxonomy-tree", async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT
        c.id AS category_id,
        c.name AS category_name,

        sc.id AS subcategory_id,
        sc.name AS subcategory_name,

        ssc.id AS subsubcategory_id,
        ssc.name AS subsubcategory_name

      FROM categories c

      LEFT JOIN subcategories sc
      ON sc.category_id = c.id

      LEFT JOIN subsubcategories ssc
      ON ssc.subcategory_id = sc.id

      ORDER BY
        c.position,
        sc.position,
        ssc.position

    `);

    const rows = result.rows;

    const tree = {};

    rows.forEach(row => {

      if (!tree[row.category_id]) {

        tree[row.category_id] = {
          id: row.category_id,
          name: row.category_name,
          subcategories: []
        };

      }

      if (row.subcategory_id) {

        let sub = tree[row.category_id].subcategories.find(
          s => s.id === row.subcategory_id
        );

        if (!sub) {

          sub = {
            id: row.subcategory_id,
            name: row.subcategory_name,
            subsubcategories: []
          };

          tree[row.category_id].subcategories.push(sub);

        }

        if (row.subsubcategory_id) {

          sub.subsubcategories.push({
            id: row.subsubcategory_id,
            name: row.subsubcategory_name
          });

        }

      }

    });

    res.json(Object.values(tree));

  } catch (err) {

    console.error("❌ Error building taxonomy tree:", err);
    res.status(500).json({ error: "Error building taxonomy tree" });

  }

});

export default router;
