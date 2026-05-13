import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-day-picker/style.css";

/** Local calendar date → YYYY-MM-DD (no UTC shift). */
function localDateToYmd(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToLocalDate(ymd) {
  if (!ymd || typeof ymd !== "string") return undefined;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

/** Align any Date to local noon (matches DayPicker noon math, avoids preset drift). */
function atNoonLocal(d) {
  if (!d || Number.isNaN(d.getTime())) return undefined;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function localTodayDate() {
  return atNoonLocal(new Date());
}

/**
 * Loyverse-style range popover: calendar + presets + Hecho / Cancelar.
 * Values are YYYY-MM-DD strings (local).
 */
export default function LoyversePorPagoDateRange({
  rangeStart,
  rangeEnd,
  onApplyRange,
  dataMinYmd,
  dataMaxYmd,
  /** When set, opening the popover shows this month first (e.g. last day with data). */
  calendarMonthAnchorYmd,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(undefined);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});

  const fromD = ymdToLocalDate(rangeStart);
  const toD = ymdToLocalDate(rangeEnd);

  function updatePopoverPosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 8;
    const maxPanel = Math.min(36 * 16, vw - margin * 2);
    const width = Math.min(maxPanel, vw - margin * 2);
    let left = rect.left;
    if (left + width > vw - margin) {
      left = Math.max(margin, vw - margin - width);
    }
    const top = rect.bottom + margin;
    setPopoverStyle({
      position: "fixed",
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(width)}px`,
      maxWidth: `${Math.round(width)}px`,
      zIndex: 100,
    });
  }

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePopoverPosition();
    const onScrollOrResize = () => updatePopoverPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    function handleMouseDown(e) {
      const t = e.target;
      if (
        rootRef.current?.contains(t) ||
        portalRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Only re-sync when the popover opens or the applied range strings change — not
  // on every render (Date objects from ymdToLocalDate are new references each time).
  useEffect(() => {
    if (!open) return;
    const from = rangeStart ? ymdToLocalDate(rangeStart) : undefined;
    const to = rangeEnd ? ymdToLocalDate(rangeEnd) : undefined;
    if (from) {
      setDraft({ from, to: to ?? from });
      const anchorRaw = calendarMonthAnchorYmd?.slice(0, 10);
      const anchorDate = anchorRaw ? ymdToLocalDate(anchorRaw) : undefined;
      setVisibleMonth(
        anchorDate && !Number.isNaN(anchorDate.getTime()) ? anchorDate : from
      );
    } else {
      setDraft(undefined);
      setVisibleMonth(new Date());
    }
  }, [open, rangeStart, rangeEnd, calendarMonthAnchorYmd]);

  function triggerLabel() {
    if (!rangeStart || !rangeEnd) return "Elegir fechas";
    const a = ymdToLocalDate(rangeStart);
    const b = ymdToLocalDate(rangeEnd);
    if (!a || !b) return "Elegir fechas";
    return `${format(a, "dd/MM/yyyy", { locale: es })} — ${format(b, "dd/MM/yyyy", { locale: es })}`;
  }

  function applyDraftAndClose() {
    if (!draft?.from) {
      setOpen(false);
      return;
    }
    let f = draft.from;
    let t = draft.to ?? draft.from;
    if (f > t) [f, t] = [t, f];
    onApplyRange?.(localDateToYmd(f), localDateToYmd(t));
    setOpen(false);
  }

  function cancelAndClose() {
    if (fromD) {
      setDraft({ from: fromD, to: toD ?? fromD });
      setVisibleMonth(fromD);
    } else {
      setDraft(undefined);
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") {
        const f = rangeStart ? ymdToLocalDate(rangeStart) : undefined;
        const t = rangeEnd ? ymdToLocalDate(rangeEnd) : undefined;
        if (f) {
          setDraft({ from: f, to: t ?? f });
          setVisibleMonth(f);
        } else {
          setDraft(undefined);
        }
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, rangeStart, rangeEnd]);

  /**
   * Calendar clicks (custom rhythm):
   * 1st click / 3rd / 5th… → only start date (end open).
   * 2nd / 4th / 6th… → close range from start to clicked day (order by calendar).
   * Presets still set both ends at once.
   */
  function handleCalendarSelect(_selectedFromLib, triggerDate) {
    if (!triggerDate) return;
    const d = atNoonLocal(triggerDate);
    if (!d) return;
    setDraft((prev) => {
      const hasFrom = prev?.from != null;
      const hasTo = prev?.to != null;
      if (!hasFrom || (hasFrom && hasTo)) {
        return { from: d, to: undefined };
      }
      const f = atNoonLocal(prev.from);
      const start = f.getTime() <= d.getTime() ? f : d;
      const end = f.getTime() <= d.getTime() ? d : f;
      return { from: start, to: end };
    });
    setVisibleMonth(d);
  }

  /** Presets apply immediately (no need to press Hecho). */
  function applyPresetRange(getRange) {
    const today = localTodayDate();
    let { from, to } = getRange(today);
    from = atNoonLocal(from);
    to = atNoonLocal(to ?? from);
    if (!from) return;
    if (to && from > to) {
      [from, to] = [to, from];
    }
    const t = to ?? from;
    onApplyRange?.(localDateToYmd(from), localDateToYmd(t));
    setDraft({ from, to: t });
    setVisibleMonth(calendarMonthAnchorYmd ? t : from);
    setOpen(false);
  }

  function applyAllHistoryPreset() {
    const a = ymdToLocalDate(dataMinYmd);
    const b = ymdToLocalDate(dataMaxYmd);
    if (!a || !b) return;
    const from = atNoonLocal(a);
    const to = atNoonLocal(b);
    const lo = from.getTime() <= to.getTime() ? from : to;
    const hi = from.getTime() <= to.getTime() ? to : from;
    onApplyRange?.(localDateToYmd(lo), localDateToYmd(hi));
    setDraft({ from: lo, to: hi });
    setVisibleMonth(calendarMonthAnchorYmd ? hi : lo);
    setOpen(false);
  }

  const hasBounds = Boolean(dataMinYmd && dataMaxYmd);

  const presets = [
    {
      key: "today",
      label: "Hoy",
      fn: (t) => ({ from: t, to: t }),
    },
    {
      key: "yesterday",
      label: "Ayer",
      fn: (t) => {
        const y = subDays(t, 1);
        return { from: y, to: y };
      },
    },
    {
      key: "tomorrow",
      label: "Mañana",
      fn: (t) => {
        const m = addDays(t, 1);
        return { from: m, to: m };
      },
    },
    {
      key: "thisWeek",
      label: "Esta semana",
      fn: (t) => ({
        from: startOfWeek(t, { weekStartsOn: 1 }),
        to: endOfWeek(t, { weekStartsOn: 1 }),
      }),
    },
    {
      key: "lastWeek",
      label: "Última semana",
      fn: (t) => {
        const prev = subWeeks(t, 1);
        return {
          from: startOfWeek(prev, { weekStartsOn: 1 }),
          to: endOfWeek(prev, { weekStartsOn: 1 }),
        };
      },
    },
    {
      key: "thisMonth",
      label: "Este mes",
      fn: (t) => ({
        from: startOfMonth(t),
        to: endOfMonth(t),
      }),
    },
    {
      key: "lastMonth",
      label: "Último mes",
      fn: (t) => {
        const ref = subMonths(t, 1);
        return {
          from: startOfMonth(ref),
          to: endOfMonth(ref),
        };
      },
    },
    {
      key: "last7",
      label: "Últimos 7 días",
      fn: (t) => ({
        from: subDays(t, 6),
        to: t,
      }),
    },
    {
      key: "last30",
      label: "Últimos 30 días",
      fn: (t) => ({
        from: subDays(t, 29),
        to: t,
      }),
    },
  ];

  const draftFrom = draft?.from;
  const draftEndDisplay =
    draft?.from && draft.to === undefined
      ? "—"
      : draft?.to
        ? format(draft.to, "dd/MM/yyyy", { locale: es })
        : "—";

  const popoverEl =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={portalRef}
        style={popoverStyle}
        className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10"
        role="dialog"
        aria-label="Seleccionar rango de fechas"
      >
        <div className="flex max-h-[min(85vh,520px)] flex-col md:flex-row md:max-h-[min(85vh,440px)]">
          <div className="min-w-0 flex-1 overflow-y-auto border-b border-gray-100 p-3 md:border-b-0 md:border-r md:p-4">
            <div className="loyverse-rdp-override [&_.rdp-root]:m-0 [&_.rdp-months]:flex-wrap">
              <DayPicker
                mode="range"
                selected={draft}
                onSelect={handleCalendarSelect}
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                locale={es}
                weekStartsOn={1}
                numberOfMonths={1}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs">
              <div>
                <p className="mb-0.5 font-medium text-gray-500">Fecha de inicio</p>
                <p className="tabular-nums text-gray-900">
                  {draftFrom
                    ? format(draftFrom, "dd/MM/yyyy", { locale: es })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="mb-0.5 font-medium text-gray-500">
                  Fecha de finalización
                </p>
                <p className="tabular-nums text-gray-900">
                  {draftEndDisplay}
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col md:w-44">
            <div className="max-h-48 overflow-y-auto px-2 py-2 md:max-h-none md:flex-1 md:overflow-y-auto md:py-3">
              <nav className="flex flex-col gap-0.5" aria-label="Atajos de fecha">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPresetRange(p.fn)}
                    className="rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition hover:bg-zm-green/10 hover:text-zm-sidebar"
                  >
                    {p.label}
                  </button>
                ))}
                {hasBounds && (
                  <button
                    type="button"
                    onClick={applyAllHistoryPreset}
                    className="rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition hover:bg-zm-green/10 hover:text-zm-sidebar"
                  >
                    Todo el historial
                  </button>
                )}
              </nav>
            </div>

            <div className="mt-auto flex items-center justify-end gap-3 border-t border-gray-100 px-3 py-2.5">
              <button
                type="button"
                onClick={cancelAndClose}
                className="text-xs font-semibold uppercase tracking-wide text-gray-700 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyDraftAndClose}
                className="text-xs font-bold uppercase tracking-wide text-zm-green hover:text-zm-green-dark"
              >
                Hecho
              </button>
            </div>
          </div>
        </div>

        <style>{`
          .loyverse-rdp-override .rdp-root {
            --rdp-accent-color: #4f772d;
            --rdp-accent-background-color: rgba(79, 119, 45, 0.14);
            --rdp-today-color: #3d5f24;
          }
          .loyverse-rdp-override .rdp-month_caption {
            color: #2c4819;
          }
        `}</style>
      </div>,
      document.body
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[min(100%,220px)] max-w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm font-medium text-gray-900 shadow-sm transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-zm-green/40 focus:ring-offset-1"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Rango de fechas"
      >
        <span className="truncate tabular-nums">{triggerLabel()}</span>
        <span className="text-gray-400 shrink-0 text-xs" aria-hidden>
          ▾
        </span>
      </button>

      {popoverEl}
    </div>
  );
}
