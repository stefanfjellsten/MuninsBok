import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetJournal } = vi.hoisted(() => ({
  mockGetJournal: vi.fn(),
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
    api: { ...actual.api, getJournal: mockGetJournal },
  };
});

import { Journal } from "./Journal";

const baseReport = {
  data: {
    entries: [
      {
        voucherId: "v-1",
        voucherNumber: 1,
        date: "2026-01-15",
        description: "Hyra",
        lines: [
          { accountNumber: "5010", accountName: "Lokalhyra", debit: 8000, credit: 0 },
          { accountNumber: "1930", accountName: "Företagskonto", debit: 0, credit: 8000 },
        ],
      },
      {
        voucherId: "v-2",
        voucherNumber: 2,
        date: "2026-02-01",
        description: "Lön",
        lines: [
          { accountNumber: "7210", accountName: "Löner", debit: 25000, credit: 0 },
          { accountNumber: "1930", accountName: "Företagskonto", debit: 0, credit: 25000 },
        ],
      },
    ],
    totalDebit: 33000,
    totalCredit: 33000,
  },
};

describe("Journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetJournal.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Journal />);
    expect(screen.getByText("Laddar grundbok...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetJournal.mockRejectedValue(new Error("Anslutningsfel"));
    renderWithProviders(<Journal />);
    expect(await screen.findByText(/Anslutningsfel/)).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockGetJournal.mockResolvedValue({ data: { entries: [], totalDebit: 0, totalCredit: 0 } });
    renderWithProviders(<Journal />);
    expect(await screen.findByText(/Inga bokförda transaktioner/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetJournal.mockResolvedValue(baseReport);
    renderWithProviders(<Journal />);
    expect(await screen.findByRole("heading", { level: 2, name: /Grundbok/ })).toBeInTheDocument();
  });

  it("renders journal entries", async () => {
    mockGetJournal.mockResolvedValue(baseReport);
    renderWithProviders(<Journal />);
    expect(await screen.findByText("Hyra")).toBeInTheDocument();
    expect(screen.getByText("Lön")).toBeInTheDocument();
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
    expect(screen.getByText("7210")).toBeInTheDocument();
    expect(screen.getByText("Löner")).toBeInTheDocument();
  });

  it("renders sum footer row", async () => {
    mockGetJournal.mockResolvedValue(baseReport);
    renderWithProviders(<Journal />);
    await screen.findByText("Hyra");
    expect(screen.getByText("Summa")).toBeInTheDocument();
  });

  it("renders export buttons", async () => {
    mockGetJournal.mockResolvedValue(baseReport);
    renderWithProviders(<Journal />);
    await screen.findByText("Hyra");
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetJournal.mockResolvedValue(baseReport);
    renderWithProviders(<Journal />);
    await screen.findByText("Hyra");
    expect(screen.getByText("Datum")).toBeInTheDocument();
    expect(screen.getByText("Ver.nr")).toBeInTheDocument();
    expect(screen.getByText("Beskrivning")).toBeInTheDocument();
    expect(screen.getByText("Konto")).toBeInTheDocument();
    expect(screen.getByText("Kontonamn")).toBeInTheDocument();
  });
});
