import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import XLSX from "xlsx";

import {
  detectZmPurchaseOrdersLayout,
  parseZmPurchaseOrdersFile,
} from "../../finance/parsers/zmPurchaseOrdersParser.mjs";
import {
  importZmPurchaseOrdersFile,
  listZmPurchaseOrderBatches,
  listZmPurchaseOrderLinesByBatchId,
  listZmPurchaseOrderLinesInDateRange,
  deleteZmPurchaseOrderBatch,
  getZmPurchaseOrderDateBounds,
} from "../../finance/services/zmPurchaseOrdersImportService.mjs";

const router = express.Router();

const uploadDir = path.join(
  process.cwd(),
  "uploads",
  "finance",
  "zm-purchase-orders"
);

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

router.get("/meta", async (req, res) => {
  try {
    const bounds = await getZmPurchaseOrderDateBounds();
    return res.json({ success: true, data: bounds });
  } catch (error) {
    console.error("❌ Error meta órdenes de compra:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando metadatos.",
      error: error.message,
    });
  }
});

router.get("/batches", async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await listZmPurchaseOrderBatches({ limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando lotes órdenes de compra:", error);
    return res.status(500).json({
      success: false,
      message: "Error listando historial de órdenes de compra.",
      error: error.message,
    });
  }
});

router.get("/batches/:id/lines", async (req, res) => {
  try {
    const limit = req.query.limit;
    const rows = await listZmPurchaseOrderLinesByBatchId(req.params.id, {
      limit,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando líneas del lote:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando el lote.",
      error: error.message,
    });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const ok = await deleteZmPurchaseOrderBatch(req.params.id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "Lote no encontrado.",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Error borrando lote órdenes de compra:", error);
    return res.status(500).json({
      success: false,
      message: "Error eliminando el lote.",
      error: error.message,
    });
  }
});

router.get("/lines", async (req, res) => {
  try {
    const start = String(req.query.start || "").slice(0, 10);
    const end = String(req.query.end || "").slice(0, 10);
    const limit = req.query.limit;
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Indica start=YYYY-MM-DD y end=YYYY-MM-DD.",
      });
    }
    const rows = await listZmPurchaseOrderLinesInDateRange({
      startYmd: start,
      endYmd: end,
      limit,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Error listando líneas de compra:", error);
    return res.status(500).json({
      success: false,
      message: "Error cargando órdenes de compra.",
      error: error.message,
    });
  }
});

router.post("/validate-format", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Debes elegir un archivo Excel o CSV.",
      });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const readOpts = ext === ".csv" ? { codepage: 65001 } : {};
    const workbook = XLSX.readFile(tempPath, readOpts);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.json({
        success: true,
        data: { ok: false, message: "El libro no tiene hojas." },
      });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    const layout = detectZmPurchaseOrdersLayout(rows);
    if (!layout.ok) {
      return res.json({
        success: true,
        data: { ok: false, message: layout.error },
      });
    }

    const probe = parseZmPurchaseOrdersFile(tempPath, req.file.originalname);
    if (probe.parseError) {
      return res.json({
        success: true,
        data: { ok: false, message: probe.parseError },
      });
    }

    return res.json({
      success: true,
      data: {
        ok: true,
        message: null,
        rowCount: probe.lines.length,
      },
    });
  } catch (error) {
    console.error("❌ Error validando formato órdenes de compra:", error);
    return res.status(500).json({
      success: false,
      message: "No se pudo revisar el archivo.",
      error: error.message,
    });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Debes subir un archivo Excel o CSV.",
      });
    }

    const result = await importZmPurchaseOrdersFile({
      filePath,
      sourceFile: req.file.originalname,
    });

    if (result.parseError) {
      return res.status(400).json({
        success: false,
        message: result.parseError,
      });
    }

    return res.json({
      success: true,
      message: "Órdenes de compra importadas.",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error importando órdenes de compra:", error);

    return res.status(500).json({
      success: false,
      message: "Error importando órdenes de compra.",
      error: error.message,
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  }
});

export default router;
