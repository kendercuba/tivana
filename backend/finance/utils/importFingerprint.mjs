import crypto from "crypto";

function normalizeDedupText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Huella estable para movimientos BNC: misma fila en Excel solapado = mismo hash.
 */
export function bankMovementFingerprint(bankAccountId, movement) {
  const parts = [
    String(bankAccountId),
    movement.movement_date || "",
    normalizeDedupText(movement.transaction_code),
    normalizeDedupText(movement.reference),
    String(Number(movement.debit_bs || 0)),
    String(Number(movement.credit_bs || 0)),
    normalizeDedupText(movement.description),
    normalizeDedupText(movement.transaction_type),
    normalizeDedupText(movement.operation_type),
  ];

  return crypto.createHash("sha256").update(parts.join("\x1e"), "utf8").digest("hex");
}

export function loyverseRowFingerprint(parts) {
  const payload = parts.map((p) =>
    p === null || p === undefined ? "" : normalizeDedupText(String(p))
  );

  return crypto.createHash("sha256").update(payload.join("\x1e"), "utf8").digest("hex");
}
