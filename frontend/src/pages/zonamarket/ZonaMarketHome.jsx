import { Link } from "react-router-dom";

export default function ZonaMarketHome() {
  return (
    <div className="mx-auto flex min-h-[min(100dvh,920px)] max-w-xl flex-col justify-center px-4 py-14 text-center sm:py-20">
      <div className="relative mx-auto mb-8 w-full max-w-[min(100%,440px)] sm:max-w-[480px]">
        <div
          className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-zm-yellow/40 via-white/60 to-zm-green/15 blur-2xl"
          aria-hidden
        />
        <img
          src="/branding/zonamarket-wordmark.svg?v=4"
          alt="Zona Market"
          className="relative z-10 mx-auto block h-auto w-full max-h-[min(28vw,200px)] object-contain object-center drop-shadow-md sm:max-h-[220px]"
          width={480}
          height={116}
          decoding="async"
        />
      </div>

      <h1 className="font-zm mt-2 text-3xl font-bold tracking-tight text-[#1e3612] sm:text-4xl">
        Tu punto de venta
      </h1>
      <p className="mt-4 text-base leading-relaxed text-[#2d4a1f]/95">
        Administración y finanzas en un solo lugar. Más adelante: ventas, inventario
        y compras; por ahora entra al panel para gestionar{" "}
        <strong className="font-semibold text-[#4F772D]">finanzas</strong>.
      </p>

      <div className="mt-10 flex flex-col items-stretch gap-3 sm:mx-auto sm:w-80">
        <Link
          to="/zonamarket/admin"
          className="rounded-2xl bg-[#E63946] px-6 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-[#c92d38]/35 ring-1 ring-black/5 transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F772D] active:brightness-95"
        >
          Ir al administrador
        </Link>
      </div>

      <p className="mt-12 text-xs text-[#4F772D]/70">
        Próximamente: catálogo, carrito y checkout en esta misma zona.
      </p>
    </div>
  );
}
