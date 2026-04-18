import { db } from './db.js'
import {
  createGrievanceSchema,
  updateGrievanceSchema,
  addTagSchema,
  escalateSchema,
  listQuerySchema,
  grievanceCategoryValues,
  grievanceStatusValues
} from './validators.js'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

function validationError(c, error) {
  return c.json({ error: 'Validation failed', details: error.issues }, 400)
}

function dbError(c, error) {
  return c.json({ error: 'Database error', message: error?.message ?? 'Unknown error' }, 500)
}

function toEnumOrUndefined(value, allowed) {
  if (!value) return undefined
  return allowed.includes(value) ? value : undefined
}

function applyAnonymization(grievance) {
  if (!grievance?.isAnonymous) return grievance

  const worker = grievance.worker
    ? { ...grievance.worker, fullName: 'Anonymous Worker' }
    : { fullName: 'Anonymous Worker', role: 'WORKER' }

  if ('id' in worker) {
    delete worker.id
  }

  return { ...grievance, worker }
}

function makeTitleFromDescription(description) {
  return description.trim().replace(/\s+/g, ' ').slice(0, 120)
}

export const healthCheck = async (c) => {
  return c.json({
    status: 'ok',
    service: 'fairgig-grievance',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
}

export const listGrievances = async (c) => {
  const queryRaw = Object.fromEntries(new URL(c.req.url).searchParams.entries())
  const parsed = listQuerySchema.safeParse(queryRaw)

  if (!parsed.success) {
    return validationError(c, parsed.error)
  }

  const { platformId, category, status, workerId, limit, offset } = parsed.data

  const where = {}
  if (platformId) where.platformId = platformId

  const normalizedCategory = toEnumOrUndefined(category, grievanceCategoryValues)
  if (category && !normalizedCategory) {
    return c.json({ error: 'Validation failed', details: [{ path: ['category'], message: 'Invalid category' }] }, 400)
  }
  if (normalizedCategory) where.category = normalizedCategory

  const normalizedStatus = toEnumOrUndefined(status, grievanceStatusValues)
  if (status && !normalizedStatus) {
    return c.json({ error: 'Validation failed', details: [{ path: ['status'], message: 'Invalid status' }] }, 400)
  }
  if (normalizedStatus) where.status = normalizedStatus

  if (workerId) where.workerId = workerId

  try {
    const [grievances, total] = await Promise.all([
      db.grievance.findMany({
        where,
        include: {
          tags: { orderBy: { createdAt: 'asc' } },
          escalations: {
            orderBy: { escalatedAt: 'desc' },
            take: 1
          },
          worker: { select: { id: true, fullName: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.grievance.count({ where })
    ])

    const platformIds = [...new Set(grievances.map((g) => g.platformId).filter(Boolean))]
    const advocateIds = [...new Set(grievances.flatMap((g) => g.escalations.map((e) => e.advocateId)).filter(Boolean))]

    const [platforms, advocates] = await Promise.all([
      platformIds.length
        ? db.platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, name: true, slug: true } })
        : Promise.resolve([]),
      advocateIds.length
        ? db.user.findMany({ where: { id: { in: advocateIds } }, select: { id: true, fullName: true, role: true } })
        : Promise.resolve([])
    ])

    const platformMap = new Map(platforms.map((p) => [p.id, p]))
    const advocateMap = new Map(advocates.map((a) => [a.id, a]))

    const enriched = grievances.map((grievance) => {
      const withPlatformAndEscalation = {
        ...grievance,
        platform: grievance.platformId ? platformMap.get(grievance.platformId) ?? null : null,
        escalations: grievance.escalations.map((escalation) => ({
          ...escalation,
          advocate: advocateMap.get(escalation.advocateId) ?? null
        }))
      }

      return applyAnonymization(withPlatformAndEscalation)
    })

    return c.json({
      grievances: enriched,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })
  } catch (error) {
    return dbError(c, error)
  }
}

export const getStats = async (c) => {
  try {
    const startOfWeek = new Date()
    const day = startOfWeek.getDay()
    const diff = (day + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - diff)
    startOfWeek.setHours(0, 0, 0, 0)

    const [byStatusRaw, byCategoryRaw, byPlatformRaw, recentEscalationsRaw, total, openCount, thisWeekCount] = await db.$transaction([
      db.grievance.groupBy({ by: ['status'], _count: { id: true } }),
      db.grievance.groupBy({ by: ['category'], _count: { id: true } }),
      db.grievance.groupBy({
        by: ['platformId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      db.grievanceEscalation.findMany({
        take: 5,
        orderBy: { escalatedAt: 'desc' },
        include: {
          grievance: {
            select: {
              id: true,
              category: true,
              description: true,
              status: true,
              platformId: true
            }
          }
        }
      }),
      db.grievance.count(),
      db.grievance.count({ where: { status: 'OPEN' } }),
      db.grievance.count({ where: { createdAt: { gte: startOfWeek } } })
    ])

    const platformIds = [...new Set(byPlatformRaw.map((row) => row.platformId).filter(Boolean))]
    const escalationPlatformIds = [...new Set(recentEscalationsRaw.map((row) => row.grievance?.platformId).filter(Boolean))]

    const [platforms, advocates] = await Promise.all([
      [...new Set([...platformIds, ...escalationPlatformIds])].length
        ? db.platform.findMany({
            where: { id: { in: [...new Set([...platformIds, ...escalationPlatformIds])] } },
            select: { id: true, name: true, slug: true }
          })
        : Promise.resolve([]),
      recentEscalationsRaw.length
        ? db.user.findMany({
            where: { id: { in: [...new Set(recentEscalationsRaw.map((row) => row.advocateId))] } },
            select: { id: true, fullName: true, role: true }
          })
        : Promise.resolve([])
    ])

    const platformMap = new Map(platforms.map((p) => [p.id, p]))
    const advocateMap = new Map(advocates.map((a) => [a.id, a]))

    const byStatus = grievanceStatusValues.reduce((acc, key) => {
      acc[key] = 0
      return acc
    }, {})

    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count.id
    }

    const byCategory = grievanceCategoryValues.reduce((acc, key) => {
      acc[key] = 0
      return acc
    }, {})

    for (const row of byCategoryRaw) {
      byCategory[row.category] = row._count.id
    }

    const byPlatform = byPlatformRaw.map((row) => ({
      platformId: row.platformId,
      name: row.platformId ? platformMap.get(row.platformId)?.name ?? 'Unknown Platform' : 'Unknown Platform',
      count: row._count.id
    }))

    const recentEscalations = recentEscalationsRaw.map((row) => ({
      ...row,
      advocate: advocateMap.get(row.advocateId) ?? null,
      grievance: {
        ...row.grievance,
        platform: row.grievance.platformId
          ? { name: platformMap.get(row.grievance.platformId)?.name ?? 'Unknown Platform' }
          : { name: 'Unknown Platform' }
      }
    }))

    return c.json({
      total,
      openCount,
      thisWeekCount,
      byStatus,
      byCategory,
      byPlatform,
      recentEscalations
    })
  } catch (error) {
    return dbError(c, error)
  }
}

export const getGrievance = async (c) => {
  const { id } = c.req.param()

  try {
    const grievance = await db.grievance.findUnique({
      where: { id },
      include: {
        tags: { orderBy: { createdAt: 'asc' } },
        escalations: { orderBy: { escalatedAt: 'desc' } },
        worker: { select: { id: true, fullName: true, role: true } }
      }
    })

    if (!grievance) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    const [platform, advocates] = await Promise.all([
      grievance.platformId
        ? db.platform.findUnique({ where: { id: grievance.platformId }, select: { id: true, name: true, slug: true } })
        : Promise.resolve(null),
      grievance.escalations.length
        ? db.user.findMany({
            where: { id: { in: [...new Set(grievance.escalations.map((row) => row.advocateId))] } },
            select: { id: true, fullName: true, role: true }
          })
        : Promise.resolve([])
    ])

    const advocateMap = new Map(advocates.map((row) => [row.id, row]))

    const enriched = {
      ...grievance,
      platform,
      escalations: grievance.escalations.map((row) => ({
        ...row,
        advocate: advocateMap.get(row.advocateId) ?? null
      }))
    }

    return c.json(applyAnonymization(enriched))
  } catch (error) {
    return dbError(c, error)
  }
}

export const createGrievance = async (c) => {
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed', details: [{ message: 'Invalid JSON body' }] }, 400)
  }

  const parsed = createGrievanceSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(c, parsed.error)
  }

  const payload = parsed.data

  try {
    const platform = await db.platform.findUnique({ where: { id: payload.platformId }, select: { id: true, name: true, slug: true } })

    if (!platform) {
      return c.json({ error: 'Platform not found' }, 404)
    }

    const grievance = await db.grievance.create({
      data: {
        id: uuidv4(),
        workerId: payload.workerId,
        platformId: payload.platformId,
        category: payload.category,
        title: makeTitleFromDescription(payload.description),
        description: payload.description,
        isAnonymous: payload.isAnonymous,
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        tags: true,
        worker: { select: { id: true, fullName: true, role: true } }
      }
    })

    return c.json({ ...grievance, platform: grievance.platformId ? platform : null }, 201)
  } catch (error) {
    return dbError(c, error)
  }
}

export const updateGrievance = async (c) => {
  const { id } = c.req.param()

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed', details: [{ message: 'Invalid JSON body' }] }, 400)
  }

  const parsed = updateGrievanceSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(c, parsed.error)
  }

  const payload = parsed.data

  try {
    const existing = await db.grievance.findUnique({ where: { id } })

    if (!existing) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    if (payload.status) {
      if (existing.status === 'RESOLVED' && payload.status !== 'RESOLVED') {
        return c.json({ error: 'Invalid status transition' }, 409)
      }
      if (existing.status === 'RESOLVED' && payload.status === 'OPEN') {
        return c.json({ error: 'Invalid status transition' }, 409)
      }
    }

    if (!payload.description && !payload.status) {
      return c.json({ error: 'Validation failed', details: [{ message: 'No update fields provided' }] }, 400)
    }

    const updated = await db.grievance.update({
      where: { id },
      data: {
        ...(payload.description ? { description: payload.description, title: makeTitleFromDescription(payload.description) } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        updatedAt: new Date()
      },
      include: {
        tags: true,
        worker: { select: { id: true, fullName: true, role: true } }
      }
    })

    const platform = updated.platformId
      ? await db.platform.findUnique({ where: { id: updated.platformId }, select: { id: true, name: true, slug: true } })
      : null

    return c.json({ ...updated, platform })
  } catch (error) {
    return dbError(c, error)
  }
}

export const deleteGrievance = async (c) => {
  const { id } = c.req.param()

  try {
    const existing = await db.grievance.findUnique({ where: { id }, select: { id: true } })

    if (!existing) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    await db.$transaction([
      db.grievanceTag.deleteMany({ where: { grievanceId: id } }),
      db.grievanceEscalation.deleteMany({ where: { grievanceId: id } }),
      db.grievance.delete({ where: { id } })
    ])

    return c.json({ message: 'Grievance deleted', id })
  } catch (error) {
    return dbError(c, error)
  }
}

export const addTag = async (c) => {
  const { id } = c.req.param()

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed', details: [{ message: 'Invalid JSON body' }] }, 400)
  }

  const parsed = addTagSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(c, parsed.error)
  }

  try {
    const grievance = await db.grievance.findUnique({ where: { id }, select: { id: true } })

    if (!grievance) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    const normalized = parsed.data.tag.toLowerCase().trim()

    const duplicate = await db.grievanceTag.findFirst({
      where: { grievanceId: id, tag: normalized }
    })

    if (duplicate) {
      return c.json({ error: 'Tag already exists' }, 409)
    }

    const advocate = await db.user.findFirst({
      where: { role: 'ADVOCATE' },
      select: { id: true }
    })

    if (!advocate) {
      return c.json({ error: 'No advocate user available for tagging' }, 409)
    }

    const tag = await db.grievanceTag.create({
      data: {
        id: uuidv4(),
        grievanceId: id,
        advocateId: advocate.id,
        tag: normalized,
        createdAt: new Date()
      }
    })

    return c.json(tag, 201)
  } catch (error) {
    return dbError(c, error)
  }
}

