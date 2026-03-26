import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetAccounts, mockParseCsv } = vi.hoisted(() => ({
  mockGetAccounts: vi.fn(),
  mockParseCsv: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
    fiscalYear: { id: "fy-1", startDate: "2024-01-01", endDate: "2024-12-31" },
  }),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getAccounts: mockGetAccounts,
      parseCsv: mockParseCsv,
      previewCsvImport: vi.fn(),
      executeCsvImport: vi.fn(),
    },
  };
});

vi.mock("./CsvImport.module.css", () => ({ default: {} }));

import { CsvImport } from "./CsvImport";

describe("CsvImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue({
      data: [
        { number: "1930", name: "Företagskonto", type: "ASSET" },
        { number: "3000", name: "Försäljning", type: "REVENUE" },
      ],
    });
  });

  it("renders heading", () => {
    renderWithProviders(<CsvImport />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Importera bankutdrag (CSV)" }),
    ).toBeInTheDocument();
  });

  it("shows stepper with upload step active", () => {
    renderWithProviders(<CsvImport />);
    expect(screen.getByText(/1\. Fil/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Kolumner/)).toBeInTheDocument();
    expect(screen.getByText(/3\. Förhandsvisning/)).toBeInTheDocument();
    expect(screen.getByText(/4\. Klart/)).toBeInTheDocument();
  });

  it("shows upload instructions", () => {
    renderWithProviders(<CsvImport />);
    expect(screen.getByText(/Ladda upp en CSV-fil/)).toBeInTheDocument();
  });

  it("renders file input", () => {
    renderWithProviders(<CsvImport />);
    expect(screen.getByTestId("csv-file-input")).toBeInTheDocument();
  });
});
