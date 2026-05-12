import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  importBankExcel,
  listBankImportBatches,
  listMovementsByBatchId,
  listMovementsByBankAccountId,
  deleteBankImportBatch,
  getBankSummaryByAccount,
  getBankMovementCategoryOptions,
  updateBankMovementCategory,
  reassignImportBatchAccount,
  reapplyBankClassificationToAccount,
} from "../../finance/services/bankImportService.mjs";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads", "finance", "bank");

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
    const rows = await listBankImportBatches({ limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando lotes BNC:", error);
    return res.status(500).json({
      success: false,
      message: "Error listando historial de importaciones.",
      error: error.message,
    });
  }
});

router.get("/movement-categories", async (req, res) => {
  try {
    const data = await getBankMovementCategoryOptions();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error categorías BNC:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando categorías.",
      error: error.message,
    });
  }
});

router.post("/movements/by-account/:bankAccountId/reclassify", async (req, res) => {
  try {
    const data = await reapplyBankClassificationToAccount(req.params.bankAccountId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error reclasificando movimientos:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error reclasificando movimientos.",
      error: error.message,
    });
  }
});

router.get("/movements/by-account/:bankAccountId", async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await listMovementsByBankAccountId(req.params.bankAccountId, {
      limit,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando movimientos por cuenta:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando movimientos de la cuenta.",
      error: error.message,
    });
  }
});

router.patch("/movements/:id", async (req, res) => {
  try {
    const category = req.body?.category;
    if (!category || typeof category !== "string") {
      return res.status(400).json({
        success: false,
        message: "Envía category (texto) en el cuerpo.",
      });
    }
    const row = await updateBankMovementCategory(req.params.id, category.trim());
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("❌ Error actualizando categoría:", error);
    const status = error.message?.includes("no encontrado") ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Error actualizando categoría.",
      error: error.message,
    });
  }
});

router.get("/batches/:id/movements", async (req, res) => {
  try {
    const rows = await listMovementsByBatchId(req.params.id);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando movimientos del lote:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando movimientos.",
      error: error.message,
    });
  }
});

router.patch("/batches/:id/account", async (req, res) => {
  try {
    const raw = req.body?.bankAccountId;
    const bankAccountId = Number(raw);
    if (!Number.isFinite(bankAccountId) || bankAccountId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Envía bankAccountId (número de cuenta activa).",
      });
    }
    const data = await reassignImportBatchAccount(req.params.id, bankAccountId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error reasignando cuenta del lote:", error);
    const status = error.message?.includes("no encontrado") ? 404 : 400;
    return res.status(status).json({
      success: false,
      message: error.message || "Error actualizando la cuenta del lote.",
      error: error.message,
    });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const ok = await deleteBankImportBatch(req.params.id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "Lote no encontrado.",
      });
    }
    return res.json({
      success: true,
      message: "Lote y movimientos asociados eliminados.",
    });
  } catch (error) {
    console.error("❌ Error eliminando lote BNC:", error);
    return res.status(500).json({
      success: false,
      message: "Error eliminando el lote.",
      error: error.message,
    });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const { bankAccountId, dateFrom, dateTo } = req.query;
    const rows = await getBankSummaryByAccount({
      bankAccountId,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error resumen banco:", error);
    return res.status(500).json({
      success: false,
      message: "Error generando resumen.",
      error: error.message,
    });
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    const rawId = req.body?.bankAccountId;
    let bankAccountId = null;
    if (rawId != null && rawId !== "") {
      const n = Number(rawId);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({
          success: false,
          message: "bankAccountId inválido.",
        });
      }
      bankAccountId = n;
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Debes subir un archivo Excel.",
      });
    }

    const result = await importBankExcel({
      filePath: req.file.path,
      sourceFile: req.file.originalname,
      bankAccountId,
    });

    return res.json({
      success: true,
      message: "Archivo bancario importado correctamente.",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error importando banco:", error);

    return res.status(500).json({
      success: false,
      message: "Error importando archivo bancario.",
      error: error.message,
    });
  }
});

export default router;