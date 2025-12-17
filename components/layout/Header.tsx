import React from "react";
import { Video, Download, ChevronDown, Sparkles, User, Shield, Sun, Moon, Settings, Trash2, LogOut, Upload } from "lucide-react";
import { AppConfig, ProjectData } from "../../types";

type HeaderProps = {
  isProcessing: boolean;
  hasGeneratedShots: boolean;
  onTryMe: () => void;
  onExportCsv: () => void;
  onExportXls: () => void;
  onToggleExportMenu: () => void;
  isExportMenuOpen: boolean;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  account: {
    isLoaded: boolean;
    isSignedIn: boolean;
    user?: any;
    onSignIn: () => void;
    onSignOut: () => void;
    onOpenSettings: () => void;
    onReset: () => void;
    isUserMenuOpen: boolean;
    setIsUserMenuOpen: (v: boolean) => void;
    onUploadAvatar?: () => void;
    avatarUrl?: string;
  };
  activeModelLabel: string;
  projectData: ProjectData;
  config: AppConfig;
};

export const Header: React.FC<HeaderProps> = ({
  isProcessing,
  hasGeneratedShots,
  onTryMe,
  onExportCsv,
  onExportXls,
  onToggleExportMenu,
  isExportMenuOpen,
  onToggleTheme,
  isDarkMode,
  account,
  activeModelLabel,
}) => {
  const { isLoaded, isSignedIn, user, onSignIn, onSignOut, onOpenSettings, onReset, isUserMenuOpen, setIsUserMenuOpen, onUploadAvatar, avatarUrl } = account;

  return (
    <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/50 backdrop-blur flex items-center justify-between px-6 shrink-0 z-20 transition-colors relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Video size={18} className="text-white" />
        </div>
        <h1 className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Script2Video</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
          {activeModelLabel}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onTryMe}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 dark:from-pink-900/50 dark:to-purple-900/50 hover:from-pink-500/20 hover:to-purple-500/20 dark:hover:from-pink-900/70 dark:hover:to-purple-900/70 border border-pink-200 dark:border-pink-700/30 rounded text-sm text-pink-600 dark:text-pink-200 font-bold disabled:opacity-50 transition-all shadow-sm"
          title="Generate a funny animal script to test the app!"
        >
          <Sparkles size={16} className="text-pink-500 dark:text-pink-400" />
          <span className="hidden sm:inline">Try Me</span>
        </button>

        {hasGeneratedShots && (
          <div className="relative">
            <button
              onClick={onToggleExportMenu}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors shadow-sm"
            >
              <Download size={16} /> Export <ChevronDown size={14} />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                <button
                  onClick={onExportCsv}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50 flex flex-col"
                >
                  <span className="font-medium">Export as CSV</span>
                  <span className="text-[10px] text-gray-500">Universal Format (Recommended)</span>
                </button>
                <button
                  onClick={onExportXls}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 flex flex-col"
                >
                  <span className="font-medium">Export as Excel (XLS)</span>
                  <span className="text-[10px] text-gray-500">Rich Formatting (HTML-based)</span>
                </button>
              </div>
            )}
            {isExportMenuOpen && <div className="fixed inset-0 z-40" onClick={onToggleExportMenu}></div>}
          </div>
        )}

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1"></div>

        <div className="relative min-w-[32px] min-h-[32px] flex items-center justify-center">
          {!isLoaded ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ring-2 ring-white dark:ring-gray-900"></div>
          ) : (
                  <>
                    {!isSignedIn && (
                        <button
                            onClick={onSignIn}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                >
                  <User size={16} /> <span className="hidden sm:inline">Sign In</span>
                </button>
              )}

                    {isSignedIn && user && (
                        <>
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center justify-center rounded-full hover:ring-2 ring-indigo-500 transition-all relative z-10"
                        >
                            <img
                                src={avatarUrl || user.imageUrl}
                                alt="Profile"
                                className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                            />
                        </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={user.imageUrl}
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                          />
                          <div className="overflow-hidden">
                            <div className="font-bold text-gray-900 dark:text-white truncate">
                              {user.fullName || user.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.primaryEmailAddress?.emailAddress}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <Shield size={12} />
                          <span>User Verified</span>
                        </div>
                      </div>

                        <div className="p-2 space-y-1">
                        {onUploadAvatar && (
                          <button
                            onClick={() => {
                              onUploadAvatar();
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Upload size={16} />
                            <span>Upload Avatar (Supabase)</span>
                          </button>
                        )}

                        <button
                          onClick={onToggleTheme}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                          <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                        </button>

                        <button
                          onClick={() => {
                            onOpenSettings();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Settings size={16} />
                          <span>System Settings</span>
                        </button>

                        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-2"></div>

                        <button
                          onClick={() => {
                            onReset();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={16} />
                          <span>Clear Project Data</span>
                        </button>

                        <button
                          onClick={() => {
                            onSignOut();
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {isUserMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
