import { Context } from 'hono';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const CERT_SERVICE_URL = process.env.CERTIFICATE_SERVICE_URL || 'http://localhost:8004';

export async function generateCertificate(c: Context) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();

  try {
    const res = await fetch(`${CERT_SERVICE_URL}/certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        worker_id: session.user.id,
        from_date: body.from_date,
        to_date: body.to_date,
        include_unverified: body.include_unverified ?? false,
      }),
    });

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

  if (!fromDate || !toDate) {
    return new Response('from_date and to_date required', { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      worker_id: workerId,
      from_date: fromDate,
      to_date: toDate,
      include_unverified: String(includeUnverified),
    });

    const res = await fetch(`${CERT_SERVICE_URL}/certificate/preview?${params}`, {
      method: 'GET',
    });

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
    const res = await fetch(`${CERT_SERVICE_URL}/certificate/sample`, {
      method: 'GET',
    });

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
