import { useEffect, useRef, useState } from "react";

const imagenes = [
  "carrusel1.png",
  "prueba2.png",
  "prueba3.png",
  "prueba4.png",
];

const imagenesConCopia = [...imagenes, imagenes[0]];

export default function Carrusel() {
  const slideRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const total = imagenesConCopia.length;

  const goToSlide = (i) => {
    if (slideRef.current) {
      slideRef.current.style.transition = "transform 0.5s ease-in-out";
      slideRef.current.style.transform = `translateX(-${i * 100}%)`;
    }
  };

  const resetToStart = () => {
    if (slideRef.current) {
      slideRef.current.style.transition = "none";
      slideRef.current.style.transform = "translateX(0%)";
      setIndex(0);
    }
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    goToSlide(nextIndex);

    if (nextIndex === total - 1) {
      setTimeout(() => resetToStart(), 510);
    }
  };

  const handlePrev = () => {
    if (index === 0) {
      if (slideRef.current) {
        slideRef.current.style.transition = "none";
        slideRef.current.style.transform = `translateX(-${(total - 1) * 100}%)`;
      }

      setTimeout(() => {
        const newIndex = total - 2;
        setIndex(newIndex);
        goToSlide(newIndex);
      }, 20);
    } else {
      const prevIndex = index - 1;
      setIndex(prevIndex);
      goToSlide(prevIndex);
    }
  };

  // Autoplay
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      handleNext();
    }, 4000); // cada 4 segundos

    return () => clearInterval(interval);
  }, [index, isHovered]);

  // Mostrar el primer slide al montar
  useEffect(() => {
    goToSlide(index);
  }, []);

  return (
        <div
  className="relative w-full aspect-[3/1] overflow-hidden bg-gray-100  mx-auto"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>

      <div
        ref={slideRef}
        className="flex transition-all duration-500 ease-in-out h-full w-full"
      >
        {imagenesConCopia.map((img, i) => (
          <img
            key={i}
            src={`/images/carousel/${img}`}
            alt={`Imagen ${i + 1}`}
            className="w-full h-full object-cover flex-shrink-0"

          />
        ))}
      </div>

      <button
        onClick={handlePrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white text-black rounded-full p-2 shadow-md z-10"
      >
        &#10094;
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-black rounded-full p-2 shadow-md z-10"
      >
        &#10095;
      </button>
    </div>    
  );
}
