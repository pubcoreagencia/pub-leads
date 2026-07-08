import { z } from "zod";

export type AuthMode = "login" | "register" | "forgot-password";

export const authFormSchema = z
  .object({
    name: z.string().trim().optional(),
    email: z.string().trim().email("Informe um email valido."),
    password: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (values.name !== undefined && values.name.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe seu nome.",
        path: ["name"],
      });
    }

    if (values.password !== undefined && values.password.length < 6) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A senha deve ter pelo menos 6 caracteres.",
        path: ["password"],
      });
    }
  });

export type AuthFormValues = z.infer<typeof authFormSchema>;

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
