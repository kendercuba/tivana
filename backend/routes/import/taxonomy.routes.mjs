import express from "express";
import { loadTaxonomy } from "../../classification/taxonomyCache.mjs";

const router = express.Router();

/* ============================================================
   📚 TAXONOMÍA COMPLETA
   Fuente única para el frontend
============================================================ */
router.get("/taxonomy", async (req, res) => {
  try {
    const taxonomy = await loadTaxonomy();

    return res.json({
      success: true,
      categories: taxonomy.categories,
      subcategories: taxonomy.subcategories,
      subsubcategories: taxonomy.subsubcategories
    });
  } catch (err) {
    console.error("❌ Error taxonomía:", err);
    return res.json({ success: false });
  }
});

export default router;
