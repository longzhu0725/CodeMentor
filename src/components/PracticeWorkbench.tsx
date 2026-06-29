'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlgorithmProblem, CodeExecutionResult, SavedProblem } from '@/types';
import { loadPyodide, runCode, runTestCases } from './PyodideRunner';
import { PixelAvatar, PixelStars } from './PixelAvatar';
import { getProblemHistory } from '@/lib/problem-history/manager';

export interface PracticeWorkbenchProps {
  problem: AlgorithmProblem | null;
  onRun: (result: CodeExecutionResult) => void;
  onSubmit: (result: CodeExecutionResult) => void;
  code: string;
  setCode: (code: string) => void;
  executionResult: CodeExecutionResult | null;
  /** Callback when the user selects a different problem from history */
  onProblemChange?: (problem: AlgorithmProblem) => void;
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: '入门',
  2: '简单',
  3: '中等',
  4: '困难',
  5: '极难',
};

const DIFFICULTY_COLOR: Record<number, string> = {
  1: 'text-success border-success/40 bg-success/10',
  2: 'text-success border-success/40 bg-success/10',
  3: 'text-warning border-warning/40 bg-warning/10',
  4: 'text-danger border-danger/40 bg-danger/10',
  5: 'text-danger border-danger/40 bg-danger/10',
};

/** Extract the first top-level function name from starter code. */
function extractFunctionName(code: string): string {
  const match = code.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/m);
  return match ? match[1] : 'solution';
}

// ============================================================
// Code editor (textarea + line-number gutter, no external libs)
// ============================================================

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function CodeEditor({ value, onChange }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(
    () => Math.max(value.split('\n').length, 1),
    [value]
  );

  const gutterText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'),
    [lineCount]
  );

  const syncScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab inserts 4 spaces; Shift+Tab would outdent (kept simple here).
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const indent = '    ';
      const newValue = value.slice(0, start) + indent + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + indent.length;
      });
    }
  };

  return (
    <div className="code-editor-container h-full">
      <div
        ref={gutterRef}
        className="code-editor-gutter"
        aria-hidden="true"
      >
        {gutterText}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="# 在这里编写你的 Python 解法"
        className="code-editor-textarea"
      />
    </div>
  );
}

// ============================================================
// Test / run results panel
// ============================================================

