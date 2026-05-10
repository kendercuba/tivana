// este script es para extraer las palabras mas repetidas en el json para luego usar esas palabras e incrementa los keywords

// y se corre con: node scripts/top_words.mjs

import fs from "fs";

// archivo a leer
const filePath = "./uploads/mapped/shein_hogar_cocina_mapped.json";

// leer json
const raw = fs.readFileSync(filePath, "utf8");
const products = JSON.parse(raw);

// contador de palabras
const wordCount = {};

// palabras que no aportan clasificación
const stopWords = [
  "de","la","el","los","las","para","con","sin","en",
  "y","o","del","al","por","un","una","unos","unas",
  "set","pack","nuevo","multi","color"
];

// limpiar texto
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// recorrer productos
for (const product of products) {

  const title = product?.title?.es;

  if (!title) continue;

  const clean = normalize(title);

  const words = clean.split(" ");

  for (let word of words) {

    if (word.length < 3) continue;
    if (stopWords.includes(word)) continue;

    if (!wordCount[word]) {
      wordCount[word] = 0;
    }

    wordCount[word]++;

  }

}

// ordenar palabras
const sorted = Object.entries(wordCount)
  .sort((a,b) => b[1] - a[1])
  .slice(0,200);

// imprimir
console.log("\nTOP PALABRAS:\n");

sorted.forEach(([word,count])=>{
  console.log(`${word} : ${count}`);
});

console.log("\nTotal palabras únicas:", Object.keys(wordCount).length);