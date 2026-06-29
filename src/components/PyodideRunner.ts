import { CodeExecutionResult } from '@/types';

// ============================================================
// PyodideRunner
// ------------------------------------------------------------
// Runs Python code in the browser via Pyodide (loaded from CDN).
// Uses a Web Worker for reliable timeout handling.
//
// Exported API:
//   loadPyodide()                                  -> Promise<void>
//   runCode(code, options?)                        -> Promise<CodeExecutionResult>
//   runTestCases(code, testCases, functionName, options?)
//                                                   -> Promise<CodeExecutionResult>
//
// Supported data structures (auto-converted from LeetCode-style list inputs):
//   - ListNode:  [1,2,3]  -> linked list
//   - TreeNode:  [4,2,7,1,3,6,9]  -> binary tree (level-order)
//   - null in inputs is auto-replaced with Python None
// ============================================================

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';

export interface ProblemTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface RunCodeOptions {
  timeoutMs?: number;
  functionName?: string;
  /** Sample input to pass to functionName (Python literal string, e.g. "[2,7,11,15], 9"). */
  sampleInput?: string;
}

interface WorkerRequest {
  id: number;
  type: 'load' | 'run' | 'runTests' | 'runSample';
  code?: string;
  functionName?: string;
  sampleInput?: string;
  testCases?: { input: string; expected: string }[];
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: RunResult;
  error?: string;
}

interface RunResult {
  success?: boolean;
  output?: string;
  error?: string;
  calledFunction?: boolean;
  returnValue?: unknown;
  testResults?: {
    passed: number;
    total: number;
    failures: { input: string; expected: string; actual: string; error?: string }[];
  };
}

// ------------------------------------------------------------
// Python harnesses (kept as plain strings, injected into the worker)
// We use String.raw + tagged concatenation to avoid backtick escaping issues.
// ------------------------------------------------------------

const RUN_HARNESS = String.raw`import sys, io, json, traceback as _tb, ast as _ast, re as _re
from collections import deque as _deque

# ---------- Helpers for data structure conversion ----------

def _parse_input(s):
    """Parse a Python literal argument string, converting JS-style 'null' -> None."""
    if s is None:
        return ()
    s2 = str(s).strip()
    if not s2:
        return ()
    s2 = _re.sub(r'\bnull\b', 'None', s2)
    try:
        v = _ast.literal_eval(s2)
    except Exception:
        try:
            v = _ast.literal_eval("(" + s2 + ",)")
        except Exception:
            raise ValueError("cannot parse input: " + s2[:80])
    if isinstance(v, tuple):
        return list(v)
    return [v]

def _is_listnode_cls(cls):
    if cls is None: return False
    try:
        inst = cls()
        return hasattr(inst, "val") and hasattr(inst, "next")
    except Exception:
        return False

def _is_treenode_cls(cls):
    if cls is None: return False
    try:
        inst = cls()
        return hasattr(inst, "val") and hasattr(inst, "left") and hasattr(inst, "right")
    except Exception:
        return False

def _to_listnode(values, cls):
    dummy = cls()
    cur = dummy
    for v in values:
        cur.next = cls(v)
        cur = cur.next
    return dummy.next

def _to_treenode(values, cls):
    """Build binary tree from level-order list (LeetCode convention)."""
    if not values:
        return None
    root = cls(values[0])
    q = _deque([root])
    i = 1
    while q and i < len(values):
        node = q.popleft()
        if i < len(values) and values[i] is not None:
            node.left = cls(values[i])
            q.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = cls(values[i])
            q.append(node.right)
        i += 1
    return root

def _adapt_arg(arg, ns):
    """Returns (converted_value, was_adapted)."""
    listnode_cls = ns.get("ListNode") if _is_listnode_cls(ns.get("ListNode")) else None
    treenode_cls = ns.get("TreeNode") if _is_treenode_cls(ns.get("TreeNode")) else None
    if isinstance(arg, list) and not any(isinstance(x, (list, tuple, dict)) for x in arg):
        if treenode_cls is not None:
            return _to_treenode(arg, treenode_cls), True
        if listnode_cls is not None:
            return _to_listnode(arg, listnode_cls), True
    return arg, False

_result = {"output": "", "error": "", "returnValue": None, "calledFunction": False}
_ns = {}
_buf = io.StringIO()
sys.stdout = _buf
try:
    exec(userCode, _ns)
    if funcName and sampleInput is not None:
        _fn = _ns.get(funcName)
        if _fn is not None:
            _result["calledFunction"] = True
            try:
                _parsed = _parse_input(sampleInput)
                _adapted = []
                _any_adapted = False
                for _a in _parsed:
                    _v, _ad = _adapt_arg(_a, _ns)
                    _adapted.append(_v)
                    if _ad: _any_adapted = True
                try:
                    _ret = _fn(*_adapted)
                except (TypeError, AttributeError):
                    if _any_adapted:
                        _ret = _fn(*_parsed)
                    else:
                        raise
                _result["returnValue"] = str(_ret)
            except Exception:
                _result["error"] = "调用函数时出错:\n" + _tb.format_exc()
except Exception:
    _result["error"] = _tb.format_exc()
finally:
    sys.stdout = sys.__stdout__
_result["output"] = _buf.getvalue()
json.dumps(_result, ensure_ascii=False)`;

