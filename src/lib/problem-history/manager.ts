// ============================================================
// Problem History Manager
// ------------------------------------------------------------
// Saves problems that the user has practiced, along with their
// code, results, and status. Persisted to localStorage so the
// user can review and re-practice problems later.
// ============================================================

import { AlgorithmProblem, CodeExecutionResult, SavedProblem, ProblemStatus } from '@/types';

const STORAGE_KEY = 'codementor:problem-history';
const MAX_HISTORY = 200;

class ProblemHistoryManager {
  private history: SavedProblem[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch {
      this.history = [];
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      // Keep only the most recent MAX_HISTORY entries
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(0, MAX_HISTORY);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage might be full; silently fail
    }
  }

  /**
   * Save or update a problem in the history.
   * If the problem already exists (by id), update it; otherwise add new.
   */
  saveProblem(
    problem: AlgorithmProblem,
    userCode: string,
    result: CodeExecutionResult | null,
    sessionTitle?: string
  ): void {
    const status = this.determineStatus(result);
    const existingIdx = this.history.findIndex((p) => p.id === problem.id);

    if (existingIdx >= 0) {
      // Update existing entry
      const existing = this.history[existingIdx];
      existing.userCode = userCode;
      existing.lastResult = result;
      existing.status = status === 'solved' ? 'solved' : existing.status;
      existing.savedAt = Date.now();
      existing.attempts += 1;
      existing.sessionTitle = sessionTitle || existing.sessionTitle;
      // Move to front (most recent)
      this.history.splice(existingIdx, 1);
      this.history.unshift(existing);
    } else {
      // Add new entry
      this.history.unshift({
        id: problem.id,
        problem,
        userCode,
        lastResult: result,
        status,
        savedAt: Date.now(),
        sessionTitle,
        attempts: 1,
      });
    }

    this.save();
  }

  private determineStatus(result: CodeExecutionResult | null): ProblemStatus {
    if (!result || !result.testResults) return 'unsolved';
    const { passed, total } = result.testResults;
    if (passed === total && total > 0) return 'solved';
    if (passed > 0) return 'attempted';
    return 'unsolved';
  }

  /** Get all saved problems, newest first. */
  getAll(): SavedProblem[] {
    return [...this.history];
  }

  /** Get problems by status. */
  getByStatus(status: ProblemStatus): SavedProblem[] {
    return this.history.filter((p) => p.status === status);
  }

  /** Get problems by topic. */
  getByTopic(topicId: string): SavedProblem[] {
    return this.history.filter((p) => p.problem.topicId === topicId);
  }

  /** Get a specific saved problem by id. */
  getById(id: string): SavedProblem | undefined {
    return this.history.find((p) => p.id === id);
  }

  /** Delete a saved problem. */
  delete(id: string): void {
    this.history = this.history.filter((p) => p.id !== id);
    this.save();
  }

  /** Clear all history. */
  clear(): void {
    this.history = [];
    this.save();
  }

  /** Get statistics. */
  getStats(): {
    total: number;
    solved: number;
    attempted: number;
    unsolved: number;
    byTopic: Record<string, number>;
  } {
    const byTopic: Record<string, number> = {};
    let solved = 0;
    let attempted = 0;
    let unsolved = 0;

    for (const p of this.history) {
      byTopic[p.problem.topicId] = (byTopic[p.problem.topicId] || 0) + 1;
      if (p.status === 'solved') solved++;
      else if (p.status === 'attempted') attempted++;
      else unsolved++;
    }

    return { total: this.history.length, solved, attempted, unsolved, byTopic };
  }
}

// Singleton
let instance: ProblemHistoryManager | null = null;

export function getProblemHistory(): ProblemHistoryManager {
  if (!instance) {
    instance = new ProblemHistoryManager();
  }
  return instance;
}
