// src/pages/Home.jsx
import Carousel from "../components/home/CarouselHero";
import FloatingCards from "../components/home/FloatingCards";
import ProductCarousel from "../components/shared/ProductCarousel";
import CategoryIcons from "../components/home/CategoryIcons";

export default function Home() {
  return (
    <div className="w-full">
      {/* 🟢 Carrusel principal */}
      <div className="border-4 border-green-500 mb-[-3rem] z-0 relative overflow-hidden">
        <Carousel />
      </div>

      {/* 🟡 FloatingCards superpuestas */}
      <div className="hidden md:block md:mt-[-10rem] border-4 border-yellow-500 z-10 relative">
        <FloatingCards />
      </div>

      {/* 🟣 Categorías circulares */}
      <div className="mt-10">
        <CategoryIcons />
      </div>

      {/* 🟣 Carruseles horizontales de productos */}
      <div className="mt-10 space-y-12">
        <ProductCarousel title="Populares en Amazon" origin="Amazon" />        
      </div>
    </div>
  );
}

