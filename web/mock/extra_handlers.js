// 认证、用户、角色、权限点、操作日志（#1–#5、#33–#37、#44）。
// 文章写接口仍在 admin_handlers，避免拆开同一份运行态。
import { articles } from './db.js'
import { PERMISSION_DEFS, permissionsOf } from '../src/utils/permissions.js'
import {
  actorFromHeaders,
  allocUserId,
  clearFailure,
  csrfOk,
  destroySession,
  ensureAnonymous,
  isLocked,
  normalizeUsername,
  nowCst,
  operationLogs,
  passwordError,
  publicUser,
  recordFailure,
  rotateSession,
  sessionOf,
  setCookie,
  users,
  writeOplog,
} from './session.js'

const JSON_HDR = { 'Content-Type': 'application/json; charset=utf-8' }
const ok = (data, status = 200, extra = {}) => ({
  status,
  headers: { ...JSON_HDR, ...extra },
  body: JSON.stringify({ code: 0, message: 'OK', data }),
})
const fail = (status, code, message) => ({
  status,
  headers: JSON_HDR,
  body: JSON.stringify({ code, message, data: null }),
})
const notFound = () => fail(404, 40400, '资源不存在')
const unauth = () => fail(401, 40100, '未登录')
const loginFailed = () => fail(401, 40101, '登录名或密码错误')
const csrfFail = () => fail(403, 40300, 'CSRF 令牌无效')
const bad = (code = 40000) => fail(400, code, '参数校验失败')

const SORT_USER = new Set(['created_at', 'username'])
const SORT_LOG = new Set(['created_at'])

function pageParams(sp) {
  const pageRaw = sp.get('page')
  const sizeRaw = sp.get('page_size')
  const page = pageRaw == null || pageRaw === '' ? 1 : Number(pageRaw)
  const page_size = sizeRaw == null || sizeRaw === '' ? 20 : Number(sizeRaw)
  if (!Number.isInteger(page) || page < 1) return { error: bad() }
  if (!Number.isInteger(page_size) || page_size < 1 || page_size > 100) return { error: bad() }
  return { page, page_size }
}

function parseSort(sp, allow) {
  const items = sp.getAll('sort').filter((s) => s !== '')
  if (!items.length) return { value: [] }
  const value = []
  for (const item of items) {
    const [field, dir] = item.split(',')
    if (!allow.has(field) || (dir !== 'asc' && dir !== 'desc')) return { error: fail(400, 40018, '排序字段不合法') }
    value.push([field, dir])
  }
  return { value }
}

function forbidExtra(body, allow) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad()
  for (const key of Object.keys(body)) {
    if (!allow.has(key)) return fail(400, 40001, '参数校验失败')
  }
  return null
}

function authorHasArticles(userId) {
  return articles.some((a) => a.author_id === userId)
}

function enabledAdmins(exceptId) {
  return users.filter((u) => u.role === 'ADMIN' && u.status === 'ENABLED' && u.id !== exceptId)
}

