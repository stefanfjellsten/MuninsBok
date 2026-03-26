import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetTrialBalance } = vi.hoisted(() => ({
  mockGetTrialBalance: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2026-01-01", endDate: "2026-12-31" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, getTrialBalance: mockGetTrialBalance },
  };
});

import { TrialBalance } from "./TrialBalance";

const baseReport = {
  data: {
    rows: [
      {
        accountNumber: "1930",
        accountName: "Företagskonto",
        debit: 100000,
        credit: 0,
        balance: 100000,
      },
      {
        accountNumber: "3000",
        accountName: "Försäljning",
        debit: 0,
        credit: 80000,
        balance: -80000,
      },
      { accountNumber: "5010", accountName: "Lokalhyra", debit: 60000, credit: 0, balance: 60000 },
    ],
    totalDebit: 160000,
    totalCredit: 80000,
  },
};

describe("TrialBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetTrialBalance.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<TrialBalance />);
    expect(screen.getByText("Laddar råbalans...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetTrialBalance.mockRejectedValue(new Error("Timeout"));
    renderWithProviders(<TrialBalance />);
    expect(await screen.findByText(/Timeout/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetTrialBalance.mockResolvedValue({ data: { rows: [], totalDebit: 0, totalCredit: 0 } });
    renderWithProviders(<TrialBalance />);
    expect(await screen.findByText(/Inga bokförda transaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetTrialBalance.mockResolvedValue(baseReport);
    renderWithProviders(<TrialBalance />);
    expect(await screen.findByRole("heading", { level: 2, name: /Råbalans/ })).toBeInTheDocument();
  });

  it("renders account rows", async () => {
    mockGetTrialBalance.mockResolvedValue(baseReport);
    renderWithProviders(<TrialBalance />);
    expect(await screen.findByText("1930")).toBeInTheDocument();
    expect(screen.getByText("Företagskonto")).toBeInTheDocument();
    expect(screen.getByText("3000")).toBeInTheDocument();
    expect(screen.getByText("Försäljning")).toBeInTheDocument();
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
  });

  it("renders sum row in footer", async () => {
    mockGetTrialBalance.mockResolvedValue(baseReport);
    renderWithProviders(<TrialBalance />);
    await screen.findByText("1930");
    expect(screen.getByText("Summa")).toBeInTheDocument();
  });

  it("renders export buttons", async () => {
    mockGetTrialBalance.mockResolvedValue(baseReport);
    renderWithProviders(<TrialBalance />);
    await screen.findByText("1930");
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetTrialBalance.mockResolvedValue(baseReport);
    renderWithProviders(<TrialBalance />);
    await screen.findByText("1930");
    expect(screen.getByText("Konto")).toBeInTheDocument();
    expect(screen.getByText("Namn")).toBeInTheDocument();
    expect(screen.getByText("Debet")).toBeInTheDocument();
    expect(screen.getByText("Kredit")).toBeInTheDocument();
    expect(screen.getByText("Saldo")).toBeInTheDocument();
  });
});
