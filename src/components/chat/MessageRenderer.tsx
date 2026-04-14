import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  thinking?: string | null;
  metadata?: Record<string, unknown> | null;
  toolName?: string | null;
}

export type ArtifactTrailPosition = "single" | "start" | "middle" | "end";
export type MessageRendererMode = "all" | "conversation" | "artifacts";

interface MessageRendererProps {
  message: ChatMessageItem;
  timeLabel: string;
  trailPosition?: ArtifactTrailPosition;
  mode?: MessageRendererMode;
}

type ArtifactState =
  | "neutral"
  | "running"
  | "success"
  | "failed"
  | "queued"
  | "blocked"
  | "partial";

type ToolArtifactKind =
  | "command"
  | "search"
  | "browser"
  | "read_file"
  | "write_file"
  | "patch"
  | "batch"
  | "todos"
  | "background"
  | "generic";

interface ArtifactCardProps {
  icon: ReactNode;
  title: string;
  summary: string;
  state?: ArtifactState;
  metaLabel?: string | null;
  trailPosition?: ArtifactTrailPosition;
  defaultOpen?: boolean;
  subtle?: boolean;
  children?: ReactNode;
}

interface KeyValueRow {
  label: string;
  value: string;
}

function compactText(input: string, maxLength = 160): string {
  const value = input.replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function safeJsonParse(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatDuration(payload: Record<string, unknown>): string | null {
  const durationSeconds = payload.total_duration_seconds;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return `${durationSeconds.toFixed(durationSeconds >= 10 ? 0 : 1)}s`;
  }

  const durationMs = payload.duration_ms;
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.round(durationMs)}ms`;
  }

  return null;
}

function inferToolState(payload: Record<string, unknown> | null): ArtifactState {
  if (!payload) {
    return "neutral";
  }

  if (Array.isArray(payload.todos)) {
    const summary = payload.summary && typeof payload.summary === "object"
      ? (payload.summary as Record<string, unknown>)
      : null;
    const completed = typeof summary?.completed === "number" ? summary.completed : 0;
    const inProgress = typeof summary?.in_progress === "number" ? summary.in_progress : 0;
    const pending = typeof summary?.pending === "number" ? summary.pending : 0;
    const total = typeof summary?.total === "number" ? summary.total : payload.todos.length;

    if (inProgress > 0) return "running";
    if (completed === total && total > 0) return "success";
    if (pending === total && total > 0) return "queued";
    if (completed > 0 && pending > 0) return "partial";
  }

  if (
    payload.output === "Background process started" ||
    (typeof payload.session_id === "string" && payload.session_id.startsWith("proc_"))
  ) {
    return "running";
  }

  const rawStatus = typeof payload.status === "string" ? payload.status.toLowerCase() : null;
  if (rawStatus) {
    if (["running", "in_progress", "executing"].includes(rawStatus)) return "running";
    if (["queued", "pending"].includes(rawStatus)) return "queued";
    if (["blocked"].includes(rawStatus)) return "blocked";
    if (["partial", "partial_success"].includes(rawStatus)) return "partial";
    if (["failed", "error"].includes(rawStatus)) return "failed";
    if (["success", "completed", "done"].includes(rawStatus)) return "success";
  }

  if (typeof payload.exit_code === "number" && payload.exit_code !== 0) {
    return "failed";
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return "failed";
  }

  if (payload.success === false) {
    return "failed";
  }

  if (Array.isArray(payload.results)) {
    const statuses = payload.results
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).status : null))
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase());

    if (statuses.some((item) => item === "failed")) {
      return statuses.some((item) => item === "completed" || item === "success") ? "partial" : "failed";
    }
    if (statuses.some((item) => item === "running" || item === "in_progress")) {
      return "running";
    }
    if (statuses.some((item) => item === "queued" || item === "pending")) {
      return "queued";
    }
    if (statuses.length > 0) {
      return "success";
    }
  }

  if (payload.success === true) {
    return "success";
  }

  return "success";
}

function inferToolKind(payload: Record<string, unknown> | null): ToolArtifactKind {
  if (!payload) {
    return "generic";
  }

  if (Array.isArray(payload.todos)) return "todos";
  if (
    payload.output === "Background process started" ||
    (typeof payload.session_id === "string" && payload.session_id.startsWith("proc_"))
  ) return "background";
  if ("diff" in payload || "files_modified" in payload) return "patch";
  if ("output" in payload || "exit_code" in payload) return "command";
  if ("matches" in payload) return "search";
  if ("snapshot" in payload || "clicked" in payload || "url" in payload || "title" in payload) return "browser";
  if ("content" in payload && "file_size" in payload) return "read_file";
  if ("bytes_written" in payload || "dirs_created" in payload) return "write_file";
  if (Array.isArray(payload.results)) return "batch";

  return "generic";
}

function stateLabel(state: ArtifactState): string {
  switch (state) {
    case "running":
      return "执行中";
    case "success":
      return "已完成";
    case "failed":
      return "失败";
    case "queued":
      return "排队中";
    case "blocked":
      return "已阻塞";
    case "partial":
      return "部分完成";
    default:
      return "产物";
  }
}

function stateIcon(state: ArtifactState): ReactNode {
  switch (state) {
    case "running":
      return <ArrowPathIcon className="h-4 w-4" />;
    case "success":
      return <CheckIcon className="h-4 w-4" />;
    case "failed":
      return <XMarkIcon className="h-4 w-4" />;
    case "blocked":
      return <ExclamationTriangleIcon className="h-4 w-4" />;
    case "queued":
      return <ClockBadge />;
    case "partial":
      return <PartialBadge />;
    default:
      return <WrenchScrewdriverIcon className="h-4 w-4" />;
  }
}

function ClockBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PartialBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M4 12h16" />
      <path d="M12 4v16" opacity="0.45" />
    </svg>
  );
}

function humanizeToolName(name: string): string {
  return name
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferToolTitle(payload: Record<string, unknown>, toolName?: string | null): string {
  if (toolName?.trim()) {
    return humanizeToolName(toolName);
  }

  if ("diff" in payload || "files_modified" in payload) return "应用代码修改";
  if ("output" in payload || "exit_code" in payload) return "执行命令";
  if ("matches" in payload) return "检索代码";
  if ("snapshot" in payload && "url" in payload) return "访问页面";
  if ("snapshot" in payload) return "读取页面快照";
  if ("clicked" in payload) return "点击页面元素";
  if ("content" in payload && "file_size" in payload) return "读取文件";
  if ("bytes_written" in payload || "dirs_created" in payload) return "写入文件";
  if ("results" in payload) return "批量任务执行";
  if ("url" in payload) return "读取网页";

  return "工具执行";
}

function kindLabel(kind: ToolArtifactKind): string {
  switch (kind) {
    case "command":
      return "命令";
    case "search":
      return "检索";
    case "browser":
      return "网页";
    case "read_file":
      return "读取";
    case "write_file":
      return "写入";
    case "patch":
      return "补丁";
    case "batch":
      return "批处理";
    case "todos":
      return "计划";
    case "background":
      return "后台";
    default:
      return "工具";
  }
}

function inferToolSummary(
  payload: Record<string, unknown>,
  fallback: string,
  state: ArtifactState,
): string {
  if (state === "failed") {
    if (typeof payload.output === "string" && payload.output.trim()) {
      return compactText(payload.output);
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return compactText(payload.error);
    }
  }

  if (typeof payload.clicked === "string") {
    return `已点击 ${payload.clicked}`;
  }

  if (Array.isArray(payload.todos)) {
    const summary = payload.summary && typeof payload.summary === "object"
      ? (payload.summary as Record<string, unknown>)
      : null;
    const total = typeof summary?.total === "number" ? summary.total : payload.todos.length;
    const completed = typeof summary?.completed === "number" ? summary.completed : 0;
    const inProgress = typeof summary?.in_progress === "number" ? summary.in_progress : 0;
    if (inProgress > 0) {
      return `共 ${total} 项，已完成 ${completed} 项，当前执行 ${inProgress} 项`;
    }
    return `共 ${total} 项，已完成 ${completed} 项`;
  }

  if (
    payload.output === "Background process started" ||
    (typeof payload.session_id === "string" && payload.session_id.startsWith("proc_"))
  ) {
    const pid = typeof payload.pid === "number" ? `PID ${payload.pid}` : "后台任务已启动";
    const watchCount = Array.isArray(payload.watch_patterns) ? `监控 ${payload.watch_patterns.length} 个信号` : "持续监控中";
    return `${pid}，${watchCount}`;
  }

  if (typeof payload.title === "string" && typeof payload.url === "string") {
    return `已打开 ${compactText(payload.title, 72)}`;
  }

  if (typeof payload.snapshot === "string") {
    const elementCount = typeof payload.element_count === "number" ? `${payload.element_count} 个元素` : "页面结构";
    return `已提取 ${elementCount} 的快照`;
  }

  if (Array.isArray(payload.matches) && typeof payload.total_count === "number") {
    return `找到 ${payload.total_count} 个匹配项`;
  }

  if (typeof payload.bytes_written === "number") {
    const createdDir = payload.dirs_created ? "，并创建所需目录" : "";
    return `已写入 ${payload.bytes_written} bytes${createdDir}`;
  }

  if (typeof payload.content === "string" && typeof payload.total_lines === "number") {
    return `已读取 ${payload.total_lines} 行内容`;
  }

  if (typeof payload.diff === "string") {
    const modifiedCount = Array.isArray(payload.files_modified) ? payload.files_modified.length : null;
    return modifiedCount ? `已修改 ${modifiedCount} 个文件` : "已生成代码补丁";
  }

  if (Array.isArray(payload.results)) {
    const completed = payload.results.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const status = (item as Record<string, unknown>).status;
      return status === "completed" || status === "success";
    }).length;
    return `已完成 ${completed}/${payload.results.length} 个子任务`;
  }

  if (typeof payload.url === "string") {
    return payload.url;
  }

  if (typeof payload.output === "string" && payload.output.trim()) {
    return compactText(payload.output);
  }

  return compactText(fallback || "工具执行完成");
}

function extractToolDetails(payload: Record<string, unknown>, toolName?: string | null): KeyValueRow[] {
  const rows: KeyValueRow[] = [];

  if (toolName?.trim()) {
    rows.push({ label: "Tool", value: toolName });
  }

  if (typeof payload.url === "string") {
    rows.push({ label: "URL", value: payload.url });
  }

  if (typeof payload.title === "string") {
    rows.push({ label: "标题", value: payload.title });
  }

  if (typeof payload.clicked === "string") {
    rows.push({ label: "目标", value: payload.clicked });
  }

  if (typeof payload.total_count === "number") {
    rows.push({ label: "命中数", value: `${payload.total_count}` });
  }

  if (typeof payload.file_size === "number") {
    rows.push({ label: "文件大小", value: `${payload.file_size} bytes` });
  }

  if (typeof payload.total_lines === "number") {
    rows.push({ label: "总行数", value: `${payload.total_lines}` });
  }

  if (typeof payload.bytes_written === "number") {
    rows.push({ label: "写入量", value: `${payload.bytes_written} bytes` });
  }

  if (typeof payload.pid === "number") {
    rows.push({ label: "PID", value: `${payload.pid}` });
  }

  if (typeof payload.session_id === "string") {
    rows.push({ label: "Session", value: payload.session_id });
  }

  if (typeof payload.exit_code === "number") {
    rows.push({ label: "Exit code", value: `${payload.exit_code}` });
  }

  if (Array.isArray(payload.files_modified) && payload.files_modified.length > 0) {
    rows.push({ label: "修改文件", value: payload.files_modified.join(", ") });
  }

  if (Array.isArray(payload.results)) {
    rows.push({ label: "子任务数", value: `${payload.results.length}` });
  }

  if (Array.isArray(payload.watch_patterns) && payload.watch_patterns.length > 0) {
    rows.push({ label: "监控信号", value: payload.watch_patterns.join(", ") });
  }

  const duration = formatDuration(payload);
  if (duration) {
    rows.push({ label: "用时", value: duration });
  }

  return rows;
}

function extractToolRawContent(payload: Record<string, unknown>, state: ArtifactState): string | null {
  const prioritizedKeys = ["output", "diff", "snapshot", "content", "results", "error"] as const;

  for (const key of prioritizedKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value, null, 2);
    }
  }

  if (state === "failed") {
    return JSON.stringify(payload, null, 2);
  }

  return null;
}

function extractMatchRows(payload: Record<string, unknown>): Array<{ path: string; line?: string; content?: string }> {
  const matches = payload.matches;
  if (!Array.isArray(matches)) {
    return [];
  }

  return matches.slice(0, 5).reduce<Array<{ path: string; line?: string; content?: string }>>((rows, item) => {
      if (!item || typeof item !== "object") {
        return rows;
      }

      const record = item as Record<string, unknown>;
      rows.push({
        path: typeof record.path === "string" ? record.path : "未知路径",
        line: record.line != null ? String(record.line) : undefined,
        content: typeof record.content === "string" ? compactText(record.content, 120) : undefined,
      });
      return rows;
    }, []);
}

function extractBatchRows(payload: Record<string, unknown>): Array<{ status: string; summary: string }> {
  const results = payload.results;
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const status = typeof record.status === "string" ? record.status : "unknown";
      const summary =
        typeof record.summary === "string"
          ? compactText(record.summary, 140)
          : typeof record.result === "string"
            ? compactText(record.result, 140)
            : `任务 ${record.task_index ?? "?"}`;

      return { status, summary };
    })
    .filter((item): item is { status: string; summary: string } => Boolean(item));
}

function extractTodoRows(
  payload: Record<string, unknown>,
): Array<{ status: string; content: string; id?: string }> {
  const todos = payload.todos;
  if (!Array.isArray(todos)) {
    return [];
  }

  return todos.reduce<Array<{ status: string; content: string; id?: string }>>((rows, item) => {
      if (!item || typeof item !== "object") {
        return rows;
      }

      const record = item as Record<string, unknown>;
      rows.push({
        id: typeof record.id === "string" ? record.id : undefined,
        status: typeof record.status === "string" ? record.status : "pending",
        content: typeof record.content === "string" ? record.content : "未命名任务",
      });
      return rows;
    }, []);
}

function batchStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "success") return "success";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "running" || normalized === "in_progress") return "running";
  if (normalized === "queued" || normalized === "pending") return "queued";
  return "neutral";
}

function todoStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "done" || normalized === "success") return "success";
  if (normalized === "in_progress" || normalized === "running" || normalized === "doing") return "running";
  if (normalized === "blocked") return "blocked";
  return "queued";
}

function todoStatusIcon(status: string): ReactNode {
  switch (todoStatusTone(status)) {
    case "success":
      return <CheckIcon className="h-4 w-4" />;
    case "running":
      return <ArrowPathIcon className="h-4 w-4" />;
    case "blocked":
      return <ExclamationTriangleIcon className="h-4 w-4" />;
    default:
      return <ClockBadge />;
  }
}

function parseContextCompactionReference(content: string): { summary: string; body: string } | null {
  if (!content.startsWith("[CONTEXT COMPACTION")) {
    return null;
  }

  const body = content.replace(/^\[CONTEXT COMPACTION[^\]]*\]\s*/i, "").trim();
  if (!body) {
    return {
      summary: "早期对话已压缩为参考摘要",
      body: "早期对话已压缩为参考摘要。",
    };
  }

  const firstParagraph = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() || body;
  return {
    summary: compactText(firstParagraph, 90),
    body,
  };
}

export function messageHasConversationSurface(message: ChatMessageItem): boolean {
  if (message.role === "user") {
    return Boolean(message.content.trim());
  }

  if (message.role === "tool") {
    return false;
  }

  return Boolean(message.content.trim() && !parseContextCompactionReference(message.content));
}

export function messageHasArtifactSurface(message: ChatMessageItem): boolean {
  if (message.role === "tool") {
    return true;
  }

  return Boolean(
    parseContextCompactionReference(message.content) ||
      message.thinking?.trim() ||
      (message.metadata && Object.keys(message.metadata).length > 0),
  );
}

function renderSpecializedToolDetails(kind: ToolArtifactKind, payload: Record<string, unknown>): ReactNode | null {
  if (kind === "background") {
    return (
      <div className="artifact-background-banner">
        <span className="artifact-background-dot" />
        <span>该任务正在后台继续运行，不会阻塞当前对话。</span>
      </div>
    );
  }

  if (kind === "todos") {
    const rows = extractTodoRows(payload);
    if (rows.length === 0) return null;
    return (
      <div className="artifact-todo-list">
        {rows.map((row, index) => (
          <div key={row.id || `${row.status}-${index}`} className={`artifact-todo-item artifact-todo-item-${todoStatusTone(row.status)}`}>
            <span className="artifact-todo-icon">{todoStatusIcon(row.status)}</span>
            <span className="artifact-todo-content">{row.content}</span>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "patch" && Array.isArray(payload.files_modified) && payload.files_modified.length > 0) {
    return (
      <div className="artifact-pill-list">
        {payload.files_modified.slice(0, 8).map((file) => (
          <span key={String(file)} className="artifact-pill">
            {String(file)}
          </span>
        ))}
      </div>
    );
  }

  if (kind === "search") {
    const rows = extractMatchRows(payload);
    if (rows.length === 0) return null;
    return (
      <div className="artifact-result-list">
        {rows.map((row) => (
          <div key={`${row.path}-${row.line || ""}`} className="artifact-result-item">
            <div className="artifact-result-main">
              <div className="artifact-result-title">
                {row.path}
                {row.line ? `:${row.line}` : ""}
              </div>
              {row.content && <div className="artifact-result-subtitle">{row.content}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "batch") {
    const rows = extractBatchRows(payload);
    if (rows.length === 0) return null;
    return (
      <div className="artifact-result-list">
        {rows.map((row, index) => (
          <div key={`${row.status}-${index}`} className="artifact-result-item">
            <span className={`artifact-result-status artifact-result-status-${batchStatusTone(row.status)}`} />
            <div className="artifact-result-main">
              <div className="artifact-result-title">{row.summary}</div>
              <div className="artifact-result-subtitle">{row.status}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "browser") {
    const title = typeof payload.title === "string" ? payload.title : null;
    const url = typeof payload.url === "string" ? payload.url : null;
    const snapshot = typeof payload.snapshot === "string" ? compactText(payload.snapshot, 180) : null;

    if (!title && !url && !snapshot) return null;

    return (
      <div className="artifact-result-list">
        {title && (
          <div className="artifact-result-item">
            <div className="artifact-result-main">
              <div className="artifact-result-title">{title}</div>
              {url && <div className="artifact-result-subtitle">{url}</div>}
            </div>
          </div>
        )}
        {!title && url && (
          <div className="artifact-result-item">
            <div className="artifact-result-main">
              <div className="artifact-result-title">{url}</div>
            </div>
          </div>
        )}
        {snapshot && (
          <div className="artifact-result-item">
            <div className="artifact-result-main">
              <div className="artifact-result-subtitle">{snapshot}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function renderMarkdown(content: string) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ArtifactCard({
  icon,
  title,
  summary,
  state = "neutral",
  metaLabel,
  trailPosition = "single",
  defaultOpen = false,
  subtle = false,
  children,
}: ArtifactCardProps) {
  const hasBody = Boolean(children);

  return (
    <div className={`artifact-shell artifact-shell-${trailPosition} artifact-state-${state} ${subtle ? "artifact-shell-subtle" : ""}`}>
      <div className="artifact-rail" aria-hidden="true">
        {trailPosition !== "single" && trailPosition !== "start" && <span className="artifact-line artifact-line-top" />}
        <span className="artifact-node" />
        {trailPosition !== "single" && trailPosition !== "end" && <span className="artifact-line artifact-line-bottom" />}
      </div>

      <details className="artifact-panel" open={defaultOpen}>
        <summary className="artifact-header">
          <div className="artifact-header-main">
            <span className="artifact-icon">{icon}</span>
            <span className="artifact-title">{title}</span>
            <span className="artifact-divider">·</span>
            <span className="artifact-summary">{summary}</span>
          </div>

          <div className="artifact-header-side">
            {metaLabel && <span className="artifact-meta">{metaLabel}</span>}
            {state !== "neutral" && <span className={`artifact-badge artifact-badge-${state}`}>{stateLabel(state)}</span>}
            {hasBody && <ChevronDownIcon className="artifact-chevron h-4 w-4" />}
          </div>
        </summary>

        {hasBody && <div className="artifact-body">{children}</div>}
      </details>
    </div>
  );
}

function ToolMessage({ message, timeLabel, trailPosition = "single" }: MessageRendererProps) {
  const payload = safeJsonParse(message.content);
  const kind = inferToolKind(payload);
  const state = inferToolState(payload);
  const title = inferToolTitle(payload || {}, message.toolName);
  const summary = payload
    ? inferToolSummary(payload, message.content, state)
    : compactText(message.content || "工具执行完成");
  const metaLabel = payload ? formatDuration(payload) || timeLabel : timeLabel;
  const kvRows = payload ? extractToolDetails(payload, message.toolName) : [];
  const rawDetail = payload ? extractToolRawContent(payload, state) : message.content;
  const specializedDetails = payload ? renderSpecializedToolDetails(kind, payload) : null;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <ArtifactCard
        icon={inferToolIcon(payload, state)}
        title={title}
        summary={summary}
        state={state}
        metaLabel={metaLabel ? `${kindLabel(kind)} · ${metaLabel}` : kindLabel(kind)}
        trailPosition={trailPosition}
      >
        {specializedDetails}

        {kvRows.length > 0 && (
          <div className="artifact-kv-grid">
            {kvRows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="artifact-kv-row">
                <span className="artifact-kv-key">{row.label}</span>
                <span className="artifact-kv-val">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {rawDetail && (
          <pre className={`artifact-code-block ${state === "failed" ? "artifact-code-block-failed" : ""}`}>
            {rawDetail}
          </pre>
        )}
      </ArtifactCard>
    </div>
  );
}

function AuxiliaryArtifact({
  icon,
  label,
  summary,
  content,
  subtle = false,
}: {
  icon: ReactNode;
  label: string;
  summary: string;
  content: string;
  subtle?: boolean;
}) {
  return (
    <ArtifactCard
      icon={icon}
      title={label}
      summary={summary}
      trailPosition="single"
      subtle={subtle}
    >
      {renderMarkdown(content)}
    </ArtifactCard>
  );
}

export function shouldRenderMessage(message: ChatMessageItem): boolean {
  if (message.role === "tool") {
    return true;
  }

  return Boolean(message.content.trim() || message.thinking || message.metadata);
}

export default function MessageRenderer({
  message,
  timeLabel,
  trailPosition = "single",
  mode = "all",
}: MessageRendererProps) {
  if (message.role === "tool") {
    if (mode === "conversation") {
      return null;
    }
    return <ToolMessage message={message} timeLabel={timeLabel} trailPosition={trailPosition} />;
  }

  const isUser = message.role === "user";
  const hasMetadata = Boolean(message.metadata && Object.keys(message.metadata).length > 0);
  const hasContent = Boolean(message.content.trim());
  const contextCompaction = !isUser ? parseContextCompactionReference(message.content) : null;
  const showArtifacts = mode !== "conversation";
  const showConversation = mode !== "artifacts";
  const metadataSummary = hasMetadata
    ? `包含 ${Object.keys(message.metadata || {}).slice(0, 4).join(" · ")}`
    : "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className="max-w-[78%]">
        {!isUser && showArtifacts && contextCompaction && (
          <div className="mb-3">
            <AuxiliaryArtifact
              icon={<CpuChipIcon className="h-4 w-4" />}
              label="上下文摘要"
              summary={contextCompaction.summary}
              content={contextCompaction.body}
              subtle
            />
          </div>
        )}

        {!isUser && showArtifacts && message.thinking?.trim() && (
          <div className="mb-3">
            <AuxiliaryArtifact
              icon={<SparklesIcon className="h-4 w-4" />}
              label="思考过程"
              summary={compactText(message.thinking, 72)}
              content={message.thinking}
              subtle
            />
          </div>
        )}

        {!isUser && showArtifacts && hasMetadata && (
          <div className="mb-3">
            <AuxiliaryArtifact
              icon={<CpuChipIcon className="h-4 w-4" />}
              label="执行元信息"
              summary={metadataSummary}
              content={`\`\`\`json\n${JSON.stringify(message.metadata, null, 2)}\n\`\`\``}
            />
          </div>
        )}

        {showConversation && hasContent && !contextCompaction && (
          <div
            className="rounded-[22px] px-4 py-3 text-[15px] leading-7"
            style={{
              backgroundColor: isUser ? "var(--color-msg-user)" : "var(--color-msg-ai)",
              color: isUser ? "var(--color-msg-user-text)" : "var(--color-msg-ai-text)",
              border: isUser ? "1px solid transparent" : "1px solid var(--color-border-subtle)",
              borderRadius: isUser ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
              boxShadow: isUser
                ? "0 4px 12px color-mix(in srgb, var(--color-accent) 12%, transparent)"
                : "0 1px 3px var(--color-shadow-soft)",
            }}
          >
            {renderMarkdown(message.content)}
          </div>
        )}

        {(showConversation && hasContent && !contextCompaction) ||
        (showArtifacts && (contextCompaction || message.thinking?.trim() || hasMetadata)) ? (
          <p
            className={`mt-2 px-1 text-[11px] ${isUser ? "text-right" : "text-left"}`}
            style={{ color: "var(--color-fg-tertiary)" }}
          >
            {timeLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function inferToolIcon(payload: Record<string, unknown> | null, state: ArtifactState): ReactNode {
  if (!payload) {
    return stateIcon(state);
  }

  if ("snapshot" in payload || "url" in payload) {
    return <GlobeAltIcon className="h-4 w-4" />;
  }
  if ("matches" in payload) {
    return <MagnifyingGlassIcon className="h-4 w-4" />;
  }
  if ("diff" in payload || "files_modified" in payload || "bytes_written" in payload) {
    return <PencilSquareIcon className="h-4 w-4" />;
  }

  return stateIcon(state);
}
