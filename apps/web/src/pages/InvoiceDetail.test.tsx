import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/test-utils";

const { mockGetInvoice, mockGetCustomer, mockAddToast } = vi.hoisted(() => ({
  mockGetInvoice: vi.fn(),
  mockGetCustomer: vi.fn(),
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

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getInvoice: mockGetInvoice,
      getCustomer: mockGetCustomer,
      updateInvoiceStatus: vi.fn(),
      deleteInvoice: vi.fn(),
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ invoiceId: "inv-1" }),
    useNavigate: () => vi.fn(),
  };
});

import { InvoiceDetail } from "./InvoiceDetail";

const sampleInvoice = {
  data: {
    id: "inv-1",
    invoiceNumber: "2024-001",
    customerId: "cust-1",
    issueDate: "2024-03-15",
    dueDate: "2024-04-15",
    paidDate: null,
    status: "DRAFT",
    ourReference: "Anna S",
    yourReference: "Erik L",
    notes: "Konsulttjänster",
    lines: [
      {
        id: "line-1",
        description: "Webbutveckling",
        quantity: 1000,
        unitPrice: 95000,
        vatRate: 2500,
        amount: 95000,
      },
    ],
    subtotal: 95000,
    vatAmount: 23750,
    totalAmount: 118750,
  },
};

describe("InvoiceDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCustomer.mockResolvedValue({ data: { id: "cust-1", name: "Kund AB" } });
  });

  it("shows loading state", () => {
    mockGetInvoice.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<InvoiceDetail />);
    expect(screen.getByText("Laddar…")).toBeInTheDocument();
  });

  it("shows error if no data", async () => {
    mockGetInvoice.mockResolvedValue(undefined);
    renderWithProviders(<InvoiceDetail />);
    expect(await screen.findByText("Ett fel uppstod")).toBeInTheDocument();
  });

  it("renders invoice number heading", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    expect(await screen.findByText(/Fakturanr/)).toBeInTheDocument();
    expect(screen.getByText(/2024-001/)).toBeInTheDocument();
  });

  it("renders customer name and dates", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    expect(await screen.findByText("Kund AB")).toBeInTheDocument();
    expect(screen.getByText(/Fakturadatum/)).toBeInTheDocument();
    expect(screen.getByText(/Förfallodatum/)).toBeInTheDocument();
  });

  it("renders invoice lines table", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    expect(await screen.findByText("Fakturarader")).toBeInTheDocument();
    expect(screen.getByText("Webbutveckling")).toBeInTheDocument();
    expect(screen.getByText(/Beskrivning/)).toBeInTheDocument();
    expect(screen.getByText(/Antal/)).toBeInTheDocument();
  });

  it("renders totals (netto, moms, totalt)", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    await screen.findByText("Webbutveckling");
    expect(screen.getByText("Netto:")).toBeInTheDocument();
    expect(screen.getByText("Moms:")).toBeInTheDocument();
    expect(screen.getByText("Totalt:")).toBeInTheDocument();
  });

  it("renders references and notes", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    await screen.findByText("Webbutveckling");
    expect(screen.getByText("Anna S")).toBeInTheDocument();
    expect(screen.getByText("Erik L")).toBeInTheDocument();
    expect(screen.getByText("Konsulttjänster")).toBeInTheDocument();
  });

  it("shows draft action buttons", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    await screen.findByText("Webbutveckling");
    expect(screen.getByText("Redigera")).toBeInTheDocument();
    expect(screen.getByText("Markera som skickad")).toBeInTheDocument();
    expect(screen.getByText("Makulera")).toBeInTheDocument();
    expect(screen.getByText("Ta bort")).toBeInTheDocument();
  });

  it("shows sent action buttons for SENT status", async () => {
    mockGetInvoice.mockResolvedValue({
      data: { ...sampleInvoice.data, status: "SENT" },
    });
    renderWithProviders(<InvoiceDetail />);
    await screen.findByText("Webbutveckling");
    expect(screen.getByText("Markera som betald")).toBeInTheDocument();
    expect(screen.getByText("Makulera")).toBeInTheDocument();
  });

  it("renders status label", async () => {
    mockGetInvoice.mockResolvedValue(sampleInvoice);
    renderWithProviders(<InvoiceDetail />);
    await screen.findByText("Webbutveckling");
    expect(screen.getByText("Utkast")).toBeInTheDocument();
  });
});
