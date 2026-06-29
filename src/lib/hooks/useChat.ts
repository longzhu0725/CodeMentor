'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AgentMessage,
  AgentRole,
  AlgorithmProblem,
  ChatRequest,
  ChatResponse,
  CodeExecutionResult,
  LearnerState,
  AgentActivity,
} from '@/types';
import type { AppSettings } from '@/components/SettingsModal';
import { streamBrowserLLM, streamBrowserLLMMultiStep } from '@/lib/llm/browser-client';
import type { AgentStep } from '@/lib/llm/browser-client';
import { quickValidate } from '@/lib/problem-validator';

export type { AgentActivity };

export interface SendMessageContext {
  code?: string;
  executionResult?: CodeExecutionResult;
  problem?: AlgorithmProblem;
}

export interface UseChatOptions {
  learnerState: LearnerState;
  onLearnerStateUpdate?: (updater: (prev: LearnerState) => LearnerState) => void;
  settings?: AppSettings | null;
  /** The problem currently shown in the practice workbench, if any. */
  currentProblem?: AlgorithmProblem | null;
}

export interface UseChatReturn {
  messages: AgentMessage[];
  sendMessage: (text: string, context?: SendMessageContext) => Promise<void>;
  appendMessage: (message: AgentMessage) => void;
  loadMessages: (msgs: AgentMessage[]) => void;
  isLoading: boolean;
  /** Activities for the *current* in-flight turn (live-updating). */
  liveActivities: AgentActivity[];
  /** Content being streamed in (empty string when not streaming) */
  streamingContent: string;
  /** Which agent is currently responding (for avatar/name during streaming) */
  streamingAgent: AgentRole | null;
  currentProblem: AlgorithmProblem | null;
  clearChat: () => void;
}

const WELCOME_MESSAGE: AgentMessage = {
  role: 'assistant',
  content:
    '你好！我是 **CodeMentor**，你的多智能体 AI 算法导师。\n\n我可以帮你：\n- 讲解算法与数据结构知识点\n- 生成个性化练习题并提供 **苏格拉底式** 提示\n- 评估你的代码并指出改进方向\n- 制定个性化学习路径\n\n试试输入 `/practice` 开始练习，或 `/plan` 生成学习计划。',
  agentRole: 'orchestrator',
  timestamp: 0,
};

// Keywords that indicate the user wants to practice / get a problem.
const PRACTICE_KEYWORDS = [
  '出题', '出一道', '来一道', '练习题', '给我题', '刷题',
  '做题', '算法题', '考考我', '挑战', '练一练',
  'practice', 'give me a problem', 'exercise',
];

// Keywords that indicate the user wants a study plan.
const PLAN_KEYWORDS = [
  '学习计划', '学习路径', '学习路线', '规划', '怎么学',
  '学习建议', '复习计划', '进阶路线',
  'study plan', 'learning path', 'roadmap',
];

// Keywords that indicate the user wants a hint.
const HINT_KEYWORDS = [
  '提示', '给个提示', '卡住了', '不会做', '思路',
  '怎么想', '点拨', '启发',
];

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function inferMode(text: string, context?: SendMessageContext): 'chat' | 'practice' | 'plan' | 'review' {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.startsWith('/practice')) return 'practice';
  if (trimmed.startsWith('/plan')) return 'plan';
  if (trimmed.startsWith('/hint')) return 'review';
  if (context?.code) return 'review';
  if (matchesAny(trimmed, PRACTICE_KEYWORDS)) return 'practice';
  if (matchesAny(trimmed, PLAN_KEYWORDS)) return 'plan';
  if (matchesAny(trimmed, HINT_KEYWORDS)) return 'review';
  return 'chat';
}

function inferIntent(text: string): 'chat' | 'practice' | 'plan' | 'review' {
  return inferMode(text);
}

// ============================================================
// Multi-step intent detection
// Detects when a user request requires multiple agents working
// in sequence (e.g., "先讲解数组，再出一道题")
// ============================================================

