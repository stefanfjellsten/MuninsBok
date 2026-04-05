import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetAccounts, mockGetAccountAnalysis } = vi.hoisted(() => ({
  mockGetAccounts: vi.fn(),
  mockGetAccountAnalysis: vi.fn(),
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
      getAccountAnalysis: mockGetAccountAnalysis,
    },
  };
});

vi.mock("../utils/csv", () => ({
  toCsv: vi.fn(() => ""),
  downloadCsv: vi.fn(),
  csvAmount: vi.fn((v: number) => String(v)),
}));

import { AccountAnalysis } from "./AccountAnalysis";

const sampleAccounts = {
  data: [
    { number: "1930", name: "Företagskonto" },
    { number: "5010", name: "Lokalhyra" },
  ],
};

describe("AccountAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue(sampleAccounts);
  });

  it("renders heading", async () => {
    renderWithProviders(<AccountAnalysis />);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Kontoanalys" }),
    ).toBeInTheDocument();
  });

  it("shows instruction when no account selected", async () => {
    renderWithProviders(<AccountAnalysis />);
    expect(
      await screen.findByText("Välj ett konto ovan för att visa analysen."),
    ).toBeInTheDocument();
  });

  it("renders account selector with options", async () => {
    renderWithProviders(<AccountAnalysis />);
    expect(await screen.findByText(/1930/)).toBeInTheDocument();
    expect(screen.getByText(/5010/)).toBeInTheDocument();
  });

  it("renders Konto label", async () => {
    renderWithProviders(<AccountAnalysis />);
    expect(await screen.findByText("Konto:")).toBeInTheDocument();
  });
});
