import { pool } from "../../db.mjs";

/**
 * Normaliza a exactamente 4 dígitos (toma los últimos 4 si hay más números).
 */
export function normalizeBncLastFourInput(value) {
  if (value === undefined || value === null) return null;
  const d = String(value).replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.slice(-4);
}

/**
 * El nombre de la cuenta es texto libre (p. ej. "PUNTO DE VENTA ***3923").
 * Sirve para no confundir al usuario cuando ya coinciden nombre y Excel pero falta la columna `bnc_last_four`.
 */
export function bankAccountNameMatchesLastFour(name, four) {
  if (!name || !four || four.length !== 4) return false;
  const n = String(name);
  if (n.includes(`***${four}`)) return true;
  return new RegExp(`\\*{3}\\s*${four}\\b`).test(n);
}

/**
 * Si el Excel trae ***XXXX: (1) cuenta con bnc_last_four = XXXX; (2) si no, una sola
 * cuenta activa cuyo nombre contenga ***XXXX; (3) si no hay coincidencia, el selector.
 * Si no hay ***XXXX en el archivo, devuelve userSelectedId.
 */
export async function resolveBankAccountForBncImport(userSelectedId, extractedFour) {
  let userId;
  const parsed = Number(userSelectedId);
  if (
    userSelectedId != null &&
    userSelectedId !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0
  ) {
    userId = parsed;
  } else {
    const { rows } = await pool.query(
      `
      SELECT id FROM finance_bank_accounts
      WHERE is_active = true
      ORDER BY id ASC
      LIMIT 1
      `
    );
    if (rows.length === 0) {
      throw new Error(
        "No hay cuentas bancarias activas. Crea una en «Cuentas bancarias»."
      );
    }
    userId = rows[0].id;
  }

  if (!extractedFour || extractedFour.length !== 4) {
    return {
      bankAccountId: userId,
      resolution: {
        fromExcel: false,
        lastFour: null,
        usedBankAccountId: userId,
        userSelectedBankAccountId: userId,
        overridden: false,
        matchedAccountName: null,
      },
    };
  }

  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM finance_bank_accounts
    WHERE is_active = true
      AND bnc_last_four IS NOT NULL
      AND TRIM(bnc_last_four) = $1
    `,
    [extractedFour]
  );

  if (rows.length === 1) {
    const resolvedId = rows[0].id;
    const overridden = resolvedId !== userId;
    return {
      bankAccountId: resolvedId,
      resolution: {
        fromExcel: true,
        lastFour: extractedFour,
        usedBankAccountId: resolvedId,
        userSelectedBankAccountId: userId,
        overridden,
        matchedAccountName: rows[0].name,
      },
    };
  }

  if (rows.length === 0) {
    const { rows: allActive } = await pool.query(
      `
      SELECT id, name, bnc_last_four
      FROM finance_bank_accounts
      WHERE is_active = true
      `
    );

    const nameHits = allActive.filter((r) =>
      bankAccountNameMatchesLastFour(r.name, extractedFour)
    );

    if (nameHits.length > 1) {
      throw new Error(
        `El Excel indica cuenta …${extractedFour}, pero hay más de una cuenta activa cuyo nombre incluye ***${extractedFour}. Deja una sola o usa «Últimos dígitos BNC» sin ambigüedad.`
      );
    }

    if (nameHits.length === 1) {
      const hit = nameHits[0];
      const resolvedId = hit.id;
      const overridden = resolvedId !== userId;
      const storedFour = normalizeBncLastFourInput(hit.bnc_last_four);

      return {
        bankAccountId: resolvedId,
        resolution: {
          fromExcel: true,
          lastFour: extractedFour,
          usedBankAccountId: resolvedId,
          userSelectedBankAccountId: userId,
          overridden,
          matchedAccountName: hit.name,
          matchedByAccountName: true,
          excelDigitsUnmatched: false,
          ...(!storedFour
            ? {
                bncFieldUnsetReminder:
                  `El nombre de la cuenta coincide con …${extractedFour}; el campo «Últimos dígitos BNC» sigue vacío. Completa ${extractedFour} ahí para que no dependa solo del texto del nombre.`,
              }
            : {}),
        },
      };
    }

    const sel = await pool.query(
      `
      SELECT id, name, bnc_last_four
      FROM finance_bank_accounts
      WHERE id = $1 AND is_active = true
      `,
      [userId]
    );
    const acc = sel.rows[0];
    const storedFour = acc ? normalizeBncLastFourInput(acc.bnc_last_four) : null;

    // No bloquear la importación: el Excel no coincidió con ninguna cuenta por dígitos ni por nombre.
    return {
      bankAccountId: userId,
      resolution: {
        fromExcel: true,
        lastFour: extractedFour,
        usedBankAccountId: userId,
        userSelectedBankAccountId: userId,
        overridden: false,
        matchedAccountName: null,
        excelDigitsUnmatched: true,
        hint:
          storedFour && storedFour !== extractedFour
            ? `El Excel indica terminación …${extractedFour}, pero la cuenta elegida tiene «Últimos dígitos BNC» = ${storedFour}. Corrige ese campo o elige otra cuenta.`
            : `El Excel indica terminación …${extractedFour}. No hay ninguna cuenta activa que coincida por «Últimos dígitos BNC» ni por ***${extractedFour} en el nombre; se usó la del selector. Crea o renombra la cuenta en «Cuentas bancarias».`,
      },
    };
  }

  throw new Error(
    `Hay más de una cuenta activa con los dígitos ${extractedFour}. Deja solo una con ese valor o corrige los datos.`
  );
}
