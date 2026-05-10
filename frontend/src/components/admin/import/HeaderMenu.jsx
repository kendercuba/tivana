import { useState, useRef, useEffect } from "react";

export default function HeaderMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="px-1 text-gray-500 hover:text-black"
        onClick={() => setOpen(o => !o)}
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border rounded shadow-md z-50">
          {items.map((item, i) => (
            <button
              key={item.key ?? i} // ✅ FIX warning key
              type="button"
              disabled={item.disabled}
              onClick={async () => {
                setOpen(false);        // ✅ cerrar menú primero
                await item.onClick?.(); // ✅ soporta async
              }}
              className={`w-full text-left px-3 py-2 text-sm transition
                ${
                  item.disabled
                    ? "text-gray-400 opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-100 text-gray-700"
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
