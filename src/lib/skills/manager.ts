import { Skill } from '@/types';

// ============================================================
// Extensible Skill System
// ------------------------------------------------------------
// Built-in skills are defined in BUILTIN_SKILLS.
// Custom skills are loaded from localStorage (key: codementor:custom-skills:v1)
// and can be added/removed via the SkillsManager UI.
// ============================================================

const BUILTIN_SKILLS: Skill[] = [
  {
    name: 'socratic-teaching',
    description: '苏格拉底式教学方法论。当学生提问概念、解题卡住需要提示时触发。',
    triggerKeywords: ['不会', '不懂', '怎么做', '为什么', '提示', '卡住', '想不通', '解释', 'help'],
    triggerCommands: ['/hint', '/explain'],
    content: `# 苏格拉底式教学方法论

## 核心原则
绝对不直接给出完整答案。通过提问引导学生自己推理出答案。

## 五级渐进式提示协议
- Level 1（掌握度>0.6）：元认知提示，引导反思
- Level 2（0.4-0.6）：概念提示，关联相关概念
- Level 3（0.2-0.4）：策略提示，指明思考方向
- Level 4（0.1-0.2）：结构提示，定位具体位置
- Level 5（<0.1）：定向提示，接近答案的指导

## 反馈规则
- 回答正确：给予肯定并引导深入
- 回答错误：不否定，用问题引导发现矛盾
- 始终追问"为什么"而非"是不是"`,
  },
  {
    name: 'problem-generation',
    description: '练习题生成与选题方法论。40/50/10法则选择题目。',
    triggerKeywords: ['练习', '做题', '出题', '挑战', '训练'],
    triggerCommands: ['/practice', '/exercise'],
    content: `# 练习题生成方法论

## 选题策略：40/50/10法则
- 40% 复习题：SM-2间隔重复调度
- 50% 成长区：掌握度0.3-0.7
- 10% 挑战区：掌握度<0.3

## 约束条件
1. 前置依赖必须已掌握
2. 同一知识点3天内不重复
3. 连续3题不来自同一知识点`,
  },
  {
    name: 'code-assessment',
    description: '代码评估方法论：测试驱动+语义审查混合评估。',
    triggerKeywords: ['提交', '运行', '测试', '检查', '评估'],
    triggerCommands: ['/submit', '/run', '/test'],
    content: `# 代码评估方法论

## 混合评估框架
1. 测试驱动评估（客观）：执行所有测试用例
2. 语义代码审查（主观）：时间/空间复杂度、可读性、边界覆盖
3. 评分：测试50% + 复杂度20% + 可读性15% + 边界15%

## 反馈生成
- 全过：表扬+优化建议
- 部分通过：指出失败用例+分析原因
- 全失败：分析核心错误+修复方向`,
  },
  {
    name: 'learning-path',
    description: '学习路径规划：BKT掌握度+SM-2间隔重复。',
    triggerKeywords: ['计划', '路径', '规划', '进度', '复习', '安排'],
    triggerCommands: ['/plan', '/progress', '/review'],
    content: `# 学习路径规划方法论

## BKT掌握度模型
- P(known|correct) 贝叶斯更新
- slip=0.1, guess=0.25, forgetRate=0.05

## SM-2间隔重复
- quality<3：重置间隔1天
- interval=1→1天, =2→6天, >2→interval*EF
- EF = max(1.3, EF + 0.1 - (5-q)*(0.08+(5-q)*0.02))

## 路径原则
1. 依赖优先 2. 最近发展区 3. 间隔复习 4. 目标导向`,
  },
  {
    name: 'interview-prep',
    description: '面试准备模式：高频考点+系统解题框架+模拟面试。',
    triggerKeywords: ['面试', 'offer', '大厂', '笔试', 'interview'],
    triggerCommands: ['/interview'],
    content: `# 面试准备方法论

## 解题五步法（Clarify → Examples → Brute Force → Optimize → Test）
1. **Clarify**：确认题意、输入范围、边界条件
2. **Examples**：自己举几个例子验证理解
3. **Brute Force**：先想暴力解，再分析瓶颈
4. **Optimize**：BUD优化（Bottleneck/Unnecessary Work/Duplicated Work）
5. **Test**：用测试用例验证，包括边界情况

## 高频考点优先级
1. 数组/字符串（双指针、滑动窗口）
2. 哈希表（两数之和模式）
3. 排序与二分
4. 链表操作
5. 栈/队列（单调栈）
6. 二叉树遍历
7. BFS/DFS
8. 动态规划（背包、子序列）
9. 回溯（排列组合子集）

## 答题技巧
- 先说思路再写代码
- 主动分析时间空间复杂度
- 写完主动找bug和测试用例`,
  },
  {
    name: 'competition-oi',
    description: '竞赛OI模式：高级算法+数据结构+暴力打表策略。',
    triggerKeywords: ['竞赛', 'OI', 'NOIP', 'CSP', 'ICPC', 'ACM'],
    triggerCommands: ['/oi', '/competition'],
    content: `# OI竞赛方法论

## 暴力拿分策略
- 先写暴力解法拿部分分
- 对拍验证正确性
- 特殊情况特判

## 常用高级算法
- 并查集（路径压缩+按秩合并）
- 线段树/树状数组
- 最短路（Dijkstra/SPFA/Floyd）
- 最小生成树（Kruskal/Prim）
- 网络流（Dinic）
- 数论（GCD/快速幂/逆元/欧拉筛）
- 字符串（KMP/Trie/AC自动机）

## 调试技巧
- 对拍（暴力vs优化版）
- 生成随机数据
- assert断言关键条件
- 分块提交定位错误`,
  },
];

