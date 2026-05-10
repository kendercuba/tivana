import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ============================================================
   DIRECTORIOS DE TRABAJO
============================================================ */
const IMPORT_DIR = path.resolve("uploads/import");
const BACKUP_DIR = path.resolve("uploads/import/backups");

// Crear directorios si no existen
if (!fs.existsSync(IMPORT_DIR)) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/* ============================================================
   📌 PASO 1 — SUBIR ARCHIVO (ARCHIVO OPERATIVO)
   - Guarda archivo principal
   - Crea backup del raw original
   - NO crea estados
============================================================ */
router.post("/upload", async (req, res) => {
  try {
    const { filename, products } = req.body;

    if (!filename || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: "filename o products inválidos"
      });
    }

    const safeFilename = filename.endsWith(".json")
      ? filename
      : `${filename}.json`;

    const workPath = path.join(IMPORT_DIR, safeFilename);
    const backupPath = path.join(
      BACKUP_DIR,
      safeFilename.replace(".json", "_raw.json")
    );

    const payload = {
      products,
      meta: {
        uploaded_at: new Date().toISOString(),
        total: products.length
      }
    };

    // 🔥 Guardar archivo operativo
    fs.writeFileSync(workPath, JSON.stringify(payload, null, 2), "utf8");

    // 🔒 Guardar backup RAW (intocable)
    fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), "utf8");

    return res.json({
      success: true,
      filename: safeFilename,
      total_products: products.length
    });

  } catch (err) {
    console.error("❌ Error en /import/upload:", err);
    return res.status(500).json({
      success: false,
      error: "Error subiendo archivo"
    });
  }
});

export default router;
