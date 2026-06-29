'use client';

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgentMessage, AgentRole, AgentActivity, AgentParadigm } from '@/types';
import { PixelAvatar, MascotRole } from './PixelAvatar';

export interface ChatPanelProps {
  messages: AgentMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  /** Activities for the currently in-flight turn (live-updating). */
  liveActivities?: AgentActivity[];
  /** Content being streamed in */
  streamingContent?: string;
  /** Which agent is currently streaming */
  streamingAgent?: AgentRole | null;
}

// ============================================================
// Agent metadata — colors, mascots, paradigm info
// ============================================================

const AGENT_META: Record<
  AgentRole,
  { name: string; role: MascotRole; color: string; paradigm: AgentParadigm; paradigmDesc: string; icon: string }
> = {
  orchestrator: { name: '总控', role: 'orchestrator', color: '#818cf8', paradigm: 'Plan-and-Execute', paradigmDesc: '规划→执行→再规划→综合', icon: '◎' },
  lecturer: { name: '讲师', role: 'lecturer', color: '#34d399', paradigm: 'ReAct+CoT', paradigmDesc: '推理→行动→观察循环', icon: '✦' },
  problem_setter: { name: '出题官', role: 'problem_setter', color: '#fbbf24', paradigm: 'Plan-and-Execute+Reflexion', paradigmDesc: '规划→生成→验证→反思修复', icon: '◈' },
  examiner: { name: '考官', role: 'examiner', color: '#f87171', paradigm: 'Reflexion', paradigmDesc: '评估→反思→改进', icon: '◆' },
  path_planner: { name: '规划师', role: 'path_planner', color: '#fb923c', paradigm: 'Plan-and-Execute', paradigmDesc: '评估→规划→输出路径', icon: '➤' },
};

const QUICK_ACTIONS: { cmd: string; label: string; desc: string; color: string }[] = [
  { cmd: '/practice', label: '/practice', desc: '开始练习', color: '#fbbf24' },
  { cmd: '/plan', label: '/plan', desc: '生成学习计划', color: '#fb923c' },
  { cmd: '/hint', label: '/hint', desc: '给我一个提示', color: '#34d399' },
];

// ============================================================
// Activity type visual configuration
// ============================================================

interface ActivityVisual {
  icon: string;
  label: string;
  category: 'orchestration' | 'reasoning' | 'tool' | 'system' | 'result';
}

const ACTIVITY_VISUAL: Record<AgentActivity['type'], ActivityVisual> = {
  agent_start: { icon: '●', label: '启动', category: 'system' },
  agent_end: { icon: '○', label: '完成', category: 'system' },
  skill_load: { icon: '◆', label: '加载技能', category: 'system' },
  knowledge_read: { icon: '▤', label: '读取知识', category: 'system' },
  tool_call: { icon: '▸', label: '工具调用', category: 'tool' },
  tool_result: { icon: '✓', label: '工具结果', category: 'result' },
  thinking: { icon: '…', label: '思考', category: 'reasoning' },
  validate: { icon: '✓', label: '验证', category: 'tool' },
  plan_created: { icon: '◉', label: '制定计划', category: 'orchestration' },
  plan_step_start: { icon: '▸', label: '步骤开始', category: 'orchestration' },
  plan_step_done: { icon: '✓', label: '步骤完成', category: 'orchestration' },
  plan_replan: { icon: '↻', label: '重新规划', category: 'orchestration' },
  react_thought: { icon: '🧠', label: '推理', category: 'reasoning' },
  react_action: { icon: '⚡', label: '行动', category: 'tool' },
  react_observation: { icon: '👁', label: '观察', category: 'result' },
  stream_chunk: { icon: '·', label: '', category: 'system' },
  error: { icon: '✕', label: '错误', category: 'result' },
};

function getActivityCategory(type: AgentActivity['type']): 'orchestration' | 'reasoning' | 'tool' | 'system' | 'result' {
  return ACTIVITY_VISUAL[type]?.category || 'system';
}

