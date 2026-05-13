import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReportingGapsSnapshot } from "../../../api/admin/finance/reportingGapsApi.js";
import {
  caracasYesterdayYmd,
  countMissingCalendarDaysToTarget,
} from "../../../utils/reportingGapDates.js";

export function useReportingGaps({ pollMs = 300000 } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchReportingGapsSnapshot();
      setSnapshot(data);
    } catch (e) {
      setError(e?.message || "Error cargando avisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const derived = useMemo(() => {
    const yesterdayYmd = caracasYesterdayYmd();
    if (!snapshot) {
      return {
        yesterdayYmd,
        loyverseResumenMissing: null,
        loyversePagoMissing: null,
        bankAccountsWithGaps: [],
        bankMenuMaxMissing: 0,
        bellAlertCount: 0,
      };
    }

    const loyverseResumenMissing = countMissingCalendarDaysToTarget(
      snapshot.loyverseDailySummaryMaxBusinessDate,
      yesterdayYmd
    );
    const loyversePagoMissing = countMissingCalendarDaysToTarget(
      snapshot.loyversePaymentBreakdownMaxBusinessDate,
      yesterdayYmd
    );

    const bankAccountsWithGaps = (snapshot.bankAccounts || []).map((a) => ({
      ...a,
      missingDays: countMissingCalendarDaysToTarget(
        a.maxMovementDate,
        yesterdayYmd
      ),
    }));

    const bankNumeric = bankAccountsWithGaps
      .map((a) => a.missingDays)
      .filter((n) => typeof n === "number" && n > 0);
    const bankMenuMaxMissing = bankNumeric.length ? Math.max(...bankNumeric) : 0;

    let bellAlertCount = 0;
    if (loyverseResumenMissing != null && loyverseResumenMissing > 0) {
      bellAlertCount += 1;
    }
    if (loyversePagoMissing != null && loyversePagoMissing > 0) {
      bellAlertCount += 1;
    }
    if (bankMenuMaxMissing > 0) {
      bellAlertCount += 1;
    }

    return {
      yesterdayYmd,
      loyverseResumenMissing,
      loyversePagoMissing,
      bankAccountsWithGaps,
      bankMenuMaxMissing,
      bellAlertCount,
    };
  }, [snapshot]);

  return {
    snapshot,
    loading,
    error,
    refresh,
    ...derived,
  };
}
