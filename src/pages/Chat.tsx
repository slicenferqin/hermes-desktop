import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import MessageRenderer, {
  type ArtifactTrailPosition,
  type ChatMessageItem,
  type MessageRendererMode,
  messageHasArtifactSurface,
  messageHasConversationSurface,
  shouldRenderMessage,
} from "../components/chat/MessageRenderer";
import { type LayoutOutletContext } from "../components/Layout";
import { listSessions, readConfigFile, readSession, sendChatMessage } from "../api/hermes";

interface SessionMessageRecord {
  role?: string;
  content?: string;
  timestamp?: string;
  created_at?: string;
  tool_name?: string | null;
  thinking?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface SessionFileRecord {
  session_id?: string;
  platform?: string;
  session_start?: string;
  last_updated?: string;
  message_count?: number;
  messages?: SessionMessageRecord[];
  model?: string | null;
  system_prompt?: string | null;
  tools?: Array<{
    type?: string;
    function?: {
      name?: string;
      description?: string;
    } | null;
  }> | null;
}

interface SessionIndexEntry {
  session_id?: string;
  display_name?: string | null;
  platform?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  origin?: {
    chat_name?: string | null;
    user_name?: string | null;
  } | null;
  total_tokens?: number | null;
  last_prompt_tokens?: number | null;
  estimated_cost_usd?: number | null;
  cost_status?: string | null;
}

interface Conversation {
  id: string;
  fileName: string | null;
  title: string;
  timestamp: Date;
  sourceLabel: string;
  model: string | null;
  toolCount: number;
  promptTokens: number | null;
  estimatedCostUsd: number | null;
  costStatus: string | null;
}

const DESKTOP_SOURCE_LABEL = "桌面 CLI";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function truncate(text: string, maxLength: number): string {
  const value = text.trim();
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function sanitizeContent(content: string | undefined): string {
  if (!content) {
    return "";
  }

  return content
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\{"role":.*$/g, "")
    .trim();
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function isCandidateSessionFile(fileName: string): boolean {
  return (
    fileName.startsWith("session_") &&
    fileName.endsWith(".json") &&
    !fileName.startsWith("session_cron_")
  );
}

function looksLikeOpaqueIdentifier(value: string): boolean {
  return value.length > 24 && (/^[a-z0-9_@.-]+$/i.test(value) || value.includes("@im.wechat"));
}

function normalizeDisplayName(input?: string | null): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value || looksLikeOpaqueIdentifier(value)) {
    return null;
  }
  return value;
}

function platformLabel(platform: string): string {
  switch (platform) {
    case "cli":
      return "桌面 CLI";
    case "feishu":
      return "飞书";
    case "weixin":
      return "微信";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    default:
      return platform ? platform.toUpperCase() : "Hermes";
  }
}

function fallbackTitleFromSessionId(sessionId: string, platform: string): string {
  const matched = sessionId.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (matched) {
    return `${platformLabel(platform)} ${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}`;
  }

  return platformLabel(platform);
}

function toDate(input?: string | null): Date {
  if (!input) return new Date();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function normalizeSessionMessages(record: SessionFileRecord, fallbackDate: Date): ChatMessageItem[] {
  return (record.messages || [])
    .filter((item) => item.role === "user" || item.role === "assistant" || item.role === "tool")
    .map((item, index) => ({
      id: `${record.session_id || "session"}-${index}`,
      role: item.role as ChatMessageItem["role"],
      content: item.content || "",
      timestamp: toDate(item.timestamp || item.created_at || fallbackDate.toISOString()),
      toolName: item.tool_name || null,
      thinking: item.thinking || null,
      metadata: item.metadata || null,
    }));
}

function parseDefaultModel(configContent: string): string | null {
  const match = configContent.match(/default:\s*(\S+)/);
  return match?.[1] || null;
}

function formatTokenCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
}

function formatCostLabel(cost: number | null, costStatus: string | null): string | null {
  if (costStatus === "unknown") {
    return "未统计";
  }

  if (cost == null) {
    return null;
  }

  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }

  return `$${cost.toFixed(2)}`;
}

