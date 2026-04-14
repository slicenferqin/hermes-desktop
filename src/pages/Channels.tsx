import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import QRCode from "qrcode";
import {
  getGatewayRuntimeSnapshot,
  getGatewayStatus,
  HermesGatewayRuntimeSnapshot,
  listConfigFiles,
  pollWeixinQrLogin,
  readConfigFile,
  readEnvFile,
  restartGateway,
  startGateway,
  startWeixinQrLogin,
  stopGateway,
  writeConfigFile,
  writeEnvFile,
} from "../api/hermes";
import {
  applyEnvUpdates,
  formatAbsoluteDateTime,
  parseEnvFile,
  sentenceCaseState,
  splitCsv,
} from "../lib/hermes-helpers";

type ChannelFieldType = "text" | "password" | "select" | "toggle";
type ChannelConfigState = "configured" | "partial" | "empty";
type NoticeTone = "success" | "error" | "info";

interface ChannelFieldOption {
  label: string;
  value: string;
}

interface ChannelField {
  key: string;
  label: string;
  type: ChannelFieldType;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  options?: ChannelFieldOption[];
}

interface ChannelDefinition {
  id: string;
  name: string;
  monogram: string;
  description: string;
  requiredKeys?: string[];
  fields: ChannelField[];
  insights: (env: Record<string, string>) => string[];
}

interface GatewaySummary {
  running: boolean;
  title: string;
  detail: string;
}

