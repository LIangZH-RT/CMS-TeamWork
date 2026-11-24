// 契约 mock 的内存数据：模拟「库表」而不是「接口响应」。
// 故意带上状态、作者、驳回意见、预定时间等内部字段，用来验证接口层只输出 §8.2 白名单。
// 分类 7「测试」、标签 15「Rust」只被未发布文章引用：facets 不应出现它们（api-spec §4.14 PublicFacets）。

// 分类最多两级（BR-TAX-006）。parent_id / status 只给后台 #20；公开 facets 仍只用 id、name。
export const categories = [
  { id: 1, name: '后端', parent_id: null, sort_order: 10, status: 'ENABLED' },
  { id: 2, name: '前端', parent_id: null, sort_order: 20, status: 'ENABLED' },
  { id: 3, name: '数据库', parent_id: null, sort_order: 30, status: 'ENABLED' },
  { id: 4, name: '运维与云原生', parent_id: null, sort_order: 40, status: 'ENABLED' },
  { id: 5, name: '架构设计', parent_id: null, sort_order: 50, status: 'ENABLED' },
  { id: 6, name: 'AI 工程', parent_id: null, sort_order: 60, status: 'ENABLED' },
  { id: 7, name: '测试', parent_id: null, sort_order: 70, status: 'ENABLED' },
  { id: 16, name: 'Spring', parent_id: 1, sort_order: 10, status: 'ENABLED' },
  { id: 17, name: '组件库', parent_id: 2, sort_order: 10, status: 'ENABLED' },
  { id: 18, name: '停用示例', parent_id: null, sort_order: 90, status: 'DISABLED' },
]

export const tags = [
  { id: 1, name: 'Java' },
  { id: 2, name: 'Spring Boot' },
  { id: 3, name: 'Vue 3' },
  { id: 4, name: 'TypeScript' },
  { id: 5, name: 'MySQL' },
  { id: 6, name: 'Redis' },
  { id: 7, name: 'Kubernetes' },
  { id: 8, name: 'Docker' },
  { id: 9, name: '性能优化' },
  { id: 10, name: 'JVM' },
  { id: 11, name: 'Vite' },
  { id: 12, name: '微服务' },
  { id: 13, name: 'LLM' },
  { id: 14, name: 'RAG' },
  { id: 15, name: 'Rust' },
]

// 媒体：kind 决定 mock 生成什么字节；article_id 为归属文章
export const media = [
  { id: 4001, article_id: 101, kind: 'cover', palette: ['#1e3a8a', '#7c3aed'] },
  { id: 4002, article_id: 102, kind: 'cover', palette: ['#4f46e5', '#06b6d4'] },
  { id: 4004, article_id: 104, kind: 'cover', palette: ['#9333ea', '#ec4899'] },
  { id: 4005, article_id: 105, kind: 'cover', palette: ['#0891b2', '#22c55e'] },
  { id: 4006, article_id: 106, kind: 'cover', palette: ['#0f766e', '#2dd4bf'] },
  { id: 4007, article_id: 107, kind: 'cover', palette: ['#e11d48', '#f59e0b'] },
  { id: 4008, article_id: 108, kind: 'cover', palette: ['#2563eb', '#a855f7'] },
  { id: 4009, article_id: 109, kind: 'cover', palette: ['#15803d', '#84cc16'] },
  { id: 4010, article_id: 110, kind: 'cover', palette: ['#b45309', '#f97316'] },
  { id: 4011, article_id: 111, kind: 'cover', palette: ['#334155', '#64748b'] },
  { id: 4013, article_id: 113, kind: 'cover', palette: ['#7c2d12', '#ea580c'] },
  { id: 4101, article_id: 109, kind: 'diagram' },
  { id: 4201, article_id: 109, kind: 'audio' },
  // 未发布文章的封面：匿名必须 404（BR-MEDIA-003）
  { id: 4020, article_id: 120, kind: 'cover', palette: ['#111827', '#ef4444'] },
  // 已上传但从未关联：匿名必须 404
  { id: 4030, article_id: 109, kind: 'cover', palette: ['#000000', '#ffffff'], unreferenced: true },
]

