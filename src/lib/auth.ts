import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const client = new PrismaClient({
  adapter,
});

export const auth = betterAuth({
  database: prismaAdapter(client, { provider: 'postgresql' }),
  session: {
    cookieCache: {
      enabled: true,
      strategy: 'jwt',
    },
  },
  user: {
    fields: {
      name: 'fullName',
      emailVerified: 'isActive',
      role: 'role',
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
