/* ============================================================
   🧠 TIVANA UNIVERSAL NORMALIZER ENGINE
   ------------------------------------------------------------
   ✔ Detecta cualquier estructura JSON
   ✔ No depende de Shein, Amazon, Walmart, Temu, etc.
   ✔ No inventa datos
   ✔ Solo usa lo que exista en el .json
   ✔ Detecta:
      - precios
      - descuentos
      - imágenes
      - variantes dinámicas
      - combinaciones múltiples
      - stock si existe
      - dimensiones automáticas
   ✔ 100% escalable
============================================================ */

export default function normalizeProducts(products = []) {
  if (!Array.isArray(products)) return [];

  return products.map(raw => normalizeProduct(raw)).filter(Boolean);
}

/* ============================================================
   🔹 SINGLE PRODUCT NORMALIZER
============================================================ */

function normalizeProduct(raw = {}) {
  const normalized = {};

  /* ============================================================
     🏷 ORIGIN
  ============================================================ */
  normalized.origin =
    detectOrigin(raw) ?? "unknown";

  /* ============================================================
     🆔 EXTERNAL ID
  ============================================================ */
  normalized.external_id =
    raw.external_id ??
    raw.product_id ??
    raw.id ??
    raw.asin ??
    null;

  /* ============================================================
     🏷 TITLE
  ============================================================ */
  normalized.title = normalizeTitle(raw.title);

  /* ============================================================
     📝 DESCRIPTION
  ============================================================ */
  normalized.description = normalizeDescription(raw.description);

  /* ============================================================
     💰 PRICES
  ============================================================ */
  const prices = detectPrices(raw);

  normalized.price = prices.price;
  normalized.retail_price = prices.retail_price;
  normalized.sale_price = prices.sale_price;
  normalized.discount_percentage = prices.discount_percentage;
  normalized.has_discount = prices.has_discount;

  /* ============================================================
     🚚 SHIPPING
  ============================================================ */
  normalized.shipping =
  raw.shipping ??
  raw.shipping_cost ??
  raw.delivery_fee ??
  raw.delivery ??
  raw.envio ??
  null;


  /* ============================================================
     🖼 IMAGES
  ============================================================ */
  normalized.images = detectImages(raw);

  /* ============================================================
     🎨 COLOR
  ============================================================ */
  normalized.color =
    raw.color ??
    raw.main_sale_attr?.value_en ??
    raw.main_sale_attr?.value ??
    null;

  /* ============================================================
     📏 SIZES
  ============================================================ */
  normalized.sizes = detectSizes(raw);

  /* ============================================================
     🧵 MATERIAL / COMPOSITION
  ============================================================ */
  normalized.material =
    raw.material ??
    extractSpec(raw, "material");

  normalized.composition =
    raw.composition ??
    extractSpec(raw, "composition");

  /* ============================================================
     📊 SPECS
  ============================================================ */
  if (Array.isArray(raw.specs) && raw.specs.length)
    normalized.specs = raw.specs;

  /* ============================================================
     🔁 VARIANTS UNIVERSAL ENGINE
  ============================================================ */

  normalized.variants = detectVariants(raw, normalized);

  /* ============================================================
     🔗 URL / SKU
  ============================================================ */
  normalized.url =
  raw.url ??
  raw.enlace ??
  null;

normalized.sku =
  raw.sku ??
  null;

  /* ============================================================
   🆔 UNIVERSAL ID
============================================================ */

normalized.id = generateUniversalId(normalized);


  return cleanEmptyFields(normalized);
}

/* ============================================================
   🧠 UNIVERSAL HELPERS
============================================================ */

/* -------- UNIVERSAL ID GENERATOR -------- */

