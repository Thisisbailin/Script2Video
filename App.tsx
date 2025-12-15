
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, CheckCircle, FileText, Video, Download, AlertCircle, Loader2, RotateCcw, FileSpreadsheet, BarChart2, BrainCircuit, Palette, FolderOpen, Layers, Users, MapPin, MonitorPlay, Film, PanelLeftClose, PanelLeftOpen, Sparkles, Trash2, ChevronDown, List, ChevronUp, Sun, Moon, User, LogOut, Shield } from 'lucide-react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { ProjectData, AppConfig, WorkflowStep, Episode, Shot, TokenUsage, AnalysisSubStep, VideoParams } from './types';
import { INITIAL_PROJECT_DATA, INITIAL_VIDEO_CONFIG, INITIAL_TEXT_CONFIG, INITIAL_MULTIMODAL_CONFIG } from './constants';
import { parseScriptToEpisodes, exportToCSV, exportToXLS, parseCSVToShots } from './utils/parser';
import { SettingsModal } from './components/SettingsModal';
import { ShotTable } from './components/ShotTable';
import { Dashboard } from './components/Dashboard';
import { ContentBoard } from './components/ContentBoard';
import { VisualAssets } from './components/VisualAssets';
import { VideoStudio } from './components/VideoStudio';
import { AssetsBoard } from './components/AssetsBoard';
import * as GeminiService from './services/geminiService';
import * as VideoService from './services/videoService';

const PROJECT_STORAGE_KEY = 'script2video_project_v1';
const CONFIG_STORAGE_KEY = 'script2video_config_v1';
const UI_STATE_STORAGE_KEY = 'script2video_ui_state_v1';
const THEME_STORAGE_KEY = 'script2video_theme_v1';
const LOCAL_BACKUP_KEY = 'script2video_local_backup';
const REMOTE_BACKUP_KEY = 'script2video_remote_backup';

