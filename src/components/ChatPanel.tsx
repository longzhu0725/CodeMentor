'use client';

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgentMessage, AgentRole, AgentActivity } from '@/types';
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

const AGENT_META: Record<AgentRole, { name: string; role: MascotRole; color: string }> = {
  orchestrator: { name: '总控', role: 'orchestrator', color: '#818cf8' },
  lecturer: { name: '讲师', role: 'lecturer', color: '#34d399' },
  problem_setter: { name: '出题官', role: 'problem_setter', color: '#fbbf24' },
  examiner: { name: '考官', role: 'examiner', color: '#f87171' },
  path_planner: { name: '规划师', role: 'path_planner', color: '#fb923c' },
};

const QUICK_ACTIONS: { cmd: string; label: string; desc: string }[] = [
  { cmd: '/practice', label: '/practice', desc: '开始练习' },
  { cmd: '/plan', label: '/plan', desc: '生成学习计划' },
  { cmd: '/hint', label: '/hint', desc: '给我一个提示' },
];

// ============================================================
// Activity type icons
// ============================================================

const ACTIVITY_ICONS: Record<AgentActivity['type'], { running: string; done: string }> = {
  agent_start: { running: '◐', done: '●' },
  agent_end: { running: '○', done: '●' },
  skill_load: { running: '◐', done: '◆' },
  knowledge_read: { running: '◐', done: '▤' },
  tool_call: { running: '◐', done: '▸' },
  tool_result: { running: '○', done: '✓' },
  thinking: { running: '◐', done: '…' },
  validate: { running: '◐', done: '✓' },
  stream_chunk: { running: '·', done: '·' },
  error: { running: '✕', done: '✕' },
};

const ACTIVITY_TYPE_LABEL: Record<AgentActivity['type'], string> = {
  agent_start: '启动',
  agent_end: '完成',
  skill_load: '技能',
  knowledge_read: '知识库',
  tool_call: '工具',
  tool_result: '结果',
  thinking: '思考',
  validate: '验证',
  stream_chunk: '',
  error: '错误',
};

function getActivityIcon(act: AgentActivity): string {
  const icons = ACTIVITY_ICONS[act.type] || ACTIVITY_ICONS.thinking;
  if (act.status === 'error') return '✕';
  if (act.status === 'warning') return '⚠';
  if (act.status === 'running') return icons.running;
  return icons.done;
}

function getActivityColor(act: AgentActivity): string {
  if (act.status === 'error') return '#f87171';
  if (act.status === 'warning') return '#fbbf24';
  if (act.status === 'running') return '#818cf8';
  return '#94a3b8';
}