const CUSTOM_SKILLS_KEY = 'codementor:custom-skills:v1';

export class SkillManager {
  private customSkills: Map<string, Skill> = new Map();

  constructor() {
    this.loadCustomSkills();
  }

  private loadCustomSkills(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
      if (raw) {
        const skills = JSON.parse(raw) as Skill[];
        for (const s of skills) {
          this.customSkills.set(s.name, s);
        }
      }
    } catch {
      // ignore
    }
  }

  private saveCustomSkills(): void {
    if (typeof window === 'undefined') return;
    try {
      const skills = Array.from(this.customSkills.values());
      localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
    } catch {
      // ignore
    }
  }

  getAllSkills(): Skill[] {
    return [...BUILTIN_SKILLS, ...this.customSkills.values()];
  }

  getBuiltinSkills(): Skill[] {
    return [...BUILTIN_SKILLS];
  }

  getCustomSkills(): Skill[] {
    return Array.from(this.customSkills.values());
  }

  getSkill(name: string): Skill | undefined {
    return BUILTIN_SKILLS.find((s) => s.name === name) || this.customSkills.get(name);
  }

  addCustomSkill(skill: Skill): { success: boolean; error?: string } {
    if (!skill.name || !skill.name.match(/^[a-z0-9-]+$/)) {
      return { success: false, error: '技能名称只能包含小写字母、数字和短横线' };
    }
    if (BUILTIN_SKILLS.some((s) => s.name === skill.name)) {
      return { success: false, error: '不能覆盖内置技能' };
    }
    if (!skill.content || skill.content.trim().length < 10) {
      return { success: false, error: '技能内容至少10个字符' };
    }
    this.customSkills.set(skill.name, {
      ...skill,
      triggerKeywords: skill.triggerKeywords || [],
      triggerCommands: skill.triggerCommands || [],
    });
    this.saveCustomSkills();
    return { success: true };
  }

  removeCustomSkill(name: string): boolean {
    if (BUILTIN_SKILLS.some((s) => s.name === name)) {
      return false; // cannot remove builtin
    }
    const deleted = this.customSkills.delete(name);
    if (deleted) this.saveCustomSkills();
    return deleted;
  }

  /** Find matching skills for a given input text */
  matchSkills(input: string): Skill[] {
    const lower = input.toLowerCase().trim();
    const allSkills = this.getAllSkills();
    const matched: Skill[] = [];

    for (const skill of allSkills) {
      // Check command triggers
      if (skill.triggerCommands) {
        for (const cmd of skill.triggerCommands) {
          if (lower.startsWith(cmd.toLowerCase())) {
            matched.push(skill);
            break;
          }
        }
        if (matched.includes(skill)) continue;
      }
      // Check keyword triggers
      if (skill.triggerKeywords) {
        for (const kw of skill.triggerKeywords) {
          if (lower.includes(kw.toLowerCase())) {
            matched.push(skill);
            break;
          }
        }
      }
    }

    return matched;
  }

  /** Get all skill contents for system prompt injection */
  getRelevantSkillContents(input: string): string {
    const matched = this.matchSkills(input);
    if (matched.length === 0) return '';
    return matched.map((s) => `## Skill: ${s.name}\n${s.content}`).join('\n\n');
  }

  /** Export custom skills as JSON */
  exportCustomSkills(): string {
    return JSON.stringify(this.getCustomSkills(), null, 2);
  }

  /** Import custom skills from JSON */
  importCustomSkills(json: string): { success: boolean; count: number; error?: string } {
    try {
      const skills = JSON.parse(json) as Skill[];
      if (!Array.isArray(skills)) {
        return { success: false, count: 0, error: 'JSON格式错误：需要数组' };
      }
      let count = 0;
      for (const s of skills) {
        if (s.name && s.content) {
          const result = this.addCustomSkill(s);
          if (result.success) count++;
        }
      }
      return { success: true, count };
    } catch (e) {
      return { success: false, count: 0, error: 'JSON解析失败: ' + (e instanceof Error ? e.message : String(e)) };
    }
  }
}

export const skillManager = new SkillManager();
