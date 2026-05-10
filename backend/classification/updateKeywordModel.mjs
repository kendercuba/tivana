import fs from "fs";
import path from "path";

const MODEL_DIR = path.resolve("classification/keyword-model");

// Crear carpeta si no existe
if (!fs.existsSync(MODEL_DIR)) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

const FILES = {
  category: path.join(MODEL_DIR, "categories.json"),
  subcategory: path.join(MODEL_DIR, "subcategories.json"),
  subsubcategory: path.join(MODEL_DIR, "subsubcategories.json"),
};

// Asegurar archivos iniciales
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({}, null, 2));
}

// Stopwords en español (núcleo)
const STOPWORDS = new Set([
  "de","la","el","en","para","con","los","las","y","un","una","por","del","al",
  "se","su","sin","muy","mas","menos","etc","a"
]);

// 🔹 Normalización REAL (PASO 1.5)
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-zñ\s]/g, " ")      // solo letras
    .split(/\s+/)
    .filter(w =>
      w.length > 2 &&
      !STOPWORDS.has(w)
    )
    .map(w => {
      // singularización básica
      if (w.endsWith("es")) return w.slice(0, -2);
      if (w.endsWith("s")) return w.slice(0, -1);
      return w;
    })
    .filter(Boolean);
}

function loadModel(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveModel(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/* ============================================================
   📌 FUNCIÓN PRINCIPAL — PASO 1.5 REAL
============================================================ */
export function updateKeywordModel({ level, target_id, text }) {
  if (!text || !FILES[level]) return;

  const keywords = normalizeText(text);
  if (!keywords.length) return;

  const filePath = FILES[level];
  const data = loadModel(filePath);

  if (!data[target_id]) data[target_id] = [];

  data[target_id].push(...keywords);
  data[target_id] = [...new Set(data[target_id])]; // sin duplicados

  saveModel(filePath, data);

  console.log(`📈 Keywords aprendidas para ${level} ${target_id}:`, keywords);
}
