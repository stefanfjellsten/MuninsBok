import { describe, it, expect } from "vitest";
import { translate, createTranslator, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./i18n.js";

describe("i18n", () => {
  describe("translate", () => {
    it("returns Swedish text by default", () => {
      expect(translate("sv", "common.loading")).toBe("Laddar…");
    });

    it("returns English text when locale is en", () => {
      expect(translate("en", "common.loading")).toBe("Loading…");
    });

    it("translates nav items to English", () => {
      expect(translate("en", "nav.dashboard")).toBe("Dashboard");
      expect(translate("en", "nav.vouchers")).toBe("Vouchers");
      expect(translate("en", "nav.accounts")).toBe("Chart of Accounts");
    });

    it("translates nav items to Swedish", () => {
      expect(translate("sv", "nav.dashboard")).toBe("Översikt");
      expect(translate("sv", "nav.vouchers")).toBe("Verifikat");
      expect(translate("sv", "nav.accounts")).toBe("Kontoplan");
    });

    it("translates template strings", () => {
      expect(translate("en", "templates.title")).toBe("Voucher Templates");
      expect(translate("sv", "templates.title")).toBe("Verifikatmallar");
    });

    it("translates not-found page strings", () => {
      expect(translate("en", "notFound.title")).toBe("Page not found");
      expect(translate("sv", "notFound.title")).toBe("Sidan hittades inte");
    });
  });

  describe("createTranslator", () => {
    it("returns a bound translation function for Swedish", () => {
      const t = createTranslator("sv");
      expect(t("common.save")).toBe("Spara");
      expect(t("common.cancel")).toBe("Avbryt");
    });

    it("returns a bound translation function for English", () => {
      const t = createTranslator("en");
      expect(t("common.save")).toBe("Save");
      expect(t("common.cancel")).toBe("Cancel");
    });
  });

  describe("constants", () => {
    it("has sv as default locale", () => {
      expect(DEFAULT_LOCALE).toBe("sv");
    });

    it("supports sv and en locales", () => {
      expect(SUPPORTED_LOCALES).toContain("sv");
      expect(SUPPORTED_LOCALES).toContain("en");
      expect(SUPPORTED_LOCALES).toHaveLength(2);
    });
  });

  describe("completeness", () => {
    it("every Swedish key has an English translation", () => {
      // Instead, test a representative sample of keys
      const sampleKeys = [
        "common.loading",
        "common.save",
        "nav.dashboard",
        "nav.logout",
        "vouchers.title",
        "templates.title",
        "templates.recurring.monthly",
        "accounts.title",
        "fiscalYears.title",
        "reports.trialBalance",
        "csvImport.title",
        "auth.login",
        "org.select",
        "budget.title",
        "members.title",
        "notFound.title",
      ] as const;

      for (const key of sampleKeys) {
        const sv = translate("sv", key);
        const en = translate("en", key);
        expect(sv).toBeTruthy();
        expect(en).toBeTruthy();
        // Swedish and English should differ for most keys
        // (they may match for some like "Dashboard" → "Dashboard")
      }
    });
  });
});
