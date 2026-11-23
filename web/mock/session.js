// 契约 mock 的会话、CSRF 与账号。只活在 Vite 进程里，密码是演示明文。
import { randomBytes } from 'node:crypto'
import { authors } from './db.js'
import { permissionsOf } from '../src/utils/permissions.js'

const DEMO_PASSWORD = {
  admin: 'Admin@12345',
}

export const users = authors.map((u) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  role_name: u.role === 'ADMIN' ? '管理员' : '内容编辑',
  status: 'ENABLED',
  password: DEMO_PASSWORD[u.username] || 'Editor@12345',
  created_at: '2026-10-19T00:00:00+08:00',
  updated_at: '2026-10-19T00:00:00+08:00',
}))

let nextUserId = users.reduce((m, u) => Math.max(m, u.id), 0) + 1

const sessions = new Map()
const throttle = new Map()

export const operationLogs = []
let nextLogId = 1

export function nowCst() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19) + '+08:00'
}

export function publicUser(u, { withPermissions = false } = {}) {
  const row = {
    id: u.id,
    username: u.username,
    role: u.role,
    role_name: u.role === 'ADMIN' ? '管理员' : '内容编辑',
    status: u.status,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }
  if (withPermissions) row.permissions = permissionsOf(u.role)
  return row
}

export function writeOplog(entry) {
  operationLogs.push({
    id: nextLogId++,
    operator: entry.operator ?? null,
    module: entry.module,
    operation: entry.operation,
    target_type: entry.target_type ?? null,
    target_id: entry.target_id ?? null,
    http_method: entry.http_method,
    request_uri: entry.request_uri,
    client_ip: '127.0.0.1',
    success: entry.success,
    error_code: entry.error_code ?? null,
    duration_ms: entry.duration_ms ?? 4,
    created_at: nowCst(),
  })
}

function brief(u) {
  return u ? { id: u.id, username: u.username } : null
}

writeOplog({
  operator: brief(users[0]),
  module: 'AUTH',
  operation: 'LOGIN',
  http_method: 'POST',
  request_uri: '/api/auth/login',
  success: true,
})

export function cookieSid(headers) {
  const raw = headers?.cookie || headers?.Cookie || ''
  const m = /(?:^|;\s*)JSESSIONID=([^;]+)/.exec(String(raw))
  return m ? decodeURIComponent(m[1]) : null
}

function newSid() {
  return randomBytes(18).toString('hex')
}

export function createSession(userId) {
  const sid = newSid()
  const csrf = randomBytes(16).toString('hex')
  sessions.set(sid, { sid, userId: userId ?? null, csrf })
  return sessions.get(sid)
}

export function destroySession(sid) {
  if (sid) sessions.delete(sid)
}

export function sessionOf(headers) {
  const sid = cookieSid(headers)
  return sid ? sessions.get(sid) ?? null : null
}

export function ensureAnonymous(headers) {
  const existing = sessionOf(headers)
  if (existing) return { session: existing, fresh: false }
  return { session: createSession(null), fresh: true }
}

export function actorFromHeaders(headers) {
  const s = sessionOf(headers)
  if (!s?.userId) return null
  const u = users.find((x) => x.id === s.userId)
  if (!u || u.status !== 'ENABLED') return null
  return u
}

export function csrfOk(headers) {
  const s = sessionOf(headers)
  const token = headers?.['x-xsrf-token']
  return !!(s && token && s.csrf === token)
}

export function setCookie(sid, { clear = false } = {}) {
  if (clear) return 'JSESSIONID=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
  return `JSESSIONID=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`
}

export function rotateSession(oldSid, userId) {
  if (oldSid) sessions.delete(oldSid)
  return createSession(userId)
}

const USER_RE = /^[A-Za-z0-9_]{3,32}$/

export function normalizeUsername(raw) {
  if (typeof raw !== 'string') return { error: 'missing' }
  const name = raw.trim().toLowerCase()
  if (!USER_RE.test(name)) return { error: 'format' }
  return { name }
}

export function passwordError(raw) {
  if (typeof raw !== 'string') return 'missing'
  const points = [...raw]
  if (points.length < 8 || points.length > 64) return 'format'
  if (raw.trim() === '') return 'format'
  return null
}

export function recordFailure(username) {
  const now = Date.now()
  const row = throttle.get(username) || { fails: 0, until: 0 }
  if (row.until && row.until > now) return row
  if (row.until && row.until <= now) {
    row.fails = 0
    row.until = 0
  }
  row.fails += 1
  if (row.fails >= 5) row.until = now + 15 * 60 * 1000
  throttle.set(username, row)
  return row
}

export function clearFailure(username) {
  throttle.delete(username)
}

export function isLocked(username) {
  const row = throttle.get(username)
  return !!(row?.until && row.until > Date.now())
}

export function allocUserId() {
  return nextUserId++
}
