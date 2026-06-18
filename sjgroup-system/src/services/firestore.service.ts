import { api, socket } from '@/config/api'

export type QueryConstraint =
  | { kind: 'where'; field: string; op: string; value: unknown }
  | { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' }

export const where = (field: string, _op: string, value: unknown): QueryConstraint => ({
  kind: 'where',
  field,
  op: _op,
  value,
})

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint => ({
  kind: 'orderBy',
  field,
  dir,
})

export const serverTimestamp = () => new Date().toISOString()

const constraintsToParams = (constraints: QueryConstraint[]) => {
  const params: Record<string, string> = {}
  for (const c of constraints) {
    if (c.kind === 'where') params[c.field] = String(c.value)
    if (c.kind === 'orderBy') params.sort = `${c.field}:${c.dir}`
  }
  return params
}

// ─── Generic CRUD ──────────────────────────────────────────────────────────────
export const createDoc = async (collectionName: string, data: Record<string, unknown>) => {
  const res = await api.post(`/${collectionName}`, data)
  return res.data.id as string
}

export const updateDocument = async (
  collectionName: string,
  id: string,
  data: Record<string, unknown>
) => {
  await api.put(`/${collectionName}/${id}`, data)
}

export const deleteDocument = async (collectionName: string, id: string) => {
  await api.delete(`/${collectionName}/${id}`)
}

export const getDocument = async (collectionName: string, id: string) => {
  const res = await api.get(`/${collectionName}/${id}`)
  return res.data
}

export const getDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  const res = await api.get(`/${collectionName}`, { params: constraintsToParams(constraints) })
  return res.data as Record<string, unknown>[]
}

export const subscribeToCollection = (
  collectionName: string,
  constraints: QueryConstraint[],
  callback: (data: Record<string, unknown>[]) => void
) => {
  let active = true
  const params = constraintsToParams(constraints)

  const fetchData = async () => {
    const res = await api.get(`/${collectionName}`, { params })
    if (active) callback(res.data)
  }

  fetchData()

  const handler = (changedCollection: string) => {
    if (changedCollection === collectionName) fetchData()
  }
  socket.on('changed', handler)

  return () => {
    active = false
    socket.off('changed', handler)
  }
}
