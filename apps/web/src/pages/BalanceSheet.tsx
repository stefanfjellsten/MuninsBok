import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { ReportSectionRows } from "../components/ReportSectionRows";
import { useReportQuery } from "../hooks/useReportQuery";

export function BalanceSheet() {
  const { data, isLoading, error, setDateRange, organization, fiscalYear } = useReportQuery(
    "balance-sheet",
    api.getBalanceSheet,
  );

  const report = data?.data;

  return (
    <ReportPageTemplate
      title="Balansräkning"
      isLoading={isLoading}
      error={error}
      isEmpty={!report}
      loadingText="Laddar balansräkning..."
      actions={
        report && (
          <>
            <button
              className="secondary"
              onClick={() => {
                const allRows = [
                  ...report.assets.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Tillgång",
                    csvAmount(r.amount),
                  ]),
                  ["", "Summa tillgångar", "", csvAmount(report.totalAssets)],
                  ...report.equity.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Eget kapital",
                    csvAmount(r.amount),
                  ]),
                  ...(report.yearResult !== 0
                    ? [["", "Årets resultat", "Eget kapital", csvAmount(report.yearResult)]]
                    : []),
                  ...report.liabilities.rows.map((r) => [
                    r.accountNumber,
                    r.accountName,
                    "Skuld",
                    csvAmount(r.amount),
                  ]),
                  ["", "Summa EK + skulder", "", csvAmount(report.totalLiabilitiesAndEquity)],
                ];
                const csv = toCsv(["Konto", "Namn", "Kategori", "Saldo"], allRows);
                downloadCsv(csv, "balansrakning.csv");
              }}
            >
              Exportera CSV
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const { exportBalanceSheetPdf } = await import("../utils/pdf");
                exportBalanceSheetPdf(
                  report,
                  organization?.name ?? "",
                  fiscalYear
                    ? formatDate(fiscalYear.startDate) + " – " + formatDate(fiscalYear.endDate)
                    : "",
                );
              }}
            >
              Exportera PDF
            </button>
          </>
        )
      }
      filters={<DateFilter onFilter={setDateRange} />}
    >
      {report && (
        <>
          <div className="flex gap-2" style={{ alignItems: "flex-start" }}>
            {/* Assets (left side) */}
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Tillgångar</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Konto</th>
                    <th scope="col">Namn</th>
                    <th scope="col" className="text-right">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <ReportSectionRows section={report.assets} />
                  <tr
                    style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}
                  >
                    <td colSpan={2}>Summa tillgångar</td>
                    <td className="text-right amount">{formatAmount(report.totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities & Equity (right side) */}
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Eget kapital och skulder</h3>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Konto</th>
                    <th scope="col">Namn</th>
                    <th scope="col" className="text-right">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <ReportSectionRows section={report.equity} />

                  {report.yearResult !== 0 && (
                    <tr>
                      <td style={{ paddingLeft: "1rem" }}></td>
                      <td>Årets resultat</td>
                      <td className={amountClassName(report.yearResult)}>
                        {formatAmount(report.yearResult)}
                      </td>
                    </tr>
                  )}

                  <ReportSectionRows section={report.liabilities} />

                  <tr
                    style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}
                  >
                    <td colSpan={2}>Summa eget kapital och skulder</td>
                    <td className="text-right amount">
                      {formatAmount(report.totalLiabilitiesAndEquity)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {report.difference !== 0 && (
            <div className="error" style={{ marginTop: "1rem" }}>
              Varning: Balansräkningen balanserar inte! Differens: {formatAmount(report.difference)}{" "}
              kr
            </div>
          )}
        </>
      )}
    </ReportPageTemplate>
  );
}
