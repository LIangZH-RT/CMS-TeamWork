# Git 提交与协作规范

> 版本 v1.0 ｜ 制定日期 2026-10-10 ｜ 适用范围：本仓库（`CMS-TeamWork`）的全部提交、分支与合并操作
>
> 依据 **Conventional Commits 1.0.0**：<https://www.conventionalcommits.org/en/v1.0.0/>（[简体中文版](https://www.conventionalcommits.org/zh-hans/v1.0.0/)）。本文件把该规范落成本仓库可直接执行的规定。
>
> 本文件是**提交信息、分支命名与历史改写行为的唯一规范来源**。代码评审、钩子校验与将来的 CI 一律以本文件为准。

---

## 0 一页速查

```
<type>[(scope)][!]: <描述>

[正文：为什么改、影响什么]

[脚注：BREAKING CHANGE / Refs / Reviewed-by]
```

| 项 | 规定 |
|---|---|
| 第 1 行 | `<type>[(scope)][!]: ` + 描述，**必须**有类型前缀与「冒号+空格」 |
| 类型 | 小写英文，取自 §1 的取值表 |
| 范围 scope | 可选，小写，取自 §2 的取值表；拿不准就省略 |
| 描述 | 中文，动词开头，不加句号，一句话说清「做了什么」 |
| 正文 | 与描述**空一行**；说清「为什么」与影响范围 |
| 脚注 | 与正文**空一行**；`token: 值` 或 `token #值` |
| 破坏性变更 | `!` 紧贴类型/范围之后、冒号之前；或用脚注 `BREAKING CHANGE:` |
| 编码 | **UTF-8，不带 BOM**；信息内不出现全角冒号充当分隔符 |

单条示例：

```
docs(srs): 修正 4.4 拒绝口径为「角色闸/归属闸 404、状态闸 409」

原文写「所有拒绝一律返回 404」，与 8.3 各关键需求、9.1 第 5 条要求的
非法迁移 409 冲突。改为按闸门分别规定，并单列媒体出口一律 404。

Refs: #12
```

---

## 1 提交信息规范（Commit Message）

### 1.1 结构

一个提交信息由三部分组成，**顺序固定、段落之间各空一行**：

```
<type>[(scope)][!]: <描述>          ← 必需，第一行，且只能有一行
                                     ← 空行
<正文>                               ← 可选，可多段
                                     ← 空行
<脚注 1>
<脚注 2>                             ← 可选，可多条
```

### 1.2 硬性规则（对应规范原文的 MUST，逐条可校验）

1. 提交信息**必须**以**类型**（名词，如 `feat`、`fix`）开头，后接**可选**的 `(scope)`、**可选**的 `!`，再接**必需的「冒号 + 空格」**（即 `: `）。
2. `feat` **必须**用于「给应用或库增加新功能」的提交。
3. `fix` **必须**用于「修复缺陷」的提交。
4. `scope` **可以**提供，写在类型后的括号里，内容应是描述代码库某一部分的名词，如 `fix(parser):`。
5. 描述**必须**紧跟在 `: ` 之后，是对本次改动的简短总结。
6. 正文**可以**提供，**必须**与描述之间空一行。
7. 正文是自由格式，**可以**由任意多个换行分隔的段落组成。
8. 脚注**可以**提供一条或多条，位于正文之后、隔一个空行；每条脚注**必须**由「词元 + `: ` 或 ` #` + 值」组成（源自 `git trailer` 约定）。
9. 脚注词元中的空白**必须**写成 `-`（如 `Acked-by`），以区别于多段正文；**唯一例外**是 `BREAKING CHANGE`，它本身就允许带空格。
10. 脚注的值**可以**包含空格与换行；解析在遇到下一个合法词元/分隔符时终止。
11. 破坏性变更**必须**在类型/范围前缀中标出（`!`），或在脚注中标出，二者至少其一。
12. 若用脚注表达，**必须**是全大写的 `BREAKING CHANGE`，后接冒号、空格与描述。
13. 若用前缀表达，`!` **必须**紧贴冒号之前；此时脚注中的 `BREAKING CHANGE:` **可以**省略，破坏性由描述本身说明。
14. `feat`、`fix` 之外的**其它类型可以**使用（如 `docs: 更新参考文档`）。
15. 除 `BREAKING CHANGE` **必须**大写外，规范中各信息单元**不得**按大小写敏感处理（即 `Feat`、`FEAT` 在解析上等价）。
16. `BREAKING-CHANGE` 与 `BREAKING CHANGE` 作为脚注词元时**同义**。

