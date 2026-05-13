import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const REMOTE_CONFIG_PATH = "/storefront-maintenance.json";

function isStorefrontMaintenanceEnvEnabled() {
  const v = import.meta.env.VITE_PUBLIC_STOREFRONT_MAINTENANCE;
  if (v == null || v === "") return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function isDevMaintenanceQueryEnabled(searchParams) {
  if (!import.meta.env.DEV) return false;
  const raw = searchParams.get("maintenance");
  if (raw == null) return false;
  const s = String(raw).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export default function StorefrontMaintenanceVeil() {
  const [searchParams] = useSearchParams();
  const envMaintenance = isStorefrontMaintenanceEnvEnabled();
  const devQueryMaintenance = isDevMaintenanceQueryEnabled(searchParams);
  const [remoteMaintenance, setRemoteMaintenance] = useState(false);

  useEffect(() => {
    if (envMaintenance || devQueryMaintenance) return;

    const ac = new AbortController();
    fetch(REMOTE_CONFIG_PATH, { cache: "no-store", signal: ac.signal })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setRemoteMaintenance(Boolean(data?.enabled)))
      .catch(() => setRemoteMaintenance(false));

    return () => ac.abort();
  }, [envMaintenance, devQueryMaintenance]);

  const showVeil =
    envMaintenance || devQueryMaintenance || remoteMaintenance;

  if (!showVeil) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-neutral-900/95 px-6 text-center text-white backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storefront-maintenance-title"
    >
      <h1
        id="storefront-maintenance-title"
        className="max-w-md text-xl font-semibold tracking-tight sm:text-2xl"
      >
        Sitio en mantenimiento
      </h1>
      <p className="max-w-md text-sm text-neutral-300 sm:text-base">
        Tivana no está disponible por ahora. Puedes ir a Zona Market desde el
        enlace siguiente.
      </p>
      <Link
        to="/zonamarket"
        className="inline-flex min-h-[44px] min-w-[12rem] items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-lg transition hover:bg-neutral-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
      >
        Ir a Zona Market
      </Link>
    </div>
  );
}
