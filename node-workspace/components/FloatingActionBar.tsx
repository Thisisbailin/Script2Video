import React, { useRef, useState } from "react";
import {
  Plus,
  Play,
  User,
  Projector,
  MessageSquare,
  Image as ImageIcon,
  Bot,
  Sparkles,
  Video,
  SquareStack,
  StickyNote,
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
  Sun,
  Moon,
  Settings,
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
  onAddLLM: () => void;
  onAddImageGen: () => void;
  onAddWanImageGen: () => void;
  onAddVideoGen: () => void;
  onAddWanVideoGen: () => void;
  onAddOutput: () => void;
  onAddGroup: () => void;
  onAddNote: () => void;
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
  onOpenSettings?: (tab?: "multimodal" | "video" | "sync" | "about") => void;
  onResetProject?: () => void;
  onSignOut?: () => void;
  accountInfo?: AccountInfo;
  onTryMe?: () => void;
  onToggleWorkflow?: () => void;
  onAssetLoad?: (
    type: "script" | "globalStyleGuide" | "shotGuide" | "soraGuide" | "dramaGuide" | "csvShots" | "understandingJson",
    content: string,
    fileName?: string
  ) => void;
};

export const FloatingActionBar: React.FC<Props> = ({
  onAddText,
  onAddImage,
  onAddLLM,
  onAddImageGen,
  onAddWanImageGen,
  onAddVideoGen,
  onAddWanVideoGen,
  onAddOutput,
  onAddGroup,
  onAddNote,
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
  onOpenSettings,
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
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const understandingInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);
  const dramaGuideInputRef = useRef<HTMLInputElement>(null);
  const rootClass = floating ? "fixed bottom-4 right-4 z-30" : "relative z-30";
  const panelClass = "rounded-3xl app-panel overflow-hidden";
  const panelStyle: React.CSSProperties = {
    backgroundColor: "var(--app-panel)",
    borderColor: "var(--app-border)",
    boxShadow: "var(--app-shadow)",
  };
  const pillButtonClass =
    "inline-flex items-center justify-center h-9 px-3 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[12px] font-semibold text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] transition";
  const primaryPillButtonClass =
    "inline-flex items-center justify-center h-9 px-3 rounded-full bg-emerald-500 text-white text-[12px] font-semibold hover:bg-emerald-400 transition";

  const nodeActions = [
    { label: "Text", hint: "Text or notes", onClick: onAddText, Icon: MessageSquare },
    { label: "Note", hint: "Stick a note", onClick: onAddNote, Icon: StickyNote },
    { label: "Group", hint: "Organize nodes", onClick: onAddGroup, Icon: BoxSelect },
    { label: "Image", hint: "Add an input image", onClick: onAddImage, Icon: ImageIcon },
    { label: "LLM", hint: "Generate text", onClick: onAddLLM, Icon: Bot },
    { label: "Img Gen", hint: "Create images", onClick: onAddImageGen, Icon: Sparkles },
    { label: "WAN Img", hint: "Wan 2.6 image", onClick: onAddWanImageGen, Icon: Sparkles },
    { label: "Sora Video", hint: "Generate Sora clips", onClick: onAddVideoGen, Icon: Video },
    { label: "WAN Vid", hint: "Wan 2.6 video", onClick: onAddWanVideoGen, Icon: Video },
    { label: "Output", hint: "Final results", onClick: onAddOutput, Icon: SquareStack },
  ];
  const projectModules = [
    { key: "assets" as ModuleKey, label: "Assets", desc: "资产与设定", Icon: FolderOpen, tone: "text-emerald-300", surface: "bg-emerald-500/10" },
    { key: "script" as ModuleKey, label: "Script", desc: "剧本与解析", Icon: FileText, tone: "text-sky-300", surface: "bg-sky-500/10" },
    { key: "shots" as ModuleKey, label: "Shots", desc: "分镜与镜头", Icon: List, tone: "text-amber-300", surface: "bg-amber-500/10" },
    { key: "characters" as ModuleKey, label: "角色", desc: "角色库", Icon: Users, tone: "text-emerald-200", surface: "bg-emerald-500/10" },
    { key: "scenes" as ModuleKey, label: "场景", desc: "场景库", Icon: MapPin, tone: "text-cyan-200", surface: "bg-cyan-500/10" },
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
    type: "script" | "globalStyleGuide" | "shotGuide" | "soraGuide" | "dramaGuide" | "csvShots" | "understandingJson"
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
            className={`absolute bottom-16 left-0 w-[92vw] max-w-[520px] animate-in fade-in slide-in-from-bottom-2 duration-200 ${panelClass}`}
            style={panelStyle}
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)] px-2">Project</div>
              <div className="rounded-3xl border border-[var(--app-border)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(56,189,248,0.08))] px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 flex items-center justify-center text-emerald-300">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-secondary)]">
                        Quick Start
                      </div>
                      <div className="text-sm font-semibold text-[var(--app-text-primary)]">尝试示例项目</div>
                      <div className="text-[12px] text-[var(--app-text-secondary)] leading-relaxed">
                        载入内置示例并快速浏览脚本、资产与节点流。
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onTryMe?.();
                      closeMenus();
                    }}
                    className="h-9 w-9 flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
                    aria-label="载入示例"
                  >
                    <ChevronsRight size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-[var(--app-text-secondary)]">
                  {["脚本解析", "资产预览", "节点流"].map((item) => (
                    <span
                      key={item}
                      className="px-2 py-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-1">
                {projectModules.map(({ key, label, desc, Icon, tone, surface }) => (
                  <button
                    key={key}
                    onClick={() => {
                      onOpenModule?.(key);
                      closeMenus();
                    }}
                    className="group flex flex-col gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] px-3 py-3 text-left hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-soft)] transition"
                  >
                    <span className={`h-9 w-9 flex items-center justify-center rounded-xl border border-[var(--app-border)] ${surface} ${tone}`}>
                      <Icon size={18} />
                    </span>
                    <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">{label}</div>
                    <div className="text-[10px] text-[var(--app-text-secondary)]">{desc}</div>
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)] px-2">模板管理</div>
              <button
                onClick={() => {
                  onCreateTemplate();
                  closeMenus();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group ${canCreateTemplate ? "hover:bg-[var(--app-panel-muted)]" : "opacity-50 cursor-not-allowed"}`}
                disabled={!canCreateTemplate}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Library size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[var(--app-text-primary)]">保存为模板</div>
                    <div className="text-[10px] text-[var(--app-text-secondary)]">选中 Group 后保存</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--app-text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)] px-2 pt-2">我的模板</div>
              {templates.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-[var(--app-text-secondary)]">暂无自定义模板</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="w-full flex items-center justify-between p-3 rounded-2xl border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition-all group"
                    >
                      <button
                        onClick={() => {
                          onLoadTemplate(template.id);
                          closeMenus();
                        }}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--app-panel-muted)] text-[var(--app-text-secondary)]">
                          <Library size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[var(--app-text-primary)]">{template.name}</div>
                          <div className="text-[10px] text-[var(--app-text-secondary)]">
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
                        className="h-8 w-8 rounded-full border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-red-400 hover:border-red-400/40 transition"
                        title="删除模板"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Plus Palette */}
        {showPalette && (
          <div
            className={`absolute bottom-16 left-0 w-80 animate-in fade-in slide-in-from-bottom-2 duration-300 ${panelClass}`}
            style={panelStyle}
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)] px-2">Add Nodes</div>
              <div className="grid grid-cols-2 gap-2">
                {nodeActions.map(({ label, hint, onClick, Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onClick();
                      closeMenus();
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition-all group/node"
                  >
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--app-panel-muted)] ring-1 ring-white/8 group-hover/node:bg-[var(--app-panel-soft)] group-hover/node:ring-white/12 transition-all">
                      <Icon size={18} className="text-[var(--app-text-primary)]" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-[13px] font-bold text-[var(--app-text-primary)]">{label}</div>
                      <div className="text-[11px] text-[var(--app-text-secondary)] truncate">{hint}</div>
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
            className={`absolute bottom-16 left-0 w-[520px] max-w-[92vw] animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${panelClass}`}
            style={panelStyle}
          >
            <div className="p-5 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)]">Account · IO</div>
              <div className="rounded-2xl app-card p-4 space-y-3">
                {!accountLoaded ? (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="h-12 w-12 rounded-xl bg-[var(--app-panel-soft)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-[var(--app-panel-soft)]" />
                      <div className="h-3 w-24 rounded bg-[var(--app-panel-muted)]" />
                      <div className="flex gap-2">
                        <div className="h-8 w-20 rounded bg-[var(--app-panel-soft)]" />
                        <div className="h-8 w-20 rounded bg-[var(--app-panel-muted)]" />
                      </div>
                    </div>
                  </div>
                ) : accountSignedIn ? (
                  <div className="flex items-start gap-3">
                    {accountInfo?.avatarUrl ? (
                      <img
                        src={accountInfo.avatarUrl}
                        alt="Avatar"
                        className="h-12 w-12 rounded-xl object-cover border border-[var(--app-border)]"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-[var(--app-panel-muted)] flex items-center justify-center text-[var(--app-text-secondary)] border border-[var(--app-border)]">
                        <User size={18} />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-semibold text-[var(--app-text-primary)]">{accountName}</div>
                      {accountEmail && <div className="text-[12px] text-[var(--app-text-secondary)] leading-relaxed truncate">{accountEmail}</div>}
                      <div className="flex items-center gap-2 pt-3 flex-wrap md:flex-nowrap">
                        {onOpenStats && (
                          <button
                            type="button"
                            className={pillButtonClass}
                            onClick={() => {
                              onOpenStats();
                              closeMenus();
                            }}
                          >
                            Dashboard
                          </button>
                        )}
                        <button
                          type="button"
                          className={pillButtonClass}
                          onClick={() => {
                            onOpenSettings?.();
                            closeMenus();
                          }}
                        >
                          Setting
                        </button>
                        {handleUploadAvatar && (
                          <button
                            type="button"
                            className={pillButtonClass}
                            onClick={() => {
                              handleUploadAvatar();
                              closeMenus();
                            }}
                          >
                            Avatar
                          </button>
                        )}
                        <button
                          type="button"
                          className={primaryPillButtonClass}
                          onClick={() => {
                            handleSignOut?.();
                            closeMenus();
                          }}
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-panel-muted)] flex items-center justify-center text-[var(--app-text-secondary)]">
                      <User size={18} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-semibold text-[var(--app-text-primary)]">未登录</div>
                      <div className="text-[12px] text-[var(--app-text-secondary)] leading-relaxed">登录以解锁同步、主题与项目管理。</div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition"
                          onClick={() => {
                            accountInfo?.onSignIn?.();
                            closeMenus();
                          }}
                        >
                          Sign up / Log in
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-primary)] transition"
                          onClick={() => {
                            onOpenStats?.();
                            closeMenus();
                          }}
                        >
                          先看看
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {["实时同步", "背景主题", "项目仪表盘"].map((chip) => (
                          <span
                            key={chip}
                            className="px-2 py-1 rounded-full text-[11px] bg-[var(--app-panel-muted)] border border-[var(--app-border)] text-[var(--app-text-secondary)]"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {ioActions.length > 0 && (
                <div className="rounded-2xl app-card overflow-hidden divide-y divide-white/8">
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
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                          disabled
                            ? "bg-transparent text-[var(--app-text-muted)] cursor-not-allowed"
                            : "hover:bg-[var(--app-panel-muted)] text-[var(--app-text-primary)]"
                        }`}
                      >
                        <span
                          className="h-9 w-9 rounded-xl flex items-center justify-center border border-[var(--app-border)] ring-1 ring-black/20"
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

              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-secondary)]">Share</div>
              <div className="rounded-2xl app-card p-4 space-y-3">
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">Import</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onImport();
                        closeMenus();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition text-[var(--app-text-primary)]"
                    >
                      <SquareStack size={14} className="text-sky-300" />
                      Node
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">Core Documents</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        ref={scriptInputRef}
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "script")}
                      />
                      <button
                        type="button"
                        onClick={() => scriptInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <FileText size={14} className="text-blue-300" />
                        剧本
                      </button>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "csvShots")}
                      />
                      <button
                        type="button"
                        onClick={() => csvInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <List size={14} className="text-emerald-300" />
                        Shots CSV
                      </button>
                      <input
                        ref={understandingInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "understandingJson")}
                      />
                      <button
                        type="button"
                        onClick={() => understandingInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <BookOpen size={14} className="text-amber-300" />
                        Understanding
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">AI Instructions</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        ref={globalStyleInputRef}
                        type="file"
                        accept=".md,.txt"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "globalStyleGuide")}
                      />
                      <button
                        type="button"
                        onClick={() => globalStyleInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <Palette size={14} className="text-purple-300" />
                        Style
                      </button>
                      <input
                        ref={shotGuideInputRef}
                        type="file"
                        accept=".md,.txt"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "shotGuide")}
                      />
                      <button
                        type="button"
                        onClick={() => shotGuideInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <FileCode size={14} className="text-yellow-300" />
                        Shot
                      </button>
                      <input
                        ref={soraGuideInputRef}
                        type="file"
                        accept=".md,.txt"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "soraGuide")}
                      />
                      <button
                        type="button"
                        onClick={() => soraGuideInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <Sparkles size={14} className="text-pink-300" />
                        Sora
                      </button>
                      <input
                        ref={dramaGuideInputRef}
                        type="file"
                        accept=".md,.txt"
                        className="hidden"
                        onChange={(e) => handleAssetFileChange(e, "dramaGuide")}
                      />
                      <button
                        type="button"
                        onClick={() => dramaGuideInputRef.current?.click()}
                        disabled={!onAssetLoad}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border transition ${
                          onAssetLoad
                            ? "border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] text-[var(--app-text-primary)]"
                            : "border-[var(--app-border)] bg-[var(--app-panel-muted)] text-[var(--app-text-muted)] cursor-not-allowed"
                        }`}
                      >
                        <FileCode size={14} className="text-indigo-300" />
                        Drama
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-widest text-[var(--app-text-muted)] px-1">Export</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onExport();
                        closeMenus();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition text-[var(--app-text-primary)]"
                    >
                      <Share size={14} className="text-emerald-300" />
                      Node
                    </button>
                    {onExportCsv && (
                      <button
                        onClick={() => {
                          onExportCsv();
                          closeMenus();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition text-[var(--app-text-primary)]"
                      >
                        <List size={14} className="text-sky-300" />
                        Shots
                      </button>
                    )}
                    {onExportUnderstandingJson && (
                      <button
                        onClick={() => {
                          onExportUnderstandingJson();
                          closeMenus();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition text-[var(--app-text-primary)]"
                      >
                        <FileText size={14} className="text-amber-300" />
                        Understanding
                      </button>
                    )}
                  </div>
                </div>
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
              onToggleWorkflow?.();
            }}
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
