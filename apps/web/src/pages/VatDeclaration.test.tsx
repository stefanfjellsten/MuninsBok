import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetVatDeclaration } = vi.hoisted(() => ({
  mockGetVatDeclaration: vi.fn(),
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
    api: { ...actual.api, getVatDeclaration: mockGetVatDeclaration },
  };
});

import { VatDeclaration } from "./VatDeclaration";

const sampleDeclaration = {
  data: {
    ruta05: 500000,
    ruta06: 0,
    ruta07: 0,
    ruta08: 0,
    ruta10: 125000,
    ruta11: 0,
    ruta12: 0,
    ruta20: 0,
    ruta21: 0,
    ruta22: 0,
    ruta23: 0,
    ruta24: 0,
    ruta30: 0,
    ruta31: 0,
    ruta32: 0,
    ruta33: 0,
    ruta35: 0,
    ruta36: 0,
    ruta37: 0,
    ruta38: 0,
    ruta39: 0,
    ruta40: 0,
    ruta41: 0,
    ruta42: 0,
    ruta48: 30000,
    ruta49: 95000,
    ruta50: 0,
  },
};

describe("VatDeclaration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetVatDeclaration.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<VatDeclaration />);
    expect(screen.getByText("Laddar momsdeklaration...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetVatDeclaration.mockRejectedValue(new Error("Serverfel"));
    renderWithProviders(<VatDeclaration />);
    expect(await screen.findByText(/Serverfel/)).toBeInTheDocument();
  });

  it("renders heading", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    expect(await screen.findByText(/Momsdeklaration — SKV 4700/)).toBeInTheDocument();
  });

  it("renders section A with ruta 05", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    await screen.findByText(/Momsdeklaration/);
    expect(screen.getByText(/A\. Momspliktig försäljning/)).toBeInTheDocument();
    expect(screen.getByText("05")).toBeInTheDocument();
  });

  it("renders section B with utgående moms", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    await screen.findByText(/Momsdeklaration/);
    expect(screen.getByText(/B\. Utgående moms/)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders section F with ingående moms", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    await screen.findByText(/Momsdeklaration/);
    expect(screen.getByText(/F\. Ingående moms/)).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();
  });

  it("renders ruta 49 result", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    await screen.findByText(/Momsdeklaration/);
    expect(screen.getByText("49")).toBeInTheDocument();
    expect(screen.getByText(/Moms att betala/)).toBeInTheDocument();
  });

  it("renders export buttons", async () => {
    mockGetVatDeclaration.mockResolvedValue(sampleDeclaration);
    renderWithProviders(<VatDeclaration />);
    await screen.findByText(/Momsdeklaration/);
    expect(screen.getByText("Exportera CSV")).toBeInTheDocument();
    expect(screen.getByText("Exportera PDF")).toBeInTheDocument();
    expect(screen.getByText("Skriv ut")).toBeInTheDocument();
  });
});
