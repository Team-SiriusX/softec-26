import { authClient } from '@/lib/auth-client';
import { useQuery } from '@tanstack/react-query';

type DbCurrentUser = {
  id: string;
  email: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  fullName: string;
  phone: string | null;
  cityZone: string | null;
  category:
    | 'RIDE_HAILING'
    | 'FOOD_DELIVERY'
    | 'FREELANCE_DESIGN'
    | 'DOMESTIC_WORK'
    | 'OTHER'
    | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  image: string | null;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

const isDbCurrentUser = (value: unknown): value is DbCurrentUser => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DbCurrentUser>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.isActive === 'boolean'
  );
};

const getErrorMessageFromBody = async (res: Response): Promise<string> => {
  try {
    const payload = (await res.json()) as ErrorResponse;
    return payload.error ?? payload.message ?? 'Failed to fetch current user';
  } catch {
    return 'Failed to fetch current user';
  }
};

export const useCurrentUser = () => {
  const session = authClient.useSession();

  const userQuery = useQuery<DbCurrentUser, Error>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const message = await getErrorMessageFromBody(res);
        throw new Error(message);
      }

      const data: unknown = await res.json();
      if (!isDbCurrentUser(data)) {
        throw new Error('Invalid current user response');
      }

      return data;
    },
    enabled: Boolean(session.data?.session),
  });

  return {
    user: userQuery.data ?? session.data?.user,
    session: session.data?.session,
    isLoading: session.isPending || userQuery.isLoading,
    isRefetching: userQuery.isRefetching,
    error: session.error || userQuery.error,
    refetch: async () => {
      await session.refetch();
      await userQuery.refetch();
    },
  };
};