# CodeMentor

多智能体 AI 算法导师系统 —— 像拥有一支专属教学团队。

## 核心特性

- **多智能体协作辅导**：讲师、出题官、考官、规划师 4 个专业 Agent 分工协作
- **苏格拉底式教学**：五级渐进式提示，引导学生自己发现答案
- **个性化学习路径**：基于 BKT 掌握度模型 + SM-2 间隔重复算法
- **浏览器端代码执行**：Pyodide (WASM) 实现 Python 即时运行，零后端依赖
- **工具系统**：网络搜索、知识库查询、题目搜索、代码分析、学习路径生成
- **Skill 扩展机制**：内置教学技能 + 自定义技能，支持关键词与命令触发
- **多会话管理**：创建、切换、删除会话，学习状态本地持久化
- **像素风 UI**：复古游戏风格界面，Press Start 2P 字体 + CRT 扫描线效果

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 + React 19 + TypeScript + TailwindCSS v4 |
| UI 组件 | shadcn/ui + 像素风自定义组件 |
| 代码执行 | Pyodide (WebAssembly) |
| Agent 编排 | Vercel AI SDK + 多智能体协作架构 |
| LLM | 火山引擎 Ark / OpenAI / Anthropic（用户自选） |
| 持久化 | localStorage（客户端本地存储） |
| 部署 | Vercel（支持 API 路由） |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

## 使用说明

### 演示模式
无需配置 API Key，提供基于预设模板的演示响应。

### 完整模式
在设置中配置火山引擎 / OpenAI / Anthropic API Key，获得完整 AI 导师体验：
- 个性化苏格拉底式引导
- 基于掌握度的自适应练习题生成
- 深度代码评估
- 动态学习路径规划
- 网络搜索与知识库查询工具

### 斜杠命令

| 命令 | 说明 |
|---|---|
| `/help` | 显示所有可用命令 |
| `/practice` | 开始算法练习 |
| `/plan` | 生成学习计划 |
| `/hint` | 请求提示 |
| `/search <关键词>` | 网络搜索算法资料 |
| `/find <知识点>` | 搜索知识库 |
| `/problems <主题>` | 搜索相关题目 |
| `/analyze` | 分析当前代码 |
| `/path <目标>` | 生成学习路径 |

## 项目结构

```
src/
├── types/index.ts                # TypeScript 类型定义
├── lib/
│   ├── agents/                   # 多智能体定义与编排
│   ├── knowledge/                # 算法知识图谱与题库
│   │   ├── topics.ts             # 15 个知识点
│   │   └── problems.ts           # 15 道精选题目
│   ├── skills/                   # 教学技能注册表与扩展管理
│   ├── tools/                    # 工具系统注册表
│   ├── memory/                   # 学习者状态 + BKT/SM-2 算法
│   ├── sessions/                 # 多会话管理
│   ├── llm/                      # 多模型 LLM 客户端
│   └── hooks/                    # React Hooks
├── components/                   # UI 组件（像素风）
└── app/                          # Next.js App Router
```

## 架构要点

### Agent Loop
`orchestrator.ts` 通过 Vercel AI SDK 的 `generateText` 驱动教学流程，最多 6 步防止无限循环。

### 工具系统
`tools/registry.ts` 集中注册可扩展工具，支持：
- 网络搜索（DuckDuckGo）
- 知识库查询
- 题目检索
- 代码静态分析
- 学习路径生成

### Skill 扩展
`skills/registry.ts` 管理内置教学技能，`skills/manager.ts` 支持用户自定义技能并持久化到 localStorage。

### 记忆系统
`memory/learner-state.ts` 维护：
- BKT 掌握度向量
- SM-2 间隔重复调度
- 错题记录
- 行为画像
- 会话检查点

### 多会话
`sessions/manager.ts` 提供会话创建、切换、删除，消息历史与学习状态均保存在 localStorage。

## 隐私说明

- API Key 仅保存在浏览器 localStorage，不会上传到任何服务器
- 学习者状态全部存储在本地，不上传后端
- 代码在浏览器端 Pyodide 中执行，不发送到外部服务器

## 许可证

MIT
