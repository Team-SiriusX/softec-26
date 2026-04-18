// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetCertificate = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.CERTIFICATES, id],
    enabled: !!id,
    queryFn: async () => {
      const response = await client.api.certificates.sample.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch certificate');
      }

      return response.text();
    },
  });
};
