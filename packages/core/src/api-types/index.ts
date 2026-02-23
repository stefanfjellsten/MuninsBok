/**
 * Shared API contract types.
 *
 * These describe the exact JSON shapes exchanged between API server and
 * clients.  Import them in both `@muninsbok/api` (for response typing) and
 * `@muninsbok/web` (for request/response consumption).
 *
 * @example
 * ```ts
 * import type { Organization, ApiResponse } from "@muninsbok/core/api-types";
 * ```
 */

export * from "./entities.js";
export * from "./reports.js";
export * from "./responses.js";