export const removeTag = async (c) => {
  const { id, tag } = c.req.param()
  const normalized = decodeURIComponent(tag).toLowerCase().trim()

  try {
    const existing = await db.grievanceTag.findFirst({
      where: { grievanceId: id, tag: normalized }
    })

    if (!existing) {
      return c.json({ error: 'Tag not found' }, 404)
    }

    await db.grievanceTag.delete({ where: { id: existing.id } })

    return c.json({ message: 'Tag removed', tag: normalized })
  } catch (error) {
    return dbError(c, error)
  }
}

export const escalateGrievance = async (c) => {
  const { id } = c.req.param()

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed', details: [{ message: 'Invalid JSON body' }] }, 400)
  }

  const parsed = escalateSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(c, parsed.error)
  }

  try {
    const grievance = await db.grievance.findUnique({ where: { id } })

    if (!grievance) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    if (['ESCALATED', 'RESOLVED'].includes(grievance.status)) {
      return c.json({
        error: 'Cannot escalate',
        currentStatus: grievance.status
      }, 409)
    }

    const [updatedGrievance, escalation] = await db.$transaction([
      db.grievance.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          updatedAt: new Date()
        }
      }),
      db.grievanceEscalation.create({
        data: {
          id: uuidv4(),
          grievanceId: id,
          advocateId: parsed.data.advocateId,
          note: parsed.data.note,
          escalatedAt: new Date()
        }
      })
    ])

    return c.json({
      message: 'Grievance escalated successfully',
      grievance: updatedGrievance,
      escalation
    })
  } catch (error) {
    return dbError(c, error)
  }
}

