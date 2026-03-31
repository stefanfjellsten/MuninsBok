import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/test-utils";

const {
  mockGetVoucherDocuments,
  mockUploadDocument,
  mockDeleteDocument,
  mockGetReceiptOcrStatus,
  mockAnalyzeOcr,
  mockDownloadDocumentUrl,
} = vi.hoisted(() => ({
  mockGetVoucherDocuments: vi.fn(),
  mockUploadDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
  mockGetReceiptOcrStatus: vi.fn(),
  mockAnalyzeOcr: vi.fn(),
  mockDownloadDocumentUrl: vi.fn(),
}));

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getVoucherDocuments: mockGetVoucherDocuments,
      uploadDocument: mockUploadDocument,
      deleteDocument: mockDeleteDocument,
      getReceiptOcrStatus: mockGetReceiptOcrStatus,
      analyzeUploadedDocumentReceipt: mockAnalyzeOcr,
      downloadDocumentUrl: mockDownloadDocumentUrl,
    },
  };
});

import { DocumentSection } from "./DocumentSection";

const pngDoc = {
  id: "doc-1",
  organizationId: "org-1",
  voucherId: "v-1",
  filename: "kvitto.png",
  mimeType: "image/png",
  storageKey: "s3/kvitto.png",
  size: 204800,
  createdAt: "2026-01-15T10:00:00Z",
};

const pdfDoc = {
  id: "doc-2",
  organizationId: "org-1",
  voucherId: "v-1",
  filename: "faktura.pdf",
  mimeType: "application/pdf",
  storageKey: "s3/faktura.pdf",
  size: 1048576,
  createdAt: "2026-01-16T10:00:00Z",
};

describe("DocumentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVoucherDocuments.mockResolvedValue({ data: [] });
    mockGetReceiptOcrStatus.mockResolvedValue({
      data: { pdfEnabled: true, supportedMimeTypes: [] },
    });
    mockDownloadDocumentUrl.mockReturnValue("/download/doc-1");
  });

  it("renders heading and loading state", () => {
    mockGetVoucherDocuments.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(screen.getByText("Bifogade dokument")).toBeInTheDocument();
    expect(screen.getByText("Laddar dokument...")).toBeInTheDocument();
  });

  it("shows empty message when no documents", async () => {
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(await screen.findByText("Inga dokument bifogade.")).toBeInTheDocument();
  });

  it("shows PDF-OCR status label", async () => {
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(await screen.findByText(/PDF-OCR: aktiv/)).toBeInTheDocument();
  });

  it("shows PDF-OCR inaktiv when pdfEnabled is false", async () => {
    mockGetReceiptOcrStatus.mockResolvedValue({
      data: { pdfEnabled: false, supportedMimeTypes: [] },
    });
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(await screen.findByText(/PDF-OCR: inaktiv/)).toBeInTheDocument();
  });

  it("renders document list with filenames and sizes", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc, pdfDoc] });
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(await screen.findByText("kvitto.png")).toBeInTheDocument();
    expect(screen.getByText("200 KB")).toBeInTheDocument();
    expect(screen.getByText("faktura.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
  });

  it("renders Tolka button for OCR-supported documents", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc] });
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    expect(await screen.findByText("Tolka")).toBeInTheDocument();
  });

  it("renders delete button for each document", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc, pdfDoc] });
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    await screen.findByText("kvitto.png");
    const deleteButtons = screen.getAllByText("×");
    expect(deleteButtons).toHaveLength(2);
  });

  it("shows file input for uploading", async () => {
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    await screen.findByText("Inga dokument bifogade.");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toBe(".pdf,.jpg,.jpeg,.png,.webp,.heic");
  });

  it("shows OCR analysis result after Tolka click", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc] });
    mockAnalyzeOcr.mockResolvedValue({
      data: {
        sourceFilename: "kvitto.png",
        mimeType: "image/png",
        extractedText: "OCR text here",
        confidence: 92,
        merchantName: "ICA Maxi",
        transactionDate: "2026-01-15",
        totalAmountOre: 34900,
        vatAmountOre: 6980,
        currency: "SEK",
        suggestedDescription: "Inköp ICA Maxi",
        prefillLines: [],
        warnings: [],
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    await screen.findByText("Tolka");
    await user.click(screen.getByText("Tolka"));

    expect(await screen.findByText(/OCR-resultat/)).toBeInTheDocument();
    expect(screen.getByText(/Butik\/leverantor:/)).toBeInTheDocument();
    expect(screen.getByText(/349\.00 kr/)).toBeInTheDocument();
    expect(screen.getByText(/69\.80 kr/)).toBeInTheDocument();
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText("Inköp ICA Maxi")).toBeInTheDocument();
  });

  it("shows OCR warnings when present", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc] });
    mockAnalyzeOcr.mockResolvedValue({
      data: {
        sourceFilename: "kvitto.png",
        mimeType: "image/png",
        extractedText: "text",
        confidence: 50,
        suggestedDescription: "Okänt kvitto",
        prefillLines: [],
        warnings: ["Låg OCR-säkerhet"],
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    await screen.findByText("Tolka");
    await user.click(screen.getByText("Tolka"));

    expect(await screen.findByText("Låg OCR-säkerhet")).toBeInTheDocument();
  });

  it("closes OCR result when Stang button is clicked", async () => {
    mockGetVoucherDocuments.mockResolvedValue({ data: [pngDoc] });
    mockAnalyzeOcr.mockResolvedValue({
      data: {
        sourceFilename: "kvitto.png",
        mimeType: "image/png",
        extractedText: "text",
        confidence: 80,
        suggestedDescription: "Kvitto",
        prefillLines: [],
        warnings: [],
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<DocumentSection organizationId="org-1" voucherId="v-1" />);
    await screen.findByText("Tolka");
    await user.click(screen.getByText("Tolka"));

    await screen.findByText(/OCR-resultat/);
    await user.click(screen.getByText("Stang"));

    await waitFor(() => {
      expect(screen.queryByText(/OCR-resultat/)).not.toBeInTheDocument();
    });
  });
});
