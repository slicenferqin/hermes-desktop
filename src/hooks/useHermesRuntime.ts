import { useEffect, useState } from "react";
import { getHermesStatus } from "../api/hermes";

export type HermesRuntimeStatus = "checking" | "connected" | "missing" | "degraded";
export type HermesRuntimeTone = "info" | "success" | "warning" | "error";

export interface HermesRuntimeState {
  isLoading: boolean;
  installed: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
  status: HermesRuntimeStatus;
  tone: HermesRuntimeTone;
  label: string;
  detail: string;
  pathLabel: string;
}

function collapseHome(path: string | null): string {
  if (!path) {
    return "未找到";
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

function toRuntimeState(
  input: Partial<Pick<HermesRuntimeState, "installed" | "version" | "path" | "error">> & {
    isLoading?: boolean;
  },
): HermesRuntimeState {
  const installed = Boolean(input.installed);
  const version = input.version ?? null;
  const path = input.path ?? null;
  const error = input.error ?? null;
  const isLoading = Boolean(input.isLoading);

  if (isLoading) {
    return {
      isLoading: true,
      installed: false,
      version: null,
      path: null,
      error: null,
      status: "checking",
      tone: "info",
      label: "检测中",
      detail: "正在读取本机 Hermes 运行态",
      pathLabel: "检测中",
    };
  }

  if (!installed) {
    return {
      isLoading: false,
      installed: false,
      version,
      path,
      error,
      status: "missing",
      tone: "error",
      label: "未安装",
      detail: error || "未检测到 hermes-agent 可执行文件",
      pathLabel: "未找到",
    };
  }

  if (!path || !version) {
    return {
      isLoading: false,
      installed: true,
      version,
      path,
      error,
      status: "degraded",
      tone: "warning",
      label: "状态异常",
      detail: error || "已找到 Hermes，但版本或路径信息不完整",
      pathLabel: collapseHome(path),
    };
  }

  return {
    isLoading: false,
    installed: true,
    version,
    path,
    error,
    status: "connected",
    tone: "success",
    label: "已就绪",
    detail: `Hermes ${version} 已连接到桌面壳层`,
    pathLabel: collapseHome(path),
  };
}

export function useHermesRuntime(pollIntervalMs = 30000) {
  const [runtime, setRuntime] = useState<HermesRuntimeState>(() =>
    toRuntimeState({ isLoading: true }),
  );

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const status = await getHermesStatus();
        if (cancelled) {
          return;
        }

        setRuntime(
          toRuntimeState({
            installed: status.installed,
            version: status.version,
            path: status.path,
          }),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRuntime(
          toRuntimeState({
            installed: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    };

    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollIntervalMs]);

  return runtime;
}