export const resolveGrievance = async (c) => {
  const { id } = c.req.param()

  try {
    const grievance = await db.grievance.findUnique({ where: { id } })

    if (!grievance) {
      return c.json({ error: 'Grievance not found' }, 404)
    }

    if (grievance.status === 'RESOLVED') {
      return c.json({ error: 'Already resolved' }, 409)
    }

    const updated = await db.grievance.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        updatedAt: new Date()
      }
    })

    return c.json(updated)
  } catch (error) {
    return dbError(c, error)
  }
}

export const getForClustering = async (c) => {
  const params = new URL(c.req.url).searchParams
  const platformName = params.get('platform')
  const statusQuery = params.get('status')

  const limitParsed = z.coerce.number().min(1).max(500).safeParse(params.get('limit') ?? '100')
  if (!limitParsed.success) {
    return validationError(c, limitParsed.error)
  }

  let statusList
  if (!statusQuery) {
    statusList = ['OPEN', 'ESCALATED']
  } else {
    const split = statusQuery.split(',').map((s) => s.trim()).filter(Boolean)
    const invalid = split.find((s) => !grievanceStatusValues.includes(s))
    if (invalid) {
      return c.json({ error: 'Validation failed', details: [{ path: ['status'], message: 'Invalid status value' }] }, 400)
    }
    statusList = split
  }

  try {
    let platformFilterId
    if (platformName) {
      const platform = await db.platform.findFirst({
        where: { name: { equals: platformName, mode: 'insensitive' } },
        select: { id: true }
      })

      if (!platform) {
        return c.json({ grievances: [], total: 0 })
      }

      platformFilterId = platform.id
    }

    const where = {
      status: { in: statusList },
      ...(platformFilterId ? { platformId: platformFilterId } : {})
    }

    const [grievances, count] = await Promise.all([
      db.grievance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitParsed.data,
        select: {
          id: true,
          description: true,
          platformId: true,
          category: true,
          createdAt: true,
          workerId: true,
          isAnonymous: true
        }
      }),
      db.grievance.count({ where })
    ])

    const platformIds = [...new Set(grievances.map((g) => g.platformId).filter(Boolean))]
    const platforms = platformIds.length
      ? await db.platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, name: true } })
      : []
    const platformMap = new Map(platforms.map((p) => [p.id, p.name]))

    const payload = grievances.map((grievance) => ({
      id: grievance.id,
      text: grievance.description,
      platform: grievance.platformId ? platformMap.get(grievance.platformId) ?? 'Unknown Platform' : 'Unknown Platform',
      category: grievance.category,
      created_at: grievance.createdAt.toISOString(),
      worker_id: grievance.isAnonymous ? 'anonymous' : (grievance.workerId ?? 'anonymous')
    }))

    return c.json({ grievances: payload, total: count })
  } catch (error) {
    return dbError(c, error)
  }
}
