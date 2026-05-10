// classification/semantic/similarityEngine.mjs

/* ============================================================
   🧠 SIMILARITY ENGINE - NIVEL PRODUCCIÓN
   ------------------------------------------------------------
   - Diseñado para millones de productos
   - Sin dependencias externas
   - Pre-indexable
   - Escalable
============================================================ */

/* ============================================================
   🔹 STOPWORDS ESPAÑOL (base mínima optimizable)
============================================================ */
const STOPWORDS = new Set([
  "de","la","el","los","las","y","o","en","para","con","sin",
  "un","una","unos","unas","por","del","al","que","es","se",
  "su","sus","como","más","menos","muy","ya","lo"
]);

/* ============================================================
   🔹 NORMALIZACIÓN DE TEXTO
============================================================ */
export function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")                // separar acentos
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, " ")    // quitar símbolos
    .replace(/\s+/g, " ")            // espacios múltiples
    .trim();
}

/* ============================================================
   🔹 TOKENIZACIÓN
============================================================ */
export function tokenize(text = "") {
  const normalized = normalizeText(text);
  const tokens = normalized.split(" ");

  return tokens.filter(
  token => token.length > 1 && !STOPWORDS.has(token)
);
}

/* ============================================================
   🔹 TERM FREQUENCY
============================================================ */
export function buildTermFrequency(tokens = []) {
  const tf = new Map();

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  return tf;
}

/* ============================================================
   🔹 VECTOR BUILDING (TF NORMALIZADO)
============================================================ */
export function buildVector(tfMap) {
  const vector = new Map();
  let magnitude = 0;

  for (const [term, freq] of tfMap.entries()) {
    vector.set(term, freq);
    magnitude += freq * freq;
  }

  magnitude = Math.sqrt(magnitude);

  return { vector, magnitude };
}

/* ============================================================
   🔹 COSINE SIMILARITY
============================================================ */
export function cosineSimilarity(vecA, vecB) {
  const { vector: vA, magnitude: magA } = vecA;
  const { vector: vB, magnitude: magB } = vecB;

  if (!magA || !magB) return 0;

  let dot = 0;

  for (const [term, valA] of vA.entries()) {
    const valB = vB.get(term);
    if (valB) {
      dot += valA * valB;
    }
  }

  return dot / (magA * magB);
}

/* ============================================================
   🔹 JACCARD SIMILARITY
============================================================ */
export function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set(
    [...setA].filter(x => setB.has(x))
  );

  const unionSize = setA.size + setB.size - intersection.size;

  if (unionSize === 0) return 0;

  return intersection.size / unionSize;
}

/* ============================================================
   🔹 BUILD TEXT VECTOR (CAMPO INDIVIDUAL)
============================================================ */
function buildTextVector(text) {
  const tokens = tokenize(text);
  const tf = buildTermFrequency(tokens);
  const vec = buildVector(tf);

  return {
    tokens,
    ...vec
  };
}

/* ============================================================
   🔹 CREATE VECTOR INDEX (PARA TAXONOMÍA)
   Se ejecuta UNA sola vez por archivo
============================================================ */
export function createVectorIndex(items = []) {
  return items.map(item => {
    const text = item.name;
    const built = buildTextVector(text);

    return {
      id: item.id,
      name: item.name,
      vector: built.vector,
      magnitude: built.magnitude,
      tokens: built.tokens
    };
  });
}

/* ============================================================
   🔹 COMPUTE SIMILARITY CON PESOS POR CAMPO
============================================================ */
export function computeSimilarity({
  fieldsA = {},
  index = [],
  fieldWeights = {}
}) {

  const builtFields = {};

  // 🔥 vectorizar el producto UNA sola vez
  for (const [fieldName, text] of Object.entries(fieldsA)) {

    if (!text) continue;

    builtFields[fieldName] = buildTextVector(text);

  }

  const results = [];

  for (const target of index) {

    let totalScore = 0;

    for (const [fieldName, builtA] of Object.entries(builtFields)) {

      const weight = fieldWeights[fieldName] || 0;
      if (!weight) continue;

      const cosine = cosineSimilarity(
        builtA,
        target
      );

      const jaccard = jaccardSimilarity(
        builtA.tokens,
        target.tokens
      );

      const hybridScore =
        0.7 * cosine +
        0.3 * jaccard;

      totalScore += hybridScore * weight;

    }

    results.push({
      id: target.id,
      score: totalScore
    });

  }

  results.sort((a, b) => b.score - a.score);

  return results[0] || null;

}