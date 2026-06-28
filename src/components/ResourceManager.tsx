'use client';

import { useState, useCallback } from 'react';
import { Skill, SavedProblem, ProblemStatus } from '@/types';
import { toolRegistry, SLASH_COMMANDS } from '@/lib/tools/registry';
import { skillManager } from '@/lib/skills/manager';
import { KNOWLEDGE_TOPICS, getTopicById, getTopicsByCategory } from '@/lib/knowledge/topics';
import { PROBLEM_BANK, getProblemsByTopic } from '@/lib/knowledge/problems';
import { getProblemHistory } from '@/lib/problem-history/manager';

type Tab = 'tools' | 'skills' | 'knowledge' | 'history';

export function ResourceManager() {
  const [tab, setTab] = useState<Tab>('tools');

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">资源管理</h1>
          <p className="text-xs text-muted">查看和管理工具、技能、知识库、题目记录</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            { id: 'tools', label: '工具', icon: toolIcon },
            { id: 'skills', label: '技能', icon: skillIcon },
            { id: 'knowledge', label: '知识库', icon: bookIcon },
            { id: 'history', label: '题目记录', icon: historyIcon },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'tools' && <ToolsPanel />}
        {tab === 'skills' && <SkillsPanel />}
        {tab === 'knowledge' && <KnowledgePanel />}
        {tab === 'history' && <HistoryPanel />}
      </div>
    </div>
  );
}