const ARTICLE_109 = `JVM 的 Full GC 告警往往在凌晨出现，第二天早上只剩一张监控截图。本文按时间顺序复盘一次真实的排查过程。

## 现象

凌晨两点，订单服务连续 4 次 Full GC，每次停顿超过 2 秒。老年代在 40 分钟内从 35% 涨到 98%。

![调用链示意](/api/media/4101)

## 复盘视频

下面是排查过程的录屏（直链 mp4，前台用原生播放器内嵌，不自动播放）：

[排查过程录屏](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)

## 定位

用 \`jmap -histo:live\` 看到大量 \`ThreadLocalMap$Entry\`，最终定位到一个忘记 \`remove()\` 的 ThreadLocal：

\`\`\`java
private static final ThreadLocal<Context> CTX = new ThreadLocal<>();

public void handle(Request req) {
    CTX.set(new Context(req));
    try {
        doHandle(req);
    } finally {
        CTX.remove(); // 修复：线程池复用线程时必须清理
    }
}
\`\`\`

> 线程池里的线程不会销毁，ThreadLocal 里的大对象会跟着线程一直活下去。

## 代码示例中的 HTML 只作文本

代码块里的 \`<script>\` 示例只显示、不执行：

\`\`\`html
<script>alert('这只是示例文本')</script>
<iframe src="https://example.com"></iframe>
\`\`\`

## 参考

- [Java 官方文档：ThreadLocal](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/ThreadLocal.html)
- [站内：Spring Boot 入门教程](/posts/108)
`

const ARTICLE_199 = `本文仅存在于前端契约 mock，用来自检前台渲染安全规则。真实后端在保存时就会拒绝下列内容（BR-MEDIA-006、TU-24），这里验证即使出现，前台也不跟从、不加载。

## 应当正常

- https 外链：[MDN](https://developer.mozilla.org/)（新窗口，rel=noopener noreferrer）
- 站内链接：[回到首页](/)
- 本站媒体图片：

![示意图](/api/media/4101)

- https 直链视频（webm）：[花朵演示](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm)

## 应当被拦下

- http 链接：[不安全链接](http://example.com/page)
- 协议相对：[协议相对](//example.com/page)
- javascript：[点我](javascript:alert(1))
- data：[数据](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)
- http 视频：[http 视频](http://example.com/movie.mp4)
- 相对路径视频：[相对视频](movie.mp4)
- 外部图片：![外部图片](https://picsum.photos/200)
- 媒体出口 404 的图片：![已失效图片](/api/media/9999)
- 代码区域外的原始 HTML：<script>alert('xss')</script> <iframe src="https://example.com"></iframe> <img src=x onerror=alert(1)>
`

const short = (title) => `${title}的正文。\n\n## 背景\n\n这是一段契约 mock 正文，用来占位。\n\n## 结论\n\n- 要点一\n- 要点二\n`

