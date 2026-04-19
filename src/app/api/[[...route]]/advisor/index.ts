import { authMiddleware } from '@/app/api/[[...route]]/middleware/auth-middleware';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

const ADVISOR_SERVICE_URL =
  process.env.ADVISOR_SERVICE_URL ?? 'http://localhost:8001';

const advisorQuerySchema = z.object({
  query: z.string().min(1),
  locale: z.enum(['en', 'ur']).optional().default('en'),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const app = new Hono()
  .use('/*', authMiddleware)
  .post('/query', zValidator('json', advisorQuerySchema), async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${ADVISOR_SERVICE_URL}/advisor/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worker_id: user.id,
          query: body.query,
          locale: body.locale,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const payload = await response.json();
        return c.json(payload, response.status as 200);
      }

      const text = await response.text();
      return c.body(text, response.status as 200, {
        'Content-Type': contentType || 'text/plain',
      });
    } catch {
      clearTimeout(timeout);
      return c.json({ message: 'Advisor service unavailable' }, 503);
    }
  })
  .post('/voice/query', async (c) => {
    try {
      const user = c.get('user');
      if (!user?.id) {
        return c.json({ message: 'Unauthorized' }, 401);
      }

      let formData: FormData;
      try {
        formData = await c.req.formData();
      } catch (error) {
        console.error('Advisor voice formData parse failed:', error);
        return c.json({ message: 'Invalid multipart payload' }, 400);
      }

      const fileEntry = formData.get('file');
      const localeValue = formData.get('locale');
      const locale = typeof localeValue === 'string' && localeValue === 'ur' ? 'ur' : 'en';

      if (!fileEntry || typeof fileEntry === 'string') {
        return c.json({ message: 'Audio file is required' }, 400);
      }

      const fileBlob = fileEntry as Blob;
      const mimeType = typeof fileBlob.type === 'string' ? fileBlob.type : '';
      const fileName =
        'name' in fileEntry && typeof fileEntry.name === 'string' && fileEntry.name.length > 0
          ? fileEntry.name
          : 'voice.webm';

      if (!mimeType.startsWith('audio/')) {
        return c.json({ message: 'Uploaded file must be an audio blob' }, 400);
      }

      const upstreamForm = new FormData();
      upstreamForm.append('worker_id', user.id);
      upstreamForm.append('locale', locale);
      upstreamForm.append('file', fileBlob, fileName);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      try {
        let response: Response;
        try {
          response = await fetch(`${ADVISOR_SERVICE_URL}/advisor/voice/query`, {
            method: 'POST',
            body: upstreamForm,
            signal: controller.signal,
          });
        } catch {
          await sleep(250);
          response = await fetch(`${ADVISOR_SERVICE_URL}/advisor/voice/query`, {
            method: 'POST',
            body: upstreamForm,
            signal: controller.signal,
          });
        }

        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const payload = await response.json();
          return c.json(payload, response.status as 200);
        }

        const text = await response.text();
        return c.body(text, response.status as 200, {
          'Content-Type': contentType || 'text/plain',
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error('Advisor voice proxy failed:', error);
        return c.json({ message: 'Advisor voice service unavailable' }, 503);
      }
    } catch (error) {
      console.error('Advisor voice route unexpected failure:', error);
      return c.json({ message: 'Advisor voice route failed unexpectedly' }, 500);
    }
  });

export default app;