> 上述「必须/可以」采用 RFC 2119 的含义。**本仓库另加两条**（§1.5、§1.6）：描述用中文；提交信息不带 BOM。

### 1.3 类型取值表

`feat` 与 `fix` 之外的类型不改变语义化版本含义，但改变提交的可读性与可筛选性——**不要把所有改动都塞进 `chore`**。

| 类型 | 用于 | 语义化版本影响 |
|---|---|---|
| `feat` | 新增对使用者可见的功能 | MINOR |
| `fix` | 修复缺陷 | PATCH |
| `docs` | 只改文档：`CMS-SRS.md`、`doc/**`、注释性说明 | 无 |
| `style` | 不影响语义的格式、空白、命名调整 | 无 |
| `refactor` | 既不加功能也不修缺陷的结构调整 | 无 |
| `perf` | 性能优化 | 无 |
| `test` | 新增或修改测试 | 无 |
| `build` | 构建系统与依赖：`pom.xml`、`package.json`、打包配置 | 无 |
| `ci` | 持续集成配置与脚本 | 无 |
| `chore` | 以上都不是的杂项：`.gitignore`、目录搬迁、工具配置 | 无 |
| `revert` | 还原此前的提交（见 §4） | 视被还原提交而定 |

含 `BREAKING CHANGE` 的提交**不论类型**一律对应 MAJOR（规范 FAQ：How does this relate to SemVer?）。

### 1.4 范围 scope 取值表

scope 表达「改动落在哪一块」。**取值不强制封闭**，但应优先复用下表，避免同义异名（不要同时出现 `srs` 与 `SRS`、`doc` 与 `docs` 两套写法）。

| 分类 | 可用取值 |
|---|---|
| 需求与文档 | `srs`（`CMS-SRS.md`）、`overview`、`architecture`、`tracker`、`traceability`、`git`（本文件） |
| 后端功能域 | `auth`、`security`、`article`、`taxonomy`、`media`、`audit`、`publicapi`、`task`、`common`、`config`、`db` |
| 前端 | `web` |
| 构建与依赖 | `build`、`deps` |

- 一次改动横跨多个 scope 时，**优先拆成多个提交**；确实不可拆则省略 scope。
- 文档改动落在具体章节时，用文档 scope 即可，不必把章节号写进 scope（章节号写进描述或正文）。

### 1.5 描述（description）写法

- **语言**：类型与 scope 用英文小写；**描述用中文**，与仓库其余文档一致。
- **动词开头**：`新增` / `修正` / `删除` / `调整` / `重构` / `补充` / `收紧`。
- **不加句号**，不用逗号把两件事串起来；一件事写一条。
- **长度**：整行建议不超过 50 个汉字（含前缀）。
- **不写废话**：`更新文件`、`修改了一些问题`、`日常提交` 一律不合格；要写清**具体改了什么**。
- 描述写「做了什么」，**不写「为什么」**——为什么属于正文。

### 1.6 正文（body）写法

- 与描述之间**必须空一行**，否则 Git 会把第二行当作描述的延续。
- 用无序列表分点，一点一件事；每点先说结论再说影响。
- **本项目特别要求**：规则类文档的改动，正文里要写出**依据**——哪一条业务规则（`BR-*`）、功能需求（`FR-*`）、验收标准或决策推动了这次改动。理由：`doc/context/progress-tracker.md` 只保存当前状态快照、不保留历史副本，提交信息是唯一的变更理由载体。
- 单行宽度建议不超过 72 个半角字符（约 36 个汉字），便于 `git log` 与终端阅读。

### 1.7 脚注（footer）写法

与正文之间**必须空一行**。词元中的空格写成 `-`（`BREAKING CHANGE` 例外）。

| 脚注 | 用途 |
|---|---|
| `BREAKING CHANGE: <描述>` | 破坏性变更（也可写 `BREAKING-CHANGE:`，两者同义） |
| `Refs: #123` 或 `Refs #123` | 关联 Issue / PR |
| `Reviewed-by: 姓名` | 评审人 |
| `Co-authored-by: 姓名 <邮箱>` | 协作署名 |

### 1.8 破坏性变更

两种写法**至少用一种**，也可以同时用：

```
feat(api)!: 移除直接写 status 字段的入口

BREAKING CHANGE: `PATCH /api/articles/{id}` 不再接受 status 字段；
状态只能经 5.2 的 11 条迁移路径改变（X-STATE-01）。
```

- `!` **紧贴**类型或 scope 之后、冒号之前：`feat!:`、`feat(api)!:`（不是 `feat !:`，也不在冒号之后）。
- 破坏性变更可以出现在**任何类型**上，不限于 `feat` / `fix`。

