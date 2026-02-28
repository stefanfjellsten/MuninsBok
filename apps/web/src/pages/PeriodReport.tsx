import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PeriodReportResponse, PeriodRowResponse, PeriodType } from "../api";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { DateFilter, type DateRange } from "../components/DateFilter";
import { formatAmount, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

// ── Helpers ─────────────────────────────────────────────────

function formatPercent(value: number, total: number): string {
  if (total === 0) return "–";
  return `${((value / total) * 100).toFixed(1)} %`;
}

/** Simple bar width (0–100%) for a value relative to a max. */
function barWidth(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((Math.abs(value) / max) * 100));
}

// ── Component ───────────────────────────────────────────────

export function PeriodReport() {
  const { organization, fiscalYear } = useOrganization();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [periodType, setPeriodType] = useState<PeriodType>("month");

  const { data, isLoading, error } = useQuery({
    queryKey: ["period-report", organization?.id, fiscalYear?.id, dateRange, periodType],
    queryFn: () =>
      api.getPeriodReport(defined(organization).id, defined(fiscalYear).id, dateRange, periodType),
    enabled: !!organization && !!fiscalYear,
  });

  if (isLoading) {
    return <div className="loading">Laddar periodrapport...</div>;
  }

  if (error) {
    return <div className="error">Fel vid hämtning: {(error as Error).message}</div>;
  }

  const report: PeriodReportResponse | undefined = data?.data;

  if (!report || report.periods.length === 0) {
    return (
      <div className="card">
        <h2>Periodrapport</h2>
        <div className="empty">Inga bokförda transaktioner ännu.</div>
      </div>
    );
  }

  // Find the maximum absolute value for bar rendering
  const maxAbs = Math.max(
    ...report.periods.map((p) => Math.max(Math.abs(p.income), Math.abs(p.expenses))),
    1,
  );

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Periodrapport</h2>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {/* Period type toggle */}
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              className={periodType === "month" ? "primary" : "secondary"}
              onClick={() => setPeriodType("month")}
              style={{ borderRadius: "4px 0 0 4px" }}
            >
              Månad
            </button>
            <button
              className={periodType === "quarter" ? "primary" : "secondary"}
              onClick={() => setPeriodType("quarter")}
              style={{ borderRadius: "0 4px 4px 0" }}
            >
              Kvartal
            </button>
          </div>

          <button
            className="secondary"
            onClick={() => {
              const rows = report.periods.map((p) => [
                p.label,
                p.startDate,
                p.endDate,
                csvAmount(p.income),
                csvAmount(p.expenses),
                csvAmount(p.result),
                csvAmount(p.cumulativeResult),
              ]);
              rows.push([
                "Totalt",
                "",
                "",
                csvAmount(report.totalIncome),
                csvAmount(report.totalExpenses),
                csvAmount(report.totalResult),
                "",
              ]);
              const csv = toCsv(
                ["Period", "Från", "Till", "Intäkter", "Kostnader", "Resultat", "Ackumulerat"],
                rows,
              );
              downloadCsv(csv, `periodrapport-${report.periodType}.csv`);
            }}
          >
            Exportera CSV
          </button>

          <button className="secondary" onClick={() => window.print()}>
            Skriv ut
          </button>
        </div>
      </div>

      <DateFilter onFilter={setDateRange} />

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "#f0f9f0", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#555" }}>Totala intäkter</div>
          <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#2e7d32" }}>
            {formatAmount(report.totalIncome)}
          </div>
        </div>
        <div style={{ background: "#fef0f0", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#555" }}>Totala kostnader</div>
          <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#c62828" }}>
            {formatAmount(report.totalExpenses)}
          </div>
        </div>
        <div style={{ background: "#f0f4ff", padding: "1rem", borderRadius: "6px" }}>
          <div style={{ fontSize: "0.85rem", color: "#555" }}>Resultat</div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: "bold",
              color: report.totalResult >= 0 ? "#2e7d32" : "#c62828",
            }}
          >
            {formatAmount(report.totalResult)}
          </div>
        </div>
      </div>

      {/* Period table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Intäkter</th>
              <th className="text-right">Kostnader</th>
              <th className="text-right">Resultat</th>
              <th className="text-right">Ackumulerat</th>
              <th style={{ width: "20%" }}>Fördelning</th>
            </tr>
          </thead>
          <tbody>
            {report.periods.map((p: PeriodRowResponse) => (
              <tr key={p.label}>
                <td>
                  <strong>{p.label}</strong>
                  <br />
                  <span style={{ fontSize: "0.8rem", color: "#888" }}>
                    {p.startDate} – {p.endDate}
                  </span>
                </td>
                <td className={`text-right ${amountClassName(p.income)}`}>
                  {formatAmount(p.income)}
                </td>
                <td className={`text-right ${amountClassName(-p.expenses)}`}>
                  {formatAmount(p.expenses)}
                </td>
                <td className={`text-right ${amountClassName(p.result)}`}>
                  {formatAmount(p.result)}
                </td>
                <td className={`text-right ${amountClassName(p.cumulativeResult)}`}>
                  {formatAmount(p.cumulativeResult)}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                    <div
                      style={{
                        height: "14px",
                        width: `${barWidth(p.income, maxAbs)}%`,
                        background: "#4caf50",
                        borderRadius: "2px",
                        minWidth: p.income !== 0 ? "2px" : "0",
                      }}
                      title={`Intäkter: ${formatAmount(p.income)}`}
                    />
                    <div
                      style={{
                        height: "14px",
                        width: `${barWidth(p.expenses, maxAbs)}%`,
                        background: "#ef5350",
                        borderRadius: "2px",
                        minWidth: p.expenses !== 0 ? "2px" : "0",
                      }}
                      title={`Kostnader: ${formatAmount(p.expenses)}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
              <td>Totalt</td>
              <td className={`text-right ${amountClassName(report.totalIncome)}`}>
                {formatAmount(report.totalIncome)}
              </td>
              <td className={`text-right ${amountClassName(-report.totalExpenses)}`}>
                {formatAmount(report.totalExpenses)}
              </td>
              <td className={`text-right ${amountClassName(report.totalResult)}`}>
                {formatAmount(report.totalResult)}
              </td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Period-over-period change table */}
      {report.periods.length > 1 && (
        <>
          <h3 style={{ marginTop: "2rem" }}>Period-jämförelse (förändring)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">Intäkter Δ</th>
                  <th className="text-right">Kostnader Δ</th>
                  <th className="text-right">Resultat Δ</th>
                  <th className="text-right">Andel av total intäkt</th>
                </tr>
              </thead>
              <tbody>
                {report.periods.map((p: PeriodRowResponse, i: number) => {
                  const prev = i > 0 ? report.periods[i - 1] : undefined;
                  const incDelta = prev ? p.income - prev.income : 0;
                  const expDelta = prev ? p.expenses - prev.expenses : 0;
                  const resDelta = prev ? p.result - prev.result : 0;

                  return (
                    <tr key={p.label}>
                      <td>{p.label}</td>
                      <td className={`text-right ${amountClassName(incDelta)}`}>
                        {i === 0 ? "–" : formatAmount(incDelta)}
                      </td>
                      <td className={`text-right ${amountClassName(-expDelta)}`}>
                        {i === 0 ? "–" : formatAmount(expDelta)}
                      </td>
                      <td className={`text-right ${amountClassName(resDelta)}`}>
                        {i === 0 ? "–" : formatAmount(resDelta)}
                      </td>
                      <td className="text-right">{formatPercent(p.income, report.totalIncome)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "1rem" }}>
        Genererad: {new Date(report.generatedAt).toLocaleString("sv-SE")}
      </p>
    </div>
  );
}
