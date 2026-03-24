import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { defined } from "../utils/assert";
import { api, type BankTransactionEntity, type BankTransactionMatchStatus } from "../api";

const MATCH_STATUS_LABELS: Record<BankTransactionMatchStatus, string> = {
  PENDING_MATCH: "Väntar på matchning",
  MATCHED: "Matchad",
  CONFIRMED: "Bekräftad",
  ERROR: "Fel",
};

const MATCH_STATUS_COLORS: Record<BankTransactionMatchStatus, string> = {
  PENDING_MATCH: "#fef3c7",
  MATCHED: "#dff7e8",
  CONFIRMED: "#dbeafe",
  ERROR: "#ffe1e1",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short" }).format(parsed);
}

function formatAmount(amountOre: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountOre / 100);
}

const PAGE_SIZE = 20;

export function BankTransactions() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { organization } = useOrganization();
  const orgId = defined(organization).id;

  const [page, setPage] = useState(1);
  const [matchStatus, setMatchStatus] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const query = useQuery({
    queryKey: [
      "bank-transactions",
      orgId,
      connectionId,
      page,
      PAGE_SIZE,
      matchStatus,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      api.getBankTransactions(orgId, defined(connectionId), {
        page,
        limit: PAGE_SIZE,
        ...(matchStatus && { matchStatus }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
      }),
    enabled: !!connectionId,
  });

  const result = query.data;
  const transactions: BankTransactionEntity[] = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  const resetFilters = () => {
    setMatchStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  if (query.isLoading) {
    return <div className="loading">Laddar transaktioner...</div>;
  }

  if (query.error) {
    return <div className="error">Fel vid hämtning: {(query.error as Error).message}</div>;
  }

  return (
    <div>
      <div className="flex-between mb-1">
        <div>
          <div style={{ marginBottom: "0.5rem" }}>
            <Link to="/bank" style={{ fontSize: "0.875rem" }}>
              ← Bankkopplingar
            </Link>
          </div>
          <h2>Transaktioner</h2>
          <p className="text-muted" style={{ marginTop: "0.35rem" }}>
            {total} transaktioner totalt
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelStyle}>
            Matchningsstatus
            <select
              value={matchStatus}
              onChange={handleFilterChange(setMatchStatus)}
              style={inputStyle}
            >
              <option value="">Alla</option>
              {(Object.entries(MATCH_STATUS_LABELS) as [BankTransactionMatchStatus, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label style={labelStyle}>
            Från datum
            <input
              type="date"
              value={fromDate}
              onChange={handleFilterChange(setFromDate)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Till datum
            <input
              type="date"
              value={toDate}
              onChange={handleFilterChange(setToDate)}
              style={inputStyle}
            />
          </label>

          {(matchStatus || fromDate || toDate) && (
            <button
              onClick={resetFilters}
              style={{
                ...buttonStyle,
                background: "transparent",
                color: "inherit",
                border: "1px solid #d1d5db",
              }}
            >
              Rensa filter
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card">
          <p className="text-muted">Inga transaktioner hittades med valda filter.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Beskrivning</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Belopp</th>
                  <th style={thStyle}>Matchningsstatus</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={tdStyle}>{formatDate(tx.bookedAt)}</td>
                    <td style={tdStyle}>
                      <div>{tx.description}</div>
                      {tx.counterpartyName && (
                        <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                          {tx.counterpartyName}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ color: tx.amountOre < 0 ? "#dc2626" : "#16a34a" }}>
                        {formatAmount(tx.amountOre, tx.currency)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          background: MATCH_STATUS_COLORS[tx.matchStatus] ?? "#f3f4f6",
                        }}
                      >
                        {MATCH_STATUS_LABELS[tx.matchStatus] ?? tx.matchStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                marginTop: "1rem",
                justifyContent: "center",
              }}
            >
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={buttonStyle}>
                Föregående
              </button>
              <span style={{ fontSize: "0.875rem" }}>
                Sida {page} av {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={buttonStyle}
              >
                Nästa
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.875rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: "4px",
  border: "1px solid #d1d5db",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.4rem 0.8rem",
  borderRadius: "4px",
  border: "none",
  background: "#374151",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.875rem",
};

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  color: "#374151",
};

const tdStyle: React.CSSProperties = {
  padding: "0.625rem 0.75rem",
  verticalAlign: "top",
};
