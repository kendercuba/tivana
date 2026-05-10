import express from "express";
import { pool } from "../db.mjs";
import { clearTaxonomyCache } from "../classification/taxonomyCache.mjs";

const router = express.Router();


// Obtener todas las categorías
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY position ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});


// Categorías con conteo
router.get("/with-count", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        COUNT(s.id) AS total_items
      FROM categories c
      LEFT JOIN subcategories s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.position ASC
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});


// Crear categoría
router.post("/", async (req, res) => {
  const { name } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO categories (name, created_at) VALUES ($1, NOW()) RETURNING *",
      [name]
    );

    clearTaxonomyCache();

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al crear categoría:", err);
    res.status(500).json({ error: "Error al crear categoría" });
  }
});


// Editar categoría
router.put("/:id", async (req, res) => {
  const { name } = req.body;

  try {
    await pool.query(
      "UPDATE categories SET name=$1 WHERE id=$2",
      [name, req.params.id]
    );

    clearTaxonomyCache();

    res.json({ message: "Categoría actualizada" });
  } catch (err) {
    console.error("Error editando categoría:", err);
    res.status(500).json({ error: "Error al editar categoría" });
  }
});


// Eliminar categoría
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM categories WHERE id=$1",
      [req.params.id]
    );

    clearTaxonomyCache();

    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    console.error("Error eliminando categoría:", err);
    res.status(500).json({ error: "Error al eliminar categoría" });
  }
});

export default router;