const TEST_HARNESS = String.raw`import json, ast, traceback as _tb, re as _re
from collections import deque as _deque

# ---------- Serialization ----------

def _treenode_to_list(root):
    """Serialize a binary tree to level-order list, stripping trailing None."""
    if root is None:
        return []
    out = []
    q = _deque([root])
    while q:
        node = q.popleft()
        if node is None:
            out.append(None)
        else:
            out.append(node.val)
            q.append(node.left)
            q.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out

def _serialize(obj):
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (int, float, str)):
        return obj
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, tuple):
        return [_serialize(x) for x in obj]
    # TreeNode (must check before ListNode since both have 'val')
    if hasattr(obj, "val") and hasattr(obj, "left") and hasattr(obj, "right"):
        return _treenode_to_list(obj)
    # ListNode
    if hasattr(obj, "val") and hasattr(obj, "next"):
        out = []
        cur = obj
        _safety = 10000
        while cur is not None and _safety > 0:
            out.append(_serialize(cur.val))
            cur = cur.next
            _safety -= 1
        return out
    return str(obj)

# ---------- Data structure construction ----------

def _is_listnode_cls(cls):
    if cls is None: return False
    try:
        inst = cls()
        return hasattr(inst, "val") and hasattr(inst, "next")
    except Exception:
        return False

def _is_treenode_cls(cls):
    if cls is None: return False
    try:
        inst = cls()
        return hasattr(inst, "val") and hasattr(inst, "left") and hasattr(inst, "right")
    except Exception:
        return False

def _to_listnode(values, cls):
    dummy = cls()
    cur = dummy
    for v in values:
        cur.next = cls(v)
        cur = cur.next
    return dummy.next

def _to_treenode(values, cls):
    if not values:
        return None
    root = cls(values[0])
    q = _deque([root])
    i = 1
    while q and i < len(values):
        node = q.popleft()
        if i < len(values) and values[i] is not None:
            node.left = cls(values[i])
            q.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = cls(values[i])
            q.append(node.right)
        i += 1
    return root

def _parse_arg_str(s):
    s2 = str(s).strip()
    s2 = _re.sub(r'\bnull\b', 'None', s2)
    try:
        return ast.literal_eval(s2)
    except Exception:
        try:
            v = ast.literal_eval("(" + s2 + ",)")
            if isinstance(v, tuple) and len(v) == 1:
                return v[0]
            return v
        except Exception:
            raise ValueError("cannot parse arg: " + repr(s)[:60])

def _parse_input(inp):
    """Parse test input string into argument list."""
    s = str(inp).strip()
    if not s:
        return []
    s_norm = _re.sub(r'\bnull\b', 'None', s)
    # Try as tuple (multiple args)
    try:
        v = ast.literal_eval("(" + s_norm + ",)")
        if isinstance(v, tuple):
            return list(v)
    except Exception:
        pass
    # Try as single literal
    try:
        v = ast.literal_eval(s_norm)
        return [v]
    except Exception:
        pass
    # Comma-separated fallback
    if "," in s_norm:
        parts = [p.strip() for p in s_norm.split(",")]
        return [_parse_arg_str(p) for p in parts]
    raise ValueError("cannot parse input: " + repr(inp)[:80])

def _adapt_args(args, ns):
    """Returns (new_args, adapted_flag). adapted_flag is True if any arg was converted."""
    listnode_cls = ns.get("ListNode") if _is_listnode_cls(ns.get("ListNode")) else None
    treenode_cls = ns.get("TreeNode") if _is_treenode_cls(ns.get("TreeNode")) else None
    new_args = []
    adapted = False
    for a in args:
        # Only convert flat lists to data structures; skip 2D arrays / nested structures
        if isinstance(a, list) and not any(isinstance(x, (list, tuple, dict)) for x in a):
            if treenode_cls is not None:
                new_args.append(_to_treenode(a, treenode_cls))
                adapted = True
            elif listnode_cls is not None:
                new_args.append(_to_listnode(a, listnode_cls))
                adapted = True
            else:
                new_args.append(a)
        else:
            new_args.append(a)
    return new_args, adapted

# ---------- Main test loop ----------

_result = {"success": True, "output": "", "error": "", "testResults": None}
_ns = {}
_loaded = True
try:
    exec(userCode, _ns)
except Exception:
    _result["success"] = False
    _result["error"] = "代码加载失败:\n" + _tb.format_exc()
    _loaded = False

if _loaded:
    _fn = _ns.get(funcName)
    if _fn is None:
        _result["success"] = False
        _result["error"] = "未找到函数: " + str(funcName) + "（请确保代码中定义了该函数）"
    else:
        _tests = json.loads(testCasesJson)
        _passed = 0
        _total = len(_tests)
        _failures = []
        _has_treenode = _is_treenode_cls(_ns.get("TreeNode"))
        _has_listnode = _is_listnode_cls(_ns.get("ListNode"))
        for _t in _tests:
            _inp = _t.get("input", "")
            _exp = _t.get("expected", "")
            try:
                _args = _parse_input(_inp)
                _args_adapted, _adapted_any = _adapt_args(_args, _ns)
                try:
                    _res = _fn(*_args_adapted)
                except (TypeError, AttributeError):
                    # Fallback: try without adaptation (in case our heuristic was wrong)
                    if _adapted_any:
                        _res = _fn(*_args)
                        _adapted_any = False
                    else:
                        raise
                _actual = _serialize(_res)
                # Normalize: if we adapted args to a data structure and got None back,
                # treat None as empty structure ([]) to match LeetCode convention.
                if _res is None and _adapted_any and (_has_treenode or _has_listnode):
                    _actual = []
                try:
                    _exp_norm = _re.sub(r'\bnull\b', 'None', str(_exp).strip())
                    try:
                        _exp_val = ast.literal_eval(_exp_norm)
                        _exp_serialized = _serialize(_exp_val)
                        _ok = _actual == _exp_serialized
                    except Exception:
                        _ok = str(_actual).strip() == str(_exp).strip()
                except Exception:
                    _ok = str(_actual).strip() == str(_exp).strip()
                if _ok:
                    _passed += 1
                else:
                    _failures.append({
                        "input": _inp,
                        "expected": str(_exp),
                        "actual": str(_actual)
                    })
            except Exception as _e:
                _failures.append({
                    "input": _inp,
                    "expected": str(_exp),
                    "actual": "",
                    "error": str(_e)
                })
        _result["testResults"] = {"passed": _passed, "total": _total, "failures": _failures}
        if _passed == _total:
            _result["output"] = "全部通过！" + str(_passed) + "/" + str(_total) + " 个测试用例"
        else:
            _result["output"] = "通过 " + str(_passed) + "/" + str(_total) + " 个测试用例"

json.dumps(_result, ensure_ascii=False)`;

