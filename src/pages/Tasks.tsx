import { FormEvent, useEffect, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  createCronJob,
  deleteCronJob,
  getCronStatus,
  getSkillsInventory,
  HermesSkillInventoryItem,
  pauseCronJob,
  readConfigFile,
  resumeCronJob,
  runCronJob,
  startGateway,
} from "../api/hermes";
import {
  formatAbsoluteDateTime,
  formatRelativeDateTime,
  sentenceCaseState,
  splitCsv,
} from "../lib/hermes-helpers";

type NoticeTone = "success" | "error" | "info";

interface CronRepeat {
  times?: number | null;
  completed?: number;
}

interface CronSchedule {
  kind?: string;
  minutes?: number;
  display?: string;
}

interface CronJobRecord {
  id: string;
  name?: string | null;
  prompt?: string | null;
  skills?: string[];
  skill?: string | null;
  schedule?: CronSchedule;
  schedule_display?: string | null;
  repeat?: CronRepeat;
  enabled?: boolean;
  state?: string | null;
  created_at?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  deliver?: string | null;
}

interface CronJobsDocument {
  jobs: CronJobRecord[];
  updated_at?: string | null;
}

interface CronStatusSummary {
  running: boolean;
  detail: string;
  activeJobs: number | null;
  nextRun: string | null;
}

const SCHEDULE_PRESETS = [
  { label: "每 30 分钟", value: "30m" },
  { label: "每 2 小时", value: "every 2h" },
  { label: "每天 09:00", value: "0 9 * * *" },
  { label: "工作日 18:00", value: "0 18 * * 1-5" },
  { label: "周一 10:00", value: "0 10 * * 1" },
  { label: "每天 22:30", value: "30 22 * * *" },
];

function parseCronJobs(raw: string): CronJobsDocument {
  try {
    const parsed = JSON.parse(raw) as CronJobsDocument;
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      updated_at: parsed.updated_at ?? null,
    };
  } catch {
    return { jobs: [] };
  }
}

function parseCronStatus(text: string): CronStatusSummary {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const activeJobsMatch = normalized.match(/(\d+)\s+active job/i);
  const nextRunMatch = normalized.match(/Next run:\s*(.+)$/im);
  const notRunning = /not running/i.test(normalized);
  const running = !notRunning && /running/i.test(normalized);
  let detail = "暂无状态信息";

  if (normalized.startsWith("无法读取 cron 状态")) {
    detail = normalized;
  } else if (running) {
    detail = "调度器可正常触发任务。";
  } else if (notRunning) {
    detail = "定时任务当前不会自动触发。";
  }

  return {
    running,
    detail,
    activeJobs: activeJobsMatch ? Number(activeJobsMatch[1]) : null,
    nextRun: nextRunMatch ? nextRunMatch[1].trim() : null,
  };
}

function isPaused(job: CronJobRecord) {
  return job.enabled === false || job.state === "paused";
}

function jobSkills(job: CronJobRecord) {
  const skills = [...(job.skills ?? [])];
  if (job.skill && !skills.includes(job.skill)) {
    skills.push(job.skill);
  }
  return skills;
}

