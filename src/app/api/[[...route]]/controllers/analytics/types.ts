import type { Role, WorkerCategory } from '@/generated/prisma/client';

export type NumericLike =
  | number
  | string
  | bigint
  | null
  | undefined
  | {
      toNumber?: () => number;
      toString?: () => string;
    };

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

export type WorkerContext = {
  id: string;
  cityZone: string | null;
  category: WorkerCategory | null;
  role: Role;
};

export type AnalyticsEnv = {
  Variables: {
    user: SessionUser;
    targetUserId?: string;
  };
};