// ============================================================
// Lightweight Markdown renderer
// ============================================================

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyBase}-s${i}`} className="md-strong">
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="md-code">
          {m[3]}
        </code>
      );
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderTextBlocks(text: string, keyBase: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let listKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const header = line.match(/^(#{1,3})\s+(.*)$/);
    if (header) {
      const level = header[1].length;
      const cls = level === 1 ? 'md-h1' : level === 2 ? 'md-h2' : 'md-h3';
      blocks.push(
        <div key={`${keyBase}-h${i}`} className={cls}>
          {renderInline(header[2], `${keyBase}-hi${i}`)}
        </div>
      );
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={`${keyBase}-q${i}`} className="md-blockquote">
          {quoteLines.map((l, li) => (
            <p key={li} className="md-p">
              {renderInline(l, `${keyBase}-ql${i}-${li}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`${keyBase}-ul${listKey++}`} className="md-ul">
          {items.map((it, li) => (
            <li key={li} className="md-li">
              {renderInline(it, `${keyBase}-uli${li}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`${keyBase}-ol${listKey++}`} className="md-ol">
          {items.map((it, li) => (
            <li key={li} className="md-li">
              {renderInline(it, `${keyBase}-oli${li}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`${keyBase}-p${i}`} className="md-p">
        {renderInline(paraLines.join(' '), `${keyBase}-pi${i}`)}
      </p>
    );
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
      if (langMatch) {
        lang = langMatch[1];
        code = trimmed.slice(langMatch[0].length);
      }
      blocks.push(
        <pre key={key} className="md-code-block">
          {lang && (
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-muted">
              {lang}
            </span>
          )}
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
// ThinkingChain — inline collapsible reasoning block
// Shows the chain of agent activities as an indented, subtle
// panel within the conversation (like Claude Code's thought trace).
// ============================================================

function ThinkingChain({
  activities,
  isLive,
}: {
  activities: AgentActivity[];
  isLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(isLive ? true : false);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  // Auto-expand while live; collapse when done
  useEffect(() => {
    if (isLive) setExpanded(true);
  }, [isLive]);

  if (activities.length === 0) return null;

  const visible = activities.filter(
    (a) => a.type !== 'stream_chunk' && a.type !== 'agent_end'
  );
  if (visible.length === 0) return null;

  const runningCount = visible.filter((a) => a.status === 'running').length;
  const hasErrors = visible.some((a) => a.status === 'error');
  const totalDuration = visible.reduce((sum, a) => sum + (a.durationMs || 0), 0);

  // Agents involved (in order of first appearance)
  const agentsSeen: AgentRole[] = [];
  for (const a of visible) {
    if (!agentsSeen.includes(a.agent)) agentsSeen.push(a.agent);
  }

  // Current/latest running step label for collapsed preview
  const runningStep = [...visible].reverse().find((a) => a.status === 'running');

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      {/* Indented connector line, aligned with message avatars */}
      <div className="flex w-8 shrink-0 flex-col items-center pt-1">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: isLive && runningCount > 0 ? '#818cf8' : '#64748b',
            boxShadow: isLive && runningCount > 0 ? '0 0 8px #818cf880' : 'none',
          }}
        />
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Collapsed toggle bar */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
        >
          {/* Status icon */}
          <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] ${
              isLive && runningCount > 0 ? 'animate-spin-slow' : ''
            }`}
            style={{
              color: isLive && runningCount > 0
                ? '#818cf8'
                : hasErrors
                ? '#f87171'
                : '#64748b',
            }}
          >
            {isLive && runningCount > 0 ? '◐' : hasErrors ? '✕' : '◇'}
          </span>

          {/* Label */}
          <span className="text-[12px] font-medium text-muted-foreground">
            {isLive && runningCount > 0 ? (
              <>
                思考中
                {runningStep && (
                  <span className="ml-1.5 font-normal text-muted">
                    · {runningStep.label}
                  </span>
                )}
              </>
            ) : hasErrors ? (
              <>思考过程（有问题）</>
            ) : (
              <>思考过程</>
            )}
          </span>

          {/* Agent chips */}
          <div className="flex items-center gap-1">
            {agentsSeen.map((role) => {
              const meta = AGENT_META[role];
              return (
                <span
                  key={role}
                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium"
                  style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
                >
                  {meta.name}
                </span>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Step count & duration */}
          {!isLive && (
            <span className="font-mono text-[10px] text-muted/60">
              {visible.length} 步
              {totalDuration > 0 && ` · ${(totalDuration / 1000).toFixed(1)}s`}
            </span>
          )}

          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-muted/50 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Expanded steps */}
        {expanded && (
          <div className="ml-0 mt-1 space-y-0.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-2">
            {visible.map((act) => {
              const meta = AGENT_META[act.agent];
              const icon = getActivityIcon(act);
              const color = getActivityColor(act);
              const isRunning = act.status === 'running';
              const hasDetail = !!act.detail;
              const isOpen = detailFor === act.id;
              const typeLabel = ACTIVITY_TYPE_LABEL[act.type];

              return (
                <div key={act.id}>
                  <button
                    type="button"
                    onClick={() => hasDetail && setDetailFor(isOpen ? null : act.id)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11.5px] transition-colors ${
                      hasDetail ? 'cursor-pointer hover:bg-background/60' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center font-mono text-[11px] ${
                        isRunning ? 'animate-spin-slow' : ''
                      }`}
                      style={{ color }}
                    >
                      {icon}
                    </span>
                    <span
                      className="shrink-0 rounded px-1 text-[9.5px] font-semibold uppercase tracking-wide"
                      style={{
                        color: meta.color,
                        backgroundColor: `${meta.color}18`,
                      }}
                    >
                      {meta.name}
                    </span>
                    {typeLabel && (
                      <span className="shrink-0 text-[10px] text-muted/70">
                        {typeLabel}
                      </span>
                    )}
                    <span
                      className={`flex-1 truncate ${
                        isRunning ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {act.label}
                    </span>
                    {act.durationMs !== undefined && !isRunning && (
                      <span className="shrink-0 font-mono text-[10px] text-muted/50">
                        {act.durationMs < 1000
                          ? `${act.durationMs}ms`
                          : `${(act.durationMs / 1000).toFixed(1)}s`}
                      </span>
                    )}
                    {hasDetail && (
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`text-muted/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    )}
                  </button>
                  {isOpen && act.detail && (
                    <div className="ml-7 mr-2 mb-1 rounded bg-background/80 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                      {act.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// StreamingBubble — live content output with cursor
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
      <div
        className="pixel-avatar-box h-8 w-8 shrink-0"
        style={{ borderColor: `${agentMeta.color}50` }}
      >
        <PixelAvatar role={agentMeta.role} size={26} floating />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: agentMeta.color }}>
            {agentMeta.name}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-accent">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            正在输出…
          </span>
        </div>
        <div className="chat-bubble chat-bubble-assistant max-w-[85%]">
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
      <div className="pixel-avatar-box h-8 w-8 shrink-0">
        <PixelAvatar role="orchestrator" size={26} floating />
      </div>
      <div className="chat-bubble chat-bubble-assistant flex items-center gap-1.5 py-3">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="ml-2 text-xs text-muted">正在思考…</span>
      </div>
    </div>
  );
}