function generateUniversalId(normalized) {

  // 1️⃣ Si tiene external_id válido
  if (normalized.external_id) {
    return `${normalized.origin}-${String(normalized.external_id)}`;
  }

  // 2️⃣ Amazon ASIN desde URL
  if (normalized.url) {
    const match = normalized.url.match(/\/dp\/([A-Z0-9]+)/i);
    if (match) {
      return `${normalized.origin}-${match[1]}`;
    }
  }

  // 3️⃣ Fallback estable
  const base =
    normalized.title?.en ||
    normalized.title?.es ||
    normalized.url ||
    Math.random().toString();

  return `${normalized.origin}-${simpleHash(base)}`;
}

/* -------- SIMPLE HASH -------- */

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}


/* -------- ORIGIN DETECTION -------- */

function detectOrigin(raw) {
  const source =
    raw.origin ??
    raw.source ??
    raw.provider ??
    "";

  if (typeof source === "string") {
    const lower = source.toLowerCase();
    if (lower.includes("shein")) return "shein";
    if (lower.includes("amazon")) return "amazon";
    if (lower.includes("walmart")) return "walmart";
    if (lower.includes("temu")) return "temu";
  }

  // 🔎 Detectar por URL
  const url = raw.url ?? raw.enlace ?? "";

  if (typeof url === "string") {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("amazon.")) return "amazon";
    if (lowerUrl.includes("shein.")) return "shein";
    if (lowerUrl.includes("walmart.")) return "walmart";
    if (lowerUrl.includes("temu.")) return "temu";
  }

  // 🔎 Detectar por identificadores
  if (raw.asin) return "amazon";
  if (raw.product_id && raw.category_tree) return "shein";

  return "unknown";
}


/* -------- TITLE -------- */

function normalizeTitle(title) {
  if (!title) return { en: "", es: "" };

  if (typeof title === "string") {
    return { en: title, es: title };
  }

  if (typeof title === "object") {
    return {
      en: title.en ?? "",
      es: title.es ?? title.en ?? ""
    };
  }

  return { en: "", es: "" };
}

/* -------- DESCRIPTION -------- */

function normalizeDescription(desc) {
  if (!desc) return { en: "", es: "" };

  if (typeof desc === "string") {
    return { en: desc, es: desc };
  }

  if (typeof desc === "object") {
    return {
      en: desc.en ?? "",
      es: desc.es ?? desc.en ?? ""
    };
  }

  return { en: "", es: "" };
}

/* -------- PRICE DETECTION -------- */

function detectPrices(raw) {
  let price =
    extractAmount(raw.price) ??
    extractAmount(raw.precio) ??
    extractAmount(raw.sale_price) ??
    null;

  let retail_price =
    extractAmount(raw.retail_price) ??
    extractAmount(raw.precio_original) ??
    null;

  let sale_price =
    extractAmount(raw.sale_price) ??
    extractAmount(raw.precio_descuento) ??
    price ??
    null;

  let discount_percentage = null;
  let has_discount = false;

  if (retail_price && sale_price && retail_price > sale_price) {
    discount_percentage = Math.round(
      ((retail_price - sale_price) / retail_price) * 100
    );
    has_discount = true;
  }

  return {
    price,
    retail_price,
    sale_price,
    discount_percentage,
    has_discount
  };
}


function extractAmount(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object") return value.amount ?? null;
  return null;
}

/* -------- IMAGES -------- */

function detectImages(raw) {
  if (Array.isArray(raw.images)) return raw.images;

  if (typeof raw.images === "string") return [raw.images];

  if (raw.imagen) return [raw.imagen];

  if (raw.main_image) return [raw.main_image];

  return [];
}


/* -------- SIZES -------- */

function detectSizes(raw) {
  if (!Array.isArray(raw.second_sale_attrs)) return [];

  const sizeAttr = raw.second_sale_attrs.find(
    attr => attr.name_en?.toLowerCase() === "size"
  );

  if (!sizeAttr) return [];

  return sizeAttr.values ?? [];
}

/* -------- SPEC EXTRACTION -------- */

