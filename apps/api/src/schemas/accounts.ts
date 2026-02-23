import { z } from "zod";
import { accountNumberField, accountTypeEnum, nameField } from "./fields.js";

export const createAccountSchema = z.object({
  number: accountNumberField,
  name: nameField,
  type: accountTypeEnum,
  isVatAccount: z.boolean().optional(),
});

export const updateAccountSchema = z.object({
  name: nameField.optional(),
  type: accountTypeEnum.optional(),
  isVatAccount: z.boolean().optional(),
});
