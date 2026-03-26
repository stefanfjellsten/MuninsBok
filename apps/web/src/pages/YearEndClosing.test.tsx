import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetClosingPreview, mockAddToast } = vi.hoisted(() => ({
  mockGetClosingPreview: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: false },
    fiscalYears: [{ id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31", isClosed: false }],
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../components/Dialog.module.css", () => ({ default: {} }));
vi.mock("./YearEndClosing.module.css", () => ({ default: {} }));

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
      getClosingPreview: mockGetClosingPreview,
      closeFiscalYear: vi.fn(),
    },
  };
});

import YearEndClosing from "./YearEndClosing";

const samplePreview = {
  data: {
    hasEntries: true,
    totalRevenues: 5000000,
    totalExpenses: 3200000,
    operatingResult: 1800000,
    totalFinancialIncome: 50000,
    totalFinancialExpenses: 30000,
    netResult: 1820000,
    isBalanced: true,
    accountCount: 8,
    revenues: {
      title: "Intäkter",
      total: 5000000,
      lines: [
        {
          accountNumber: "3010",
          accountName: "Försäljning",
          currentBalance: 5000000,
          closingDebit: 5000000,
          closingCredit: 0,
        },
      ],
    },
    expenses: {
      title: "Kostnader",
      total: 3200000,
      lines: [
        {
          accountNumber: "5010",
          accountName: "Lokalhyra",
          currentBalance: -3200000,
          closingDebit: 0,
          closingCredit: 3200000,
        },
      ],
    },
    financialIncome: { title: "Finansiella intäkter", total: 50000, lines: [] },
    financialExpenses: { title: "Finansiella kostnader", total: 30000, lines: [] },
    resultEntry: {
      accountNumber: "2099",
      accountName: "Årets resultat",
      debit: 0,
      credit: 1820000,
    },
  },
};

describe("YearEndClosing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetClosingPreview.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<YearEndClosing />);
    expect(screen.getByText("Laddar förhandsvisning…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetClosingPreview.mockRejectedValue(new Error("Nätverksfel"));
    renderWithProviders(<YearEndClosing />);
    expect(await screen.findByText("Kunde inte ladda förhandsvisning")).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Boksluts-förhandsvisning" }),
    ).toBeInTheDocument();
  });

  it("shows no-entries message when empty", async () => {
    mockGetClosingPreview.mockResolvedValue({
      data: { ...samplePreview.data, hasEntries: false },
    });
    renderWithProviders(<YearEndClosing />);
    expect(await screen.findByText(/Inga resultaträkningskonton att stänga/)).toBeInTheDocument();
  });

  it("renders summary cards", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    await screen.findByText("Försäljning");
    expect(screen.getByText("Rörelseresultat")).toBeInTheDocument();
    // "Kostnader" appears in both summary card and section table
    expect(screen.getAllByText("Kostnader").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Årets resultat").length).toBeGreaterThanOrEqual(1);
  });

  it("renders revenue section table", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    await screen.findByText("Försäljning");
    expect(screen.getByText("3010")).toBeInTheDocument();
  });

  it("renders balance check", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    await screen.findByText("Försäljning");
    expect(screen.getByText(/Bokslutsverifikatet balanserar/)).toBeInTheDocument();
  });

  it("renders close button", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    expect(await screen.findByRole("button", { name: "Stäng räkenskapsåret" })).toBeInTheDocument();
  });

  it("shows account count", async () => {
    mockGetClosingPreview.mockResolvedValue(samplePreview);
    renderWithProviders(<YearEndClosing />);
    await screen.findByText("Försäljning");
    expect(screen.getByText(/8 resultaträkningskonton berörs/)).toBeInTheDocument();
  });
});
