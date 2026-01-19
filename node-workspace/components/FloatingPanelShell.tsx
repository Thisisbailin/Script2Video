import React from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  width?: number | string;
  children: React.ReactNode;
};

// Lightweight floating panel shell with backdrop, matching Assets glass style.
export const FloatingPanelShell: React.FC<Props> = ({
  title,
  isOpen,
  onClose,
  width = 900,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative max-h-[86vh] overflow-hidden rounded-3xl app-panel"
        style={{ width }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--app-border)]">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-panel-muted)] transition"
            aria-label="Close"
          >
            <X size={16} className="mx-auto text-[var(--app-text-secondary)]" />
          </button>
        </div>
        <div className="max-h-[calc(86vh-64px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
};