---

## 2 提交粒度

1. **一次提交只做一件事。** 官方 FAQ 的判据：若一条提交同时符合多个类型（既是 `feat` 又是 `fix`），说明它该被拆开。
2. **文档改动与代码改动分开提交**；规则改动与「顺手改的措辞」分开提交。
3. **每个提交都要能独立回滚**：单独 `revert` 该提交后，仓库仍应自洽（文档仍自相一致）。
4. 不要提交半成品：`src/` 里跑不起来的代码、只写了一半的文档章节，留在工作区，不要用「先提交再说」占位。
5. 提交前自检：`git status` 看**暂存区**（第一列的 `D`/`R` 最容易被忽略），确认没有把删除、重命名误带进来。

---

## 3 分支规范

- `main` 是唯一长期分支，**任何时刻都应可用**（文档仓库的标准是：文档之间自相一致）。
- 工作分支命名：`<type>/<kebab-case-描述>`，例如 `docs/git-standards`、`feat/article-submit`、`fix/audit-restrict`。
- 单人开发且改动只影响一处时，允许直接提交到 `main`；**出现以下任一情况必须开分支**：有第二个人同时在改同一批文件、改动跨多天未完成、或需要试错方案。

---

## 4 还原提交（revert）

`git revert` 默认生成的 `Revert "……"` **不符合本规范**，必须改写成：

```
revert: 还原「docs(srs): 修正 4.4 拒绝口径」

该口径与 9.1 第 5 条冲突，故撤销；后续按 #14 重新定义。

Refs: 3f2a1b9
```

- 类型用 `revert`，描述写清**被还原的那条提交的描述**。
- 脚注 `Refs:` 指向被还原提交的哈希；由于哈希会被改写（见 §5），正文里写哈希时以脚注形式给出，不要写进描述。

---

## 5 合并与历史改写

**保持线性历史。** 合并用 `rebase` 或 `squash`，不要产生 `Merge branch 'xxx'` 这类噪音提交——它们无法被归类，也没有信息量。

历史改写分两种情况，**判据是有没有推送**：

| 状态 | 允许 | 禁止 |
|---|---|---|
| **未推送** | `git commit --amend` 改信息、`git rebase -i` 拆分/合并/改信息 | —— |
| **已推送** | 用 `revert:` 提交撤销（§4） | 改写历史。确需改写时必须 `--force-with-lease`（**禁止裸 `--force`**）并事先通知协作者 |

**本仓库的两条额外约定：**

1. **改写历史后，文档里不要留提交号。** 本仓库的历史被变基/`amend` 重写过多次，写进文档的哈希会当场失效、变成悬空引用——`doc/context/progress-tracker.md` 已因此明令「本文件不记提交号」。
2. **改写前先确认推送状态**：`git status -sb` 看 `ahead N`，`git log origin/main -1` 看远端停在哪。只要远端还停在很早的提交，本地改写就是安全的；一旦推上去，改写就升级为需要强推的高风险操作。

---

## 6 本仓库已发生的违规实例（写规范时照抄，不要重犯）

| # | 实例 | 违反了哪条 | 正确写法 |
|---|---|---|---|
| 1 | `create repo and add docs`、`架构文档改为以 SRS 为主，并清理悬空引用` | §1.2 第 1 条：必须以类型前缀开头 | `docs(context): 新增项目文档初始版本`、`docs(architecture): 改为以 SRS 为主并清理悬空引用` |
| 2 | `docs:修正 CMS-SRS 正文的六处不一致` | §1.2 第 1 条：要求「冒号 + **空格**」 | `docs(srs): 修正 CMS-SRS 正文的六处不一致` |
| 3 | 上述两条提交信息以 **U+FEFF（BOM）** 开头（`git log --format=%s` 首字符即 `U+FEFF`） | §1.2 第 1 条（前缀前不得有任何字符）＋ §0 编码要求 | 用无 BOM 方式写提交信息，见下方命令 |
| 4 | 事故残留的 `Revert "create project"` | §4：还原提交要用 `revert:` 类型并改写描述 | `revert: 还原「create project」` ＋ `Refs: <sha>` |

**第 3 条的具体成因与规避（Windows）**：Windows PowerShell 5.1 的 `Out-File -Encoding utf8` **会写入 BOM**，用它生成提交信息文件就会把 BOM 带进提交信息。两种正确做法：

