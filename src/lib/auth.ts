import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, jwt } from 'better-auth/plugins';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const client = new PrismaClient({
  adapter,
});

function resolveTrustedOrigins(): string[] {
  const rawOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '';
  const envOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const primaryOrigin = process.env.BETTER_AUTH_URL?.trim();

  return [
    primaryOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3010',
    'http://127.0.0.1:3010',
    ...envOrigins,
  ].filter((origin, index, all): origin is string => {
    return Boolean(origin) && all.indexOf(origin) === index;
  });
}

export const auth = betterAuth({
  database: prismaAdapter(client, { provider: 'postgresql' }),
  trustedOrigins: resolveTrustedOrigins(),
  session: {
    cookieCache: {
      enabled: true,
      strategy: 'jwt',
    },
  },
  plugins: [jwt(), bearer()],
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'WORKER',
        input: true,
      },
      approvalStatus: {
        type: 'string',
        required: false,
        defaultValue: 'APPROVED',
        input: true,
      },
      fullName: {
        type: 'string',
        required: true,
        input: true,
      },
    },
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
