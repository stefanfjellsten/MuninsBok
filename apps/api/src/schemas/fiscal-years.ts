import { z } from "zod";
import { dateTransform } from "./fields.js";

export const createFiscalYearSchema = z.object({
  startDate: dateTransform,
  endDate: dateTransform,
});

export const openingBalancesSchema = z.object({
  previousFiscalYearId: z.string(),
});

export const resultDispositionSchema = z.object({
  closedFiscalYearId: z.string(),
});