```powershell
# 方式一：PowerShell 7+（utf8NoBOM 是默认的无 BOM UTF-8）
$msg | Out-File -FilePath $tmp -Encoding utf8NoBOM

# 方式二：任何版本 PowerShell / .NET，显式指定无 BOM 编码
[System.IO.File]::WriteAllText($tmp, $msg, (New-Object System.Text.UTF8Encoding($false)))

git commit -F $tmp
```

自检：

```powershell
git log -1 --format=%s | ForEach-Object {
  'U+{0:X4}' -f [int]$_.ToCharArray()[0]      # 必须是 U+0064（d）之类，绝不能是 U+FEFF
}
```

---

## 7 换行符与文件编码

**现状（2026-10-10 实测）**：`core.autocrlf = true`，仓库**没有 `.gitattributes`**；除新增的 `doc/context/git-standards.md`（工作区 LF）外，所有文件都是「索引里 LF、工作区 CRLF」（`git ls-files --eol` 显示 `i/lf  w/crlf  attr/`）。由此带来两条要求：

1. **入库一律 LF。** 索引里的 LF 是正确状态，不要提交 CRLF 版本。
2. **换行符转换不能依赖本地配置。** 缺 `.gitattributes` 时，转换规则由每个人的 `core.autocrlf` 决定，换一台机器或换一个 IDE 就可能产生「整个文件都被改了一遍」的假 diff——评审时无法分辨真正的改动。

**建议（尚未执行，需确认后落地）**：提交一份 `.gitattributes`，由仓库而非本地配置决定换行符：

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
```

**文件编码**：所有文本文件一律 **UTF-8 无 BOM**（Markdown、Java 源码、SQL、脚本）。BOM 会让 `pom.xml` 解析失败、让脚本首行 `#!` 失效、让提交信息的类型前缀无法被 `^docs:` 之类的正则匹配（§6 实例 3）。

**Windows 上的两个坑（本仓库都踩过）**：

1. **Windows PowerShell 5.1 的默认编码是 ANSI（本机为 GBK）**：`Get-Content file` 读 UTF-8 文件会乱码，`(Get-Content file).Count` 甚至会给出**错误的行数**（实测对同一文件报 207 行，实际 286 行）。读文件一律显式指定编码：`Get-Content -Encoding UTF8 file`；需要精确校验时用 `git cat-file blob HEAD:<path>` 交给按字节解析的工具。
2. **`Out-File -Encoding utf8` 在 PowerShell 5.1 下会写入 BOM**（PS 7+ 的 `utf8` 才是无 BOM）。要生成无 BOM 文件，用 §6 给出的 `[System.IO.File]::WriteAllText` 写法。

---

## 8 校验工具

规范要能自动挡住，否则迟早凭自觉。两条路线，按仓库当前工具链选择：

**路线 A（无依赖，当前可用）——`commit-msg` 钩子。** 新建 `.githooks/commit-msg`：

```sh
#!/bin/sh
msg=$(head -n1 "$1")
printf '%s' "$msg" | grep -Eq '^[a-z]+(\([a-z0-9-]+\))?!?: .+' || {
  echo "提交信息格式错误：应为 <type>[(scope)][!]: <描述>（冒号后必须有空格），见 doc/context/git-standards.md" >&2
  exit 1
}
```

启用：

```sh
git config core.hooksPath .githooks
```

**路线 B（建立前端工具链之后）——commitlint + husky。**

```sh
npm i -D @commitlint/cli @commitlint/config-conventional husky
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.mjs
```

> 注意：`@commitlint/config-conventional` 的默认规则集**要求描述非空、类型取自已登记的枚举**，与本文件 §1.3 的取值表一致；若将来新增类型，需同步该配置，否则钩子会拒绝合法提交。
>
> **当前状态：两条路线都尚未安装。** 本仓库现为 Maven（`pom.xml`）且 `src/` 为空，Node 工具链尚未建立，因此现阶段规范靠人工遵守。

---

## 9 与其它文档的关系

| 文档 | 关系 |
|---|---|
| `CMS-SRS.md` | **唯一主文档**。提交里涉及需求取值的改动，一律以它为准，正文引用其章节号 |
| `doc/context/progress-tracker.md` | 只存**当前状态快照**，不保留历史副本；因此「这次为什么改」必须写在提交信息里 |
| `doc/context/architecture.md` | 内部架构基线；其决策变更需同步 progress-tracker |
| `doc/context/project-overview.md` | 背景与取舍记录（已降级，不再是规则真源） |
| `doc/design/traceability-check.py` | 追溯性校验脚本，**目前已暂停使用**，不再是改动后的强制关卡 |

**本文件与上述文档冲突时**：提交与分支行为以本文件为准；需求取值以 `CMS-SRS.md` 为准。
