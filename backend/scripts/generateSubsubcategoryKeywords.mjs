// este script es para generar el archivo Subsubcategorykeywords.mjs con todos los datos de la base de datos se ejcuta node scripts/generateSubsubcategoryKeywords.mjs
// classification/subsubcategoryKeywords.mjs
// este script es para generar el archivo Subsubcategorykeywords.mjs con todos los datos de la base de datos se ejcuta node scripts/generateSubsubcategoryKeywords.mjs
import fs from "fs";
import { pool } from "../db.mjs";

/* =====================================================
   GENERADOR INTELIGENTE DE SUBSUBCATEGORY KEYWORDS
===================================================== */

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* elimina palabras inútiles */
const stopwords = [
  "y",
  "de",
  "para",
  "con",
  "en",
  "del",
  "la",
  "el",
  "los",
  "las"
];

function extractKeywords(name) {

  const normalized = normalize(name);

  const words = normalized
    .split(" ")
    .filter(w => w.length > 3 && !stopwords.includes(w));

function singularize(word) {

  if (word.endsWith("ones")) {
    return word.replace("ones", "ón");
  }

  if (word.endsWith("es")) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && word.length > 4) {
    return word.slice(0, -1);
  }

  return word;
}

const singulars = words.map(singularize);

  const strong = [
    normalized,
    ...words,
    ...singulars
  ];

  const medium = words;

  const weak = singulars;

  return {
    strong: [...new Set(strong)],
    medium: [...new Set(medium)],
    weak: [...new Set(weak)]
  };

}

async function generate() {

  const categories = await pool.query(`
    SELECT id,name FROM categories
  `);

  const subcategories = await pool.query(`
    SELECT id,name,category_id FROM subcategories
  `);

  const subsubs = await pool.query(`
    SELECT id,name,subcategory_id FROM subsubcategories
  `);

  const categoryMap = new Map(
    categories.rows.map(c => [c.id, c.name.toLowerCase()])
  );

  const subMap = new Map(
    subcategories.rows.map(s => [
      s.id,
      {
        name: s.name.toLowerCase(),
        category_id: s.category_id
      }
    ])
  );

  const result = {};

  for (const sub of subsubs.rows) {

    const subData = subMap.get(sub.subcategory_id);

    if (!subData) continue;

    const subName = normalize(subData.name);
    const subsubName = normalize(sub.name);

    if (!result[subName]) {
      result[subName] = {};
    }

    result[subName][subsubName] = extractKeywords(subsubName);

  }

  const fileContent = `
// AUTO-GENERATED FILE
// DO NOT EDIT MANUALLY

export const subsubcategoryKeywords =
${JSON.stringify(result, null, 2)};
`;

  fs.writeFileSync(
    "./classification/subsubcategoryKeywords.mjs",
    fileContent
  );

  console.log("✅ subsubcategoryKeywords.mjs generado correctamente");

}

generate();