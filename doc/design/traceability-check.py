#!/usr/bin/env python3
"""
CMS 需求文档追溯性校验

校验两份文档之间的一致性：
  - doc/context/project-overview.md             内部业务规则基线
  - CMS-SRS.md                                  当前唯一对外交付需求文档

每次修改任一源文件后都应该重跑本脚本。退出码非 0 表示存在不一致。

用法：  python3 doc/design/traceability-check.py
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = {
    "基线": ROOT / "doc/context/project-overview.md",
    "SRS": ROOT / "CMS-SRS.md",
}

RE_BR = re.compile(r"BR-[A-Z]*-*0?\d{3}")
RE_FR = re.compile(r"FR-[A-Z]*-0\d{2}")

failures = []


def read(name):
    return DOCS[name].read_text(encoding="utf-8")


def norm(s):
    """去掉 Markdown 强调标记；把状态图的终态写法统一为「删除」。"""
    s = s.replace("**", "").strip()
    return {"[*]": "删除"}.get(s, s)


def check(title, ok, detail=""):
    print(("  ✓ " if ok else "  ✗ ") + title + ("" if ok else "  " + detail))
    if not ok:
        failures.append(title)


def mig_rows(text):
    """状态迁移表的行：| # | 触发者 | A → B（...） |

    触发者的取值**不写死**。写死的话，新增一条路径、或引入一个新的触发者时，
    这一行会被静默跳过，两项校验都会视而不见——那正是本文件想要根除的形态。
    """
    out = []
    for line in text.split("\n"):
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3 or not re.fullmatch(r"\d+", cells[0]) or "→" not in cells[2]:
            continue
        m = re.match(r"([^→]+?)\s*→\s*([^（(]+)", cells[2])
        if not m:
            check(f"迁移表行解析：{cells[2]}", False, "格式无法解析")
            continue
        out.append((norm(cells[1]), norm(m.group(1)), norm(m.group(2))))
    return out


def table_paths(text):
    return {(f, t) for _, f, t in mig_rows(text)}


def table_actors(text):
    """状态迁移表的「触发者」集合。"""
    return {a for a, _, _ in mig_rows(text)}



def table_actions(text):
    """解析留痕类别表（表头为 | 操作类型 | 操作人 | ...），返回 [(操作类型, 操作人)]。"""
    out = []
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if not re.match(r"\|\s*操作类型\s*\|\s*操作人\s*\|", line):
            continue
        for row in lines[i + 1:]:
            if not row.strip().startswith("|"):
                break
            if set(row) <= set("|-: "):      # 表头下的分隔行
                continue
            cells = [c.strip() for c in row.strip().strip("|").split("|")]
            if len(cells) >= 2:
                out.append((norm(cells[0]), norm(cells[1])))
        break
    return out


def main():
    base, srs = (read(k) for k in ("基线", "SRS"))

    print("【1】规则编号集合：基线 vs SRS")
    br_base = set(RE_BR.findall(base))
    extra = set(RE_BR.findall(srs)) - br_base
    check("SRS 引用的规则都在基线内", not extra, f"越界：{sorted(extra)}")
    print(f"  基线规则 {len(br_base)} 条")

    print("【2】SRS 功能需求编号")
    fr_srs = set(RE_FR.findall(srs))
    check("SRS 内置功能需求数量为 37 条", len(fr_srs) == 37, f"实际 {len(fr_srs)} 条")

    print("【3】规则 → SRS 功能需求：每条规则至少被承接")
    uncovered = []
    for rule in sorted(br_base):
        if rule in srs:
            continue
        num = int(re.sub(r"^BR-[A-Z]*-*", "", rule))
        hit = False
        for m in re.finditer(r"(BR-(?:[A-Z]+-)?)(\d{3})~(?:BR-(?:[A-Z]+-)?)?(\d{3})", srs):
            pad = "BR-" + m.group(1)[3:]
            if rule.startswith(pad) and int(m.group(2)) <= num <= int(m.group(3)):
                hit = True
                break
        if not hit:
            uncovered.append(rule)
    check("全部规则被 SRS 功能需求承接", not uncovered, f"未承接：{uncovered}")

    print("【4】状态机：基线与 SRS 一致")
    bp, sp = table_paths(base), table_paths(srs)
    check(f"基线迁移表 ↔ SRS 迁移表（{len(bp)}/{len(sp)}）", bp == sp, f"差异 {bp ^ sp}")

    print("【5】文章状态与留痕类别的定义完整性")
    required_states = {"草稿", "待审核", "驳回", "待发布", "已发布", "已下架"}
    found_states = {state for state in required_states if state in srs}
    check("SRS 包含 6 个文章状态", found_states == required_states, str(found_states))
    check("SRS 明确驳回意见和下架原因必填", "驳回意见" in srs and "下架原因" in srs, "缺少必填原因说明")

    base_actions, srs_actions = table_actions(base), table_actions(srs)
    check(f"基线 ↔ SRS 留痕类别逐条一致（各 {len(srs_actions)} 类）",
          sorted(base_actions) == sorted(srs_actions),
          f"仅基线 {sorted(set(base_actions) - set(srs_actions))}；"
          f"仅 SRS {sorted(set(srs_actions) - set(base_actions))}")
    names = [a for a, _ in srs_actions]
    check("留痕类别无重复行", len(set(names)) == len(names), str(names))

    # 关键校验，且是**派生**的：留痕的操作人词汇必须覆盖状态迁移表里的全部触发者。
    # 这一条故意不写"应有哪几类"的清单——那种清单是同一份事实的第二个手维护副本，
    # 文档新增一类留痕时清单不会跟着变，脚本就会一直绿着（这正是本项此前漏掉
    # 「到期自动发布」的原因）。迁移表是两份文档都有、且已在【4】交叉校验过的表，
    # 因此新增或改动迁移路径会自动把缺口顶出来，不需要再手工同步任何枚举。
    mig_actors = table_actors(base) | table_actors(srs)
    trace_actors = {a for _, a in srs_actions}
    check("留痕操作人覆盖全部迁移触发者",
          mig_actors == trace_actors,
          f"迁移触发者 {sorted(mig_actors)} vs 留痕操作人 {sorted(trace_actors)}")

    print("【6】计数声明 vs 实际")
    mtx = [int(x) for x in re.findall(r"^\| BR-.*?\|\s*(\d+)\s*\|", srs, re.M)]
    check("SRS 追溯矩阵合计 = 规则总数", sum(mtx) == len(br_base), f"矩阵 {sum(mtx)} vs 规则 {len(br_base)}")
    check("SRS 声明的功能需求总数 = 实际", f"功能需求 | {len(fr_srs)} 条" in srs, "")

    print("【7】SRS 内置权限矩阵与越权用例")
    check("SRS 包含权限矩阵", "权限矩阵" in srs)
    tu_srs = set(re.findall(r"\|\s*(TU-\d+b?)\s*\|", srs))
    check(f"SRS 越权测试用例数量（{len(tu_srs)}）", len(tu_srs) == 18, f"实际 {len(tu_srs)} 条")

    def numbered_rows(text, heading):
        """取某个小标题下、形如 | n | ... | 的表格行数"""
        block = re.search(re.escape(heading) + r"(.*?)(?=\n## |\n### |\Z)", text, re.S)
        if not block:
            return -1, 0
        rows = re.findall(r"^\|\s*\d+\s*\|", block.group(1), re.M)
        nums = [int(re.match(r"\|\s*(\d+)\s*\|", r).group(1)) for r in rows]
        return len(rows), max(nums) if nums else 0

    n_srs, max_srs = numbered_rows(srs, "必须失败的组合")
    check(f"SRS 必须失败的组合：{n_srs} 条且编号连续", n_srs == 17 and max_srs == 17,
          f"实际 {n_srs} 条，最大编号 {max_srs}")

    print()
    if failures:
        print(f"未通过 {len(failures)} 项：" + "；".join(failures))
        return 1
    print("全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
