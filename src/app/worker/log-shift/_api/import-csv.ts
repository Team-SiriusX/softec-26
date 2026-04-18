// FairGig scaffold — implement logic here
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';
import { toast } from 'sonner';

type ResponseType = InferResponseType<typeof client.api.shifts.import.$post>;
type RequestType = InferRequestType<
  typeof client.api.shifts.import.$post
> extends { json: infer J }
  ? J
  : never;

export const useImportShiftsCsv = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.shifts.import.$post({ json });

      if (!response.ok) {
        throw new Error('Failed to import shifts');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SHIFTS] });
      toast.success('CSV imported successfully');
    },
    onError: () => {
      toast.error('Failed to import CSV');
    },
  });
};
