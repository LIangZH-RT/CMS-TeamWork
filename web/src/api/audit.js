// 留痕接口模块（api-spec §8，#19，归属编辑、管理员）。复用 http.js 单例。
import { http } from './http'

/** GET /api/articles/{id}/audit-logs (#19)：按 operated_at 正序 */
export function getAuditLogs(id) {
  return http.get(`/api/articles/${encodeURIComponent(id)}/audit-logs`)
}
