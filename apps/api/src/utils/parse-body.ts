/**
 * Zod body/query parser that throws AppError on validation failure.
 *
 * Replaces the repetitive 3-line `safeParse` → `if (!ok) reply.400` pattern
 * in every route with a single function call:
 *
 *   const data = parseBody(createVoucherSchema, request.body);
 *
 * If parsing fails, an AppError with VALIDATION_ERROR is thrown and the
 * global error handler formats the response.
 */
import type { ZodType, ZodIssue, infer as ZodInfer } from "zod";
import { AppError } from "./app-error.js";

/** Format Zod issues into a concise human-readable string. */
function formatIssues(issues: ZodIssue[]): string {
  return issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

/**
 * Parse `data` against a Zod schema.
 * @throws {AppError} with `VALIDATION_ERROR` code on failure.
 */
export function parseBody<T extends ZodType>(schema: T, data: unknown): ZodInfer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw AppError.validation(formatIssues(result.error.issues));
  }
  return result.data;
}
