import express from "express";
import fs from "fs";
import path from "path";

import { loadTaxonomy } from "../../classification/taxonomyCache.mjs";

const router = express.Router();

/* ============================================================
   DIRECTORIOS
============================================================ */
const TRANSLATED_DIR = path.resolve("uploads/translated");
const MAPPED_DIR = path.resolve("uploads/translated/mapped");

/* ============================================================
   📌 CLASIFICACIÓN COMPLETA CON IA (BATCH)
============================================================ */
router.post("/map", async (req, res) => {
  try {
    const { translatedFilename } = req.body;

    if (!translatedFilename) {
      return res.status(400).json({
        success: false,
        error: "translatedFilename requerido"
      });
    }

    // 🔒 VALIDAR ESTADO
    if (!translatedFilename.endsWith("_translated.json")) {
      return res.status(400).json({
        success: false,
        error: "El archivo no está en estado translated"
      });
    }

    const inputPath = path.join(TRANSLATED_DIR, translatedFilename);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo traducido no existe"
      });
    }

    const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
    const products = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.products)
      ? raw.products
      : [];

    if (!products.length) {
      throw new Error("El archivo no contiene productos válidos");
    }

    /* ============================================================
       1️⃣ NORMALIZAR PRODUCTOS PARA IA
    ============================================================ */
    const enrichedProducts = products.map((p, index) => {
      const title =
        p.title?.es ||
        p.title?.en ||
        p.title ||
        "Producto";

      let autoDescription = "";

      if (Array.isArray(p.specs) && p.specs.length > 0) {
        autoDescription = p.specs
          .map(s => `${s.name_en || s.name}: ${s.value_en || s.value}`)
          .join(", ");
      }

      if (!autoDescription.trim()) {
        autoDescription = "Producto general sin especificaciones detalladas.";
      }

      return {
        id: String(p.product_id || p.id || `fallback_${index}`),
        title,
        description: autoDescription,
        images: Array.isArray(p.images) ? p.images : []
      };
    });

    /* ============================================================
       2️⃣ CARGAR TAXONOMÍA
    ============================================================ */
    const taxonomy = await loadTaxonomy();

    /* ============================================================
       3️⃣ CLASIFICACIÓN IA POR BATCH
    ============================================================ */
    const classifications = await runBatchClassification({
      products: enrichedProducts,
      taxonomy,
      chunkSize: 300
    });

    /* ============================================================
       4️⃣ INDEXAR RESULTADOS
    ============================================================ */
    const classificationMap = {};
    for (const c of classifications) {
      classificationMap[String(c.id)] = c;
    }

    /* ============================================================
       5️⃣ MERGE FINAL
    ============================================================ */
    const mapped = products.map((p, index) => {
      const id = String(p.product_id || p.id || `fallback_${index}`);
      const ai = classificationMap[id] || {};

      return {
        ...p,
        category_id: ai.category_id ?? null,
        subcategory_id: ai.subcategory_id ?? null,
        subsubcategory_id: ai.subsubcategory_id ?? null,
        ai: {
          primary: {
            category_id: ai.category_id ?? null,
            subcategory_id: ai.subcategory_id ?? null,
            subsubcategory_id: ai.subsubcategory_id ?? null,
            confidence: ai.confidence ?? null
          },
          error: ai.ai_error ?? false
        }
      };
    });

    /* ============================================================
       6️⃣ GUARDAR ARCHIVO MAPEADO
    ============================================================ */
    const outputName = translatedFilename.replace(
      "_translated",
      "_mapped"
    );

    const outputPath = path.join(MAPPED_DIR, outputName);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(mapped, null, 2),
      "utf8"
    );

    return res.json({
      success: true,
      mappedFilename: outputName
    });

  } catch (err) {
    console.error("❌ Error /map:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ============================================================
   🧠 ANALIZAR CLASIFICACIONES (IA AUDITORA)
============================================================ */
router.post("/analyze-classifications", async (req, res) => {
  try {
    const { mappedFilename } = req.body;

    if (!mappedFilename) {
      return res.status(400).json({ success: false });
    }

    const filePath = path.join(MAPPED_DIR, mappedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false });
    }

    const products = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const taxonomy = await loadTaxonomy();

    const suggestions = auditClassifications({
      products,
      taxonomy
    });

    return res.json({
      success: true,
      suggestions
    });
  } catch (err) {
    console.error("❌ analyze-classifications:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📌 APLICAR SUGERENCIAS CONFIRMADAS
============================================================ */
router.post("/apply-suggestions", async (req, res) => {
  try {
    const { mappedFilename, suggestions } = req.body;

    if (!mappedFilename || !Array.isArray(suggestions)) {
      return res.status(400).json({ success: false });
    }

    const filePath = path.join(MAPPED_DIR, mappedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false });
    }

    const products = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const taxonomy = await loadTaxonomy();

    const updatedProducts = await applySuggestions({
      products,
      taxonomy,
      suggestions
    });

    fs.writeFileSync(
      filePath,
      JSON.stringify(updatedProducts, null, 2),
      "utf8"
    );

    return res.json({
      success: true,
      applied: suggestions.length
    });
  } catch (err) {
    console.error("❌ apply-suggestions:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📊 PROGRESO DEL BATCH IA
============================================================ */
router.get("/batch/progress", (req, res) => {
  res.json(global.batchProgress || { status: "idle", percent: 0 });
});

export default router;
