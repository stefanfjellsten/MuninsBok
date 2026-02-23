/**
 * Dependency injection types for API routes.
 * Routes depend on interfaces (from @muninsbok/core), not concrete classes.
 */
import type {
  IOrganizationRepository,
  IAccountRepository,
  IVoucherRepository,
  IFiscalYearRepository,
  IDocumentRepository,
} from "@muninsbok/core/types";
import {
  type PrismaClient,
  OrganizationRepository,
  AccountRepository,
  VoucherRepository,
  FiscalYearRepository,
  DocumentRepository,
} from "@muninsbok/db";

export interface Repositories {
  readonly organizations: IOrganizationRepository;
  readonly accounts: IAccountRepository;
  readonly vouchers: IVoucherRepository;
  readonly fiscalYears: IFiscalYearRepository;
  readonly documents: IDocumentRepository;
  readonly prisma: PrismaClient;
}

/** Create production repositories from a PrismaClient instance */
export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    organizations: new OrganizationRepository(prisma),
    accounts: new AccountRepository(prisma),
    vouchers: new VoucherRepository(prisma),
    fiscalYears: new FiscalYearRepository(prisma),
    documents: new DocumentRepository(prisma),
    prisma,
  };
}
