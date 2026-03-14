import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { defined } from "../utils/assert";
import { api, type InvoiceStatus } from "../api";
import { formatAmount, oreToKronor, formatDate } from "../utils/formatting";

const STATUS_KEYS: Record<InvoiceStatus, string> = {
  DRAFT: "invoices.statusDraft",
  SENT: "invoices.statusSent",
  PAID: "invoices.statusPaid",
  OVERDUE: "invoices.statusOverdue",
  CANCELLED: "invoices.statusCancelled",
  CREDITED: "invoices.statusCredited",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "#6b7280",
  SENT: "#2563eb",
  PAID: "#16a34a",
  OVERDUE: "#dc2626",
  CANCELLED: "#9ca3af",
  CREDITED: "#7c3aed",
};

export function Invoices() {
  const { organization } = useOrganization();
  const { t } = useLocale();
  const orgId = defined(organization).id;
  const [statusFilter, setStatusFilter] = useState<string>("");

  const invoicesQuery = useQuery({
    queryKey: ["invoices", orgId, statusFilter],
    queryFn: () => api.getInvoices(orgId, statusFilter || undefined),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => api.getCustomers(orgId),
  });

  const invoices = invoicesQuery.data?.data ?? [];
  const customerMap = new Map((customersQuery.data?.data ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="flex-between mb-1">
        <h2>{t("invoices.title")}</h2>
        <Link to="/invoices/new">
          <button>{t("invoices.new")}</button>
        </Link>
      </div>

      <div className="mb-1">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "0.25rem 0.5rem" }}
        >
          <option value="">Alla</option>
          {(Object.keys(STATUS_KEYS) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(STATUS_KEYS[s] as Parameters<typeof t>[0])}
            </option>
          ))}
        </select>
      </div>

      {invoicesQuery.isLoading ? (
        <p>{t("common.loading")}</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">{t("invoices.empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("invoices.number")}</th>
              <th>{t("invoices.customer")}</th>
              <th>{t("invoices.issueDate")}</th>
              <th>{t("invoices.dueDate")}</th>
              <th style={{ textAlign: "right" }}>{t("invoices.totalAmount")}</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>{customerMap.get(inv.customerId) ?? "–"}</td>
                <td>{formatDate(inv.issueDate)}</td>
                <td>{formatDate(inv.dueDate)}</td>
                <td style={{ textAlign: "right" }}>{formatAmount(oreToKronor(inv.totalAmount))}</td>
                <td>
                  <span
                    style={{
                      color: STATUS_COLORS[inv.status as InvoiceStatus],
                      fontWeight: 600,
                    }}
                  >
                    {t(STATUS_KEYS[inv.status as InvoiceStatus] as Parameters<typeof t>[0])}
                  </span>
                </td>
                <td>
                  <Link to={`/invoices/${inv.id}`}>Visa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
