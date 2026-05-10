import express from "express";
import { pool } from "../db.mjs";
import { verifyToken } from "../middlewares/auth.mjs";

console.log("✅ saved.mjs cargado");

const router = express.Router();
router.use(verifyToken);

/**
 * 🧾 Obtener productos guardados por el usuario
 * GET /api/saved
 */
router.get("/", async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
    `SELECT 
       si.id,
       si.product_id,
       si.size,
       p.title,
       p.price,
       p.images[1] AS image  -- ✅ aquí debe ir esto
     FROM saved_items si
     JOIN products p ON si.product_id = p.id
     WHERE si.user_id = $1`,
    [userId]
  );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error al obtener productos guardados:", error);
    res.status(500).json({ error: "Error al obtener productos guardados" });
  }
});

/**
 * 💾 Guardar producto para más tarde
 * POST /api/saved
 * Body: { product_id, size }
 */
router.post("/", async (req, res) => {
  const userId = req.user.userId;
  const { product_id, size } = req.body;

  console.log("📝 Entrando a POST /api/saved", { userId, product_id, size });

  if (!product_id || !size) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    const exists = await pool.query(
      `SELECT 1 FROM saved_items WHERE user_id = $1 AND product_id = $2 AND size = $3`,
      [userId, product_id, size]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ error: "Ya está guardado" });
    }

    await pool.query(
      `INSERT INTO saved_items (user_id, product_id, size, quantity) VALUES ($1, $2, $3, 1)`,
      [userId, product_id, size]
    );

    res.json({ message: "Producto guardado correctamente" });
  } catch (error) {
    console.error("❌ Error al guardar producto:", error);
    res.status(500).json({ error: "Error al guardar producto" });
  }
});

/** ❌ Eliminar producto guardado */

router.delete("/:product_id/:size", async (req, res) => {
  const userId = req.user.userId;

  // 🔧 Normalizar los parámetros
  const productId = parseInt(req.params.product_id, 10);
  const size = req.params.size.trim(); // puedes usar .toUpperCase() si aplicara

  console.log("🧹 Eliminando producto guardado:", { userId, productId, size });

  if (!productId || !size) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    const deleted = await pool.query(
      `DELETE FROM saved_items WHERE user_id = $1 AND product_id = $2 AND size = $3`,
      [userId, productId, size]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("❌ Error al eliminar producto guardado:", error);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});




export default router;
