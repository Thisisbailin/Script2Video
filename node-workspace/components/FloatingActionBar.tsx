import React, { useRef, useState } from "react";
import {
  Plus,
  Play,
  User,
  Projector,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Video,
  SquareStack,
  BoxSelect,
  Library,
  ChevronRight,
  ChevronsRight,
  Layers,
  FolderOpen,
  FileText,
  List,
  BarChart2,
  BookOpen,
  Palette,
  FileCode,
  RefreshCw,
  Info,
  Sun,
  Moon,
  Trash2,
  LogOut,
  Upload,
  Share,
  Users,
  MapPin,
} from "lucide-react";
import { WorkflowTemplate } from "../types";
import type { ModuleKey } from "./ModuleBar";

type AccountInfo = {
  isLoaded: boolean;
  isSignedIn: boolean;
  name?: string;
  email?: string;
  avatarUrl?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onUploadAvatar?: () => void;
};

type Props = {
  onAddText: () => void;
  onAddImage: () => void;
  onAddImageGen: () => void;
  onAddWanImageGen: () => void;
  onAddVideoGen: () => void;
  onAddWanVideoGen: () => void;
  onAddGroup: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportCsv?: () => void;
  onExportXls?: () => void;
  onExportUnderstandingJson?: () => void;
  onRun: () => void;
  templates: WorkflowTemplate[];
  canCreateTemplate: boolean;
  onCreateTemplate: () => void;
  onLoadTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  floating?: boolean;
  onOpenModule?: (key: ModuleKey) => void;
  onOpenStats?: () => void;
  onToggleTheme?: () => void;
  isDarkMode?: boolean;
  onOpenSyncPanel?: () => void;
  onOpenInfoPanel?: () => void;
  onResetProject?: () => void;
  onSignOut?: () => void;
  accountInfo?: AccountInfo;
  onTryMe?: () => void;
  onToggleWorkflow?: (anchorRect?: DOMRect) => void;
  onAssetLoad?: (
    type:
      | "script"
      | "globalStyleGuide"
      | "shotGuide"
      | "soraGuide"
      | "storyboardGuide"
      | "dramaGuide"
      | "csvShots"
      | "understandingJson",
    content: string,
    fileName?: string
  ) => void;
};

