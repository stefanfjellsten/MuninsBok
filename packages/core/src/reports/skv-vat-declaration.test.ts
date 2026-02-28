import { describe, it, expect } from "vitest";
import { calculateSkVatDeclaration } from "./skv-vat-declaration.js";
import type { Voucher } from "../types/voucher.js";
import type { Account } from "../types/account.js";

// ── Shared fixtures ──────────────────────────────────────────

const accounts: Account[] = [
  { number: "1910", name: "Kassa", type: "ASSET", isVatAccount: false, isActive: true },
  { number: "1930", name: "Företagskonto", type: "ASSET", isVatAccount: false, isActive: true },
  {
    number: "2610",
    name: "Utgående moms 25%",
    type: "LIABILITY",
    isVatAccount: true,
    isActive: true,
  },
  {
    number: "2620",
    name: "Utgående moms 12%",
    type: "LIABILITY",
    isVatAccount: true,
    isActive: true,
  },
  {
    number: "2630",
    name: "Utgående moms 6%",
    type: "LIABILITY",
    isVatAccount: true,
    isActive: true,
  },
  { number: "2640", name: "Ingående moms", type: "LIABILITY", isVatAccount: true, isActive: true },
  {
    number: "3001",
    name: "Försäljning 25% moms",
    type: "REVENUE",
    isVatAccount: false,
    isActive: true,
  },
  {
    number: "3002",
    name: "Försäljning 12% moms",
    type: "REVENUE",
    isVatAccount: false,
    isActive: true,
  },
  {
    number: "3003",
    name: "Försäljning 6% moms",
    type: "REVENUE",
    isVatAccount: false,
    isActive: true,
  },
  { number: "4000", name: "Inköp", type: "EXPENSE", isVatAccount: false, isActive: true },
  {
    number: "2440",
    name: "Leverantörsskulder",
    type: "LIABILITY",
    isVatAccount: false,
    isActive: true,
  },
];