// status：DRAFT / PENDING_REVIEW / REJECTED / SCHEDULED / PUBLISHED / UNPUBLISHED
export const articles = [
  { id: 101, title: '从零设计一个支持定时发布的内容审核流', excerpt: '状态机、留痕与并发控制：我们如何保证「已发布」只有审核通过这一个入口。', category_id: 5, tag_ids: [12], cover_media_id: 4001, audio_media_id: null, published_at: '2026-11-07T10:30:00+08:00', status: 'PUBLISHED', author_id: 11, submission_round: 3, reject_reason: '第一轮：缺少状态图', content: short('审核流设计') },
  { id: 102, title: 'TypeScript 5.x 类型体操的边界在哪里', excerpt: '', category_id: 2, tag_ids: [4], cover_media_id: 4002, audio_media_id: null, published_at: '2026-11-05T09:00:00+08:00', status: 'PUBLISHED', author_id: 12, content: short('类型体操') },
  { id: 103, title: '无封面、无摘要、无标签的文章也要排版正常', excerpt: '', category_id: 3, tag_ids: [], cover_media_id: null, audio_media_id: null, published_at: '2026-11-03T20:15:00+08:00', status: 'PUBLISHED', author_id: 13, content: short('空值排版') },
  { id: 104, title: 'Kubernetes HPA 与 KEDA：事件驱动扩缩容对比', excerpt: '在消息积压场景下，基于 CPU 的 HPA 总是慢半拍。我们用 KEDA 把扩容时间从 3 分钟降到 20 秒。', category_id: 4, tag_ids: [7, 8], cover_media_id: 4004, audio_media_id: null, published_at: '2026-11-02T14:00:00+08:00', status: 'PUBLISHED', author_id: 14, content: short('HPA 与 KEDA') },
  { id: 105, title: 'Vite 插件开发入门：从 transform 钩子讲起', excerpt: '通过实现一个自动注入版本号的小插件，理解 Vite 插件的执行顺序和常用钩子。', category_id: 2, tag_ids: [11, 4, 3], cover_media_id: 4005, audio_media_id: null, published_at: '2026-10-24T11:00:00+08:00', status: 'PUBLISHED', author_id: 12, content: short('Vite 插件') },
  { id: 106, title: 'Redis 缓存击穿、穿透与雪崩的工程化应对', excerpt: '布隆过滤器、互斥重建与随机过期时间，三板斧之外还需要什么？', category_id: 3, tag_ids: [6, 9], cover_media_id: 4006, audio_media_id: null, published_at: '2026-09-30T16:40:00+08:00', status: 'PUBLISHED', author_id: 13, content: short('缓存三问题') },
  { id: 107, title: 'RAG 检索增强的召回率评估方法', excerpt: '构建评测集、计算 Recall@K 与 MRR，并在线上灰度验证。', category_id: 6, tag_ids: [13, 14], cover_media_id: 4007, audio_media_id: null, published_at: '2026-09-20T08:30:00+08:00', status: 'PUBLISHED', author_id: 15, content: short('RAG 评估') },
  { id: 108, title: 'Spring Boot 入门教程：从 Starter 到自动配置', excerpt: '', category_id: 1, tag_ids: [2, 1], cover_media_id: 4008, audio_media_id: null, published_at: '2026-09-18T15:20:00+08:00', status: 'PUBLISHED', author_id: 11, content: short('Spring Boot 入门') },
  { id: 109, title: '一次 JVM Full GC 告警的排查全过程', excerpt: '凌晨两点的告警，一份 4GB 的堆转储和一个被忽略的 ThreadLocal——从现象到根因的完整复盘。', category_id: 1, tag_ids: [1, 10, 9], cover_media_id: 4009, audio_media_id: 4201, published_at: '2026-11-09T21:05:00+08:00', status: 'PUBLISHED', author_id: 11, submission_round: 2, reject_reason: '缺少堆转储截图', unpublish_reason: '临时下架补充数据', content: ARTICLE_109 },
  { id: 110, title: 'MySQL 在线 DDL 的三种方案对比', excerpt: 'INSTANT、INPLACE 与 gh-ost：大表加字段时如何避免锁表与主从延迟。', category_id: 3, tag_ids: [5], cover_media_id: 4010, audio_media_id: null, published_at: '2026-08-12T10:00:00+08:00', status: 'PUBLISHED', author_id: 13, content: short('在线 DDL') },
  { id: 111, title: '微服务拆分的反模式：分布式单体', excerpt: '服务拆得越多，发布反而越慢？识别分布式单体的五个信号。', category_id: 5, tag_ids: [12, 1], cover_media_id: 4011, audio_media_id: null, published_at: '2026-08-01T09:00:00+08:00', status: 'PUBLISHED', author_id: 14, content: short('分布式单体') },
  { id: 112, title: 'JVM 调优参数清单（Java 21）', excerpt: 'G1 与 ZGC 的常用参数及适用场景。', category_id: 1, tag_ids: [1, 10], cover_media_id: null, audio_media_id: null, published_at: '2026-07-21T19:00:00+08:00', status: 'PUBLISHED', author_id: 11, content: short('JVM 参数') },
  { id: 113, title: 'Docker 镜像瘦身实践', excerpt: '多阶段构建、distroless 与层缓存，把镜像从 1.2GB 压到 180MB。', category_id: 4, tag_ids: [8, 9], cover_media_id: 4013, audio_media_id: null, published_at: '2026-07-02T13:00:00+08:00', status: 'PUBLISHED', author_id: 14, content: short('镜像瘦身') },
  // 114：标题 / 摘要含 LIKE 通配符 % 与 _，用来验证搜索 q 按字面匹配（api-spec §11.1）
  { id: 114, title: 'SQL 里 LIKE 的 % 与 _ 通配符陷阱', excerpt: '按 user_name 搜索时，下划线也会匹配任意单个字符；命中率 100% 不一定是好事。', category_id: 3, tag_ids: [5], cover_media_id: null, audio_media_id: null, published_at: '2026-06-15T10:00:00+08:00', status: 'PUBLISHED', author_id: 13, content: short('LIKE 通配符') },
  { id: 199, title: '【Mock】前台渲染安全自检', excerpt: '仅存在于前端契约 mock，用来检查危险链接、外部图片与视频内嵌规则。', category_id: 5, tag_ids: [], cover_media_id: null, audio_media_id: null, published_at: '2026-06-01T09:00:00+08:00', status: 'PUBLISHED', author_id: 11, content: ARTICLE_199 },
  // 以下五种非已发布状态：列表不出现，详情与媒体一律 404
  { id: 120, title: '草稿：尚未提交的文章', excerpt: '', category_id: 7, tag_ids: [1, 15], cover_media_id: 4020, audio_media_id: null, published_at: null, status: 'DRAFT', author_id: 11, content: '草稿' },
  { id: 121, title: '待审核的文章', excerpt: '', category_id: 1, tag_ids: [1], cover_media_id: null, audio_media_id: null, published_at: null, status: 'PENDING_REVIEW', author_id: 12, content: '待审' },
  { id: 122, title: '被驳回的文章', excerpt: '', category_id: 2, tag_ids: [3], cover_media_id: null, audio_media_id: null, published_at: null, status: 'REJECTED', author_id: 12, reject_reason: '内容不完整', content: '驳回' },
  { id: 123, title: '待发布的文章', excerpt: '', category_id: 2, tag_ids: [3], cover_media_id: null, audio_media_id: null, published_at: null, scheduled_publish_time: '2026-12-01T09:00:00+08:00', status: 'SCHEDULED', author_id: 13, content: '待发布' },
  { id: 124, title: '已下架的文章', excerpt: '', category_id: 1, tag_ids: [1, 10], cover_media_id: null, audio_media_id: null, published_at: '2026-10-01T09:00:00+08:00', status: 'UNPUBLISHED', author_id: 11, unpublish_reason: '涉及敏感信息', content: '下架' },
]

