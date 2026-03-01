import { describe, it, expect } from "vitest";
import { validateTemplateLine, validateVoucherTemplate } from "./voucher-template.js";
import type {
  CreateVoucherTemplateLineInput,
  CreateVoucherTemplateInput,
} from "./voucher-template.js";

// ── validateTemplateLine ────────────────────────────────────

describe("validateTemplateLine", () => {
  describe("valid lines", () => {
    it("should accept debit-only line", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "1910",
        debit: 10000,
        credit: 0,
      };
      expect(validateTemplateLine(line)).toBeNull();
    });

    it("should accept credit-only line", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "3000",
        debit: 0,
        credit: 10000,
      };
      expect(validateTemplateLine(line)).toBeNull();
    });

    it("should accept line with description", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "5010",
        debit: 500000,
        credit: 0,
        description: "Kontorshyra",
      };
      expect(validateTemplateLine(line)).toBeNull();
    });
  });

  describe("invalid lines", () => {
    it("should reject negative debit", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "1910",
        debit: -100,
        credit: 0,
      };
      const error = validateTemplateLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("NEGATIVE_AMOUNT");
    });

    it("should reject negative credit", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "1910",
        debit: 0,
        credit: -100,
      };
      const error = validateTemplateLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("NEGATIVE_AMOUNT");
    });

    it("should reject both debit and credit", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "1910",
        debit: 100,
        credit: 200,
      };
      const error = validateTemplateLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("BOTH_DEBIT_AND_CREDIT");
    });

    it("should reject zero debit and zero credit", () => {
      const line: CreateVoucherTemplateLineInput = {
        accountNumber: "1910",
        debit: 0,
        credit: 0,
      };
      const error = validateTemplateLine(line);
      expect(error).not.toBeNull();
      expect(error!.code).toBe("ZERO_AMOUNT");
    });
  });
});

// ── validateVoucherTemplate ─────────────────────────────────

describe("validateVoucherTemplate", () => {
  const validLine: CreateVoucherTemplateLineInput = {
    accountNumber: "1910",
    debit: 10000,
    credit: 0,
  };

  it("should accept valid template with one line", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Månadshyra",
      lines: [validLine],
    };
    expect(validateVoucherTemplate(input)).toBeNull();
  });

  it("should accept valid template with description and multiple lines", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Hyra",
      description: "Hyra kontor Storgatan 1",
      lines: [
        { accountNumber: "5010", debit: 500000, credit: 0 },
        { accountNumber: "1930", debit: 0, credit: 500000 },
      ],
    };
    expect(validateVoucherTemplate(input)).toBeNull();
  });

  it("should reject empty name", () => {
    const input: CreateVoucherTemplateInput = {
      name: "",
      lines: [validLine],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("NAME_REQUIRED");
  });

  it("should reject whitespace-only name", () => {
    const input: CreateVoucherTemplateInput = {
      name: "   ",
      lines: [validLine],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("NAME_REQUIRED");
  });

  it("should reject no lines", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Tom",
      lines: [],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("NO_LINES");
  });

  it("should reject invalid line (both debit and credit)", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Felaktig",
      lines: [{ accountNumber: "1910", debit: 100, credit: 200 }],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("INVALID_LINE");
  });

  it("should reject invalid line (zero amounts)", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Noll",
      lines: [{ accountNumber: "1910", debit: 0, credit: 0 }],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("INVALID_LINE");
  });

  it("should reject invalid line (negative)", () => {
    const input: CreateVoucherTemplateInput = {
      name: "Negativ",
      lines: [{ accountNumber: "1910", debit: -500, credit: 0 }],
    };
    const error = validateVoucherTemplate(input);
    expect(error).not.toBeNull();
    expect(error!.code).toBe("INVALID_LINE");
  });
});
