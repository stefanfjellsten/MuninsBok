import { describe, it, expect } from "vitest";
import {
  calculateLineAmount,
  calculateLineVat,
  calculateInvoiceTotals,
  canTransitionTo,
} from "./engine.js";

describe("calculateLineAmount", () => {
  it("calculates amount for integer quantity", () => {
    // quantity 100 = 1.00, unitPrice 10000 öre = 100 kr
    expect(calculateLineAmount(100, 10000)).toBe(10000);
  });

  it("calculates amount for fractional quantity", () => {
    // quantity 250 = 2.50, unitPrice 20000 öre = 200 kr → 50000 öre = 500 kr
    expect(calculateLineAmount(250, 20000)).toBe(50000);
  });

  it("returns 0 for zero quantity", () => {
    expect(calculateLineAmount(0, 10000)).toBe(0);
  });

  it("rounds to nearest öre", () => {
    // quantity 333 = 3.33, unitPrice 100 öre = 1 kr → 333 öre
    expect(calculateLineAmount(333, 100)).toBe(333);
  });
});

describe("calculateLineVat", () => {
  it("calculates 25% VAT", () => {
    // 10000 öre × 2500/10000 = 2500 öre
    expect(calculateLineVat(10000, 2500)).toBe(2500);
  });

  it("calculates 12% VAT", () => {
    // 10000 öre × 1200/10000 = 1200 öre
    expect(calculateLineVat(10000, 1200)).toBe(1200);
  });

  it("calculates 6% VAT", () => {
    // 10000 öre × 600/10000 = 600 öre
    expect(calculateLineVat(10000, 600)).toBe(600);
  });

  it("calculates 0% VAT", () => {
    expect(calculateLineVat(10000, 0)).toBe(0);
  });

  it("rounds VAT to nearest öre", () => {
    // 333 öre × 2500/10000 = 83.25 → 83
    expect(calculateLineVat(333, 2500)).toBe(83);
  });
});

describe("calculateInvoiceTotals", () => {
  it("calculates totals for single line", () => {
    const lines = [{ description: "Test", quantity: 100, unitPrice: 10000, vatRate: 2500 }];
    const result = calculateInvoiceTotals(lines);
    expect(result.subtotal).toBe(10000);
    expect(result.vatAmount).toBe(2500);
    expect(result.totalAmount).toBe(12500);
  });

  it("calculates totals for multiple lines", () => {
    const lines = [
      { description: "A", quantity: 200, unitPrice: 5000, vatRate: 2500 },
      { description: "B", quantity: 100, unitPrice: 20000, vatRate: 1200 },
    ];
    const result = calculateInvoiceTotals(lines);
    // A: amount = 2*5000 = 10000, vat = 2500
    // B: amount = 1*20000 = 20000, vat = 2400
    expect(result.subtotal).toBe(30000);
    expect(result.vatAmount).toBe(4900);
    expect(result.totalAmount).toBe(34900);
  });

  it("handles empty lines", () => {
    const result = calculateInvoiceTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it("handles mixed VAT rates", () => {
    const lines = [
      { description: "25%", quantity: 100, unitPrice: 1000, vatRate: 2500 },
      { description: "6%", quantity: 100, unitPrice: 1000, vatRate: 600 },
      { description: "0%", quantity: 100, unitPrice: 1000, vatRate: 0 },
    ];
    const result = calculateInvoiceTotals(lines);
    expect(result.subtotal).toBe(3000);
    expect(result.vatAmount).toBe(250 + 60 + 0);
    expect(result.totalAmount).toBe(3310);
  });
});

describe("canTransitionTo", () => {
  it("allows DRAFT → SENT", () => {
    expect(canTransitionTo("DRAFT", "SENT")).toBe(true);
  });

  it("allows DRAFT → CANCELLED", () => {
    expect(canTransitionTo("DRAFT", "CANCELLED")).toBe(true);
  });

  it("disallows DRAFT → PAID", () => {
    expect(canTransitionTo("DRAFT", "PAID")).toBe(false);
  });

  it("allows SENT → PAID", () => {
    expect(canTransitionTo("SENT", "PAID")).toBe(true);
  });

  it("allows SENT → OVERDUE", () => {
    expect(canTransitionTo("SENT", "OVERDUE")).toBe(true);
  });

  it("allows SENT → CREDITED", () => {
    expect(canTransitionTo("SENT", "CREDITED")).toBe(true);
  });

  it("allows OVERDUE → PAID", () => {
    expect(canTransitionTo("OVERDUE", "PAID")).toBe(true);
  });

  it("disallows PAID → anything", () => {
    expect(canTransitionTo("PAID", "SENT")).toBe(false);
    expect(canTransitionTo("PAID", "CANCELLED")).toBe(false);
  });

  it("disallows CANCELLED → anything", () => {
    expect(canTransitionTo("CANCELLED", "SENT")).toBe(false);
    expect(canTransitionTo("CANCELLED", "PAID")).toBe(false);
  });

  it("disallows CREDITED → anything", () => {
    expect(canTransitionTo("CREDITED", "SENT")).toBe(false);
    expect(canTransitionTo("CREDITED", "PAID")).toBe(false);
  });
});