interface WeixinQrState {
  qrcode: string;
  qrUrl: string;
  baseUrl: string;
  status: "wait" | "scaned" | "scaned_but_redirect" | "expired" | "confirmed" | "error";
  message: string;
  accountId?: string;
  userId?: string;
  homeChannel?: string;
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const CHANNEL_ENV_PREFIXES = [
  "FEISHU_",
  "WEIXIN_",
  "TELEGRAM_",
  "DISCORD_",
  "SLACK_",
  "SIGNAL_",
  "WHATSAPP_",
  "DINGTALK_",
  "WECOM_",
  "WECOM_CALLBACK_",
  "MATTERMOST_",
  "MATRIX_",
  "EMAIL_",
  "SMS_",
  "TWILIO_",
  "BLUEBUBBLES_",
  "WEBHOOK_",
  "API_SERVER_",
];
const CHANNEL_ENV_EXACT_KEYS = new Set(["GATEWAY_ALLOW_ALL_USERS"]);

const CHANNELS: ChannelDefinition[] = [
  {
    id: "feishu",
    name: "飞书 / Lark",
    monogram: "飞",
    description: "企业协作主通道，适合群聊、机器人通知和定时任务回推。",
    fields: [
      { key: "FEISHU_APP_ID", label: "App ID", type: "text", required: true, placeholder: "cli_a1b2c3..." },
      { key: "FEISHU_APP_SECRET", label: "App Secret", type: "password", required: true, placeholder: "应用密钥" },
      {
        key: "FEISHU_DOMAIN",
        label: "域名",
        type: "select",
        options: [
          { label: "Feishu 中国版", value: "feishu" },
          { label: "Lark 国际版", value: "lark" },
        ],
      },
      {
        key: "FEISHU_CONNECTION_MODE",
        label: "连接模式",
        type: "select",
        options: [
          { label: "WebSocket", value: "websocket" },
          { label: "Webhook", value: "webhook" },
        ],
      },
      { key: "FEISHU_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔的用户 ID" },
      { key: "FEISHU_HOME_CHANNEL", label: "Home Chat", type: "text", placeholder: "cron/通知投递 chat_id" },
      { key: "FEISHU_ENCRYPT_KEY", label: "Encrypt Key", type: "password", placeholder: "Webhook 模式可选" },
      { key: "FEISHU_VERIFICATION_TOKEN", label: "Verification Token", type: "password", placeholder: "Webhook 模式可选" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.FEISHU_CONNECTION_MODE) {
        hints.push(`模式 ${env.FEISHU_CONNECTION_MODE}`);
      }
      if (env.FEISHU_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.FEISHU_HOME_CHANNEL)}`);
      }
      const allowedCount = splitCsv(env.FEISHU_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
  {
    id: "weixin",
    name: "微信",
    monogram: "微",
    description: "个人微信接入，适合高频私聊和点对点通知。",
    requiredKeys: ["WEIXIN_ACCOUNT_ID", "WEIXIN_TOKEN"],
    fields: [
      {
        key: "WEIXIN_DM_POLICY",
        label: "私聊策略",
        type: "select",
        options: [
          { label: "Pairing", value: "pairing" },
          { label: "开放", value: "open" },
          { label: "Allowlist", value: "allowlist" },
          { label: "禁用", value: "disabled" },
        ],
      },
      {
        key: "WEIXIN_GROUP_POLICY",
        label: "群聊策略",
        type: "select",
        options: [
          { label: "禁用", value: "disabled" },
          { label: "开放", value: "open" },
          { label: "Allowlist", value: "allowlist" },
        ],
      },
      { key: "WEIXIN_ALLOWED_USERS", label: "私聊 Allowlist", type: "text", placeholder: "逗号分隔用户 ID" },
      { key: "WEIXIN_GROUP_ALLOWED_USERS", label: "群聊 Allowlist", type: "text", placeholder: "逗号分隔群 ID" },
      { key: "WEIXIN_HOME_CHANNEL", label: "Home Channel", type: "text", placeholder: "cron/通知默认投递对象" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.WEIXIN_ACCOUNT_ID) {
        hints.push(`账号 ${trimMiddle(env.WEIXIN_ACCOUNT_ID)}`);
      }
      if (env.WEIXIN_DM_POLICY) {
        hints.push(`私聊 ${env.WEIXIN_DM_POLICY}`);
      }
      if (env.WEIXIN_GROUP_POLICY) {
        hints.push(`群聊 ${env.WEIXIN_GROUP_POLICY}`);
      }
      if (env.WEIXIN_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.WEIXIN_HOME_CHANNEL)}`);
      }
      return hints;
    },
  },
  {
    id: "telegram",
    name: "Telegram",
    monogram: "TG",
    description: "跨设备触达和个人 Bot 入口，适合通知与轻交互。",
    fields: [
      { key: "TELEGRAM_BOT_TOKEN", label: "Bot Token", type: "password", required: true, placeholder: "从 @BotFather 获取" },
      { key: "TELEGRAM_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔 user id" },
      { key: "TELEGRAM_HOME_CHANNEL", label: "Home Channel", type: "text", placeholder: "默认通知 chat_id" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.TELEGRAM_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.TELEGRAM_HOME_CHANNEL)}`);
      }
      const allowedCount = splitCsv(env.TELEGRAM_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
  {
    id: "discord",
    name: "Discord",
    monogram: "DC",
    description: "社区型协作场景，适合频道内问答和 slash command。",
    fields: [
      { key: "DISCORD_BOT_TOKEN", label: "Bot Token", type: "password", required: true, placeholder: "机器人令牌" },
      { key: "DISCORD_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔 user id 或用户名" },
      { key: "DISCORD_HOME_CHANNEL", label: "Home Channel", type: "text", placeholder: "默认通知 channel id" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.DISCORD_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.DISCORD_HOME_CHANNEL)}`);
      }
      const allowedCount = splitCsv(env.DISCORD_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
  {
    id: "slack",
    name: "Slack",
    monogram: "SL",
    description: "工作区协作和团队通知，适合和 cron 结果做投递闭环。",
    fields: [
      { key: "SLACK_BOT_TOKEN", label: "Bot Token", type: "password", required: true, placeholder: "xoxb-..." },
      { key: "SLACK_APP_TOKEN", label: "App Token", type: "password", required: true, placeholder: "xapp-..." },
      { key: "SLACK_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔 member id" },
      { key: "SLACK_HOME_CHANNEL", label: "Home Channel", type: "text", placeholder: "默认通知 channel id" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.SLACK_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.SLACK_HOME_CHANNEL)}`);
      }
      const allowedCount = splitCsv(env.SLACK_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
  {
    id: "signal",
    name: "Signal",
    monogram: "SG",
    description: "加密通讯场景，适合隐私优先的消息接入。",
    fields: [
      { key: "SIGNAL_HTTP_URL", label: "HTTP URL", type: "text", required: true, placeholder: "http://localhost:8080" },
      { key: "SIGNAL_ACCOUNT", label: "Account", type: "text", required: true, placeholder: "Signal 账号或手机号" },
      { key: "SIGNAL_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔" },
      { key: "SIGNAL_HOME_CHANNEL", label: "Home Channel", type: "text", placeholder: "默认通知接收者" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (env.SIGNAL_HOME_CHANNEL) {
        hints.push(`Home ${trimMiddle(env.SIGNAL_HOME_CHANNEL)}`);
      }
      const allowedCount = splitCsv(env.SIGNAL_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
  {
    id: "dingtalk",
    name: "钉钉",
    monogram: "钉",
    description: "适合企业内部告警和 bot 触达。",
    fields: [
      { key: "DINGTALK_CLIENT_ID", label: "Client ID", type: "text", required: true, placeholder: "应用 AppKey" },
      { key: "DINGTALK_CLIENT_SECRET", label: "Client Secret", type: "password", required: true, placeholder: "应用 AppSecret" },
    ],
    insights: () => [],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    monogram: "WA",
    description: "移动端触达能力强，但启用后仍需要外部配对/登录流程。",
    fields: [
      {
        key: "WHATSAPP_ENABLED",
        label: "启用",
        type: "toggle",
        required: true,
        helper: "启用后仍需要外部配对。",
      },
      {
        key: "WHATSAPP_MODE",
        label: "模式",
        type: "select",
        options: [
          { label: "Self Chat", value: "self-chat" },
          { label: "Bot", value: "bot" },
        ],
      },
      { key: "WHATSAPP_ALLOWED_USERS", label: "允许用户", type: "text", placeholder: "逗号分隔" },
    ],
    insights: (env) => {
      const hints: string[] = [];
      if (isToggleEnabled(env.WHATSAPP_ENABLED)) {
        hints.push("已启用");
      }
      if (env.WHATSAPP_MODE) {
        hints.push(`模式 ${env.WHATSAPP_MODE}`);
      }
      const allowedCount = splitCsv(env.WHATSAPP_ALLOWED_USERS).length;
      if (allowedCount > 0) {
        hints.push(`${allowedCount} 个授权用户`);
      }
      return hints;
    },
  },
];

function trimMiddle(value: string, max = 18) {
  if (value.length <= max) {
    return value;
  }

  const head = Math.max(4, Math.floor(max / 2) - 1);
  const tail = Math.max(4, max - head - 1);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function isToggleEnabled(value: string | null | undefined) {
  return TRUE_VALUES.has((value ?? "").trim().toLowerCase());
}

function keyHasValue(
  channel: ChannelDefinition,
  key: string,
  env: Record<string, string>,
) {
  const field = channel.fields.find((candidate) => candidate.key === key);
  const value = env[key];
  if (!value) {
    return false;
  }

  if (field?.type === "toggle") {
    return isToggleEnabled(value);
  }

  return Boolean(value.trim());
}

function isChannelEnvKey(key: string) {
  return CHANNEL_ENV_EXACT_KEYS.has(key) || CHANNEL_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function buildBackupFileName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
  return `backups/channels/channels-${stamp}.env`;
}

function getWeixinQrMessage(status: WeixinQrState["status"]) {
  switch (status) {
    case "scaned":
      return "已扫码，请在手机上确认。";
    case "scaned_but_redirect":
      return "处理中...";
    case "expired":
      return "二维码已过期。";
    case "confirmed":
      return "配置完成。";
    case "error":
      return "二维码获取失败。";
    default:
      return "请使用微信扫码。";
  }
}

function getWeixinQrValue(weixinQr: WeixinQrState) {
  return (weixinQr.qrUrl || weixinQr.qrcode).trim();
}

function getChannelConfigState(
  channel: ChannelDefinition,
  env: Record<string, string>,
): ChannelConfigState {
  const requiredKeys =
    channel.requiredKeys ??
    channel.fields.filter((field) => field.required).map((field) => field.key);
  const relevantKeys = new Set([
    ...channel.fields.map((field) => field.key),
    ...requiredKeys,
  ]);
  const requiredMatches = requiredKeys.filter((key) => keyHasValue(channel, key, env)).length;
  const hasAnyValue = Array.from(relevantKeys).some((key) => keyHasValue(channel, key, env));

  if (!hasAnyValue) {
    return "empty";
  }

  if (requiredMatches === requiredKeys.length) {
    return "configured";
  }

  return "partial";
}

function getConfigBadge(state: ChannelConfigState) {
  switch (state) {
    case "configured":
      return {
        label: "已配置",
        className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "partial":
      return {
        label: "待补全",
        className: "border border-amber-200 bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: "未配置",
        className: "border border-gray-200 bg-gray-50 text-gray-500",
      };
  }
}

function getRuntimeBadge(
  channelId: string,
  snapshot: HermesGatewayRuntimeSnapshot | null,
  gatewayRunning: boolean,
  configState: ChannelConfigState,
) {
  if (!gatewayRunning) {
    return {
      label: configState === "configured" ? "待启动" : "未接入",
      className:
        configState === "configured"
          ? "border border-amber-200 bg-amber-50 text-amber-700"
          : "border border-gray-200 bg-gray-50 text-gray-500",
    };
  }

  const runtimeState = snapshot?.platforms?.[channelId]?.state;
  if (!runtimeState) {
    return {
      label: configState === "configured" ? "未上报" : "未接入",
      className: "border border-gray-200 bg-gray-50 text-gray-500",
    };
  }

  if (runtimeState === "connected" || runtimeState === "ready") {
    return {
      label: "已连接",
      className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (runtimeState === "fatal" || runtimeState === "error") {
    return {
      label: "异常",
      className: "border border-red-200 bg-red-50 text-red-700",
    };
  }

  if (runtimeState === "starting" || runtimeState === "draining") {
    return {
      label: sentenceCaseState(runtimeState),
      className: "border border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: sentenceCaseState(runtimeState),
    className: "border border-amber-200 bg-amber-50 text-amber-700",
  };
}

function parseGatewaySummary(text: string): GatewaySummary {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const joined = lines.join("\n");
  const notRunning =
    /not loaded/i.test(joined) ||
    /not running/i.test(joined) ||
    /has not loaded/i.test(joined);
  const running = !notRunning && (/(running|loaded|active)/i.test(joined) || /✓/i.test(joined));

  if (running) {
    return {
      running: true,
      title: "Gateway 已运行",
      detail: "外部消息收发可用。",
    };
  }

  return {
    running: false,
    title: "Gateway 未运行",
    detail: "外部消息收发与定时任务当前不可用。",
  };
}

function buildInitialForms(env: Record<string, string>) {
  return Object.fromEntries(
    CHANNELS.map((channel) => [
      channel.id,
      Object.fromEntries(
        channel.fields.map((field) => {
          const fallback =
            field.type === "toggle"
              ? "false"
              : field.type === "select" && field.options && field.options.length > 0
                ? field.options[0].value
                : "";
          return [field.key, env[field.key] ?? fallback];
        }),
      ),
    ]),
  ) as Record<string, Record<string, string>>;
}

export default function Channels() {
  const [isLoading, setIsLoading] = useState(true);
  const [envContent, setEnvContent] = useState("");
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [gatewayStatusText, setGatewayStatusText] = useState("");
  const [gatewayRuntime, setGatewayRuntime] = useState<HermesGatewayRuntimeSnapshot | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeGatewayAction, setActiveGatewayAction] = useState<
    "start" | "stop" | "restart" | "refresh" | null
  >(null);
  const [savingChannelId, setSavingChannelId] = useState<string | null>(null);
  const [channelUtilityAction, setChannelUtilityAction] = useState<
    "reset" | "restore" | "weixin-qr" | null
  >(null);
  const [weixinQr, setWeixinQr] = useState<WeixinQrState | null>(null);
  const [weixinQrCodeDataUrl, setWeixinQrCodeDataUrl] = useState<string | null>(null);
  const [weixinQrCodeError, setWeixinQrCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  const loadData = async () => {
    setActiveGatewayAction((previous) => previous ?? "refresh");
    try {
      const [nextEnvContent, nextGatewayStatus, nextGatewayRuntime, nextBackups] = await Promise.all([
        readEnvFile().catch(() => ""),
        getGatewayStatus().catch(
          (error) => `无法读取网关状态：${error instanceof Error ? error.message : String(error)}`,
        ),
        getGatewayRuntimeSnapshot().catch(() => null),
        listConfigFiles("backups/channels").catch(() => []),
      ]);

      const nextEnvValues = parseEnvFile(nextEnvContent);
      setEnvContent(nextEnvContent);
      setEnvValues(nextEnvValues);
      setForms(buildInitialForms(nextEnvValues));
      setGatewayStatusText(nextGatewayStatus);
      setGatewayRuntime(nextGatewayRuntime);
      setBackupFiles([...nextBackups].sort().reverse());
    } finally {
      setIsLoading(false);
      setActiveGatewayAction(null);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const configuredCount = CHANNELS.filter(
    (channel) => getChannelConfigState(channel, envValues) === "configured",
  ).length;
  const connectedCount = CHANNELS.filter((channel) => {
    const runtimeState = gatewayRuntime?.platforms?.[channel.id]?.state;
    return runtimeState === "connected" || runtimeState === "ready";
  }).length;
  const latestBackup = backupFiles[0] ?? null;
  const gatewaySummary = parseGatewaySummary(gatewayStatusText);

  const updateField = (channelId: string, key: string, value: string) => {
    setForms((previous) => ({
      ...previous,
      [channelId]: {
        ...previous[channelId],
        [key]: value,
      },
    }));
  };

  useEffect(() => {
    if (!weixinQr) {
      return;
    }

    if (weixinQr.status === "expired" || weixinQr.status === "confirmed" || weixinQr.status === "error") {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await pollWeixinQrLogin(weixinQr.qrcode, weixinQr.baseUrl);
        if (cancelled) {
          return;
        }

        const nextStatus = (result.status || "wait") as WeixinQrState["status"];
        setWeixinQr((previous) =>
          previous && previous.qrcode === weixinQr.qrcode
            ? {
                ...previous,
                baseUrl: result.baseUrl || previous.baseUrl,
                status: nextStatus,
                message: getWeixinQrMessage(nextStatus),
                accountId: result.accountId ?? previous.accountId,
                userId: result.userId ?? previous.userId,
                homeChannel: result.homeChannel ?? previous.homeChannel,
              }
            : previous,
        );

        if (nextStatus === "confirmed") {
          setNotice({ tone: "success", text: "微信已配置完成。" });
          await loadData();
        } else if (nextStatus === "expired") {
          setNotice({ tone: "info", text: "微信二维码已过期，请重新获取。" });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setWeixinQr((previous) =>
          previous
            ? {
                ...previous,
                status: "error",
                message,
              }
            : previous,
        );
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 1800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [weixinQr?.qrcode, weixinQr?.baseUrl, weixinQr?.status]);

  useEffect(() => {
    if (!weixinQr) {
      setWeixinQrCodeDataUrl(null);
      setWeixinQrCodeError(null);
      return;
    }

    const value = getWeixinQrValue(weixinQr);
    if (!value) {
      setWeixinQrCodeDataUrl(null);
      setWeixinQrCodeError("二维码内容为空。");
      return;
    }

    let cancelled = false;
    setWeixinQrCodeDataUrl(null);
    setWeixinQrCodeError(null);

    void QRCode.toDataURL(value, {
      width: 560,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((nextDataUrl: string) => {
        if (!cancelled) {
          setWeixinQrCodeDataUrl(nextDataUrl);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWeixinQrCodeDataUrl(null);
          setWeixinQrCodeError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weixinQr?.qrUrl, weixinQr?.qrcode]);

  const backupAndResetChannels = async () => {
    setChannelUtilityAction("reset");
    setNotice(null);

    try {
      const backupPath = buildBackupFileName();
      const backupContent = envContent.endsWith("\n") ? envContent : `${envContent}\n`;
      await writeConfigFile(backupPath, backupContent);

      const updates = Object.fromEntries(
        Object.keys(envValues)
          .filter((key) => isChannelEnvKey(key))
          .map((key) => [key, null]),
      );
      const clearedContent = applyEnvUpdates(envContent, updates);
      await writeEnvFile(clearedContent);

      setWeixinQr(null);
      setExpandedId(null);
      setNotice({ tone: "success", text: `已备份并清空渠道配置：~/.hermes/${backupPath}` });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `清空失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setChannelUtilityAction(null);
    }
  };

  const restoreLatestBackup = async () => {
    if (!latestBackup) {
      return;
    }

    setChannelUtilityAction("restore");
    setNotice(null);

    try {
      const content = await readConfigFile(`backups/channels/${latestBackup}`);
      await writeEnvFile(content);
      setNotice({ tone: "success", text: "已恢复最近一次渠道备份。" });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `恢复失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setChannelUtilityAction(null);
    }
  };

  const startWeixinQrFlow = async () => {
    setChannelUtilityAction("weixin-qr");
    setNotice(null);

    try {
      const session = await startWeixinQrLogin();
      setExpandedId("weixin");
      setWeixinQr({
        ...session,
        status: "wait",
        message: getWeixinQrMessage("wait"),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: `二维码获取失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setChannelUtilityAction(null);
    }
  };

  const saveChannel = async (channel: ChannelDefinition) => {
    setSavingChannelId(channel.id);
    setNotice(null);

    try {
      const channelValues = forms[channel.id] ?? {};
      const updates = Object.fromEntries(
        channel.fields.map((field) => {
          const value = channelValues[field.key] ?? "";
          if (field.type === "toggle") {
            return [field.key, isToggleEnabled(value) ? "true" : "false"];
          }
          return [field.key, value.trim() || null];
        }),
      );

      const nextEnvContent = applyEnvUpdates(envContent, updates);
      await writeEnvFile(nextEnvContent);
      setNotice({ tone: "success", text: `${channel.name} 配置已保存。` });
      setExpandedId(null);
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${channel.name} 保存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setSavingChannelId(null);
    }
  };

  const runGatewayAction = async (action: "start" | "stop" | "restart") => {
    setActiveGatewayAction(action);
    setNotice(null);

    try {
      if (action === "start") {
        await startGateway();
        setNotice({ tone: "success", text: "已触发 Gateway 启动。" });
      } else if (action === "stop") {
        await stopGateway();
        setNotice({ tone: "info", text: "已触发 Gateway 停止。" });
      } else {
        await restartGateway();
        setNotice({ tone: "success", text: "已触发 Gateway 重启。" });
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text: `Gateway ${action} 失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      await loadData();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200/70 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">渠道</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
              {configuredCount} / {CHANNELS.length} 已配置
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
              {connectedCount} 已连接
            </span>
            {latestBackup && (
              <button
                type="button"
                onClick={() => void restoreLatestBackup()}
                disabled={channelUtilityAction !== null || activeGatewayAction !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                恢复备份
              </button>
            )}
            <button
              type="button"
              onClick={() => void backupAndResetChannels()}
              disabled={channelUtilityAction !== null || activeGatewayAction !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              备份并清空
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={activeGatewayAction !== null || channelUtilityAction !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-4 w-4 ${activeGatewayAction === "refresh" ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <section className="rounded-[24px] border border-gray-200 bg-white px-5 py-4 shadow-sm shadow-gray-100/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    gatewaySummary.running
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {gatewaySummary.running ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  )}
                  {gatewaySummary.title}
                </span>
                <span className="text-sm text-gray-600">{gatewaySummary.detail}</span>
                {gatewayRuntime?.updated_at && (
                  <span className="text-xs text-gray-400">
                    最近上报 {formatAbsoluteDateTime(gatewayRuntime.updated_at)}
                  </span>
                )}
                {latestBackup && (
                  <span className="text-xs text-gray-400">
                    最近备份 {latestBackup}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runGatewayAction("start")}
                  disabled={activeGatewayAction !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlayCircleIcon className="h-4 w-4" />
                  启动
                </button>
                <button
                  type="button"
                  onClick={() => void runGatewayAction("restart")}
                  disabled={activeGatewayAction !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PauseCircleIcon className="h-4 w-4" />
                  重启
                </button>
                <button
                  type="button"
                  onClick={() => void runGatewayAction("stop")}
                  disabled={activeGatewayAction !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <StopCircleIcon className="h-4 w-4" />
                  停止
                </button>
              </div>
            </div>
          </section>

          {notice && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                notice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : notice.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-sky-200 bg-sky-50 text-sky-700"
              }`}
            >
              {notice.text}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-8 text-sm text-gray-500">
              读取中...
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {CHANNELS.map((channel) => {
                const isExpanded = expandedId === channel.id;
                const configState = getChannelConfigState(channel, envValues);
                const configBadge = getConfigBadge(configState);
                const runtimeBadge = getRuntimeBadge(
                  channel.id,
                  gatewayRuntime,
                  gatewaySummary.running,
                  configState,
                );
                const highlights = channel.insights(envValues);

                return (
                  <section
                    key={channel.id}
                    className={`rounded-[26px] border bg-white p-4 shadow-sm shadow-gray-100/70 transition ${
                      isExpanded ? "border-orange-200" : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : channel.id)}
                      className="flex w-full items-start justify-between gap-4 text-left"
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-sm font-semibold text-orange-600">
                          {channel.monogram}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-gray-900">{channel.name}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${configBadge.className}`}>
                              {configBadge.label}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${runtimeBadge.className}`}>
                              {runtimeBadge.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-gray-500">{channel.description}</p>
                          {highlights.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {highlights.map((hint) => (
                                <span
                                  key={hint}
                                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                                >
                                  {hint}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <ChevronRightIcon
                        className={`mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          {channel.id === "weixin" && (
                            <div className="md:col-span-2 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">扫码配置</div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {envValues.WEIXIN_ACCOUNT_ID
                                      ? `当前账号 ${trimMiddle(envValues.WEIXIN_ACCOUNT_ID)}`
                                      : "未配置"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void startWeixinQrFlow()}
                                  disabled={channelUtilityAction === "weixin-qr"}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {channelUtilityAction === "weixin-qr" ? (
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <PlayCircleIcon className="h-4 w-4" />
                                  )}
                                  {envValues.WEIXIN_ACCOUNT_ID ? "重新扫码" : "开始扫码"}
                                </button>
                              </div>
                            </div>
                          )}
                          {channel.fields.map((field) => {
                            const value = forms[channel.id]?.[field.key] ?? "";
                            const label = (
                              <div className="mb-1.5 flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-600">{field.label}</span>
                                {field.required && (
                                  <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
                                    必填
                                  </span>
                                )}
                              </div>
                            );

                            if (field.type === "toggle") {
                              return (
                                <div key={field.key} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                                  {label}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateField(
                                        channel.id,
                                        field.key,
                                        isToggleEnabled(value) ? "false" : "true",
                                      )
                                    }
                                    className={`relative mt-1 inline-flex h-7 w-12 items-center rounded-full transition ${
                                      isToggleEnabled(value) ? "bg-orange-500" : "bg-gray-300"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                                        isToggleEnabled(value) ? "translate-x-6" : "translate-x-1"
                                      }`}
                                    />
                                  </button>
                                  {field.helper && (
                                    <p className="mt-2 text-xs leading-5 text-gray-500">{field.helper}</p>
                                  )}
                                </div>
                              );
                            }

                            if (field.type === "select") {
                              return (
                                <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                                  {label}
                                  <select
                                    value={value}
                                    onChange={(event) => updateField(channel.id, field.key, event.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  >
                                    {(field.options ?? []).map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  {field.helper && (
                                    <p className="mt-2 text-xs leading-5 text-gray-500">{field.helper}</p>
                                  )}
                                </label>
                              );
                            }

                            return (
                              <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                                {label}
                                <input
                                  type={field.type}
                                  value={value}
                                  onChange={(event) => updateField(channel.id, field.key, event.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                />
                                {field.helper && (
                                  <p className="mt-2 text-xs leading-5 text-gray-500">{field.helper}</p>
                                )}
                              </label>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-gray-400">
                            运行态快照：
                            {gatewayRuntime?.platforms?.[channel.id]?.updated_at
                              ? ` ${formatAbsoluteDateTime(gatewayRuntime.platforms[channel.id]?.updated_at ?? null)}`
                              : " 暂无上报"}
                          </div>
                          <button
                            type="button"
                            onClick={() => void saveChannel(channel)}
                            disabled={savingChannelId === channel.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingChannelId === channel.id ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                            保存配置
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {weixinQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/20 px-4 backdrop-blur-sm"
          onClick={() => setWeixinQr(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[32px] border border-orange-100/70 bg-white shadow-[0_24px_80px_rgba(249,115,22,0.16)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-orange-100/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98)_62%)] px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-500">Weixin</p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">微信扫码</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWeixinQr(null)}
                  className="rounded-full border border-orange-100 bg-white/90 p-2 text-gray-400 transition hover:border-orange-200 hover:text-gray-600"
                >
                  <ChevronRightIcon className="h-4 w-4 rotate-45" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    weixinQr.status === "confirmed"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : weixinQr.status === "expired" || weixinQr.status === "error"
                        ? "border border-red-200 bg-red-50 text-red-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {weixinQr.message}
                </span>
                {weixinQr.accountId && (
                  <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs text-gray-600">
                    账号 {trimMiddle(weixinQr.accountId)}
                  </span>
                )}
                {weixinQr.homeChannel && (
                  <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs text-gray-600">
                    Home {trimMiddle(weixinQr.homeChannel)}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,247,237,0.95)_0%,rgba(255,255,255,0.98)_70%)] p-4">
                <div className="rounded-[24px] border border-orange-100/80 bg-white p-5 shadow-[0_16px_48px_rgba(249,115,22,0.12)]">
                  {weixinQrCodeDataUrl ? (
                    <img
                      src={weixinQrCodeDataUrl}
                      alt="微信扫码二维码"
                      className="mx-auto aspect-square w-full max-w-[288px] rounded-[20px] bg-white"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-[20px] border border-dashed border-orange-200 bg-orange-50/70 px-6 text-center text-sm leading-6 text-gray-500">
                      {weixinQrCodeError ? `二维码渲染失败：${weixinQrCodeError}` : "二维码生成中..."}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-gray-100 bg-gray-50/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                  <span>状态</span>
                  <span className="font-medium text-gray-900">{weixinQr.message}</span>
                </div>
                {weixinQr.userId && (
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-gray-500">
                    <span>用户</span>
                    <span className="font-medium text-gray-700">{trimMiddle(weixinQr.userId)}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                {(weixinQr.status === "expired" || weixinQr.status === "error") && (
                  <button
                    type="button"
                    onClick={() => void startWeixinQrFlow()}
                    disabled={channelUtilityAction === "weixin-qr"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${channelUtilityAction === "weixin-qr" ? "animate-spin" : ""}`} />
                    重新获取
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setWeixinQr(null)}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300"
                >
                  {weixinQr.status === "confirmed" ? "完成" : "关闭"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
