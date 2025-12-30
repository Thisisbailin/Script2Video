import React, { useState } from "react";
import {
  Plus,
  ChevronUp,
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
  onImportUnderstanding: () => void;
  onImportEpisode: () => void;
  isUnderstandingActive: boolean;
  onToggleUnderstanding: () => void;
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
  onImportUnderstanding,
  onImportEpisode,
  isUnderstandingActive,
  onToggleUnderstanding,
  onImport,
  onExport,
  onRun,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);

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
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
      {(showPalette || showFileMenu) && <div className="fixed inset-0 z-10" onClick={closeMenus} />}

      <div className="relative z-20 flex justify-center">
        {showPalette && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[340px] rounded-3xl border backdrop-blur-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "rgba(var(--bg-elevated-rgb), 0.8)",
              boxShadow: "0 30px 60px -12px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="px-5 py-6 border-b border-[var(--border-subtle)]/50 bg-blue-600/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)] font-bold">Smart Analysis</div>
                <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <button
                onClick={() => {
                  onImportUnderstanding();
                  closeMenus();
                }}
                className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-all active:scale-95 group/btn"
              >
                <Bot size={20} className="text-blue-400 group-hover/btn:scale-110 transition-transform" />
                <span className="text-sm font-bold text-blue-100">Initialize Assets Lab</span>
              </button>
            </div>

            <div className="px-3 py-3 grid grid-cols-2 gap-2">
              <div className="col-span-2 px-2 pb-1 text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)] font-bold">Add Nodes</div>
              {nodeActions.map(({ label, hint, onClick, Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    onClick();
                    closeMenus();
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-all duration-200 group/node"
                >
                  <span
                    className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/5 group-hover/node:ring-white/10 group-hover/node:bg-white/10 transition-all"
                  >
                    <Icon size={18} className="text-[var(--text-secondary)] group-hover/node:text-[var(--text-primary)]" />
                  </span>
                  <div className="text-left overflow-hidden">
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{label}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate opacity-60">{hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showFileMenu && (
          <div
            className="absolute bottom-20 right-0 w-56 rounded-2xl border backdrop-blur-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "rgba(var(--bg-panel-rgb), 0.9)",
              boxShadow: "var(--shadow-strong)",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.15em] px-4 pt-4 pb-2 text-[var(--text-secondary)] font-bold opacity-60">Workflow Management</div>
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  onImport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition text-[var(--text-primary)] font-medium"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Import JSON
              </button>
              <button
                onClick={() => {
                  onExport();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-white/5 transition text-[var(--text-primary)] font-medium"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Export JSON
              </button>
            </div>
          </div>
        )}

        <div
          className="flex items-center gap-1.5 text-[var(--text-primary)] px-2 py-2 rounded-full border backdrop-blur-2xl transition-all duration-300 group"
          style={{
            backgroundColor: "rgba(var(--bg-panel-rgb), 0.7)",
            borderColor: "var(--border-subtle)",
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)",
          }}
        >
          <button
            onClick={onRun}
            className="flex items-center justify-center h-10 px-4 gap-2 rounded-full bg-blue-600 hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            aria-label="Run workflow"
          >
            <ChevronUp size={18} className="text-white" />
            <span className="text-sm font-semibold tracking-tight text-white pr-1">Run</span>
          </button>
          <div
            className="h-6 w-px mx-1 opacity-20"
            style={{ backgroundColor: "var(--text-secondary)" }}
          />
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
            }}
            className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 active:scale-90 ${showPalette ? 'bg-white/10 ring-1 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'hover:bg-white/5'}`}
            aria-label="Add nodes"
          >
            <Plus size={20} className={showPalette ? "rotate-45 transition-transform" : "transition-transform"} />
          </button>
          <button
            onClick={onToggleUnderstanding}
            className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 active:scale-90 ${isUnderstandingActive ? 'bg-blue-600/80 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'hover:bg-white/5 text-[var(--text-secondary)]'}`}
            aria-label="Toggle Understanding Mode"
          >
            <Bot size={20} className={isUnderstandingActive ? "animate-pulse" : ""} />
          </button>
          <button
            onClick={onImportEpisode}
            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/5 text-[var(--text-secondary)] transition-all duration-300 active:scale-90"
            aria-label="Import Episode"
          >
            <Clapperboard size={18} />
          </button>
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
            }}
            className={`flex items-center justify-center h-10 w-10 rounded-full transition-all duration-300 active:scale-90 ${showFileMenu ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
            aria-label="Import/Export"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
