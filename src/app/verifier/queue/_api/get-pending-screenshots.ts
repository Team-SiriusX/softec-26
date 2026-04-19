// FairGig scaffold — implement logic here
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export type ScreenshotQueueStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FLAGGED'
  | 'UNVERIFIABLE';

export type ScreenshotQueueItem = {
  id: string;
  shiftLogId: string;
  verifierId: string | null;
  fileUrl: string;
  fileKey: string;
  status: ScreenshotQueueStatus;
  verifierNotes: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
  shiftLog: {
    id: string;
    grossEarned: number | string;
    netReceived: number | string;
    platformDeductions: number | string;
    hoursWorked: number | string;
    platform: {
      name: string;
    };
    worker: {
      id: string;
      fullName: string | null;
      cityZone: string | null;
    };
  };
  verifier?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
};

type QueueMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type ScreenshotsResponse = {
  data: ScreenshotQueueItem[];
  meta: QueueMeta;
  stats: Record<ScreenshotQueueStatus, number>;
};

type UseGetScreenshotsOptions = {
  statuses?: ScreenshotQueueStatus[];
  page?: number;
  pageSize?: number;
};

export const useGetScreenshots = ({
  statuses,
  page = 1,
  pageSize = 8,
}: UseGetScreenshotsOptions = {}) => {
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.min(Math.max(1, pageSize), 50);
  const normalizedStatuses = Array.from(new Set(statuses ?? []));
  const statusParam =
    normalizedStatuses.length > 0 ? normalizedStatuses.join(',') : undefined;

  return useQuery<ScreenshotsResponse>({
    queryKey: [
      QUERY_KEYS.SCREENSHOTS,
      'queue',
      statusParam ?? 'all',
      normalizedPage,
      normalizedPageSize,
    ],
    queryFn: async () => {
      const query: {
        status?: string;
        page: string;
        pageSize: string;
      } = {
        page: String(normalizedPage),
        pageSize: String(normalizedPageSize),
      };

      if (statusParam) {
        query.status = statusParam;
      }

      const response = await client.api.screenshots.$get({
        query,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch screenshots');
      }

      return (await response.json()) as ScreenshotsResponse;
    },
    placeholderData: keepPreviousData,
  });
};

export const useGetPendingScreenshots = () =>
  useGetScreenshots({ statuses: ['PENDING'] });
