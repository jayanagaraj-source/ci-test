import { z } from 'zod';

const email = z.email().max(254).transform((value) => value.toLowerCase());

export const registerSchema = z.strictObject({
  email,
  name: z.string().trim().min(1).max(100),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});
