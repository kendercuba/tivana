import express from "express";
import multer from "multer";

import {
  deleteZmLoyverseItemImport,
  importZmLoyverseItemsFromBuffer,
  listZmLoyverseItemCategories,
  listZmLoyverseItemImports,
  listZmLoyverseItems,
} from "../services/zmLoyverseItemsService.mjs";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get("/", async (req, res) => {
  try {
    const rows = await listZmLoyverseItems();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("zm_loyverse_items list error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudieron cargar los artículos Loyverse.",
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const rows = await listZmLoyverseItemCategories();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("zm_loyverse_items categories error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudieron cargar las categorías.",
    });
  }
});

router.get("/imports", async (req, res) => {
  try {
    const rows = await listZmLoyverseItemImports({
      limit: req.query.limit,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("zm_loyverse_items imports error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo cargar el historial de importaciones.",
    });
  }
});

router.delete("/imports/:id", async (req, res) => {
  try {
    const ok = await deleteZmLoyverseItemImport(req.params.id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "No se encontró esa importación.",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("zm_loyverse_items import delete error:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo eliminar la importación.",
    });
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Selecciona un archivo CSV o Excel.",
      });
    }
    const name = req.file.originalname || "upload";
    const lower = name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/i.test(lower)) {
      return res.status(400).json({
        success: false,
        message: "Formato no admitido. Usa .csv, .xls o .xlsx.",
      });
    }
    const result = await importZmLoyverseItemsFromBuffer(
      req.file.buffer,
      name
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("zm_loyverse_items import error:", error);
    return res.status(400).json({
      success: false,
      message:
        error?.message ||
        "No se pudo importar el archivo. Revisa que sea el export de artículos Loyverse.",
    });
  }
});

export default router;