function ResultsPanel({ result }: { result: CodeExecutionResult | null }) {
  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted">
        <div>
          <div className="pixel-avatar-box mx-auto mb-3 h-12 w-12">
            <PixelAvatar role="examiner" size={32} />
          </div>
          <p>点击「运行」用示例输入执行代码</p>
          <p className="mt-1 text-xs text-muted/70">或点击「提交评测」运行全部测试用例</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      {/* Status banner */}
      {result.testResults ? (
        <div
          className={`rounded-xl border p-3 ${
            result.testResults.passed === result.testResults.total
              ? 'border-success/40 bg-success/10'
              : 'border-warning/40 bg-warning/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">测试结果</span>
            <span
              className={`font-mono text-sm font-bold ${
                result.testResults.passed === result.testResults.total
                  ? 'text-success'
                  : 'text-warning'
              }`}
            >
              {result.testResults.passed} / {result.testResults.total}
            </span>
          </div>
          <div className="progress-track pixel-progress mt-2 h-2 w-full">
            <div
              className={`progress-fill ${
                result.testResults.passed === result.testResults.total
                  ? 'bg-success'
                  : 'bg-warning'
              }`}
              style={{
                width: `${
                  result.testResults.total > 0
                    ? (result.testResults.passed / result.testResults.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ) : result.error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
          <span className="font-semibold text-danger">执行出错</span>
        </div>
      ) : (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3">
          <span className="font-semibold text-success">代码执行成功</span>
        </div>
      )}

      {/* Failures */}
      {result.testResults?.failures && result.testResults.failures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">未通过的用例</div>
          {result.testResults.failures.map((f, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-border bg-background p-2.5 font-mono text-xs"
            >
              <div className="mb-1 text-muted">
                <span className="text-foreground">输入：</span>
                {f.input || '(空)'}
              </div>
              <div className="mb-1 text-muted">
                <span className="text-success">期望：</span>
                {f.expected || '(空)'}
              </div>
              <div className="text-muted">
                <span className="text-danger">实际：</span>
                {f.actual || '(空)'}
                {f.error && (
                  <span className="mt-1 block text-danger/80">{f.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stdout / Return value (always show when there's output) */}
      {result.output && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted">
            {result.testResults ? '输出信息' : '程序输出'}
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-background p-2.5 font-mono text-xs text-foreground whitespace-pre-wrap">
{result.output}
          </pre>
        </div>
      )}

      {/* Error details */}
      {result.error && (
        <div>
          <div className="mb-1 text-xs font-medium text-danger">错误详情</div>
          <pre className="max-h-64 overflow-auto rounded-lg border border-danger/30 bg-danger/5 p-2.5 font-mono text-xs text-danger/90 whitespace-pre-wrap">
{result.error}
          </pre>
        </div>
      )}

      {/* Empty success state (no output, no tests, no error) */}
      {!result.testResults && !result.error && !result.output && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-success">
          代码执行完成（无输出）。尝试添加 print() 语句查看结果。
        </div>
      )}
    </div>
  );
}

// ============================================================
// Problem history panel (sidebar in the practice workbench)
// ============================================================

const STATUS_META: Record<
  SavedProblem['status'],
  { label: string; dot: string; border: string; bg: string }
> = {
  solved: {
    label: '已解决',
    dot: 'bg-success',
    border: 'border-success/40',
    bg: 'bg-success/10',
  },
  attempted: {
    label: '尝试中',
    dot: 'bg-warning',
    border: 'border-warning/40',
    bg: 'bg-warning/10',
  },
  unsolved: {
    label: '未开始',
    dot: 'bg-muted',
    border: 'border-border',
    bg: 'bg-card-hover',
  },
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

interface ProblemHistoryPanelProps {
  history: SavedProblem[];
  currentProblemId?: string;
  onSelect: (problem: AlgorithmProblem) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function ProblemHistoryPanel({
  history,
  currentProblemId,
  onSelect,
  collapsed,
  onToggle,
}: ProblemHistoryPanelProps) {
  return (
    <div
      className={`flex h-full flex-col border-r border-border bg-background transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Header with toggle button */}
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        {!collapsed && (
          <span className="pixel-font text-xs font-bold text-foreground">
            题目目录
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted hover:bg-card-hover"
          title={collapsed ? '展开题目目录' : '收起题目目录'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
            style={{ transformOrigin: 'center' }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Problem list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">
              暂无历史题目
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((saved) => {
                const meta = STATUS_META[saved.status];
                const isActive = saved.id === currentProblemId;
                return (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => onSelect(saved.problem)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-accent bg-accent/10'
                        : `${meta.border} ${meta.bg} hover:brightness-110`
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-sm ${meta.dot}`}
                        style={{ borderRadius: 0 }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-foreground">
                          {saved.problem.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                          <span>{DIFFICULTY_LABEL[saved.problem.difficulty]}</span>
                          <span>·</span>
                          <span>{meta.label}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted/70">
                          {formatRelativeTime(saved.savedAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PracticeWorkbench
// ============================================================

export function PracticeWorkbench({
  problem,
  onRun,
  onSubmit,
  code,
  setCode,
  executionResult,
  onProblemChange,
}: PracticeWorkbenchProps) {
  const [localResult, setLocalResult] = useState<CodeExecutionResult | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'hints'>('results');
  const [showHistory, setShowHistory] = useState(true);
  const [historyList, setHistoryList] = useState<SavedProblem[]>([]);

  // Refresh history list whenever the current problem changes or code is submitted
  useEffect(() => {
    const history = getProblemHistory();
    setHistoryList(history.getAll());
  }, [problem?.id]);

  // Initialize code from the problem's starter code when the problem changes.
  useEffect(() => {
    if (problem) {
      setCode(problem.starterCode);
      setLocalResult(null);
      setShowHints(false);
      setActiveTab('results');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  const functionName = useMemo(
    () => (problem ? extractFunctionName(problem.starterCode) : 'solution'),
    [problem]
  );

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setPyodideLoading(true);
    setActiveTab('results');
    try {
      await loadPyodide();
      setPyodideLoading(false);
      // If we have a problem with examples, run the function with the first example input
      // so the user sees actual output instead of "no output" from just defining the function.
      const sampleInput = problem?.examples?.[0]?.input;
      // Parse the example input to extract arguments (strip "nums = " / "target = " etc.)
      let parsedInput: string | undefined;
      if (sampleInput) {
        // Convert "nums = [2,7,11,15], target = 9" -> "[2,7,11,15], 9"
        parsedInput = sampleInput
          .replace(/[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/g, '')
          .trim();
      }
      const result = await runCode(code, {
        functionName: functionName,
        sampleInput: parsedInput,
      });
      setLocalResult(result);
      onRun(result);
    } catch (err) {
      const result: CodeExecutionResult = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
      setLocalResult(result);
      onRun(result);
    } finally {
      setIsRunning(false);
      setPyodideLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem || !code.trim() || isRunning) return;
    setIsRunning(true);
    setPyodideLoading(true);
    setActiveTab('results');
    try {
      await loadPyodide();
      setPyodideLoading(false);
      const result = await runTestCases(
        code,
        problem.testCases,
        functionName
      );
      setLocalResult(result);
      onSubmit(result);
    } catch (err) {
      const result: CodeExecutionResult = {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
      setLocalResult(result);
      onSubmit(result);
    } finally {
      setIsRunning(false);
      setPyodideLoading(false);
    }
  };

  const displayedResult = executionResult ?? localResult;

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center animate-fade-in">
          <div className="pixel-avatar-box mx-auto mb-4 h-20 w-20">
            <PixelAvatar role="problem_setter" size={56} floating />
          </div>
          <h2 className="pixel-font text-xs font-bold text-foreground">
            还没有练习题
          </h2>
          <p className="mt-3 text-sm text-muted">
            前往「对话」视图，输入 <span className="font-mono text-accent">/practice</span> 让导师为你推荐或生成一道算法题。
            生成后即可在此处编写代码、运行与提交。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar: problem history directory */}
      <ProblemHistoryPanel
        history={historyList}
        currentProblemId={problem?.id}
        onSelect={(p) => {
          onProblemChange?.(p);
          setShowHistory(false);
        }}
        collapsed={!showHistory}
        onToggle={() => setShowHistory((s) => !s)}
      />

      {/* Main content: problem + editor */}
      <div className="grid h-full flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Left: problem description */}
        <div className="flex h-full flex-col overflow-hidden border-r border-border">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="pixel-avatar-box h-7 w-7 shrink-0">
                <PixelAvatar role="problem_setter" size={22} />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {problem.title}
              </h2>
              <span
                className={`ml-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  DIFFICULTY_COLOR[problem.difficulty] ??
                  'border-border bg-card text-muted'
                }`}
              >
                {DIFFICULTY_LABEL[problem.difficulty] ?? `${problem.difficulty} 星`}
              </span>
              <PixelStars count={problem.difficulty} size={11} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-card-hover px-1.5 py-0.5 text-[11px] text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="md-content">
              <p className="md-p whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {problem.description}
              </p>

              {problem.examples.length > 0 && (
                <>
                  <h3 className="md-h3">示例</h3>
                  {problem.examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="mb-3 rounded-xl border border-border bg-background p-3"
                    >
                      <div className="mb-1.5 text-xs font-medium text-muted">
                        示例 {idx + 1}
                      </div>
                      <div className="space-y-1 font-mono text-xs">
                        <div>
                          <span className="text-success">输入：</span>
                          <span className="text-foreground">{ex.input}</span>
                        </div>
                        <div>
                          <span className="text-warning">输出：</span>
                          <span className="text-foreground">{ex.output}</span>
                        </div>
                        {ex.explanation && (
                          <div className="pt-1 text-muted">
                            <span className="text-accent">解释：</span>
                            {ex.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {problem.constraints && problem.constraints.length > 0 && (
                <>
                  <h3 className="md-h3">约束条件</h3>
                  <ul className="md-ul">
                    {problem.constraints.map((c, idx) => (
                      <li key={idx} className="md-li text-sm">
                        <code className="md-code">{c}</code>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {problem.timeComplexity && (
                <div className="mt-4 flex gap-4 text-xs">
                  <div className="rounded-lg bg-card-hover px-3 py-1.5">
                    <span className="text-muted">时间复杂度：</span>
                    <span className="font-mono text-foreground">
                      {problem.timeComplexity}
                    </span>
                  </div>
                  <div className="rounded-lg bg-card-hover px-3 py-1.5">
                    <span className="text-muted">空间复杂度：</span>
                    <span className="font-mono text-foreground">
                      {problem.spaceComplexity}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: editor + actions + results */}
        <div className="flex h-full flex-col overflow-hidden">
          {/* Editor header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="h-2.5 w-2.5 bg-danger/70" style={{ borderRadius: 0 }} />
              <span className="h-2.5 w-2.5 bg-warning/70" style={{ borderRadius: 0 }} />
              <span className="h-2.5 w-2.5 bg-success/70" style={{ borderRadius: 0 }} />
              <span className="ml-2 font-mono">solution.py</span>
            </div>
            <span className="font-mono text-[11px] text-muted">
              函数：{functionName}()
            </span>
          </div>

          {/* Editor */}
          <div className="h-[40%] min-h-[180px] shrink-0 p-2">
            <CodeEditor value={code} onChange={setCode} />
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning || !code.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              运行
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isRunning || !code.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              提交评测
            </button>
            {pyodideLoading && (
              <span className="ml-1 text-xs text-muted">
                正在加载 Python 运行环境…
              </span>
            )}
            <div className="ml-auto flex rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'results'
                    ? 'bg-card-hover text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                测试结果
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('hints');
                  setShowHints(true);
                }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'hints'
                    ? 'bg-card-hover text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                提示
              </button>
            </div>
          </div>

          {/* Results / hints */}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border bg-background">
            {activeTab === 'results' ? (
              <ResultsPanel result={displayedResult} />
            ) : (
              <div className="space-y-3 p-4">
                {showHints && problem.hints.length > 0 ? (
                  problem.hints.map((hint, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-accent/30 bg-accent/5 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-accent">
                          提示 {idx + 1}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90">{hint}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">暂无提示。</p>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('results')}
                  className="text-xs text-accent hover:underline"
                >
                  ← 返回测试结果
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
