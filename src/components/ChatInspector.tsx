import type { ReactNode } from "react";
import {
  ExclamationTriangleIcon,
  FolderIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { HermesRuntimeState } from "../hooks/useHermesRuntime";

export interface ChatInspectorConversation {
  id: string;
  title: string;
  preview: string;
  sourceLabel: string;
  updatedLabel: string;
  fileName: string | null;
}

export interface ChatInspectorProps {
  runtime: HermesRuntimeState;
  conversation: ChatInspectorConversation | null;
  lastError: string | null;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

function isDesktopSourceLabel(sourceLabel?: string | null): boolean {
  return !sourceLabel || sourceLabel === "桌面 CLI";
}

function toneStyles(tone: HermesRuntimeState["tone"]) {
  switch (tone) {
    case "success":
      return {
        backgroundColor: "color-mix(in srgb, var(--color-success) 12%, var(--color-surface-panel))",
        borderColor: "color-mix(in srgb, var(--color-success) 22%, transparent)",
        textColor: "var(--color-success)",
      };
    case "warning":
      return {
        backgroundColor: "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-panel))",
        borderColor: "color-mix(in srgb, var(--color-warning) 22%, transparent)",
        textColor: "var(--color-warning)",
      };
    case "error":
      return {
        backgroundColor: "color-mix(in srgb, var(--color-error) 12%, var(--color-surface-panel))",
        borderColor: "color-mix(in srgb, var(--color-error) 22%, transparent)",
        textColor: "var(--color-error)",
      };
    default:
      return {
        backgroundColor: "color-mix(in srgb, var(--color-info) 12%, var(--color-surface-panel))",
        borderColor: "color-mix(in srgb, var(--color-info) 22%, transparent)",
        textColor: "var(--color-info)",
      };
  }
}

function InspectorSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[22px] border p-4"
      style={{
        borderColor: "var(--color-border-subtle)",
        backgroundColor: "var(--color-surface-canvas)",
      }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
        <span style={{ color: "var(--color-accent)" }}>{icon}</span>
        <div className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ChatInspector({
  runtime,
  conversation,
  lastError,
  onClose,
  onOpenSettings,
}: ChatInspectorProps) {
  const runtimeTone = toneStyles(runtime.tone);
  const runtimeIsUnhealthy = runtime.status === "missing" || runtime.status === "degraded";

  return (
    <aside
      className="hidden w-[296px] shrink-0 border-l xl:flex xl:flex-col"
      style={{
        borderColor: "var(--color-border-subtle)",
        backgroundColor: "var(--color-surface-sidebar)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-4"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
            会话信息
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--color-fg-secondary)" }}>
            仅在需要时查看上下文与技术信息
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-2xl border p-2 transition-colors"
            style={{
              color: "var(--color-fg-tertiary)",
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-surface-canvas)",
            }}
            title="关闭详情"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <InspectorSection icon={<SparklesIcon className="h-4 w-4" />} title="当前会话">
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
                {conversation?.title || "未开始"}
              </h3>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-fg-secondary)" }}>
                {conversation?.preview || "等待你的第一条消息。"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{
                  borderColor: "var(--color-border-subtle)",
                  backgroundColor: "var(--color-surface-panel)",
                  color: "var(--color-fg-secondary)",
                }}
              >
                {conversation?.updatedLabel ? `更新于 ${conversation.updatedLabel}` : "刚刚开始"}
              </span>
              {!isDesktopSourceLabel(conversation?.sourceLabel) && (
                <span
                  className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    borderColor: "var(--color-border-subtle)",
                    backgroundColor: "var(--color-surface-panel)",
                    color: "var(--color-fg-secondary)",
                  }}
                >
                  {conversation?.sourceLabel}
                </span>
              )}
            </div>
          </div>
        </InspectorSection>

        {(runtimeIsUnhealthy || lastError) && (
          <InspectorSection icon={<ExclamationTriangleIcon className="h-4 w-4" />} title="状态与异常">
            <div
              className="rounded-[18px] border p-3"
              style={{
                backgroundColor: runtimeTone.backgroundColor,
                borderColor: runtimeTone.borderColor,
              }}
            >
              <div
                className="mb-1 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: runtimeTone.textColor }}
              >
                Hermes
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                {runtime.label}
              </div>
              <div className="mt-1 text-xs leading-5" style={{ color: "var(--color-fg-secondary)" }}>
                {lastError || runtime.detail}
              </div>
            </div>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="btn-secondary mt-3 w-full text-sm"
              >
                打开设置
              </button>
            )}
          </InspectorSection>
        )}

        <details
          className="rounded-[22px] border p-4"
          style={{
            borderColor: "var(--color-border-subtle)",
            backgroundColor: "var(--color-surface-canvas)",
          }}
        >
          <summary
            className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            <FolderIcon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            技术信息
          </summary>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span style={{ color: "var(--color-fg-secondary)" }}>Hermes 版本</span>
              <span className="text-right" style={{ color: "var(--color-fg)" }}>
                {runtime.version || "未知"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span style={{ color: "var(--color-fg-secondary)" }}>可执行路径</span>
              <span className="break-all text-right" style={{ color: "var(--color-fg)" }}>
                {runtime.pathLabel}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span style={{ color: "var(--color-fg-secondary)" }}>Session ID</span>
              <span className="break-all text-right" style={{ color: "var(--color-fg)" }}>
                {conversation?.id || "未分配"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span style={{ color: "var(--color-fg-secondary)" }}>会话文件</span>
              <span className="break-all text-right" style={{ color: "var(--color-fg)" }}>
                {conversation?.fileName || "尚未持久化"}
              </span>
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}