export function handleExtra(method, rawUrl, body, headers = {}) {
  const url = new URL(rawUrl, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '')

  if (path === '/api/auth/csrf' && method === 'GET') {
    const { session, fresh } = ensureAnonymous(headers)
    const headersOut = fresh ? { 'Set-Cookie': setCookie(session.sid) } : {}
    return ok({ header_name: 'X-XSRF-TOKEN', token: session.csrf }, 200, headersOut)
  }

  if (path === '/api/auth/register' && method === 'POST') {
    if (!sessionOf(headers) || !csrfOk(headers)) return csrfFail()
    const extra = forbidExtra(body, new Set(['username', 'password']))
    if (extra) return extra
    const u = normalizeUsername(body.username)
    if (u.error) return bad(u.error === 'format' ? 40002 : 40000)
    if (passwordError(body.password)) return bad(40003)
    if (users.some((x) => x.username === u.name)) return fail(409, 40905, '登录名已被占用')
    const row = {
      id: allocUserId(),
      username: u.name,
      role: 'EDITOR',
      role_name: '内容编辑',
      status: 'ENABLED',
      password: body.password,
      created_at: nowCst(),
      updated_at: nowCst(),
    }
    users.push(row)
    writeOplog({
      operator: null,
      module: 'AUTH',
      operation: 'REGISTER',
      target_type: 'USER',
      target_id: row.id,
      http_method: 'POST',
      request_uri: '/api/auth/register',
      success: true,
    })
    return ok(publicUser(row), 201)
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const extra = forbidExtra(body, new Set(['username', 'password']))
    if (extra) return extra
    const u = normalizeUsername(body.username)
    if (u.error) return bad(u.error === 'format' ? 40002 : 40000)
    if (passwordError(body.password)) return bad(40003)
    const row = users.find((x) => x.username === u.name)
    const badLogin = !row || row.password !== body.password || row.status !== 'ENABLED' || isLocked(u.name)
    if (badLogin) {
      recordFailure(u.name)
      writeOplog({
        operator: null,
        module: 'AUTH',
        operation: 'LOGIN_FAILED',
        http_method: 'POST',
        request_uri: '/api/auth/login',
        success: false,
        error_code: 40101,
      })
      return loginFailed()
    }
    clearFailure(u.name)
    const old = sessionOf(headers)
    const session = rotateSession(old?.sid, row.id)
    writeOplog({
      operator: { id: row.id, username: row.username },
      module: 'AUTH',
      operation: 'LOGIN',
      target_type: 'USER',
      target_id: row.id,
      http_method: 'POST',
      request_uri: '/api/auth/login',
      success: true,
    })
    return ok({ user: publicUser(row) }, 200, { 'Set-Cookie': setCookie(session.sid) })
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const actor = actorFromHeaders(headers)
    if (!actor) return unauth()
    if (!csrfOk(headers)) return csrfFail()
    destroySession(sessionOf(headers)?.sid)
    writeOplog({
      operator: { id: actor.id, username: actor.username },
      module: 'AUTH',
      operation: 'LOGOUT',
      http_method: 'POST',
      request_uri: '/api/auth/logout',
      success: true,
    })
    return ok(null, 200, { 'Set-Cookie': setCookie('', { clear: true }) })
  }

  if (path === '/api/auth/me' && method === 'GET') {
    const actor = actorFromHeaders(headers)
    if (!actor) return unauth()
    return ok(publicUser(actor, { withPermissions: true }))
  }

  const actor = actorFromHeaders(headers)
  const adminPath = path.startsWith('/api/admin') || path === '/api/roles' || path === '/api/permissions'
  if (!adminPath) return null
  if (!actor) return unauth()
  if (method !== 'GET' && !csrfOk(headers)) return csrfFail()
  if (actor.role !== 'ADMIN') return notFound()

  if (path === '/api/admin/users' && method === 'GET') {
    const pg = pageParams(url.searchParams)
    if (pg.error) return pg.error
    const sort = parseSort(url.searchParams, SORT_USER)
    if (sort.error) return sort.error
    const keyword = (url.searchParams.get('keyword') ?? '').trim()
    if ([...keyword].length > 32) return bad()
    const role = url.searchParams.get('role')
    if (role && role !== 'EDITOR' && role !== 'ADMIN') return bad()
    const status = url.searchParams.get('status')
    if (status && status !== 'ENABLED' && status !== 'DISABLED') return bad()
    let rows = users.slice()
    if (keyword) rows = rows.filter((u) => u.username.includes(keyword.toLowerCase()))
    if (role) rows = rows.filter((u) => u.role === role)
    if (status) rows = rows.filter((u) => u.status === status)
    const sorts = sort.value.length ? sort.value : [['created_at', 'desc']]
    rows.sort((a, b) => {
      for (const [field, dir] of sorts) {
        const av = a[field]
        const bv = b[field]
        if (av === bv) continue
        const cmp = av > bv ? 1 : -1
        return dir === 'asc' ? cmp : -cmp
      }
      return a.id - b.id
    })
    const start = (pg.page - 1) * pg.page_size
    return ok({
      items: rows.slice(start, start + pg.page_size).map((u) => publicUser(u)),
      page: pg.page,
      page_size: pg.page_size,
      total: rows.length,
    })
  }

  let m = /^\/api\/admin\/users\/([^/]+)\/status$/.exec(path)
  if (m && method === 'PUT') {
    const id = Number(decodeURIComponent(m[1]))
    const row = users.find((u) => u.id === id)
    if (!row) return notFound()
    if (body?.status !== 'ENABLED' && body?.status !== 'DISABLED') return bad()
    if (row.role === 'ADMIN' && body.status === 'DISABLED') {
      if (row.id === actor.id || enabledAdmins(row.id).length === 0) return fail(409, 40909, '至少要保留一个启用的管理员')
    }
    if (row.status !== body.status) {
      row.status = body.status
      row.updated_at = nowCst()
    }
    writeOplog({
      operator: { id: actor.id, username: actor.username },
      module: 'USER',
      operation: 'USER_STATUS',
      target_type: 'USER',
      target_id: row.id,
      http_method: 'PUT',
      request_uri: `/api/admin/users/${row.id}/status`,
      success: true,
    })
    return ok(publicUser(row))
  }

  m = /^\/api\/admin\/users\/([^/]+)\/role$/.exec(path)
  if (m && method === 'PUT') {
    const id = Number(decodeURIComponent(m[1]))
    const row = users.find((u) => u.id === id)
    if (!row) return notFound()
    const role = body?.role_code
    if (role !== 'ADMIN' && role !== 'EDITOR') return bad()
    if (row.id === actor.id && role !== row.role) return fail(409, 40909, '至少要保留一个启用的管理员')
    if (row.role === 'ADMIN' && role === 'EDITOR' && row.status === 'ENABLED' && enabledAdmins(row.id).length === 0) {
      return fail(409, 40909, '至少要保留一个启用的管理员')
    }
    if (row.role === 'EDITOR' && role === 'ADMIN' && authorHasArticles(row.id)) {
      return fail(409, 40910, '名下有文章的编辑不能提升为管理员')
    }
    if (row.role !== role) {
      row.role = role
      row.role_name = role === 'ADMIN' ? '管理员' : '内容编辑'
      row.updated_at = nowCst()
    }
    writeOplog({
      operator: { id: actor.id, username: actor.username },
      module: 'USER',
      operation: 'USER_ROLE',
      target_type: 'USER',
      target_id: row.id,
      http_method: 'PUT',
      request_uri: `/api/admin/users/${row.id}/role`,
      success: true,
    })
    return ok(publicUser(row))
  }

  if (path === '/api/roles' && method === 'GET') {
    return ok([
      { code: 'EDITOR', name: '内容编辑', permissions: permissionsOf('EDITOR') },
      { code: 'ADMIN', name: '管理员', permissions: permissionsOf('ADMIN') },
    ])
  }

  if (path === '/api/permissions' && method === 'GET') {
    const rows = [...PERMISSION_DEFS].sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code))
    return ok(rows.map(({ code, name, module }) => ({ code, name, module })))
  }

  if (path === '/api/admin/operation-logs' && method === 'GET') {
    const pg = pageParams(url.searchParams)
    if (pg.error) return pg.error
    const sort = parseSort(url.searchParams, SORT_LOG)
    if (sort.error) return sort.error
    const sp = url.searchParams
    const operatorId = sp.get('operator_id')
    if (operatorId && !/^[1-9]\d{0,18}$/.test(operatorId)) return bad()
    const module = sp.get('module')
    if (module && !['AUTH', 'ARTICLE', 'REVIEW', 'TAX', 'MEDIA', 'USER'].includes(module)) return bad()
    const success = sp.get('success')
    if (success != null && success !== '' && success !== 'true' && success !== 'false') return bad()
    let rows = operationLogs.slice()
    if (operatorId) rows = rows.filter((l) => l.operator?.id === Number(operatorId))
    if (module) rows = rows.filter((l) => l.module === module)
    if (success === 'true' || success === 'false') rows = rows.filter((l) => l.success === (success === 'true'))
    const from = sp.get('from')
    const to = sp.get('to')
    if (from) rows = rows.filter((l) => l.created_at >= from)
    if (to) rows = rows.filter((l) => l.created_at < to)
    const dir = sort.value[0]?.[1] || 'desc'
    rows.sort((a, b) => (dir === 'asc' ? a.id - b.id : b.id - a.id))
    const start = (pg.page - 1) * pg.page_size
    return ok({
      items: rows.slice(start, start + pg.page_size),
      page: pg.page,
      page_size: pg.page_size,
      total: rows.length,
    })
  }

  return notFound()
}
