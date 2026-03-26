import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetVoucherListReport } = vi.hoisted(() => ({
  mockGetVoucherListReport: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
  }),
}));

vi.mock("../utils/csv", () => ({
  toCsv: vi.fn(() => ""),
  downloadCsv: vi.fn(),
  csvAmount: vi.fn((v: number) => String(v)),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getVoucherListReport: mockGetVoucherListReport,
    },
  };
});

import { VoucherListReport } from "./VoucherListReport";

const sampleReport = {
  data: {
    count: 2,
    totalDebit: 1500000,
    totalCredit: 1500000,
    entries: [
      {
        voucherId: "v-1",
        voucherNumber: 1,
        date: "2024-01-15",
        description: "Hyra januari",
        createdBy: "admin@test.se",
        lines: [
          { accountNumber: "5010", accountName: "Lokalhyra", debit: 800000, credit: 0 },
          { accountNumber: "1930", accountName: "Företagskonto", debit: 0, credit: 800000 },
        ],
      },
      {
        voucherId: "v-2",
        voucherNumber: 2,
        date: "2024-01-20",
        description: "Försäljning",
        createdBy: null,
        lines: [
          { accountNumber: "1930", accountName: "Företagskonto", debit: 700000, credit: 0 },
          { accountNumber: "3010", accountName: "Försäljning", debit: 0, credit: 700000 },
        ],
      },
    ],
  },
};

describe("VoucherListReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetVoucherListReport.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VoucherListReport />);
    expect(screen.getByText("Laddar verifikationslista...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetVoucherListReport.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<VoucherListReport />);
    expect(await screen.findByText(/Serverfel/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetVoucherListReport.mockResolvedValue({
      data: { count: 0, totalDebit: 0, totalCredit: 0, entries: [] },
    });
    renderWithProviders(<VoucherListReport />);
    expect(await screen.findByText("Inga verifikat ännu.")).toBeInTheDocument();
  });

  it("renders heading with count", async () => {
    mockGetVoucherListReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VoucherListReport />);
    expect(
      await screen.findByRole("heading", { level: 2, name: /Verifikationslista.*2 verifikat/ }),
    ).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetVoucherListReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VoucherListReport />);
    await screen.findByText("Hyra januari");
    expect(screen.getByText("Ver.nr")).toBeInTheDocument();
    expect(screen.getByText("Datum")).toBeInTheDocument();
    expect(screen.getByText("Kontonamn")).toBeInTheDocument();
  });

  it("renders voucher descriptions", async () => {
    mockGetVoucherListReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VoucherListReport />);
    expect(await screen.findByText("Hyra januari")).toBeInTheDocument();
    // "Försäljning" appears both as description and account name
    expect(screen.getAllByText("Försäljning").length).toBe(2);
  });

  it("renders sum row in footer", async () => {
    mockGetVoucherListReport.mockResolvedValue(sampleReport);
    renderWithProviders(<VoucherListReport />);
    await screen.findByText("Hyra januari");
    expect(screen.getByText("Summa")).toBeInTheDocument();
  });
});