// ------------------------------------------------------------
// Worker source (inline Blob)
// ------------------------------------------------------------
const WORKER_SOURCE = `
const PYODIDE_CDN = ${JSON.stringify(PYODIDE_CDN)};
importScripts(PYODIDE_CDN + 'pyodide.js');

let pyodidePromise = null;
function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = self.loadPyodide({ indexURL: PYODIDE_CDN });
  }
  return pyodidePromise;
}

const RUN_HARNESS = ${JSON.stringify(RUN_HARNESS)};
const TEST_HARNESS = ${JSON.stringify(TEST_HARNESS)};

self.onmessage = async (e) => {
  const data = e.data;
  try {
    if (data.type === 'load') {
      await getPyodide();
      self.postMessage({ id: data.id, ok: true, result: null });
      return;
    }
    const pyodide = await getPyodide();

    if (data.type === 'run' || data.type === 'runSample') {
      pyodide.globals.set('userCode', data.code || '');
      pyodide.globals.set('funcName', data.functionName || '');
      pyodide.globals.set('sampleInput', data.sampleInput !== undefined ? data.sampleInput : null);
      const resStr = pyodide.runPython(RUN_HARNESS);
      let res;
      try {
        res = JSON.parse(resStr);
      } catch (_) {
        res = { output: String(resStr), error: '' };
      }
      self.postMessage({ id: data.id, ok: true, result: res });
      return;
    }

    if (data.type === 'runTests') {
      pyodide.globals.set('userCode', data.code || '');
      pyodide.globals.set('funcName', data.functionName || 'solution');
      pyodide.globals.set('testCasesJson', JSON.stringify(data.testCases || []));
      const resStr = pyodide.runPython(TEST_HARNESS);
      let res;
      try {
        res = JSON.parse(resStr);
      } catch (_) {
        res = { success: false, output: String(resStr), error: '结果解析失败' };
      }
      self.postMessage({ id: data.id, ok: true, result: res });
      return;
    }

    self.postMessage({ id: data.id, ok: false, error: '未知请求类型: ' + data.type });
  } catch (err) {
    self.postMessage({
      id: data.id,
      ok: false,
      error: String((err && err.message) || err),
    });
  }
};
`;

