// 用户、角色、权限点、操作日志（api-spec #33–#37、#44）。
import { http } from './http'

export function listUsers(params = {}) {
  return http.get('/api/admin/users', {
    params: {
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      keyword: params.keyword || undefined,
      role: params.role || undefined,
      status: params.status || undefined,
      sort: params.sort || undefined,
    },
  })
}

export function updateUserStatus(id, status) {
  return http.put(`/api/admin/users/${encodeURIComponent(id)}/status`, { status })
}

export function updateUserRole(id, role_code) {
  return http.put(`/api/admin/users/${encodeURIComponent(id)}/role`, { role_code })
}

export function listRoles() {
  return http.get('/api/roles')
}

export function listPermissions() {
  return http.get('/api/permissions')
}

export function listOperationLogs(params = {}) {
  return http.get('/api/admin/operation-logs', {
    params: {
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      operator_id: params.operator_id || undefined,
      module: params.module || undefined,
      success: params.success === true || params.success === false ? params.success : undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      sort: params.sort || undefined,
    },
  })
}
