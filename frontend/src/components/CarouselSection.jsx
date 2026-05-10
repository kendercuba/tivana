// src/components/CarouselSection.jsx
import ProductCardMini from "./ProductCardMini";

export default function CarouselSection({ title, products = [] }) {
  if (!products.length) return null;

  return (
    <section className="my-6 px-4 md:px-8">
      <h2 className="text-base md:text-lg font-semibold mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
        {products.map((product) => (
          <ProductCardMini key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
