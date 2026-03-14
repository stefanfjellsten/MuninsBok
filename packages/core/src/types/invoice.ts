export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "CREDITED";

export interface InvoiceLine {
  readonly id: string;
  readonly invoiceId: string;
  readonly description: string;
  /** Quantity × 100 (e.g. 100 = 1.00, 250 = 2.50) */
  readonly quantity: number;
  /** Unit price in öre */
  readonly unitPrice: number;
  /** VAT rate as percentage × 100 (e.g. 2500 = 25%) */
  readonly vatRate: number;
  /** Line amount excl. VAT in öre */
  readonly amount: number;
  readonly accountNumber?: string | undefined;
}

export interface Invoice {
  readonly id: string;
  readonly organizationId: string;
  readonly customerId: string;
  readonly invoiceNumber: number;
  readonly status: InvoiceStatus;
  readonly issueDate: Date;
  readonly dueDate: Date;
  readonly paidDate?: Date | undefined;
  readonly ourReference?: string | undefined;
  readonly yourReference?: string | undefined;
  readonly notes?: string | undefined;
  /** Subtotal excl. VAT in öre */
  readonly subtotal: number;
  /** VAT amount in öre */
  readonly vatAmount: number;
  /** Total incl. VAT in öre */
  readonly totalAmount: number;
  readonly voucherId?: string | undefined;
  readonly creditedInvoiceId?: string | undefined;
  readonly sentAt?: Date | undefined;
  readonly lines: readonly InvoiceLine[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateInvoiceLineInput {
  readonly description: string;
  /** Quantity × 100 (e.g. 100 = 1.00) */
  readonly quantity: number;
  /** Unit price in öre */
  readonly unitPrice: number;
  /** VAT rate as percentage × 100 (e.g. 2500 = 25%) */
  readonly vatRate: number;
  readonly accountNumber?: string | undefined;
}

export interface CreateInvoiceInput {
  readonly customerId: string;
  readonly issueDate: Date;
  readonly dueDate: Date;
  readonly ourReference?: string | undefined;
  readonly yourReference?: string | undefined;
  readonly notes?: string | undefined;
  readonly lines: readonly CreateInvoiceLineInput[];
}

export interface UpdateInvoiceInput {
  readonly customerId?: string | undefined;
  readonly issueDate?: Date | undefined;
  readonly dueDate?: Date | undefined;
  readonly ourReference?: string | undefined;
  readonly yourReference?: string | undefined;
  readonly notes?: string | undefined;
  readonly lines?: readonly CreateInvoiceLineInput[] | undefined;
}

export type InvoiceErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "EMPTY_LINES"
  | "NOT_DRAFT"
  | "ALREADY_PAID"
  | "ALREADY_CANCELLED"
  | "DUPLICATE_INVOICE_NUMBER";

export interface InvoiceError {
  readonly code: InvoiceErrorCode;
  readonly message: string;
}
