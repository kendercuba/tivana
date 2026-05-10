// frontend/src/api/admin/import/classificationApi.js

const API = import.meta.env.VITE_API_URL;

/* =====================================================
   📦 ARCHIVOS MAPEADOS
===================================================== */

export async function fetchMappedFiles() {
  const res = await fetch(`${API}/import/mapped-files`, {
    cache: "no-store"
  });
  return res.json();
}


export async function fetchMappedFile(filename) {
  const res = await fetch(`${API}/import/mapped-file/${filename}`, {
    cache: "no-store"
  });
  return res.json();
}

/* =====================================================
   📚 TAXONOMÍA (🔥 SIN CACHÉ)
===================================================== */

export async function fetchTaxonomy() {
  const res = await fetch(
    `${API}/import/taxonomy?_ts=${Date.now()}`,
    { cache: "no-store" }          
  );
  return res.json();
}

/* =====================================================
   📄 ARCHIVOS TRADUCIDOS
===================================================== */

export async function fetchTranslatedFiles() {
  const res = await fetch(`${API}/import/translated-files`, {
    cache: "no-store"
  });
  return res.json();
}

export async function fetchTranslatedFile(filename) {
  const res = await fetch(`${API}/import/preview-file/${filename}`, {
    cache: "no-store"
  });
  return res.json();
}


/* =====================================================
   ⚙️ CLASIFICACIÓN AUTOMÁTICA
===================================================== */

export async function autoClassifyCategories(mappedFilename) {
  const res = await fetch(`${API}/import/classify-categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mappedFilename })
  });

  return res.json();
}


export async function autoClassifySubcategories(mappedFilename) {
  const res = await fetch(`${API}/import/classify-subcategories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mappedFilename })
  });

  return res.json();
}

export async function autoClassifySubsubcategories(mappedFilename) {
  const res = await fetch(`${API}/import/classify-subsubcategories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mappedFilename })
  });

  return res.json();
}

/* =====================================================
   🧠 ANÁLISIS IA
===================================================== */

export async function analyzeClassifications(mappedFilename) {
  const res = await fetch(`${API}/import/analyze-classifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mappedFilename })
  });

  return res.json();
}

/* =====================================================
   💡 SUGERENCIAS INLINE
===================================================== */

export async function suggestSubcategories(mappedFilename, productIds) {
  const res = await fetch(`${API}/import/suggest-subcategories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mappedFilename,
      productIds
    })
  });

  return res.json();
}

/* =====================================================
   ✅ APLICAR CAMBIOS
===================================================== */

export async function applySuggestions(mappedFilename, suggestions) {
  const res = await fetch(`${API}/import/apply-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mappedFilename,
      suggestions
    })
  });

  return res.json();
}

/* =====================================================
   🧠 SEMANTIC CLASSIFICATION (NUEVO MOTOR UNIVERSAL)
===================================================== */

export async function semanticClassify(mappedFilename, options = {}) {
  const res = await fetch(`${API}/import/semantic-classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mappedFilename,
      ...options
    })
  });

  return res.json();
}
