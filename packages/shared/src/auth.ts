import { z } from "zod";

// Shared by the login/signup forms now and the Better Auth handlers later.
export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .string()
  .trim()
  .min(1, "Enter your work email.")
  .pipe(z.email("Enter a valid email address, like fahim@studio.dev."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your full name."),
    email,
    password: z
      .string()
      .min(1, "Create a password.")
      .min(PASSWORD_MIN_LENGTH, `Use ${PASSWORD_MIN_LENGTH} or more characters.`),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
