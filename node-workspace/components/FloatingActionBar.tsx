import React, { useState } from "react";
import {
  Plus,
  Play,
  Menu,
  MessageSquare,
  Image as ImageIcon,
  Bot,
  Sparkles,
  Video,
  SquareStack,
  StickyNote,
  BoxSelect,
  Clapperboard,
  Library,
  ChevronRight,
  Database,
  Projector,
} from "lucide-react";

type Props = {
  onAddText: () => void;
  onAddImage: () => void;
  onAddLLM: () => void;
  onAddImageGen: () => void;
  onAddVideoGen: () => void;
  onAddOutput: () => void;
  onAddGroup: () => void;
  onAddNote: () => void;
  onImportCharacters: () => void;
  onImportLocations: () => void;
  onImportEpisode: () => void;
  onImport: () => void;
  onExport: () => void;
  onRun: () => void;
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
  onImportCharacters,
  onImportLocations,
  onImportEpisode,
  onImport,
  onExport,
  onRun,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
      {(showPalette || showFileMenu || showTemplate) && <div className="fixed inset-0 z-10" onClick={closeMenus} />}

      <div className="relative z-20 flex justify-center">
        {/* Template Menu */}
        {showTemplate && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 w-80 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/90 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] px-2">Library Templates</div>

              <button
                onClick={() => {
                  onImportCharacters();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Database size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Character Assets</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Import character sheets + forms</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <button
                onClick={() => {
                  onImportLocations();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <Projector size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Scene Assets</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Import location zones + refs</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>

              <button
                onClick={() => {
                  onImportEpisode();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Clapperboard size={20} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[var(--text-primary)]">Episode List</div>
                    <div className="text-[10px] text-[var(--text-secondary)]">Import storyboard shots</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </button>
            </div>
          </div>
        )}

        {/* Plus Palette */}
        {showPalette && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 w-80 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/90 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
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
            className="absolute bottom-20 left-0 w-56 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-2 space-y-1">
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Project</div>
              <button
                onClick={() => {
                  onImport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-white/5 transition text-[var(--text-primary)]"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Import JSON
              </button>
              <button
                onClick={() => {
                  onExport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-white/5 transition text-[var(--text-primary)]"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Export JSON
              </button>
            </div>
          </div>
        )}

        {/* Main Bar */}
        <div
          className="flex items-center gap-1 p-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-2xl shadow-2xl"
        >
          {/* Menu */}
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
              setShowTemplate(false);
            }}
            className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${showFileMenu ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Menu size={18} className="text-[var(--text-primary)]" />
          </button>

          {/* Template */}
          <button
            onClick={() => {
              setShowTemplate((v) => !v);
              setShowPalette(false);
              setShowFileMenu(false);
            }}
            className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${showTemplate ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Library size={18} className="text-[var(--text-primary)]" />
          </button>

          {/* Plus */}
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
              setShowTemplate(false);
            }}
            className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${showPalette ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <Plus size={20} className={`text-[var(--text-primary)] transition-transform ${showPalette ? 'rotate-45' : ''}`} />
          </button>

          {/* Projector (Placeholder) */}
          <div className="h-10 w-10 flex items-center justify-center rounded-full opacity-30 cursor-not-allowed">
            <Projector size={18} className="text-[var(--text-primary)]" />
          </div>

          <div className="h-6 w-px bg-[var(--border-subtle)] mx-1" />

          {/* Run */}
          <button
            onClick={onRun}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            aria-label="Run"
          >
            <Play size={18} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};