function getTrailPosition(messages: ChatMessageItem[], index: number): ArtifactTrailPosition {
  const current = messages[index];
  if (!current || current.role !== "tool") {
    return "single";
  }

  const prevIsTool = messages[index - 1]?.role === "tool";
  const nextIsTool = messages[index + 1]?.role === "tool";

  if (prevIsTool && nextIsTool) return "middle";
  if (prevIsTool) return "end";
  if (nextIsTool) return "start";
  return "single";
}

function buildConversation(
  fileName: string,
  record: SessionFileRecord,
  sessionIndexMap: Record<string, SessionIndexEntry>,
): Conversation | null {
  const sessionId = record.session_id || fileName.replace(/^session_/, "").replace(/\.json$/i, "");
  const platform = record.platform || sessionIndexMap[sessionId]?.platform || "cli";
  const indexEntry = sessionIndexMap[sessionId];
  const messages = record.messages || [];
  const userMessages = messages.filter((item) => item.role === "user");
  const displayName =
    normalizeDisplayName(indexEntry?.display_name) ||
    normalizeDisplayName(indexEntry?.origin?.chat_name) ||
    normalizeDisplayName(indexEntry?.origin?.user_name);

  const titleCandidate =
    sanitizeContent(userMessages[0]?.content) ||
    displayName ||
    fallbackTitleFromSessionId(sessionId, platform);

  const timestamp = toDate(record.last_updated || indexEntry?.updated_at || record.session_start || indexEntry?.created_at);
  const sourceLabel = displayName ? `${platformLabel(platform)} · ${displayName}` : platformLabel(platform);

  return {
    id: sessionId,
    fileName,
    title: truncate(titleCandidate, 28),
    timestamp,
    sourceLabel,
    model: record.model || null,
    toolCount: record.tools?.length || 0,
    promptTokens: indexEntry?.last_prompt_tokens ?? indexEntry?.total_tokens ?? null,
    estimatedCostUsd: indexEntry?.estimated_cost_usd ?? null,
    costStatus: indexEntry?.cost_status ?? null,
  };
}

