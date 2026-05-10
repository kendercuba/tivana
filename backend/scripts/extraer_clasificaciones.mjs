// este archivo  es para extraer todos los titulos del JSON  mas las categorias que fueron asignadas 
// y se corre desde la carpeta backend "node scripts/extraer_clasificaciones.mjs"

// backend/scripts/extraer_clasificaciones.mjs

import fs from "fs";
import path from "path";

const inputFile = path.resolve("./uploads/mapped/shein_hogar_cocina_mapped.json");
const outputFile = path.resolve("./scripts/clasificaciones_extraidas.json");

// leer JSON
const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));

// extraer datos
const result = data.map(p => ({
  titulo: p.title?.es || "",
  categoria_id: p.category_id || null,
  subcategoria_id: p.subcategory_id || null,
  subsubcategoria_id: p.subsubcategory_id || null,
  category_confidence: p.category_confidence || null,
  subcategory_confidence: p.subcategory_confidence || null,
  subsubcategory_confidence: p.subsubcategory_confidence || null
}));

// guardar resultado
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

console.log("✅ Archivo generado:", outputFile);
console.log("📦 Productos procesados:", result.length);