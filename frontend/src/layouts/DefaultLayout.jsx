// src/layouts/DefaultLayout.jsx
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";

export default function DefaultLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden border-4 border-amber-500"> {/* ✅ Contenedor raíz */}
      
      <Header />

      <main className="flex-grow pt-0 mt-0 border-4 border-red-500 overflow-visible">
        <div className="max-w-full sm:max-w-[1600px] mx-auto border-4 border-blue-500">

          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}