type PendingHandler = {
  resolve: (value: RunResult | null) => void;
  reject: (error: Error) => void;
};

class PyodideRunner {
  private worker: Worker | null = null;
  private msgId = 0;
  private pending = new Map<number, PendingHandler>();
  private readyPromise: Promise<void> | null = null;

  private createWorker(): Worker {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const handler = this.pending.get(data.id);
      if (!handler) return;
      this.pending.delete(data.id);
      if (data.ok) {
        handler.resolve(data.result ?? null);
      } else {
        handler.reject(new Error(data.error || 'Pyodide 执行失败'));
      }
    };

    worker.onerror = (event) => {
      const message = event.message || 'Pyodide Worker 发生错误';
      for (const handler of this.pending.values()) {
        handler.reject(new Error(message));
      }
      this.pending.clear();
      this.worker = null;
      this.readyPromise = null;
    };

    return worker;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  async load(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.ensureWorker();
    this.readyPromise = this.request({ type: 'load' }, 90000).then(() => undefined);
    try {
      await this.readyPromise;
    } catch (error) {
      this.readyPromise = null;
      throw error;
    }
  }

  get isLoaded(): boolean {
    return this.readyPromise !== null;
  }

  private request(
    payload: Omit<WorkerRequest, 'id'>,
    timeoutMs: number
  ): Promise<RunResult | null> {
    const worker = this.ensureWorker();
    const id = ++this.msgId;
    return new Promise<RunResult | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          this.terminate();
          reject(new Error(`代码执行超时（${timeoutMs / 1000} 秒）`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      worker.postMessage({ id, ...payload } satisfies WorkerRequest);
    });
  }

  private terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const handler of this.pending.values()) {
      handler.reject(new Error('Worker 已终止'));
    }
    this.pending.clear();
    this.readyPromise = null;
  }

  async runCode(code: string, options: RunCodeOptions = {}): Promise<CodeExecutionResult> {
    const { timeoutMs = 10000, functionName, sampleInput } = options;
    await this.load();
    const result = await this.request(
      { type: 'run', code, functionName: functionName ?? undefined, sampleInput: sampleInput ?? undefined },
      timeoutMs
    );
    const res = result ?? {};
    let output = res.output ?? '';
    if (res.calledFunction && res.returnValue !== undefined && res.returnValue !== null) {
      output = (output ? output + '\n' : '') + `>>> 返回值: ${res.returnValue}`;
    }
    return {
      success: !res.error,
      output,
      error: res.error || undefined,
    };
  }

  async runTestCases(
    code: string,
    testCases: ProblemTestCase[],
    functionName: string,
    timeoutMs = 15000
  ): Promise<CodeExecutionResult> {
    await this.load();
    const mapped = testCases.map((t) => ({ input: t.input, expected: t.expectedOutput }));
    const result = await this.request(
      { type: 'runTests', code, functionName, testCases: mapped },
      timeoutMs
    );
    const res = result ?? {};
    return {
      success: Boolean(res.success) && !res.error,
      output: res.output ?? '',
      error: res.error || undefined,
      testResults: res.testResults ?? undefined,
    };
  }
}

const runner = new PyodideRunner();

export async function loadPyodide(): Promise<void> {
  return runner.load();
}

export async function runCode(
  code: string,
  options?: RunCodeOptions
): Promise<CodeExecutionResult> {
  return runner.runCode(code, options);
}

export async function runTestCases(
  code: string,
  testCases: ProblemTestCase[],
  functionName: string,
  timeoutMs?: number
): Promise<CodeExecutionResult> {
  return runner.runTestCases(code, testCases, functionName, timeoutMs);
}

export { PyodideRunner };
