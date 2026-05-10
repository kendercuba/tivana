// routes/import/map-normalized.routes.mjs
// Crea el archivo _mapped.json a partir del _normalized.json
// 🔥 NO normaliza (eso ya ocurrió en el paso 2)

import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ============================================================
   DIRECTORIOS
============================================================ */
const NORMALIZED_DIR = path.resolve("uploads/normalized");
const MAPPED_DIR = path.resolve("uploads/mapped");

// Asegurar que exista el directorio mapped
if (!fs.existsSync(MAPPED_DIR)) {
  fs.mkdirSync(MAPPED_DIR, { recursive: true });
}


/* ============================================================
   📌 LISTAR HISTORIAL MAPPED (BATCHES)
============================================================ */
router.get("/mapped-batches", async (req, res) => {
  try {
    if (!fs.existsSync(MAPPED_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs
      .readdirSync(MAPPED_DIR)
      .filter(f => f.endsWith("_mapped.json"))
      .map(filename => {
        const filePath = path.join(MAPPED_DIR, filename);
        const stats = fs.statSync(filePath);

        // contar productos
        let totalProducts = 0;
        try {
          const json = JSON.parse(
            fs.readFileSync(filePath, "utf8")
          );
          totalProducts = Array.isArray(json)
            ? json.length
            : 0;
        } catch {
          totalProducts = 0;
        }

        return {
          id: filename,
          filename,
          total_products: totalProducts,
          date: stats.mtime.toISOString().split("T")[0],
          time: stats.mtime.toTimeString().split(" ")[0],
          status: "mapped"
        };
      });

    return res.json({
      success: true,
      files
    });

  } catch (err) {
    console.error("❌ Error listando mapped batches:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* ============================================================
   📌 LISTAR ARCHIVOS MAPPED
============================================================ */
router.get("/mapped-files", async (req, res) => {
  try {
    if (!fs.existsSync(MAPPED_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs
      .readdirSync(MAPPED_DIR)
      .filter(file => file.endsWith("_mapped.json"));

    return res.json({
      success: true,
      files
    });

  } catch (err) {
    console.error("❌ Error listando mapped:", err);
    return res.status(500).json({
      success: false,
      error: "Error listando archivos mapeados"
    });
  }
});


/* ============================================================
   📦 OBTENER CONTENIDO DE ARCHIVO MAPPED
============================================================ */
router.get("/mapped-file/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    const filePath = path.join(MAPPED_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo no encontrado"
      });
    }

    const products = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );

    return res.json({
      success: true,
      products
    });

  } catch (err) {
    console.error("❌ Error leyendo mapped-file:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


/* ============================================================
   🗺️ MAPEAR ARCHIVO NORMALIZADO
============================================================ */
router.post("/map-normalized", async (req, res) => {
  try {
    const { normalizedFilename } = req.body;

    if (!normalizedFilename) {
      return res.status(400).json({
        success: false,
        error: "normalizedFilename requerido"
      });
    }

    if (!normalizedFilename.endsWith("_normalized.json")) {
      return res.status(400).json({
        success: false,
        error: "El archivo no es normalized"
      });
    }

    const inputPath = path.join(NORMALIZED_DIR, normalizedFilename);

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo normalizado no existe"
      });
    }

    const products = JSON.parse(
      fs.readFileSync(inputPath, "utf8")
    );

    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({
        success: false,
        error: "Archivo sin productos válidos"
      });
    }

    /* ============================================================
       PREPARAR PARA REVISIÓN
    ============================================================ */
    const mappedProducts = products.map((p) => ({
      ...p,
      category_id: p.category_id ?? null,
      subcategory_id: p.subcategory_id ?? null,
      subsubcategory_id: p.subsubcategory_id ?? null,
      ai: null
    }));

    const mappedFilename = normalizedFilename.replace(
      "_normalized.json",
      "_mapped.json"
    );

    const outputPath = path.join(MAPPED_DIR, mappedFilename);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(mappedProducts, null, 2),
      "utf8"
    );

    /* ============================================================
       REGISTRAR EN mapped_batches.json
    ============================================================ */
    const MAPPED_BATCH_FILE = path.resolve("uploads/mapped_batches.json");

    if (!fs.existsSync(MAPPED_BATCH_FILE)) {
      fs.writeFileSync(MAPPED_BATCH_FILE, JSON.stringify([], null, 2));
    }

    let batches = JSON.parse(
      fs.readFileSync(MAPPED_BATCH_FILE, "utf8")
    );

    const now = new Date();

    const newBatch = {
      id: "map_" + Date.now(),
      filename: mappedFilename,
      total_products: mappedProducts.length,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      status: "mapped",
      reviewed: false
    };

    batches.push(newBatch);

    fs.writeFileSync(
      MAPPED_BATCH_FILE,
      JSON.stringify(batches, null, 2),
      "utf8"
    );

    return res.json({
      success: true,
      mappedFilename,
      total: mappedProducts.length
    });

  } catch (err) {
    console.error("❌ Error map-normalized:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


export default router;
