import { FormEvent, useEffect, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  deleteConfigFile,
  getSkillsInventory,
  HermesSkillInventoryItem,
  HermesSkillsInventory,
  installSkill,
  pruneSkillFromConfig,
  setSkillEnabled,
  writeConfigFile,
} from "../api/hermes";

type SkillsFilter = "all" | "enabled" | "disabled" | "bundled" | "local" | "external";
type NoticeTone = "success" | "error" | "info";

function sourceBadge(source: HermesSkillInventoryItem["source"]) {
  switch (source) {
    case "bundled":
      return {
        label: "内置",
        className: "border border-sky-200 bg-sky-50 text-sky-700",
      };
    case "external":
      return {
        label: "外部",
        className: "border border-violet-200 bg-violet-50 text-violet-700",
      };
    default:
      return {
        label: "本地",
        className: "border border-gray-200 bg-gray-50 text-gray-600",
      };
  }
}

function trimTag(tag: string) {
  return tag.length > 16 ? `${tag.slice(0, 15)}…` : tag;
}

function canDeleteSkill(skill: HermesSkillInventoryItem) {
  return skill.source === "local" && Boolean(skill.configPath);
}

function categoryLabel(skill: HermesSkillInventoryItem) {
  return skill.category || "uncategorized";
}

export default function Skills() {
  const [inventory, setInventory] = useState<HermesSkillsInventory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeFilter, setActiveFilter] = useState<SkillsFilter>("all");
  const [installTarget, setInstallTarget] = useState("");
  const [busySkillName, setBusySkillName] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "refresh" | "install" | "toggle" | "delete" | null
  >(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  const loadInventory = async () => {
    setActiveAction((previous) => previous ?? "refresh");
    try {
      const nextInventory = await getSkillsInventory();
      setInventory(nextInventory);
    } catch (error) {
      setNotice({
        tone: "error",
        text: `读取技能库存失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const disabledSet = new Set(inventory?.disabled ?? []);
  const allSkills = inventory?.items ?? [];
  const categories = ["全部", ...new Set(allSkills.map((skill) => categoryLabel(skill)))];
  const enabledCount = allSkills.filter((skill) => !disabledSet.has(skill.name)).length;
  const localCount = allSkills.filter((skill) => skill.source === "local").length;
  const bundledCount = allSkills.filter((skill) => skill.source === "bundled").length;
  const externalCount = allSkills.filter((skill) => skill.source === "external").length;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSkills = allSkills.filter((skill) => {
    const matchSearch =
      !normalizedSearch ||
      skill.name.toLowerCase().includes(normalizedSearch) ||
      skill.description.toLowerCase().includes(normalizedSearch) ||
      skill.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

    const matchCategory =
      activeCategory === "全部" || categoryLabel(skill) === activeCategory;

    const isDisabled = disabledSet.has(skill.name);
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "enabled" && !isDisabled) ||
      (activeFilter === "disabled" && isDisabled) ||
      (activeFilter === "bundled" && skill.source === "bundled") ||
      (activeFilter === "local" && skill.source === "local") ||
      (activeFilter === "external" && skill.source === "external");

    return matchSearch && matchCategory && matchFilter;
  });

  const toggleSkill = async (skill: HermesSkillInventoryItem) => {
    const willEnable = disabledSet.has(skill.name);
    setBusySkillName(skill.name);
    setActiveAction("toggle");
    setNotice(null);

    try {
      await setSkillEnabled(skill.name, willEnable);
      setNotice({
        tone: "success",
        text: willEnable ? `已启用 ${skill.name}` : `已禁用 ${skill.name}`,
      });
      await loadInventory();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${skill.name} 切换失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusySkillName(null);
      setActiveAction(null);
    }
  };

  const removeSkill = async (skill: HermesSkillInventoryItem) => {
    if (!skill.configPath) {
      return;
    }

    setBusySkillName(skill.name);
    setActiveAction("delete");
    setNotice(null);

    try {
      await deleteConfigFile(skill.configPath);
      await pruneSkillFromConfig(skill.name);
      setNotice({ tone: "success", text: `已移除 ${skill.name}` });
      await loadInventory();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `${skill.name} 删除失败：${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setBusySkillName(null);
      setActiveAction(null);
    }
  };

  const submitInstall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = installTarget.trim();
    if (!target) {
      return;
    }

    setActiveAction("install");
    setNotice(null);

    try {
      // Hermes hub commands expect the directory to exist; desktop can create it directly.
      await writeConfigFile("skills/.hub/.keep", "");
      const output = await installSkill(target);
      setInstallTarget("");
      setNotice({
        tone: "success",
        text: output.trim() || `已触发安装：${target}`,
      });
      await loadInventory();
    } catch (error) {
      setNotice({
        tone: "error",
        text: `安装失败：${error instanceof Error ? error.message : String(error)}`,
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
            <h2 className="text-lg font-semibold text-gray-900">技能</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadInventory()}
            disabled={activeAction !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${activeAction === "refresh" ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.95fr)]">
            <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm shadow-gray-100/70">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    已启用
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                    {enabledCount}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">当前启用的技能。</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    本地扩展
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                    {localCount}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">可直接在桌面端删除或保留。</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    内置 / 外部
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                    {bundledCount + externalCount}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    内置 {bundledCount}，外部 {externalCount}。
                  </p>
                </div>
              </div>

              {inventory && Object.keys(inventory.platformDisabled).length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  检测到平台级技能禁用覆盖。当前页面先管理全局开关，不覆盖按平台细分的配置。
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm shadow-gray-100/70">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900">安装技能</h3>
                </div>
              </div>

              <form onSubmit={submitInstall} className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    技能来源
                  </span>
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={installTarget}
                      onChange={(event) => setInstallTarget(event.target.value)}
                      placeholder="例如：github-pr-workflow / github.com/xxx/skill"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-9 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={activeAction === "install" || !installTarget.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeAction === "install" ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  )}
                  安装技能
                </button>
              </form>
            </section>
          </div>

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

          <section className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-100/70">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-[280px] flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索技能名称、描述、标签"
                  className="w-full rounded-full border border-gray-200 bg-gray-50 px-9 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "全部" },
                  { key: "enabled", label: "已启用" },
                  { key: "disabled", label: "已禁用" },
                  { key: "bundled", label: "内置" },
                  { key: "local", label: "本地" },
                  { key: "external", label: "外部" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveFilter(item.key as SkillsFilter)}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      activeFilter === item.key
                        ? "bg-orange-500 text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activeCategory === category
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          {isLoading ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-8 text-sm text-gray-500">
              读取中...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="rounded-[28px] border border-gray-200 bg-white p-10 text-center">
              <div className="text-sm font-semibold text-gray-900">没有匹配结果</div>
              <p className="mt-2 text-sm text-gray-500">
                当前筛选条件下没有可展示的技能。
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredSkills.map((skill) => {
                const isDisabled = disabledSet.has(skill.name);
                const badge = sourceBadge(skill.source);
                const isBusy = busySkillName === skill.name;

                return (
                  <section
                    key={skill.name}
                    className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-100/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">{skill.name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              isDisabled
                                ? "border border-amber-200 bg-amber-50 text-amber-700"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isDisabled ? "已禁用" : "已启用"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{skill.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                        {categoryLabel(skill)}
                      </span>
                      {skill.version && (
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                          v{skill.version}
                        </span>
                      )}
                      {skill.platforms.map((platform) => (
                        <span
                          key={`${skill.name}-${platform}`}
                          className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-sky-700"
                        >
                          {platform}
                        </span>
                      ))}
                      {skill.tags.slice(0, 4).map((tag) => (
                        <span
                          key={`${skill.name}-${tag}`}
                          className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-700"
                        >
                          {trimTag(tag)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                      <div className="min-w-0 text-xs text-gray-400">{skill.location}</div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleSkill(skill)}
                          disabled={isBusy}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            isDisabled
                              ? "bg-orange-500 text-white hover:bg-orange-600"
                              : "border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600"
                          }`}
                        >
                          {isBusy && activeAction === "toggle" ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : isDisabled ? (
                            <CheckCircleIcon className="h-4 w-4" />
                          ) : (
                            <XCircleIcon className="h-4 w-4" />
                          )}
                          {isDisabled ? "启用" : "禁用"}
                        </button>

                        {canDeleteSkill(skill) && (
                          <button
                            type="button"
                            onClick={() => void removeSkill(skill)}
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
                        )}
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
