// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';
import { InferResponseType } from 'hono';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

type ScreenshotsResponse = InferResponseType<typeof client.api.screenshots.$get>;

export type ScreenshotQueueItem = ScreenshotsResponse extends { data: infer T }
  ? T extends Array<infer Item>
    ? Item
    : never
  : never;

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

      return response.json();
    },
  });
};
