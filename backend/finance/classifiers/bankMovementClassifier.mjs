/**
 * Reglas desde BD (orden sort_order). Si coincide, se usa antes que las heurísticas.
 * @param {object[]} rules filas con transaction_code, match_*, category_name, subcategory, movement_type
 */
export function matchMovementAgainstRules(movement, rules) {
  if (!rules?.length) return null;

  const code = String(movement.transaction_code || "").trim();
  const tt = normalizeText(movement.transaction_type);
  const ot = normalizeText(movement.operation_type);

  for (const r of rules) {
    const rc = String(r.transaction_code || "").trim();
    if (rc !== code) continue;

    const mtt = String(r.match_transaction_type ?? "").trim();
    if (mtt && !tt.includes(normalizeText(mtt))) continue;

    const mot = String(r.match_operation_type ?? "").trim();
    if (mot && !ot.includes(normalizeText(mot))) continue;

    return {
      category: r.category_name,
      subcategory: r.subcategory || "—",
      movement_type: r.movement_type,
    };
  }

  return null;
}

export function classifyBankMovement(movement, rules = null) {
  const byRules = matchMovementAgainstRules(movement, rules);
  if (byRules) return byRules;
  return classifyBankMovementHeuristic(movement);
}

function classifyBankMovementHeuristic(movement) {
  const code = String(movement.transaction_code || "").trim();
  const transactionType = normalizeText(movement.transaction_type);
  const operationType = normalizeText(movement.operation_type);
  const description = normalizeText(movement.description);

  const debit = Number(movement.debit_bs || 0);
  const credit = Number(movement.credit_bs || 0);

  // 388 = Abono Pago Móvil BNC
  if (code === "388" || operationType.includes("abono pago movil")) {
    return {
      category: "Venta",
      subcategory: "Pago móvil",
      movement_type: "income",
    };
  }

  // 488 = Crédito inmediato recibido
  if (code === "488" || operationType.includes("credito inmediato recibido")) {
    return {
      category: "Venta",
      subcategory: "Crédito inmediato recibido",
      movement_type: "income",
    };
  }

  // 387 = Cargo Pago Móvil BNC
  if (code === "387" || operationType.includes("cargo pago movil")) {
    return classifyOutgoingPurchase(description);
  }

  // 751 = Comisión Pago Móvil
  if (
    code === "751" ||
    operationType.includes("comision pago movil") ||
    description.includes("comision")
  ) {
    return {
      category: "Comisión bancaria",
      subcategory: "Comisión pago móvil",
      movement_type: "expense",
    };
  }

  // 262 = Transferencias entre cuentas
  if (
    code === "262" ||
    operationType.includes("tranf entre ctas") ||
    operationType.includes("transferencia")
  ) {
    if (transactionType.includes("abono") || credit > 0) {
      return {
        category: "Transferencia interna",
        subcategory: "Transferencia recibida",
        movement_type: "transfer",
      };
    }

    if (transactionType.includes("cargo") || debit > 0) {
      return classifyOutgoingTransfer(description);
    }

    return {
      category: "Transferencia interna",
      subcategory: "Movimiento entre cuentas",
      movement_type: "transfer",
    };
  }

  // 377 = Compra de POS DebitMC
  if (
    code === "377" ||
    operationType.includes("compra de pos") ||
    operationType.includes("debitmc")
  ) {
    return classifyOutgoingPurchase(description);
  }

  // 642 = Movistar / servicios
  if (code === "642" || description.includes("movistar")) {
    return {
      category: "Gasto operativo",
      subcategory: "Servicios",
      movement_type: "expense",
    };
  }

  // Fallback por monto
  if (credit > 0 && debit === 0) {
    return {
      category: "Ingreso por revisar",
      subcategory: "Entrada no clasificada",
      movement_type: "income",
    };
  }

  if (debit > 0 && credit === 0) {
    return {
      category: "Egreso por revisar",
      subcategory: "Salida no clasificada",
      movement_type: "expense",
    };
  }

  return {
    category: "Sin clasificar",
    subcategory: "Pendiente revisión",
    movement_type: "unknown",
  };
}

function classifyOutgoingPurchase(description) {
  if (
    description.includes("pan") ||
    description.includes("queso") ||
    description.includes("charcuteria") ||
    description.includes("carcuteria") ||
    description.includes("cigarro") ||
    description.includes("viveres") ||
    description.includes("platano") ||
    description.includes("tostones") ||
    description.includes("comercial") ||
    description.includes("super tienda") ||
    description.includes("farmacia")
  ) {
    return {
      category: "Compra inventario",
      subcategory: "Reposición",
      movement_type: "expense",
    };
  }

  if (description.includes("movistar") || description.includes("internet")) {
    return {
      category: "Gasto operativo",
      subcategory: "Servicios",
      movement_type: "expense",
    };
  }

  return {
    category: "Egreso por revisar",
    subcategory: "Pago enviado",
    movement_type: "expense",
  };
}

function classifyOutgoingTransfer(description) {
  if (
    description.includes("pago de la semana") ||
    description.includes("ghisendy") ||
    description.includes("karine")
  ) {
    return {
      category: "Nómina",
      subcategory: "Pago empleado",
      movement_type: "expense",
    };
  }

  if (
    description.includes("compra") ||
    description.includes("compras") ||
    description.includes("variada") ||
    description.includes("mercancia") ||
    description.includes("mercancía")
  ) {
    return {
      category: "Compra inventario",
      subcategory: "Reposición",
      movement_type: "expense",
    };
  }

  return {
    category: "Transferencia enviada por revisar",
    subcategory: "Salida pendiente",
    movement_type: "expense",
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}