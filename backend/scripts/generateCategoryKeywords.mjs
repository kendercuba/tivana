import fs from "fs";
import path from "path";

// cambia la ruta si tu archivo está en otro lugar
const filePath = "../clasificaciones_extraidas.json";

const raw = fs.readFileSync(filePath, "utf8");
const products = JSON.parse(raw);

const stopWords = [
  "de","la","el","los","las","para","con","sin","en",
  "y","o","del","al","por","un","una","unos","unas",
  "kit","pieza","piezas","set","pack","nuevo","premium",
  "ideal","uso","gran","alta","super","extra"
];

function normalize(text){
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

const categoryWords = {};

for(const product of products){

  const category = product.categoria;

  if(!category) continue;

  if(!categoryWords[category]){
    categoryWords[category] = {};
  }

  const title = normalize(product.titulo);

  const words = title.split(" ");

  for(const word of words){

    if(word.length < 4) continue;
    if(stopWords.includes(word)) continue;

    if(!categoryWords[category][word]){
      categoryWords[category][word] = 0;
    }

    categoryWords[category][word]++;

  }

}

console.log("\n========= PALABRAS POR CATEGORIA =========\n");

for(const category in categoryWords){

  console.log("\n----------------------------");
  console.log("CATEGORIA:",category);

  const sorted = Object.entries(categoryWords[category])
    .sort((a,b)=>b[1]-a[1])
    .slice(0,25);

  for(const [word,count] of sorted){
    console.log(word,"→",count);
  }

}