// Tool display names
const TOOL_DISPLAY_NAMES: Record<string, { name: string; icon: string }> = {
  SearchKnowledge: { name: '搜索知识库', icon: '📚' },
  SearchProblems: { name: '搜索题库', icon: '🔍' },
  WebSearch: { name: '网络搜索', icon: '🌐' },
  ValidateProblem: { name: '验证题目', icon: '✅' },
  AnalyzeCode: { name: '分析代码', icon: '🔬' },
  LearningPath: { name: '生成路径', icon: '🗺️' },
  search_knowledge: { name: '搜索知识库', icon: '📚' },
  search_problems: { name: '搜索题库', icon: '🔍' },
  web_search: { name: '网络搜索', icon: '🌐' },
  validate_problem: { name: '验证题目', icon: '✅' },
  analyze_code: { name: '分析代码', icon: '🔬' },
  learning_path: { name: '生成路径', icon: '🗺️' },
};

function getToolDisplay(name?: string): { name: string; icon: string } {
  if (!name) return { name: '未知工具', icon: '⚙️' };
  return TOOL_DISPLAY_NAMES[name] || { name, icon: '⚙️' };
}

// ============================================================
// Lightweight Markdown renderer (enhanced)
// ============================================================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(```[\s\S]*?```|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<code key={`${keyBase}-c${i}`} className="md-code">{m[2]}</code>);
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`} className="md-strong">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<em key={`${keyBase}-i${i}`} className="md-em">{m[4]}</em>);
    } else if (m[5] !== undefined) {
      nodes.push(<em key={`${keyBase}-i2${i}`} className="md-em">{m[5]}</em>);
    } else if (m[6] !== undefined) {
      nodes.push(
        <a key={`${keyBase}-a${i}`} href={m[7]} target="_blank" rel="noopener noreferrer" className="md-link">
          {m[6]}
        </a>
      );
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function smartJoin(lines: string[]): string {
  return lines.map((l) => l.trim()).reduce((acc, line, idx) => {
    if (idx === 0) return line;
    if (!acc) return line;
    if (!line) return acc + '\n';
    const lastChar = acc[acc.length - 1];
    const firstChar = line[0];
    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch);
    const needsSpace = !isCJK(lastChar) && !isCJK(firstChar) && !/[.,;:!?，。；：！？、）】」』]/.test(lastChar);
    return acc + (needsSpace ? ' ' : '') + line;
  }, '');
}

function tryParseTable(lines: string[], i: number, keyBase: string): { el: React.ReactNode; nextI: number } | null {
  const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
  const isRow = (l: string) => l.trim().startsWith('|') || l.includes('|');
  if (!isRow(lines[i])) return null;
  if (i + 1 >= lines.length || !isSep(lines[i + 1])) return null;
  const splitRow = (l: string): string[] => {
    let s = l.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const header = splitRow(lines[i]);
  let j = i + 2;
  const rows: string[][] = [];
  while (j < lines.length && isRow(lines[j]) && !isSep(lines[j])) { rows.push(splitRow(lines[j])); j++; }
  const el = (
    <table key={`${keyBase}-t${i}`} className="md-table">
      <thead><tr>{header.map((h, hi) => <th key={hi}>{renderInline(h, `${keyBase}-th${i}-${hi}`)}</th>)}</tr></thead>
      <tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c, `${keyBase}-td${i}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
    </table>
  );
  return { el, nextI: j };
}

