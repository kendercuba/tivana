import express from "express";
import fs from "fs";
import path from "path";

import { loadTaxonomy } from "../../classification/taxonomyCache.mjs";
import { subcategoryKeywords } from "../../classification/subcategoryKeywords.mjs";
import { semanticClassifier } from "../../classification/semantic/semanticClassifier.mjs";

const router = express.Router();

/* ============================================================
   DIRECTORIOS
============================================================ */
const MAPPED_DIR = path.resolve("uploads/mapped");


/* ============================================================
   📌 CLASIFICAR CATEGORÍAS AUTOMÁTICAMENTE
============================================================ */
router.post("/classify-categories", async (req, res) => {
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

    const toClassify = products.filter(p => !p.category_id);
    if (!toClassify.length) {
      return res.json({ success: true, skipped: true });
    }

    const results = await classifyCategories({
      categories: taxonomy.categories,
      products: toClassify
    });

    for (const r of results) {
      const prod = products.find(
          p => String(p.external_id || p.product_id || p.id) === String(r.id)
        );

      if (prod && r.category_id) {
        prod.category_id = r.category_id;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ classify-categories:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📌 CLASIFICAR SUBCATEGORÍAS AUTOMÁTICAMENTE
============================================================ */
router.post("/classify-subcategories", async (req, res) => {
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

    const groups = {};
    for (const p of products) {
      if (p.category_id && !p.subcategory_id) {
        if (!groups[p.category_id]) groups[p.category_id] = [];
        groups[p.category_id].push(p);
      }
    }

    for (const [categoryId, groupProducts] of Object.entries(groups)) {
      const category = taxonomy.categories.find(
        c => c.id === Number(categoryId)
      );

      const subcategories = taxonomy.subcategories.filter(
        s => s.category_id === Number(categoryId)
      );

      if (!category || !subcategories.length) continue;

      const results = await classifySubcategories({
        category,
        subcategories,
        products: groupProducts
      });

      for (const r of results) {
        const prod = products.find(
          p => String(p.external_id || p.product_id || p.id) === String(r.id)
        );
        if (prod) prod.subcategory_id = r.subcategory_id;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ classify-subcategories:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   📌 CLASIFICAR SUB-SUBCATEGORÍAS AUTOMÁTICAMENTE
============================================================ */
router.post("/classify-subsubcategories", async (req, res) => {
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

    const groups = {};
    for (const p of products) {
      if (p.subcategory_id && !p.subsubcategory_id) {
        if (!groups[p.subcategory_id]) groups[p.subcategory_id] = [];
        groups[p.subcategory_id].push(p);
      }
    }

    for (const [subcategoryId, groupProducts] of Object.entries(groups)) {
      const subcategory = taxonomy.subcategories.find(
        s => s.id === Number(subcategoryId)
      );

      const subsubs = taxonomy.subsubcategories.filter(
        ss => ss.subcategory_id === Number(subcategoryId)
      );

      if (!subcategory || !subsubs.length) continue;

      const results = await classifySubsubcategories({
        subcategory,
        subsubcategories: subsubs,
        products: groupProducts
      });

      for (const r of results) {
        const prod = products.find(
          p => String(p.external_id || p.product_id || p.id) === String(r.id)

        );
        if (prod) prod.subsubcategory_id = r.subsubcategory_id;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ classify-subsubcategories:", err);
    return res.status(500).json({ success: false });
  }
});

/* ============================================================
   🧠 SUGERIR SUBCATEGORÍAS (HEURÍSTICO, NO IA)
============================================================ */
router.post("/suggest-subcategories", async (req, res) => {
  try {
    const { mappedFilename, productIds } = req.body;

    if (!mappedFilename || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        error: "Parámetros inválidos"
      });
    }

    const filePath = path.join(MAPPED_DIR, mappedFilename);
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const products = JSON.parse(raw);

    const taxonomy = await loadTaxonomy();
    const suggestions = [];

    for (const p of products) {
      const pid = String(p.product_id || p.id);

      if (!productIds.includes(pid)) continue;
      if (p.subcategory_id || !p.category_id) continue;

      const text = (p.title?.es || p.title || "").toLowerCase();

      const validSubcategories = taxonomy.subcategories.filter(
        s => Number(s.category_id) === Number(p.category_id)
      );

      let bestMatch = null;
      let bestScore = 0;

      for (const sub of validSubcategories) {
        const keywords = subcategoryKeywords[sub.name.toLowerCase()];
        if (!keywords) continue;

        let score = 0;
        for (const kw of keywords) {
          if (text.includes(kw.toLowerCase())) score++;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = sub;
        }
      }

      if (bestMatch && bestScore > 0) {
        suggestions.push({
          product_id: pid,
          suggested_id: bestMatch.id,
          suggested_name: bestMatch.name,
          confidence: Math.min(0.95, bestScore / 5),
          reason: "keyword_match"
        });
      }
    }

    return res.json({
      success: true,
      suggestions
    });
  } catch (err) {
    console.error("❌ Error sugiriendo subcategorías:", err);
    return res.status(500).json({
      success: false,
      error: "Error interno"
    });
  }
});

/* ============================================================
   🧠 SEMANTIC CLASSIFICATION (UNIVERSAL)
============================================================ */
router.post("/semantic-classify", async (req, res) => {
  try {
    const {
  mappedFilename,
  mode = "only-null",
  level = "all", // 🔥 NUEVO
  fieldWeights = {
    title: 0.7,
    description: 0.3
  }
} = req.body;

    if (!mappedFilename) {
      return res.status(400).json({
        success: false,
        error: "mappedFilename requerido"
      });
    }

    const filePath = path.join(MAPPED_DIR, mappedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Archivo mapped no existe"
      });
    }

    // 📦 Cargar productos
    const products = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );

    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({
        success: false,
        error: "Archivo sin productos válidos"
      });
    }

    // 📚 Cargar taxonomía
    const taxonomy = await loadTaxonomy();

    // 🧠 Ejecutar clasificación semántica
   const classifiedProducts = await semanticClassifier({
  products,
  taxonomy,
  mode,
  fieldWeights,
  level
});

    // 💾 Guardar archivo actualizado
    fs.writeFileSync(
      filePath,
      JSON.stringify(classifiedProducts, null, 2),
      "utf8"
    );

    // 📊 Estadísticas básicas
    const total = classifiedProducts.length;
    const classifiedCount = classifiedProducts.filter(
      p => p.category_id
    ).length;

    return res.json({
      success: true,
      total,
      classified: classifiedCount,
      mode
    });

  } catch (err) {
    console.error("❌ semantic-classify:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


export default router;