import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api } from "../api";
import type { FiscalYear, YearEndSummaryResponse } from "../api";
import { formatAmount, amountClassName, formatDate } from "../utils/formatting";
import { Link } from "react-router-dom";

type ReportSection = YearEndSummaryResponse["incomeStatement"]["revenues"];
type BalanceSection = YearEndSummaryResponse["balanceSheet"]["assets"];

function IncomeSection({ section }: { section: ReportSection }) {
  if (section.rows.length === 0) return null;
  return (
    <>
      <tr>
        <td colSpan={3} style={{ fontWeight: "bold", paddingTop: "0.75rem" }}>
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.accountNumber}>
          <td style={{ paddingLeft: "1rem" }}>{row.accountNumber}</td>
          <td>{row.accountName}</td>
          <td className="text-right amount">{formatAmount(row.amount)}</td>
        </tr>
      ))}
      <tr style={{ fontWeight: "bold" }}>
        <td colSpan={2} style={{ paddingLeft: "1rem" }}>
          Summa {section.title.toLowerCase()}
        </td>
        <td className="text-right amount">{formatAmount(section.total)}</td>
      </tr>
    </>
  );
}

function BalanceTable({ title, section }: { title: string; section: BalanceSection }) {
  if (section.rows.length === 0) return null;
  return (
    <>
      <tr>
        <td colSpan={3} style={{ fontWeight: "bold", paddingTop: "0.75rem" }}>
          {title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.accountNumber}>
          <td style={{ paddingLeft: "1rem" }}>{row.accountNumber}</td>
          <td>{row.accountName}</td>
          <td className="text-right amount">{formatAmount(row.amount)}</td>
        </tr>
      ))}
      <tr style={{ fontWeight: "bold" }}>
        <td colSpan={2} style={{ paddingLeft: "1rem" }}>
          Summa {title.toLowerCase()}
        </td>
        <td className="text-right amount">{formatAmount(section.total)}</td>
      </tr>
    </>
  );
}

