import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetCustomers, mockAddToast } = vi.hoisted(() => ({
  mockGetCustomers: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock("../context/OrganizationContext", () => ({
  useOrganization: () => ({
    organization: { id: "org-1", name: "Test AB" },
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../hooks/useDialogFocus", () => ({
  useDialogFocus: () => ({ current: null }),
}));

vi.mock("../components/Dialog.module.css", () => ({ default: {} }));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getCustomers: mockGetCustomers,
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
    },
  };
});

import { Customers } from "./Customers";

const sampleCustomers = {
  data: [
    {
      id: "c-1",
      customerNumber: "1001",
      name: "Acme AB",
      email: "info@acme.se",
      phone: "08-123456",
      address: "Storgatan 1",
      postalCode: "111 11",
      city: "Stockholm",
      orgNumber: "5561234567",
      vatNumber: null,
      reference: "Anna",
      paymentTermDays: 30,
      organizationId: "org-1",
    },
    {
      id: "c-2",
      customerNumber: "1002",
      name: "Beta HB",
      email: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
      orgNumber: null,
      vatNumber: null,
      reference: null,
      paymentTermDays: 15,
      organizationId: "org-1",
    },
  ],
};

describe("Customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetCustomers.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Customers />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("renders heading and new customer button", async () => {
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    renderWithProviders(<Customers />);
    expect(await screen.findByRole("heading", { level: 2, name: "Kunder" })).toBeInTheDocument();
    expect(screen.getByText("+ Ny kund")).toBeInTheDocument();
  });

  it("shows empty state when no customers", async () => {
    mockGetCustomers.mockResolvedValue({ data: [] });
    renderWithProviders(<Customers />);
    expect(await screen.findByText("Inga kunder ännu.")).toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    renderWithProviders(<Customers />);
    await screen.findByText("Acme AB");
    expect(screen.getByText("Kundnr")).toBeInTheDocument();
    expect(screen.getByText("E-post")).toBeInTheDocument();
    expect(screen.getByText("Betalningsvillkor (dagar)")).toBeInTheDocument();
  });

  it("renders customer data in rows", async () => {
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    renderWithProviders(<Customers />);
    expect(await screen.findByText("Acme AB")).toBeInTheDocument();
    expect(screen.getByText("1001")).toBeInTheDocument();
    expect(screen.getByText("info@acme.se")).toBeInTheDocument();
    expect(screen.getByText("Stockholm")).toBeInTheDocument();
    expect(screen.getByText("Beta HB")).toBeInTheDocument();
    expect(screen.getByText("1002")).toBeInTheDocument();
  });

  it("shows dash for null fields", async () => {
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    renderWithProviders(<Customers />);
    await screen.findByText("Beta HB");
    // Beta HB has null email, phone, city — shown as "–"
    const dashes = screen.getAllByText("–");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders edit and delete buttons per customer", async () => {
    mockGetCustomers.mockResolvedValue(sampleCustomers);
    renderWithProviders(<Customers />);
    await screen.findByText("Acme AB");
    expect(screen.getAllByText("Redigera").length).toBe(2);
    expect(screen.getAllByText("Ta bort").length).toBe(2);
  });
});
