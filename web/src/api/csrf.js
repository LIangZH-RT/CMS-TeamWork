// CSRF 令牌只放内存，不读 Cookie（api-spec §2.2）。登录、登出后必须重取。

let token = null

export const getCsrf = () => token

export function setCsrf(value) {
  token = value || null
}
