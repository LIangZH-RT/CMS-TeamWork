# Git 提交与协作规范

> 版本 v1.1 ｜ 2026-10-10 ｜ 适用范围：本仓库全部提交、分支与合并操作
>
> 依据 **Conventional Commits 1.0.0**：<https://www.conventionalcommits.org/en/v1.0.0/>（[简体中文版](https://www.conventionalcommits.org/zh-hans/v1.0.0/)）

---

## 1 提交信息格式

```
<type>[(scope)][!]: <描述>

[正文]

[脚注]
```

| 部分 | 要求 |
|---|---|
| `<type>` | 必须，小写英文，取自 §3 取值表 |
| `(scope)` | 可选，小写，取自 §4 取值表；拿不准就省略 |
| `!` | 可选，表示破坏性变更，写在类型/scope 之后、冒号之前 |
| `: ` | 必须，**冒号 + 一个空格** |
| `<描述>` | 必须，紧跟 `: `，一行写清「做了什么」 |
| 正文 | 可选，与描述**空一行**；可多段 |
| 脚注 | 可选，与正文**空一行**；可多条 |

示例：

```
docs(srs): 修正 4.4 拒绝口径为「角色闸/归属闸 404、状态闸 409」

原文的「所有拒绝一律返回 404」与 8.3 关键需求、9.1 第 5 条冲突，
改为按闸门分别规定，并单列媒体出口一律 404。

Refs: #12
```

## 2 提交信息规则

1. 提交信息**必须**以类型前缀开头，类型后**必须**是 `": "`。
2. `feat` 只用于**新增功能**；`fix` 只用于**修复缺陷**。
3. 描述用中文、**动词开头**（新增／修正／删除／调整／重构／补充／收紧）、**不加句号**、不超过 50 字。
4. 正文写「**为什么改**」与「影响范围」；规则类文档的改动要写出依据（哪条 `BR-*`／`FR-*`／验收标准）。单行不超过 72 个半角字符。
5. 脚注格式为 `词元: 值` 或 `词元 #值`；词元中的空格写成 `-`（`BREAKING CHANGE` 例外）。
6. 破坏性变更**必须**用前缀 `!` 或脚注 `BREAKING CHANGE: <描述>` 标出，两者至少其一；`BREAKING CHANGE` **必须**大写，`BREAKING-CHANGE` 与它同义。任意类型都可以是破坏性变更。
7. 文件编码统一 **UTF-8 无 BOM**；文本文件换行符入库为 **LF**。
8. 描述不得写成「更新文件」「日常提交」这类无信息量的内容。

## 3 类型取值表

| 类型 | 用于 | 语义化版本影响 |
|---|---|---|
| `feat` | 新增对使用者可见的功能 | MINOR |
| `fix` | 修复缺陷 | PATCH |
| `docs` | 只改文档：`CMS-SRS.md`、`doc/**` | 无 |
| `style` | 不影响语义的格式、空白、命名调整 | 无 |
| `refactor` | 既不加功能也不修缺陷的结构调整 | 无 |
| `perf` | 性能优化 | 无 |
| `test` | 新增或修改测试 | 无 |
| `build` | 构建系统与依赖：`pom.xml`、`package.json` | 无 |
| `ci` | 持续集成配置与脚本 | 无 |
| `chore` | 以上都不是的杂项：`.gitignore`、目录搬迁、工具配置 | 无 |
| `revert` | 还原此前的提交（见 §6） | 视被还原提交而定 |

含 `BREAKING CHANGE` 的提交，不论类型一律对应 MAJOR。

## 4 范围 scope 取值表

| 分类 | 取值 |
|---|---|
| 需求与文档 | `srs`、`overview`、`architecture`、`tracker`、`traceability`、`git` |
| 后端功能域 | `auth`、`security`、`article`、`taxonomy`、`media`、`audit`、`publicapi`、`task`、`common`、`config`、`db` |
| 前端 | `web` |
| 构建与依赖 | `build`、`deps` |

取值不强制封闭，但不得出现同义异名（如 `srs` 与 `SRS`）。横跨多个 scope 时优先拆成多个提交，不可拆则省略 scope。

## 5 提交粒度与分支

**粒度**

1. 一次提交只做一件事；若一条提交同时符合多个类型，说明该拆开。
2. 文档改动与代码改动分开提交。
3. 每个提交都要能独立回滚：单独 `revert` 后仓库仍自洽。
4. 提交前用 `git status` 核对暂存区，确认没有把删除、重命名误带进来。

**分支**

1. `main` 是唯一长期分支，任何时刻都应可用。
2. 工作分支命名 `<type>/<kebab-case 描述>`，如 `docs/git-standards`、`feat/article-submit`、`fix/audit-restrict`。
3. 单人开发且改动集中时可直接提交 `main`；有他人同时改同一批文件、或改动跨多天未完成时，必须开分支。

## 6 还原提交（revert）

用 `revert` 类型，描述写被还原的那条提交，脚注 `Refs:` 指向其哈希：

```
revert: 还原「docs(srs): 修正 4.4 拒绝口径」

Refs: 3f2a1b9
```

## 7 合并与历史改写

**保持线性历史**：合并用 `rebase` 或 `squash`，不产生 `Merge branch 'xxx'` 提交。

| 状态 | 允许 | 禁止 |
|---|---|---|
| 未推送 | `git commit --amend` 改信息、`git rebase -i` 拆分/合并/改信息 | —— |
| 已推送 | 用 `revert:` 提交撤销 | 改写历史；确需改写时必须 `--force-with-lease`（禁止裸 `--force`）并事先通知协作者 |

改写前先确认推送状态：`git status -sb` 的 `ahead N` 与 `git log origin/main -1`。改写后**不要在文档里写提交号**——哈希会作废，变成悬空引用。

## 8 换行符

仓库现为「索引 LF、工作区 CRLF」，且没有 `.gitattributes`。**尚未执行**：补一份 `.gitattributes` 把规则固定到仓库，避免换机器后出现整文件级假 diff：

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
```

## 9 校验

规范需自动拦截，两条路线按工具链选择，**当前均未安装**。

**A. 无依赖的 `commit-msg` 钩子**（新建 `.githooks/commit-msg`）：

```sh
#!/bin/sh
msg=$(head -n1 "$1")
printf '%s' "$msg" | grep -Eq '^[a-z]+(\([a-z0-9-]+\))?!?: .+' || {
  echo "提交信息格式错误：应为 <type>[(scope)][!]: <描述>（冒号后必须有空格），见 doc/context/git-standards.md" >&2
  exit 1
}
```

启用：`git config core.hooksPath .githooks`

**B. commitlint + husky**（需 Node 工具链）：

```sh
npm i -D @commitlint/cli @commitlint/config-conventional husky
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.mjs
```

新增类型时需同步该配置，否则钩子会拒绝合法提交。

## 10 与其它文档的关系

| 文档 | 关系 |
|---|---|
| `CMS-SRS.md` | 唯一主文档；涉及需求取值的改动以它为准，正文引用其章节号 |
| `doc/context/progress-tracker.md` | 只存当前状态快照，不保留历史副本；「为什么改」写在提交信息里 |
| `doc/context/architecture.md` | 内部架构基线；决策变更需同步 progress-tracker |
| `doc/context/project-overview.md` | 背景与取舍记录（已降级，不再是规则真源） |
| `doc/design/traceability-check.py` | 追溯性校验脚本，目前已暂停使用 |

与本文件冲突时：提交与分支行为以本文件为准，需求取值以 `CMS-SRS.md` 为准。
