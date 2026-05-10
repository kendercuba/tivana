// frontend/src/hooks/admin/import/useTaxonomyCreation.js

export default function useTaxonomyCreation() {
  const createTaxonomyItem = async ({ level, name, parentId }) => {
    const urlMap = {
      category: "/admin/categories",
      subcategory: "/admin/subcategories",
      subsubcategory: "/admin/subsubcategories"
    };

    const bodyMap = {
      category: { name },
      subcategory: { name, category_id: parentId },
      subsubcategory: { name, subcategory_id: parentId }
    };

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}${urlMap[level]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyMap[level])
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error creando ${level}: ${text}`);
    }

    const data = await res.json();

    // 🔒 CONTRATO ESTRICTO
    if (!data || typeof data.id !== "number") {
      console.error("❌ Backend no devolvió item válido:", data);
      throw new Error("Backend no devolvió un item válido");
    }

    // ✅ SOLO devolver lo creado
    return data;
  };

  return {
    createTaxonomyItem
  };
}
