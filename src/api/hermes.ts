/**
 * hermes.ts - Tauri command wrappers for hermes-agent integration
 * 
 * These functions call the Rust backend which executes hermes CLI commands
 * and reads/writes files in ~/.hermes/
 */

import { invoke } from '@tauri-apps/api/core';

export interface CommandCheckResult {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface HermesStatusResult {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface ChatMessageResult {
  content: string;
  sessionId: string | null;
}

export interface HermesGatewayPlatformRuntime {
  state?: string;
  updated_at?: string | null;
  error_message?: string | null;
  [key: string]: unknown;
}

export interface HermesGatewayRuntimeSnapshot {
  pid?: number | null;
  gateway_state?: string | null;
  exit_reason?: string | null;
  restart_requested?: boolean;
  active_agents?: number;
  updated_at?: string | null;
  platforms?: Record<string, HermesGatewayPlatformRuntime>;
  [key: string]: unknown;
}

export interface HermesSkillInventoryItem {
  name: string;
  description: string;
  category: string | null;
  version: string | null;
  tags: string[];
  platforms: string[];
  location: string;
  configPath: string | null;
  source: 'bundled' | 'local' | 'external';
}

export interface HermesSkillsInventory {
  disabled: string[];
  platformDisabled: Record<string, string[]>;
  items: HermesSkillInventoryItem[];
}

export interface HermesSettingsModelConfig {
  default: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
}

export interface HermesSettingsAgentConfig {
  reasoningEffort: string;
  maxTurns: number;
  gatewayTimeout: number;
}

export interface HermesSettingsDisplayConfig {
  personality: string;
  personalities: string[];
  showReasoning: boolean;
  streaming: boolean;
  showCost: boolean;
  interimAssistantMessages: boolean;
  toolProgress: string;
  backgroundProcessNotifications: string;
  resumeDisplay: string;
  busyInputMode: string;
}

export interface HermesSettingsApprovalsConfig {
  mode: string;
  timeout: number;
}

export interface HermesSettingsVoiceConfig {
  autoTts: boolean;
  recordKey: string;
  maxRecordingSeconds: number;
  silenceThreshold: number;
  silenceDuration: number;
}

export interface HermesSettingsSttConfig {
  enabled: boolean;
  provider: string;
  localModel: string;
  language: string;
}

export interface HermesSettingsMemoryConfig {
  memoryEnabled: boolean;
  userProfileEnabled: boolean;
  nudgeInterval: number;
  flushMinTurns: number;
}

export interface HermesSettingsCounts {
  sessions: number;
  skills: number;
  memories: number;
  backups: number;
  logs: number;
}

export interface HermesSettingsFiles {
  hermesHome: string;
  configPath: string;
  soulPath: string;
  envPath: string;
}

export interface HermesSettingsSnapshot {
  model: HermesSettingsModelConfig;
  agent: HermesSettingsAgentConfig;
  display: HermesSettingsDisplayConfig;
  approvals: HermesSettingsApprovalsConfig;
  voice: HermesSettingsVoiceConfig;
  stt: HermesSettingsSttConfig;
  memory: HermesSettingsMemoryConfig;
  counts: HermesSettingsCounts;
  files: HermesSettingsFiles;
}

export interface HermesSettingsUpdateInput {
  model?: Partial<HermesSettingsModelConfig>;
  agent?: Partial<HermesSettingsAgentConfig>;
  display?: Partial<Omit<HermesSettingsDisplayConfig, 'personalities'>>;
  approvals?: Partial<HermesSettingsApprovalsConfig>;
  voice?: Partial<HermesSettingsVoiceConfig>;
  stt?: Partial<HermesSettingsSttConfig>;
  memory?: Partial<HermesSettingsMemoryConfig>;
}

export interface WeixinQrSession {
  qrcode: string;
  qrUrl: string;
  baseUrl: string;
}

export interface WeixinQrPollResult {
  status: string;
  baseUrl: string;
  accountId?: string;
  userId?: string;
  homeChannel?: string;
}

export interface CreateCronJobInput {
  schedule: string;
  prompt?: string;
  name?: string;
  deliver?: string;
  skills?: string[];
  repeat?: number;
  scriptPath?: string;
}

// ========================================
// CLI Commands
// ========================================

/**
 * Run a hermes CLI command
 * @param args - Command arguments (e.g., ['chat', 'hello'])
 * @returns Command stdout
 */
export async function runHermesCommand(args: string[]): Promise<string> {
  return invoke<string>('run_hermes_command', { args });
}

/**
 * Run the Python interpreter that backs the Hermes CLI.
 * Useful for non-interactive access to Hermes' own config helpers.
 */
export async function runHermesPython(args: string[]): Promise<string> {
  return invoke<string>('run_hermes_python', { args });
}

/**
 * Check if hermes is installed
 */
export async function checkHermesInstalled(): Promise<boolean> {
  return invoke<boolean>('check_hermes_installed');
}

/**
 * Get hermes installation details.
 */
export async function getHermesStatus(): Promise<HermesStatusResult> {
  return invoke<HermesStatusResult>('get_hermes_status');
}

/**
 * Get hermes version
 */
export async function getHermesVersion(): Promise<string> {
  return invoke<string>('get_hermes_version');
}

// ========================================
// File Operations
// ========================================

/**
 * Read a file from ~/.hermes/
 * @param path - Relative path within ~/.hermes/ (e.g., 'config.yaml')
 */
export async function readConfigFile(path: string): Promise<string> {
  return invoke<string>('read_config_file', { path });
}

/**
 * Write a file to ~/.hermes/
 * @param path - Relative path within ~/.hermes/
 * @param content - File content
 */
export async function writeConfigFile(path: string, content: string): Promise<void> {
  return invoke('write_config_file', { path, content });
}

/**
 * List files in a directory under ~/.hermes/
 * @param path - Relative directory path (e.g., 'sessions')
 */
export async function listConfigFiles(path: string): Promise<string[]> {
  return invoke<string[]>('list_config_files', { path });
}

/**
 * Check if a file exists in ~/.hermes/
 * @param path - Relative path
 */
export async function configFileExists(path: string): Promise<boolean> {
  return invoke<boolean>('config_file_exists', { path });
}

/**
 * Delete a file or directory in ~/.hermes/
 * @param path - Relative path
 */
export async function deleteConfigFile(path: string): Promise<void> {
  return invoke('delete_config_file', { path });
}

/**
 * Run a shell command
 * @param command - Command to run
 * @param args - Command arguments
 */
export async function runShellCommand(command: string, args: string[]): Promise<string> {
  return invoke<string>('run_shell_command', { command, args });
}

/**
 * Check if a command exists and get its version using the Rust backend.
 * @param command - Command to check (e.g., 'git', 'python3', 'node')
 * @returns Install details and resolved path
 */
export async function checkCommand(command: string): Promise<CommandCheckResult> {
  return invoke<CommandCheckResult>('check_command', { command });
}

/**
 * Check if a command exists and get its version.
 * @param command - Command to check (e.g., 'git', 'python3', 'node')
 * @returns Version string or null if not found
 */
export async function checkCommandVersion(command: string): Promise<string | null> {
  const result = await checkCommand(command);
  return result.version;
}

/**
 * Check if hermes CLI is installed
 * @returns true if hermes is found
 */
export async function checkHermesInstalledShell(): Promise<boolean> {
  const result = await getHermesStatus();
  return result.installed;
}

// ========================================
// High-level hermes functions
// ========================================

/**
 * Send a chat message to hermes
 * @param message - The message to send
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
): Promise<ChatMessageResult> {
  const args = ['chat', '-Q', '-q', message, '--source', 'desktop'];

  if (sessionId) {
    args.push('--resume', sessionId);
  }

  const output = await runHermesCommand(args);
  return parseChatMessageResult(output);
}

/**
 * Get gateway status
 */
export async function getGatewayStatus(): Promise<string> {
  return runHermesCommand(['gateway', 'status']);
}

/**
 * Start the gateway
 */
export async function startGateway(): Promise<string> {
  return runHermesCommand(['gateway', 'start']);
}

/**
 * Stop the gateway
 */
export async function stopGateway(): Promise<string> {
  return runHermesCommand(['gateway', 'stop']);
}

/**
 * Restart the gateway
 */
export async function restartGateway(): Promise<string> {
  return runHermesCommand(['gateway', 'restart']);
}

/**
 * List skills
 */
export async function listSkills(): Promise<string> {
  return runHermesCommand(['skills', 'list']);
}

/**
 * Install a skill
 * @param skillName - Name or URL of the skill
 */
export async function installSkill(skillName: string): Promise<string> {
  return runHermesCommand(['skills', 'install', skillName]);
}

/**
 * Enable a skill
 * @param skillName - Name of the skill
 */
export async function enableSkill(skillName: string): Promise<string> {
  await setSkillEnabled(skillName, true);
  return `Enabled ${skillName}`;
}

/**
 * Disable a skill
 * @param skillName - Name of the skill
 */
export async function disableSkill(skillName: string): Promise<string> {
  await setSkillEnabled(skillName, false);
  return `Disabled ${skillName}`;
}

/**
 * Uninstall a hub-installed skill.
 */
export async function uninstallSkill(skillName: string): Promise<string> {
  return runHermesCommand(['skills', 'uninstall', skillName]);
}

/**
 * List cron jobs
 */
export async function listCronJobs(): Promise<string> {
  return runHermesCommand(['cron', 'list']);
}

/**
 * Create a cron job
 * @param input - Cron job definition
 */
export async function createCronJob(input: CreateCronJobInput): Promise<string> {
  const args = ['cron', 'create'];

  if (input.name?.trim()) {
    args.push('--name', input.name.trim());
  }

  if (input.deliver?.trim()) {
    args.push('--deliver', input.deliver.trim());
  }

  if (typeof input.repeat === 'number' && Number.isFinite(input.repeat)) {
    args.push('--repeat', String(input.repeat));
  }

  for (const skill of input.skills ?? []) {
    if (skill.trim()) {
      args.push('--skill', skill.trim());
    }
  }

  if (input.scriptPath?.trim()) {
    args.push('--script', input.scriptPath.trim());
  }

  args.push(input.schedule);

  if (input.prompt?.trim()) {
    args.push(input.prompt.trim());
  }

  return runHermesCommand(args);
}

/**
 * Pause a cron job
 * @param jobId - ID of the job
 */
export async function pauseCronJob(jobId: string): Promise<string> {
  return runHermesCommand(['cron', 'pause', jobId]);
}

/**
 * Resume a cron job
 * @param jobId - ID of the job
 */
export async function resumeCronJob(jobId: string): Promise<string> {
  return runHermesCommand(['cron', 'resume', jobId]);
}

/**
 * Delete a cron job
 * @param jobId - ID of the job
 */
export async function deleteCronJob(jobId: string): Promise<string> {
  return runHermesCommand(['cron', 'remove', jobId]);
}

/**
 * Trigger a cron job on the next scheduler tick
 * @param jobId - ID of the job
 */
export async function runCronJob(jobId: string): Promise<string> {
  return runHermesCommand(['cron', 'run', jobId]);
}

/**
 * Get cron scheduler status
 */
export async function getCronStatus(): Promise<string> {
  return runHermesCommand(['cron', 'status']);
}

// ========================================
// Config helpers
// ========================================

/**
 * Read the main config file
 */
export async function readMainConfig(): Promise<string> {
  return readConfigFile('config.yaml');
}

/**
 * Write the main config file
 * @param content - YAML content
 */
export async function writeMainConfig(content: string): Promise<void> {
  return writeConfigFile('config.yaml', content);
}

/**
 * Read the .env file
 */
export async function readEnvFile(): Promise<string> {
  return readConfigFile('.env');
}

/**
 * Write the .env file
 * @param content - Env file content
 */
export async function writeEnvFile(content: string): Promise<void> {
  return writeConfigFile('.env', content);
}

/**
 * Read the SOUL.md file
 */
export async function readSoulFile(): Promise<string> {
  return readConfigFile('SOUL.md');
}

/**
 * Write the SOUL.md file
 * @param content - Markdown content
 */
export async function writeSoulFile(content: string): Promise<void> {
  return writeConfigFile('SOUL.md', content);
}

/**
 * List session files
 */
export async function listSessions(): Promise<string[]> {
  return listConfigFiles('sessions');
}

/**
 * Read a session file
 * @param sessionId - Session ID/filename
 */
export async function readSession(sessionId: string): Promise<string> {
  return readConfigFile(`sessions/${sessionId}`);
}

/**
 * List installed skills
 */
export async function listInstalledSkills(): Promise<string[]> {
  return listConfigFiles('skills');
}

const GATEWAY_RUNTIME_SCRIPT = String.raw`
from gateway.status import read_runtime_status
import json

print(json.dumps(read_runtime_status() or {}, ensure_ascii=False))
`;

const SKILLS_INVENTORY_SCRIPT = String.raw`
from pathlib import Path
import json

from hermes_cli.config import load_config
from tools.skills_tool import SKILLS_DIR, _parse_frontmatter, skill_matches_platform
from agent.skill_utils import get_external_skills_dirs

EXCLUDED = {".git", ".github", ".hub"}

def parse_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    parts = []
    for raw in text.split(","):
        item = raw.strip().strip("\"'")
        if item:
            parts.append(item)
    return parts

def skill_category(skill_md: Path, scan_dir: Path, frontmatter):
    category = frontmatter.get("category")
    if category:
        return str(category).strip()
    try:
        rel_parts = skill_md.relative_to(scan_dir).parts
    except Exception:
        return None
    return rel_parts[0] if len(rel_parts) >= 3 else None

bundled = set()
manifest = SKILLS_DIR / ".bundled_manifest"
if manifest.exists():
    for raw_line in manifest.read_text(encoding="utf-8").splitlines():
        name, _, _ = raw_line.partition(":")
        if name.strip():
            bundled.add(name.strip())

config = load_config() or {}
skills_cfg = config.get("skills", {}) or {}
items = []
seen = set()

dirs_to_scan = []
if SKILLS_DIR.exists():
    dirs_to_scan.append(SKILLS_DIR)
dirs_to_scan.extend(get_external_skills_dirs())

for scan_dir in dirs_to_scan:
    scan_path = Path(scan_dir)
    if not scan_path.exists():
        continue
    for skill_md in scan_path.rglob("SKILL.md"):
        if any(part in EXCLUDED for part in skill_md.parts):
            continue
        try:
            content = skill_md.read_text(encoding="utf-8")
            frontmatter, body = _parse_frontmatter(content)
        except Exception:
            continue

        if not skill_matches_platform(frontmatter):
            continue

        name = str(frontmatter.get("name") or skill_md.parent.name).strip()[:64]
        if not name or name in seen:
            continue

        description = str(frontmatter.get("description") or "").strip()
        if not description:
            for raw_line in body.splitlines():
                line = raw_line.strip()
                if line and not line.startswith("#"):
                    description = line
                    break

        version = frontmatter.get("version")
        location = None
        config_path = None
        source = "external"

        try:
            rel_dir = skill_md.parent.relative_to(SKILLS_DIR)
            location = f"~/.hermes/skills/{rel_dir.as_posix()}"
            config_path = f"skills/{rel_dir.as_posix()}"
            source = "bundled" if name in bundled else "local"
        except Exception:
            location = str(skill_md.parent)

        seen.add(name)
        items.append({
            "name": name,
            "description": description,
            "category": skill_category(skill_md, scan_path, frontmatter),
            "version": str(version).strip() if version else None,
            "tags": parse_list(frontmatter.get("tags")),
            "platforms": parse_list(frontmatter.get("platforms")),
            "location": location,
            "configPath": config_path,
            "source": source,
        })

items.sort(key=lambda item: ((item.get("category") or ""), item["name"]))
print(json.dumps({
    "disabled": skills_cfg.get("disabled", []),
    "platformDisabled": skills_cfg.get("platform_disabled", {}),
    "items": items,
}, ensure_ascii=False))
`;

const SET_SKILL_ENABLED_SCRIPT = String.raw`
import json
import sys

from agent.prompt_builder import clear_skills_system_prompt_cache
from hermes_cli.config import load_config, save_config

name = sys.argv[1]
enabled = sys.argv[2] == "1"
platform = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

config = load_config() or {}
skills_cfg = config.setdefault("skills", {})

if platform:
    platform_disabled = skills_cfg.setdefault("platform_disabled", {})
    current = set(platform_disabled.get(platform, skills_cfg.get("disabled", [])))
    if enabled:
        current.discard(name)
    else:
        current.add(name)
    platform_disabled[platform] = sorted(current)
else:
    current = set(skills_cfg.get("disabled", []))
    if enabled:
        current.discard(name)
    else:
        current.add(name)
    skills_cfg["disabled"] = sorted(current)

save_config(config)
clear_skills_system_prompt_cache(clear_snapshot=True)
print(json.dumps({"ok": True}, ensure_ascii=False))
`;

const PRUNE_SKILL_CONFIG_SCRIPT = String.raw`
import json
import sys

from agent.prompt_builder import clear_skills_system_prompt_cache
from hermes_cli.config import load_config, save_config

name = sys.argv[1]
config = load_config() or {}
skills_cfg = config.setdefault("skills", {})

skills_cfg["disabled"] = [item for item in skills_cfg.get("disabled", []) if item != name]
platform_disabled = skills_cfg.get("platform_disabled", {}) or {}
cleaned = {}
for platform, values in platform_disabled.items():
    remaining = [item for item in values if item != name]
    if remaining:
        cleaned[platform] = remaining
skills_cfg["platform_disabled"] = cleaned

save_config(config)
clear_skills_system_prompt_cache(clear_snapshot=True)
print(json.dumps({"ok": True}, ensure_ascii=False))
`;

const SETTINGS_SNAPSHOT_SCRIPT = String.raw`
import json
from pathlib import Path

from hermes_cli.config import get_config_path, get_env_path, get_hermes_home, load_config

def as_dict(value):
    return value if isinstance(value, dict) else {}

def as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)

def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default

def as_str(value, default=""):
    if value is None:
        return default
    return str(value)

def count_children(path, *, dirs_only=False, suffix=None):
    if not path.exists() or not path.is_dir():
        return 0
    total = 0
    for child in path.iterdir():
        if child.name.startswith("."):
            continue
        if dirs_only and not child.is_dir():
            continue
        if suffix and child.suffix != suffix:
            continue
        total += 1
    return total

config = load_config() or {}
model_cfg = as_dict(config.get("model"))
agent_cfg = as_dict(config.get("agent"))
display_cfg = as_dict(config.get("display"))
approvals_cfg = as_dict(config.get("approvals"))
voice_cfg = as_dict(config.get("voice"))
stt_cfg = as_dict(config.get("stt"))
stt_local_cfg = as_dict(stt_cfg.get("local"))
memory_cfg = as_dict(config.get("memory"))

personality_options = set()
for source in (as_dict(agent_cfg.get("personalities")), as_dict(config.get("personalities"))):
    personality_options.update(as_str(name).strip() for name in source.keys() if as_str(name).strip())

current_personality = as_str(display_cfg.get("personality"), "helpful").strip() or "helpful"
personality_options.add(current_personality)

home = Path(get_hermes_home())

snapshot = {
    "model": {
        "default": as_str(model_cfg.get("default")),
        "provider": as_str(model_cfg.get("provider"), "custom"),
        "baseUrl": as_str(model_cfg.get("base_url")),
        "apiKey": as_str(model_cfg.get("api_key")),
    },
    "agent": {
        "reasoningEffort": as_str(agent_cfg.get("reasoning_effort"), "medium"),
        "maxTurns": as_int(agent_cfg.get("max_turns"), 90),
        "gatewayTimeout": as_int(agent_cfg.get("gateway_timeout"), 1800),
    },
    "display": {
        "personality": current_personality,
        "personalities": sorted(personality_options),
        "showReasoning": as_bool(display_cfg.get("show_reasoning")),
        "streaming": as_bool(display_cfg.get("streaming")),
        "showCost": as_bool(display_cfg.get("show_cost")),
        "interimAssistantMessages": as_bool(display_cfg.get("interim_assistant_messages")),
        "toolProgress": "off" if display_cfg.get("tool_progress") is False else as_str(display_cfg.get("tool_progress"), "all"),
        "backgroundProcessNotifications": "off" if display_cfg.get("background_process_notifications") is False else as_str(display_cfg.get("background_process_notifications"), "all"),
        "resumeDisplay": as_str(display_cfg.get("resume_display"), "full"),
        "busyInputMode": as_str(display_cfg.get("busy_input_mode"), "interrupt"),
    },
    "approvals": {
        "mode": "off" if approvals_cfg.get("mode") is False else as_str(approvals_cfg.get("mode"), "manual"),
        "timeout": as_int(approvals_cfg.get("timeout"), 60),
    },
    "voice": {
        "autoTts": as_bool(voice_cfg.get("auto_tts")),
        "recordKey": as_str(voice_cfg.get("record_key"), "ctrl+b"),
        "maxRecordingSeconds": as_int(voice_cfg.get("max_recording_seconds"), 120),
        "silenceThreshold": as_int(voice_cfg.get("silence_threshold"), 200),
        "silenceDuration": as_int(voice_cfg.get("silence_duration"), 3),
    },
    "stt": {
        "enabled": as_bool(stt_cfg.get("enabled")),
        "provider": as_str(stt_cfg.get("provider"), "local"),
        "localModel": as_str(stt_local_cfg.get("model"), "base"),
        "language": as_str(stt_local_cfg.get("language")),
    },
    "memory": {
        "memoryEnabled": as_bool(memory_cfg.get("memory_enabled")),
        "userProfileEnabled": as_bool(memory_cfg.get("user_profile_enabled")),
        "nudgeInterval": as_int(memory_cfg.get("nudge_interval"), 10),
        "flushMinTurns": as_int(memory_cfg.get("flush_min_turns"), 6),
    },
    "counts": {
        "sessions": count_children(home / "sessions", suffix=".json"),
        "skills": count_children(home / "skills", dirs_only=True),
        "memories": count_children(home / "memories"),
        "backups": count_children(home / "backups" / "channels", suffix=".env"),
        "logs": count_children(home / "logs", suffix=".log"),
    },
    "files": {
        "hermesHome": str(home),
        "configPath": str(get_config_path()),
        "soulPath": str(home / "SOUL.md"),
        "envPath": str(get_env_path()),
    },
}

print(json.dumps(snapshot, ensure_ascii=False))
`;

const SETTINGS_UPDATE_SCRIPT = String.raw`
import json
import sys

from hermes_cli.config import load_config, save_config

payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else {}

def as_dict(value):
    return value if isinstance(value, dict) else {}

def ensure_dict(root, key):
    current = root.get(key)
    if not isinstance(current, dict):
        current = {}
        root[key] = current
    return current

def normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)

def normalize_int(value, default):
    try:
        return int(value)
    except Exception:
        return default

def write_fields(target, source, mapping):
    for source_key, (target_key, normalizer) in mapping.items():
        if source_key in source:
            target[target_key] = normalizer(source[source_key]) if normalizer else source[source_key]

config = load_config() or {}

model_payload = as_dict(payload.get("model"))
if model_payload:
    model_cfg = ensure_dict(config, "model")
    write_fields(model_cfg, model_payload, {
        "default": ("default", str),
        "provider": ("provider", str),
        "baseUrl": ("base_url", str),
        "apiKey": ("api_key", str),
    })

agent_payload = as_dict(payload.get("agent"))
if agent_payload:
    agent_cfg = ensure_dict(config, "agent")
    write_fields(agent_cfg, agent_payload, {
        "reasoningEffort": ("reasoning_effort", str),
        "maxTurns": ("max_turns", lambda value: normalize_int(value, 90)),
        "gatewayTimeout": ("gateway_timeout", lambda value: normalize_int(value, 1800)),
    })

display_payload = as_dict(payload.get("display"))
if display_payload:
    display_cfg = ensure_dict(config, "display")
    write_fields(display_cfg, display_payload, {
        "personality": ("personality", str),
        "showReasoning": ("show_reasoning", normalize_bool),
        "streaming": ("streaming", normalize_bool),
        "showCost": ("show_cost", normalize_bool),
        "interimAssistantMessages": ("interim_assistant_messages", normalize_bool),
        "toolProgress": ("tool_progress", str),
        "backgroundProcessNotifications": ("background_process_notifications", str),
        "resumeDisplay": ("resume_display", str),
        "busyInputMode": ("busy_input_mode", str),
    })

approvals_payload = as_dict(payload.get("approvals"))
if approvals_payload:
    approvals_cfg = ensure_dict(config, "approvals")
    write_fields(approvals_cfg, approvals_payload, {
        "mode": ("mode", str),
        "timeout": ("timeout", lambda value: normalize_int(value, 60)),
    })

voice_payload = as_dict(payload.get("voice"))
if voice_payload:
    voice_cfg = ensure_dict(config, "voice")
    write_fields(voice_cfg, voice_payload, {
        "autoTts": ("auto_tts", normalize_bool),
        "recordKey": ("record_key", str),
        "maxRecordingSeconds": ("max_recording_seconds", lambda value: normalize_int(value, 120)),
        "silenceThreshold": ("silence_threshold", lambda value: normalize_int(value, 200)),
        "silenceDuration": ("silence_duration", float),
    })

stt_payload = as_dict(payload.get("stt"))
if stt_payload:
    stt_cfg = ensure_dict(config, "stt")
    write_fields(stt_cfg, stt_payload, {
        "enabled": ("enabled", normalize_bool),
        "provider": ("provider", str),
    })
    if "localModel" in stt_payload or "language" in stt_payload:
        local_cfg = ensure_dict(stt_cfg, "local")
        write_fields(local_cfg, stt_payload, {
            "localModel": ("model", str),
            "language": ("language", str),
        })

memory_payload = as_dict(payload.get("memory"))
if memory_payload:
    memory_cfg = ensure_dict(config, "memory")
    write_fields(memory_cfg, memory_payload, {
        "memoryEnabled": ("memory_enabled", normalize_bool),
        "userProfileEnabled": ("user_profile_enabled", normalize_bool),
        "nudgeInterval": ("nudge_interval", lambda value: normalize_int(value, 10)),
        "flushMinTurns": ("flush_min_turns", lambda value: normalize_int(value, 6)),
    })

save_config(config)
print(json.dumps({"ok": True}, ensure_ascii=False))
`;

const VALIDATE_CONFIG_SCRIPT = String.raw`
import json
import sys

import yaml

yaml.safe_load(sys.argv[1] if len(sys.argv) > 1 else "")
print(json.dumps({"ok": True}, ensure_ascii=False))
`;

const WEIXIN_QR_START_SCRIPT = String.raw`
import asyncio
import json

import aiohttp

from gateway.platforms.weixin import (
    EP_GET_BOT_QR,
    ILINK_BASE_URL,
    QR_TIMEOUT_MS,
    _api_get,
    check_weixin_requirements,
)

async def main():
    if not check_weixin_requirements():
        raise RuntimeError("Weixin dependencies are unavailable")

    async with aiohttp.ClientSession() as session:
        data = await _api_get(
            session,
            base_url=ILINK_BASE_URL,
            endpoint=f"{EP_GET_BOT_QR}?bot_type=3",
            timeout_ms=QR_TIMEOUT_MS,
        )

    qrcode = str(data.get("qrcode") or "")
    qr_url = str(data.get("qrcode_img_content") or "")
    if not qrcode or not qr_url:
        raise RuntimeError("Failed to fetch Weixin QR code")

    print(json.dumps({
        "qrcode": qrcode,
        "qrUrl": qr_url,
        "baseUrl": ILINK_BASE_URL,
    }, ensure_ascii=False))

asyncio.run(main())
`;

const WEIXIN_QR_POLL_SCRIPT = String.raw`
import asyncio
import json
import sys

import aiohttp

from gateway.platforms.weixin import (
    EP_GET_QR_STATUS,
    ILINK_BASE_URL,
    QR_TIMEOUT_MS,
    WEIXIN_CDN_BASE_URL,
    _api_get,
    save_weixin_account,
)
from hermes_cli.config import get_env_value, get_hermes_home, save_env_value

qrcode = sys.argv[1]
base_url = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else ILINK_BASE_URL

async def main():
    async with aiohttp.ClientSession() as session:
        data = await _api_get(
            session,
            base_url=base_url,
            endpoint=f"{EP_GET_QR_STATUS}?qrcode={qrcode}",
            timeout_ms=QR_TIMEOUT_MS,
        )

    status = str(data.get("status") or "wait")
    payload = {
        "status": status,
        "baseUrl": base_url,
    }

    if status == "scaned_but_redirect":
        redirect_host = str(data.get("redirect_host") or "")
        if redirect_host:
            payload["baseUrl"] = f"https://{redirect_host}"
    elif status == "confirmed":
        account_id = str(data.get("ilink_bot_id") or "")
        token = str(data.get("bot_token") or "")
        resolved_base_url = str(data.get("baseurl") or base_url)
        user_id = str(data.get("ilink_user_id") or "")

        if not account_id or not token:
            raise RuntimeError("Weixin credential payload is incomplete")

        save_weixin_account(
            str(get_hermes_home()),
            account_id=account_id,
            token=token,
            base_url=resolved_base_url,
            user_id=user_id,
        )

        dm_policy = get_env_value("WEIXIN_DM_POLICY") or "open"
        allow_all = get_env_value("WEIXIN_ALLOW_ALL_USERS")
        group_policy = get_env_value("WEIXIN_GROUP_POLICY") or "disabled"
        home_channel = get_env_value("WEIXIN_HOME_CHANNEL") or user_id

        save_env_value("WEIXIN_ACCOUNT_ID", account_id)
        save_env_value("WEIXIN_TOKEN", token)
        save_env_value("WEIXIN_BASE_URL", resolved_base_url)
        save_env_value("WEIXIN_CDN_BASE_URL", get_env_value("WEIXIN_CDN_BASE_URL") or WEIXIN_CDN_BASE_URL)
        save_env_value("WEIXIN_DM_POLICY", dm_policy)
        save_env_value("WEIXIN_ALLOW_ALL_USERS", allow_all or ("true" if dm_policy == "open" else "false"))
        save_env_value("WEIXIN_ALLOWED_USERS", get_env_value("WEIXIN_ALLOWED_USERS") or "")
        save_env_value("WEIXIN_GROUP_POLICY", group_policy)
        save_env_value("WEIXIN_GROUP_ALLOWED_USERS", get_env_value("WEIXIN_GROUP_ALLOWED_USERS") or "")
        if home_channel:
            save_env_value("WEIXIN_HOME_CHANNEL", home_channel)

        payload.update({
            "baseUrl": resolved_base_url,
            "accountId": account_id,
            "userId": user_id,
            "homeChannel": home_channel,
        })

    print(json.dumps(payload, ensure_ascii=False))

asyncio.run(main())
`;

async function runHermesPythonJson<T>(script: string, argv: string[] = []): Promise<T> {
  const output = await runHermesPython(['-c', script, ...argv]);
  return JSON.parse(output) as T;
}

/**
 * Get the persisted gateway runtime snapshot.
 */
export async function getGatewayRuntimeSnapshot(): Promise<HermesGatewayRuntimeSnapshot> {
  return runHermesPythonJson<HermesGatewayRuntimeSnapshot>(GATEWAY_RUNTIME_SCRIPT);
}

/**
 * Get the installed skills inventory and skill-disable configuration.
 */
export async function getSkillsInventory(): Promise<HermesSkillsInventory> {
  return runHermesPythonJson<HermesSkillsInventory>(SKILLS_INVENTORY_SCRIPT);
}

/**
 * Enable or disable a skill using Hermes' own config writer.
 */
export async function setSkillEnabled(
  skillName: string,
  enabled: boolean,
  platform?: string | null,
): Promise<void> {
  await runHermesPythonJson(SET_SKILL_ENABLED_SCRIPT, [
    skillName,
    enabled ? '1' : '0',
    platform ?? '',
  ]);
}

/**
 * Remove a skill from disabled lists after uninstall/deletion.
 */
export async function pruneSkillFromConfig(skillName: string): Promise<void> {
  await runHermesPythonJson(PRUNE_SKILL_CONFIG_SCRIPT, [skillName]);
}

/**
 * Get a curated snapshot of Hermes global settings backed by config.yaml.
 */
export async function getHermesSettingsSnapshot(): Promise<HermesSettingsSnapshot> {
  return runHermesPythonJson<HermesSettingsSnapshot>(SETTINGS_SNAPSHOT_SCRIPT);
}

/**
 * Persist global Hermes settings through Hermes' own config writer.
 */
export async function updateHermesSettingsSnapshot(
  input: HermesSettingsUpdateInput,
): Promise<void> {
  await runHermesPythonJson(SETTINGS_UPDATE_SCRIPT, [JSON.stringify(input)]);
}

/**
 * Validate raw config.yaml text using YAML parsing before saving.
 */
export async function validateMainConfig(content: string): Promise<void> {
  await runHermesPythonJson(VALIDATE_CONFIG_SCRIPT, [content]);
}

/**
 * Start a Weixin QR login session.
 */
export async function startWeixinQrLogin(): Promise<WeixinQrSession> {
  return runHermesPythonJson<WeixinQrSession>(WEIXIN_QR_START_SCRIPT);
}

/**
 * Poll the Weixin QR login session and persist credentials when confirmed.
 */
export async function pollWeixinQrLogin(
  qrcode: string,
  baseUrl?: string | null,
): Promise<WeixinQrPollResult> {
  return runHermesPythonJson<WeixinQrPollResult>(WEIXIN_QR_POLL_SCRIPT, [
    qrcode,
    baseUrl ?? '',
  ]);
}

function parseChatMessageResult(output: string): ChatMessageResult {
  const normalized = output.replace(/\r\n/g, '\n').trimEnd();
  const lines = normalized.split('\n');

  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }

  let sessionId: string | null = null;
  const lastLine = lines[lines.length - 1]?.trim() || '';

  if (lastLine.toLowerCase().startsWith('session_id:')) {
    sessionId = lastLine.slice('session_id:'.length).trim() || null;
    lines.pop();
    while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
      lines.pop();
    }
  }

  const content = lines.join('\n').trim() || normalized.trim();

  return {
    content,
    sessionId,
  };
}
