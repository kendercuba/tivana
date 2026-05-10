import express from 'express';
import { pool } from '../db.mjs';
import { clearTaxonomyCache } from "../classification/taxonomyCache.mjs";

const router = express.Router();

// ✅ Obtener sub-subcategorías con info de subcategoría y categoría
router.get('/subsubcategories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  ssc.id,
  ssc.name,
  ssc.subcategory_id,
  sc.name AS sub_name,
  c.name AS category_name
FROM subsubcategories ssc
JOIN subcategories sc ON ssc.subcategory_id = sc.id
JOIN categories c ON sc.category_id = c.id
ORDER BY ssc.position ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al obtener sub-subcategorías:', err);
    res.status(500).json({ message: 'Error al obtener sub-subcategorías' });
  }
});



router.get("/with-count", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        ss.id,
        ss.name,
        ss.subcategory_id,
        COUNT(pss.product_id) AS total_items
      FROM subsubcategories ss
      LEFT JOIN product_subsubcategories pss 
        ON pss.subsub_id = ss.id
      GROUP BY ss.id, ss.name, ss.subcategory_id
      ORDER BY ss.position ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ Error obteniendo subsubcategories:", err);
    res.status(500).json({ error: "Error al obtener subsubcategories" });
  }
});


// ✅ Crear sub-subcategoría (CON CONTROL DE DUPLICADOS)
router.post('/', async (req, res) => {
  const { name, subcategory_id } = req.body;

  if (!name || !subcategory_id) {
    return res.status(400).json({
      error: "name y subcategory_id son requeridos"
    });
  }

  try {
    // 🔎 Evitar duplicados
    const existing = await pool.query(
      `
      SELECT *
      FROM subsubcategories
      WHERE LOWER(name) = LOWER($1)
        AND subcategory_id = $2
      `,
      [name.trim(), subcategory_id]
    );

    if (existing.rows.length > 0) {
      clearTaxonomyCache();
      return res.json(existing.rows[0]); // 👈 objeto COMPLETO
    }

    // ➕ Crear sub-subcategoría
    const result = await pool.query(
      `
      INSERT INTO subsubcategories (name, subcategory_id, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *
      `,
      [name.trim(), subcategory_id]
    );

    clearTaxonomyCache();
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('❌ Error al crear sub-subcategoría:', err);
    res.status(500).json({ error: 'Error al crear sub-subcategoría' });
  }
});


// Actualizar sub-subcategoría por ID
router.put("/subsubcategories/:id", async (req, res) => {
 console.log("📦 Body recibido:", req.body); // 👈👈 Añade esta línea
  const { id } = req.params;
  const { name } = req.body;

  console.log("🛠️ Actualizando subsubcategoría ID:", id, "Nuevo nombre:", name);

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "El nombre no puede estar vacío" });
  }

  try {
    const result = await pool.query(
      "UPDATE subsubcategories SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Subsubcategoría no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error actualizando subsubcategoría:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});


// ❌ Eliminar sub-subcategoría
router.delete("/subsubcategories/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM subsubcategories WHERE id = $1", [req.params.id]);
    res.json({ message: "Sub-subcategoría eliminada correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar sub-subcategoría:", err);
    res.status(500).json({ error: "Error al eliminar sub-subcategoría" });
  }
});

export default router;
