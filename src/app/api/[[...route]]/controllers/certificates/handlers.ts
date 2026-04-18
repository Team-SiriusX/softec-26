import db from '@/lib/db';
import { Context } from 'hono';

type SessionUser = {
  id: string;
  role: string;
};

function canAccessWorkerData(requester: SessionUser, workerId: string): boolean {
  if (requester.role === 'ADVOCATE' || requester.role === 'VERIFIER') {
    return true;
  }
  return requester.id === workerId;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function defaultCertificateHtml(payload: {
  workerName: string;
  workerId: string;
  fromDate: string;
  toDate: string;
  totalVerified: number;
  shiftCount: number;
  platforms: string[];
  generatedAt: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FairGig Income Certificate</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 24px; color: #111; }
      .sheet { max-width: 880px; margin: 0 auto; border: 2px solid #111; padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0.3px; }
      .muted { color: #555; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin-bottom: 20px; }
      .label { font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 0.6px; }
      .value { font-size: 18px; font-weight: 600; }
      .total { margin: 18px 0; padding: 14px; border: 1px solid #111; }
      .platforms { margin-top: 12px; }
      .platforms li { margin: 4px 0; }
      .footer { margin-top: 28px; font-size: 12px; color: #555; }
      @media print {
        body { padding: 0; }
        .sheet { border: 0; padding: 0; max-width: none; }
      }
    </style>
  </head>
  <body>
    <section class="sheet">
      <h1>FairGig Income Certificate</h1>
      <p class="muted">Printable summary of verified earnings for reporting to third parties.</p>

      <div class="grid">
        <div>
          <div class="label">Worker</div>
          <div class="value">${payload.workerName}</div>
        </div>
        <div>
          <div class="label">Worker ID</div>
          <div class="value">${payload.workerId}</div>
        </div>
        <div>
          <div class="label">Period Start</div>
          <div class="value">${payload.fromDate}</div>
        </div>
        <div>
          <div class="label">Period End</div>
          <div class="value">${payload.toDate}</div>
        </div>
      </div>

      <div class="total">
        <div class="label">Total Verified Income (PKR)</div>
        <div class="value">${payload.totalVerified.toFixed(2)}</div>
        <div class="label" style="margin-top: 10px;">Verified Shifts</div>
        <div class="value">${payload.shiftCount}</div>
      </div>

      <div>
        <div class="label">Platforms Included</div>
        <ul class="platforms">
          ${payload.platforms.map((platform) => `<li>${platform}</li>`).join('')}
        </ul>
      </div>

      <p class="footer">Generated at ${payload.generatedAt}. This certificate includes only earnings with CONFIRMED verification status.</p>
    </section>
  </body>
</html>`;
}

export const getCertificateHandler = async (c: Context) => {
  const requester = c.var.user as SessionUser | undefined;
  if (!requester) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const certificate = await db.incomeCertificate.findUnique({ where: { id } });

  if (!certificate) {
    return c.json({ error: 'Certificate not found' }, 404);
  }

  if (!canAccessWorkerData(requester, certificate.workerId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const format = c.req.query('format');
  if (format === 'html') {
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.body(certificate.htmlSnapshot);
  }

  return c.json({ data: certificate });
};

export const printCertificateHandler = async (c: Context) => {
  const requester = c.var.user as SessionUser | undefined;
  if (!requester) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const certificate = await db.incomeCertificate.findUnique({ where: { id } });

  if (!certificate) {
    return c.json({ error: 'Certificate not found' }, 404);
  }

  if (!canAccessWorkerData(requester, certificate.workerId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  c.header('Content-Type', 'text/html; charset=utf-8');
  return c.body(certificate.htmlSnapshot);
};

export const createCertificateHandler = async (c: Context) => {
  const requester = c.var.user as SessionUser | undefined;
  if (!requester) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json<{
    workerId?: string;
    fromDate: string;
    toDate: string;
  }>();

  const workerId = payload.workerId ?? requester.id;

  if (!canAccessWorkerData(requester, workerId)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const worker = await db.user.findUnique({
    where: { id: workerId },
    select: { id: true, fullName: true },
  });

  if (!worker) {
    return c.json({ error: 'Worker not found' }, 404);
  }

  const fromDate = new Date(payload.fromDate);
  const toDate = new Date(payload.toDate);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return c.json({ error: 'Invalid date range' }, 400);
  }

  const verifiedShifts = await db.shiftLog.findMany({
    where: {
      workerId,
      verificationStatus: 'CONFIRMED',
      shiftDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      platform: {
        select: { name: true },
      },
    },
    orderBy: {
      shiftDate: 'asc',
    },
  });

  const totalVerified = verifiedShifts.reduce(
    (sum, shift) => sum + Number(shift.netReceived),
    0,
  );

  const platforms = Array.from(
    new Set(verifiedShifts.map((shift) => shift.platform.name)),
  ).sort((a, b) => a.localeCompare(b));

  const renderPayload = {
    workerName: worker.fullName,
    workerId: worker.id,
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate),
    totalVerified,
    shiftCount: verifiedShifts.length,
    platforms,
    generatedAt: new Date().toISOString(),
  };

  const rendererBaseUrl =
    process.env.CERTIFICATE_SERVICE_URL ?? 'http://localhost:8004';
  const rendererEndpoint = `${rendererBaseUrl.replace(/\/$/, '')}/render`;

  let htmlSnapshot = defaultCertificateHtml(renderPayload);

  try {
    const rendererResponse = await fetch(rendererEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(renderPayload),
    });

    if (rendererResponse.ok) {
      const rendered = (await rendererResponse.json()) as { html?: string };
      if (typeof rendered.html === 'string' && rendered.html.length > 0) {
        htmlSnapshot = rendered.html;
      }
    }
  } catch {
    // Keep fallback HTML when renderer service is unavailable.
  }

  const certificate = await db.incomeCertificate.create({
    data: {
      workerId,
      fromDate,
      toDate,
      totalVerified,
      shiftCount: verifiedShifts.length,
      platformsList: platforms,
      htmlSnapshot,
      status: 'GENERATED',
    },
  });

  return c.json({ data: certificate }, 201);
};
