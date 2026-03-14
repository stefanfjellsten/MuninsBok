import { useState, useCallback, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "../context/OrganizationContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import { defined } from "../utils/assert";
import { api, ApiError, type CustomerEntity } from "../api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import dialogStyles from "../components/Dialog.module.css";

export function Customers() {
  const { organization } = useOrganization();
  const { t } = useLocale();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const orgId = defined(organization).id;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerEntity | null>(null);
  const [deleting, setDeleting] = useState<CustomerEntity | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [reference, setReference] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [formError, setFormError] = useState<string | null>(null);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }, []);

  function openEdit(c: CustomerEntity) {
    setEditing(c);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(c.phone ?? "");
    setAddress(c.address ?? "");
    setPostalCode(c.postalCode ?? "");
    setCity(c.city ?? "");
    setOrgNumber(c.orgNumber ?? "");
    setVatNumber(c.vatNumber ?? "");
    setReference(c.reference ?? "");
    setPaymentTermDays(String(c.paymentTermDays ?? 30));
    setShowForm(true);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setPostalCode("");
    setCity("");
    setOrgNumber("");
    setVatNumber("");
    setReference("");
    setPaymentTermDays("30");
    setShowForm(true);
  }

  const customersQuery = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => api.getCustomers(orgId),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createCustomer(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      closeForm();
      addToast(t("customers.created"), "success");
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateCustomer(orgId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      closeForm();
      addToast(t("customers.updated"), "success");
    },
    onError: (err: Error) => {
      setFormError(err instanceof ApiError ? err.message : t("common.error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCustomer(orgId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      setDeleting(null);
      addToast(t("customers.deleted"), "success");
    },
    onError: (err: Error) => {
      addToast(err instanceof ApiError ? err.message : t("common.error"), "error");
    },
  });

  function buildPayload() {
    const data: Record<string, unknown> = { name };
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (address) data.address = address;
    if (postalCode) data.postalCode = postalCode;
    if (city) data.city = city;
    if (orgNumber) data.orgNumber = orgNumber;
    if (vatNumber) data.vatNumber = vatNumber;
    if (reference) data.reference = reference;
    const pt = parseInt(paymentTermDays, 10);
    if (!Number.isNaN(pt)) data.paymentTermDays = pt;
    return data;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = buildPayload();
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const customers = customersQuery.data?.data ?? [];
  const isLoading = customersQuery.isLoading;

  return (
    <div>
      <div className="flex-between mb-1">
        <h2>{t("customers.title")}</h2>
        <button onClick={openCreate}>{t("customers.new")}</button>
      </div>

      {isLoading ? (
        <p>{t("common.loading")}</p>
      ) : customers.length === 0 ? (
        <p className="text-muted">{t("customers.empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("customers.number")}</th>
              <th>{t("customers.name")}</th>
              <th>{t("customers.email")}</th>
              <th>{t("customers.phone")}</th>
              <th>{t("customers.city")}</th>
              <th>{t("customers.paymentTermDays")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.customerNumber}</td>
                <td>{c.name}</td>
                <td>{c.email ?? "–"}</td>
                <td>{c.phone ?? "–"}</td>
                <td>{c.city ?? "–"}</td>
                <td>{c.paymentTermDays}</td>
                <td>
                  <button className="secondary" onClick={() => openEdit(c)}>
                    {t("common.edit")}
                  </button>{" "}
                  <button className="danger" onClick={() => setDeleting(c)}>
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create / Edit dialog */}
      {showForm && (
        <div className={dialogStyles.overlay} onClick={closeForm}>
          <div
            className={dialogStyles.dialog}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3>{editing ? t("customers.form.title.edit") : t("customers.form.title.new")}</h3>
            <form onSubmit={handleSubmit}>
              <label>
                {t("customers.name")} *
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                {t("customers.email")}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                {t("customers.phone")}
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label>
                {t("customers.address")}
                <input value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label>
                  {t("customers.postalCode")}
                  <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </label>
                <label>
                  {t("customers.city")}
                  <input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label>
                  {t("customers.orgNumber")}
                  <input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} />
                </label>
                <label>
                  {t("customers.vatNumber")}
                  <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
                </label>
              </div>
              <label>
                {t("customers.reference")}
                <input value={reference} onChange={(e) => setReference(e.target.value)} />
              </label>
              <label>
                {t("customers.paymentTermDays")}
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={paymentTermDays}
                  onChange={(e) => setPaymentTermDays(e.target.value)}
                />
              </label>
              {formError && <p className="error">{formError}</p>}
              <div className="flex-between mt-1">
                <button type="button" className="secondary" onClick={closeForm}>
                  {t("common.cancel")}
                </button>
                <button type="submit">{t("common.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <ConfirmDialog
          open={true}
          title={t("common.delete")}
          message={t("customers.deleteConfirm")}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
