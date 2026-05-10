import express from "express";
import fs from "fs";
import path from "path";

import normalizeProducts from "../../import/normalizeProduct.mjs";
import { detectOrigin } from "../../classification/detectorOrigin.mjs";

const router = express.Router();

/* ============================================================
   DIRECTORIOS
============================================================ */
const TRANSLATED_DIR = path.resolve("uploads/translated");
const NORMALIZED_DIR = path.resolve("uploads/normalized");

if (!fs.existsSync(NORMALIZED_DIR)) {
  fs.mkdirSync(NORMALIZED_DIR, { recursive: true });
}

/* ============================================================
   📌 LISTAR ARCHIVOS TRADUCIDOS
   (ESTO ES LO QUE TE FALTA)
============================================================ */
router.get("/translated-files", async (req, res) => {
  try {
    if (!fs.existsSync(TRANSLATED_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs
      .readdirSync(TRANSLATED_DIR)
      .filter(file => file.endsWith("_translated.json"));

    return res.json({
      success: true,
      files
    });

  } catch (err) {
    console.error("❌ Error listando translated:", err);
    return res.status(500).json({
      success: false,
      error: "Error listando archivos"
    });
  }
});

/* ============================================================
   📌 LISTAR ARCHIVOS NORMALIZADOS
============================================================ */
router.get("/normalized-files", async (req, res) => {
  try {
    if (!fs.existsSync(NORMALIZED_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs
      .readdirSync(NORMALIZED_DIR)
      .filter(file => file.endsWith("_normalized.json"))
      .map(file => {
        const filePath = path.join(NORMALIZED_DIR, file);
        const stats = fs.statSync(filePath);

        return {
          filename: file,
          size: stats.size,
          date: stats.mtime
        };
      });

    return res.json({
      success: true,
      files
    });

  } catch (err) {
    console.error("❌ Error listando normalized:", err);
    return res.status(500).json({
      success: false,
      error: "Error listando archivos normalizados"
    });
  }
});

/* ============================================================
   📌 NORMALIZAR ARCHIVO TRADUCIDO
============================================================ */
router.post("/normalize", async (req, res) => {

  try {
    const { translatedFilename } = req.body;

    if (!translatedFilename) {
      return res.status(400).json({
        success: false,
        error: "translatedFilename requerido"
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
      return res.status(400).json({
        success: false,
        error: "Archivo sin productos válidos"
      });
    }

    /* 🔎 Detectar origen */
    const origin = detectOrigin(translatedFilename);

    /* 🔥 Normalizar */
    const normalized = normalizeProducts(
  products.map(p => ({
    ...p,
    origin
  })),
  translatedFilename
);

    const outputName = translatedFilename.replace(
      "_translated",
      "_normalized"
    );

    const outputPath = path.join(NORMALIZED_DIR, outputName);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(normalized, null, 2),
      "utf8"
    );

    return res.json({
      success: true,
      normalizedFilename: outputName,
      total: normalized.length
    });

  } catch (err) {
    console.error("❌ Error normalizando:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ============================================================
   🗑 ELIMINAR ARCHIVO
============================================================ */
router.delete("/delete-file", async (req, res) => {
  try {
    const { filename, type } = req.body;

    if (!filename || !type) {
      return res.status(400).json({
        success: false,
        error: "filename y type requeridos"
      });
    }

    let baseDir;

    if (type === "translated") {
      baseDir = TRANSLATED_DIR;
    } else if (type === "normalized") {
      baseDir = NORMALIZED_DIR;
    } else if (type === "mapped") {
      baseDir = path.resolve("uploads/mapped");
    } else {
      return res.status(400).json({
        success: false,
        error: "Tipo inválido"
      });
    }

    const filePath = path.join(baseDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo no existe"
      });
    }

    fs.unlinkSync(filePath);

    return res.json({
      success: true
    });

  } catch (err) {
    console.error("❌ Error eliminando archivo:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



export default router;
