import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  importLoyverseExcel,
  listLoyverseImportBatches,
  listLoyverseFactsByBatchId,
  listLoyverseFactsByFactTypes,
  deleteLoyverseImportBatch,
} from "../../finance/services/loyverseImportService.mjs";
import {
  listLoyverseDailyRates,
  upsertLoyverseDailyRate,
} from "../../finance/services/loyverseDailyRatesService.mjs";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads", "finance", "loyverse");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({ storage });

router.get("/batches", async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await listLoyverseImportBatches({ limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando lotes Loyverse:", error);
    return res.status(500).json({
      success: false,
      message: "Error listando historial Loyverse.",
      error: error.message,
    });
  }
});

router.get("/batches/:id/facts", async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await listLoyverseFactsByBatchId(req.params.id, { limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando hechos Loyverse:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando datos del lote.",
      error: error.message,
    });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const ok = await deleteLoyverseImportBatch(req.params.id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "Lote no encontrado.",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error borrando lote Loyverse:", error);
    return res.status(500).json({
      success: false,
      message: "Error eliminando el lote.",
      error: error.message,
    });
  }
});

/** Vista agregada por tipo(s) de hecho (resumen diario / por pago / por artículo). */
router.get("/facts", async (req, res) => {
  try {
    const raw = req.query.types || "";
    const types = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (types.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Indica types=daily_summary,payment_breakdown,...",
      });
    }
    const limit = req.query.limit;
    const rows = await listLoyverseFactsByFactTypes(types, { limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando hechos Loyverse por tipo:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando datos Loyverse.",
      error: error.message,
    });
  }
});

router.get("/daily-rates", async (req, res) => {
  try {
    const rows = await listLoyverseDailyRates();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando tasas Loyverse:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando tasas del día.",
      error: error.message,
    });
  }
});

router.put("/daily-rates/:date", async (req, res) => {
  try {
    const raw = req.body?.rate_bs;
    await upsertLoyverseDailyRate(req.params.date, raw);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error guardando tasa Loyverse:", error);
    const status = /inválid|debe ser/i.test(error.message) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Error guardando la tasa del día.",
    });
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Debes subir un archivo Excel o CSV.",
      });
    }

    const reportHint = String(req.body.reportHint || "auto").trim() || "auto";

    const result = await importLoyverseExcel({
      filePath: req.file.path,
      sourceFile: req.file.originalname,
      reportHint,
    });

    return res.json({
      success: true,
      message: "Reporte Loyverse procesado.",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error importando Loyverse:", error);

    return res.status(500).json({
      success: false,
      message: "Error importando Loyverse.",
      error: error.message,
    });
  }
});

export default router;
