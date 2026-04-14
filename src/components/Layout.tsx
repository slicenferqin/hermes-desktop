import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  ChatBubbleLeftIcon as ChatBubbleLeftSolid,
  Cog6ToothIcon as Cog6ToothSolid,
  ClockIcon as ClockSolid,
  GlobeAltIcon as GlobeAltSolid,
  SparklesIcon as SparklesSolid,
} from "@heroicons/react/24/solid";
import ThemeToggle from "./ThemeToggle";
import { HermesRuntimeState, useHermesRuntime } from "../hooks/useHermesRuntime";

export interface LayoutOutletContext {
  runtime: HermesRuntimeState;
}

const tabs = [
  { path: "/chat", label: "对话", icon: ChatBubbleLeftIcon, activeIcon: ChatBubbleLeftSolid },
  { path: "/channels", label: "渠道", icon: GlobeAltIcon, activeIcon: GlobeAltSolid },
  { path: "/skills", label: "技能", icon: SparklesIcon, activeIcon: SparklesSolid },
  { path: "/tasks", label: "任务", icon: ClockIcon, activeIcon: ClockSolid },
  { path: "/settings", label: "设置", icon: Cog6ToothIcon, activeIcon: Cog6ToothSolid },
];

function runtimeBadgeTone(status: HermesRuntimeState["status"]) {
  switch (status) {
    case "missing":
      return {
        background: "color-mix(in srgb, var(--color-error) 12%, var(--color-surface-panel))",
        border: "color-mix(in srgb, var(--color-error) 24%, transparent)",
        color: "var(--color-error)",
      };
    case "degraded":
      return {
        background: "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-panel))",
        border: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
        color: "var(--color-warning)",
      };
    default:
      return {
        background: "color-mix(in srgb, var(--color-success) 10%, var(--color-surface-panel))",
        border: "color-mix(in srgb, var(--color-success) 18%, transparent)",
        color: "var(--color-success)",
      };
  }
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const runtime = useHermesRuntime();
  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path)) ?? tabs[0];
  const badgeTone = runtimeBadgeTone(runtime.status);
  const runtimeIsUnhealthy = runtime.status === "missing" || runtime.status === "degraded";

  return (
    <div
      className="h-screen p-5"
      style={{
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div className="grid h-full min-h-0 grid-cols-[88px_minmax(0,1fr)] gap-4">
        <aside
          className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border"
          style={{
            borderColor: "var(--color-border-subtle)",
            backgroundColor: "var(--color-surface-sidebar)",
            boxShadow: "0 12px 32px var(--color-shadow-soft)",
          }}
        >
          <div
            className="border-b px-3 pb-3 pt-4"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <button
              onClick={() => navigate("/chat")}
              className="flex w-full flex-col items-center gap-2 text-center"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-sm font-semibold"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-accent) 12%, white)",
                  color: "var(--color-accent)",
                }}
              >
                H
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium leading-4" style={{ color: "var(--color-fg-secondary)" }}>
                  Hermes
                </div>
              </div>
            </button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
            {tabs.map((tab) => {
              const isActive = location.pathname.startsWith(tab.path);
              const Icon = isActive ? tab.activeIcon : tab.icon;

              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="group flex w-full flex-col items-center gap-1 rounded-[14px] px-2 py-3 text-center transition-colors duration-200"
                  style={{
                    backgroundColor: isActive ? "var(--color-surface-canvas)" : "transparent",
                    border: isActive
                      ? "1px solid var(--color-border-subtle)"
                      : "1px solid transparent",
                    boxShadow: isActive ? "0 6px 18px var(--color-shadow-soft)" : "none",
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
                    style={{
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--color-accent) 10%, white)"
                        : "transparent",
                      color: isActive ? "var(--color-accent)" : "var(--color-fg-secondary)",
                    }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[11px] font-medium leading-4"
                      style={{ color: isActive ? "var(--color-accent)" : "var(--color-fg)" }}
                    >
                      {tab.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          <div
            className="flex flex-col items-center gap-2 border-t px-2 py-4"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div className="text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: "var(--color-fg-tertiary)" }}>
              Theme
            </div>
            <div className="scale-[0.92]">
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <header
            className="flex items-center justify-between rounded-[18px] border px-5 py-3.5"
            style={{
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-surface-shell)",
              boxShadow: "0 8px 24px var(--color-shadow-soft)",
            }}
          >
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold tracking-tight" style={{ color: "var(--color-fg)" }}>
                {activeTab.label}
              </h1>
            </div>

            {runtimeIsUnhealthy && (
              <button
                onClick={() => navigate("/settings")}
                className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: badgeTone.border,
                  backgroundColor: badgeTone.background,
                  color: badgeTone.color,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  {runtime.label}
                </span>
              </button>
            )}
          </header>

          <main
            className="min-h-0 flex-1 overflow-hidden rounded-[22px] border"
            style={{
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-surface-canvas)",
              boxShadow: "0 12px 32px var(--color-shadow-soft)",
            }}
          >
            <Outlet context={{ runtime }} />
          </main>
        </div>
      </div>
    </div>
  );
}
