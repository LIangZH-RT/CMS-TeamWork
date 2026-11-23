// v-permission="'article:delete'" 或 v-permission="['review:approve']"
// 没有权限点就隐藏控件。只影响展示，服务端仍独立判定（FR-AUTH-005）。
import { hasPermission } from '@/utils/permissions'
import { useAuth } from '@/stores/auth'

function apply(el, value) {
  const auth = useAuth()
  const ok = value == null || value === '' || (Array.isArray(value) && value.length === 0)
    ? true
    : hasPermission(auth.user, value)
  el.style.display = ok ? '' : 'none'
  if (!ok) el.setAttribute('aria-hidden', 'true')
  else el.removeAttribute('aria-hidden')
}

export const permissionDirective = {
  mounted(el, binding) { apply(el, binding.value) },
  updated(el, binding) { apply(el, binding.value) },
}
