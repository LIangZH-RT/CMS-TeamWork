// SRS §4.7 的 27 个权限点。角色与权限的对应关系运行期只读（BR-RBAC-002）。
// 前端只用来决定菜单、路由入口和按钮显隐，不承担授权（architecture §3.3）。

const P = (code, name, module, roles) => ({ code, name, module, roles })

export const PERMISSION_DEFS = [
  P('article:create', '创建文章草稿', 'ARTICLE', ['EDITOR']),
  P('article:update', '编辑文章', 'ARTICLE', ['EDITOR']),
  P('article:delete', '删除草稿', 'ARTICLE', ['EDITOR']),
  P('article:submit', '提交审核', 'ARTICLE', ['EDITOR']),
  P('article:withdraw', '撤回待发布', 'ARTICLE', ['EDITOR']),
  P('article:reschedule', '修改预定发布时间', 'ARTICLE', ['EDITOR']),
  P('article:read', '查看文章', 'ARTICLE', ['EDITOR', 'ADMIN']),
  P('article:read:all', '查看全部文章', 'ARTICLE', ['ADMIN']),
  P('review:queue', '查看审核队列', 'REVIEW', ['ADMIN']),
  P('review:approve', '审核通过', 'REVIEW', ['ADMIN']),
  P('review:reject', '驳回文章', 'REVIEW', ['ADMIN']),
  P('review:unpublish', '下架文章', 'REVIEW', ['ADMIN']),
  P('audit:read', '查看文章留痕', 'AUDIT', ['EDITOR', 'ADMIN']),
  P('category:read', '查看分类', 'TAX', ['EDITOR', 'ADMIN']),
  P('category:create', '创建分类', 'TAX', ['ADMIN']),
  P('category:update', '修改分类', 'TAX', ['ADMIN']),
  P('category:delete', '删除分类', 'TAX', ['ADMIN']),
  P('tag:read', '查看标签', 'TAX', ['EDITOR', 'ADMIN']),
  P('tag:create', '创建标签', 'TAX', ['EDITOR', 'ADMIN']),
  P('tag:update', '修改标签', 'TAX', ['EDITOR', 'ADMIN']),
  P('tag:delete', '删除标签', 'TAX', ['EDITOR', 'ADMIN']),
  P('media:upload', '上传媒体', 'MEDIA', ['EDITOR']),
  P('user:read', '查看用户', 'USER', ['ADMIN']),
  P('user:status', '启用或停用账号', 'USER', ['ADMIN']),
  P('user:assign-role', '分配角色', 'USER', ['ADMIN']),
  P('role:read', '查看角色与权限点', 'USER', ['ADMIN']),
  P('oplog:read', '查看操作日志', 'OPLOG', ['ADMIN']),
]

export const MODULE_LABEL = {
  ARTICLE: '文章',
  REVIEW: '审核',
  AUDIT: '留痕',
  TAX: '分类与标签',
  MEDIA: '媒体',
  USER: '用户与角色',
  OPLOG: '操作日志',
}

export function permissionsOf(role) {
  return PERMISSION_DEFS.filter((p) => p.roles.includes(role)).map((p) => p.code).sort()
}

export function hasPermission(user, code) {
  const perms = user?.permissions
  if (!Array.isArray(perms)) return false
  const list = Array.isArray(code) ? code : [code]
  return list.some((c) => perms.includes(c))
}
