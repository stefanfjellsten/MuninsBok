import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const { mockSetFiscalYear, mockAddToast, mockCloseFiscalYear, mockCreateOpeningBalances } =
  vi.hoisted(() => ({
    mockSetFiscalYear: vi.fn(),
    mockAddToast: vi.fn(),
    mockCloseFiscalYear: vi.fn(),
    mockCreateOpeningBalances: vi.fn(),
  }));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYears: [
      { id: "fy-1", startDate: "2026-01-01", endDate: "2026-12-31", isClosed: false },
      { id: "fy-0", startDate: "2025-01-01", endDate: "2025-12-31", isClosed: true },
    ],
    setFiscalYear: mockSetFiscalYear,
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
      closeFiscalYear: mockCloseFiscalYear,
      createOpeningBalances: mockCreateOpeningBalances,
    },
  };
});

import { FiscalYears } from "./FiscalYears";

describe("FiscalYears", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByRole("heading", { level: 2, name: /Räkenskapsår/ })).toBeInTheDocument();
  });

  it("renders fiscal year periods", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("shows open badge for open year", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Öppet")).toBeInTheDocument();
  });

  it("shows closed badge for closed year", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Stängt")).toBeInTheDocument();
  });

  it("shows close button for open year", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Stäng år")).toBeInTheDocument();
  });

  it("shows create-IB button when previous closed year exists", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Skapa IB")).toBeInTheDocument();
  });

  it("shows confirm dialog when close button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FiscalYears />);
    await user.click(screen.getByText("Stäng år"));
    expect(screen.getByText("Stäng räkenskapsår?")).toBeInTheDocument();
    expect(screen.getByText("Stäng året")).toBeInTheDocument();
    expect(screen.getByText("Avbryt")).toBeInTheDocument();
  });

  it("shows BFL explanation details", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Vad händer när jag stänger ett räkenskapsår?")).toBeInTheDocument();
  });

  it("shows description mentioning organization name", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText(/Hantera räkenskapsår för Test AB/)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    renderWithProviders(<FiscalYears />);
    expect(screen.getByText("Period")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Åtgärder")).toBeInTheDocument();
  });
});