// ─── 管理员端补充数据（供 admin mock handlers 使用，不影响公开接口） ───

// 用户表：只有 id / username / role，敏感字段（密码哈希等）不进 mock
export const authors = [
  { id: 1, username: 'admin', role: 'ADMIN' },
  { id: 11, username: 'zhangsan', role: 'EDITOR' },
  { id: 12, username: 'lisi', role: 'EDITOR' },
  { id: 13, username: 'wangwu', role: 'EDITOR' },
  { id: 14, username: 'zhaoliu', role: 'EDITOR' },
  { id: 15, username: 'sunqi', role: 'EDITOR' },
  // 名下没有文章，可用于角色提升演示（BR-ROLE-005）
  { id: 16, username: 'chenba', role: 'EDITOR' },
]

// 审核标准：服务端配置项（api-spec §7.2；版本见 SRS §6.1.1，类别见 BR-CONTENT-005 / api-spec §4.1）
export const review_standard = {
  review_standard_version: 'CMS-CONTENT-REVIEW-1.0',
  reject_categories: [
    { value: 'ILLEGAL', label: '违法违规' },
    { value: 'AUTHENTICITY_SOURCE', label: '真实性／来源' },
    { value: 'COPYRIGHT_PRIVACY', label: '版权／隐私' },
    { value: 'MINOR_VULGAR_VIOLENCE', label: '未成年人／低俗／暴力' },
    { value: 'DISCRIMINATION_HARASSMENT', label: '歧视／骚扰／引战' },
    { value: 'SPAM_MARKETING', label: '垃圾／营销' },
    { value: 'QUALITY_POSITIONING', label: '内容质量／博客定位' },
    { value: 'OTHER', label: '其他' },
  ],
}