function makeVoucher(
  id: string,
  number: number,
  description: string,
  date: string,
  lines: { acc: string; debit: number; credit: number }[],
): Voucher {
  return {
    id,
    fiscalYearId: "fy-2025",
    organizationId: "org-1",
    number,
    date: new Date(date),
    description,
    lines: lines.map((l, i) => ({
      id: `${id}-l${i}`,
      voucherId: id,
      accountNumber: l.acc,
      debit: l.debit,
      credit: l.credit,
    })),
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("calculateSkVatDeclaration", () => {
  describe("basic domestic sales with 25% VAT", () => {
    const vouchers: Voucher[] = [
      // Försäljning 125 kr inkl. moms → 100 kr netto + 25 kr moms
      makeVoucher("v1", 1, "Försäljning 25%", "2025-01-15", [
        { acc: "1910", debit: 12500, credit: 0 },
        { acc: "3001", debit: 0, credit: 10000 },
        { acc: "2610", debit: 0, credit: 2500 },
      ]),
    ];

    it("maps ruta 10 (utgående moms 25%)", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      expect(result.ruta10).toBe(2500);
    });

    it("back-calculates ruta 05 (momspliktig försäljning) from 25% VAT", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // 2500 / 0.25 = 10000 öre
      expect(result.ruta05).toBe(10000);
    });

    it("sets ruta 49 correctly (moms att betala)", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // Utgående 2500, ingående 0 → 2500 att betala
      expect(result.ruta49).toBe(2500);
    });
  });

  describe("multiple VAT rates", () => {
    const vouchers: Voucher[] = [
      // 25% moms: 100 kr netto + 25 kr moms
      makeVoucher("v1", 1, "Försäljning 25%", "2025-01-15", [
        { acc: "1910", debit: 12500, credit: 0 },
        { acc: "3001", debit: 0, credit: 10000 },
        { acc: "2610", debit: 0, credit: 2500 },
      ]),
      // 12% moms: 200 kr netto + 24 kr moms
      makeVoucher("v2", 2, "Försäljning 12%", "2025-01-20", [
        { acc: "1910", debit: 22400, credit: 0 },
        { acc: "3002", debit: 0, credit: 20000 },
        { acc: "2620", debit: 0, credit: 2400 },
      ]),
      // 6% moms: 300 kr netto + 18 kr moms
      makeVoucher("v3", 3, "Försäljning 6%", "2025-01-25", [
        { acc: "1910", debit: 31800, credit: 0 },
        { acc: "3003", debit: 0, credit: 30000 },
        { acc: "2630", debit: 0, credit: 1800 },
      ]),
    ];

    it("maps all three output VAT rates", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      expect(result.ruta10).toBe(2500); // 25%
      expect(result.ruta11).toBe(2400); // 12%
      expect(result.ruta12).toBe(1800); // 6%
    });

    it("back-calculates combined tax base (ruta 05)", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // 2500/0.25 + 2400/0.12 + 1800/0.06 = 10000 + 20000 + 30000 = 60000
      expect(result.ruta05).toBe(60000);
    });

    it("calculates correct ruta 49", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // 2500 + 2400 + 1800 - 0 = 6700
      expect(result.ruta49).toBe(6700);
    });
  });

  describe("input VAT deduction", () => {
    const vouchers: Voucher[] = [
      // Försäljning: 125 kr inkl. moms
      makeVoucher("v1", 1, "Försäljning", "2025-01-15", [
        { acc: "1910", debit: 12500, credit: 0 },
        { acc: "3001", debit: 0, credit: 10000 },
        { acc: "2610", debit: 0, credit: 2500 },
      ]),
      // Inköp: 80 kr + 20 kr ingående moms
      makeVoucher("v2", 2, "Inköp med moms", "2025-01-25", [
        { acc: "4000", debit: 8000, credit: 0 },
        { acc: "2640", debit: 2000, credit: 0 },
        { acc: "2440", debit: 0, credit: 10000 },
      ]),
    ];

    it("maps ruta 48 (ingående moms)", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      expect(result.ruta48).toBe(2000);
    });

    it("calculates net VAT (ruta 49 = output − input)", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // 2500 utgående − 2000 ingående = 500 att betala
      expect(result.ruta49).toBe(500);
    });
  });

  describe("VAT refund (momsfordran)", () => {
    const vouchers: Voucher[] = [
      // Bara inköp → mer ingående än utgående
      makeVoucher("v1", 1, "Stort inköp", "2025-03-01", [
        { acc: "4000", debit: 40000, credit: 0 },
        { acc: "2640", debit: 10000, credit: 0 },
        { acc: "2440", debit: 0, credit: 50000 },
      ]),
    ];

    it("ruta 49 is negative when input VAT exceeds output", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      // Utgående: 0, Ingående: 10000 → −10000 (momsfordran)
      expect(result.ruta49).toBe(-10000);
    });

    it("ruta 05 is 0 when no sales", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      expect(result.ruta05).toBe(0);
    });
  });

  describe("empty period", () => {
    it("returns all zeros for no vouchers", () => {
      const result = calculateSkVatDeclaration([], accounts);
      expect(result.ruta05).toBe(0);
      expect(result.ruta10).toBe(0);
      expect(result.ruta11).toBe(0);
      expect(result.ruta12).toBe(0);
      expect(result.ruta48).toBe(0);
      expect(result.ruta49).toBe(0);
    });

    it("boxes array is empty for no activity", () => {
      const result = calculateSkVatDeclaration([], accounts);
      expect(result.boxes).toHaveLength(0);
    });
  });

  describe("boxes array", () => {
    const vouchers: Voucher[] = [
      makeVoucher("v1", 1, "Försäljning 25%", "2025-01-15", [
        { acc: "1910", debit: 12500, credit: 0 },
        { acc: "3001", debit: 0, credit: 10000 },
        { acc: "2610", debit: 0, credit: 2500 },
      ]),
      makeVoucher("v2", 2, "Inköp", "2025-01-20", [
        { acc: "4000", debit: 8000, credit: 0 },
        { acc: "2640", debit: 2000, credit: 0 },
        { acc: "2440", debit: 0, credit: 10000 },
      ]),
    ];

    it("only includes non-zero boxes", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      const boxNumbers = result.boxes.map((b) => b.box);
      // ruta 05 (tax base), 10 (25% VAT), 48 (input), 49 (result)
      expect(boxNumbers).toEqual([5, 10, 48, 49]);
    });

    it("includes correct labels", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      const box10 = result.boxes.find((b) => b.box === 10);
      expect(box10?.label).toBe("Utgående moms 25 %");
      expect(box10?.amount).toBe(2500);
    });
  });

  describe("EU/special boxes default to zero", () => {
    const vouchers: Voucher[] = [
      makeVoucher("v1", 1, "Försäljning", "2025-01-15", [
        { acc: "1910", debit: 12500, credit: 0 },
        { acc: "3001", debit: 0, credit: 10000 },
        { acc: "2610", debit: 0, credit: 2500 },
      ]),
    ];

    it("EU boxes are all zero", () => {
      const result = calculateSkVatDeclaration(vouchers, accounts);
      expect(result.ruta06).toBe(0);
      expect(result.ruta07).toBe(0);
      expect(result.ruta08).toBe(0);
      expect(result.ruta20).toBe(0);
      expect(result.ruta21).toBe(0);
      expect(result.ruta22).toBe(0);
      expect(result.ruta23).toBe(0);
      expect(result.ruta24).toBe(0);
      expect(result.ruta30).toBe(0);
      expect(result.ruta31).toBe(0);
      expect(result.ruta32).toBe(0);
      expect(result.ruta33).toBe(0);
      expect(result.ruta35).toBe(0);
      expect(result.ruta36).toBe(0);
      expect(result.ruta37).toBe(0);
      expect(result.ruta38).toBe(0);
      expect(result.ruta39).toBe(0);
      expect(result.ruta40).toBe(0);
      expect(result.ruta41).toBe(0);
      expect(result.ruta42).toBe(0);
      expect(result.ruta50).toBe(0);
    });
  });

  describe("generatedAt", () => {
    it("includes a generation timestamp", () => {
      const result = calculateSkVatDeclaration([], accounts);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });
});