const App: React.FC = () => {
  // Clerk Auth Hooks
  const { isSignedIn, user, isLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();
  const { getToken } = useAuth();
  const projectDataRef = useRef<ProjectData>(INITIAL_PROJECT_DATA);

  // Initialize state with Lazy Initializers for Persistence

  const normalizeProjectData = (data: any): ProjectData => {
      const base: ProjectData = {
          ...INITIAL_PROJECT_DATA,
          ...data,
          context: { ...INITIAL_PROJECT_DATA.context, ...(data?.context || {}) },
          phase1Usage: { ...INITIAL_PROJECT_DATA.phase1Usage, ...(data?.phase1Usage || {}) },
          phase4Usage: data?.phase4Usage || INITIAL_PROJECT_DATA.phase4Usage,
          phase5Usage: data?.phase5Usage || INITIAL_PROJECT_DATA.phase5Usage,
          stats: { ...INITIAL_PROJECT_DATA.stats, ...(data?.stats || {}) }
      };
      base.episodes = Array.isArray(data?.episodes) ? data.episodes : [];
      base.shotGuide = data?.shotGuide || INITIAL_PROJECT_DATA.shotGuide;
      base.soraGuide = data?.soraGuide || INITIAL_PROJECT_DATA.soraGuide;
      base.globalStyleGuide = data?.globalStyleGuide || INITIAL_PROJECT_DATA.globalStyleGuide;
      base.rawScript = typeof data?.rawScript === 'string' ? data.rawScript : '';
      base.fileName = typeof data?.fileName === 'string' ? data.fileName : '';
      return base;
  };

  const [projectData, setProjectData] = useState<ProjectData>(() => {
      try {
          const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
          return saved ? normalizeProjectData(JSON.parse(saved)) : INITIAL_PROJECT_DATA;
      } catch (e) {
          console.error("Failed to load project from local storage", e);
          return INITIAL_PROJECT_DATA;
      }
  });

  const [config, setConfig] = useState<AppConfig>(() => {
      try {
          const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
          if (saved) {
              const parsed = JSON.parse(saved);
              return {
                  textConfig: { ...INITIAL_TEXT_CONFIG, ...parsed.textConfig },
                  videoConfig: { ...INITIAL_VIDEO_CONFIG, ...parsed.videoConfig },
                  multimodalConfig: { ...INITIAL_MULTIMODAL_CONFIG, ...parsed.multimodalConfig } // Merge new config
              };
          }
      } catch (e) {
          console.error("Failed to load config from local storage", e);
      }
      return { 
          textConfig: INITIAL_TEXT_CONFIG,
          videoConfig: INITIAL_VIDEO_CONFIG,
          multimodalConfig: INITIAL_MULTIMODAL_CONFIG
      };
  });

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
      try {
          const saved = localStorage.getItem(THEME_STORAGE_KEY);
          return saved ? JSON.parse(saved) : true; // Default to dark
      } catch {
          return true;
      }
  });

  // UI State Persistence Container
  const getSavedUIState = () => {
      try {
          const saved = localStorage.getItem(UI_STATE_STORAGE_KEY);
          return saved ? JSON.parse(saved) : null;
      } catch (e) {
          return null;
      }
  };
  const savedUI = getSavedUIState();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEpListExpanded, setIsEpListExpanded] = useState(true); 
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const syncSaveTimeout = useRef<number | null>(null);
  
  // Workflow State (Persisted)
  const [step, setStep] = useState<WorkflowStep>(savedUI?.step ?? WorkflowStep.IDLE);
  const [analysisStep, setAnalysisStep] = useState<AnalysisSubStep>(savedUI?.analysisStep ?? AnalysisSubStep.IDLE);
  const [currentEpIndex, setCurrentEpIndex] = useState(savedUI?.currentEpIndex ?? 0);
  const [activeTab, setActiveTab] = useState<'assets' | 'script' | 'understanding' | 'table' | 'visuals' | 'video' | 'stats'>(savedUI?.activeTab ?? 'assets');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  // Processing Queues for Phase 1 Batches
  const [analysisQueue, setAnalysisQueue] = useState<any[]>([]);
  const [analysisTotal, setAnalysisTotal] = useState(0);

  // --- Cloud Sync Helpers ---
  const dropFileReplacer = (_key: string, value: any) => {
      if (typeof File !== 'undefined' && value instanceof File) return undefined;
      return value;
  };
  const isProjectEmpty = (data: ProjectData) => {
      const hasEps = Array.isArray(data.episodes) && data.episodes.length > 0;
      const hasScript = !!(data.rawScript && data.rawScript.trim().length > 0);
      return !hasEps && !hasScript;
  };
  const backupData = (key: string, data: ProjectData) => {
      try {
          localStorage.setItem(key, JSON.stringify(data, dropFileReplacer));
      } catch (e) {
          console.warn(`Failed to backup data to ${key}`, e);
      }
  };

  // --- Persistence Effects ---
  useEffect(() => {
      try {
          localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectData));
      } catch (e) {
          console.error("Failed to save project to local storage (quota exceeded?)", e);
      }
  }, [projectData]);
  useEffect(() => {
      projectDataRef.current = projectData;
  }, [projectData]);

  useEffect(() => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
      const uiState = { step, analysisStep, currentEpIndex, activeTab };
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(uiState));
  }, [step, analysisStep, currentEpIndex, activeTab]);

  useEffect(() => {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // --- Cloud Sync (Clerk + Cloudflare Pages) ---
  useEffect(() => {
      if (!isSignedIn) {
          setHasLoadedRemote(false);
      }
  }, [isSignedIn]);

  useEffect(() => {
      if (!isSignedIn || !isLoaded || hasLoadedRemote) return;
      let cancelled = false;

      const loadRemote = async () => {
          try {
              const token = await getToken();
              if (!token) return;
              const res = await fetch('/api/project', {
                  headers: { authorization: `Bearer ${token}` }
              });

              if (res.status === 404) {
                  if (!cancelled) setHasLoadedRemote(true);
                  return;
              }

              if (!res.ok) {
                  throw new Error(`Load failed: ${res.status}`);
              }

              const data = await res.json();
              if (!cancelled && data.projectData) {
                  const remote = normalizeProjectData(data.projectData);
                  const local = projectDataRef.current;
                  const remoteHas = !isProjectEmpty(remote);
                  const localHas = !isProjectEmpty(local);

                  if (remoteHas && localHas) {
                      const useRemote = window.confirm(
                        "检测到云端和本地均有数据。\n确定：使用云端覆盖本地（本地备份会保留）\n取消：保留本地并上传到云端（云端数据将备份）"
                      );
                      if (useRemote) {
                          backupData(LOCAL_BACKUP_KEY, local);
                          setProjectData(remote);
                      } else {
                          backupData(REMOTE_BACKUP_KEY, remote);
                          // 保留本地，后续自动保存会推送到云端
                      }
                  } else if (remoteHas) {
                      setProjectData(remote);
                  }
              }
              if (!cancelled) setHasLoadedRemote(true);
          } catch (e) {
              if (!cancelled) {
                  console.warn("Cloud sync load failed", e);
                  // Allow subsequent saves even if initial load failed
                  setHasLoadedRemote(true);
              }
          }
      };

      loadRemote();

      return () => {
          cancelled = true;
      };
  }, [isSignedIn, isLoaded, hasLoadedRemote, getToken]);

  useEffect(() => {
      if (!isSignedIn || !isLoaded || !hasLoadedRemote) return;

      if (syncSaveTimeout.current) {
          clearTimeout(syncSaveTimeout.current);
      }

      syncSaveTimeout.current = window.setTimeout(async () => {
          try {
              const token = await getToken();
              if (!token) return;

              await fetch('/api/project', {
                  method: 'PUT',
                  headers: {
                      'content-type': 'application/json',
                      authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ projectData }, dropFileReplacer)
              });
          } catch (e) {
              console.warn("Cloud sync save failed", e);
          }
      }, 1200);

      return () => {
          if (syncSaveTimeout.current) {
              clearTimeout(syncSaveTimeout.current);
          }
      };
  }, [projectData, isSignedIn, isLoaded, hasLoadedRemote, getToken]);

  // Clamp current episode index when episodes change (e.g., after remote sync)
  useEffect(() => {
      if (projectData.episodes.length === 0) {
          setCurrentEpIndex(0);
      } else if (currentEpIndex >= projectData.episodes.length) {
          setCurrentEpIndex(0);
      }
  }, [projectData.episodes.length]);

  // --- GLOBAL VIDEO TASK POLLING LOOP ---
  useEffect(() => {
      const intervalId = setInterval(async () => {
          // Identify shots that need checking
          const tasksToCheck: { epId: number, shotId: string, taskId: string }[] = [];
          
          projectData.episodes.forEach(ep => {
              ep.shots.forEach(s => {
                  if ((s.videoStatus === 'queued' || s.videoStatus === 'generating') && s.videoId) {
                      tasksToCheck.push({ epId: ep.id, shotId: s.id, taskId: s.videoId });
                  }
              });
          });

          if (tasksToCheck.length === 0) return;

          // Check tasks (limit concurrency if needed, but 5-10 concurrent requests usually ok)
          // We do them sequentially or in small batches to avoid flooding
          for (const task of tasksToCheck) {
              if (!config.videoConfig.baseUrl || !config.videoConfig.apiKey) continue;

              try {
                  const result = await VideoService.checkTaskStatus(task.taskId, config.videoConfig);
                  
                  // Only update state if status changed or URL became available
                  if (result.status !== 'processing' && result.status !== 'queued') {
                      setProjectData(prev => {
                          const newEpisodes = prev.episodes.map(e => {
                              if (e.id === task.epId) {
                                  return {
                                      ...e,
                                      shots: e.shots.map(s => s.id === task.shotId ? {
                                          ...s,
                                          videoStatus: result.status === 'succeeded' ? 'completed' : 'error',
                                          videoUrl: result.url,
                                          videoErrorMsg: result.errorMsg,
                                          // Keep start time for duration calc if needed
                                      } : s)
                                  } as Episode;
                              }
                              return e;
                          });
                          return { ...prev, episodes: newEpisodes };
                      });
                  } 
                  // If status changed from queued to processing, update that
                  else if (result.status === 'processing') {
                       setProjectData(prev => {
                          const currentEp = prev.episodes.find(e => e.id === task.epId);
                          const currentShot = currentEp?.shots.find(s => s.id === task.shotId);
                          
                          if (currentShot && currentShot.videoStatus === 'queued') {
                               const newEpisodes = prev.episodes.map(e => {
                                  if (e.id === task.epId) {
                                      return {
                                          ...e,
                                          shots: e.shots.map(s => s.id === task.shotId ? {
                                              ...s,
                                              videoStatus: 'generating'
                                          } : s)
                                      } as Episode;
                                  }
                                  return e;
                              });
                              return { ...prev, episodes: newEpisodes };
                          }
                          return prev;
                       });
                  }
              } catch (e) {
                  console.warn("Polling error for task " + task.taskId, e);
              }
          }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(intervalId);
  }, [projectData, config.videoConfig]);


  // Load default guides on mount (only if not already loaded)
  useEffect(() => {
    if (!projectData.shotGuide || !projectData.soraGuide) {
        const loadDefaultGuides = async () => {
        try {
            const [shotRes, soraRes] = await Promise.all([
            fetch('guides/ShotGuide.md'),
            fetch('guides/PromptGuide.md')
            ]);
            
            if (shotRes.ok && soraRes.ok) {
            const shotText = await shotRes.text();
            const soraText = await soraRes.text();
            setProjectData(prev => ({
                ...prev,
                shotGuide: prev.shotGuide || shotText, // Only set if empty
                soraGuide: prev.soraGuide || soraText
            }));
            }
        } catch (e) {
            console.error("Error loading default guides:", e);
        }
        };
        loadDefaultGuides();
    }
  }, []);

  // --- Helper: Stats Updater ---
  const updateStats = (phase: 'context' | 'shotGen' | 'soraGen', success: boolean) => {
    setProjectData(prev => {
        const stats = { ...prev.stats };
        stats[phase].total += 1;
        if (success) stats[phase].success += 1;
        else stats[phase].error += 1;
        return { ...prev, stats };
    });
  };

  // --- New Helper: Usage Updater for Phase 4 ---
  const handleUsageUpdate = (newUsage: TokenUsage) => {
      setProjectData(prev => ({
          ...prev,
          phase4Usage: GeminiService.addUsage(prev.phase4Usage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 }, newUsage)
      }));
  };

  // --- Handlers ---

  const handleResetProject = () => {
      if (window.confirm("Are you sure you want to RESET the entire project? \n\nThis will clear all scripts, shots, and generated data from your browser cache. This action cannot be undone.")) {
          setProjectData(INITIAL_PROJECT_DATA);
          setStep(WorkflowStep.IDLE);
          setAnalysisStep(AnalysisSubStep.IDLE);
          setCurrentEpIndex(0);
          setActiveTab('assets');
          localStorage.removeItem(PROJECT_STORAGE_KEY);
          localStorage.removeItem(UI_STATE_STORAGE_KEY);
          window.location.reload(); 
      }
  };

  const handleAssetLoad = (type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'csvShots', content: string, fileName?: string) => {
      if (type === 'script') {
        const episodes = parseScriptToEpisodes(content);
        setProjectData(prev => ({ ...prev, fileName: fileName || 'script.txt', rawScript: content, episodes }));
        if (episodes.length > 0) setCurrentEpIndex(0);
        setActiveTab('script');
      
      } else if (type === 'csvShots') {
        try {
          const shotMap = parseCSVToShots(content);
          setProjectData(prev => {
            const updatedEpisodes = prev.episodes.map(ep => {
              const matchedShots = shotMap.get(ep.title);
              if (matchedShots && matchedShots.length > 0) {
                return {
                  ...ep,
                  shots: matchedShots,
                  status: matchedShots[0].soraPrompt ? 'completed' : 'confirmed_shots'
                } as Episode;
              }
              return ep;
            });
            return { ...prev, episodes: updatedEpisodes };
          });
          alert(`Successfully imported shots for ${shotMap.size} episodes.`);
          setActiveTab('table');
        } catch (e: any) {
          alert("Error importing CSV: " + e.message);
        }

      } else if (type === 'globalStyleGuide') {
        setProjectData(prev => ({ ...prev, globalStyleGuide: content }));
      } else if (type === 'shotGuide') {
        setProjectData(prev => ({ ...prev, shotGuide: content }));
      } else if (type === 'soraGuide') {
        setProjectData(prev => ({ ...prev, soraGuide: content }));
      }
  };

  const handleTryMe = async () => {
      setIsProcessing(true);
      setProcessingStatus("Concocting a hilarious script with AI...");
      
      try {
          // 1. Generate Script AND Style
          const result = await GeminiService.generateDemoScript(config.textConfig);
          
          // 2. Parse it like a normal file
          const episodes = parseScriptToEpisodes(result.script);
          
          // 3. Update State
          setProjectData(prev => ({
              ...prev,
              fileName: 'AI_Generated_Joke.txt',
              rawScript: result.script,
              episodes: episodes,
              // Apply the AI generated visual style
              globalStyleGuide: result.styleGuide, 
              // Track usage as Context/Analysis cost for now (Phase 1 & General)
              contextUsage: GeminiService.addUsage(prev.contextUsage || {promptTokens:0,responseTokens:0,totalTokens:0}, result.usage),
              stats: {
                  ...prev.stats,
                  context: { 
                      total: prev.stats.context.total + 1, 
                      success: prev.stats.context.success + 1, 
                      error: prev.stats.context.error 
                  }
              }
          }));
          
          if (episodes.length > 0) setCurrentEpIndex(0);
          setActiveTab('script');
          setStep(WorkflowStep.IDLE);
          setIsProcessing(false);
          
      } catch (e: any) {
          console.error(e);
          setIsProcessing(false);
          alert("Failed to generate demo script: " + e.message);
          updateStats('context', false);
      }
  };

  // --- Workflow Logic ---

  // === PHASE 1: DEEP UNDERSTANDING WORKFLOW (Batched) ===

  const startAnalysis = () => {
    setStep(WorkflowStep.SETUP_CONTEXT);
    setAnalysisStep(AnalysisSubStep.PROJECT_SUMMARY);
    processProjectSummary();
  };

  // Step 1: Project Summary
  const processProjectSummary = async () => {
    setIsProcessing(true);
    setProcessingStatus("Step 1/6: Analyzing Global Project Arc...");
    setActiveTab('understanding');
    try {
        const result = await GeminiService.generateProjectSummary(config.textConfig, projectData.rawScript, projectData.globalStyleGuide);
        
        setProjectData(prev => ({
            ...prev,
            context: { ...prev.context, projectSummary: result.projectSummary },
            contextUsage: GeminiService.addUsage(prev.contextUsage || {promptTokens:0,responseTokens:0,totalTokens:0}, result.usage),
            phase1Usage: { ...prev.phase1Usage, projectSummary: GeminiService.addUsage(prev.phase1Usage.projectSummary, result.usage) }
        }));
        
        setIsProcessing(false);
        updateStats('context', true);
    } catch (e: any) {
        setIsProcessing(false);
        alert("Project summary failed: " + e.message);
        updateStats('context', false);
    }
  };

  const confirmSummaryAndNext = () => {
      // Prepare batch for Episode Summaries
      const epQueue = projectData.episodes.map(ep => ep.id);
      setAnalysisQueue(epQueue);
      setAnalysisTotal(epQueue.length);
      setAnalysisStep(AnalysisSubStep.EPISODE_SUMMARIES);
  };

  // Step 2: Episode Summaries (Batched 1-by-1 for Detail)
  useEffect(() => {
    if (analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && analysisQueue.length > 0 && !isProcessing) {
        processNextEpisodeSummary();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextEpisodeSummary = async () => {
      const epId = analysisQueue[0];
      const episode = projectData.episodes.find(e => e.id === epId);
      if (!episode) {
          setAnalysisQueue(prev => prev.slice(1));
          return;
      }

      setIsProcessing(true);
      setProcessingStatus(`Step 2/6: Analyzing Episode ${epId} (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);

      try {
          const result = await GeminiService.generateEpisodeSummary(
             config.textConfig, 
             episode.title, 
             episode.content, 
             projectData.context.projectSummary
          );

          setProjectData(prev => {
              const updatedEps = prev.episodes.map(e => e.id === epId ? { ...e, summary: result.summary } : e);
              const updatedContextEpSummaries = [...prev.context.episodeSummaries, { episodeId: epId, summary: result.summary }];
              
              return {
                  ...prev,
                  episodes: updatedEps,
                  context: { ...prev.context, episodeSummaries: updatedContextEpSummaries },
                  contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
                  phase1Usage: { ...prev.phase1Usage, episodeSummaries: GeminiService.addUsage(prev.phase1Usage.episodeSummaries, result.usage) }
              };
          });

          setAnalysisQueue(prev => prev.slice(1));
          setIsProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setIsProcessing(false);
          const ignore = window.confirm(`Failed to summarize Episode ${epId}: ${e.message}. Skip this episode?`);
          if (ignore) {
             setAnalysisQueue(prev => prev.slice(1));
             updateStats('context', false);
          }
      }
  };

  const confirmEpSummariesAndNext = () => {
      setAnalysisStep(AnalysisSubStep.CHAR_IDENTIFICATION);
      processCharacterList();
  };

  // Step 3: Character List
  const processCharacterList = async () => {
      setIsProcessing(true);
      setProcessingStatus("Step 3/6: Identifying Character Roster...");
      try {
          const result = await GeminiService.identifyCharacters(config.textConfig, projectData.rawScript, projectData.context.projectSummary);
          setProjectData(prev => ({
              ...prev,
              context: { ...prev.context, characters: result.characters },
              contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
              phase1Usage: { ...prev.phase1Usage, charList: GeminiService.addUsage(prev.phase1Usage.charList, result.usage) }
          }));
          setIsProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setIsProcessing(false);
          alert("Character list generation failed: " + e.message);
          updateStats('context', false);
      }
  };

  const confirmCharListAndNext = () => {
      // Setup Queue for deep dive
      const mainChars = projectData.context.characters.filter(c => c.isMain).map(c => c.name);
      setAnalysisQueue(mainChars);
      setAnalysisTotal(mainChars.length);
      setAnalysisStep(AnalysisSubStep.CHAR_DEEP_DIVE);
  };

  // Step 4: Character Deep Dive
  useEffect(() => {
    if (analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && analysisQueue.length > 0 && !isProcessing) {
        processNextCharacter();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextCharacter = async () => {
      const charName = analysisQueue[0];
      setIsProcessing(true);
      setProcessingStatus(`Step 4/6: Deep Analysis for '${charName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);
      
      try {
          const result = await GeminiService.analyzeCharacterDepth(
              config.textConfig, 
              charName, 
              projectData.rawScript, 
              projectData.context.projectSummary, 
              projectData.globalStyleGuide
          );
          
          setProjectData(prev => {
              const updatedChars = prev.context.characters.map(c => 
                  c.name === charName ? { ...c, forms: result.forms } : c
              );
              return {
                  ...prev,
                  context: { ...prev.context, characters: updatedChars },
                  contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
                  phase1Usage: { ...prev.phase1Usage, charDeepDive: GeminiService.addUsage(prev.phase1Usage.charDeepDive, result.usage) }
              };
          });

          setAnalysisQueue(prev => prev.slice(1));
          setIsProcessing(false);
          updateStats('context', true);

      } catch (e: any) {
          console.error(e);
          setIsProcessing(false);
          const ignore = window.confirm(`Failed to analyze ${charName}: ${e.message}. Skip?`);
          if (ignore) {
             setAnalysisQueue(prev => prev.slice(1));
             updateStats('context', false);
          }
      }
  };

  const confirmCharDepthAndNext = () => {
      setAnalysisStep(AnalysisSubStep.LOC_IDENTIFICATION);
      processLocationList();
  };

  // Step 5: Location List
  const processLocationList = async () => {
      setIsProcessing(true);
      setProcessingStatus("Step 5/6: Mapping Locations...");
      try {
          const result = await GeminiService.identifyLocations(config.textConfig, projectData.rawScript, projectData.context.projectSummary);
          setProjectData(prev => ({
              ...prev,
              context: { ...prev.context, locations: result.locations },
              contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
              phase1Usage: { ...prev.phase1Usage, locList: GeminiService.addUsage(prev.phase1Usage.locList, result.usage) }
          }));
          setIsProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setIsProcessing(false);
          alert("Location mapping failed: " + e.message);
          updateStats('context', false);
      }
  };

  const confirmLocListAndNext = () => {
      const coreLocs = projectData.context.locations.filter(l => l.type === 'core').map(l => l.name);
      setAnalysisQueue(coreLocs);
      setAnalysisTotal(coreLocs.length);
      setAnalysisStep(AnalysisSubStep.LOC_DEEP_DIVE);
  };

  // Step 6: Location Deep Dive
   useEffect(() => {
    if (analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && analysisQueue.length > 0 && !isProcessing) {
        processNextLocation();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextLocation = async () => {
      const locName = analysisQueue[0];
      setIsProcessing(true);
      setProcessingStatus(`Step 6/6: Visualizing '${locName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);
      
      try {
          const result = await GeminiService.analyzeLocationDepth(
              config.textConfig, 
              locName, 
              projectData.rawScript, 
              projectData.globalStyleGuide
          );
          
          setProjectData(prev => {
              const updatedLocs = prev.context.locations.map(l => 
                  l.name === locName ? { ...l, visuals: result.visuals } : l
              );
              return {
                  ...prev,
                  context: { ...prev.context, locations: updatedLocs },
                  contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
                  phase1Usage: { ...prev.phase1Usage, locDeepDive: GeminiService.addUsage(prev.phase1Usage.locDeepDive, result.usage) }
              };
          });

          setAnalysisQueue(prev => prev.slice(1));
          setIsProcessing(false);
          updateStats('context', true);

      } catch (e: any) {
          setIsProcessing(false);
          const ignore = window.confirm(`Failed to visualize ${locName}: ${e.message}. Skip?`);
          if (ignore) {
             setAnalysisQueue(prev => prev.slice(1));
             updateStats('context', false);
          }
      }
  };

  const finishAnalysis = () => {
      setAnalysisStep(AnalysisSubStep.COMPLETE);
      alert("Phase 1 Complete! Context is fully established.");
  };

  // === PHASE 2 & 3 ===

  const startPhase2 = () => {
    const allEpisodesHaveShots = projectData.episodes.every(ep => ep.shots.length > 0);
    
    if (allEpisodesHaveShots) {
      const confirmSkip = window.confirm(
        "Detected existing shot lists for all episodes (likely from import).\n\nDo you want to SKIP Shot Generation and proceed directly to Phase 3 (Sora Prompts)?"
      );
      if (confirmSkip) {
        setStep(WorkflowStep.GENERATE_SORA);
        return;
      }
    }

    setStep(WorkflowStep.GENERATE_SHOTS);
    setCurrentEpIndex(0);
    const firstPending = projectData.episodes.findIndex(ep => ep.shots.length === 0);
    const startIdx = firstPending >= 0 ? firstPending : 0;
    setCurrentEpIndex(startIdx);
    
    if (firstPending === -1 && !allEpisodesHaveShots) {
        generateCurrentEpisodeShots(0);
    } else if (firstPending >= 0) {
        generateCurrentEpisodeShots(startIdx);
    } else {
        generateCurrentEpisodeShots(0);
    }
  };

  const generateCurrentEpisodeShots = async (index: number) => {
    if (index >= projectData.episodes.length) {
      setStep(WorkflowStep.GENERATE_SORA); 
      alert("All episodes converted to Shot Lists! Ready for Sora Phase.");
      setCurrentEpIndex(0);
      return;
    }

    const episode = projectData.episodes[index];
    if (episode.shots.length > 0 && (episode.status === 'confirmed_shots' || episode.status === 'completed')) {
        const next = index + 1;
        setCurrentEpIndex(next);
        generateCurrentEpisodeShots(next);
        return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Generating Shots for Episode ${episode.id}...`);
    
    setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = { ...newEpisodes[index], status: 'generating', errorMsg: undefined };
        return { ...prev, episodes: newEpisodes };
    });

    try {
      const result = await GeminiService.generateEpisodeShots(
        config.textConfig,
        episode.title,
        episode.content,
        episode.summary,
        projectData.context,
        projectData.shotGuide,
        index,
        projectData.globalStyleGuide
      );

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          shots: result.shots,
          shotGenUsage: result.usage,
          status: 'review_shots'
        };
        return { ...prev, episodes: newEpisodes };
      });
      setIsProcessing(false);
      updateStats('shotGen', true);
      setActiveTab('table'); 
    } catch (e: any) {
      console.error(e);
      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          status: 'error',
          errorMsg: e.message || "Unknown error"
        };
        return { ...prev, episodes: newEpisodes };
      });
      setProcessingStatus(`Error on Episode ${episode.id}`);
      setIsProcessing(false);
      updateStats('shotGen', false);
    }
  };

  const confirmEpisodeShots = () => {
    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      newEpisodes[currentEpIndex].status = 'confirmed_shots';
      return { ...prev, episodes: newEpisodes };
    });
    
    const nextIndex = currentEpIndex + 1;
    if (nextIndex < projectData.episodes.length) {
       setCurrentEpIndex(nextIndex);
       generateCurrentEpisodeShots(nextIndex);
    } else {
       alert("Phase 2 Complete! Please upload Sora Guide to proceed.");
       setStep(WorkflowStep.GENERATE_SORA);
       setCurrentEpIndex(0);
    }
  };

  const startPhase3 = () => {
    if (!projectData.soraGuide) {
      alert("Please upload Sora Prompt Guidelines.");
      return;
    }
    if (projectData.episodes.every(ep => ep.shots.length === 0)) {
        alert("No shots found to generate prompts for. Please complete Phase 2 or Import a Shot List CSV.");
        return;
    }
    setCurrentEpIndex(0);
    generateCurrentEpisodeSora(0);
  };

  const generateCurrentEpisodeSora = async (index: number) => {
    if (index >= projectData.episodes.length) {
      setStep(WorkflowStep.COMPLETED);
      alert("All Prompts Generated! Workflow is ready for Video Studio.");
      setCurrentEpIndex(0);
      return;
    }

    const episode = projectData.episodes[index];
    if (episode.shots.length === 0) {
      const next = index + 1;
      setCurrentEpIndex(next);
      generateCurrentEpisodeSora(next);
      return;
    }

    const shouldResume = episode.status === 'error';
    setIsProcessing(true);
    setProcessingStatus(`Generating Sora Prompts for Episode ${episode.id}...`);
    
    setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = { ...newEpisodes[index], status: 'generating_sora', errorMsg: undefined };
        return { ...prev, episodes: newEpisodes };
    });

    try {
      const chunksMap = new Map<string, Shot[]>();
      episode.shots.forEach(shot => {
         const parts = shot.id.split('-');
         let sceneKey = 'default';
         if (parts.length > 1) {
            const prefixParts = parts.slice(0, parts.length - 1);
            sceneKey = prefixParts.join('-');
         }
         if (!chunksMap.has(sceneKey)) chunksMap.set(sceneKey, []);
         chunksMap.get(sceneKey)?.push(shot);
      });
      const shotChunks: Shot[][] = Array.from(chunksMap.values());

      let currentTotalUsage: TokenUsage = shouldResume && episode.soraGenUsage 
          ? episode.soraGenUsage 
          : { promptTokens: 0, responseTokens: 0, totalTokens: 0 };
      
      for (let i = 0; i < shotChunks.length; i++) {
         const chunk = shotChunks[i];
         const sceneId = chunk[0].id.split('-').slice(0, -1).join('-');
         const isChunkComplete = chunk.every(s => s.soraPrompt && s.soraPrompt.trim().length > 0);
         if (shouldResume && isChunkComplete) {
             setProcessingStatus(`Skipping completed Scene ${sceneId} (${i+1}/${shotChunks.length})...`);
             await new Promise(r => setTimeout(r, 100));
             continue;
         }

         setProcessingStatus(`Episode ${episode.id}: Processing Scene ${sceneId} (${i+1}/${shotChunks.length})...`);
         
         const result = await GeminiService.generateSoraPrompts(
             config.textConfig,
             chunk,
             projectData.context,
             projectData.soraGuide,
             projectData.globalStyleGuide
         );

         currentTotalUsage = GeminiService.addUsage(currentTotalUsage, result.usage);

         setProjectData(prev => {
             const newEpisodes = [...prev.episodes];
             const currentEp = newEpisodes[index];
             const mergedShots = currentEp.shots.map(originalShot => {
                 const foundNew = result.partialShots.find(ns => ns.id === originalShot.id);
                 if (foundNew) {
                     return { ...originalShot, soraPrompt: foundNew.soraPrompt };
                 }
                 return originalShot;
             });

             newEpisodes[index] = {
                 ...currentEp,
                 shots: mergedShots,
                 soraGenUsage: currentTotalUsage
             };
             return { ...prev, episodes: newEpisodes };
         });
         await new Promise(r => setTimeout(r, 500));
      }

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
            ...newEpisodes[index],
            soraGenUsage: currentTotalUsage,
            status: 'review_sora'
        };
        return { ...prev, episodes: newEpisodes };
      });

      setIsProcessing(false);
      updateStats('soraGen', true);
      setActiveTab('table');
    } catch (e: any) {
      console.error(e);
      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          status: 'error',
          errorMsg: e.message || "Unknown error"
        };
        return { ...prev, episodes: newEpisodes };
      });
      setProcessingStatus(`Error on Episode ${episode.id}`);
      setIsProcessing(false);
      updateStats('soraGen', false);
    }
  };

  // === PHASE 5: VIDEO GENERATION ===
  const handleGenerateVideo = async (episodeId: number, shotId: string, customPrompt: string, params: VideoParams) => {
      if (!config.videoConfig.apiKey || !config.videoConfig.baseUrl) {
          alert("Video API settings missing. Please open Settings -> Video Generation.");
          setIsSettingsOpen(true);
          return;
      }

      // Ad-hoc Logic
      if (episodeId === -1) {
          const playgroundId = -1;
          let playgroundEpIndex = projectData.episodes.findIndex(e => e.id === playgroundId);
          
          if (playgroundEpIndex === -1) {
              const playgroundEp: Episode = {
                  id: playgroundId,
                  title: "Creative Playground",
                  content: "Ad-hoc generations",
                  scenes: [],
                  shots: [],
                  status: 'completed'
              };
              setProjectData(prev => ({
                  ...prev,
                  episodes: [...prev.episodes, playgroundEp]
              }));
              playgroundEpIndex = projectData.episodes.length;
          }

          const newShotId = `gen-${Date.now()}`;
          const newShot: Shot = {
              id: newShotId,
              duration: params.duration || '4s',
              shotType: 'Custom',
              movement: 'Custom',
              description: 'Ad-hoc generation',
              dialogue: '',
              soraPrompt: customPrompt,
              finalVideoPrompt: customPrompt,
              videoStatus: 'queued',
              videoParams: params,
              videoStartTime: Date.now()
          };

          setProjectData(prev => {
              const episodesCopy = [...prev.episodes];
              let existingPlayground = episodesCopy.find(e => e.id === playgroundId);
              if (!existingPlayground) {
                  existingPlayground = {
                      id: playgroundId,
                      title: "Creative Playground",
                      content: "Ad-hoc generations",
                      scenes: [],
                      shots: [],
                      status: 'completed'
                  };
                  episodesCopy.push(existingPlayground);
              }
              existingPlayground.shots = [...existingPlayground.shots, newShot];
              return { ...prev, episodes: episodesCopy };
          });

          try {
              const { id } = await VideoService.submitVideoTask(customPrompt, config.videoConfig, params);
              setProjectData(prev => {
                  const episodesCopy = prev.episodes.map(e => {
                      if (e.id === playgroundId) {
                          return {
                              ...e,
                              shots: e.shots.map(s => s.id === newShotId ? {
                                  ...s,
                                  videoId: id
                              } : s)
                          } as Episode;
                      }
                      return e;
                  });
                  return { ...prev, episodes: episodesCopy };
              });
          } catch (e: any) {
               setProjectData(prev => {
                  const episodesCopy = prev.episodes.map(ep => {
                      if (ep.id === playgroundId) {
                          return {
                              ...ep,
                              shots: ep.shots.map(s => s.id === newShotId ? {
                                  ...s,
                                  videoStatus: 'error',
                                  videoErrorMsg: e.message
                              } : s)
                          } as Episode;
                      }
                      return ep;
                  });
                  return { ...prev, episodes: episodesCopy };
              });
          }
          return;
      }

      // Standard Logic
      const episode = projectData.episodes.find(e => e.id === episodeId);
      if(!episode) return;
      const shot = episode.shots.find(s => s.id === shotId);
      if(!shot) return;

      setProjectData(prev => {
         const newEpisodes = prev.episodes.map(e => {
             if (e.id === episodeId) {
                 return {
                     ...e,
                     shots: e.shots.map(s => s.id === shotId ? { 
                         ...s, 
                         videoStatus: 'queued', 
                         videoErrorMsg: undefined,
                         finalVideoPrompt: customPrompt,
                         videoParams: params,
                         videoStartTime: Date.now()
                     } : s)
                 } as Episode;
             }
             return e;
         });
         return { ...prev, episodes: newEpisodes };
      });

      try {
          const { id } = await VideoService.submitVideoTask(customPrompt, config.videoConfig, params);
           setProjectData(prev => {
            const newEpisodes = prev.episodes.map(e => {
                if (e.id === episodeId) {
                    return {
                        ...e,
                        shots: e.shots.map(s => s.id === shotId ? { 
                            ...s, 
                            videoStatus: 'queued', 
                            videoId: id,
                        } : s)
                    } as Episode;
                }
                return e;
            });
            return { ...prev, episodes: newEpisodes };
          });
      } catch (e: any) {
          setProjectData(prev => {
            const newEpisodes = prev.episodes.map(ep => {
                if (ep.id === episodeId) {
                    return {
                        ...ep,
                        shots: ep.shots.map(s => s.id === shotId ? { ...s, videoStatus: 'error', videoErrorMsg: e.message } : s)
                    } as Episode;
                }
                return ep;
            });
            return { ...prev, episodes: newEpisodes };
          });
      }
  };

  const handleRemixVideo = async (episodeId: number, shotId: string, customPrompt: string, originalVideoId: string) => {
      if (!config.videoConfig.apiKey || !config.videoConfig.baseUrl) return;

      setProjectData(prev => {
         const newEpisodes = prev.episodes.map(e => {
             if (e.id === episodeId) {
                 return {
                     ...e,
                     shots: e.shots.map(s => s.id === shotId ? { 
                         ...s, 
                         videoStatus: 'queued', 
                         videoErrorMsg: undefined,
                         finalVideoPrompt: customPrompt,
                         videoStartTime: Date.now()
                     } : s)
                 } as Episode;
             }
             return e;
         });
         return { ...prev, episodes: newEpisodes };
      });

      try {
          const { id } = await VideoService.remixVideo(originalVideoId, customPrompt, config.videoConfig);
          setProjectData(prev => {
            const newEpisodes = prev.episodes.map(e => {
                if (e.id === episodeId) {
                    return {
                        ...e,
                        shots: e.shots.map(s => s.id === shotId ? { 
                            ...s, 
                            videoStatus: 'queued', 
                            videoId: id
                        } : s)
                    } as Episode;
                }
                return e;
            });
            return { ...prev, episodes: newEpisodes };
          });
      } catch (e: any) {
          setProjectData(prev => {
            const newEpisodes = prev.episodes.map(ep => {
                if (ep.id === episodeId) {
                    return {
                        ...ep,
                        shots: ep.shots.map(s => s.id === shotId ? { ...s, videoStatus: 'error', videoErrorMsg: e.message } : s)
                    } as Episode;
                }
                return ep;
            });
            return { ...prev, episodes: newEpisodes };
          });
      }
  };

  // --- Render Helpers ---
  const currentEpisode = projectData.episodes[currentEpIndex];
  const hasGeneratedShots = projectData.episodes.some(ep => ep.shots.length > 0);
  const getActiveModelName = () => {
      if (activeTab === 'visuals') return config.multimodalConfig.model || 'Multimodal';
      if (activeTab === 'video') return config.videoConfig.model || 'Video';
      return config.textConfig.model; 
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen flex flex-col`}>
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />

      {/* Header */}
      <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/50 backdrop-blur flex items-center justify-between px-6 shrink-0 z-20 transition-colors relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Video size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">Script2Video</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
             {config.textConfig.provider === 'gemini' ? 'Gemini' : 'OpenRouter'} | {getActiveModelName()}
          </span>
        </div>

        <div className="flex items-center gap-4">
           {/* TRY ME EGG MOVED HERE */}
           <button 
                onClick={handleTryMe}
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
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium transition-colors shadow-sm"
                 >
                    <Download size={16} /> Export <ChevronDown size={14} />
                 </button>
                 {isExportMenuOpen && (
                     <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                         <button 
                            onClick={() => {
                                exportToCSV(projectData.episodes);
                                setIsExportMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700/50 flex flex-col"
                         >
                             <span className="font-medium">Export as CSV</span>
                             <span className="text-[10px] text-gray-500">Universal Format (Recommended)</span>
                         </button>
                         <button 
                            onClick={() => {
                                exportToXLS(projectData.episodes);
                                setIsExportMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 flex flex-col"
                         >
                             <span className="font-medium">Export as Excel (XLS)</span>
                             <span className="text-[10px] text-gray-500">Rich Formatting (HTML-based)</span>
                         </button>
                     </div>
                 )}
                 {isExportMenuOpen && (
                     <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsExportMenuOpen(false)}
                     ></div>
                 )}
             </div>
           )}
           
           <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1"></div>

           {/* ACCOUNT DROPDOWN */}
           <div className="relative min-w-[32px] min-h-[32px] flex items-center justify-center">
               {!isLoaded ? (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ring-2 ring-white dark:ring-gray-900"></div>
               ) : (
                  <>
                    {!isSignedIn && (
                        <button 
                            onClick={() => openSignIn()}
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
                                src={user.imageUrl} 
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
                                    <button 
                                        onClick={() => {
                                            setIsDarkMode(!isDarkMode);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                                        <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                                    </button>

                                    <button 
                                        onClick={() => {
                                            setIsSettingsOpen(true);
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
                                            handleResetProject();
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                        <span>Clear Project Data</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            signOut();
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
                        {isUserMenuOpen && (
                            <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                        )}
                        </>
                    )}
                  </>
               )}
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Sidebar / Wizard Control */}
        <aside className={`${isSidebarCollapsed ? 'w-16 items-center' : 'w-72'} transition-all duration-300 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 z-10 relative`}>
          
          {/* Sidebar Content */}
          {!isSidebarCollapsed ? (
             <>
                {/* 1. WORKFLOW ACTIONS (TOP) */}
                <div className="p-4 shrink-0 space-y-3 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                             <Layers size={12} /> Workflow Actions
                        </div>
                        <button 
                            onClick={() => setIsSidebarCollapsed(true)}
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                            title="Collapse Sidebar"
                        >
                            <PanelLeftClose size={14} />
                        </button>
                    </div>

                    {/* Phase 1 Control */}
                    {step === WorkflowStep.IDLE && projectData.episodes.length > 0 && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 1: Analysis</h3>
                        <button onClick={startAnalysis} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <BrainCircuit size={14} />} Start Analysis
                        </button>
                        </div>
                    )}
                    
                    {step === WorkflowStep.SETUP_CONTEXT && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                             <div className="flex justify-between items-center">
                                 <h3 className="font-bold text-xs text-gray-900 dark:text-white">Phase 1 in Progress</h3>
                                 <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                     {analysisStep === AnalysisSubStep.PROJECT_SUMMARY ? '1/6' : 
                                      analysisStep === AnalysisSubStep.EPISODE_SUMMARIES ? '2/6' :
                                      analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION ? '3/6' :
                                      analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE ? '4/6' :
                                      analysisStep === AnalysisSubStep.LOC_IDENTIFICATION ? '5/6' : '6/6'}
                                 </span>
                             </div>

                             {analysisStep === AnalysisSubStep.PROJECT_SUMMARY && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Reviewing Global Project Arc...</p>
                                     <button onClick={confirmSummaryAndNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={!projectData.context.projectSummary || isProcessing}>
                                         Confirm & Next
                                     </button>
                                 </div>
                             )}

                             {analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Summarizing {analysisTotal} Episodes...</p>
                                     <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                                         <div className="bg-blue-500 h-full transition-all" style={{width: `${((analysisTotal - analysisQueue.length)/analysisTotal)*100}%`}}></div>
                                     </div>
                                     <button onClick={confirmEpSummariesAndNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueue.length > 0 || isProcessing}>
                                         Confirm & Next
                                     </button>
                                 </div>
                             )}

                             {analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Identifying Characters...</p>
                                     <button onClick={confirmCharListAndNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={projectData.context.characters.length === 0 || isProcessing}>
                                         Confirm & Next
                                     </button>
                                 </div>
                             )}

                             {analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Analyzing Character Depth...</p>
                                     <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                                         <div className="bg-purple-500 h-full transition-all" style={{width: `${((analysisTotal - analysisQueue.length)/analysisTotal)*100}%`}}></div>
                                     </div>
                                     <button onClick={confirmCharDepthAndNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueue.length > 0 || isProcessing}>
                                         Confirm & Next
                                     </button>
                                 </div>
                             )}
                             
                             {analysisStep === AnalysisSubStep.LOC_IDENTIFICATION && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Mapping Locations...</p>
                                     <button onClick={confirmLocListAndNext} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={projectData.context.locations.length === 0 || isProcessing}>
                                         Confirm & Next
                                     </button>
                                 </div>
                             )}

                             {analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && (
                                 <div className="text-xs text-gray-600 dark:text-gray-400">
                                     <p className="mb-2">Visualizing Locations...</p>
                                     <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mb-2 overflow-hidden">
                                         <div className="bg-orange-500 h-full transition-all" style={{width: `${((analysisTotal - analysisQueue.length)/analysisTotal)*100}%`}}></div>
                                     </div>
                                     <button onClick={finishAnalysis} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white rounded text-xs transition-colors" disabled={analysisQueue.length > 0 || isProcessing}>
                                         Finish Phase 1
                                     </button>
                                 </div>
                             )}
                        </div>
                    )}

                    {/* Phase 2: Shot Gen */}
                    {(analysisStep === AnalysisSubStep.COMPLETE || step === WorkflowStep.GENERATE_SHOTS) && step !== WorkflowStep.GENERATE_SORA && step !== WorkflowStep.COMPLETED && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 2: Shot Lists</h3>
                            {step !== WorkflowStep.GENERATE_SHOTS ? (
                                <button onClick={startPhase2} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors">
                                    <Film size={14} /> Start Shot Gen
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                        <span>Progress</span>
                                        <span>{currentEpIndex + 1} / {projectData.episodes.length}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${((currentEpIndex)/projectData.episodes.length)*100}%` }}></div>
                                    </div>
                                    {isProcessing ? (
                                        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                            <Loader2 className="animate-spin" size={12}/> Processing Ep {currentEpIndex + 1}...
                                        </div>
                                    ) : (
                                        <button onClick={confirmEpisodeShots} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-bold text-white transition-colors">
                                            Confirm & Next Episode
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phase 3: Sora Gen */}
                    {(step === WorkflowStep.GENERATE_SORA) && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                             <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Phase 3: Sora Prompts</h3>
                             <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                    <span>Progress</span>
                                    <span>{currentEpIndex + 1} / {projectData.episodes.length}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${((currentEpIndex)/projectData.episodes.length)*100}%` }}></div>
                                </div>
                                {isProcessing ? (
                                    <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                                        <Loader2 className="animate-spin" size={12}/> Writing Prompts...
                                    </div>
                                ) : (
                                    <button onClick={startPhase3} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-colors">
                                        {currentEpIndex === 0 ? "Start Prompt Generation" : "Continue Generation"}
                                    </button>
                                )}
                             </div>
                        </div>
                    )}

                     {/* Phase 5 Indicator (Implicit) */}
                     {step === WorkflowStep.COMPLETED && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/50">
                             <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1 text-sm flex items-center gap-2">
                                 <CheckCircle size={14} /> Workflow Complete
                             </h3>
                             <p className="text-xs text-green-700 dark:text-green-400">
                                 You can now use the Video Studio or export your assets.
                             </p>
                        </div>
                     )}

                </div>

                {/* 2. NAVIGATION TABS (MIDDLE) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <nav className="p-2 space-y-1">
                        <button 
                            onClick={() => setActiveTab('assets')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'assets' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <FolderOpen size={16} /> Assets & Guides
                        </button>
                        <button 
                            onClick={() => setActiveTab('script')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'script' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <FileText size={16} /> Script Viewer
                        </button>
                         <button 
                            onClick={() => setActiveTab('understanding')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'understanding' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <BrainCircuit size={16} /> Deep Understanding
                        </button>
                        <button 
                            onClick={() => setActiveTab('table')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'table' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <List size={16} /> Shot List Table
                        </button>
                        <button 
                            onClick={() => setActiveTab('visuals')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'visuals' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <Palette size={16} /> Visual Assets
                        </button>
                        <button 
                            onClick={() => setActiveTab('video')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'video' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <MonitorPlay size={16} /> Video Studio
                        </button>
                         <button 
                            onClick={() => setActiveTab('stats')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'stats' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <BarChart2 size={16} /> Dashboard
                        </button>
                    </nav>

                    {/* EPISODE LIST (Bottom of Sidebar) */}
                    {projectData.episodes.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-800">
                             <button 
                                onClick={() => setIsEpListExpanded(!isEpListExpanded)}
                                className="w-full p-3 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                             >
                                 <span>Episodes ({projectData.episodes.length})</span>
                                 {isEpListExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                             </button>
                             
                             {isEpListExpanded && (
                                 <div className="px-2 pb-4 space-y-1">
                                     {projectData.episodes.map((ep, idx) => (
                                         <button 
                                            key={ep.id}
                                            onClick={() => {
                                                setCurrentEpIndex(idx);
                                                if (ep.shots.length > 0) setActiveTab('table');
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded text-xs truncate transition-colors ${currentEpIndex === idx ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                         >
                                             {ep.id}. {ep.title}
                                         </button>
                                     ))}
                                 </div>
                             )}
                        </div>
                    )}
                </div>
             </>
          ) : (
              // Collapsed State
              <div className="flex flex-col items-center py-4 gap-4">
                  <button onClick={() => setIsSidebarCollapsed(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors">
                      <PanelLeftOpen size={20} />
                  </button>
                  <div className="w-8 h-px bg-gray-200 dark:bg-gray-700"></div>
                   <button onClick={() => setActiveTab('assets')} className={`p-2 rounded-lg transition-colors ${activeTab === 'assets' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Assets"><FolderOpen size={20} /></button>
                   <button onClick={() => setActiveTab('script')} className={`p-2 rounded-lg transition-colors ${activeTab === 'script' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Script"><FileText size={20} /></button>
                   <button onClick={() => setActiveTab('understanding')} className={`p-2 rounded-lg transition-colors ${activeTab === 'understanding' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Analysis"><BrainCircuit size={20} /></button>
                   <button onClick={() => setActiveTab('table')} className={`p-2 rounded-lg transition-colors ${activeTab === 'table' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Table"><List size={20} /></button>
                   <button onClick={() => setActiveTab('visuals')} className={`p-2 rounded-lg transition-colors ${activeTab === 'visuals' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'text-gray-400 hover:text-pink-500'}`} title="Visuals"><Palette size={20} /></button>
                   <button onClick={() => setActiveTab('video')} className={`p-2 rounded-lg transition-colors ${activeTab === 'video' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-indigo-500'}`} title="Video Studio"><MonitorPlay size={20} /></button>
                   <button onClick={() => setActiveTab('stats')} className={`p-2 rounded-lg transition-colors ${activeTab === 'stats' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Dashboard"><BarChart2 size={20} /></button>
              </div>
          )}
        </aside>

        {/* Workspace */}
        <section className="flex-1 overflow-hidden relative bg-white dark:bg-gray-950">
           {/** Safely resolve current episode */}
           {/** Use first episode if index is out of range */}
           {(() => {
              const currentEpisode = projectData.episodes[currentEpIndex] || projectData.episodes[0];
              return (
                <>
           {activeTab === 'assets' && (
               <AssetsBoard data={projectData} onAssetLoad={handleAssetLoad} />
           )}
           {activeTab === 'script' && (
              <div className="h-full p-8 overflow-auto bg-white dark:bg-gray-950">
                 <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-xl min-h-[calc(100%-2rem)] p-12 border border-gray-100 dark:border-gray-800 relative">
                    {currentEpisode && (
                       <div className="absolute top-4 right-8 text-xs text-gray-400 font-mono">
                           Reading: {currentEpisode.title}
                       </div>
                    )}
                     <pre className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-gray-800 dark:text-gray-300">
                        {currentEpisode
                           ? currentEpisode.content 
                           : projectData.rawScript || <span className="text-gray-400 italic">No script loaded. Upload a text file in Assets.</span>}
                     </pre>
                 </div>
              </div>
           )}
           {activeTab === 'understanding' && (
              <ContentBoard data={projectData} onSelectEpisode={(idx) => {
                  setCurrentEpIndex(idx);
                  setActiveTab('table');
              }} />
           )}
           {activeTab === 'table' && (
              <ShotTable 
                shots={projectData.episodes[currentEpIndex]?.shots || []} 
                showSora={step >= WorkflowStep.GENERATE_SORA}
              />
           )}
           {activeTab === 'visuals' && (
               <VisualAssets 
                  data={projectData} 
                  config={config} 
                  onUpdateUsage={handleUsageUpdate} 
               />
           )}
           {activeTab === 'video' && (
               <VideoStudio 
                  episodes={projectData.episodes}
                  onGenerateVideo={handleGenerateVideo}
                  onRemixVideo={handleRemixVideo}
               />
           )}
           {activeTab === 'stats' && (
              <Dashboard data={projectData} isDarkMode={isDarkMode} />
           )}
                </>
              );
           })()}
        </section>

      </main>
    </div>
    </div>
  );
};

export default App;
