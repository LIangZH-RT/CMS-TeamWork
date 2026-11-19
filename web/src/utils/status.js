// 文章状态映射（api-spec §4.1）。管理员端多处复用。
// 仅状态值，不做状态迁移或权限判断——那是后端的事。

export const ARTICLE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REJECTED: 'REJECTED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  UNPUBLISHED: 'UNPUBLISHED',
})

export const STATUS_LABEL = {
  [ARTICLE_STATUS.DRAFT]: '草稿',
  [ARTICLE_STATUS.PENDING_REVIEW]: '待审核',
  [ARTICLE_STATUS.REJECTED]: '驳回',
  [ARTICLE_STATUS.SCHEDULED]: '待发布',
  [ARTICLE_STATUS.PUBLISHED]: '已发布',
  [ARTICLE_STATUS.UNPUBLISHED]: '已下架',
}

// Element Plus Tag type: success / warning / danger / info / primary
export const STATUS_TAG_TYPE = {
  [ARTICLE_STATUS.DRAFT]: 'info',
  [ARTICLE_STATUS.PENDING_REVIEW]: 'warning',
  [ARTICLE_STATUS.REJECTED]: 'danger',
  [ARTICLE_STATUS.SCHEDULED]: 'primary',
  [ARTICLE_STATUS.PUBLISHED]: 'success',
  [ARTICLE_STATUS.UNPUBLISHED]: 'danger',
}

export const ALL_STATUSES = Object.values(ARTICLE_STATUS)

export const STATUS_OPTIONS = ALL_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))

// 留痕操作类型（api-spec §4.1 AuditAction，固定 7 类）
export const AUDIT_ACTION_LABEL = {
  SUBMIT: '提交审核',
  APPROVE: '审核通过',
  REJECT: '驳回',
  UNPUBLISH: '下架',
  WITHDRAW: '撤回',
  RESCHEDULE: '改期',
  AUTO_PUBLISH: '到期自动发布',
}

// 驳回类别（api-spec §4.1 RejectCategory / SRS BR-CONTENT-005，固定 8 类）
export const REJECT_CATEGORY_LABEL = {
  ILLEGAL: '违法违规',
  AUTHENTICITY_SOURCE: '真实性／来源',
  COPYRIGHT_PRIVACY: '版权／隐私',
  MINOR_VULGAR_VIOLENCE: '未成年人／低俗／暴力',
  DISCRIMINATION_HARASSMENT: '歧视／骚扰／引战',
  SPAM_MARKETING: '垃圾／营销',
  QUALITY_POSITIONING: '内容质量／博客定位',
  OTHER: '其他',
}
