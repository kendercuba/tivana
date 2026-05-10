import {
  buildBatchJSONL,
  submitBatch,
  checkBatchStatus,
  downloadBatchResults,
  parseBatchResults
} from "./classification/batchClassifier.mjs";

// 🔥 Productos mínimos para validar batch
const product1 = {
  id: "test_1",
  title: "Organizador de cocina extensible de acero inoxidable",
  description: "Organizador ajustable para cocina, ideal para almacenamiento de ollas y sartenes.",
  images: ["https://example.com/imagen1.jpg"]
};

const product2 = {
  id: "test_2",
  title: "Producto de prueba duplicado",
  description: "Segunda entrada obligatoria para validar un batch.",
  images: ["https://example.com/imagen1.jpg"]
};

async function runTest() {
  try {
    console.log("📄 Generando archivo JSONL...");

    // 1️⃣ Crear archivo JSONL
    const jsonlPath = await buildBatchJSONL([product1, product2]);
    console.log("✔ Archivo JSONL generado:", jsonlPath);

    // 2️⃣ Subir y crear batch
    console.log("📤 Subiendo archivo JSONL a OpenAI...");
    const batch = await submitBatch(jsonlPath);
    console.log("🟢 Batch creado:", batch.id);

    // 3️⃣ Esperar resultado (checkBatchStatus ya hace polling)
    console.log("🔎 Esperando que el batch termine...");
    const finalBatch = await checkBatchStatus(batch.id);
    console.log("🏁 Batch finalizado con estado:", finalBatch.status);

    // 4️⃣ Descargar resultados
    console.log("📥 Descargando resultados del output_file...");
    const outputText = await downloadBatchResults(finalBatch);
    console.log("✔ Resultados descargados.");

    // 5️⃣ Parsear JSONL
    const parsed = parseBatchResults(outputText);
    console.log("🧠 RESULTADO PARSEADO:");
    console.log(JSON.stringify(parsed, null, 2));

    console.log("🎉 TEST COMPLETADO EXITOSAMENTE.");

  } catch (err) {
    console.error("❌ ERROR EN TEST:", err);
  }
}

runTest();