function detectMultiStepRequest(text: string): AgentStep[] | null {
  // Detect individual intent keywords
  const hasExplain = /讲解|说说|介绍|解释|什么是|怎么理解|了解一下|学习一下|讲一下|说下/.test(text);
  const hasPractice = /出题|出一道|来一道|练习题|考考|做题|算法题|练一练|给我题/.test(text);
  const hasPlan = /学习计划|学习路径|学习路线|规划|怎么学/.test(text);
  const hasReview = /评估|审查|看看代码|检查代码/.test(text);

  // Detect sequential connectors
  const hasSequential = /先.{0,40}(再|然后|接着|之后)|首先.{0,40}(然后|接着|再)|.{0,20}(然后|接着|再).{0,20}(出题|练习|考|规划)/.test(text);

  // Also check for comma-separated dual intents
  const hasMultiIntent = [hasExplain, hasPractice, hasPlan, hasReview].filter(Boolean).length >= 2;

  if (!hasMultiIntent && !hasSequential) return null;

  // Extract topic from explain intent
  const topicMatch = text.match(
    /(?:讲解|说说|介绍|解释|了解|学习|讲一下|说下)\s*(?:一下\s*)?(?:关于\s*)?(.+?)(?:\s*[，,。.!！；;]|$)/
  );
  const topic = topicMatch ? topicMatch[1].trim().replace(/[，,。.！!；;？?]/g, '') : '';

  // Pattern: explain then practice
  if (hasExplain && hasPractice) {
    return [
      {
        agent: 'lecturer',
        mode: 'chat',
        task: topic
          ? `请讲解以下知识点：${topic}。请给出清晰的定义、核心概念和常见应用场景。`
          : text,
        usePrevContext: false,
      },
      {
        agent: 'problem_setter',
        mode: 'practice',
        task: topic
          ? `请基于刚才讲解的「${topic}」知识点，出一道相关的练习题。题目难度适中，包含边界测试用例。`
          : '请出一道与刚才讲解内容相关的练习题',
        usePrevContext: true,
      },
    ];
  }

  // Pattern: explain then plan
  if (hasExplain && hasPlan && (hasSequential || hasMultiIntent)) {
    return [
      {
        agent: 'lecturer',
        mode: 'chat',
        task: topic ? `请讲解以下知识点：${topic}` : text,
        usePrevContext: false,
      },
      {
        agent: 'path_planner',
        mode: 'plan',
        task: '基于刚才的讲解内容，为学生制定一个针对性的学习计划',
        usePrevContext: true,
      },
    ];
  }

  // Pattern: practice then review (less common, but supported)
  if (hasPractice && hasReview && hasSequential) {
    return [
      {
        agent: 'problem_setter',
        mode: 'practice',
        task: text,
        usePrevContext: false,
      },
      {
        agent: 'examiner',
        mode: 'review',
        task: '请评估刚才生成的题目和参考解答的质量',
        usePrevContext: true,
      },
    ];
  }

  return null;
}

