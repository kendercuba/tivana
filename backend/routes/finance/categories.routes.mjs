import express from "express";
import {
  listFinanceCategories,
  createFinanceCategory,
  updateFinanceCategory,
  deleteFinanceCategory,
} from "../../finance/services/financeCategoriesService.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await listFinanceCategories();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando categorías finanzas:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando categorías.",
      error: error.message,
    });
  }
});

router.post("/", express.json(), async (req, res) => {
  try {
    const row = await createFinanceCategory(req.body || {});
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error creando categoría:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error creando categoría.",
    });
  }
});

router.patch("/:id", express.json(), async (req, res) => {
  try {
    const row = await updateFinanceCategory(req.params.id, req.body || {});
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error actualizando categoría:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error actualizando categoría.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteFinanceCategory(req.params.id);
    return res.json({
      success: true,
      message: "Categoría eliminada.",
    });
  } catch (error) {
    console.error("❌ Error eliminando categoría:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error eliminando categoría.",
    });
  }
});

export default router;
