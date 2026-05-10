export function detectOrigin(products = []) {
  if (!Array.isArray(products) || products.length === 0) {
    return "unknown";
  }

  const sample = products[0];

  // 🔹 SHEIN (estructura compleja con specs y variants)
  if (
    sample.external_id &&
    sample.variants &&
    sample.specs
  ) {
    return "shein";
  }

  // 🔹 AMAZON simple (titulo, precio, imagen, enlace)
  if (
    sample.titulo &&
    sample.precio &&
    sample.imagen &&
    sample.enlace
  ) {
    return "amazon";
  }

  // 🔹 WALMART ejemplo futuro
  if (
    sample.name &&
    sample.price &&
    sample.image
  ) {
    return "walmart";
  }

  return "generic";
}
