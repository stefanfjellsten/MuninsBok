import { api } from "../api";
import { formatAmount, formatDate, amountClassName } from "../utils/formatting";
import { toCsv, downloadCsv, csvAmount } from "../utils/csv";

import { DateFilter } from "../components/DateFilter";
import { ReportPageTemplate } from "../components/ReportPageTemplate";
import { useReportQuery } from "../hooks/useReportQuery";

export function GeneralLedger() {
  const { data, isLoading, error, setDateRange, organization, fiscalYear } = useReportQuery(
    "general-ledger",
    api.getGeneralLedger,
  );

  const report = data?.data;

  return (
    <ReportPageTemplate
      title="Huvudbok"
      isLoading={isLoading}
      error={error}
      isEmpty={!report || report.accounts.length === 0}
      loadingText="Laddar huvudbok..."
      actions={
        report &&
        report.accounts.length > 0 && (
          <>
            <button
              className="secondary"
              onClick={() => {
                const rows: string[][] = [];
                for (const account of report.accounts) {
                  for (const txn of account.transactions) {
                    rows.push([
                      account.accountNumber,
                      account.accountName,
                      formatDate(txn.date),
                      String(txn.voucherNumber),
                      txn.description,
                      csvAmount(txn.debit),
                      csvAmount(txn.credit),
                      csvAmount(txn.balance),
                    ]);
                  }
                }
                const csv = toCsv(
                  [
                    "Konto",
                    "Kontonamn",
                    "Datum",
                    "Ver.nr",
                    "Beskrivning",
                    "Debet",
                    "Kredit",
                    "Saldo",
                  ],
                  rows,
                );
                downloadCsv(csv, "huvudbok.csv");
              }}
            >
              Exportera CSV
            </button>
            <button
              className="secondary"
              onClick={async () => {
                const { exportGeneralLedgerPdf } = await import("../utils/pdf");
                exportGeneralLedgerPdf(
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
      {report?.accounts.map((account) => (
        <div key={account.accountNumber} style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>
            {account.accountNumber} – {account.accountName}
          </h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Ver.nr</th>
                <th scope="col">Beskrivning</th>
                <th scope="col" className="text-right">
                  Debet
                </th>
                <th scope="col" className="text-right">
                  Kredit
                </th>
                <th scope="col" className="text-right">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {account.transactions.map((txn, idx) => (
                <tr key={`${txn.voucherId}-${idx}`}>
                  <td>{formatDate(txn.date)}</td>
                  <td>{txn.voucherNumber}</td>
                  <td>{txn.description}</td>
                  <td className="text-right amount">
                    {txn.debit > 0 ? formatAmount(txn.debit) : ""}
                  </td>
                  <td className="text-right amount">
                    {txn.credit > 0 ? formatAmount(txn.credit) : ""}
                  </td>
                  <td className={amountClassName(txn.balance)}>{formatAmount(txn.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: "bold", borderTop: "2px solid var(--color-border-dark)" }}>
                <td colSpan={3}>Summa</td>
                <td className="text-right amount">{formatAmount(account.totalDebit)}</td>
                <td className="text-right amount">{formatAmount(account.totalCredit)}</td>
                <td className={amountClassName(account.closingBalance)}>
                  {formatAmount(account.closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </ReportPageTemplate>
  );
}
