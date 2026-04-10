import { z } from "zod";

/** At least one lowercase, one uppercase, one digit, and one special character. */
const passwordSchema = z
  .string()
  .min(10, "Lösenordet måste vara minst 10 tecken")
  .max(128, "Lösenordet får vara max 128 tecken")
  .regex(/[a-z]/, "Lösenordet måste innehålla minst en liten bokstav")
  .regex(/[A-Z]/, "Lösenordet måste innehålla minst en stor bokstav")
  .regex(/\d/, "Lösenordet måste innehålla minst en siffra")
  .regex(/[^a-zA-Z0-9]/, "Lösenordet måste innehålla minst ett specialtecken");

export const registerSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  name: z.string().min(1, "Namn krävs").max(200),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(1, "Lösenord krävs"),
});
