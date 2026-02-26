import { z } from "zod";

const memberRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const addMemberSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  role: memberRoleEnum.default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  role: memberRoleEnum,
});
