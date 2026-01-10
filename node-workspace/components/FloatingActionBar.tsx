import React, { useState } from "react";
import {
  Plus,
  Play,
  Share2,
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
  Projector,
} from "lucide-react";
import { WorkflowTemplate } from "../types";

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
  onRun: () => void;
  templates: WorkflowTemplate[];
  canCreateTemplate: boolean;
  onCreateTemplate: () => void;
  onLoadTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  floating?: boolean;
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
  onRun,
  templates,
  canCreateTemplate,
  onCreateTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  floating = true,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const rootClass = floating ? "fixed bottom-4 right-4 z-30" : "relative z-30";

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

  const closeMenus = () => {
    setShowPalette(false);
    setShowFileMenu(false);
    setShowTemplate(false);
  };

  return (
    <div className={rootClass}>
      {(showPalette || showFileMenu || showTemplate) && <div className="fixed inset-0 z-10" onClick={closeMenus} />}

      <div className="relative z-20 flex justify-center">
        {/* Template Menu */}
        {showTemplate && (
          <div
            className="absolute bottom-16 left-0 w-80 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/90 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-2">Template Builder</div>
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
                    <div className="text-sm font-bold text-[var(--text-primary)]">保存为模板</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">选中 Group 后保存</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-2 pt-2">My Templates</div>
              {templates.length === 0 ? (
                <div className="px-2 py-3 text-[11px] text-[var(--text-secondary)]">暂无自定义模板</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group"
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
                          <div className="text-sm font-bold text-[var(--text-primary)]">{template.name}</div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
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
            className="absolute bottom-16 left-0 w-80 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/90 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="p-3 grid grid-cols-2 gap-2">
              <div className="col-span-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Add Nodes</div>
              {nodeActions.map(({ label, hint, onClick, Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    onClick();
                    closeMenus();
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group/node"
                >
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/5 group-hover/node:bg-white/10 group-hover/node:ring-white/10 transition-all">
                    <Icon size={18} className="text-[var(--node-text-primary)]" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <div className="text-[13px] font-bold text-[var(--text-primary)]">{label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File Menu */}
        {showFileMenu && (
          <div
            className="absolute bottom-16 left-0 w-64 rounded-3xl border border-white/10 bg-[#0b0d10]/95 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-3 space-y-2 text-white">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/60">Share / IO</div>
              <button
                onClick={() => {
                  onImport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-white/5 transition text-white"
              >
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                Import JSON
              </button>
              <button
                onClick={() => {
                  onExport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-white/5 transition text-white"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                Export JSON
              </button>
            </div>
          </div>
        )}

        {/* Main Bar */}
        <div
          className="inline-flex items-center gap-1 h-10 px-3 rounded-full border border-white/10 bg-[#0d0f12]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur min-w-[320px]"
        >
          {/* Menu */}
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
              setShowTemplate(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showFileMenu ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Share2 size={14} className="text-white/80" />
          </button>

          {/* Template */}
          <button
            onClick={() => {
              setShowTemplate((v) => !v);
              setShowPalette(false);
              setShowFileMenu(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showTemplate ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Library size={14} className="text-white/80" />
          </button>

          {/* Plus */}
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
              setShowTemplate(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-full transition ${showPalette ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Plus size={14} className={`text-white/80 transition-transform ${showPalette ? 'rotate-45' : ''}`} />
          </button>

          {/* Projector (Placeholder) */}
          <div className="h-8 w-8 flex items-center justify-center rounded-full opacity-30 cursor-not-allowed">
            <Projector size={14} className="text-white/50" />
          </div>

          <div className="h-6 w-px bg-white/10 mx-1" />

          {/* Run */}
          <button
            onClick={onRun}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-all"
            aria-label="Run"
          >
            <Play size={14} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};
