import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  SpeakerWaveIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ThemeToggle from "../components/ThemeToggle";
import type { LayoutOutletContext } from "../components/Layout";
import {
  getGatewayRuntimeSnapshot,
  getHermesSettingsSnapshot,
  type HermesGatewayRuntimeSnapshot,
  type HermesSettingsSnapshot,
  readMainConfig,
  readSoulFile,
  updateHermesSettingsSnapshot,
  validateMainConfig,
  writeMainConfig,
  writeSoulFile,
} from "../api/hermes";
import { formatAbsoluteDateTime, sentenceCaseState } from "../lib/hermes-helpers";

type SettingsSectionId = "general" | "assistant" | "model" | "voice-memory" | "advanced";
type ModelPaneId = "basic" | "advanced" | "provider";
type NoticeTone = "success" | "error" | "info";
type SaveTarget = "assistant" | "model-basic" | "interaction" | "voice-memory" | "editor" | "refresh" | null;
type EditorKind = "soul" | "config" | null;
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface NoticeState {
  tone: NoticeTone;
  text: string;
}

interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  icon: IconComponent;
  summary: string;
}

interface ModelPaneItem {
  id: ModelPaneId;
  label: string;
  summary: string;
}

const PROVIDER_OPTIONS = [
  "custom",
  "openai",
  "anthropic",
  "openrouter",
  "nous",
  "copilot",
  "zai",
  "ollama",
  "deepseek",
  "kimi-coding",
  "minimax",
];
const REASONING_EFFORT_OPTIONS = ["none", "minimal", "low", "medium", "high", "xhigh"];
const TOOL_PROGRESS_OPTIONS = ["off", "new", "all", "verbose"];
const BACKGROUND_NOTIFICATION_OPTIONS = ["off", "result", "error", "all"];
const APPROVAL_MODE_OPTIONS = ["manual", "smart", "off"];
const RESUME_DISPLAY_OPTIONS = ["full", "minimal"];
const BUSY_INPUT_MODE_OPTIONS = ["interrupt", "queue"];
const STT_PROVIDER_OPTIONS = ["local", "openai", "mistral"];

const surfaceStyle: CSSProperties = {
  boxShadow: "0 10px 28px var(--color-shadow-soft)",
};
const elevatedSurfaceStyle: CSSProperties = {
  boxShadow: "0 18px 40px var(--color-shadow-soft)",
};

function collapseHomePath(path: string | null | undefined) {
  if (!path) {
    return "—";
  }

  const macHome = path.match(/^\/Users\/[^/]+/);
  if (macHome && path.startsWith(macHome[0])) {
    return `~${path.slice(macHome[0].length)}`;
  }

  const linuxHome = path.match(/^\/home\/[^/]+/);
  if (linuxHome && path.startsWith(linuxHome[0])) {
    return `~${path.slice(linuxHome[0].length)}`;
  }

  return path;
}

function runtimeTone(status: LayoutOutletContext["runtime"]["status"]) {
  switch (status) {
    case "missing":
      return {
        borderColor: "color-mix(in srgb, var(--color-error) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-error) 10%, var(--color-surface-panel))",
        color: "var(--color-error)",
      };
    case "degraded":
      return {
        borderColor: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-panel))",
        color: "var(--color-warning)",
      };
    case "connected":
      return {
        borderColor: "color-mix(in srgb, var(--color-success) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-success) 10%, var(--color-surface-panel))",
        color: "var(--color-success)",
      };
    default:
      return {
        borderColor: "color-mix(in srgb, var(--color-info) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-info) 10%, var(--color-surface-panel))",
        color: "var(--color-info)",
      };
  }
}

