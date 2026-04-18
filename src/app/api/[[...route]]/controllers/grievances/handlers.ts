import db from '@/lib/db';
import { Context } from 'hono';

type SessionUser = {
  id: string;
  role: string;
};

void db;

const GRIEVANCE_SERVICE_URL =
  process.env.GRIEVANCE_SERVICE_URL || 'http://localhost:8003';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8002';

async function callGrievanceService(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${GRIEVANCE_SERVICE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function listGrievances(c: Context) {
  const query = c.req.query();
  const params = new URLSearchParams();

  for (const key of [
    'platformId',
    'category',
    'status',
    'workerId',
    'limit',
    'offset',
  ]) {
    const value = query[key];
    if (value) params.set(key, value);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await callGrievanceService(`/grievances${suffix}`);
    return c.json(await res.json(), res.status);
  } catch {
    return c.json(
      {
        grievances: [],
        total: 0,
        error: 'grievance_service_unavailable',
      },
      503,
    );
  }
}

export async function getForClustering(c: Context) {
  const query = c.req.query();
  const params = new URLSearchParams();

  for (const key of ['platform', 'status', 'limit']) {
    const value = query[key];
    if (value) params.set(key, value);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await callGrievanceService(`/grievances/for-clustering${suffix}`);
    return c.json(await res.json(), res.status);
  } catch {
    return c.json(
      {
        grievances: [],
        total: 0,
        error: 'grievance_service_unavailable',
      },
      503,
    );
  }
}

export async function getGrievance(c: Context) {
  const id = c.req.param('id');

  try {
    const res = await callGrievanceService(`/grievances/${id}`);
    if (res.status === 404) {
      return c.json({ error: 'Grievance not found' }, 404);
    }
    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function createGrievance(c: Context) {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json<{
      platformId?: string;
      category: string;
      description: string;
      isAnonymous?: boolean;
    }>();

    const res = await callGrievanceService('/grievances', {
      method: 'POST',
      body: JSON.stringify({ ...body, workerId: user.id }),
    });

    if (res.status === 400) {
      return c.json(await res.json(), 400);
    }

    return c.json(await res.json(), 201);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function updateGrievance(c: Context) {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const res = await callGrievanceService(`/grievances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    if (res.status === 404) {
      return c.json({ error: 'Grievance not found' }, 404);
    }

    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function deleteGrievance(c: Context) {
  const id = c.req.param('id');

  try {
    const res = await callGrievanceService(`/grievances/${id}`, {
      method: 'DELETE',
    });

    if (res.status === 404) {
      return c.json({ error: 'Grievance not found' }, 404);
    }

    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function addTag(c: Context) {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const res = await callGrievanceService(`/grievances/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      return c.json({ error: 'Tag already exists' }, 409);
    }

    return c.json(await res.json(), 201);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function removeTag(c: Context) {
  const id = c.req.param('id');
  const tag = c.req.param('tag');

  try {
    const res = await callGrievanceService(
      `/grievances/${id}/tags/${encodeURIComponent(tag)}`,
      {
        method: 'DELETE',
      },
    );

    if (res.status === 404) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function escalateGrievance(c: Context) {
  const user = c.var.user as SessionUser | undefined;
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const res = await callGrievanceService(`/grievances/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ ...body, advocateId: user.id }),
    });

    if (res.status === 409) {
      return c.json(await res.json(), 409);
    }

    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function resolveGrievance(c: Context) {
  const id = c.req.param('id');

  try {
    const res = await callGrievanceService(`/grievances/${id}/resolve`, {
      method: 'PATCH',
    });

    if (res.status === 404) {
      return c.json({ error: 'Grievance not found' }, 404);
    }

    if (res.status === 409) {
      return c.json(await res.json(), 409);
    }

    return c.json(await res.json(), res.status);
  } catch {
    return c.json({ error: 'grievance_service_unavailable' }, 503);
  }
}

export async function getGrievanceStats(c: Context) {
  try {
    const res = await callGrievanceService('/grievances/stats');
    return c.json(await res.json(), res.status);
  } catch {
    return c.json(
      {
        total: 0,
        error: 'grievance_service_unavailable',
      },
      503,
    );
  }
}

export async function clusterGrievances(c: Context) {
  try {
    const fetchRes = await callGrievanceService('/grievances/for-clustering?limit=100');
    if (!fetchRes.ok) {
      return c.json(
        { error: 'Could not fetch grievances for clustering' },
        503,
      );
    }

    const fetchedGrievances = await fetchRes.json();
    const body = await c.req.json().catch(() => ({}));

    const mlRes = await fetch(`${ML_SERVICE_URL}/cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grievances: fetchedGrievances.grievances,
        anomaly_contexts: body.anomaly_contexts || [],
      }),
    });

    if (!mlRes.ok) {
      return c.json({ error: 'ML service unavailable', clusters: [] }, 503);
    }

    return c.json(await mlRes.json(), mlRes.status);
  } catch {
    return c.json({ error: 'ML service unavailable', clusters: [] }, 503);
  }
}

export async function getGrievanceTrends(c: Context) {
  try {
    const fetchRes = await callGrievanceService('/grievances/for-clustering?limit=200');
    if (!fetchRes.ok) {
      return c.json({ error: 'Could not fetch grievances for trends' }, 503);
    }

    const fetchedGrievances = await fetchRes.json();
    const platform = c.req.query('platform');

    const mlRes = await fetch(`${ML_SERVICE_URL}/trends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grievances: fetchedGrievances.grievances,
        platform: platform || null,
      }),
    });

    if (!mlRes.ok) {
      return c.json({ error: 'ML service unavailable' }, 503);
    }

    return c.json(await mlRes.json(), mlRes.status);
  } catch {
    return c.json({ error: 'ML service unavailable' }, 503);
  }
}
