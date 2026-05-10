import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const MAPPED_BATCH_FILE = path.resolve("uploads/mapped_batches.json");

/* ============================================================
   🔹 Asegurar archivo
============================================================ */
if (!fs.existsSync(MAPPED_BATCH_FILE)) {
  fs.writeFileSync(MAPPED_BATCH_FILE, JSON.stringify([], null, 2));
}

/* ============================================================
   📌 GET /import/mapped-batches
============================================================ */
router.get("/mapped-batches", async (req, res) => {
  try {
    const data = JSON.parse(
      fs.readFileSync(MAPPED_BATCH_FILE, "utf8")
    );

    return res.json({
      success: true,
      batches: data
    });
  } catch (err) {
    console.error("Error leyendo mapped_batches:", err);
    return res.status(500).json({
      success: false,
      error: "Error leyendo mapped batches"
    });
  }
});

export default router;