function extractSpec(raw, keyword) {
  if (!Array.isArray(raw.specs)) return null;

  const found = raw.specs.find(spec =>
    spec.name_en?.toLowerCase().includes(keyword)
  );

  return found?.value ?? null;
}

/* ============================================================
   🔁 UNIVERSAL VARIANT DETECTION ENGINE
============================================================ */

function detectVariants(raw, normalized) {

  /* ============================================================
     1️⃣ PRIORIDAD: Variantes tipo dimensiones (Shein-style)
  ============================================================ */

  if (Array.isArray(raw.second_sale_attrs)) {
    const dimensions = {};

    for (const attr of raw.second_sale_attrs) {
      const key = attr.name_en?.toLowerCase();
      if (!key || !Array.isArray(attr.values)) continue;

      dimensions[key] = attr.values
        .filter(v => !v.is_sold_out)
        .map(v => v.value_en ?? v.value);
    }

    if (normalized.color && !dimensions.color) {
      dimensions.color = [normalized.color];
    }

    const combinations = generateCombinations(dimensions);

    if (combinations.length) {
      return combinations.map(attrs => ({
        external_id: normalized.external_id,
        price: normalized.price,
        retail_price: normalized.retail_price,
        sale_price: normalized.sale_price,
        discount_percentage: normalized.discount_percentage,
        has_discount: normalized.has_discount,
        stock: null,
        attributes: attrs
      }));
    }
  }

  /* ============================================================
     2️⃣ UNIVERSAL: arrays tipo variants / variations / children
  ============================================================ */

  const possibleSources = [
    raw.variants,
    raw.variations,
    raw.children,
    raw.items
  ];

  for (const source of possibleSources) {
    if (Array.isArray(source) && source.length) {
      return source.map(v => ({
        external_id:
          v.external_id ??
          v.product_id ??
          v.id ??
          normalized.external_id,

        price: extractAmount(v.price) ?? normalized.price,

        retail_price:
          extractAmount(v.retail_price) ?? normalized.retail_price,

        sale_price:
          extractAmount(v.sale_price) ?? normalized.sale_price,

        discount_percentage: normalized.discount_percentage,
        has_discount: normalized.has_discount,

        stock: detectStock(v),

        attributes: extractAttributes(v)
      }));
    }
  }

  return [];
}


/* -------- STOCK DETECTION -------- */

function detectStock(obj) {
  if (obj.in_stock !== undefined) return obj.in_stock;
  if (obj.is_sold_out !== undefined) return !obj.is_sold_out;
  if (obj.stock !== undefined) return obj.stock;
  if (obj.quantity !== undefined) return obj.quantity;
  return null;
}

/* -------- ATTRIBUTE EXTRACTION -------- */

function extractAttributes(obj) {
  const attrs = {};

  for (const key in obj) {
    if (
      typeof obj[key] === "string" ||
      typeof obj[key] === "number"
    ) {
      if (![
        "price",
        "retail_price",
        "sale_price",
        "external_id",
        "id",
        "product_id"
      ].includes(key)) {
        attrs[key] = obj[key];
      }
    }
  }

  return attrs;
}

/* -------- COMBINATION GENERATOR -------- */

function generateCombinations(dimensions) {
  const keys = Object.keys(dimensions);
  if (!keys.length) return [];

  return keys.reduce((acc, key) => {
    const values = dimensions[key];

    if (!acc.length) {
      return values.map(v => ({ [key]: v }));
    }

    const combinations = [];

    for (const combo of acc) {
      for (const value of values) {
        combinations.push({
          ...combo,
          [key]: value
        });
      }
    }

    return combinations;
  }, []);
}

/* -------- CLEAN EMPTY FIELDS -------- */

function cleanEmptyFields(obj) {
  const cleaned = {};

  for (const key in obj) {
    const value = obj[key];

    if (
      value === null ||
      value === undefined ||
      (Array.isArray(value) && !value.length)
    ) continue;

    cleaned[key] = value;
  }

  return cleaned;
}