// 给文章补 admin 端需要的时间戳与审核字段
const ADMIN_FIELDS = {
  101: { created_at: '2026-09-10T08:00:00+08:00', updated_at: '2026-11-06T22:00:00+08:00' },
  102: { created_at: '2026-10-15T10:00:00+08:00', updated_at: '2026-11-04T15:00:00+08:00' },
  103: { created_at: '2026-10-20T14:00:00+08:00', updated_at: '2026-11-02T20:15:00+08:00' },
  104: { created_at: '2026-09-28T09:00:00+08:00', updated_at: '2026-11-01T14:00:00+08:00' },
  105: { created_at: '2026-10-01T11:00:00+08:00', updated_at: '2026-10-23T11:00:00+08:00' },
  106: { created_at: '2026-09-12T16:00:00+08:00', updated_at: '2026-09-29T16:40:00+08:00' },
  107: { created_at: '2026-09-05T08:00:00+08:00', updated_at: '2026-09-19T08:30:00+08:00' },
  108: { created_at: '2026-08-20T10:00:00+08:00', updated_at: '2026-09-17T15:20:00+08:00' },
  109: { created_at: '2026-10-01T09:00:00+08:00', updated_at: '2026-11-08T21:05:00+08:00' },
  110: { created_at: '2026-07-15T09:00:00+08:00', updated_at: '2026-08-11T10:00:00+08:00' },
  111: { created_at: '2026-07-20T09:00:00+08:00', updated_at: '2026-07-31T09:00:00+08:00' },
  112: { created_at: '2026-06-15T19:00:00+08:00', updated_at: '2026-07-20T19:00:00+08:00' },
  113: { created_at: '2026-06-01T13:00:00+08:00', updated_at: '2026-07-01T13:00:00+08:00' },
  114: { created_at: '2026-06-01T10:00:00+08:00', updated_at: '2026-06-14T10:00:00+08:00' },
  199: { created_at: '2026-05-01T09:00:00+08:00', updated_at: '2026-05-31T09:00:00+08:00' },
  120: { created_at: '2026-11-01T10:00:00+08:00', updated_at: '2026-11-10T10:00:00+08:00' },
  121: { created_at: '2026-11-10T08:00:00+08:00', updated_at: '2026-11-15T08:00:00+08:00', submitted_at: '2026-11-15T08:00:00+08:00' },
  122: { created_at: '2026-10-20T09:00:00+08:00', updated_at: '2026-11-12T10:00:00+08:00', submitted_at: '2026-11-08T09:00:00+08:00' },
  123: { created_at: '2026-10-15T09:00:00+08:00', updated_at: '2026-11-14T09:00:00+08:00' },
  124: { created_at: '2026-09-01T09:00:00+08:00', updated_at: '2026-10-01T10:00:00+08:00' },
}

export function getAdminArticleFields(id) {
  return ADMIN_FIELDS[id] || {}
}

// 留痕（AuditLog，api-spec §4.13 / §8.1）：字段齐全，「不写入」的字段一律为 null。
// 动作只有 §4.1 AuditAction 的 7 类；current_submission_id = 本轮 SUBMIT 留痕的 id（§4.10）。
const ADMIN_ACTOR = { type: 'USER', id: 1, username: 'admin' }
const SYSTEM_ACTOR = { type: 'SYSTEM', id: null, username: null }
const userActor = (id) => {
  const u = authors.find((a) => a.id === id)
  return { type: 'USER', id: u.id, username: u.username }
}
const REVIEW_STD = review_standard.review_standard_version

export function auditLog(id, article_id, action, operator, operated_at, extra = {}) {
  return {
    id,
    article_id,
    action,
    operator,
    operated_at,
    reason: null,
    reject_category: null,
    review_standard_version: null,
    published_at: null,
    schedule_change: null,
    related_approval_id: null,
    related_submission_id: null,
    ...extra,
  }
}

