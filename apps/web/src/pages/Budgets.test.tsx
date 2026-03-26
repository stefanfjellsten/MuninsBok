import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetBudgets, mockAddToast } = vi.hoisted(() => ({
  mockGetBudgets: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getBudgets: mockGetBudgets,
      deleteBudget: vi.fn(),
    },
  };
});

import { Budgets } from "./Budgets";

const sampleBudgets = {
  data: [
    {
      id: "b-1",
      name: "Årsbudget 2024",
      fiscalYearId: "fy-1",
      organizationId: "org-1",
      entries: [
        { id: "e-1", accountNumber: "5010", amount: 9600000 },
        { id: "e-2", accountNumber: "6110", amount: 1200000 },
      ],
    },
    {
      id: "b-2",
      name: "Projektbudget",
      fiscalYearId: "fy-1",
      organizationId: "org-1",
      entries: [{ id: "e-3", accountNumber: "4010", amount: 5000000 }],
    },
  ],
};

describe("Budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetBudgets.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Budgets />);
    expect(screen.getByText("Laddar budgetar…")).toBeInTheDocument();
  });

  it("renders heading and new budget button", async () => {
    mockGetBudgets.mockResolvedValue(sampleBudgets);
    renderWithProviders(<Budgets />);
    expect(await screen.findByRole("heading", { level: 2, name: "Budget" })).toBeInTheDocument();
    expect(screen.getByText("+ Ny budget")).toBeInTheDocument();
  });

  it("shows empty state when no budgets", async () => {
    mockGetBudgets.mockResolvedValue({ data: [] });
    renderWithProviders(<Budgets />);
    expect(await screen.findByText(/Inga budgetar för detta räkenskapsår/)).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetBudgets.mockResolvedValue(sampleBudgets);
    renderWithProviders(<Budgets />);
    await screen.findByText("Årsbudget 2024");
    expect(screen.getByText("Namn")).toBeInTheDocument();
    expect(screen.getByText("Rader")).toBeInTheDocument();
    expect(screen.getByText("Totalt (kr)")).toBeInTheDocument();
  });

  it("renders budget names as links", async () => {
    mockGetBudgets.mockResolvedValue(sampleBudgets);
    renderWithProviders(<Budgets />);
    const link = await screen.findByRole("link", { name: "Årsbudget 2024" });
    expect(link).toHaveAttribute("href", "/budgets/b-1/edit");
  });

  it("renders entry count per budget", async () => {
    mockGetBudgets.mockResolvedValue(sampleBudgets);
    renderWithProviders(<Budgets />);
    await screen.findByText("Årsbudget 2024");
    // Årsbudget has 2 entries, Projektbudget has 1
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders action buttons per budget", async () => {
    mockGetBudgets.mockResolvedValue(sampleBudgets);
    renderWithProviders(<Budgets />);
    await screen.findByText("Årsbudget 2024");
    expect(screen.getAllByText("Utfall").length).toBe(2);
    expect(screen.getAllByText("Redigera").length).toBe(2);
    expect(screen.getAllByText("Ta bort").length).toBe(2);
  });
});
