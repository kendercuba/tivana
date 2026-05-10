/* ================================================
   Helpers para mostrar nombres en formato (ID XX) Nombre
================================================= */

const getCategoryName = (id) => {
  const c = taxonomy.categories.find(x => x.id === id);
  return c ? `(ID ${c.id}) ${c.name}` : "—";
};

const getSubcategoryName = (id) => {
  const s = taxonomy.subcategories.find(x => x.id === id);
  return s ? `(ID ${s.id}) ${s.name}` : "—";
};

const getSubsubName = (id) => {
  const ss = taxonomy.subsubcategories.find(x => x.id === id);
  return ss ? `(ID ${ss.id}) ${ss.name}` : "—";
};


// 🔑 ID consistente para productos (mapped / normalizados)
const getProductKey = (p) => String(p.product_id || p.id);


/* ================================================
   📊 CONTADORES REALES PARA FILTROS DE TABLA
================================================= */
const categoryCounts = {};
const subcategoryCounts = {};
const subsubcategoryCounts = {};

for (const p of products) {
  if (p.category_id) {
    categoryCounts[p.category_id] =
      (categoryCounts[p.category_id] || 0) + 1;
  }

  if (p.subcategory_id) {
    subcategoryCounts[p.subcategory_id] =
      (subcategoryCounts[p.subcategory_id] || 0) + 1;
  }

  if (p.subsubcategory_id) {
    subsubcategoryCounts[p.subsubcategory_id] =
      (subsubcategoryCounts[p.subsubcategory_id] || 0) + 1;
  }
}
