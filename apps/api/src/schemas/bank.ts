import { z } from "zod";

export const bankConnectInitSchema = z.object({
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
});

export const bankConnectCallbackSchema = z.object({
  code: z.string().min(1),
  externalConnectionId: z.string().min(1),
  redirectUri: z.string().url(),
  displayName: z.string().optional(),
});

export const bankSyncBodySchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});
