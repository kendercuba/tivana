import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const TRANSLATED_DIR = path.resolve("uploads/translated");

/* ============================================================
   🧠 STORAGE EN MEMORIA (estado extendido de batches)
============================================================ */
if (!global.importBatches) {
  global.importBatches = [];
}

/* ============================================================
   📜 LISTAR HISTORIAL DE TRADUCCIONES
============================================================ */
router.get("/batches", async (req, res) => {
  try {
    if (!fs.existsSync(TRANSLATED_DIR)) {
      return res.json({ batches: [] });
    }

    const files = fs
      .readdirSync(TRANSLATED_DIR)
      .filter(f => f.endsWith("_translated.json"));

    const batches = files.map((filename) => {
      const filePath = path.join(TRANSLATED_DIR, filename);
      const stats = fs.statSync(filePath);
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));

      const products = Array.isArray(content)
        ? content
        : content.products || [];

      // 🔍 buscar estado en memoria si existe
      const existing = global.importBatches.find(
        b => b.filename === filename
      );

      return {
        id: filename,
        filename,
        total_products: products.length,
        date: stats.mtime.toLocaleDateString(),
        time: stats.mtime.toLocaleTimeString(),
        status: existing?.status || "translated",
        mappedFilename: existing?.mappedFilename || null
      };
    });

    res.json({ batches });

  } catch (err) {
    console.error("❌ Error cargando batches:", err);
    res.status(500).json({ error: "Error cargando historial" });
  }
});

/* ============================================================
   🔄 ACTUALIZAR ESTADO DE UN BATCH (EXPORTABLE)
============================================================ */
export function updateBatchStatus({
  filename,
  status,
  mappedFilename = null
}) {
  if (!filename || !status) return;

  let batch = global.importBatches.find(b => b.filename === filename);

  if (!batch) {
    batch = { filename };
    global.importBatches.push(batch);
  }

  batch.status = status;

  if (mappedFilename) {
    batch.mappedFilename = mappedFilename;
  }

  batch.updated_at = new Date().toISOString();
}

export default router;