function previewPrompt(prompt: string | null | undefined) {
  if (!prompt) {
    return "未填写执行提示词。";
  }

  const compact = prompt.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 159)}…` : compact;
}

function jobStateBadge(job: CronJobRecord) {
  if (job.last_error) {
    return {
      label: "执行异常",
      className: "border border-red-200 bg-red-50 text-red-700",
    };
  }

  if (isPaused(job)) {
    return {
      label: "已暂停",
      className: "border border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (job.state === "scheduled" || job.state === "running") {
    return {
      label: "运行中",
      className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: sentenceCaseState(job.state),
    className: "border border-gray-200 bg-gray-50 text-gray-600",
  };
}

export default function Tasks() {
  const [jobsDocument, setJobsDocument] = useState<CronJobsDocument>({ jobs: [] });
  const [cronStatusText, setCronStatusText] = useState("");
  const [skills, setSkills] = useState<HermesSkillInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "refresh" | "create" | "pause" | "resume" | "run" | "delete" | "gateway" | null
  >(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [newTask, setNewTask] = useState({
    name: "",
    schedule: "",
    prompt: "",
    deliver: "origin",
    skillsText: "",
  });

  const loadTasks = async () => {
    setActiveAction((previous) => previous ?? "refresh");
    try {
      const [rawJobs, statusText, inventory] = await Promise.all([
        readConfigFile("cron/jobs.json").catch(() => '{"jobs": []}'),
        getCronStatus().catch(
          (error) => `无法读取 cron 状态：${error instanceof Error ? error.message : String(error)}`,
        ),
        getSkillsInventory().catch(() => null),
      ]);

      setJobsDocument(parseCronJobs(rawJobs));
      setCronStatusText(statusText);
      setSkills((inventory?.items ?? []).filter((skill) => !inventory?.disabled.includes(skill.name)));
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const cronStatus = parseCronStatus(cronStatusText);
  const activeJobsCount =
    jobsDocument.jobs.filter((job) => !isPaused(job) && !job.last_error).length;
  const skillSuggestions = skills.slice(0, 12);

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTask.name.trim() || !newTask.schedule.trim() || !newTask.prompt.trim()) {
      return;
    }

    setActiveAction("create");
    setNotice(null);

    try {
      const attachedSkills = splitCsv(newTask.skillsText);
      const output = await createCronJob({
        name: newTask.name.trim(),
        schedule: newTask.schedule.trim(),
        prompt: newTask.prompt.trim(),
        deliver: newTask.deliver.trim() || undefined,
        skills: attachedSkills,
      });

      setNotice({
        tone: "success",
        text: output.trim() || `已创建任务 ${newTask.name.trim()}`,
      });
      setNewTask({
        name: "",
        schedule: "",
        prompt: "",
        deliver: "origin",
        skillsText: "",
      });
      setShowCreateForm(false);
      await loadTasks();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `创建任务失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setActiveAction(null);
    }
  };

  const toggleJob = async (job: CronJobRecord) => {
    const shouldResume = isPaused(job);
    setBusyJobId(job.id);
    setActiveAction(shouldResume ? "resume" : "pause");
    setNotice(null);

    try {
      const output = shouldResume ? await resumeCronJob(job.id) : await pauseCronJob(job.id);
      setNotice({
        tone: "success",
        text: output.trim() || `${job.name || job.id} 已${shouldResume ? "恢复" : "暂停"}`,
      });
      await loadTasks();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${job.name || job.id} 操作失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusyJobId(null);
      setActiveAction(null);
    }
  };

  const runJobNow = async (job: CronJobRecord) => {
    setBusyJobId(job.id);
    setActiveAction("run");
    setNotice(null);

    try {
      const output = await runCronJob(job.id);
      setNotice({
        tone: "success",
        text: output.trim() || `已触发 ${job.name || job.id} 在下一次 tick 执行`,
      });
      await loadTasks();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${job.name || job.id} 触发失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusyJobId(null);
      setActiveAction(null);
    }
  };

  const removeJob = async (job: CronJobRecord) => {
    if (!window.confirm(`确认删除任务「${job.name || job.id}」？`)) {
      return;
    }

    setBusyJobId(job.id);
    setActiveAction("delete");
    setNotice(null);

    try {
      const output = await deleteCronJob(job.id);
      setNotice({
        tone: "success",
        text: output.trim() || `已删除任务 ${job.name || job.id}`,
      });
      await loadTasks();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${job.name || job.id} 删除失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusyJobId(null);
      setActiveAction(null);
    }
  };

  const ensureGateway = async () => {
    setActiveAction("gateway");
    setNotice(null);

    try {
      const output = await startGateway();
      setNotice({
        tone: "success",
        text: output.trim() || "已触发 Gateway 启动，cron 调度恢复后会自动生效。",
      });
      await loadTasks();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `启动 Gateway 失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200/70 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">任务</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm((previous) => !previous)}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
            >
              {showCreateForm ? <XMarkIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {showCreateForm ? "收起" : "新建任务"}
            </button>
            <button
              type="button"
              onClick={() => void loadTasks()}
              disabled={activeAction !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon className={`h-4 w-4 ${activeAction === "refresh" ? "animate-spin" : ""}`} />
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
                    cronStatus.running
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <ClockIcon className="h-4 w-4" />
                  {cronStatus.running ? "调度器运行中" : "调度器未运行"}
                </span>
                <span className="text-sm text-gray-600">{cronStatus.detail}</span>
                {cronStatus.nextRun && (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                    下次 {formatAbsoluteDateTime(cronStatus.nextRun)} · {formatRelativeDateTime(cronStatus.nextRun)}
                  </span>
                )}
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  运行中 {activeJobsCount}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  总数 {jobsDocument.jobs.length}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  刷新 {formatAbsoluteDateTime(jobsDocument.updated_at ?? null)}
                </span>
              </div>

              {!cronStatus.running && (
                <button
                  type="button"
                  onClick={() => void ensureGateway()}
                  disabled={activeAction === "gateway"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeAction === "gateway" ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircleIcon className="h-4 w-4" />
                  )}
                  启动 Gateway
                </button>
              )}
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

          {showCreateForm && (
            <section className="rounded-[28px] border border-orange-200 bg-white p-5 shadow-sm shadow-orange-100/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">新建任务</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-gray-300 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={createTask} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">任务名称</span>
                  <input
                    type="text"
                    value={newTask.name}
                    onChange={(event) =>
                      setNewTask((previous) => ({ ...previous, name: event.target.value }))
                    }
                    placeholder="例如：PR 监控播报"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    执行计划
                  </span>
                  <input
                    type="text"
                    value={newTask.schedule}
                    onChange={(event) =>
                      setNewTask((previous) => ({ ...previous, schedule: event.target.value }))
                    }
                    placeholder="30m / every 2h / 0 9 * * *"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SCHEDULE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          setNewTask((previous) => ({ ...previous, schedule: preset.value }))
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          newTask.schedule === preset.value
                            ? "bg-orange-500 text-white"
                            : "border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3 md:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    执行提示词
                  </span>
                  <textarea
                    value={newTask.prompt}
                    onChange={(event) =>
                      setNewTask((previous) => ({ ...previous, prompt: event.target.value }))
                    }
                    rows={4}
                    placeholder="描述这个任务每次运行时要完成什么。"
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    Deliver 目标
                  </span>
                  <input
                    type="text"
                    value={newTask.deliver}
                    onChange={(event) =>
                      setNewTask((previous) => ({ ...previous, deliver: event.target.value }))
                    }
                    placeholder="origin / local / telegram / feishu:chat_id"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="block rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    附加技能
                  </span>
                  <input
                    type="text"
                    value={newTask.skillsText}
                    onChange={(event) =>
                      setNewTask((previous) => ({ ...previous, skillsText: event.target.value }))
                    }
                    placeholder="逗号分隔，例如 github-pr-workflow, code"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  {skillSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skillSuggestions.map((skill) => (
                        <button
                          key={skill.name}
                          type="button"
                          onClick={() => {
                            const next = new Set(splitCsv(newTask.skillsText));
                            next.add(skill.name);
                            setNewTask((previous) => ({
                              ...previous,
                              skillsText: Array.from(next).join(", "),
                            }));
                          }}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-orange-200 hover:text-orange-600"
                        >
                          {skill.name}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={
                      activeAction === "create" ||
                      !newTask.name.trim() ||
                      !newTask.schedule.trim() ||
                      !newTask.prompt.trim()
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {activeAction === "create" ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircleIcon className="h-4 w-4" />
                    )}
                    创建任务
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300"
                  >
                    取消
                  </button>
                </div>
              </form>
            </section>
          )}

          {isLoading ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-8 text-sm text-gray-500">
              读取中...
            </div>
          ) : jobsDocument.jobs.length === 0 ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-10 text-center">
              <div className="text-sm font-semibold text-gray-900">当前没有定时任务</div>
              <p className="mt-2 text-sm text-gray-500">点击右上角新建任务。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobsDocument.jobs.map((job) => {
                const badge = jobStateBadge(job);
                const attachedSkills = jobSkills(job);
                const isBusy = busyJobId === job.id;

                return (
                  <section
                    key={job.id}
                    className="rounded-[26px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-100/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {job.name || job.id}
                          </h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                            {job.schedule_display || job.schedule?.display || "未命名计划"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-gray-600">
                          {previewPrompt(job.prompt)}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                            下次 {formatAbsoluteDateTime(job.next_run_at)} · {formatRelativeDateTime(job.next_run_at)}
                          </span>
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                            上次 {formatAbsoluteDateTime(job.last_run_at)}
                          </span>
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                            投递 {job.deliver || "origin"}
                          </span>
                          {attachedSkills.map((skill) => (
                            <span
                              key={`${job.id}-${skill}`}
                              className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        {job.last_error && (
                          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            最近错误：{job.last_error}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void runJobNow(job)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy && activeAction === "run" ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircleIcon className="h-4 w-4" />
                          )}
                          立即运行
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleJob(job)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy && (activeAction === "pause" || activeAction === "resume") ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <PauseCircleIcon className="h-4 w-4" />
                          )}
                          {isPaused(job) ? "恢复" : "暂停"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeJob(job)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy && activeAction === "delete" ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <TrashIcon className="h-4 w-4" />
                          )}
                          删除
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
