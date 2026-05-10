import express from "express";
import fs from "fs";
import path from "path";
import pkg from "@google-cloud/translate";

const { Translate } = pkg.v2;

const router = express.Router();

/* ============================================================
   CONFIG GOOGLE TRANSLATE
============================================================ */
const translate = new Translate({
  keyFilename: path.resolve("credentials/google-translate-key.json"),
});

/* ============================================================
   DIRECTORIOS
============================================================ */
const IMPORT_DIR = path.resolve("uploads/import");
const TRANSLATED_DIR = path.resolve("uploads/translated");

if (!fs.existsSync(TRANSLATED_DIR)) {
  fs.mkdirSync(TRANSLATED_DIR, { recursive: true });
}

/* ============================================================
   📌 TRADUCIR ARCHIVO (SOLO TRADUCE — NO NORMALIZA)
============================================================ */
router.post("/translate", async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "filename requerido" });
    }

    const inputPath = path.join(IMPORT_DIR, filename);

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: "Archivo no existe" });
    }

    const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));

    const products = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.products)
      ? raw.products
      : [];

    if (!products.length) {
      return res.status(400).json({ error: "Archivo sin productos válidos" });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const translated = [];
    const total = products.length;

    for (let i = 0; i < products.length; i++) {
      const rawProduct = products[i];

      /* =======================================================
         EXTRAER TEXTO ORIGINAL SIN MODIFICAR ESTRUCTURA
      ======================================================= */

      const titleEn =
        rawProduct.titulo ||
        rawProduct.title?.en ||
        rawProduct.title ||
        "";

      const descriptionEn =
        rawProduct.descripcion ||
        rawProduct.description?.en ||
        rawProduct.description ||
        "";

      /* =======================================================
         TRADUCIR SOLO TEXTO
      ======================================================= */

      const [titleEs] = titleEn
        ? await translate.translate(titleEn, "es")
        : [""];

      const [descEs] = descriptionEn
        ? await translate.translate(descriptionEn, "es")
        : [""];

      /* =======================================================
         MANTENER ESTRUCTURA ORIGINAL
      ======================================================= */

      const translatedProduct = {
        ...rawProduct,
        title: {
          en: titleEn,
          es: titleEs,
        },
        description: {
          en: descriptionEn,
          es: descEs,
        },
      };

      translated.push(translatedProduct);

      const progress = Math.round(((i + 1) / total) * 100);
      res.write(JSON.stringify({ progress }) + "\n");
    }

    const outputName = filename.replace(".json", "_translated.json");
    const outputPath = path.join(TRANSLATED_DIR, outputName);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(translated, null, 2),
      "utf8"
    );

    res.write(JSON.stringify({ done: true, filename: outputName }) + "\n");
    res.end();

  } catch (err) {
    console.error("❌ Error traduciendo:", err);
    res.status(500).json({ error: "Error traduciendo archivo" });
  }
});

export default router;
