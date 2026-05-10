import express from "express";
import fs from "fs";
import path from "path";
import { loadTaxonomy } from "../../classification/taxonomyCache.mjs";

const router = express.Router();
const MAPPED_DIR = path.resolve("uploads/translated/mapped");

router.post("/audit", async (req, res) => {
  try {
    const {
      mappedFilename,
      products: productsFromUI,
      level,        // ✅ AHORA SÍ
      draftEdits    // ✅ AHORA SÍ
    } = req.body;

    if (!mappedFilename) {
      return res.status(400).json({
        success: false,
        error: "mappedFilename requerido"
      });
    }

    let products;

    // ✅ PRIORIDAD: productos reales del UI
    if (Array.isArray(productsFromUI)) {
      products = productsFromUI;
    } else {
      const filePath = path.join(MAPPED_DIR, mappedFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: "Archivo mapeado no existe"
        });
      }

      products = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    const taxonomy = await loadTaxonomy();

    // 🧠 AUDITORÍA REAL (RESPETA NIVEL)
    const suggestions = await auditClassifications({
      products,
      taxonomy,
      draftEdits,
      level
    });

    return res.json({
      success: true,
      suggestions
    });

  } catch (err) {
    console.error("❌ audit:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