export default function Chat() {
  const navigate = useNavigate();
  const { runtime } = useOutletContext<LayoutOutletContext>();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [runtimeSessionId, setRuntimeSessionId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationQuery, setConversationQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MessageRendererMode>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const runtimeIsUnhealthy = runtime.status === "missing" || runtime.status === "degraded";
  const canSend = runtime.installed && !isLoading && input.trim().length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    void loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);

    try {
      const [sessionFiles, rawSessionIndex, rawMainConfig] = await Promise.all([
        listSessions(),
        readConfigFile("sessions/sessions.json").catch(() => ""),
        readConfigFile("config.yaml").catch(() => ""),
      ]);

      setDefaultModel(parseDefaultModel(rawMainConfig));

      const sessionIndexRaw = safeJsonParse<Record<string, SessionIndexEntry>>(rawSessionIndex) || {};
      const sessionIndexMap: Record<string, SessionIndexEntry> = {};

      Object.values(sessionIndexRaw).forEach((entry) => {
        if (entry?.session_id) {
          sessionIndexMap[entry.session_id] = entry;
        }
      });

      const candidates = sessionFiles.filter(isCandidateSessionFile).slice(-20).reverse();
      const loadedConversations: Conversation[] = [];

      for (const fileName of candidates) {
        try {
          const raw = await readSession(fileName);
          const record = safeJsonParse<SessionFileRecord>(raw);
          if (!record) {
            continue;
          }

          const conversation = buildConversation(fileName, record, sessionIndexMap);
          if (conversation) {
            loadedConversations.push(conversation);
          }
        } catch {
          // Ignore malformed session files in the list view.
        }
      }

      if (loadedConversations.length === 0) {
        loadedConversations.push({
          id: "draft",
          fileName: null,
          title: "新对话",
          timestamp: new Date(),
          sourceLabel: DESKTOP_SOURCE_LABEL,
          model: parseDefaultModel(rawMainConfig),
          toolCount: 0,
          promptTokens: null,
          estimatedCostUsd: null,
          costStatus: null,
        });
      }

      setConversations(loadedConversations);

      if (!activeConversation && loadedConversations[0]) {
        const first = loadedConversations[0];
        setActiveConversation(first.id);
        setRuntimeSessionId(first.id === "draft" ? null : first.id);
        if (first.fileName) {
          await openConversation(first, false);
        }
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      const fallback: Conversation = {
        id: "draft",
        fileName: null,
        title: "新对话",
        timestamp: new Date(),
        sourceLabel: DESKTOP_SOURCE_LABEL,
        model: defaultModel,
        toolCount: 0,
        promptTokens: null,
        estimatedCostUsd: null,
        costStatus: null,
      };
      setConversations([fallback]);
      if (!activeConversation) {
        setActiveConversation(fallback.id);
        setRuntimeSessionId(null);
      }
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const openConversation = async (conversation: Conversation, shouldSyncSelection = true) => {
    setLastError(null);
    if (shouldSyncSelection) {
      setActiveConversation(conversation.id);
      setRuntimeSessionId(conversation.id === "draft" ? null : conversation.id);
    }

    if (!conversation.fileName) {
      setMessages([]);
      return;
    }

    try {
      const raw = await readSession(conversation.fileName);
      const record = safeJsonParse<SessionFileRecord>(raw);
      if (!record) {
        return;
      }

      setMessages(normalizeSessionMessages(record, toDate(record.last_updated || record.session_start)));
    } catch (error) {
      console.error("Failed to open session:", error);
    }
  };

  const handleSend = async () => {
    if (!canSend) {
      return;
    }

    const messageToSend = input;
    const userMessage: ChatMessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setLastError(null);

    try {
      const result = await sendChatMessage(messageToSend, runtimeSessionId);
      const response = result.content;
      const nextSessionId = result.sessionId ?? runtimeSessionId ?? activeConversation ?? "draft";
      const nextFileName = result.sessionId ? `session_${result.sessionId}.json` : null;

      if (result.sessionId) {
        setRuntimeSessionId(result.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response || "收到你的消息，我正在继续处理。",
          timestamp: new Date(),
        },
      ]);

      setActiveConversation(nextSessionId);
      setConversations((prev) => {
        const nextConversation: Conversation = {
          id: nextSessionId,
          fileName: nextFileName,
          title: truncate(messageToSend, 28),
          timestamp: new Date(),
          sourceLabel: DESKTOP_SOURCE_LABEL,
          model: defaultModel,
          toolCount: 0,
          promptTokens: null,
          estimatedCostUsd: null,
          costStatus: null,
        };

        const existingIndex = prev.findIndex((conversation) => conversation.id === nextSessionId);
        if (existingIndex === -1) {
          return [nextConversation, ...prev.filter((conversation) => conversation.id !== "draft")];
        }

        const existing = prev[existingIndex];
        const updated = {
          ...existing,
          ...nextConversation,
          fileName: existing.fileName || nextConversation.fileName,
          title: existing.title === "新对话" ? nextConversation.title : existing.title,
        };

        const remaining = prev.filter((_, index) => index !== existingIndex);
        return [updated, ...remaining];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `抱歉，发送消息时出现错误：${message}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setLastError(null);
    setActiveConversation("draft");
    setRuntimeSessionId(null);

    setConversations((prev) => {
      const withoutDraft = prev.filter((conversation) => conversation.id !== "draft");
      return [
        {
          id: "draft",
          fileName: null,
          title: "新对话",
          timestamp: new Date(),
          sourceLabel: DESKTOP_SOURCE_LABEL,
          model: defaultModel,
          toolCount: 0,
          promptTokens: null,
          estimatedCostUsd: null,
          costStatus: null,
        },
        ...withoutDraft,
      ];
    });
  };

  const filteredConversations = conversations.filter((conversation) => {
    if (!conversationQuery.trim()) {
      return true;
    }

    const query = conversationQuery.toLowerCase();
    return [conversation.title, conversation.sourceLabel].some((field) =>
      field.toLowerCase().includes(query),
    );
  });

  const activeConversationRecord =
    conversations.find((conversation) => conversation.id === activeConversation) ?? null;
  const visibleMessages = messages
    .filter(shouldRenderMessage)
    .filter((message) => {
      if (viewMode === "conversation") {
        return messageHasConversationSurface(message);
      }
      if (viewMode === "artifacts") {
        return messageHasArtifactSurface(message);
      }
      return true;
    });
  const costLabel = formatCostLabel(
    activeConversationRecord?.estimatedCostUsd ?? null,
    activeConversationRecord?.costStatus ?? null,
  );
  const composerChips = [
    activeConversationRecord?.model || defaultModel
      ? {
          label: "模型",
          value: activeConversationRecord?.model || defaultModel || "",
        }
      : null,
    activeConversationRecord?.promptTokens
      ? {
          label: "上下文",
          value: `${formatTokenCount(activeConversationRecord.promptTokens)} tokens`,
        }
      : null,
    costLabel
      ? {
          label: "花费",
          value: costLabel,
        }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const filteredEmptyState =
    messages.length > 0 && visibleMessages.length === 0
      ? {
          title: viewMode === "artifacts" ? "当前没有可展示的执行产物" : "当前没有可展示的对话内容",
          description:
            viewMode === "artifacts"
              ? "切回“全部”即可查看完整消息流。"
              : "切回“全部”或“只看产物”即可查看当前会话的执行过程。",
        }
      : null;

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="flex w-[248px] shrink-0 flex-col border-r"
        style={{
          borderColor: "var(--color-border-subtle)",
          backgroundColor: "var(--color-surface-sidebar)",
        }}
      >
        <div className="border-b px-4 py-4" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
              最近对话
            </h2>
          </div>

          <button
            onClick={startNewChat}
            className="btn-secondary mt-4 flex w-full items-center justify-center gap-2 text-sm"
          >
            <PencilSquareIcon className="h-4 w-4" />
            新建对话
          </button>

          <div className="relative mt-3">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--color-fg-tertiary)" }}
            />
            <input
              type="text"
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="搜索最近对话"
              className="input w-full pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoadingSessions ? (
            <div className="flex h-full items-center justify-center">
              <ArrowPathIcon className="h-6 w-6 animate-spin" style={{ color: "var(--color-accent)" }} />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                没有匹配的会话
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--color-fg-secondary)" }}>
                换个关键词，或者直接开始新的对话。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conversation) => {
                const isActive = activeConversation === conversation.id;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => void openConversation(conversation)}
                    className="w-full rounded-[14px] border px-3 py-3 text-left transition-colors duration-200"
                    style={{
                      borderColor: isActive
                        ? "color-mix(in srgb, var(--color-accent) 20%, transparent)"
                        : "var(--color-border-subtle)",
                      backgroundColor: isActive
                        ? "var(--color-surface-canvas)"
                        : "var(--color-surface-canvas)",
                      boxShadow: isActive
                        ? "0 8px 20px var(--color-shadow-soft)"
                        : "none",
                    }}
                  >
                    <span
                      className="block truncate text-sm font-semibold"
                      style={{ color: isActive ? "var(--color-accent)" : "var(--color-fg)" }}
                    >
                      {conversation.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-1 flex-col"
        style={{ backgroundColor: "var(--color-surface-canvas)" }}
      >
        <header className="border-b px-6 py-4" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center justify-between gap-4">
            <h1 className="truncate text-[18px] font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
              {activeConversationRecord?.title || "新对话"}
            </h1>

            <div
              className="inline-flex rounded-[12px] border p-1"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-surface-panel)",
              }}
            >
              {[
                { id: "all", label: "全部" },
                { id: "conversation", label: "只看对话" },
                { id: "artifacts", label: "只看产物" },
              ].map((option) => {
                const active = viewMode === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setViewMode(option.id as MessageRendererMode)}
                    className="rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: active ? "var(--color-surface-canvas)" : "transparent",
                      color: active ? "var(--color-fg)" : "var(--color-fg-secondary)",
                      boxShadow: active ? "0 1px 2px var(--color-shadow-soft)" : "none",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              className="flex-1 overflow-y-auto px-6 py-6"
              style={{
                backgroundColor: "var(--color-surface-canvas)",
              }}
            >
              {visibleMessages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: "var(--color-fg-tertiary)" }}
                  >
                    {filteredEmptyState ? "筛选结果" : "新对话"}
                  </div>
                  <h2 className="mt-4 text-[34px] font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
                    {filteredEmptyState ? filteredEmptyState.title : "开始对话"}
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-7" style={{ color: "var(--color-fg-secondary)" }}>
                    {filteredEmptyState
                      ? filteredEmptyState.description
                      : "输入消息开始对话。"}
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-5">
                  {visibleMessages.map((message, index) => (
                    <MessageRenderer
                      key={message.id}
                      message={message}
                      timeLabel={formatMessageTime(message.timestamp)}
                      trailPosition={getTrailPosition(visibleMessages, index)}
                      mode={viewMode}
                    />
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              )}

              {isLoading && (
                <div className="mx-auto mt-5 flex max-w-4xl justify-start animate-fade-in">
                  <div
                    className="rounded-[18px] border px-4 py-3"
                    style={{
                      borderColor: "var(--color-border-subtle)",
                      backgroundColor: "var(--color-surface-canvas)",
                    }}
                  >
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "var(--color-fg-tertiary)" }} />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full"
                        style={{ backgroundColor: "var(--color-fg-tertiary)", animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full"
                        style={{ backgroundColor: "var(--color-fg-tertiary)", animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "var(--color-border-subtle)" }}>
              {(runtimeIsUnhealthy || lastError) && (
                <div
                  className="mx-auto mb-3 flex max-w-4xl items-start justify-between gap-4 rounded-[18px] border px-4 py-3"
                  style={{
                    borderColor:
                      runtime.status === "missing"
                        ? "color-mix(in srgb, var(--color-error) 24%, transparent)"
                        : runtime.status === "degraded"
                          ? "color-mix(in srgb, var(--color-warning) 24%, transparent)"
                          : "color-mix(in srgb, var(--color-error) 24%, transparent)",
                    backgroundColor:
                      runtime.status === "missing"
                        ? "color-mix(in srgb, var(--color-error) 10%, var(--color-surface-panel))"
                        : runtime.status === "degraded"
                          ? "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-panel))"
                          : "color-mix(in srgb, var(--color-error) 10%, var(--color-surface-panel))",
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                      {lastError ? "消息发送失败" : "Hermes 当前不可用"}
                    </div>
                    <div className="mt-1 text-sm leading-6" style={{ color: "var(--color-fg-secondary)" }}>
                      {lastError || runtime.detail}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/settings")}
                    className="btn-secondary shrink-0 text-sm"
                  >
                    设置
                  </button>
                </div>
              )}

              <div
                className="mx-auto max-w-4xl rounded-[16px] border px-4 py-4"
                style={{
                  borderColor: "var(--color-border-subtle)",
                  backgroundColor: "var(--color-surface-canvas)",
                  boxShadow: "0 12px 28px var(--color-shadow-soft)",
                }}
              >
                <div>
                  {composerChips.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {composerChips.map((chip) => (
                        <span
                          key={chip.label}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                          style={{
                            borderColor: "var(--color-border-subtle)",
                            backgroundColor: "var(--color-surface-panel)",
                            color: "var(--color-fg-secondary)",
                          }}
                        >
                          <span>{chip.label}</span>
                          <span style={{ color: "var(--color-fg)" }}>{chip.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={runtime.installed ? "输入消息… Enter 发送，Shift + Enter 换行" : "Hermes 未就绪，暂时无法发送消息"}
                    rows={2}
                    className="w-full resize-none text-[15px] leading-7"
                    style={{
                      backgroundColor: "transparent",
                      color: "var(--color-fg)",
                      minHeight: "56px",
                    }}
                    disabled={isLoading || !runtime.installed}
                  />

                  <div
                    className="mt-3 flex items-center justify-between gap-3 border-t pt-3"
                    style={{
                      borderColor: "var(--color-border-subtle)",
                    }}
                  >
                    <span className="text-xs" style={{ color: "var(--color-fg-secondary)" }}>
                      {runtime.installed ? "Enter 发送，Shift + Enter 换行" : "请先完成 Hermes 安装或配置"}
                    </span>

                    <button
                      onClick={() => void handleSend()}
                      disabled={!canSend}
                      className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                      style={{
                        backgroundColor: canSend ? "var(--color-accent)" : "var(--color-surface-panel-strong)",
                        color: canSend ? "var(--color-surface-canvas)" : "var(--color-fg-tertiary)",
                        cursor: canSend ? "pointer" : "not-allowed",
                        boxShadow: canSend ? "0 4px 12px color-mix(in srgb, var(--color-accent) 14%, transparent)" : "none",
                      }}
                    >
                      {isLoading ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <PaperAirplaneIcon className="h-5 w-5" />
                          <span>发送</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