function renderTextBlocks(text: string, keyBase: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let listKey = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={`${keyBase}-hr${i}`} className="md-hr" />); i++; continue; }
    if (!line.trim()) { i++; continue; }
    const tbl = tryParseTable(lines, i, keyBase);
    if (tbl) { blocks.push(tbl.el); i = tbl.nextI; continue; }
    const header = line.match(/^(#{1,6})\s+(.*)$/);
    if (header) {
      const level = header[1].length;
      blocks.push(<div key={`${keyBase}-h${i}`} className={`md-h${level}`}>{renderInline(header[2], `${keyBase}-hi${i}`)}</div>);
      i++; continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quoteLines.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push(<blockquote key={`${keyBase}-q${i}`} className="md-blockquote"><p className="md-p">{renderInline(smartJoin(quoteLines), `${keyBase}-qi${i}`)}</p></blockquote>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      blocks.push(<ul key={`${keyBase}-ul${listKey++}`} className="md-ul">{items.map((it, li) => <li key={li} className="md-li">{renderInline(it, `${keyBase}-uli${li}`)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      blocks.push(<ol key={`${keyBase}-ol${listKey++}`} className="md-ol">{items.map((it, li) => <li key={li} className="md-li">{renderInline(it, `${keyBase}-oli${li}`)}</li>)}</ol>);
      continue;
    }
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s?|[-*]\s|\d+\.\s|\s*[-*_]{3,}\s*$)/.test(lines[i]) && !tryParseTable(lines, i, 'p')) { paraLines.push(lines[i]); i++; }
    if (paraLines.length > 0) blocks.push(<p key={`${keyBase}-p${i}`} className="md-p">{renderInline(smartJoin(paraLines), `${keyBase}-pi${i}`)}</p>);
  }
  return blocks;
}

function renderMarkdown(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  const parts = content.split(/```/);
  parts.forEach((part, idx) => {
    const key = `b${idx}`;
    if (idx % 2 === 1) {
      const trimmed = part.replace(/^\n/, '').replace(/\n$/, '');
      const langMatch = trimmed.match(/^([a-zA-Z0-9_+-]+)\n/);
      let lang = '';
      let code = trimmed;
      if (langMatch) { lang = langMatch[1]; code = trimmed.slice(langMatch[0].length); }
      blocks.push(
        <pre key={key} className="md-code-block">
          {lang && <span className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-muted">{lang}</span>}
          <code>{code}</code>
        </pre>
      );
    } else if (part.trim()) {
      blocks.push(...renderTextBlocks(part, key));
    }
  });
  return <div className="md-content">{blocks}</div>;
}

// ============================================================
// PlanTimeline — visualizes Plan-and-Execute orchestration
// Shows steps as a horizontal/vertical progress with status
// ============================================================

function PlanTimeline({ activities, isLive }: { activities: AgentActivity[]; isLive?: boolean }) {
  // Extract plan steps from activities
  const planCreated = activities.find(a => a.type === 'plan_created');
  if (!planCreated) return null;

  const totalSteps = planCreated.planTotal || 0;
  const stepStarts = activities.filter(a => a.type === 'plan_step_start');
  const stepDones = activities.filter(a => a.type === 'plan_step_done');
  const replans = activities.filter(a => a.type === 'plan_replan');

  // Determine current step progress
  const completedCount = stepDones.length;
  const currentRunning = stepStarts.find(s => !stepDones.some(d => d.planStep === s.planStep));
  const currentStepIdx = currentRunning ? (currentRunning.planStep ?? completedCount) : completedCount;

  const [expanded, setExpanded] = useState(isLive ? true : false);

  useEffect(() => { if (isLive) setExpanded(true); }, [isLive]);

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="flex w-8 shrink-0 flex-col items-center pt-2">
        <div className="h-2 w-2 rounded-full" style={{
          backgroundColor: isLive && currentStepIdx < totalSteps ? '#818cf8' : '#64748b',
          boxShadow: isLive && currentStepIdx < totalSteps ? '0 0 8px #818cf880' : 'none',
        }} />
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="group flex w-full items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10"
        >
          <span className="text-[13px]">◎</span>
          <span className="text-[12px] font-semibold" style={{ color: '#818cf8' }}>
            总控 · Plan-and-Execute
          </span>
          <span className="text-[11px] text-muted">
            {isLive ? `执行中 (${completedCount}/${totalSteps})` : `已完成 (${totalSteps} 步)`}
          </span>
          <div className="flex-1" />
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => {
              const isDone = i < completedCount;
              const isCurrent = i === currentStepIdx && isLive;
              return (
                <div key={i} className="relative h-1.5 w-6 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2e3e' }}>
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-500"
                    style={{
                      width: isDone ? '100%' : isCurrent ? '60%' : '0%',
                      backgroundColor: isDone ? '#818cf8' : isCurrent ? '#818cf880' : 'transparent',
                    }}
                  />
                </div>
              );
            })}
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-muted/50 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-1.5 ml-1 rounded-xl border border-border/60 bg-card/60 p-3">
            {/* Plan detail */}
            {planCreated.detail && (
              <div className="mb-2 text-[11px] text-muted whitespace-pre-wrap leading-relaxed">
                {planCreated.detail}
              </div>
            )}
            {/* Step indicators */}
            <div className="space-y-1">
              {Array.from({ length: totalSteps }, (_, i) => {
                const startAct = stepStarts.find(s => s.planStep === i);
                const doneAct = stepDones.find(d => d.planStep === i);
                const isDone = !!doneAct;
                const isRunning = !!startAct && !isDone;
                const isPending = !startAct;

                // Find which agent is assigned to this step
                const agentRole = startAct?.agent || (isDone ? doneAct?.agent : null);
                const meta = agentRole ? AGENT_META[agentRole] : null;

                return (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: isDone ? `${meta?.color || '#818cf8'}30` : isRunning ? `${meta?.color || '#818cf8'}20` : '#2a2e3e',
                        color: isDone ? meta?.color || '#818cf8' : isRunning ? meta?.color || '#818cf8' : '#64748b',
                        border: `1.5px solid ${isDone ? meta?.color || '#818cf8' : isRunning ? `${meta?.color || '#818cf8'}80` : '#3a3f52'}`,
                      }}
                    >
                      {isDone ? '✓' : isRunning ? <span className="animate-spin-slow">◐</span> : i + 1}
                    </div>
                    <span className={`text-[11px] ${isDone ? 'text-muted-foreground' : isRunning ? 'text-foreground font-medium' : 'text-muted/60'}`}>
                      {meta ? `${meta.name} ` : ''}
                      {isDone ? '已完成' : isRunning ? '执行中…' : '等待中'}
                    </span>
                    {isRunning && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-400">
                        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-indigo-400" />
                        进行中
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Re-plan notifications */}
            {replans.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                {replans.map((r) => (
                  <div key={r.id} className="flex items-start gap-1.5 rounded-md bg-amber-500/8 px-2 py-1.5 text-[10.5px]">
                    <span className="text-amber-400 mt-0.5">↻</span>
                    <div>
                      <span className="font-medium text-amber-400">计划已调整</span>
                      <span className="text-amber-200/70"> — {r.detail?.split('\n')[0]?.replace('原因: ', '') || r.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ReActIteration — groups Thought/Action/Observation by turn
// ============================================================

function ReActIteration({
  turn,
  activities,
  agentMeta,
}: {
  turn: number;
  activities: AgentActivity[];
  agentMeta: typeof AGENT_META[AgentRole];
}) {
  const [expanded, setExpanded] = useState(false);
  const thought = activities.find(a => a.type === 'react_thought');
  const action = activities.find(a => a.type === 'react_action');
  const observation = activities.find(a => a.type === 'react_observation');
  const isRunning = activities.some(a => a.status === 'running');
  const hasError = activities.some(a => a.status === 'error' || a.status === 'warning');

  const toolInfo = action ? getToolDisplay(action.toolName) : null;
  const toolSuccess = observation?.status !== 'warning' && observation?.status !== 'error';

  return (
    <div className="react-turn" data-turn={turn}>
      {/* Turn header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-background/40"
      >
        <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isRunning ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: isRunning ? `${agentMeta.color}25` : hasError ? '#f8717120' : `${agentMeta.color}15`,
            color: isRunning ? agentMeta.color : hasError ? '#f87171' : agentMeta.color,
            border: `1px solid ${isRunning ? agentMeta.color : hasError ? '#f8717160' : `${agentMeta.color}40`}`,
          }}
        >
          {isRunning ? <span className="animate-spin-slow">◐</span> : hasError ? '!' : turn}
        </span>
        <span className="text-[11px] font-medium" style={{ color: agentMeta.color }}>
          第 {turn} 轮
        </span>
        {toolInfo && !isRunning && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: toolSuccess ? '#10b98115' : '#f59e0b15', color: toolSuccess ? '#10b981' : '#f59e0b' }}>
            <span>{toolInfo.icon}</span>
            {toolInfo.name}
          </span>
        )}
        {isRunning && !action && (
          <span className="text-[10px] text-muted italic">推理中…</span>
        )}
        {isRunning && action && !observation && (
          <span className="text-[10px] text-accent italic">执行工具中…</span>
        )}
        <div className="flex-1" />
        {!isRunning && thought?.detail && (
          <span className="max-w-[200px] truncate text-[10px] text-muted/60">
            {thought.detail.slice(0, 60).replace(/\n/g, ' ')}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-muted/40 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="ml-6 mr-1 space-y-1.5 pb-1">
          {/* Thought */}
          {thought && thought.detail && (
            <div className="rounded-lg border border-purple-500/15 bg-purple-500/5 p-2.5">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[12px]">🧠</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-300/80">Thought · 推理</span>
              </div>
              <div className="text-[11px] leading-relaxed text-purple-100/70 whitespace-pre-wrap">
                {thought.detail}
              </div>
            </div>
          )}

          {/* Action */}
          {action && (
            <div className={`rounded-lg border p-2.5 ${
              action.status === 'running'
                ? 'border-blue-500/25 bg-blue-500/8 animate-pulse-subtle'
                : toolSuccess
                ? 'border-emerald-500/15 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/8'
            }`}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[12px]">{toolInfo?.icon || '⚡'}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                  action.status === 'running' ? 'text-blue-300/80' : toolSuccess ? 'text-emerald-300/80' : 'text-amber-300/80'
                }`}>
                  Action · {action.status === 'running' ? '执行中' : toolSuccess ? '执行成功' : '执行警告'}
                </span>
                <span className="text-[11px] font-medium" style={{ color: toolSuccess ? '#34d399' : '#fbbf24' }}>
                  {toolInfo?.name || action.toolName}
                </span>
              </div>
              {action.toolArgs && (
                <div className="font-mono text-[10.5px] text-slate-400/80 break-all">
                  <span className="text-slate-500">参数:</span> {action.toolArgs}
                </div>
              )}
            </div>
          )}

          {/* Observation */}
          {observation && observation.detail && (
            <div className={`rounded-lg border p-2.5 ${
              toolSuccess ? 'border-cyan-500/15 bg-cyan-500/5' : 'border-amber-500/15 bg-amber-500/5'
            }`}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[12px]">👁</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                  toolSuccess ? 'text-cyan-300/80' : 'text-amber-300/80'
                }`}>
                  Observation · 观察
                </span>
              </div>
              <div className="text-[11px] leading-relaxed text-slate-300/70 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {observation.detail}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EnhancedThinkingPanel — redesigned thinking chain
// Groups ReAct iterations, shows plan timeline, system activities
// ============================================================

function EnhancedThinkingPanel({
  activities,
  isLive,
}: {
  activities: AgentActivity[];
  isLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(isLive ? true : false);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  useEffect(() => { if (isLive) setExpanded(true); }, [isLive]);

  if (activities.length === 0) return null;

  const visible = activities.filter(
    (a) => a.type !== 'stream_chunk' && a.type !== 'agent_end' && a.type !== 'agent_start'
  );
  if (visible.length === 0) return null;

  const runningCount = visible.filter((a) => a.status === 'running').length;
  const hasErrors = visible.some((a) => a.status === 'error');
  const hasPlan = visible.some(a => a.type === 'plan_created');
  const hasReAct = visible.some(a => a.type.startsWith('react_'));

  // Group ReAct activities by turn
  const reactTurns = new Map<number, AgentActivity[]>();
  const systemActivities: AgentActivity[] = [];
  const planActivities: AgentActivity[] = [];

  for (const a of visible) {
    if (a.type.startsWith('plan_')) {
      planActivities.push(a);
    } else if (a.type.startsWith('react_') && a.reactTurn) {
      if (!reactTurns.has(a.reactTurn)) reactTurns.set(a.reactTurn, []);
      reactTurns.get(a.reactTurn)!.push(a);
    } else {
      systemActivities.push(a);
    }
  }

  // Agents involved
  const agentsSeen: AgentRole[] = [];
  for (const a of visible) {
    if (!agentsSeen.includes(a.agent)) agentsSeen.push(a.agent);
  }

  // Find dominant agent for the panel header
  const dominantAgent = agentsSeen.length === 1 ? agentsSeen[0] : 'orchestrator';
  const dominantMeta = AGENT_META[dominantAgent];

  const totalDuration = visible.reduce((sum, a) => sum + (a.durationMs || 0), 0);
  const runningStep = [...visible].reverse().find((a) => a.status === 'running');

  // If there's a plan, show PlanTimeline + other activities
  if (hasPlan) {
    // Separate plan activities from other system activities for proper rendering
    const planActs = visible.filter(a => a.type.startsWith('plan_'));
    const otherActs = visible.filter(a => !a.type.startsWith('plan_') && !a.type.startsWith('react_') && a.type !== 'agent_start' && a.type !== 'agent_end');
    return (
      <div className="space-y-1">
        <PlanTimeline activities={planActs} isLive={isLive} />
        {otherActs.length > 0 && (
          <div className="flex items-start gap-3 animate-slide-up">
            <div className="flex w-8 shrink-0 flex-col items-center pt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              <div className="mt-1 w-px flex-1 bg-border" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="rounded-lg border border-border/40 bg-muted/10 px-2 py-1.5">
                <div className="space-y-0.5">
                  {otherActs.map((act) => {
                    const meta = AGENT_META[act.agent];
                    const visual = ACTIVITY_VISUAL[act.type];
                    return (
                      <div key={act.id} className="flex items-center gap-2 text-[10.5px]">
                        <span style={{ color: '#64748b' }}>{visual.icon}</span>
                        <span className="rounded px-1 text-[9px] font-semibold"
                          style={{ color: meta.color, backgroundColor: `${meta.color}12` }}>
                          {meta.icon} {meta.name}
                        </span>
                        <span className="text-muted/70 truncate">{act.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="flex w-8 shrink-0 flex-col items-center pt-1">
        <div className="h-2 w-2 rounded-full" style={{
          backgroundColor: isLive && runningCount > 0 ? dominantMeta.color : '#64748b',
          boxShadow: isLive && runningCount > 0 ? `0 0 8px ${dominantMeta.color}80` : 'none',
        }} />
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Collapsed toggle bar */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
        >
          <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] ${
            isLive && runningCount > 0 ? 'animate-spin-slow' : ''
          }`} style={{
            color: isLive && runningCount > 0 ? dominantMeta.color : hasErrors ? '#f87171' : '#64748b',
          }}>
            {isLive && runningCount > 0 ? '◐' : hasErrors ? '✕' : '◇'}
          </span>

          <span className="text-[12px] font-medium text-muted-foreground">
            {isLive && runningCount > 0 ? (
              <>
                {hasReAct ? '推理链执行中' : '思考中'}
                {runningStep && (
                  <span className="ml-1.5 font-normal text-muted">· {runningStep.label}</span>
                )}
              </>
            ) : hasErrors ? (
              <>推理过程（有问题）</>
            ) : (
              <>推理过程</>
            )}
          </span>

          <div className="flex items-center gap-1">
            {agentsSeen.map((role) => {
              const meta = AGENT_META[role];
              return (
                <span key={role} title={meta.paradigmDesc}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                  {meta.icon} {meta.name}
                </span>
              );
            })}
          </div>

          <div className="flex-1" />

          {!isLive && (
            <span className="font-mono text-[10px] text-muted/60">
              {reactTurns.size > 0 ? `${reactTurns.size} 轮推理` : `${visible.length} 步`}
              {totalDuration > 0 && ` · ${(totalDuration / 1000).toFixed(1)}s`}
            </span>
          )}

          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-muted/50 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="ml-0 mt-1 rounded-xl border border-border/60 bg-muted/15 overflow-hidden">
            {/* ReAct iterations grouped by turn */}
            {reactTurns.size > 0 && (
              <div className="p-2">
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/50">ReAct 推理链</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                {Array.from(reactTurns.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([turn, acts]) => (
                    <ReActIteration
                      key={turn}
                      turn={turn}
                      activities={acts}
                      agentMeta={(() => {
                        const agent = acts[0]?.agent || dominantAgent;
                        return AGENT_META[agent];
                      })()}
                    />
                  ))}
              </div>
            )}

            {/* System activities (skill load, knowledge read, validate, etc.) */}
            {systemActivities.length > 0 && (
              <div className={`${reactTurns.size > 0 ? 'border-t border-border/40 p-2' : 'p-2'}`}>
                {reactTurns.size > 0 && (
                  <div className="mb-1.5 flex items-center gap-1.5 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/50">系统活动</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}
                <div className="space-y-0.5">
                  {systemActivities.map((act) => {
                    const meta = AGENT_META[act.agent];
                    const visual = ACTIVITY_VISUAL[act.type];
                    const isRunning = act.status === 'running';
                    const hasDetail = !!act.detail;
                    const isOpen = detailFor === act.id;
                    const isError = act.status === 'error';
                    const isWarning = act.status === 'warning';

                    return (
                      <div key={act.id}>
                        <button
                          type="button"
                          onClick={() => hasDetail && setDetailFor(isOpen ? null : act.id)}
                          className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                            hasDetail ? 'cursor-pointer hover:bg-background/60' : 'cursor-default'
                          }`}
                        >
                          <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] ${
                            isRunning ? 'animate-spin-slow' : ''
                          }`} style={{
                            color: isError ? '#f87171' : isWarning ? '#fbbf24' : isRunning ? dominantMeta.color : '#64748b',
                          }}>
                            {isRunning ? '◐' : isError ? '✕' : isWarning ? '⚠' : visual.icon}
                          </span>
                          <span title={meta.paradigmDesc}
                            className="shrink-0 rounded px-1 text-[9.5px] font-semibold"
                            style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                            {meta.icon} {meta.name}
                          </span>
                          {visual.label && (
                            <span className="shrink-0 text-[10px] text-muted/70">{visual.label}</span>
                          )}
                          <span className={`flex-1 truncate ${isRunning ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {act.label}
                          </span>
                          {act.durationMs !== undefined && !isRunning && (
                            <span className="shrink-0 font-mono text-[10px] text-muted/50">
                              {act.durationMs < 1000 ? `${act.durationMs}ms` : `${(act.durationMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          {hasDetail && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              className={`text-muted/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          )}
                        </button>
                        {isOpen && act.detail && (
                          <div className="ml-7 mr-2 mb-1 rounded bg-background/80 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {act.detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// StreamingBubble — live content output with agent identity
// ============================================================

function StreamingBubble({
  agent,
  content,
}: {
  agent: AgentRole | null;
  content: string;
}) {
  const agentMeta = agent ? AGENT_META[agent] : AGENT_META.orchestrator;

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="pixel-avatar-box h-9 w-9 shrink-0" style={{ borderColor: `${agentMeta.color}50` }}>
        <PixelAvatar role={agentMeta.role} size={28} floating />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold"
            style={{ color: agentMeta.color, backgroundColor: `${agentMeta.color}12`, border: `1px solid ${agentMeta.color}25` }}>
            <span>{agentMeta.icon}</span>
            {agentMeta.name}
            <span className="opacity-60 font-normal text-[9px] ml-0.5">·{agentMeta.paradigm}</span>
          </span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: agentMeta.color }} />
            <span style={{ color: agentMeta.color }}>正在输出…</span>
          </span>
        </div>
        <div className="agent-message-bubble max-w-[85%]" style={{ '--agent-color': agentMeta.color } as React.CSSProperties}>
          {content ? (
            <>
              {renderMarkdown(content)}
              <span className="streaming-cursor" />
            </>
          ) : (
            <span className="flex items-center gap-1.5 py-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="pixel-avatar-box h-9 w-9 shrink-0">
        <PixelAvatar role="orchestrator" size={28} floating />
      </div>
      <div className="agent-message-bubble flex items-center gap-2 py-3" style={{ '--agent-color': '#818cf8' } as React.CSSProperties}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="ml-2 text-xs text-muted">总控正在分析…</span>
      </div>
    </div>
  );
}

// ============================================================
// MessageBubble — user or assistant message with agent identity
// ============================================================

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const time = message.timestamp && message.timestamp > 0
    ? new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 animate-slide-up">
        <div className="user-message-bubble max-w-[80%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="pixel-avatar-box h-9 w-9 shrink-0" style={{ borderColor: '#a78bfa50' }}>
          <PixelAvatar role="user" size={28} />
        </div>
      </div>
    );
  }

  const agentMeta = message.agentRole ? AGENT_META[message.agentRole] : null;

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="pixel-avatar-box h-9 w-9 shrink-0"
        style={agentMeta ? { borderColor: `${agentMeta.color}50` } : undefined}>
        <PixelAvatar role={agentMeta?.role ?? 'orchestrator'} size={28} floating />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          {agentMeta && (
            <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{ color: agentMeta.color, backgroundColor: `${agentMeta.color}12`, border: `1px solid ${agentMeta.color}25` }}>
              <span>{agentMeta.icon}</span>
              {agentMeta.name}
              <span className="opacity-60 font-normal text-[9px] ml-0.5">·{agentMeta.paradigm}</span>
            </span>
          )}
          {time && <span className="text-[10px] text-muted">{time}</span>}
        </div>
        <div className="agent-message-bubble max-w-[85%]"
          style={agentMeta ? { '--agent-color': agentMeta.color } as React.CSSProperties : undefined}>
          {renderMarkdown(message.content)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ActiveAgentsBar — shows which agents are currently active
// ============================================================

function ActiveAgentsBar({ activities, currentAgent }: { activities: AgentActivity[]; currentAgent: AgentRole | null }) {
  if (activities.length === 0 && !currentAgent) return null;

  const activeAgents = new Set<AgentRole>();
  for (const a of activities) {
    if (a.status === 'running') activeAgents.add(a.agent);
  }
  if (currentAgent) activeAgents.add(currentAgent);
  if (activeAgents.size === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 pt-2">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <span className="text-[10px] text-muted/60">活跃:</span>
        {Array.from(activeAgents).map(role => {
          const meta = AGENT_META[role];
          return (
            <span key={role}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ color: meta.color, backgroundColor: `${meta.color}12`, border: `1px solid ${meta.color}25` }}>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.icon} {meta.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ChatPanel — main chat interface
// ============================================================

export function ChatPanel({
  messages,
  onSend,
  isLoading,
  liveActivities = [],
  streamingContent = '',
  streamingAgent = null,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== 'system'),
    [messages]
  );

  const isStreaming = isLoading && (streamingContent.length > 0 || streamingAgent !== null);
  const showLiveThinking = isLoading && liveActivities.length > 0;
  const showTyping = isLoading && !isStreaming && liveActivities.length === 0;

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleMessages, isLoading, streamingContent, liveActivities.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleQuickAction = (cmd: string) => {
    if (isLoading) return;
    onSend(cmd);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Active agents indicator bar */}
      <ActiveAgentsBar activities={liveActivities} currentAgent={streamingAgent} />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {visibleMessages.map((message, idx) => {
            const isLastAssistant =
              message.role === 'assistant' && idx === visibleMessages.length - 1;
            return (
              <div key={idx} className="space-y-2">
                {/* Show enhanced thinking panel above assistant messages */}
                {message.role === 'assistant' &&
                  message.activities &&
                  message.activities.length > 0 &&
                  !(isLoading && isLastAssistant) && (
                    <EnhancedThinkingPanel activities={message.activities} isLive={false} />
                  )}
                <MessageBubble message={message} />
              </div>
            );
          })}

          {/* Live thinking panel for current in-flight turn */}
          {showLiveThinking && (
            <EnhancedThinkingPanel activities={liveActivities} isLive={true} />
          )}

          {/* Streaming content */}
          {isStreaming && (
            <StreamingBubble agent={streamingAgent} content={streamingContent} />
          )}

          {/* Typing indicator */}
          {showTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-border/60 px-4 pt-3">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.cmd}
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickAction(action.cmd)}
              className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              style={{
                borderColor: `${action.color}30`,
                backgroundColor: `${action.color}08`,
              }}
            >
              <span className="font-mono font-medium" style={{ color: action.color }}>
                {action.label}
              </span>
              <span className="text-muted group-hover:text-foreground transition-colors">
                {action.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={submit} className="px-4 pb-4 pt-2">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card/80 p-2 transition-all focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 focus-within:shadow-lg focus-within:shadow-accent/5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="向导师提问，或输入 /practice 开始练习…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100"
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted/60">
          <span className="text-indigo-400/70">Enter</span> 发送 · <span className="text-indigo-400/70">Shift+Enter</span> 换行 · 多智能体实时协作
        </p>
      </form>
    </div>
  );
}
