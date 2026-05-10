import { Outlet } from "react-router-dom";

export default function ZonaMarketLayout() {
  return (
    <div className="font-zm min-h-screen min-w-0 bg-gradient-to-b from-[#FDC639]/35 via-[#fafcf7] to-white text-[#1a2e12] antialiased">
      <Outlet />
    </div>
  );
}