export const FloatingActionBar: React.FC<Props> = ({
  onAddText,
  onAddImage,
  onAddImageGen,
  onAddWanImageGen,
  onAddVideoGen,
  onAddWanVideoGen,
  onAddGroup,
  onImport,
  onExport,
  onExportCsv,
  onExportXls,
  onExportUnderstandingJson,
  onRun,
  templates,
  canCreateTemplate,
  onCreateTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  floating = true,
  onOpenModule,
  onOpenStats,
  onToggleTheme,
  isDarkMode,
  onOpenSyncPanel,
  onOpenInfoPanel,
  onResetProject,
  onSignOut,
  accountInfo,
  onTryMe,
  onToggleWorkflow,
  onAssetLoad,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showWip, setShowWip] = useState(false);
  const [ioPane, setIoPane] = useState<"project" | "guides" | "export">("project");
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const understandingInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);
  const storyboardGuideInputRef = useRef<HTMLInputElement>(null);
  const dramaGuideInputRef = useRef<HTMLInputElement>(null);
  const workflowButtonRef = useRef<HTMLButtonElement>(null);
  const rootClass = floating ? "fixed bottom-4 right-4 z-30" : "relative z-30";
  const panelClass = "rounded-3xl app-panel overflow-hidden";
  const panelStyle: React.CSSProperties = {
    backgroundColor: "var(--app-panel)",
    borderColor: "var(--app-border)",
    boxShadow: "var(--app-shadow)",
  };
  const sectionEyebrowClass =
    "text-[10px] font-black uppercase tracking-[0.24em] text-[var(--app-text-secondary)]";
  const sectionCardClass =
    "rounded-[26px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4";
  const utilityButtonClass =
    "group flex min-h-[60px] items-center gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-left transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] active:translate-y-px";
  const docButtonClass =
    "group w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-left transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:text-[var(--app-text-muted)] disabled:hover:border-[var(--app-border)] disabled:hover:bg-[var(--app-panel-muted)]";
  const compactTabClass =
    "inline-flex h-8 items-center justify-center rounded-full border px-3 text-[11px] font-semibold transition active:translate-y-px";

  const nodeActions = [
    { label: "Text", hint: "Draft prompts, notes, and structure", meta: "Writing", onClick: onAddText, Icon: MessageSquare, tone: "text-sky-300", surface: "bg-sky-500/12" },
    { label: "Group", hint: "Frame a reusable block of nodes", meta: "Layout", onClick: onAddGroup, Icon: BoxSelect, tone: "text-amber-300", surface: "bg-amber-500/12" },
    { label: "Image", hint: "Upload a reference image or still", meta: "Input", onClick: onAddImage, Icon: ImageIcon, tone: "text-emerald-300", surface: "bg-emerald-500/12" },
    { label: "Img Gen", hint: "Generate concept imagery", meta: "Generation", onClick: onAddImageGen, Icon: Sparkles, tone: "text-cyan-300", surface: "bg-cyan-500/12" },
    { label: "WAN Img", hint: "Wan 2.6 image workflow", meta: "Generation", onClick: onAddWanImageGen, Icon: Sparkles, tone: "text-teal-300", surface: "bg-teal-500/12" },
    { label: "Sora Video", hint: "Build Sora motion clips", meta: "Motion", onClick: onAddVideoGen, Icon: Video, tone: "text-rose-300", surface: "bg-rose-500/12" },
    { label: "WAN Vid", hint: "Wan 2.6 video workflow", meta: "Motion", onClick: onAddWanVideoGen, Icon: Video, tone: "text-violet-300", surface: "bg-violet-500/12" },
  ];
  const projectModules = [
    { key: "assets" as ModuleKey, label: "Assets", desc: "资产与设定", Icon: FolderOpen, tone: "text-emerald-300", surface: "bg-emerald-500/10" },
    { key: "script" as ModuleKey, label: "Script", desc: "剧本与解析", Icon: FileText, tone: "text-sky-300", surface: "bg-sky-500/10" },
    { key: "shots" as ModuleKey, label: "Shots", desc: "分镜与镜头", Icon: List, tone: "text-amber-300", surface: "bg-amber-500/10" },
    { key: "characters" as ModuleKey, label: "Characters", desc: "Character Library", Icon: Users, tone: "text-emerald-200", surface: "bg-emerald-500/10" },
    { key: "scenes" as ModuleKey, label: "Scenes", desc: "Scene Library", Icon: MapPin, tone: "text-cyan-200", surface: "bg-cyan-500/10" },
    { key: "understanding" as ModuleKey, label: "理解", desc: "理解快照", Icon: BookOpen, tone: "text-yellow-200", surface: "bg-yellow-500/10" },
    { key: "materials" as ModuleKey, label: "素材", desc: "生成素材库", Icon: Sparkles, tone: "text-blue-200", surface: "bg-blue-500/10" },
    { key: "projector" as ModuleKey, label: "放映机", desc: "视听实验室", Icon: Projector, tone: "text-rose-300", surface: "bg-rose-500/10" },
  ];

  const accountLoaded = accountInfo?.isLoaded ?? true;
  const accountSignedIn = accountLoaded && !!accountInfo?.isSignedIn;
  const accountName = accountInfo?.name || accountInfo?.email || "Qalam User";
  const accountEmail = accountInfo?.email || accountInfo?.name || "登录以启用同步和项目管理";
  const handleSignOut = accountInfo?.onSignOut || onSignOut;
  const handleUploadAvatar = accountInfo?.onUploadAvatar;

  const closeMenus = () => {
    setShowPalette(false);
    setShowFileMenu(false);
    setShowTemplate(false);
    setShowWip(false);
  };

  const handleAssetFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    type:
      | "script"
      | "globalStyleGuide"
      | "shotGuide"
      | "soraGuide"
      | "storyboardGuide"
      | "dramaGuide"
      | "csvShots"
      | "understandingJson"
  ) => {
    const file = event.target.files?.[0];
    if (!file || !onAssetLoad) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      if (content) onAssetLoad(type, content, file.name);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const ioActions: { label: string; desc: string; Icon: any; onClick?: () => void; color: string }[] = [];


  return (
    <div className={rootClass}>
      {(showPalette || showFileMenu || showTemplate) && <div className="fixed inset-0 z-10" onClick={closeMenus} />}

      <div className="relative z-20 flex justify-center">
        {/* Template Menu */}
        {showTemplate && (
          <div
            className={`absolute bottom-16 left-0 w-[92vw] max-w-[408px] animate-in fade-in slide-in-from-bottom-2 duration-200 ${panelClass}`}
            style={panelStyle}
          >
            <div className="max-h-[min(72vh,620px)] space-y-4 overflow-y-auto p-4">
              <div className="space-y-1 px-1">
                <div className={sectionEyebrowClass}>Project</div>
                <div className="text-[12px] leading-5 text-[var(--app-text-secondary)]">
                  更像目录视图的项目浮窗，保证常规页面高度也能完整操作。
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onTryMe?.();
                  closeMenus();
                }}
                className="w-full rounded-[24px] border border-[var(--app-border)] bg-[linear-gradient(145deg,rgba(196,164,132,0.12),rgba(118,145,125,0.06))] px-4 py-4 text-left transition hover:border-[var(--app-border-strong)] hover:bg-[linear-gradient(145deg,rgba(196,164,132,0.16),rgba(118,145,125,0.1))] active:translate-y-px"
                aria-label="载入示例"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-[rgba(255,255,255,0.06)] text-[#d8ccb7]">
                    <Sparkles size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">从示例项目开始</div>
                      <ChevronsRight size={16} className="text-[var(--app-text-secondary)]" />
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-[var(--app-text-secondary)]">
                      快速载入脚本、资产与节点结构。
                    </div>
                  </div>
                </div>
              </button>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className={sectionEyebrowClass}>Workspace</div>
                  <div className="text-[10px] text-[var(--app-text-muted)]">8 modules</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {projectModules.map(({ key, label, desc, Icon, tone, surface }) => (
                    <button
                      key={key}
                      onClick={() => {
                        onOpenModule?.(key);
                        closeMenus();
                      }}
                      className="group flex min-h-[82px] items-center gap-3 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-left transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] active:translate-y-px"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[var(--app-border)] ${surface} ${tone}`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{label}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--app-text-secondary)]">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${sectionCardClass} space-y-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={sectionEyebrowClass}>Templates</div>
                    <div className="mt-1 text-[11px] text-[var(--app-text-secondary)]">保存当前 Group，或快速载入最近模板。</div>
                  </div>
                  <div className="text-[10px] text-[var(--app-text-muted)]">{templates.length} saved</div>
                </div>

                <button
                  onClick={() => {
                    onCreateTemplate();
                    closeMenus();
                  }}
                  className={`w-full rounded-[18px] border border-[var(--app-border)] px-3 py-3 text-left transition ${canCreateTemplate ? "bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] active:translate-y-px" : "bg-[var(--app-panel-muted)] opacity-50 cursor-not-allowed"}`}
                  disabled={!canCreateTemplate}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-emerald-500/10 text-emerald-300">
                      <Library size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-[var(--app-text-primary)]">保存为模板</div>
                      <div className="text-[10px] text-[var(--app-text-secondary)]">选中 Group 后写入模板库</div>
                    </div>
                  </div>
                </button>

                {templates.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3.5 py-4 text-[11px] leading-5 text-[var(--app-text-secondary)]">
                    当前还没有自定义模板。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.slice(0, 4).map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center gap-2 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-2.5"
                      >
                        <button
                          onClick={() => {
                            onLoadTemplate(template.id);
                            closeMenus();
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] text-[var(--app-text-secondary)]">
                            <Library size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[var(--app-text-primary)]">{template.name}</div>
                            <div className="mt-0.5 text-[10px] text-[var(--app-text-secondary)]">
                              {new Date(template.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTemplate(template.id);
                            closeMenus();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)] transition hover:border-red-400/30 hover:text-red-300"
                          title="删除模板"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {templates.length > 4 && (
                      <div className="px-1 text-[10px] text-[var(--app-text-muted)]">其余模板可继续向下滚动查看。</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plus Palette */}
        {showPalette && (
          <div
            className={`absolute bottom-16 left-0 w-[360px] max-w-[92vw] animate-in fade-in slide-in-from-bottom-2 duration-300 ${panelClass}`}
            style={panelStyle}
          >
            <div className="p-4 space-y-4">
              <div className="px-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)]">Add Nodes</div>
                <div className="mt-1 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
                  选择一个节点起点，快速补齐输入、生成或组织结构。
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {nodeActions.map(({ label, hint, meta, onClick, Icon, tone, surface }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onClick();
                      closeMenus();
                    }}
                    className="group/node relative overflow-hidden rounded-[22px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-3 py-3 text-left hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`h-10 w-10 flex items-center justify-center rounded-2xl border border-[var(--app-border)] ${surface} ${tone}`}>
                        <Icon size={18} />
                      </div>
                      <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
                        {meta}
                      </div>
                    </div>
                    <div className="mt-3 min-w-0">
                      <div className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">{label}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--app-text-secondary)]">{hint}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                      <span>Click to add</span>
                      <ChevronRight size={14} className="translate-x-0 transition-transform group-hover/node:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* File Menu */}
        {showFileMenu && (
          <div
            className={`absolute bottom-16 left-0 w-[92vw] max-w-[420px] animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${panelClass}`}
            style={panelStyle}
          >
            <div className="max-h-[min(74vh,640px)] space-y-4 overflow-y-auto p-4">
              <div className="space-y-1">
                <div className={sectionEyebrowClass}>Account · IO</div>
                <div className="text-[12px] leading-5 text-[var(--app-text-secondary)]">
                  改成分段式小面板，只显示当前要用的一组动作。
                </div>
              </div>

              <div className={`${sectionCardClass} space-y-3`}>
                {!accountLoaded ? (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="h-14 w-14 rounded-[18px] bg-[var(--app-panel-soft)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded-full bg-[var(--app-panel-soft)]" />
                      <div className="h-3 w-24 rounded-full bg-[var(--app-panel-muted)]" />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="h-[60px] rounded-[18px] bg-[var(--app-panel-soft)]" />
                        <div className="h-[60px] rounded-[18px] bg-[var(--app-panel-muted)]" />
                      </div>
                    </div>
                  </div>
                ) : accountSignedIn ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      {accountInfo?.avatarUrl ? (
                        <img
                          src={accountInfo.avatarUrl}
                          alt="Avatar"
                          className="h-14 w-14 rounded-[18px] object-cover border border-[var(--app-border)]"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-secondary)]">
                          <User size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">{accountName}</div>
                        {accountEmail && <div className="truncate text-[12px] leading-6 text-[var(--app-text-secondary)]">{accountEmail}</div>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {["Cloud sync", "Project state", "Theme settings"].map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] px-2 py-1 text-[10px] text-[var(--app-text-secondary)]"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {onOpenStats && (
                        <button
                          type="button"
                          className={utilityButtonClass}
                          onClick={() => {
                            onOpenStats();
                            closeMenus();
                          }}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-sky-500/10 text-sky-300">
                            <BarChart2 size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Dashboard</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">项目概览</span>
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={utilityButtonClass}
                        onClick={() => {
                          onOpenSyncPanel?.();
                          closeMenus();
                        }}
                      >
                          <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-emerald-500/10 text-emerald-300">
                            <RefreshCw size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Sync</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">同步状态</span>
                          </span>
                        </button>
                      <button
                        type="button"
                        className={utilityButtonClass}
                        onClick={() => {
                          onOpenInfoPanel?.();
                          closeMenus();
                        }}
                      >
                          <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-amber-500/10 text-amber-300">
                            <Info size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Info</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">账户说明</span>
                          </span>
                        </button>
                      {handleUploadAvatar ? (
                        <button
                          type="button"
                          className={utilityButtonClass}
                          onClick={() => {
                            handleUploadAvatar();
                            closeMenus();
                          }}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-text-secondary)]">
                            <Upload size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Avatar</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">更新头像</span>
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={utilityButtonClass}
                          onClick={() => {
                            handleSignOut?.();
                            closeMenus();
                          }}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-rose-500/10 text-rose-300">
                            <LogOut size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Sign Out</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">退出账户</span>
                          </span>
                        </button>
                      )}
                    </div>
                    {handleUploadAvatar && (
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-4 text-[12px] font-semibold text-[var(--app-text-primary)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] active:translate-y-px"
                        onClick={() => {
                          handleSignOut?.();
                          closeMenus();
                        }}
                      >
                        Sign Out
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-muted)] text-[var(--app-text-secondary)]">
                        <User size={18} />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--app-text-primary)]">未登录</div>
                        <div className="text-[12px] leading-6 text-[var(--app-text-secondary)]">登录后可开启同步、主题偏好与项目管理。</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`${utilityButtonClass} border-transparent bg-[linear-gradient(180deg,rgba(122,183,160,0.18),rgba(122,183,160,0.08))] hover:border-[var(--app-border-strong)]`}
                        onClick={() => {
                          accountInfo?.onSignIn?.();
                          closeMenus();
                        }}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/10 text-[#d9efe5]">
                          <User size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Sign in</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">登录并启用同步</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={utilityButtonClass}
                        onClick={() => {
                          onOpenStats?.();
                          closeMenus();
                        }}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-sky-500/10 text-sky-300">
                          <BarChart2 size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Preview</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">先查看项目面板</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={utilityButtonClass}
                        onClick={() => {
                          onOpenInfoPanel?.();
                          closeMenus();
                        }}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)] bg-amber-500/10 text-amber-300">
                          <Info size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Info</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">了解账户能力</span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-[10px] text-[var(--app-text-secondary)]">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                        实时同步 / 背景主题 / 项目仪表盘
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {ioActions.length > 0 && (
                <div className="rounded-[22px] app-card overflow-hidden divide-y divide-white/8">
                  {ioActions.map((item) => {
                    const disabled = !item.onClick;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          if (item.onClick) item.onClick();
                          closeMenus();
                        }}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${disabled
                            ? "bg-transparent text-[var(--app-text-muted)] cursor-not-allowed"
                            : "hover:bg-[var(--app-panel-muted)] text-[var(--app-text-primary)]"
                          }`}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-[var(--app-border)]"
                          style={{ background: disabled ? "rgba(255,255,255,0.06)" : item.color }}
                        >
                          <item.Icon size={16} className={disabled ? "text-[var(--app-text-secondary)]" : "text-black"} />
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{item.label}</div>
                          <div className="text-[11px] text-[var(--app-text-secondary)]">{item.desc}</div>
                        </div>
                        <ChevronRight size={14} className="text-[var(--app-text-muted)]" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={`${sectionCardClass} space-y-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={sectionEyebrowClass}>IO</div>
                    <div className="mt-1 text-[11px] text-[var(--app-text-secondary)]">用标签切换导入、指南与导出。</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-1">
                    <button
                      type="button"
                      onClick={() => setIoPane("project")}
                      className={`${compactTabClass} ${ioPane === "project" ? "border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] text-[var(--app-text-primary)]" : "border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
                    >
                      Files
                    </button>
                    <button
                      type="button"
                      onClick={() => setIoPane("guides")}
                      className={`${compactTabClass} ${ioPane === "guides" ? "border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] text-[var(--app-text-primary)]" : "border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
                    >
                      Guides
                    </button>
                    <button
                      type="button"
                      onClick={() => setIoPane("export")}
                      className={`${compactTabClass} ${ioPane === "export" ? "border-[var(--app-border-strong)] bg-[var(--app-panel-soft)] text-[var(--app-text-primary)]" : "border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
                    >
                      Export
                    </button>
                  </div>
                </div>

                {ioPane === "project" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onImport();
                        closeMenus();
                      }}
                      className={docButtonClass}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-sky-500/10 text-sky-300">
                          <SquareStack size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Node</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">节点快照</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={scriptInputRef}
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "script")}
                    />
                    <button type="button" onClick={() => scriptInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-blue-500/10 text-blue-300">
                          <FileText size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">剧本</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">文本脚本</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "csvShots")}
                    />
                    <button type="button" onClick={() => csvInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-emerald-500/10 text-emerald-300">
                          <List size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Shots CSV</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">镜头表</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={understandingInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "understandingJson")}
                    />
                    <button type="button" onClick={() => understandingInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-amber-500/10 text-amber-300">
                          <BookOpen size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Understanding</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">理解快照</span>
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {ioPane === "guides" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      ref={globalStyleInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "globalStyleGuide")}
                    />
                    <button type="button" onClick={() => globalStyleInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-stone-500/10 text-stone-300">
                          <Palette size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Style</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">风格说明</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={shotGuideInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "shotGuide")}
                    />
                    <button type="button" onClick={() => shotGuideInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-yellow-500/10 text-yellow-300">
                          <FileCode size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Shot</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">镜头提示词</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={soraGuideInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "soraGuide")}
                    />
                    <button type="button" onClick={() => soraGuideInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-rose-500/10 text-rose-300">
                          <Sparkles size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Sora</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">视频说明</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={storyboardGuideInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "storyboardGuide")}
                    />
                    <button type="button" onClick={() => storyboardGuideInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-orange-500/10 text-orange-300">
                          <ImageIcon size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Storyboard</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">分镜提示词</span>
                        </span>
                      </div>
                    </button>
                    <input
                      ref={dramaGuideInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => handleAssetFileChange(e, "dramaGuide")}
                    />
                    <button type="button" onClick={() => dramaGuideInputRef.current?.click()} disabled={!onAssetLoad} className={docButtonClass}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-indigo-500/10 text-indigo-300">
                          <FileCode size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Drama</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">剧情说明</span>
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {ioPane === "export" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onExport();
                        closeMenus();
                      }}
                      className={docButtonClass}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-emerald-500/10 text-emerald-300">
                          <Share size={16} />
                        </span>
                        <span>
                          <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Node</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">节点快照</span>
                        </span>
                      </div>
                    </button>
                    {onExportCsv && (
                      <button
                        onClick={() => {
                          onExportCsv();
                          closeMenus();
                        }}
                        className={docButtonClass}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-sky-500/10 text-sky-300">
                            <List size={16} />
                          </span>
                          <span>
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Shots</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">镜头表</span>
                          </span>
                        </div>
                      </button>
                    )}
                    {onExportUnderstandingJson && (
                      <button
                        onClick={() => {
                          onExportUnderstandingJson();
                          closeMenus();
                        }}
                        className={docButtonClass}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--app-border)] bg-amber-500/10 text-amber-300">
                            <FileText size={16} />
                          </span>
                          <span>
                            <span className="block text-[12px] font-semibold text-[var(--app-text-primary)]">Understanding</span>
                            <span className="mt-0.5 block text-[10px] text-[var(--app-text-secondary)]">理解快照</span>
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Bar */}
        <div className="inline-flex items-center gap-1 h-10 px-3 rounded-full app-panel">
          {/* Account / Share */}
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
              setShowTemplate(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showFileMenu ? 'bg-[var(--app-panel-soft)]' : 'hover:bg-[var(--app-panel-muted)]'}`}
          >
            <User size={16} className="text-[var(--app-text-secondary)]" />
          </button>

          {/* Template */}
          <button
            onClick={() => {
              setShowTemplate((v) => !v);
              setShowPalette(false);
              setShowFileMenu(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showTemplate ? 'bg-[var(--app-panel-soft)]' : 'hover:bg-[var(--app-panel-muted)]'}`}
          >
            <Library size={14} className="text-[var(--app-text-secondary)]" />
          </button>

          {/* Workflow (Layers) */}
          <button
            onClick={() => {
              setShowPalette(false);
              setShowTemplate(false);
              setShowFileMenu(false);
              const rect = workflowButtonRef.current?.getBoundingClientRect();
              onToggleWorkflow?.(rect);
            }}
            ref={workflowButtonRef}
            data-workflow-trigger
            className="h-8 w-8 flex items-center justify-center rounded-full transition hover:bg-[var(--app-panel-muted)]"
            title="Workflow Actions"
          >
            <Layers size={14} className="text-[var(--app-text-secondary)]" />
          </button>

          {/* Plus */}
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
              setShowTemplate(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showPalette ? 'bg-[var(--app-panel-soft)]' : 'hover:bg-[var(--app-panel-muted)]'}`}
          >
            <Plus size={14} className={`text-[var(--app-text-secondary)] transition-transform ${showPalette ? 'rotate-45' : ''}`} />
          </button>

          {/* Projector / WIP */}
          <button
            onClick={() => setShowWip((v) => !v)}
            className="h-8 w-8 flex items-center justify-center rounded-full transition hover:bg-[var(--app-panel-muted)]"
            title="施工中"
          >
            <Projector size={14} className="text-[var(--app-text-secondary)]" />
          </button>

          {/* Run */}
          <button
            onClick={onRun}
            className="h-8 w-8 flex items-center justify-center rounded-full text-emerald-400 hover:text-emerald-300 transition-all"
            aria-label="Run"
          >
            <Play size={16} fill="currentColor" />
          </button>
        </div>

        {/* WIP popover */}
        {showWip && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 md:px-8"
            onClick={() => setShowWip(false)}
          >
            <div
              className={`w-[92vw] max-w-5xl min-h-[70vh] ${panelClass}`}
              style={panelStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--app-border)] bg-[var(--app-panel-muted)]">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/12 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <Projector size={22} />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-[var(--app-text-primary)]">放映机 · 施工中</div>
                    <div className="text-[12px] text-[var(--app-text-secondary)]">高级视图 / 回放 / 管理模块将很快上线。</div>
                  </div>
                </div>
                <button
                  className="h-9 px-3 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] text-[12px]"
                  onClick={() => setShowWip(false)}
                >
                  关闭
                </button>
              </div>

              <div className="px-6 py-6 space-y-4 text-[13px] text-[var(--app-text-secondary)] leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { title: "时间线 / 回放", desc: "查看生成历史、关键帧、回放并做版本对比。" },
                    { title: "资产管理", desc: "集中管理视频、图像与提示词，支持收藏与分发。" },
                    { title: "协同与审核", desc: "共享到团队、批注审阅、版本冻结与解冻。" },
                    { title: "发布与导出", desc: "支持多规格导出、CDN 发布与外链访问。" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-4 py-3 hover:border-[var(--app-border-strong)] transition-all"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text-primary)]">{item.title}</div>
                      <div className="text-[12px] text-[var(--app-text-secondary)] mt-1">{item.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] p-4">
                  <div className="flex items-center gap-2 text-[var(--app-text-primary)] font-semibold mb-2">
                    <Sparkles size={16} className="text-emerald-300" />
                    体验即将解锁
                  </div>
                  <div className="text-[12px] text-[var(--app-text-secondary)]">
                    放映机将整合节点生成的全链路资产，支持分镜回放、剪辑草稿、版本分支与一键发布。
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
