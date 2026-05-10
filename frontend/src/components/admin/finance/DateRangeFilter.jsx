import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-day-picker/style.css";


/**
 * Selector de rango en un solo calendario (desde → hasta).
 * value: { from?: Date, to?: Date } | undefined — undefined = sin filtro de fechas.
 */
export default function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [monthCount, setMonthCount] = useState(1);
  const rootRef = useRef(null);

  useEffect(() => {
    function update() {
      setMonthCount(typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    function handleMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function summaryLabel() {
    if (!value?.from) return "Todo el período";
    const from = value.from;
    const to = value.to ?? value.from;
    const a = format(from, "d MMM yyyy", { locale: es });
    const b = format(to, "d MMM yyyy", { locale: es });
    return a === b ? a : `${a} — ${b}`;
  }

  function setPresetDays(days) {
    const end = startOfDay(new Date());
    const start = startOfDay(subDays(end, days));
    onChange?.({ from: start, to: end });
  }

  return (
    <div className="relative min-w-[min(100%,280px)]" ref={rootRef}>
      <span className="block text-sm font-medium text-slate-700 mb-1">
        Período
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="truncate font-medium">{summaryLabel()}</span>
        <span className="text-slate-400 shrink-0" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15"
          role="dialog"
          aria-label="Seleccionar rango de fechas"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPresetDays(7)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => setPresetDays(30)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Últimos 30 días
            </button>
            <button
              type="button"
              onClick={() => {
                onChange?.(undefined);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Todo el período
            </button>
          </div>

          <DayPicker
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange?.(range ?? undefined);
            }}
            locale={es}
            numberOfMonths={monthCount}
          />

          <p className="mt-3 text-[11px] text-slate-500 leading-snug">
            Primer clic: inicio del rango. Segundo clic: fin. También puedes usar
            los accesos rápidos arriba.
          </p>
        </div>
      )}
    </div>
  );
}
