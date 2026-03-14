import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ICustomerRepository,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerError,
  Result,
} from "@muninsbok/core/types";
import { ok, err } from "@muninsbok/core/types";
import { toCustomer } from "../mappers.js";

export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<Customer[]> {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId },
      orderBy: { customerNumber: "asc" },
    });
    return customers.map(toCustomer);
  }

  async findById(id: string, organizationId: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
    });
    return customer ? toCustomer(customer) : null;
  }

  async getNextCustomerNumber(organizationId: string): Promise<number> {
    const last = await this.prisma.customer.findFirst({
      where: { organizationId },
      orderBy: { customerNumber: "desc" },
      select: { customerNumber: true },
    });
    return (last?.customerNumber ?? 0) + 1;
  }

  async create(
    organizationId: string,
    input: CreateCustomerInput,
  ): Promise<Result<Customer, CustomerError>> {
    const customerNumber = await this.getNextCustomerNumber(organizationId);

    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        customerNumber,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        postalCode: input.postalCode ?? null,
        city: input.city ?? null,
        country: input.country ?? "SE",
        orgNumber: input.orgNumber ?? null,
        vatNumber: input.vatNumber ?? null,
        reference: input.reference ?? null,
        paymentTermDays: input.paymentTermDays ?? 30,
      },
    });

    return ok(toCustomer(customer));
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateCustomerInput,
  ): Promise<Result<Customer, CustomerError>> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return err({ code: "NOT_FOUND", message: "Kunden hittades inte" });
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.orgNumber !== undefined && { orgNumber: input.orgNumber }),
        ...(input.vatNumber !== undefined && { vatNumber: input.vatNumber }),
        ...(input.reference !== undefined && { reference: input.reference }),
        ...(input.paymentTermDays !== undefined && { paymentTermDays: input.paymentTermDays }),
      },
    });

    return ok(toCustomer(customer));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return false;

    await this.prisma.customer.delete({ where: { id } });
    return true;
  }
}
