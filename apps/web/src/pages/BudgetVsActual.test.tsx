import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetBudgetVsActual } = vi.hoisted(() => ({
  mockGetBudgetVsActual: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: { ...actual.api, getBudgetVsActual: mockGetBudgetVsActual },
  };
});

import { BudgetVsActual } from "./BudgetVsActual";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ budgetId: "b-1" }),
    useNavigate: () => vi.fn(),
  };
});

const sampleReport = {
  data: {
    budgetName: "Årsbudget 2024",
    rows: [
      {
        accountNumber: "5010",
        accountName: "Lokalhyra",
        budget: 120000,
        actual: 115000,
        deviation: -5000,
        deviationPercent: -4.2,
      },
      {
        accountNumber: "6110",
        accountName: "Kontorsmaterial",
        budget: 24000,
        actual: 28000,
        deviation: 4000,
        deviationPercent: 16.7,
      },
    ],
    totalBudget: 144000,
    totalActual: 143000,
    totalDeviation: -1000,
  },
};

describe("BudgetVsActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetBudgetVsActual.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<BudgetVsActual />);
    expect(screen.getByText("Laddar budget mot utfall…")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetBudgetVsActual.mockRejectedValue(new Error("Server error"));
    renderWithProviders(<BudgetVsActual />);
    expect(await screen.findByText(/Server error/)).toBeInTheDocument();
  });

  it("shows empty report state", async () => {
    mockGetBudgetVsActual.mockResolvedValue({ data: null });
    renderWithProviders(<BudgetVsActual />);
    expect(await screen.findByText("Kunde inte ladda rapporten.")).toBeInTheDocument();
  });

  it("renders heading with budget name", async () => {
    mockGetBudgetVsActual.mockResolvedValue(sampleReport);
    renderWithProviders(<BudgetVsActual />);
    expect(await screen.findByText(/Budget mot utfall — Årsbudget 2024/)).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetBudgetVsActual.mockResolvedValue(sampleReport);
    renderWithProviders(<BudgetVsActual />);
    await screen.findByText(/Årsbudget 2024/);
    for (const h of ["Konto", "Namn", "Budget", "Utfall", "Avvikelse"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it("renders row data with account info and deviation", async () => {
    mockGetBudgetVsActual.mockResolvedValue(sampleReport);
    renderWithProviders(<BudgetVsActual />);
    await screen.findByText(/Årsbudget 2024/);
    expect(screen.getByText("5010")).toBeInTheDocument();
    expect(screen.getByText("Lokalhyra")).toBeInTheDocument();
    expect(screen.getByText("6110")).toBeInTheDocument();
    expect(screen.getByText("Kontorsmaterial")).toBeInTheDocument();
    expect(screen.getByText("-4.2%")).toBeInTheDocument();
    expect(screen.getByText("16.7%")).toBeInTheDocument();
  });

  it("renders totals row", async () => {
    mockGetBudgetVsActual.mockResolvedValue(sampleReport);
    renderWithProviders(<BudgetVsActual />);
    await screen.findByText(/Årsbudget 2024/);
    expect(screen.getByText("Totalt")).toBeInTheDocument();
  });

  it("shows export buttons and back button", async () => {
    mockGetBudgetVsActual.mockResolvedValue(sampleReport);
    renderWithProviders(<BudgetVsActual />);
    await screen.findByText(/Årsbudget 2024/);
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
    expect(screen.getByText("Tillbaka")).toBeInTheDocument();
  });

  it("shows empty rows message", async () => {
    mockGetBudgetVsActual.mockResolvedValue({
      data: { ...sampleReport.data, rows: [] },
    });
    renderWithProviders(<BudgetVsActual />);
    expect(await screen.findByText("Inga poster att visa.")).toBeInTheDocument();
  });
});
