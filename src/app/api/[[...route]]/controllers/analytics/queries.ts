import db from '@/lib/db';

import type { WorkerContext } from './types';

export async function getWorkerContext(
  workerId: string,
): Promise<WorkerContext | null> {
  const worker = await db.user.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      cityZone: true,
      category: true,
      role: true,
    },
  });

  if (!worker) {
    return null;
  }

  return {
    id: worker.id,
    cityZone: worker.cityZone,
    category: worker.category ?? null,
    role: worker.role,
  };
}
