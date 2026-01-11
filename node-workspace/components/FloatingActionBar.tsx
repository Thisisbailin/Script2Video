import React, { useState } from "react";
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
  Layers,
  FolderOpen,
  FileText,
  List,
  BarChart2,
  Sun,
  Moon,
  Settings,
  Trash2,
  LogOut,
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
  onAddVideoGen: () => void;
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
  onOpenSettings?: () => void;
  onResetProject?: () => void;
  onSignOut?: () => void;
  accountInfo?: AccountInfo;
  onTryMe?: () => void;
};

export const FloatingActionBar: React.FC<Props> = ({
  onAddText,
  onAddImage,
  onAddLLM,
  onAddImageGen,
  onAddVideoGen,
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
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showWip, setShowWip] = useState(false);
  const rootClass = floating ? "fixed bottom-4 right-4 z-30" : "relative z-30";
  const panelClass = "rounded-3xl border border-white/12 bg-[#0b0d10]/95 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl overflow-hidden";
  const panelStyle: React.CSSProperties = {
    backgroundColor: "rgba(11,13,16,0.95)",
    borderColor: "rgba(255,255,255,0.12)",
  };

  const nodeActions = [
    { label: "Text", hint: "Text or notes", onClick: onAddText, Icon: MessageSquare },
    { label: "Note", hint: "Stick a note", onClick: onAddNote, Icon: StickyNote },
    { label: "Group", hint: "Organize nodes", onClick: onAddGroup, Icon: BoxSelect },
    { label: "Image", hint: "Add an input image", onClick: onAddImage, Icon: ImageIcon },
    { label: "LLM", hint: "Generate text", onClick: onAddLLM, Icon: Bot },
    { label: "Img Gen", hint: "Create images", onClick: onAddImageGen, Icon: Sparkles },
    { label: "Video", hint: "Generate clips", onClick: onAddVideoGen, Icon: Video },
    { label: "Output", hint: "Final results", onClick: onAddOutput, Icon: SquareStack },
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

  const ioActions = [
    {
      label: "Project Tracker",
      desc: "View dashboard",
      Icon: BarChart2,
      onClick: onOpenStats,
      color: "bg-sky-400",
    },
    {
      label: isDarkMode ? "Light Mode" : "Dark Mode",
      desc: "Toggle theme",
      Icon: isDarkMode ? Sun : Moon,
      onClick: onToggleTheme,
      color: "bg-amber-300",
    },
    {
      label: "System Settings",
      desc: "Open settings",
      Icon: Settings,
      onClick: onOpenSettings,
      color: "bg-purple-300",
    },
    {
      label: "Clear Project Data",
      desc: "Reset local/remote",
      Icon: Trash2,
      onClick: onResetProject,
      color: "bg-rose-400",
    },
    {
      label: "Sign Out",
      desc: "Account action",
      Icon: LogOut,
      onClick: onSignOut,
      color: "bg-slate-300",
    },
  ];

  return (
    <div className={rootClass}>
      {(showPalette || showFileMenu || showTemplate) && <div className="fixed inset-0 z-10" onClick={closeMenus} />}

      <div className="relative z-20 flex justify-center">
        {/* Template Menu */}
        {showTemplate && (
          <div
            className={`absolute bottom-16 left-0 w-80 animate-in fade-in slide-in-from-bottom-2 duration-200 ${panelClass}`}
            style={panelStyle}
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2">Project</div>
              <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">尝试示例</div>
                    <div className="text-[12px] text-white/65 leading-relaxed">载入内置示例项目并体验节点流程。</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onTryMe?.();
                    closeMenus();
                  }}
                  className="w-full h-10 rounded-xl bg-[var(--accent-blue)] text-white text-sm font-semibold hover:bg-sky-500 transition"
                >
                  载入示例
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 px-2">
                {[
                  { key: "assets" as ModuleKey, label: "Assets", Icon: FolderOpen },
                  { key: "script" as ModuleKey, label: "Script", Icon: FileText },
                  { key: "shots" as ModuleKey, label: "Shots", Icon: List },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      onOpenModule?.(key);
                      closeMenus();
                    }}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/3 px-3 py-3 text-xs font-semibold text-white/85 hover:border-white/25 hover:bg-white/8 transition"
                  >
                    <span className="h-10 w-10 flex items-center justify-center rounded-xl bg-black/30 border border-white/10 text-white/85">
                      <Icon size={18} />
                    </span>
                    {label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2">模板管理</div>
              <button
                onClick={() => {
                  onCreateTemplate();
                  closeMenus();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group ${canCreateTemplate ? "hover:bg-white/5" : "opacity-50 cursor-not-allowed"}`}
                disabled={!canCreateTemplate}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Library size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">保存为模板</div>
                    <div className="text-[10px] text-white/60">选中 Group 后保存</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/60 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2 pt-2">我的模板</div>
              {templates.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-white/60">暂无自定义模板</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="w-full flex items-center justify-between p-3 rounded-2xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all group"
                    >
                      <button
                        onClick={() => {
                          onLoadTemplate(template.id);
                          closeMenus();
                        }}
                        className="flex-1 flex items-center gap-3 text-left"
                      >
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-white/70">
                          <Library size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{template.name}</div>
                          <div className="text-[10px] text-white/60">
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
                        className="h-8 w-8 rounded-full border border-white/10 text-white/40 hover:text-red-400 hover:border-red-400/40 transition"
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
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60 px-2">Add Nodes</div>
              <div className="grid grid-cols-2 gap-2">
                {nodeActions.map(({ label, hint, onClick, Icon }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onClick();
                      closeMenus();
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/2 hover:border-white/25 hover:bg-white/8 transition-all group/node"
                  >
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/8 group-hover/node:bg-white/10 group-hover/node:ring-white/12 transition-all">
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-[13px] font-bold text-white">{label}</div>
                      <div className="text-[11px] text-white/60 truncate">{hint}</div>
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
            className={`absolute bottom-16 left-0 w-[480px] animate-in fade-in zoom-in-95 duration-200 overflow-hidden rounded-3xl`}
            style={{ ...panelStyle, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(12,15,18,0.96)" }}
          >
            <div className="p-5 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Account · IO</div>
              <div className="rounded-2xl border border-white/8 bg-[#0f1114]/92 p-4 space-y-3 shadow-[0_22px_50px_rgba(0,0,0,0.38)]">
                {!accountLoaded ? (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="h-12 w-12 rounded-xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-white/10" />
                      <div className="h-3 w-24 rounded bg-white/8" />
                      <div className="flex gap-2">
                        <div className="h-8 w-20 rounded bg-white/10" />
                        <div className="h-8 w-20 rounded bg-white/6" />
                      </div>
                    </div>
                  </div>
                ) : accountSignedIn ? (
                  <div className="flex items-start gap-3">
                    {accountInfo?.avatarUrl ? (
                      <img
                        src={accountInfo.avatarUrl}
                        alt="Avatar"
                        className="h-12 w-12 rounded-xl object-cover border border-white/12 shadow-sm"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-white/6 flex items-center justify-center text-white/80 border border-white/12">
                        <User size={18} />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-semibold text-white">{accountName}</div>
                      {accountEmail && <div className="text-[12px] text-white/60 leading-relaxed truncate">{accountEmail}</div>}
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] border border-white/12 text-white/85 hover:border-white/30 hover:bg-white/6 transition"
                          onClick={() => {
                            onOpenSettings?.();
                            closeMenus();
                          }}
                        >
                          Account
                        </button>
                        {handleUploadAvatar && (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-full text-[12px] border border-white/12 text-white/85 hover:border-white/30 hover:bg-white/6 transition"
                            onClick={() => {
                              handleUploadAvatar();
                              closeMenus();
                            }}
                          >
                            Upload Avatar
                          </button>
                        )}
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] bg-white text-black hover:bg-white/90 transition"
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
                    <div className="h-12 w-12 rounded-xl border border-dashed border-white/30 bg-white/5 flex items-center justify-center text-white/70">
                      <User size={18} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-semibold text-white">未登录</div>
                      <div className="text-[12px] text-white/60 leading-relaxed">登录以解锁同步、主题与项目管理。</div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition shadow-[0_10px_30px_rgba(56,189,248,0.25)]"
                          onClick={() => {
                            accountInfo?.onSignIn?.() ?? onOpenSettings?.();
                            closeMenus();
                          }}
                        >
                          Sign up / Log in
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-full text-[12px] border border-white/15 text-white/80 hover:border-white/35 hover:text-white transition"
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
                            className="px-2 py-1 rounded-full text-[11px] bg-white/6 border border-white/10 text-white/70"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/8 bg-[#0f1114]/92 overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.3)] divide-y divide-white/8">
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
                          ? "bg-transparent text-white/45 cursor-not-allowed"
                          : "hover:bg-white/4 text-white/85"
                      }`}
                    >
                      <span
                        className="h-9 w-9 rounded-xl flex items-center justify-center border border-white/10 ring-1 ring-black/20"
                        style={{ background: disabled ? "rgba(255,255,255,0.06)" : item.color }}
                      >
                        <item.Icon size={16} className={disabled ? "text-white/60" : "text-black"} />
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="text-[11px] text-white/60">{item.desc}</div>
                      </div>
                      <ChevronRight size={14} className="text-white/30" />
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Share</div>
              <div className="rounded-2xl border border-white/8 bg-[#0f1114]/92 p-3 space-y-3 shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-widest text-white/50 px-1">Import</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onImport();
                        closeMenus();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-white/12 bg-white/4 hover:border-white/25 hover:bg-white/8 transition text-white"
                    >
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                      Import JSON
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-widest text-white/50 px-1">Export</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        onExport();
                        closeMenus();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-white/12 bg-white/4 hover:border-white/25 hover:bg-white/8 transition text-white"
                    >
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      Export JSON
                    </button>
                    {onExportCsv && (
                      <button
                        onClick={() => {
                          onExportCsv();
                          closeMenus();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-white/12 bg-white/4 hover:border-white/25 hover:bg-white/8 transition text-white"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                        Export CSV
                      </button>
                    )}
                    {onExportXls && (
                      <button
                        onClick={() => {
                          onExportXls();
                          closeMenus();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-white/12 bg-white/4 hover:border-white/25 hover:bg-white/8 transition text-white"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-purple-300" />
                        Export XLS
                      </button>
                    )}
                    {onExportUnderstandingJson && (
                      <button
                        onClick={() => {
                          onExportUnderstandingJson();
                          closeMenus();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full border border-white/12 bg-white/4 hover:border-white/25 hover:bg-white/8 transition text-white"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        Export Understanding
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Bar */}
        <div
          className="inline-flex items-center gap-1 h-10 px-3 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          {/* Account / Share */}
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
              setShowTemplate(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showFileMenu ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <User size={16} className="text-white/80" />
          </button>

          {/* Template */}
          <button
            onClick={() => {
              setShowTemplate((v) => !v);
              setShowPalette(false);
              setShowFileMenu(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showTemplate ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Library size={14} className="text-white/80" />
          </button>

          {/* Workflow (Layers) */}
          <button
            onClick={() => {
              setShowPalette(false);
              setShowTemplate(false);
              setShowFileMenu(false);
              setShowWip((v) => !v);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-full transition hover:bg-white/5"
            title="Workflow Actions"
          >
            <Layers size={14} className="text-white/75" />
          </button>

          {/* Plus */}
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
              setShowTemplate(false);
              setShowWip(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showPalette ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Plus size={14} className={`text-white/80 transition-transform ${showPalette ? 'rotate-45' : ''}`} />
          </button>

          {/* Projector / WIP */}
          <button
            onClick={() => setShowWip((v) => !v)}
            className="h-8 w-8 flex items-center justify-center rounded-full transition hover:bg-white/5"
            title="施工中"
          >
            <Projector size={14} className="text-white/70" />
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
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/12 bg-white/2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/12 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <Projector size={22} />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">放映机 · 施工中</div>
                    <div className="text-[12px] text-white/60">高级视图 / 回放 / 管理模块将很快上线。</div>
                  </div>
                </div>
                <button
                  className="h-9 px-3 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/5 text-[12px]"
                  onClick={() => setShowWip(false)}
                >
                  关闭
                </button>
              </div>

              <div className="px-6 py-6 space-y-4 text-[13px] text-white/80 leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { title: "时间线 / 回放", desc: "查看生成历史、关键帧、回放并做版本对比。" },
                    { title: "资产管理", desc: "集中管理视频、图像与提示词，支持收藏与分发。" },
                    { title: "协同与审核", desc: "共享到团队、批注审阅、版本冻结与解冻。" },
                    { title: "发布与导出", desc: "支持多规格导出、CDN 发布与外链访问。" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/2 px-4 py-3 hover:border-white/25 transition-all"
                    >
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="text-[12px] text-white/65 mt-1">{item.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/2 p-4">
                  <div className="flex items-center gap-2 text-white font-semibold mb-2">
                    <Sparkles size={16} className="text-emerald-300" />
                    体验即将解锁
                  </div>
                  <div className="text-[12px] text-white/65">
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
