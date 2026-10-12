
import { z } from 'zod';

export const envSchema = z
    .object({
        // Application environment
        NODE_ENV: z
            .enum([
                'development',
                'test',
                'production',
            ])
            .default('development'),

        // Application port
        PORT: z.coerce
            .number()
            .int()
            .min(1)
            .max(65535)
            .default(3001),

        // PostgreSQL configuration
        DB_HOST: z
            .string()
            .min(1),

        DB_PORT: z.coerce
            .number()
            .int()
            .min(1)
            .max(65535)
            .default(5432),

        DB_USERNAME: z
            .string()
            .min(1),

        DB_PASSWORD: z
            .string()
            .min(1),

        DB_DATABASE: z
            .string()
            .min(1),

        // JWT authentication
        JWT_SECRET: z
            .string()
            .min(32),
    })
    .passthrough();

export type Env = z.infer<typeof envSchema>;
