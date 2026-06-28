import { AgentMessage, LearnerState } from '@/types';
import { createDefaultLearnerState } from '@/lib/memory/learner-state';

// ============================================================
// Multi-Session Manager
// ------------------------------------------------------------
// Each session has its own chat history, learner state, and
// settings. Sessions are persisted to localStorage.
// ============================================================

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
  learnerState: LearnerState;
}

const SESSIONS_KEY = 'codementor:sessions:v1';
const ACTIVE_SESSION_KEY = 'codementor:active-session:v1';
const MAX_SESSIONS = 50;

function generateId(): string {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function createNewSession(title?: string): ChatSession {
  return {
    id: generateId(),
    title: title || '新对话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    learnerState: createDefaultLearnerState(),
  };
}

export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private activeSessionId: string = '';

  constructor() {
    this.loadSessions();
  }

  private loadSessions(): void {
    if (typeof window === 'undefined') {
      // SSR: create a default session in memory
      const defaultSession = createNewSession();
      this.sessions.set(defaultSession.id, defaultSession);
      this.activeSessionId = defaultSession.id;
      return;
    }
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as ChatSession[];
        for (const s of arr) {
          this.sessions.set(s.id, s);
        }
      }
      const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (activeId && this.sessions.has(activeId)) {
        this.activeSessionId = activeId;
      }
      // If no sessions, create a default one
      if (this.sessions.size === 0) {
        const defaultSession = createNewSession();
        this.sessions.set(defaultSession.id, defaultSession);
        this.activeSessionId = defaultSession.id;
        this.saveSessions();
      } else if (!this.activeSessionId) {
        // If no active session, use the most recent one
        const sorted = this.getSessionsSorted();
        this.activeSessionId = sorted[0].id;
      }
    } catch {
      const defaultSession = createNewSession();
      this.sessions.set(defaultSession.id, defaultSession);
      this.activeSessionId = defaultSession.id;
    }
  }

  private saveSessions(): void {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.sessions.values());
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
      localStorage.setItem(ACTIVE_SESSION_KEY, this.activeSessionId);
    } catch {
      // ignore
    }
  }

  getSessionsSorted(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getActiveSession(): ChatSession {
    let session = this.sessions.get(this.activeSessionId);
    if (!session) {
      session = createNewSession();
      this.sessions.set(session.id, session);
      this.activeSessionId = session.id;
    }
    return session;
  }

  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  setActiveSession(id: string): ChatSession | null {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.saveSessions();
      return this.sessions.get(id) || null;
    }
    return null;
  }

  createSession(title?: string): ChatSession {
    // Enforce max sessions
    if (this.sessions.size >= MAX_SESSIONS) {
      const sorted = this.getSessionsSorted();
      const oldest = sorted[sorted.length - 1];
      this.sessions.delete(oldest.id);
    }
    const session = createNewSession(title);
    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    this.saveSessions();
    return session;
  }

  deleteSession(id: string): boolean {
    if (!this.sessions.has(id)) return false;
    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      const sorted = this.getSessionsSorted();
      if (sorted.length > 0) {
        this.activeSessionId = sorted[0].id;
      } else {
        const newSession = createNewSession();
        this.sessions.set(newSession.id, newSession);
        this.activeSessionId = newSession.id;
      }
    }
    this.saveSessions();
    return true;
  }

  renameSession(id: string, title: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.title = title;
    session.updatedAt = Date.now();
    this.saveSessions();
    return true;
  }

  updateSession(id: string, updates: Partial<Pick<ChatSession, 'messages' | 'learnerState' | 'title'>>): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (updates.messages) session.messages = updates.messages;
    if (updates.learnerState) session.learnerState = updates.learnerState;
    if (updates.title) session.title = updates.title;
    session.updatedAt = Date.now();

    // Auto-generate title from first user message if still default
    if (session.title === '新对话' && updates.messages) {
      const firstUserMsg = updates.messages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        session.title = firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '');
      }
    }

    this.saveSessions();
  }

  getActiveSessionId(): string {
    return this.activeSessionId;
  }
}

export const sessionManager = new SessionManager();
