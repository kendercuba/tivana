import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ============================================================
   DIRECTORIOS DE TRABAJO
   (MISMA DEFINICIÓN QUE import.mjs)
============================================================ */
const TRANSLATED_DIR = path.resolve("uploads/translated");
const MAPPED_DIR = path.resolve("uploads/mapped");

/* ============================================================
   📄 LISTAR ARCHIVOS DE IMPORTACIÓN (CON ESTADO)
============================================================ */
router.get("/files", async (req, res) => {
  try {
    const translatedFiles = fs
      .readdirSync(TRANSLATED_DIR)
      .filter(f => f.endsWith("_translated.json"));

    const mappedFiles = fs
      .readdirSync(MAPPED_DIR)
      .filter(f => f.endsWith("_mapped.json"));

    const mappedIndex = {};
    for (const mf of mappedFiles) {
      const baseName = mf.replace("_mapped.json", "");
      mappedIndex[baseName] = mf;
    }

    const result = translatedFiles.map(tf => {
      const baseName = tf.replace("_translated.json", "");
      const translatedPath = path.join(TRANSLATED_DIR, tf);
      const stats = fs.statSync(translatedPath);

      const mappedFile = mappedIndex[baseName] || null;

      return {
        baseName,
        state: mappedFile ? "mapped" : "translated",
        translatedFile: tf,
        mappedFile,
        date: stats.mtime.toISOString().split("T")[0]
      };
    });

    return res.json({
      success: true,
      files: result
    });
  } catch (err) {
    console.error("❌ Error listando import files:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📄 LISTAR ARCHIVOS TRADUCIDOS
============================================================ */
router.get("/translated-files", async (req, res) => {
  try {
    const files = fs
      .readdirSync(TRANSLATED_DIR)
      .filter(f => f.endsWith(".json"))
      .map(filename => {
        const stats = fs.statSync(path.join(TRANSLATED_DIR, filename));
        return {
          filename,
          size: stats.size,
          date: stats.mtime.toISOString().split("T")[0]
        };
      });

    return res.json({ success: true, files });
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   👀 PREVIEW DE ARCHIVO TRADUCIDO
============================================================ */
router.get("/preview-file/:filename", async (req, res) => {
  try {
    const filePath = path.join(TRANSLATED_DIR, req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.json({ success: false, error: "File not found" });
    }

    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const products = Array.isArray(json)
      ? json
      : Array.isArray(json.products)
      ? json.products
      : [];

    return res.json({
      success: true,
      products: products.slice(0, 50),
      total: products.length
    });
  } catch (err) {
    console.error("❌ Preview error:", err);
    return res.json({ success: false });
  }
});

/* ============================================================
   📄 LISTAR ARCHIVOS MAPEADOS
============================================================ */
router.get("/mapped-files", async (req, res) => {
  try {
    const files = fs
      .readdirSync(MAPPED_DIR)
      .filter(f => f.endsWith(".json"))
      .map(filename => {
        const stats = fs.statSync(path.join(MAPPED_DIR, filename));
        return {
          filename,
          size: stats.size,
          date: stats.mtime.toISOString().split("T")[0]
        };
      });

    return res.json({ success: true, files });
  } catch (err) {
    console.error("❌ Error leyendo mapped-files:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📄 OBTENER CONTENIDO COMPLETO DE ARCHIVO MAPEADO
============================================================ */
router.get("/mapped-file/:filename", async (req, res) => {
  try {
    const filePath = path.join(MAPPED_DIR, req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.json({
        success: false,
        error: "Mapped file not found"
      });
    }

    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

    return res.json({
      success: true,
      products: json,
      total: json.length
    });
  } catch (err) {
    console.error("❌ Error en /mapped-file:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   ✏️ GUARDAR CAMBIOS EN ARCHIVO MAPEADO
============================================================ */
router.put("/mapped-file/:filename", async (req, res) => {
  try {
    const filePath = path.join(MAPPED_DIR, req.params.filename);

   // Asegurar directorio y permitir crear el archivo si no existe
fs.mkdirSync(MAPPED_DIR, { recursive: true });
// si el archivo no existe, writeFileSync lo crea


    const { products } = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false });
    }

    fs.writeFileSync(
      filePath,
      JSON.stringify(products, null, 2),
      "utf8"
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Error guardando archivo mapeado:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
