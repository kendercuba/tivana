import { classifyProduct } from "./classification/categoryClassifier.mjs";

const product = {
  title: { es: "Kit con 10 paños de cocina premium coloridos" },
  description: { es: "Material algodón. Paños absorbentes para cocina." },
  images: [
    "https://img.ltwebstatic.com/images3_spmp/2024/12/07/42/17335037847fc9648ffa8f32fab92a5ed0bf37bdd2_thumbnail_900x.webp"
  ]
};

console.log("Probando IA...");
const result = await classifyProduct(product);
console.log("Resultado IA:", result);
