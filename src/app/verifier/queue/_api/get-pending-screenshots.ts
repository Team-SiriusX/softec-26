// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export type ScreenshotQueueItem = {
  id: string;
  shiftLogId: string;
  verifierId: string | null;
  fileUrl: string;
  fileKey: string;
  status: 'PENDING' | 'CONFIRMED' | 'FLAGGED' | 'UNVERIFIABLE';
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

type ScreenshotsResponse = {
  data: ScreenshotQueueItem[];
};

export const useGetPendingScreenshots = () => {
  return useQuery<ScreenshotsResponse>({
    queryKey: [QUERY_KEYS.SCREENSHOTS, 'pending'],
    queryFn: async () => {
      const response = await client.api.screenshots.$get({
        query: { status: 'PENDING' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending screenshots');
      }

      return (await response.json()) as ScreenshotsResponse;
    },
  });
};
