import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

const app = new Hono()
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        name: z.string().optional(),
      }),
    ),
    (c) => {
      const { name } = c.req.valid('query');

      return c.json({
        message: `Hello ${name ?? 'UNKNOWN'}`,
      });
    },
  )
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        name: z.string().optional(),
      }),
    ),
    (c) => {
      const { name } = c.req.valid('json');

      const id = Math.floor(Math.random() * 1000);

      return c.json({
        data: { id, name },
        message: `User with name ${name ?? 'UNKNOWN'} created!`,
      });
    },
  )
  .delete(
    '/:id',
    zValidator(
      'param',
      z.object({
        id: z.string().optional(),
      }),
    ),
    (c) => {
      const { id } = c.req.valid('param');

      if (!id) {
        return c.json({ message: 'ID is required' }, 400);
      }

      return c.json({
        message: `Deleted item with id ${id}`,
      });
    },
  );

export default app;
