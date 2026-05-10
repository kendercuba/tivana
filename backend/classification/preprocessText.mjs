// classification/preprocessText.mjs

import { tokenize } from "./semantic/similarityEngine.mjs";

/**
 * Normaliza y prepara texto para clasificación
 */
export function preprocessText(text) {

  if (!text) return "";

  // tokenizar
  const tokens = tokenize(text);

  // volver a string normalizado
  return tokens.join(" ");

}