function gatewayTone(state: string | null | undefined) {
  if (state === "running" || state === "connected" || state === "ready") {
    return {
      borderColor: "color-mix(in srgb, var(--color-success) 24%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--color-success) 10%, var(--color-surface-panel))",
      color: "var(--color-success)",
    };
  }

  if (state === "starting" || state === "draining") {
    return {
      borderColor: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-panel))",
      color: "var(--color-warning)",
    };
  }

  if (state === "error" || state === "fatal") {
    return {
      borderColor: "color-mix(in srgb, var(--color-error) 24%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--color-error) 10%, var(--color-surface-panel))",
      color: "var(--color-error)",
    };
  }

  return {
    borderColor: "var(--color-border-subtle)",
    backgroundColor: "var(--color-surface-panel)",
    color: "var(--color-fg-secondary)",
  };
}

function noticeTone(tone: NoticeTone) {
  switch (tone) {
    case "success":
      return {
        borderColor: "color-mix(in srgb, var(--color-success) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-success) 10%, var(--color-surface-panel))",
        color: "var(--color-success)",
      };
    case "error":
      return {
        borderColor: "color-mix(in srgb, var(--color-error) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-error) 10%, var(--color-surface-panel))",
        color: "var(--color-error)",
      };
    default:
      return {
        borderColor: "color-mix(in srgb, var(--color-info) 24%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-info) 10%, var(--color-surface-panel))",
        color: "var(--color-info)",
      };
  }
}

function SectionSurface({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-canvas)] p-5"
      style={surfaceStyle}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-[var(--color-fg-secondary)]">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FieldLabel({
  label,
  helper,
}: {
  label: string;
  helper?: string;
}) {
  return (
    <div className="mb-2">
      <div className="text-sm font-medium text-[var(--color-fg)]">{label}</div>
      {helper && <div className="mt-1 text-xs leading-5 text-[var(--color-fg-secondary)]">{helper}</div>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{label}</div>
        {hint && <div className="mt-1 text-sm leading-6 text-[var(--color-fg-secondary)]">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? "var(--color-accent)" : "color-mix(in srgb, var(--color-border) 90%, white)",
        }}
      >
        <span
          className="absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-all"
          style={{ left: checked ? "calc(100% - 26px)" : "2px" }}
        />
      </button>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: SettingsNavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition"
      style={{
        borderColor: active ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "transparent",
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-canvas))"
          : "transparent",
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
        style={{
          backgroundColor: active
            ? "color-mix(in srgb, var(--color-accent) 10%, white)"
            : "color-mix(in srgb, var(--color-border) 24%, var(--color-surface-panel))",
          color: active ? "var(--color-accent)" : "var(--color-fg-secondary)",
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{item.label}</div>
        <div className="mt-1 truncate text-xs text-[var(--color-fg-secondary)]">{item.summary}</div>
      </div>
    </button>
  );
}

function SubButton({
  label,
  summary,
  active,
  onClick,
}: {
  label: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[12px] border px-3 py-3 text-left transition"
      style={{
        borderColor: active ? "var(--color-border-subtle)" : "transparent",
        backgroundColor: active ? "var(--color-surface-canvas)" : "transparent",
        boxShadow: active ? "0 8px 18px var(--color-shadow-soft)" : "none",
      }}
    >
      <div className="text-sm font-medium text-[var(--color-fg)]">{label}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--color-fg-secondary)]">{summary}</div>
    </button>
  );
}

