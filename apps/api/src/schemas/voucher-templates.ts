import { z } from "zod";
import { accountNumberField } from "./fields.js";

export const createVoucherTemplateLineSchema = z.object({
  accountNumber: accountNumberField,
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
  description: z.string().max(500).optional(),
});

export const createVoucherTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  lines: z.array(createVoucherTemplateLineSchema).min(1),
});

export const updateVoucherTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  lines: z.array(createVoucherTemplateLineSchema).min(1).optional(),
});
