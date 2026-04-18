import { jwtClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [jwtClient()],
  $InferAuth: {
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
  },
});
