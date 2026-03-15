import { describe, expect, it } from "vitest";
import { parseReceiptText, supportsReceiptOcrMimeType } from "./receipt-ocr.js";

describe("receipt OCR parsing", () => {
  it("extracts merchant, date and total from common Swedish receipt text", () => {
    const result = parseReceiptText({
      sourceFilename: "ica-kvitto.jpg",
      mimeType: "image/jpeg",
      confidence: 87,
      extractedText: [
        "ICA Nara Torsgatan",
        "Datum 2025-01-17 14:33",
        "Moms 25% 24,69",
        "Summa att betala 123,45",
      ].join("\n"),
    });

    expect(result.merchantName).toBe("ICA Nara Torsgatan");
    expect(result.transactionDate).toBe("2025-01-17");
    expect(result.totalAmountOre).toBe(12345);
    expect(result.vatAmountOre).toBe(2469);
    expect(result.prefillLines).toHaveLength(2);
  });

  it("marks low-confidence parsing with warnings", () => {
    const result = parseReceiptText({
      sourceFilename: "oklart.jpg",
      mimeType: "image/jpeg",
      confidence: 32,
      extractedText: "KVITTO\nBelopp 99,00",
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.totalAmountOre).toBe(9900);
  });

  it("supports OCR only for image formats in the first version", () => {
    expect(supportsReceiptOcrMimeType("image/jpeg")).toBe(true);
    expect(supportsReceiptOcrMimeType("application/pdf")).toBe(false);
  });
});