export const audit_logs = [
  // 109（作者 zhangsan）：驳回 → 重提通过 → 下架 → 重提通过
  auditLog(901, 109, 'SUBMIT', userActor(11), '2026-10-15T10:00:00+08:00'),
  auditLog(902, 109, 'REJECT', ADMIN_ACTOR, '2026-10-16T11:00:00+08:00', { reason: '缺少堆转储截图', reject_category: 'QUALITY_POSITIONING', review_standard_version: REVIEW_STD, related_submission_id: 901 }),
  auditLog(903, 109, 'SUBMIT', userActor(11), '2026-11-01T09:00:00+08:00'),
  auditLog(904, 109, 'APPROVE', ADMIN_ACTOR, '2026-11-05T15:00:00+08:00', { review_standard_version: REVIEW_STD, published_at: '2026-11-05T15:00:00+08:00', related_submission_id: 903 }),
  auditLog(905, 109, 'UNPUBLISH', ADMIN_ACTOR, '2026-11-09T20:00:00+08:00', { reason: '临时下架补充数据', review_standard_version: REVIEW_STD }),
  auditLog(906, 109, 'SUBMIT', userActor(11), '2026-11-09T21:00:00+08:00'),
  auditLog(907, 109, 'APPROVE', ADMIN_ACTOR, '2026-11-09T21:05:00+08:00', { review_standard_version: REVIEW_STD, published_at: '2026-11-09T21:05:00+08:00', related_submission_id: 906 }),
  // 104（作者 zhaoliu）：通过时预定时间在未来 → 改期 → 到期自动发布
  auditLog(910, 104, 'SUBMIT', userActor(14), '2026-10-28T10:00:00+08:00'),
  auditLog(911, 104, 'APPROVE', ADMIN_ACTOR, '2026-10-29T09:30:00+08:00', { review_standard_version: REVIEW_STD, related_submission_id: 910 }),
  auditLog(912, 104, 'RESCHEDULE', userActor(14), '2026-10-30T18:00:00+08:00', { schedule_change: { from: '2026-11-01T09:00:00+08:00', to: '2026-11-02T14:00:00+08:00' } }),
  auditLog(913, 104, 'AUTO_PUBLISH', SYSTEM_ACTOR, '2026-11-02T14:00:00+08:00', { published_at: '2026-11-02T14:00:00+08:00', related_approval_id: 911 }),
  // 121（作者 lisi，待审核）：本轮提交 = 1001
  auditLog(1001, 121, 'SUBMIT', userActor(12), '2026-11-15T08:00:00+08:00'),
  // 122（作者 lisi，被驳回）
  auditLog(1002, 122, 'SUBMIT', userActor(12), '2026-11-08T09:00:00+08:00'),
  auditLog(1003, 122, 'REJECT', ADMIN_ACTOR, '2026-11-12T10:00:00+08:00', { reason: '正文缺少实际案例', reject_category: 'QUALITY_POSITIONING', review_standard_version: REVIEW_STD, related_submission_id: 1002 }),
  // 123（作者 wangwu，待发布）：提交 → 通过（预定时间在未来）→ 撤回后重提 → 通过
  auditLog(1010, 123, 'SUBMIT', userActor(13), '2026-11-10T09:00:00+08:00'),
  auditLog(1011, 123, 'APPROVE', ADMIN_ACTOR, '2026-11-11T10:00:00+08:00', { review_standard_version: REVIEW_STD, related_submission_id: 1010 }),
  auditLog(1012, 123, 'WITHDRAW', userActor(13), '2026-11-12T11:00:00+08:00'),
  auditLog(1013, 123, 'SUBMIT', userActor(13), '2026-11-13T09:00:00+08:00'),
  auditLog(1014, 123, 'APPROVE', ADMIN_ACTOR, '2026-11-14T09:00:00+08:00', { review_standard_version: REVIEW_STD, related_submission_id: 1013 }),
  // 124（作者 zhangsan，已下架）
  auditLog(1020, 124, 'SUBMIT', userActor(11), '2026-09-30T09:00:00+08:00'),
  auditLog(1021, 124, 'APPROVE', ADMIN_ACTOR, '2026-10-01T09:00:00+08:00', { review_standard_version: REVIEW_STD, published_at: '2026-10-01T09:00:00+08:00', related_submission_id: 1020 }),
  auditLog(1022, 124, 'UNPUBLISH', ADMIN_ACTOR, '2026-10-01T10:00:00+08:00', { reason: '涉及敏感信息', review_standard_version: REVIEW_STD }),
]
