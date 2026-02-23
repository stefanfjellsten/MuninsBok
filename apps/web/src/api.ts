import type {
  Account,
  ApiResponse,
  BalanceSheet,
  DashboardSummary,
  DocumentMeta,
  FiscalYear,
  GeneralLedgerReport,
  IncomeStatement,
  JournalReport,
  Organization,
  PaginatedApiResponse,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
} from "@muninsbok/core/api-types";

export type {
  Account,
  BalanceSheet,
  DashboardSummary,
  DocumentMeta,
  FiscalYear,
  GeneralLedgerReport,
  IncomeStatement,
  JournalReport,
  Organization,
  Pagination,
  ReportSection,
  TrialBalance,
  VatReport,
  Voucher,
  VoucherGaps,
  VoucherListReportData,
} from "@muninsbok/core/api-types";

const API_BASE = "/api";

/**
 * Structured API error with status code and optional error code
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorBody.code ?? "UNKNOWN",
      errorBody.error?.message ?? errorBody.error ?? "Ett fel uppstod",
    );
  }

  return response.json();
}

export const api = {
  // Organizations
  getDashboard: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<DashboardSummary>>(
      `${API_BASE}/organizations/${orgId}/dashboard?fiscalYearId=${fiscalYearId}`,
    ),

  getOrganizations: () => fetchJson<ApiResponse<Organization[]>>(`${API_BASE}/organizations`),

  createOrganization: (data: { orgNumber: string; name: string; fiscalYearStartMonth?: number }) =>
    fetchJson<ApiResponse<Organization>>(`${API_BASE}/organizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrganization: (orgId: string, data: { name?: string; fiscalYearStartMonth?: number }) =>
    fetchJson<ApiResponse<Organization>>(`${API_BASE}/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (orgId: string) =>
    fetch(`${API_BASE}/organizations/${orgId}`, { method: "DELETE" }).then((res) => {
      if (!res.ok)
        throw new ApiError(res.status, "DELETE_FAILED", "Kunde inte radera organisationen");
    }),

  // Fiscal Years
  getFiscalYears: (orgId: string) =>
    fetchJson<ApiResponse<FiscalYear[]>>(`${API_BASE}/organizations/${orgId}/fiscal-years`),

  createFiscalYear: (orgId: string, data: { startDate: string; endDate: string }) =>
    fetchJson<ApiResponse<FiscalYear>>(`${API_BASE}/organizations/${orgId}/fiscal-years`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  closeFiscalYear: (orgId: string, fyId: string) =>
    fetchJson<ApiResponse<FiscalYear>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/close`,
      { method: "PATCH" },
    ),

  // Accounts
  getAccounts: (orgId: string, activeOnly = true) =>
    fetchJson<ApiResponse<Account[]>>(
      `${API_BASE}/organizations/${orgId}/accounts${activeOnly ? "?active=true" : ""}`,
    ),

  getAccount: (orgId: string, accountNumber: string) =>
    fetchJson<ApiResponse<Account>>(`${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`),

  createAccount: (
    orgId: string,
    data: {
      number: string;
      name: string;
      type: Account["type"];
      isVatAccount?: boolean;
    },
  ) =>
    fetchJson<ApiResponse<Account>>(`${API_BASE}/organizations/${orgId}/accounts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivateAccount: (orgId: string, accountNumber: string) =>
    fetch(`${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`, {
      method: "DELETE",
    }).then((res) => {
      if (!res.ok) throw new ApiError(res.status, "DELETE_FAILED", "Kunde inte inaktivera kontot");
    }),

  updateAccount: (
    orgId: string,
    accountNumber: string,
    data: {
      name?: string;
      type?: Account["type"];
      isVatAccount?: boolean;
    },
  ) =>
    fetchJson<ApiResponse<Account>>(
      `${API_BASE}/organizations/${orgId}/accounts/${accountNumber}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),

  // Vouchers
  getVouchers: (
    orgId: string,
    fiscalYearId: string,
    options?: { page?: number; limit?: number; search?: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.search) params.set("search", options.search);
    return fetchJson<PaginatedApiResponse<Voucher[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers?${params}`,
    );
  },

  getVoucher: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<Voucher>>(`${API_BASE}/organizations/${orgId}/vouchers/${voucherId}`),

  createVoucher: (
    orgId: string,
    data: {
      fiscalYearId: string;
      date: string;
      description: string;
      lines: { accountNumber: string; debit: number; credit: number; description?: string }[];
      createdBy?: string;
    },
  ) =>
    fetchJson<ApiResponse<Voucher>>(`${API_BASE}/organizations/${orgId}/vouchers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  correctVoucher: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/correct`,
      { method: "POST" },
    ),

  // Reports
  getTrialBalance: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<TrialBalance>>(
      `${API_BASE}/organizations/${orgId}/reports/trial-balance?${params}`,
    );
  },

  getIncomeStatement: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<IncomeStatement>>(
      `${API_BASE}/organizations/${orgId}/reports/income-statement?${params}`,
    );
  },

  getBalanceSheet: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<BalanceSheet>>(
      `${API_BASE}/organizations/${orgId}/reports/balance-sheet?${params}`,
    );
  },

  getVatReport: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<VatReport>>(
      `${API_BASE}/organizations/${orgId}/reports/vat?${params}`,
    );
  },

  getJournal: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<JournalReport>>(
      `${API_BASE}/organizations/${orgId}/reports/journal?${params}`,
    );
  },

  getGeneralLedger: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<GeneralLedgerReport>>(
      `${API_BASE}/organizations/${orgId}/reports/general-ledger?${params}`,
    );
  },

  getVoucherListReport: (
    orgId: string,
    fiscalYearId: string,
    dateRange?: { startDate: string; endDate: string },
  ) => {
    const params = new URLSearchParams({ fiscalYearId });
    if (dateRange) {
      params.set("startDate", dateRange.startDate);
      params.set("endDate", dateRange.endDate);
    }
    return fetchJson<ApiResponse<VoucherListReportData>>(
      `${API_BASE}/organizations/${orgId}/reports/voucher-list?${params}`,
    );
  },

  // Voucher gaps
  getVoucherGaps: (orgId: string, fiscalYearId: string) =>
    fetchJson<ApiResponse<VoucherGaps>>(
      `${API_BASE}/organizations/${orgId}/vouchers/gaps?fiscalYearId=${fiscalYearId}`,
    ),

  // Opening balances
  createOpeningBalances: (orgId: string, fyId: string, previousFiscalYearId: string) =>
    fetchJson<ApiResponse<Voucher>>(
      `${API_BASE}/organizations/${orgId}/fiscal-years/${fyId}/opening-balances`,
      {
        method: "POST",
        body: JSON.stringify({ previousFiscalYearId }),
      },
    ),

  // SIE
  exportSie: (orgId: string, fiscalYearId: string) =>
    `${API_BASE}/organizations/${orgId}/sie/export?fiscalYearId=${fiscalYearId}`,

  importSie: async (orgId: string, fiscalYearId: string, content: string) =>
    fetchJson<ApiResponse<{ vouchersImported: number; accountsImported: number }>>(
      `${API_BASE}/organizations/${orgId}/sie/import?fiscalYearId=${fiscalYearId}`,
      {
        method: "POST",
        body: content,
        headers: { "Content-Type": "text/plain" },
      },
    ),

  // Documents
  getVoucherDocuments: (orgId: string, voucherId: string) =>
    fetchJson<ApiResponse<DocumentMeta[]>>(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/documents`,
    ),

  uploadDocument: async (orgId: string, voucherId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${API_BASE}/organizations/${orgId}/vouchers/${voucherId}/documents`,
      { method: "POST", body: formData },
    );
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorBody.code ?? "UPLOAD_FAILED",
        errorBody.error?.message ?? errorBody.error ?? "Kunde inte ladda upp fil",
      );
    }
    return response.json() as Promise<ApiResponse<DocumentMeta>>;
  },

  downloadDocumentUrl: (orgId: string, documentId: string) =>
    `${API_BASE}/organizations/${orgId}/documents/${documentId}/download`,

  deleteDocument: (orgId: string, documentId: string) =>
    fetch(`${API_BASE}/organizations/${orgId}/documents/${documentId}`, { method: "DELETE" }).then(
      (res) => {
        if (!res.ok)
          throw new ApiError(res.status, "DELETE_FAILED", "Kunde inte radera dokumentet");
      },
    ),
};
