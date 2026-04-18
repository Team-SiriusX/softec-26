import { Context } from 'hono';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const CERT_SERVICE_URLS = [
  process.env.CERTIFICATE_SERVICE_URL,
  'http://127.0.0.1:8004',
  'http://127.0.0.1:8002',
]
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter((value, index, array) => array.indexOf(value) === index);

function shouldRetry(status: number): boolean {
  return status >= 500;
}

async function fetchFromCertificateService(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  let lastResponse: Response | null = null;

  for (const baseUrl of CERT_SERVICE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);

      if (!shouldRetry(response.status)) {
        return response;
      }

      lastResponse = response;
    } catch {
      // Try next URL when current endpoint is unavailable.
    }
  }

  return lastResponse;
}

export async function generateCertificate(c: Context) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();

  try {
    const payload = JSON.stringify({
      worker_id: session.user.id,
      from_date: body.from_date,
      to_date: body.to_date,
      include_unverified: body.include_unverified ?? false,
    });

    const res = await fetchFromCertificateService('/certificate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!res) {
      return c.json({ error: 'certificate_service_unavailable' }, 503);
    }

    if (res.status === 404) {
      return c.json({ error: 'Worker not found' }, 404);
    }

    if (!res.ok) {
      return c.json({ error: 'certificate_service_unavailable' }, 503);
    }

    return c.json(await res.json(), 200);
  } catch (error) {
    console.error('generateCertificate error:', error);
    return c.json({ error: 'certificate_service_unavailable' }, 503);
  }
}

export async function previewCertificate(c: Context) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const workerId = session.user.id;
  const fromDate = c.req.query('from_date');
  const toDate = c.req.query('to_date');
  const includeUnverified = c.req.query('include_unverified') === 'true';
  const autoPrint = c.req.query('auto_print') === 'true';

  if (!fromDate || !toDate) {
    return new Response('from_date and to_date required', { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      worker_id: workerId,
      from_date: fromDate,
      to_date: toDate,
      include_unverified: String(includeUnverified),
      auto_print: String(autoPrint),
    });

    const res = await fetchFromCertificateService(`/certificate/preview?${params}`, {
      method: 'GET',
    });

    if (!res) {
      return new Response('certificate_service_unavailable', { status: 503 });
    }

    if (!res.ok) {
      return new Response('certificate_service_unavailable', { status: 503 });
    }

    const html = await res.text();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('previewCertificate error:', error);
    return new Response('certificate_service_unavailable', { status: 503 });
  }
}

export async function sampleCertificate(c: Context) {
  try {
    const res = await fetchFromCertificateService('/certificate/sample', {
      method: 'GET',
    });

    if (!res) {
      return new Response('certificate_service_unavailable', { status: 503 });
    }

    if (!res.ok) {
      return new Response('certificate_service_unavailable', { status: 503 });
    }

    const html = await res.text();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('sampleCertificate error:', error);
    return new Response('certificate_service_unavailable', { status: 503 });
  }
}

export async function verifyCertificate(c: Context) {
  const certificateId = c.req.param('certificateId');

  if (!certificateId) {
    return c.json({ error: 'certificate_id_required' }, 400);
  }

  try {
    const res = await fetchFromCertificateService(
      `/certificate/verify/${encodeURIComponent(certificateId)}`,
      {
        method: 'GET',
      },
    );

    if (!res) {
      return c.json({ error: 'certificate_service_unavailable' }, 503);
    }

    if (!res.ok) {
      return c.json({ error: 'certificate_service_unavailable' }, 503);
    }

    return c.json(await res.json(), 200);
  } catch (error) {
    console.error('verifyCertificate error:', error);
    return c.json({ error: 'certificate_service_unavailable' }, 503);
  }
}
