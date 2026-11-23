# 结题报告大纲（占位）

> 依据 SRS v2.6 补齐课程评分项方案 §6.2。本文件只列章节结构与材料来源，**正文由各负责人自己写**（个人实验总结必须本人独立撰写），A 汇总成 `doc/report/结题报告.md`。

| 章 | 内容 | 材料来源 | 执笔 |
|---|---|---|---|
| 1 | 概述：项目背景、目标、团队分工表 | `CMS-SRS.md` §1～§2、`doc/context/team-division.md` §0 | A |
| 2 | 选型依据：从实验二 SSM 到 Spring 6 + Spring MVC + MyBatis-Plus（不用 Spring Boot、Spring Security，手工装配、WAR 部署 Tomcat 10.1）；拦截器（认证、CSRF）+ AOP（权限、日志）分工理由；单一容器与 `ContextLoaderListener` 的取舍；MySQL 8 与 Flyway | `architecture.md` §2（含 §2.10）、§5.1、§5.2、§8 | A（B 审） |
| 3 | 需求分析：SRS v2.6 摘要（角色、权限矩阵、状态机、业务规则） | `CMS-SRS.md` §4～§7 | A |
| 4 | 数据库设计：E-R 图、16 张表字段、范式论证、索引与约束、逻辑删除方案 | `doc/db/schema.md` | A 汇总，各表所有者核对 |
| 5 | 功能详解：按模块（认证与权限、用户管理、分类、文章、审核、媒体、日志、公开接口），每个模块含接口、流程图、关键代码片段 | `api-spec.md`、`doc/design/README.md` | 各模块负责人 |
| 6 | 重难点：三道闸门与 404 收口、并发与乐观锁、轮次校验、批量逐条事务、N+1、逻辑删除与唯一键 | `architecture.md`、各人 PR | 相关负责人 |
| 7 | 解决方案：每个难点的方案与前后对比、EXPLAIN | `schema.md` 附录 A、各人 PR | 相关负责人 |
| 8 | AI 优化总结：各成员 AI 用在哪、人工改了什么、AI 出错的例子与自己如何排查 | `doc/ai-log/` | 每人一节 |
| 9 | 部署说明与交付清单 | `deploy/`（待建） | B、A |
| 10 | 个人实验总结（每人一节） | — | 每人本人 |
