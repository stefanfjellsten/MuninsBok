/**
 * Reusable Zod field definitions.
 *
 * Building blocks that avoid repeating constraint logic across schemas.
 */
import { z } from "zod";
import { ACCOUNT_NUMBER_PATTERN } from "@muninsbok/core/types";

/** 4-digit account number (1000–8999). */
export const accountNumberField = z
  .string()
  .regex(ACCOUNT_NUMBER_PATTERN, "Kontonummer måste vara 4 siffror (1000-8999)");

/** Account type enum matching the core domain. */
export const accountTypeEnum = z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);

/** Generic name field – 1‥255 characters. */
export const nameField = z.string().min(1).max(255);

/** ISO date string → Date transform. */
export const dateTransform = z.string().transform((s) => new Date(s));