function modeToAgent(mode: string): AgentRole {
  switch (mode) {
    case 'practice': return 'problem_setter';
    case 'plan': return 'path_planner';
    case 'review': return 'examiner';
    default: return 'lecturer';
  }
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { learnerState, onLearnerStateUpdate, settings } = options;

  const [messages, setMessages] = useState<AgentMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveActivities, setLiveActivities] = useState<AgentActivity[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingAgent, setStreamingAgent] = useState<AgentRole | null>(null);
  const [currentProblem, setCurrentProblem] = useState<AlgorithmProblem | null>(
    options.currentProblem ?? null
  );

  // Keep the latest state accessible inside async callbacks.
  const learnerStateRef = useRef(learnerState);
  learnerStateRef.current = learnerState;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const currentProblemRef = useRef(currentProblem);
  currentProblemRef.current = currentProblem;

  const sendMessage = useCallback(
    async (text: string, context?: SendMessageContext) => {
      const content = text.trim();
      if (!content || isLoading) return;

      const mode = inferMode(content, context);
      const intent = inferIntent(content);
      const multiSteps = detectMultiStepRequest(content);

      const userMessage: AgentMessage = {
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      const nextMessages = [...messagesRef.current, userMessage];
      setMessages(nextMessages);
      setIsLoading(true);
      setLiveActivities([]);
      setStreamingContent('');
      setStreamingAgent(multiSteps ? multiSteps[0].agent : modeToAgent(mode));

      const requestBody: ChatRequest = {
        messages: nextMessages,
        learnerState: learnerStateRef.current,
        provider: settings?.provider,
        apiKey: settings?.apiKey,
        mode,
        context: {
          currentProblem: context?.problem ?? currentProblemRef.current ?? undefined,
          codeSubmission: context?.code,
          executionResult: context?.executionResult,
        },
      };

      // Buffer for streaming content & activities (collected during this turn)
      let streamedText = '';
      const turnActivities: AgentActivity[] = [];

      try {
        const hasApiKey = !!settings?.apiKey;
        const useBrowserCall =
          hasApiKey &&
          (settings!.provider === 'volcengine' ||
            settings!.provider === 'openai' ||
            settings!.provider === 'custom');

        if (useBrowserCall) {
          // Shared callbacks for both single-step and multi-step
          const llmCallbacks = {
            onActivity: (act: AgentActivity) => {
              const idx = turnActivities.findIndex((a) => a.id === act.id);
              if (idx >= 0) turnActivities[idx] = act;
              else turnActivities.push(act);
              setLiveActivities([...turnActivities]);
              if (act.type === 'agent_start' && act.agent !== 'orchestrator') {
                setStreamingAgent(act.agent);
              }
            },
            onToken: (delta: string) => {
              streamedText += delta;
              setStreamingContent(streamedText);
            },
            onProblem: (p: AlgorithmProblem) => {
              if (quickValidate(p)) {
                setCurrentProblem(p);
              }
            },
          };

          const chatContext = {
            currentProblem: context?.problem ?? currentProblemRef.current ?? undefined,
            codeSubmission: context?.code,
            executionResult: context?.executionResult
              ? {
                  passed: context.executionResult.testResults?.passed ?? 0,
                  failed:
                    (context.executionResult.testResults?.total ?? 0) -
                    (context.executionResult.testResults?.passed ?? 0),
                  details:
                    context.executionResult.error ||
                    context.executionResult.output ||
                    undefined,
                }
              : undefined,
          };

          const llmSettings = {
            provider: settings!.provider,
            apiKey: settings!.apiKey,
            model: settings!.model,
            baseURL: settings!.baseURL,
          };

          // Route to multi-step orchestration or single-agent call
          const data = multiSteps && multiSteps.length > 1
            ? await streamBrowserLLMMultiStep(
                nextMessages,
                llmSettings,
                multiSteps,
                learnerStateRef.current,
                llmCallbacks,
                chatContext
              )
            : await streamBrowserLLM(
                nextMessages,
                llmSettings,
                mode,
                learnerStateRef.current,
                llmCallbacks,
                chatContext
              );

          const finalContent = data.content || streamedText || '（导师暂未返回内容）';
          // turnActivities is a superset: it captures ALL callback emissions
          // (including reasoning activities from callLLMStreaming), so prefer it.
          const finalActivities = turnActivities.length > 0
            ? turnActivities
            : (data.activities || []);

          // Finalize assistant message with activities attached
          const assistantMessage: AgentMessage = {
            role: 'assistant',
            content: finalContent,
            agentRole: multiSteps ? multiSteps[multiSteps.length - 1].agent : modeToAgent(mode),
            timestamp: Date.now(),
            activities: finalActivities,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent('');
          setStreamingAgent(null);
          setLiveActivities([]);

          if (data.problem) {
            if (quickValidate(data.problem)) {
              setCurrentProblem(data.problem);
            } else {
              const { getRandomProblem } = await import('@/lib/knowledge/problems');
              const localProblem = getRandomProblem();
              setCurrentProblem(localProblem);
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    content:
                      last.content +
                      '\n\n> ⚠️ AI 生成的题目未通过质量验证，已从本地题库为你选取一道替代题目。',
                  };
                }
                return copy;
              });
            }
          }

          if (data.learnerStateUpdates && onLearnerStateUpdate) {
            onLearnerStateUpdate((prev) => ({ ...prev, ...data.learnerStateUpdates! }));
          }

          if (onLearnerStateUpdate) {
            onLearnerStateUpdate((prev) => ({
              ...prev,
              checkpoints: [
                ...prev.checkpoints,
                {
                  timestamp: Date.now(),
                  summary: content.slice(0, 80),
                  topicsCovered: data.problem ? [data.problem.topicId] : [],
                  intent,
                },
              ].slice(-5),
            }));
          }
        } else {
          // Non-browser path: server API
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`服务返回 ${res.status}${detail ? `：${detail}` : ''}`);
          }

          const data = (await res.json()) as ChatResponse;

          const assistantMessage: AgentMessage = {
            role: 'assistant',
            content: data.content || '（导师暂未返回内容）',
            agentRole: data.agentTrail?.[data.agentTrail.length - 1]?.agent,
            timestamp: Date.now(),
            activities: data.activities,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setLiveActivities([]);

          if (data.problem) {
            if (quickValidate(data.problem)) {
              setCurrentProblem(data.problem);
            } else {
              const { getRandomProblem } = await import('@/lib/knowledge/problems');
              const localProblem = getRandomProblem();
              setCurrentProblem(localProblem);
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    content:
                      last.content +
                      '\n\n> ⚠️ AI 生成的题目未通过质量验证，已从本地题库为你选取一道替代题目。',
                  };
                }
                return copy;
              });
            }
          }

          if (data.learnerStateUpdates && onLearnerStateUpdate) {
            onLearnerStateUpdate((prev) => ({ ...prev, ...data.learnerStateUpdates! }));
          }

          if (onLearnerStateUpdate) {
            onLearnerStateUpdate((prev) => ({
              ...prev,
              checkpoints: [
                ...prev.checkpoints,
                {
                  timestamp: Date.now(),
                  summary: content.slice(0, 80),
                  topicsCovered: data.problem ? [data.problem.topicId] : [],
                  intent,
                },
              ].slice(-5),
            }));
          }

          setStreamingContent('');
          setStreamingAgent(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        const errorMessage: AgentMessage = {
          role: 'assistant',
          content: `抱歉，连接导师服务时出现问题：\n\n\`${message}\`\n\n请检查网络连接或前往「设置」确认 API Key 配置后重试。`,
          agentRole: 'orchestrator',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setStreamingContent('');
        setStreamingAgent(null);
        setLiveActivities([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, settings, onLearnerStateUpdate]
  );

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setLiveActivities([]);
    setStreamingContent('');
    setStreamingAgent(null);
    setIsLoading(false);
  }, []);

  const appendMessage = useCallback((message: AgentMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const loadMessages = useCallback((msgs: AgentMessage[]) => {
    setMessages(msgs.length > 0 ? msgs : [WELCOME_MESSAGE]);
    setLiveActivities([]);
    setStreamingContent('');
    setStreamingAgent(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    sendMessage,
    appendMessage,
    loadMessages,
    isLoading,
    liveActivities,
    streamingContent,
    streamingAgent,
    currentProblem,
    clearChat,
  };
}
