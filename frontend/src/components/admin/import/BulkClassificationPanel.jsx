import { useState } from "react";

export default function BulkClassificationPanel({
  taxonomy,
  action,          // { level, target }
  onChangeValue    // 👈 NUEVO
}) {
  const [value, setValue] = useState("");

  const handleChange = (e) => {
    const v = Number(e.target.value);
    setValue(v);
    onChangeValue(v);   // 👈 SOLO actualiza drafts
  };

  return (
    <div className="mt-2 px-2">
      {/* TEXTO DENTRO DEL SELECT */}
      {action.level === "category" && (
        <select
          className="w-full border rounded text-xs px-2 py-1"
          value={value}
          onChange={handleChange}
        >
          <option value="">
            Aplicar categoría a seleccionados
          </option>
          {taxonomy.categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {action.level === "subcategory" && (
        <select
          className="w-full border rounded text-xs px-2 py-1"
          value={value}
          onChange={handleChange}
        >
          <option value="">
            Aplicar subcategoría a seleccionados
          </option>
          {taxonomy.subcategories.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {action.level === "subsubcategory" && (
        <select
          className="w-full border rounded text-xs px-2 py-1"
          value={value}
          onChange={handleChange}
        >
          <option value="">
            Aplicar sub-subcategoría a seleccionados
          </option>
          {taxonomy.subsubcategories.map(ss => (
            <option key={ss.id} value={ss.id}>
              {ss.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
