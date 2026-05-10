import { preprocessText } from "./preprocessText.mjs";

export function analyzeKeywords(products) {

  const wordCount = {};

  for (const p of products) {

    const title = p.title?.es || p.title || "";
    const description = p.description || "";

    const text = preprocessText(`${title} ${description}`);

    const tokens = text.split(" ");

    const stopWords = new Set([
  "object","ideal","color","doble","unidades",
  "estar","piezas","diseno","shein"
]);

for (const word of tokens) {

  if (word.length < 4) continue;

  if (stopWords.has(word)) continue;

  if (!wordCount[word]) {
    wordCount[word] = 0;
  }

  wordCount[word]++;
}

  }

  const sorted = Object.entries(wordCount)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,30);

  console.log("\n🔎 Palabras más frecuentes en productos no clasificados:\n");

  for (const [word,count] of sorted) {
    console.log(`${word} → ${count}`);
  }

}