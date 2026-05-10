// classification/taxonomyCache.mjs
import { pool } from "../db.mjs";

// Cache en memoria
let cache = {
  categories: null,
  subcategories: null,
  subsubcategories: null
};

/**
 * Carga la taxonomía completa.
 * ⚠️ Usa cache si ya está cargado.
 */
export async function loadTaxonomy() {
  if (cache.categories) {
    return cache;
  }

  cache.categories = (
    await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    )
  ).rows;

  cache.subcategories = (
    await pool.query(
      "SELECT id, name, category_id FROM subcategories ORDER BY name"
    )
  ).rows;

  cache.subsubcategories = (
    await pool.query(
      "SELECT id, name, subcategory_id FROM subsubcategories ORDER BY name"
    )
  ).rows;

  return cache;
}

/**
 * 🔥 Limpia completamente el cache de taxonomía.
 * DEBE llamarse después de crear / editar / eliminar
 * categorías, subcategorías o subsubcategorías.
 */
export function clearTaxonomyCache() {
  cache = {
    categories: null,
    subcategories: null,
    subsubcategories: null
  };
}
