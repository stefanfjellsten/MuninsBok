import { AppError } from "../utils/app-error.js";

export type BankAdapterErrorCode =
  | "ADAPTER_UNAUTHORIZED"
  | "ADAPTER_RATE_LIMITED"
  | "ADAPTER_TEMPORARY"
  | "ADAPTER_INVALID_REQUEST"
  | "ADAPTER_NOT_FOUND"
  | "ADAPTER_UNAVAILABLE"
  | "ADAPTER_CONFLICT"
  | "ADAPTER_UNKNOWN";

export class BankAdapterError extends Error {
  constructor(
    public readonly code: BankAdapterErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "BankAdapterError";
  }
}

export interface AdapterBankTransaction {
  externalTransactionId: string;
  bookedAt: Date;
  valueDate?: Date;
  description: string;
  amountOre: number;
  currency: string;
  reference?: string;
  counterpartyName?: string;
  rawData?: unknown;
}

export interface AdapterAuthInitInput {
  organizationId: string;
  connectionExternalId: string;
  redirectUri: string;
  state: string;
}

export interface AdapterAuthInitResult {
  authorizationUrl: string;
  state: string;
  expiresAt: Date;
}

export interface AdapterAuthCodeExchangeInput {
  code: string;
  redirectUri: string;
}

export interface AdapterTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: "Bearer";
  scope?: string[];
}

export interface AdapterFetchTransactionsInput {
  externalConnectionId: string;
  accessToken: string;
  fromDate?: Date;
  toDate?: Date;
  cursor?: string;
  pageSize?: number;
}

export interface AdapterFetchTransactionsResult {
  transactions: AdapterBankTransaction[];
  nextCursor?: string;
}

export interface IAggregatorBankAdapter {
  readonly provider: string;
  createAuthorizationUrl(input: AdapterAuthInitInput): Promise<AdapterAuthInitResult>;
  exchangeAuthorizationCode(input: AdapterAuthCodeExchangeInput): Promise<AdapterTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<AdapterTokenSet>;
  fetchTransactions(input: AdapterFetchTransactionsInput): Promise<AdapterFetchTransactionsResult>;
}

export interface BankAdapterResultError {
  code: string;
  message: string;
  retryable: boolean;
}

function isRetryable(code: BankAdapterErrorCode): boolean {
  return code === "ADAPTER_RATE_LIMITED" || code === "ADAPTER_TEMPORARY";
}

export function toBankAdapterResultError(error: unknown): BankAdapterResultError {
  if (error instanceof BankAdapterError) {
    return {
      code: error.code,
      message: error.message,
      retryable: isRetryable(error.code),
    };
  }

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.statusCode >= 500,
    };
  }

  return {
    code: "ADAPTER_UNKNOWN",
    message: "Okänt adapterfel",
    retryable: false,
  };
}

export function toBankAdapterAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof BankAdapterError) {
    switch (error.code) {
      case "ADAPTER_UNAUTHORIZED":
        return new AppError(401, error.code, error.message);
      case "ADAPTER_INVALID_REQUEST":
        return AppError.badRequest(error.message, error.code);
      case "ADAPTER_NOT_FOUND":
        return new AppError(404, error.code, error.message);
      case "ADAPTER_CONFLICT":
        return new AppError(409, error.code, error.message);
      case "ADAPTER_RATE_LIMITED":
        return new AppError(429, error.code, error.message);
      case "ADAPTER_TEMPORARY":
      case "ADAPTER_UNAVAILABLE":
        return new AppError(503, error.code, error.message);
      default:
        return new AppError(502, "ADAPTER_UNKNOWN", "Fel från bankleverantören");
    }
  }

  return AppError.internal("Okänt bankadapterfel");
}