// ============================================================
// MessageBubble — user or assistant message
// ============================================================

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const time =
    message.timestamp && message.timestamp > 0
      ? new Date(message.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 animate-slide-up">
        <div className="chat-bubble chat-bubble-user max-w-[80%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="pixel-avatar-box h-8 w-8 shrink-0">
          <PixelAvatar role="user" size={26} />
        </div>
      </div>
    );
  }

  const agentMeta = message.agentRole
    ? AGENT_META[message.agentRole]
    : null;

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div
        className="pixel-avatar-box h-8 w-8 shrink-0"
        style={agentMeta ? { borderColor: `${agentMeta.color}50` } : undefined}
      >
        <PixelAvatar
          role={agentMeta?.role ?? 'orchestrator'}
          size={26}
          floating
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          {agentMeta && (
            <span
              className="text-xs font-semibold"
              style={{ color: agentMeta.color }}
            >
              {agentMeta.name}
            </span>
          )}
          {time && <span className="text-[10px] text-muted">{time}</span>}
        </div>
        <div className="chat-bubble chat-bubble-assistant max-w-[85%]">
          {renderMarkdown(message.content)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ChatPanel
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
              <div key={idx} className="space-y-3">
                <MessageBubble message={message} />
                {/* Show attached thinking chain for completed assistant messages
                    (not for the very last one if we're currently loading —
                    the live ThinkingChain handles that). */}
                {message.role === 'assistant' &&
                  message.activities &&
                  message.activities.length > 0 &&
                  !(isLoading && isLastAssistant) && (
                    <ThinkingChain activities={message.activities} isLive={false} />
                  )}
              </div>
            );
          })}

          {/* Live thinking chain for current in-flight turn */}
          {showLiveThinking && (
            <ThinkingChain activities={liveActivities} isLive={true} />
          )}

          {/* Streaming content */}
          {isStreaming && (
            <StreamingBubble agent={streamingAgent} content={streamingContent} />
          )}

          {/* Typing dots (only when no activities yet) */}
          {showTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-border px-4 pt-3">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.cmd}
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickAction(action.cmd)}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-accent/50 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-mono font-medium text-accent">
                {action.label}
              </span>
              <span className="text-muted group-hover:text-foreground">
                {action.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={submit} className="px-4 pb-4 pt-2">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 transition-colors focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/40">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="向导师提问，或输入 /practice 开始练习…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted/60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-md shadow-accent/30 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            aria-label="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted/70">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </form>
    </div>
  );
}