export default function Settings() {
  const { runtime } = useOutletContext<LayoutOutletContext>();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("model");
  const [activeModelPane, setActiveModelPane] = useState<ModelPaneId>("basic");
  const [settings, setSettings] = useState<HermesSettingsSnapshot | null>(null);
  const [gatewayRuntime, setGatewayRuntime] = useState<HermesGatewayRuntimeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [editorKind, setEditorKind] = useState<EditorKind>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);

  const loadData = async (mode: SaveTarget = null) => {
    if (!settings) {
      setIsLoading(true);
    }
    setSaveTarget(mode);

    try {
      const [nextSettings, nextGatewayRuntime] = await Promise.all([
        getHermesSettingsSnapshot(),
        getGatewayRuntimeSnapshot().catch(() => null),
      ]);
      setSettings(nextSettings);
      setGatewayRuntime(nextGatewayRuntime);
    } catch (error) {
      setNotice({
        tone: "error",
        text: `设置读取失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsLoading(false);
      setSaveTarget(null);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateModel = <K extends keyof HermesSettingsSnapshot["model"]>(
    key: K,
    value: HermesSettingsSnapshot["model"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            model: {
              ...previous.model,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateAgent = <K extends keyof HermesSettingsSnapshot["agent"]>(
    key: K,
    value: HermesSettingsSnapshot["agent"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            agent: {
              ...previous.agent,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateDisplay = <K extends keyof Omit<HermesSettingsSnapshot["display"], "personalities">>(
    key: K,
    value: HermesSettingsSnapshot["display"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            display: {
              ...previous.display,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateApprovals = <K extends keyof HermesSettingsSnapshot["approvals"]>(
    key: K,
    value: HermesSettingsSnapshot["approvals"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            approvals: {
              ...previous.approvals,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateVoice = <K extends keyof HermesSettingsSnapshot["voice"]>(
    key: K,
    value: HermesSettingsSnapshot["voice"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            voice: {
              ...previous.voice,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateStt = <K extends keyof HermesSettingsSnapshot["stt"]>(
    key: K,
    value: HermesSettingsSnapshot["stt"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            stt: {
              ...previous.stt,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const updateMemory = <K extends keyof HermesSettingsSnapshot["memory"]>(
    key: K,
    value: HermesSettingsSnapshot["memory"][K],
  ) => {
    setSettings((previous) =>
      previous
        ? {
            ...previous,
            memory: {
              ...previous.memory,
              [key]: value,
            },
          }
        : previous,
    );
  };

  const saveModelSettings = async () => {
    if (!settings) {
      return;
    }

    setSaveTarget("model-basic");
    setNotice(null);

    try {
      await updateHermesSettingsSnapshot({
        model: settings.model,
        agent: settings.agent,
      });
      setNotice({ tone: "success", text: "模型设置已保存。" });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `保存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setSaveTarget(null);
    }
  };

  const saveAssistantSettings = async () => {
    if (!settings) {
      return;
    }

    setSaveTarget("assistant");
    setNotice(null);

    try {
      await updateHermesSettingsSnapshot({
        display: {
          personality: settings.display.personality,
          showReasoning: settings.display.showReasoning,
          streaming: settings.display.streaming,
          showCost: settings.display.showCost,
          interimAssistantMessages: settings.display.interimAssistantMessages,
          toolProgress: settings.display.toolProgress,
          backgroundProcessNotifications: settings.display.backgroundProcessNotifications,
          resumeDisplay: settings.display.resumeDisplay,
          busyInputMode: settings.display.busyInputMode,
        },
        approvals: settings.approvals,
      });
      setNotice({ tone: "success", text: "助手与交互设置已保存。" });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `保存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setSaveTarget(null);
    }
  };

  const saveVoiceMemorySettings = async () => {
    if (!settings) {
      return;
    }

    setSaveTarget("voice-memory");
    setNotice(null);

    try {
      await updateHermesSettingsSnapshot({
        voice: settings.voice,
        stt: settings.stt,
        memory: settings.memory,
      });
      setNotice({ tone: "success", text: "语音与记忆设置已保存。" });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `保存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setSaveTarget(null);
    }
  };

  const openEditor = async (kind: Exclude<EditorKind, null>) => {
    setEditorKind(kind);
    setEditorContent("");
    setEditorDirty(false);
    setEditorLoading(true);
    setNotice(null);

    try {
      const content = kind === "soul" ? await readSoulFile() : await readMainConfig();
      setEditorContent(content);
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${kind === "soul" ? "SOUL.md" : "config.yaml"} 读取失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      setEditorKind(null);
    } finally {
      setEditorLoading(false);
    }
  };

  const saveEditor = async () => {
    if (!editorKind) {
      return;
    }

    setSaveTarget("editor");
    setNotice(null);

    try {
      if (editorKind === "soul") {
        await writeSoulFile(editorContent);
        setNotice({ tone: "success", text: "SOUL.md 已保存。" });
      } else {
        await validateMainConfig(editorContent);
        await writeMainConfig(editorContent);
        setNotice({ tone: "success", text: "config.yaml 已保存。" });
      }

      setEditorDirty(false);
      setEditorKind(null);
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `保存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setSaveTarget(null);
    }
  };

  const navItems: SettingsNavItem[] = useMemo(
    () => [
      {
        id: "general",
        label: "通用",
        icon: AdjustmentsHorizontalIcon,
        summary: runtime.label,
      },
      {
        id: "assistant",
        label: "助手",
        icon: SparklesIcon,
        summary: settings ? settings.display.personality || "默认人格" : "读取中",
      },
      {
        id: "model",
        label: "模型",
        icon: CpuChipIcon,
        summary: settings ? settings.model.default || "未设置模型" : "读取中",
      },
      {
        id: "voice-memory",
        label: "语音与记忆",
        icon: SpeakerWaveIcon,
        summary: settings
          ? `${settings.stt.enabled ? "语音开启" : "语音关闭"} · ${settings.memory.memoryEnabled ? "记忆开启" : "记忆关闭"}`
          : "读取中",
      },
      {
        id: "advanced",
        label: "高级",
        icon: WrenchScrewdriverIcon,
        summary: settings ? collapseHomePath(settings.files.configPath) : "读取中",
      },
    ],
    [runtime.label, settings],
  );

  const modelPaneItems: ModelPaneItem[] = [
    {
      id: "basic",
      label: "基础",
      summary: "选择主模型并完成连接",
    },
    {
      id: "advanced",
      label: "高级",
      summary: "压缩、辅助、子代理与回退策略",
    },
    {
      id: "provider",
      label: "Provider",
      summary: "整理接口与默认连接信息",
    },
  ];

  const runtimeBadge = runtimeTone(runtime.status);
  const gatewayBadge = gatewayTone(gatewayRuntime?.gateway_state);
  const noteTone = notice ? noticeTone(notice.tone) : null;
  const gatewayUpdatedAt = gatewayRuntime?.updated_at ? formatAbsoluteDateTime(gatewayRuntime.updated_at) : "—";
  const gatewayStateLabel = sentenceCaseState(gatewayRuntime?.gateway_state ?? "stopped");

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_220px_minmax(0,1fr)] overflow-hidden">
      <aside className="border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-sidebar)] p-4">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </div>

        <div
          className="mt-4 rounded-[16px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-canvas)] p-4"
          style={surfaceStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[var(--color-fg)]">主题</div>
              <div className="mt-1 text-xs text-[var(--color-fg-secondary)]">浅色 / 深色</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <aside className="border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-4">
        {activeSection === "model" ? (
          <div>
            <div className="mb-3 px-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-fg-tertiary)]">
                模型
              </div>
            </div>
            <div className="space-y-2">
              {modelPaneItems.map((item) => (
                <SubButton
                  key={item.id}
                  label={item.label}
                  summary={item.summary}
                  active={activeModelPane === item.id}
                  onClick={() => setActiveModelPane(item.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="rounded-[16px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-canvas)] p-4"
            style={surfaceStyle}
          >
            <div className="text-sm font-medium text-[var(--color-fg)]">
              {navItems.find((item) => item.id === activeSection)?.label}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
              当前页面聚焦单一配置任务，详细表单显示在右侧。
            </div>
          </div>
        )}
      </aside>

      <main className="min-h-0 overflow-y-auto bg-[var(--color-surface-canvas)] px-6 py-6">
        {notice && noteTone && (
          <div className="mb-5 flex items-start gap-3 rounded-[16px] border px-4 py-3" style={noteTone}>
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm leading-6">{notice.text}</div>
          </div>
        )}

        {isLoading || !settings ? (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] text-sm text-[var(--color-fg-secondary)]">
            正在读取设置...
          </div>
        ) : (
          <>
            {activeSection === "general" && (
              <div className="space-y-4">
                <SectionSurface title="运行状态" description="健康状态保持安静，异常状态才需要处理。">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-[var(--color-fg)]">Hermes</div>
                        <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={runtimeBadge}>
                          {runtime.label}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-[var(--color-fg-secondary)]">{runtime.version || "版本未知"}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">{runtime.detail}</div>
                    </div>

                    <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-[var(--color-fg)]">Gateway</div>
                        <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={gatewayBadge}>
                          {gatewayStateLabel}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-[var(--color-fg-secondary)]">
                        PID {gatewayRuntime?.pid ?? "—"} · 更新 {gatewayUpdatedAt}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                        {sentenceCaseState(gatewayRuntime?.exit_reason ?? "active")}
                      </div>
                    </div>
                  </div>
                </SectionSurface>

                <SectionSurface
                  title="文件"
                  description="原始配置在这里，默认不打扰当前设置流程。"
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openEditor("config")}
                        className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                      >
                        编辑 config
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditor("soul")}
                        className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                      >
                        编辑 SOUL
                      </button>
                    </div>
                  }
                >
                  <div className="grid gap-3">
                    {[
                      ["Hermes Home", settings.files.hermesHome],
                      ["config.yaml", settings.files.configPath],
                      ["SOUL.md", settings.files.soulPath],
                      [".env", settings.files.envPath],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-3"
                      >
                        <span className="text-sm text-[var(--color-fg-secondary)]">{label}</span>
                        <span className="font-mono text-sm text-[var(--color-fg)]">{collapseHomePath(value)}</span>
                      </div>
                    ))}
                  </div>
                </SectionSurface>
              </div>
            )}

            {activeSection === "assistant" && (
              <div className="space-y-4">
                <SectionSurface title="人格" description="控制当前对话的默认语气和行为风格。">
                  <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <label className="block">
                      <FieldLabel label="当前人格" />
                      <select
                        value={settings.display.personality}
                        onChange={(event) => updateDisplay("personality", event.target.value)}
                        className="input w-full"
                      >
                        {settings.display.personalities.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4">
                      <div className="text-sm font-medium text-[var(--color-fg)]">SOUL.md</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                        {collapseHomePath(settings.files.soulPath)}
                      </div>
                    </div>
                  </div>
                </SectionSurface>

                <SectionSurface title="交互" description="控制思考、流式输出和过程信息的呈现方式。">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <ToggleRow
                      label="显示思考"
                      hint="将 reasoning 内容渲染到界面"
                      checked={settings.display.showReasoning}
                      onChange={(next) => updateDisplay("showReasoning", next)}
                    />
                    <ToggleRow
                      label="流式输出"
                      hint="按流式方式刷新回复"
                      checked={settings.display.streaming}
                      onChange={(next) => updateDisplay("streaming", next)}
                    />
                    <ToggleRow
                      label="显示花费"
                      hint="在聊天界面显示 cost 信息"
                      checked={settings.display.showCost}
                      onChange={(next) => updateDisplay("showCost", next)}
                    />
                    <ToggleRow
                      label="中间消息"
                      hint="显示自然语言过程消息"
                      checked={settings.display.interimAssistantMessages}
                      onChange={(next) => updateDisplay("interimAssistantMessages", next)}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <FieldLabel label="Tool Progress" />
                      <select
                        value={settings.display.toolProgress}
                        onChange={(event) => updateDisplay("toolProgress", event.target.value)}
                        className="input w-full"
                      >
                        {TOOL_PROGRESS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel label="后台任务通知" />
                      <select
                        value={settings.display.backgroundProcessNotifications}
                        onChange={(event) => updateDisplay("backgroundProcessNotifications", event.target.value)}
                        className="input w-full"
                      >
                        {BACKGROUND_NOTIFICATION_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel label="Resume Display" />
                      <select
                        value={settings.display.resumeDisplay}
                        onChange={(event) => updateDisplay("resumeDisplay", event.target.value)}
                        className="input w-full"
                      >
                        {RESUME_DISPLAY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel label="Busy Input" />
                      <select
                        value={settings.display.busyInputMode}
                        onChange={(event) => updateDisplay("busyInputMode", event.target.value)}
                        className="input w-full"
                      >
                        {BUSY_INPUT_MODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <FieldLabel label="审批模式" />
                      <select
                        value={settings.approvals.mode}
                        onChange={(event) => updateApprovals("mode", event.target.value)}
                        className="input w-full"
                      >
                        {APPROVAL_MODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel label="审批超时" />
                      <input
                        type="number"
                        value={settings.approvals.timeout}
                        onChange={(event) => updateApprovals("timeout", Number(event.target.value) || 0)}
                        className="input w-full"
                      />
                    </label>
                  </div>
                </SectionSurface>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveAssistantSettings()}
                    disabled={saveTarget === "assistant"}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    {saveTarget === "assistant" && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                    保存更改
                  </button>
                </div>
              </div>
            )}

            {activeSection === "model" && (
              <div className="space-y-4">
                {activeModelPane === "basic" && (
                  <>
                    <SectionSurface title="主模型" description="默认只配置一个主模型，保存后即可开始使用。">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                          <FieldLabel label="Provider 类型" />
                          <select
                            value={settings.model.provider}
                            onChange={(event) => updateModel("provider", event.target.value)}
                            className="input w-full"
                          >
                            {Array.from(new Set([settings.model.provider, ...PROVIDER_OPTIONS])).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <FieldLabel label="主模型" helper="自动获取失败时可手动填写 model id" />
                          <input
                            type="text"
                            value={settings.model.default}
                            onChange={(event) => updateModel("default", event.target.value)}
                            className="input w-full"
                            placeholder="gpt-5.4"
                          />
                        </label>

                        <label className="block lg:col-span-2">
                          <FieldLabel label="Base URL" />
                          <input
                            type="text"
                            value={settings.model.baseUrl}
                            onChange={(event) => updateModel("baseUrl", event.target.value)}
                            className="input w-full"
                            placeholder="https://api.openai.com/v1"
                          />
                        </label>

                        <label className="block lg:col-span-2">
                          <FieldLabel label="API Key" />
                          <input
                            type="password"
                            value={settings.model.apiKey}
                            onChange={(event) => updateModel("apiKey", event.target.value)}
                            className="input w-full"
                            placeholder="sk-..."
                          />
                        </label>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void saveModelSettings()}
                          disabled={saveTarget === "model-basic"}
                          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: "var(--color-accent)" }}
                        >
                          {saveTarget === "model-basic" && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                          保存
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                        >
                          获取模型
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                        >
                          测试连接
                        </button>
                      </div>
                    </SectionSurface>

                    <SectionSurface title="执行" description="少量关键参数保留在基础页，避免普通用户承担过多心智压力。">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <label className="block">
                          <FieldLabel label="思考强度" />
                          <select
                            value={settings.agent.reasoningEffort}
                            onChange={(event) => updateAgent("reasoningEffort", event.target.value)}
                            className="input w-full"
                          >
                            {REASONING_EFFORT_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <FieldLabel label="最大轮次" />
                          <input
                            type="number"
                            value={settings.agent.maxTurns}
                            onChange={(event) => updateAgent("maxTurns", Number(event.target.value) || 0)}
                            className="input w-full"
                          />
                        </label>
                        <label className="block">
                          <FieldLabel label="Gateway Timeout" />
                          <input
                            type="number"
                            value={settings.agent.gatewayTimeout}
                            onChange={(event) => updateAgent("gatewayTimeout", Number(event.target.value) || 0)}
                            className="input w-full"
                          />
                        </label>
                      </div>
                    </SectionSurface>
                  </>
                )}

                {activeModelPane === "advanced" && (
                  <SectionSurface title="高级模型策略" description="这些选项属于高级能力，不抢默认注意力。">
                    <div className="grid gap-4">
                      <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4">
                        <div className="text-sm font-medium text-[var(--color-fg)]">压缩</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                          当前版本先保留为说明位，后续对齐 Hermes 的 compression / auxiliary / delegation / fallback / smart routing 真实配置结构。
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4">
                        <div className="text-sm font-medium text-[var(--color-fg)]">辅助任务</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                          包括 vision、web extract、session search、approval、mcp、flush memories 等次级模型能力。
                        </div>
                      </div>
                      <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4">
                        <div className="text-sm font-medium text-[var(--color-fg)]">子代理与回退策略</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                          后续在这一栏继续接入 delegation、fallback 与 smart routing 的真实可编辑表单。
                        </div>
                      </div>
                    </div>
                  </SectionSurface>
                )}

                {activeModelPane === "provider" && (
                  <SectionSurface title="Provider" description="把自定义接口当作可复用连接实体管理。">
                    <div className="grid gap-3">
                      <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[var(--color-fg)]">当前默认接口</div>
                          <span className="rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs text-[var(--color-fg-secondary)]">
                            主接口
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                          {settings.model.provider || "custom"} · {settings.model.baseUrl || "未设置 URL"}
                        </div>
                        <div className="mt-1 text-sm text-[var(--color-fg-secondary)]">
                          默认模型：{settings.model.default || "未设置"}
                        </div>
                      </div>

                      <div className="rounded-[14px] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-canvas)] px-4 py-4">
                        <div className="text-sm font-medium text-[var(--color-fg)]">后续扩展</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--color-fg-secondary)]">
                          这里后续接入 custom providers、模型目录探测、已缓存模型列表和 per-model metadata 编辑。
                        </div>
                      </div>
                    </div>
                  </SectionSurface>
                )}
              </div>
            )}

            {activeSection === "voice-memory" && (
              <div className="space-y-4">
                <SectionSurface title="语音输入" description="控制桌面录音与转写。">
                  <div className="grid gap-3">
                    <ToggleRow
                      label="启用 STT"
                      hint="桌面录音转文本"
                      checked={settings.stt.enabled}
                      onChange={(next) => updateStt("enabled", next)}
                    />
                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="block">
                        <FieldLabel label="Provider" />
                        <select
                          value={settings.stt.provider}
                          onChange={(event) => updateStt("provider", event.target.value)}
                          className="input w-full"
                        >
                          {STT_PROVIDER_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <FieldLabel label="Local Model" />
                        <input
                          type="text"
                          value={settings.stt.localModel}
                          onChange={(event) => updateStt("localModel", event.target.value)}
                          className="input w-full"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel label="Language" />
                        <input
                          type="text"
                          value={settings.stt.language}
                          onChange={(event) => updateStt("language", event.target.value)}
                          className="input w-full"
                        />
                      </label>
                    </div>
                  </div>
                </SectionSurface>

                <SectionSurface title="语音输出" description="控制录音热键与播报行为。">
                  <div className="grid gap-3">
                    <ToggleRow
                      label="自动 TTS"
                      hint="回复完成后自动播报"
                      checked={settings.voice.autoTts}
                      onChange={(next) => updateVoice("autoTts", next)}
                    />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="block">
                        <FieldLabel label="Record Key" />
                        <input
                          type="text"
                          value={settings.voice.recordKey}
                          onChange={(event) => updateVoice("recordKey", event.target.value)}
                          className="input w-full"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel label="Max Recording" />
                        <input
                          type="number"
                          value={settings.voice.maxRecordingSeconds}
                          onChange={(event) => updateVoice("maxRecordingSeconds", Number(event.target.value) || 0)}
                          className="input w-full"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel label="Silence Threshold" />
                        <input
                          type="number"
                          value={settings.voice.silenceThreshold}
                          onChange={(event) => updateVoice("silenceThreshold", Number(event.target.value) || 0)}
                          className="input w-full"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel label="Silence Duration" />
                        <input
                          type="number"
                          step="0.1"
                          value={settings.voice.silenceDuration}
                          onChange={(event) => updateVoice("silenceDuration", Number(event.target.value) || 0)}
                          className="input w-full"
                        />
                      </label>
                    </div>
                  </div>
                </SectionSurface>

                <SectionSurface title="记忆" description="控制长期记忆与用户画像。">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <ToggleRow
                      label="长期记忆"
                      hint="让 Hermes 持续写入记忆"
                      checked={settings.memory.memoryEnabled}
                      onChange={(next) => updateMemory("memoryEnabled", next)}
                    />
                    <ToggleRow
                      label="用户画像"
                      hint="记录长期偏好与画像"
                      checked={settings.memory.userProfileEnabled}
                      onChange={(next) => updateMemory("userProfileEnabled", next)}
                    />
                    <label className="block">
                      <FieldLabel label="Nudge Interval" />
                      <input
                        type="number"
                        value={settings.memory.nudgeInterval}
                        onChange={(event) => updateMemory("nudgeInterval", Number(event.target.value) || 0)}
                        className="input w-full"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel label="Flush Min Turns" />
                      <input
                        type="number"
                        value={settings.memory.flushMinTurns}
                        onChange={(event) => updateMemory("flushMinTurns", Number(event.target.value) || 0)}
                        className="input w-full"
                      />
                    </label>
                  </div>
                </SectionSurface>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveVoiceMemorySettings()}
                    disabled={saveTarget === "voice-memory"}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    {saveTarget === "voice-memory" && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                    保存更改
                  </button>
                </div>
              </div>
            )}

            {activeSection === "advanced" && (
              <div className="space-y-4">
                <SectionSurface
                  title="原始配置"
                  description="原始文件编辑保留在高级页，避免干扰默认配置流程。"
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openEditor("config")}
                        className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                      >
                        编辑 config.yaml
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditor("soul")}
                        className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                      >
                        编辑 SOUL.md
                      </button>
                    </div>
                  }
                >
                  <div className="grid gap-3">
                    {[
                      ["Hermes Home", settings.files.hermesHome],
                      ["config.yaml", settings.files.configPath],
                      ["SOUL.md", settings.files.soulPath],
                      [".env", settings.files.envPath],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-3"
                      >
                        <span className="text-sm text-[var(--color-fg-secondary)]">{label}</span>
                        <span className="font-mono text-sm text-[var(--color-fg)]">{collapseHomePath(value)}</span>
                      </div>
                    ))}
                  </div>
                </SectionSurface>

                <SectionSurface title="刷新" description="重新读取 Hermes 当前配置快照。">
                  <button
                    type="button"
                    onClick={() => void loadData("refresh")}
                    disabled={saveTarget === "refresh"}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${saveTarget === "refresh" ? "animate-spin" : ""}`} />
                    刷新设置
                  </button>
                </SectionSurface>
              </div>
            )}
          </>
        )}
      </main>

      {editorKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm">
          <div
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-canvas)]"
            style={elevatedSurfaceStyle}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-6 py-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-fg-tertiary)]">
                  {editorKind === "soul" ? "Soul" : "Config"}
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-fg)]">
                  {editorKind === "soul" ? "SOUL.md" : "config.yaml"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditorKind(null)}
                className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] p-2 text-[var(--color-fg-secondary)] transition hover:border-orange-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 p-6">
              {editorLoading ? (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] text-sm text-[var(--color-fg-secondary)]">
                  正在读取文件...
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(event) => {
                    setEditorContent(event.target.value);
                    setEditorDirty(true);
                  }}
                  className="h-full min-h-[420px] w-full rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-4 font-mono text-sm leading-7 text-[var(--color-fg)] outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  spellCheck={false}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border-subtle)] px-6 py-4">
              <div className="text-sm text-[var(--color-fg-secondary)]">
                {editorDirty ? "有未保存更改" : "已与磁盘同步"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorKind(null)}
                  className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition hover:border-orange-200"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditor()}
                  disabled={editorLoading || saveTarget === "editor"}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  {saveTarget === "editor" && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  保存文件
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
