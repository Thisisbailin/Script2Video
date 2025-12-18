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
} from "lucide-react";

type Props = {
  onAddPrompt: () => void;
  onAddImage: () => void;
  onAddLLM: () => void;
  onAddImageGen: () => void;
  onAddVideoGen: () => void;
  onAddOutput: () => void;
  onImport: () => void;
  onExport: () => void;
  onRun: () => void;
};

export const FloatingActionBar: React.FC<Props> = ({
  onAddPrompt,
  onAddImage,
  onAddLLM,
  onAddImageGen,
  onAddVideoGen,
  onAddOutput,
  onImport,
  onExport,
  onRun,
}) => {
  const [showPalette, setShowPalette] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);

  const nodeActions = [
    { label: "Prompt", hint: "Text or instructions", onClick: onAddPrompt, Icon: MessageSquare },
    { label: "Image", hint: "Add an input image", onClick: onAddImage, Icon: ImageIcon },
    { label: "LLM", hint: "Generate or transform text", onClick: onAddLLM, Icon: Bot },
    { label: "Img Gen", hint: "Create new images", onClick: onAddImageGen, Icon: Sparkles },
    { label: "Video", hint: "Generate video clips", onClick: onAddVideoGen, Icon: Video },
    { label: "Output", hint: "Collect final results", onClick: onAddOutput, Icon: SquareStack },
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
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[320px] rounded-2xl border backdrop-blur-md overflow-hidden"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-elevated)",
              boxShadow: "var(--shadow-strong)",
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="text-[11px] uppercase tracking-wide mb-2 text-[var(--text-secondary)]">Quick Actions</div>
              <button
                onClick={() => {
                  onRun();
                  closeMenus();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 transition"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <ChevronUp size={16} />
                </span>
                <div className="text-left text-[var(--text-primary)]">
                  <div className="text-sm font-semibold">Run workflow</div>
                  <div className="text-xs text-[var(--text-secondary)]">Execute connected generators</div>
                </div>
              </button>
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Add nodes</div>
              {nodeActions.map(({ label, hint, onClick, Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    onClick();
                    closeMenus();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 transition"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl shadow-inner shadow-black/30"
                    style={{ backgroundColor: "var(--bg-muted)" }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="text-left text-[var(--text-primary)]">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showFileMenu && (
          <div
            className="absolute bottom-16 right-0 w-48 rounded-xl border backdrop-blur-md overflow-hidden"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-overlay)",
              boxShadow: "var(--shadow-strong)",
            }}
          >
            <div className="text-[11px] uppercase tracking-wide px-3 pt-3 pb-1 text-[var(--text-secondary)]">Workflow</div>
            <button
              onClick={() => {
                onImport();
                closeMenus();
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 transition text-[var(--text-primary)]"
            >
              Import JSON
            </button>
            <button
              onClick={() => {
                onExport();
                closeMenus();
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 transition text-[var(--text-primary)]"
            >
              Export JSON
            </button>
          </div>
        )}

        <div
          className="flex items-center gap-2 text-[var(--text-primary)] px-3 py-2 rounded-full border backdrop-blur-md"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-strong)",
          }}
        >
          <button
            onClick={onRun}
            className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-500 transition"
            aria-label="Run workflow"
          >
            <ChevronUp size={18} />
          </button>
          <div
            className="h-6 w-px"
            style={{ backgroundColor: "var(--border-subtle)" }}
          />
          <button
            onClick={() => {
              setShowPalette((v) => !v);
              setShowFileMenu(false);
            }}
            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/10 transition shadow-inner shadow-black/30 ring-1 ring-black/30"
            style={{ backgroundColor: "var(--bg-muted)" }}
            aria-label="Add nodes"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => {
              setShowFileMenu((v) => !v);
              setShowPalette(false);
            }}
            className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/10 transition shadow-inner shadow-black/30 ring-1 ring-black/30"
            style={{ backgroundColor: "var(--bg-muted)" }}
            aria-label="Import/Export"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
