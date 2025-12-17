import React, { useEffect } from "react";
import { create } from "zustand";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastState {
  message: string | null;
  type: ToastType;
  show: (msg: string, type?: ToastType) => void;
  clear: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  type: "info",
  show: (message, type = "info") => set({ message, type }),
  clear: () => set({ message: null }),
}));

export const Toast: React.FC = () => {
  const { message, type, clear } = useToast();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, 2500);
    return () => clearTimeout(t);
  }, [message, clear]);

  if (!message) return null;

  const colors: Record<ToastType, string> = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    warning: "bg-amber-600",
  };

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded text-white shadow-lg ${colors[type]}`}>
      {message}
    </div>
  );
};
