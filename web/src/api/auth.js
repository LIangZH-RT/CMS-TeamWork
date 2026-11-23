// 认证接口模块（api-spec §5，#1–#5）。归 F 所有：#1 csrf、#2 register、#3 login、#5 me 由 F 追加。
// G 只在后台分区骨架里先放 #4 logout，供退出按钮使用。复用 http.js 单例。
import { http } from './http'

/** POST /api/auth/logout (#4)：销毁服务端会话 */
export function logout() {
  return http.post('/api/auth/logout')
}