// ============================================================
// Tools Panel
// ============================================================
function ToolsPanel() {
  const tools = toolRegistry.getAll();
  const commands = Object.entries(SLASH_COMMANDS);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">斜杠命令</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {commands.map(([cmd, info]) => (
            <div
              key={cmd}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <code className="text-sm font-mono text-accent">{cmd}</code>
                <p className="mt-0.5 text-xs text-muted">{info.description}</p>
              </div>
              {info.tool && (
                <span className="rounded-md bg-accent/10 px-2 py-1 text-[10px] text-accent">
                  {info.tool}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          已注册工具 ({tools.length})
        </h2>
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{tool.label}</h3>
                    <code className="text-[10px] text-muted">{tool.name}</code>
                  </div>
                  <p className="mt-1 text-xs text-muted">{tool.description}</p>
                </div>
              </div>
              {tool.parameters.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
                    参数
                  </p>
                  <div className="space-y-1.5">
                    {tool.parameters.map((param) => (
                      <div key={param.name} className="flex items-center gap-2 text-xs">
                        <code className="font-mono text-foreground">{param.name}</code>
                        <span className="rounded bg-card-hover px-1.5 py-0.5 text-[10px] text-muted">
                          {param.type}
                        </span>
                        {param.required && (
                          <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">
                            必填
                          </span>
                        )}
                        <span className="text-muted">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Skills Panel
// ============================================================
function SkillsPanel() {
  const [customSkills, setCustomSkills] = useState<Skill[]>(() => skillManager.getCustomSkills());
  const [builtinSkills] = useState<Skill[]>(() => skillManager.getBuiltinSkills());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSkill, setNewSkill] = useState<Skill>({
    name: '',
    description: '',
    content: '',
    triggerKeywords: [],
    triggerCommands: [],
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [error, setError] = useState('');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const refreshCustom = useCallback(() => {
    setCustomSkills(skillManager.getCustomSkills());
  }, []);

  const handleAddSkill = useCallback(() => {
    setError('');
    if (!newSkill.name.trim()) {
      setError('请输入技能名称');
      return;
    }
    const result = skillManager.addCustomSkill({
      ...newSkill,
      triggerKeywords: keywordInput
        ? keywordInput.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      triggerCommands: commandInput
        ? commandInput.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    });
    if (!result.success) {
      setError(result.error || '添加失败');
      return;
    }
    refreshCustom();
    setNewSkill({ name: '', description: '', content: '', triggerKeywords: [], triggerCommands: [] });
    setKeywordInput('');
    setCommandInput('');
    setShowAddForm(false);
  }, [newSkill, keywordInput, commandInput, refreshCustom]);

  const handleRemoveSkill = useCallback(
    (name: string) => {
      skillManager.removeCustomSkill(name);
      refreshCustom();
    },
    [refreshCustom]
  );

  const renderSkillCard = (skill: Skill, isBuiltin: boolean) => {
    const isExpanded = expandedSkill === skill.name;
    return (
      <div
        key={skill.name}
        className="rounded-xl border border-border bg-card p-4"
      >
        <div
          className="flex cursor-pointer items-start justify-between"
          onClick={() => setExpandedSkill(isExpanded ? null : skill.name)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{skill.name}</h3>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                  isBuiltin
                    ? 'bg-accent/15 text-accent'
                    : 'bg-success/15 text-success'
                }`}
              >
                {isBuiltin ? '内置' : '自定义'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{skill.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {skill.triggerCommands?.map((cmd) => (
                <code
                  key={cmd}
                  className="rounded bg-card-hover px-1.5 py-0.5 text-[10px] font-mono text-accent"
                >
                  {cmd}
                </code>
              ))}
              {skill.triggerKeywords?.slice(0, 4).map((kw) => (
                <span
                  key={kw}
                  className="rounded bg-card-hover px-1.5 py-0.5 text-[10px] text-muted"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isBuiltin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSkill(skill.name);
                }}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="删除"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            )}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-3 border-t border-border pt-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-background/50 p-3 text-xs text-muted-foreground">
              {skill.content}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Add custom skill */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          自定义技能 ({customSkills.length})
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          {showAddForm ? '取消' : '+ 添加技能'}
        </button>
      </div>

      {showAddForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">技能名称</label>
            <input
              type="text"
              value={newSkill.name}
              onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              placeholder="my-custom-skill"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-muted">只能包含小写字母、数字和短横线</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">描述</label>
            <input
              type="text"
              value={newSkill.description}
              onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
              placeholder="技能的简要说明"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">触发关键词（逗号分隔）</label>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="排序,数组,查找"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">触发命令（逗号分隔）</label>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="/sort, /array"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">技能内容</label>
            <textarea
              value={newSkill.content}
              onChange={(e) => setNewSkill({ ...newSkill, content: e.target.value })}
              placeholder="技能的详细内容，当触发时会注入到 AI 的上下文中..."
              rows={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-muted">至少 10 个字符</p>
          </div>
          <button
            onClick={handleAddSkill}
            className="w-full rounded-lg bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            添加技能
          </button>
        </div>
      )}

      {/* Custom skills list */}
      {customSkills.length > 0 ? (
        <div className="space-y-3">
          {customSkills.map((skill) => renderSkillCard(skill, false))}
        </div>
      ) : (
        !showAddForm && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-8 text-center">
            <p className="text-sm text-muted">还没有自定义技能</p>
            <p className="mt-1 text-xs text-muted/60">点击上方按钮添加你的第一个技能</p>
          </div>
        )
      )}

      {/* Builtin skills */}
      <h2 className="pt-4 text-sm font-semibold text-foreground">
        内置技能 ({builtinSkills.length})
      </h2>
      <div className="space-y-3">
        {builtinSkills.map((skill) => renderSkillCard(skill, true))}
      </div>
    </div>
  );
}

// ============================================================
// Knowledge Panel
// ============================================================
function KnowledgePanel() {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const categories = [...new Set(KNOWLEDGE_TOPICS.map((t) => t.category))];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{KNOWLEDGE_TOPICS.length}</div>
          <div className="text-xs text-muted">知识点</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-success">{PROBLEM_BANK.length}</div>
          <div className="text-xs text-muted">练习题</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-warning">{categories.length}</div>
          <div className="text-xs text-muted">分类</div>
        </div>
      </div>

      {/* Topics by category */}
      {categories.map((category) => {
        const topics = getTopicsByCategory(category).sort((a, b) => a.learningOrder - b.learningOrder);
        return (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold text-foreground">{category}</h2>
            <div className="space-y-2">
              {topics.map((topic) => {
                const isExpanded = expandedTopic === topic.id;
                const problems = getProblemsByTopic(topic.id);
                const prereqs = topic.prerequisites
                  .map((p) => getTopicById(p)?.name || p)
                  .join(', ') || '无';
                return (
                  <div
                    key={topic.id}
                    className="rounded-xl border border-border bg-card"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between p-4"
                      onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent">
                          {topic.learningOrder}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-foreground">{topic.name}</h3>
                            <span className="text-xs text-warning">
                              {'star'.repeat(topic.difficulty)}
                            </span>
                          </div>
                          <p className="text-xs text-muted">
                            {topic.description.slice(0, 50)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-card-hover px-2 py-1 text-[10px] text-muted">
                          {problems.length} 题
                        </span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border p-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                              关键要点
                            </p>
                            <ul className="space-y-1">
                              {topic.keyPoints.map((point, i) => (
                                <li key={i} className="text-xs text-muted-foreground">
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                              常见错误
                            </p>
                            <ul className="space-y-1">
                              {topic.commonMistakes.map((mistake, i) => (
                                <li key={i} className="text-xs text-muted-foreground">
                                  {mistake}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                            前置知识
                          </p>
                          <p className="text-xs text-muted-foreground">{prereqs}</p>
                        </div>
                        {problems.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                              相关题目
                            </p>
                            <div className="space-y-1">
                              {problems.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-1.5"
                                >
                                  <span className="text-xs text-foreground">{p.title}</span>
                                  <span className="text-[10px] text-warning">
                                    {'star'.repeat(p.difficulty)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ============================================================
// History Panel — Saved problems for review
// ============================================================
function HistoryPanel() {
  const [history, setHistory] = useState<SavedProblem[]>(() => getProblemHistory().getAll());
  const [filter, setFilter] = useState<ProblemStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setHistory(getProblemHistory().getAll());
  }, []);

  const stats = getProblemHistory().getStats();

  const filtered = filter === 'all' ? history : history.filter((p) => p.status === filter);

  const handleDelete = useCallback((id: string) => {
    getProblemHistory().delete(id);
    refresh();
  }, [refresh]);

  const handleClear = useCallback(() => {
    getProblemHistory().clear();
    refresh();
  }, [refresh]);

  const statusConfig: Record<ProblemStatus, { label: string; color: string; bg: string }> = {
    solved: { label: '已通过', color: 'text-success', bg: 'bg-success/15' },
    attempted: { label: '尝试中', color: 'text-warning', bg: 'bg-warning/15' },
    unsolved: { label: '未通过', color: 'text-danger', bg: 'bg-danger/15' },
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted">总计</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-success">{stats.solved}</div>
          <div className="text-xs text-muted">已通过</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-warning">{stats.attempted}</div>
          <div className="text-xs text-muted">尝试中</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-danger">{stats.unsolved}</div>
          <div className="text-xs text-muted">未通过</div>
        </div>
      </div>

      {/* Filter + Clear */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            { id: 'all' as const, label: '全部' },
            { id: 'solved' as const, label: '已通过' },
            { id: 'attempted' as const, label: '尝试中' },
            { id: 'unsolved' as const, label: '未通过' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id ? 'bg-accent/20 text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10"
          >
            清空记录
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 text-center">
          <p className="text-sm text-muted">
            {history.length === 0 ? '还没有做过题目' : '该状态下没有题目'}
          </p>
          <p className="mt-1 text-xs text-muted/60">
            {history.length === 0 ? '在练习台运行代码后会自动保存到此处' : '试试其他筛选条件'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const isExpanded = expanded === entry.id;
            const sc = statusConfig[entry.status];
            const topic = getTopicById(entry.problem.topicId);
            const passRate = entry.lastResult?.testResults
              ? `${entry.lastResult.testResults.passed}/${entry.lastResult.testResults.total}`
              : '—';

            return (
              <div key={entry.id} className="rounded-xl border border-border bg-card">
                <div
                  className="flex cursor-pointer items-center justify-between p-4"
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                      {sc.label}
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{entry.problem.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{topic?.name || entry.problem.topicId}</span>
                        <span>·</span>
                        <span>{'⭐'.repeat(entry.problem.difficulty)}</span>
                        <span>·</span>
                        <span>尝试 {entry.attempts} 次</span>
                        <span>·</span>
                        <span>{new Date(entry.savedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-card-hover px-2 py-1 text-[10px] text-muted">
                      通过 {passRate}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          题目描述
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-4">
                          {entry.problem.description}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          你的代码
                        </p>
                        <pre className="overflow-x-auto rounded-lg bg-background/50 p-2 text-[10px] text-muted-foreground max-h-32">
                          {entry.userCode.slice(0, 500)}
                        </pre>
                      </div>
                    </div>
                    {entry.lastResult?.testResults?.failures &&
                      entry.lastResult.testResults.failures.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                            失败用例
                          </p>
                          <div className="space-y-1">
                            {entry.lastResult.testResults.failures.slice(0, 3).map((f, i) => (
                              <div key={i} className="rounded-lg bg-danger/5 px-3 py-1.5 text-[10px]">
                                <span className="text-muted">输入：</span>
                                <code className="text-foreground">{f.input}</code>
                                <span className="text-muted"> → 期望：</span>
                                <code className="text-success">{f.expected}</code>
                                <span className="text-muted"> 实际：</span>
                                <code className="text-danger">{f.actual}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted">
                        复杂度：{entry.problem.timeComplexity} / {entry.problem.spaceComplexity}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                        className="rounded-lg border border-danger/30 px-2.5 py-1 text-[10px] text-danger transition-colors hover:bg-danger/10"
                      >
                        删除记录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Icons
// ============================================================
const toolIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const skillIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const bookIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const historyIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);
