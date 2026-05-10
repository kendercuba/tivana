import fs from "fs";
import path from "path";

const inputPath = process.argv[2];
const limit = Number(process.argv[3] || 20);

if (!inputPath) {
  console.error("❌ Debes pasar la ruta del archivo JSON");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

// 🔥 SOPORTE PARA AMBOS FORMATOS
let products = [];

if (Array.isArray(raw)) {
  products = raw;
} else if (Array.isArray(raw.products)) {
  products = raw.products;
} else {
  console.error("❌ El archivo no contiene productos válidos");
  process.exit(1);
}

const sliced = products.slice(0, limit);

const output = {
  original_file: path.basename(inputPath),
  generated_at: new Date().toISOString(),
  total_products: sliced.length,
  products: sliced
};

const outputDir = path.resolve("uploads/test");
fs.mkdirSync(outputDir, { recursive: true });

const outputFile = path.join(
  outputDir,
  path.basename(inputPath).replace(".json", `_test_${limit}.json`)
);

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

console.log("✅ Archivo de prueba generado:");
console.log("📦 Productos:", sliced.length);
console.log("📁 Ruta:", outputFile);
