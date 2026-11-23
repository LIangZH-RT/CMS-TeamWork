# 设计图清单

> 依据 SRS v2.6 补齐课程评分项方案 §6.1。图用 mermaid 源维护（放在下表「源」所指文档里，或本目录的 `.md` / `.mmd` 文件），导出 PNG 放进结题报告。负责人画图，审核人核对与代码一致。

| # | 图 | 内容 | 负责 | 审核 | 源 / 状态 |
|---|---|---|---|---|---|
| 1 | 系统架构图 | 浏览器 / Vue → Nginx → Tomcat 10.1 上的 Spring MVC WAR（DispatcherServlet → 登录 / CSRF 拦截器 → 日志切面 → 权限切面 → Controller → Service → MP 拦截器 → Mapper）→ MySQL / 本地文件存储；`@Scheduled` 任务 | A | B | `doc/context/architecture.md` §1（初稿已有） |
| 2 | E-R 图 | 16 张表、PK/FK/UK | A 汇总 | 各表所有者 | `doc/db/schema.md` §3（初稿已有，报告版补全字段） |
| 3 | 流程图 1 | 文章状态机（6 状态 11 条迁移） | G | D | 待画 |
| 4 | 流程图 2 | 提交 → 审核 → 立即 / 定时发布 → 下架 → 重新提交 | D | G | 待画 |
| 5 | 流程图 3 | 请求鉴权链：401（AuthInterceptor）→ 403（CsrfInterceptor）→ 权限闸 404 → 归属闸 404 → 状态闸 409 | B | H | `doc/context/architecture.md` §5.2（初稿已有） |
| 6 | 流程图 4 | 媒体上传（校验、落盘、关联）与下载判权 | E | C | 待画 |
| 7 | 流程图 5 | 批量审核逐条处理与结果汇总 | D | G | 待画 |
| 8 | 流程图 6 | 分类删除 / 停用判定 | F | C | 待画 |
| 9 | 用例图 | SRS §8.4，v2.6 加用户管理与操作日志（UC20～UC25） | A | — | `CMS-SRS.md` §8.4 |

`traceability-check.py` 仍按 v2.5 的条目数硬编码，目前暂停使用（architecture 开头说明），v2.6 未更新。
