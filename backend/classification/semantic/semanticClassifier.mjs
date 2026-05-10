import { preprocessText } from "../preprocessText.mjs";
import { findBestCategory } from "../categoryKeywords.mjs";
import { findBestSubcategory } from "../subcategoryKeywords.mjs";
import { findBestSubsubcategory } from "../subsubcategoryKeywords.mjs";
import { analyzeKeywords } from "../keywordAnalyzer.mjs";

export async function semanticClassifier({
  products,
  taxonomy,
  mode = "only-null",
  level = "all",
  fieldWeights = { title: 0.7, description: 0.3 }
}) {

  const result = [];

  for (const p of products) {

    const title = p.title?.es || p.title || "";
    const description = p.description || "";

    const text = preprocessText(`${title} ${description}`);

    const product = { ...p };

    /* =============================
       CATEGORY
    ============================= */

    if (
      level === "all" ||
      level === "category"
    ) {

      if (
        mode === "force" ||
        !product.category_id
      ) {

        const cat = findBestCategory(
          text,
          taxonomy.categories
        );

        if (cat) {
          product.category_id = cat.id;
        }

      }

    }

    /* =============================
       SUBCATEGORY
    ============================= */

    if (
      (level === "all" ||
      level === "subcategory") &&
      product.category_id
    ) {

      if (
        mode === "force" ||
        !product.subcategory_id
      ) {

        const sub = findBestSubcategory(
          text,
          product.category_id,
          taxonomy.subcategories
        );

        if (sub) {
          product.subcategory_id = sub.id;
        }

      }

    }

    /* =============================
       SUBSUBCATEGORY
    ============================= */

    if (
      (level === "all" ||
      level === "subsubcategory") &&
      product.subcategory_id
    ) {

      if (
        mode === "force" ||
        !product.subsubcategory_id
      ) {

        const subsub =
          findBestSubsubcategory(
            text,
            product.subcategory_id,
            taxonomy.subsubcategories
          );

        if (subsub) {
          product.subsubcategory_id = subsub.id;
        }

      }

    }

    result.push(product);

  }

const unclassified = result.filter(p => !p.category_id);

if (unclassified.length) {
  analyzeKeywords(unclassified);
}

  return result;

}