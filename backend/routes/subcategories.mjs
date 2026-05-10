import express from "express";
import { pool } from "../db.mjs";
import { clearTaxonomyCache } from "../classification/taxonomyCache.mjs";

const router = express.Router();

/* =====================================================
   📥 GET — Obtener subcategorías
===================================================== */

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sub.id,
        sub.name,
        sub.category_id,
        cat.name AS categoria_nombre
      FROM subcategories sub
      JOIN categories cat ON sub.category_id = cat.id
      ORDER BY sub.position ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener subcategorías:", error);
    res.status(500).json({ error: "Error al obtener subcategorías" });
  }
});


/* =====================================================
   🟦 GET — Subcategorías con conteo
===================================================== */

router.get("/with-count", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.category_id,
        COUNT(ss.id) AS total_items
      FROM subcategories s
      LEFT JOIN subsubcategories ss ON ss.subcategory_id = s.id
      GROUP BY s.id
      ORDER BY s.position ASC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener subcategorías" });
  }
});


/* =====================================================
   ➕ POST — Crear subcategoría
===================================================== */

router.post("/", async (req, res) => {
  const { name, category_id } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: "name y category_id son requeridos" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO subcategories (name, category_id)
      VALUES ($1, $2)
      RETURNING id, name, category_id
      `,
      [name.trim(), category_id]
    );

    clearTaxonomyCache();

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear subcategoría:", err);
    res.status(500).json({ error: "Error al crear subcategoría" });
  }
});


/* =====================================================
   ✏️ PUT — Editar subcategoría
===================================================== */

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;

  try {
    await pool.query(
      "UPDATE subcategories SET name = $1 WHERE id = $2",
      [name, id]
    );

    clearTaxonomyCache();

    res.json({ success: true });
  } catch (err) {
    console.error("Error al renombrar subcategoría:", err);
    res.status(500).json({ error: "Error al renombrar subcategoría" });
  }
});


/* =====================================================
   ❌ DELETE — Eliminar subcategoría
===================================================== */

router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM subcategories WHERE id = $1",
      [req.params.id]
    );

    clearTaxonomyCache();

    res.json({ message: "Subcategoría eliminada" });
  } catch (err) {
    console.error("Error al eliminar subcategoría:", err);
    res.status(500).json({ error: "Error al eliminar subcategoría" });
  }
});

export default router;