export function YearEndSummary() {
  const { organization, fiscalYears, fiscalYear: contextFy } = useOrganization();
  const [selectedFyId, setSelectedFyId] = useState<string | null>(null);

  if (!organization) return null;

  const sorted = [...fiscalYears].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  const activeFyId = selectedFyId ?? contextFy?.id ?? sorted[0]?.id;
  const activeFy = sorted.find((fy: FiscalYear) => fy.id === activeFyId);

  // Find potential target FY for disposition preview
  const openFys = sorted.filter((fy) => !fy.isClosed);
  const targetFy = activeFy?.isClosed
    ? openFys.find((fy) => new Date(fy.startDate).getTime() >= new Date(activeFy.endDate).getTime())
    : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["year-end-summary", organization.id, activeFyId, targetFy?.id],
    queryFn: () => api.getYearEndSummary(organization.id, defined(activeFyId), targetFy?.id),
    enabled: !!activeFyId,
  });

  const summary = data?.data;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <h2>Sammanställning – Årsbokslut</h2>
        {summary && (
          <button className="secondary" onClick={() => window.print()}>
            Skriv ut
          </button>
        )}
      </div>

      {/* Fiscal year selector */}
      {sorted.length > 1 && (
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="summary-fy-select" style={{ marginRight: "0.5rem" }}>
            Räkenskapsår:
          </label>
          <select
            id="summary-fy-select"
            value={activeFyId ?? ""}
            onChange={(e) => setSelectedFyId(e.target.value)}
          >
            {sorted.map((fy: FiscalYear) => (
              <option key={fy.id} value={fy.id}>
                {formatDate(fy.startDate)} – {formatDate(fy.endDate)}
                {fy.isClosed ? " (stängt)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeFy && (
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          {formatDate(activeFy.startDate)} – {formatDate(activeFy.endDate)}
          {" · "}
          {activeFy.isClosed ? (
            <span className="badge badge-closed">Stängt</span>
          ) : (
            <span className="badge badge-open">Öppet</span>
          )}
        </p>
      )}

      {isLoading && <p className="loading">Laddar sammanställning…</p>}
      {error && <p className="error">Kunde inte ladda sammanställning</p>}

      {summary && (
        <>
          {/* ── Income Statement ─────────────────────────── */}
          <h3
            style={{
              marginTop: "1.5rem",
              borderBottom: "2px solid var(--border, #e0e0e0)",
              paddingBottom: "0.25rem",
            }}
          >
            Resultaträkning
          </h3>
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Namn</th>
                <th className="text-right">Belopp</th>
              </tr>
            </thead>
            <tbody>
              <IncomeSection section={summary.incomeStatement.revenues} />
              <IncomeSection section={summary.incomeStatement.expenses} />
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={2}>Rörelseresultat</td>
                <td className={amountClassName(summary.incomeStatement.operatingResult)}>
                  {formatAmount(summary.incomeStatement.operatingResult)}
                </td>
              </tr>
              <IncomeSection section={summary.incomeStatement.financialIncome} />
              <IncomeSection section={summary.incomeStatement.financialExpenses} />
              <tr style={{ fontWeight: "bold", borderTop: "3px double #333", fontSize: "1.1em" }}>
                <td colSpan={2}>Årets resultat</td>
                <td className={amountClassName(summary.incomeStatement.netResult)}>
                  {formatAmount(summary.incomeStatement.netResult)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Balance Sheet ────────────────────────────── */}
          <h3
            style={{
              marginTop: "2rem",
              borderBottom: "2px solid var(--border, #e0e0e0)",
              paddingBottom: "0.25rem",
            }}
          >
            Balansräkning
          </h3>
          <table>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Namn</th>
                <th className="text-right">Belopp</th>
              </tr>
            </thead>
            <tbody>
              <BalanceTable title="Tillgångar" section={summary.balanceSheet.assets} />
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={2}>Summa tillgångar</td>
                <td className="text-right amount">
                  {formatAmount(summary.balanceSheet.totalAssets)}
                </td>
              </tr>

              <BalanceTable title="Eget kapital" section={summary.balanceSheet.equity} />
              <BalanceTable title="Skulder" section={summary.balanceSheet.liabilities} />
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td colSpan={2}>Summa eget kapital och skulder</td>
                <td className="text-right amount">
                  {formatAmount(summary.balanceSheet.totalLiabilitiesAndEquity)}
                </td>
              </tr>

              {summary.balanceSheet.difference !== 0 && (
                <tr style={{ color: "#c62828" }}>
                  <td colSpan={2}>Differens</td>
                  <td className="text-right amount">
                    {formatAmount(summary.balanceSheet.difference)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── Disposition Status ───────────────────────── */}
          <h3
            style={{
              marginTop: "2rem",
              borderBottom: "2px solid var(--border, #e0e0e0)",
              paddingBottom: "0.25rem",
            }}
          >
            Resultatdisposition
          </h3>

          {summary.isDisposed && (
            <p style={{ color: "#2e7d32", fontWeight: 600, marginTop: "0.5rem" }}>
              ✓ Resultatet har disponerats
            </p>
          )}

          {!summary.isDisposed && summary.disposition && (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ marginBottom: "0.75rem" }}>
                Årets resultat:{" "}
                <strong className={summary.disposition.netResult >= 0 ? "positive" : "negative"}>
                  {formatAmount(summary.disposition.netResult)}
                </strong>
                {" — ej disponerat"}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Konto</th>
                    <th>Kontonamn</th>
                    <th className="text-right">Debet</th>
                    <th className="text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.disposition.lines.map((line) => (
                    <tr key={line.accountNumber}>
                      <td>{line.accountNumber}</td>
                      <td>{line.accountName}</td>
                      <td className="text-right amount">
                        {line.debit ? formatAmount(line.debit) : ""}
                      </td>
                      <td className="text-right amount">
                        {line.credit ? formatAmount(line.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: "0.75rem" }}>
                <Link to="/result-disposition">Gå till resultatdisposition →</Link>
              </p>
            </div>
          )}

          {!summary.isDisposed && !summary.disposition && !summary.fiscalYear.isClosed && (
            <p className="text-muted" style={{ marginTop: "0.5rem" }}>
              Räkenskapsåret är fortfarande öppet. Stäng året och genomför resultatdisposition för
              att slutföra årsbokslutet.
            </p>
          )}

          {!summary.isDisposed && !summary.disposition && summary.fiscalYear.isClosed && (
            <p className="text-muted" style={{ marginTop: "0.5rem" }}>
              Inget resultat att disponera (konto 2099 har nollsaldo).
            </p>
          )}

          {/* Generated stamp */}
          <p
            style={{
              marginTop: "2rem",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              textAlign: "right",
            }}
          >
            Genererad: {new Date(summary.generatedAt).toLocaleString("sv-SE")}
          </p>
        </>
      )}
    </div>
  );
}
