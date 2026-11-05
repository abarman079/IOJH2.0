import { z } from "zod";

const email = z.email().max(254);
const password = z.string().min(10).max(128);

export const signInSchema = z.object({ email, password: z.string().min(1).max(128) });
export const signUpSchema = z.object({ email, password, confirmPassword: z.string() }).refine(
  (fields) => fields.password === fields.confirmPassword,
  { path: ["confirmPassword"], message: "password_mismatch" },
);
export const recoverSchema = z.object({ email });
export const newPasswordSchema = z.object({ password, confirmPassword: z.string() }).refine(
  (fields) => fields.password === fields.confirmPassword,
  { path: ["confirmPassword"], message: "password_mismatch" },
);
