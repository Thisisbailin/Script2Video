
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, CheckCircle, FileText, Video, Download, AlertCircle, Loader2, RotateCcw, FileSpreadsheet, BarChart2, BrainCircuit, Palette, FolderOpen, Layers, Users, MapPin, MonitorPlay, Film, PanelLeftClose, PanelLeftOpen, Sparkles, Trash2, ChevronDown, List, ChevronUp, Sun, Moon, User, LogOut, Shield } from 'lucide-react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { ProjectData, AppConfig, WorkflowStep, Episode, Shot, TokenUsage, AnalysisSubStep, VideoParams } from './types';
import { INITIAL_PROJECT_DATA, INITIAL_VIDEO_CONFIG, INITIAL_TEXT_CONFIG, INITIAL_MULTIMODAL_CONFIG } from './constants';
import { parseScriptToEpisodes, exportToCSV, exportToXLS, parseCSVToShots } from './utils/parser';
import { normalizeProjectData } from './utils/projectData';
import { dropFileReplacer, isProjectEmpty, backupData } from './utils/persistence';
import { usePersistedState } from './hooks/usePersistedState';
import { useCloudSync } from './hooks/useCloudSync';
import { useVideoPolling } from './hooks/useVideoPolling';
import { useConfig } from './hooks/useConfig';
import { useTheme } from './hooks/useTheme';
import { useWorkflowEngine } from './hooks/useWorkflowEngine';
import { useSecretsSync } from './hooks/useSecretsSync';
import { useShotGeneration } from './hooks/useShotGeneration';
import { useSoraGeneration } from './hooks/useSoraGeneration';
import { AppShell } from './components/layout/AppShell';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { AssetsModule } from './modules/assets/AssetsModule';
import { ScriptViewer } from './modules/script/ScriptViewer';
import { UnderstandingModule } from './modules/understanding/UnderstandingModule';
import { ShotsModule } from './modules/shots/ShotsModule';
import { VisualsModule } from './modules/visuals/VisualsModule';
import { VideoModule } from './modules/video/VideoModule';
import { MetricsModule } from './modules/metrics/MetricsModule';
import { NodeLab } from './node-workspace/components/NodeLab';
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

  type ActiveTab = 'assets' | 'script' | 'understanding' | 'table' | 'visuals' | 'video' | 'stats' | 'lab';

  // Initialize state with Persisted hooks
  const [projectData, setProjectData] = usePersistedState<ProjectData>({
      key: PROJECT_STORAGE_KEY,
      initialValue: INITIAL_PROJECT_DATA,
      deserialize: (value) => normalizeProjectData(JSON.parse(value)),
      serialize: (value) => JSON.stringify(value),
  });

  const { config, setConfig } = useConfig(CONFIG_STORAGE_KEY);

  const { isDarkMode, setIsDarkMode, toggleTheme } = useTheme(THEME_STORAGE_KEY, true);

  const [uiState, setUiState] = usePersistedState<{
      step: WorkflowStep;
      analysisStep: AnalysisSubStep;
      currentEpIndex: number;
      activeTab: ActiveTab;
  }>({
      key: UI_STATE_STORAGE_KEY,
      initialValue: { step: WorkflowStep.IDLE, analysisStep: AnalysisSubStep.IDLE, currentEpIndex: 0, activeTab: 'assets' },
      deserialize: (value) => {
          const parsed = JSON.parse(value);
          return {
              step: parsed.step ?? WorkflowStep.IDLE,
              analysisStep: parsed.analysisStep ?? AnalysisSubStep.IDLE,
              currentEpIndex: parsed.currentEpIndex ?? 0,
              activeTab: parsed.activeTab ?? 'assets'
          };
      },
      serialize: (value) => JSON.stringify(value)
  });

  const workflow = useWorkflowEngine({
      step: uiState.step,
      analysisStep: uiState.analysisStep,
      currentEpIndex: uiState.currentEpIndex,
      activeTab: uiState.activeTab
  });

  const { state: wfState, setStep, setAnalysisStep, setCurrentEpIndex, setActiveTab, setProcessing, setStatus, setQueue, shiftQueue, resetWorkflow } = workflow;
  const { step, analysisStep, currentEpIndex, activeTab, isProcessing, processingStatus, analysisQueue, analysisTotal } = wfState;

  // Keep persisted uiState in sync with reducer core fields
  useEffect(() => {
      setUiState(prev => ({
          ...prev,
          step,
          analysisStep,
          currentEpIndex,
          activeTab
      }));
  }, [step, analysisStep, currentEpIndex, activeTab, setUiState]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEpListExpanded, setIsEpListExpanded] = useState(true); 
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = usePersistedState<string>({
      key: 'script2video_avatar_url',
      initialValue: '',
      deserialize: (v) => JSON.parse(v),
      serialize: (v) => JSON.stringify(v)
  });
  const hasFetchedProfileAvatar = useRef(false);
  
  // Processing Queues for Phase 1 Batches handled via reducer

  // --- Cloud Sync Helpers ---

  useEffect(() => {
      projectDataRef.current = projectData;
  }, [projectData]);

  // --- Cloud Sync (Clerk + Cloudflare Pages) ---
  useCloudSync({
      isSignedIn,
      isLoaded,
      getToken,
      projectData,
      setProjectData,
      setHasLoadedRemote,
      hasLoadedRemote,
      localBackupKey: LOCAL_BACKUP_KEY,
      remoteBackupKey: REMOTE_BACKUP_KEY,
      onError: (e) => console.warn("Cloud sync error", e),
      onConflictConfirm: ({ remote, local }) => window.confirm(
        "检测到云端和本地均有数据。\n确定：使用云端覆盖本地（本地备份会保留）\n取消：保留本地并上传到云端（云端数据将备份）"
      ),
      saveDebounceMs: 1200
  });

  useVideoPolling({
      episodes: projectData.episodes,
      videoConfig: config.videoConfig,
      onUpdate: (updater) => setProjectData(prev => updater(prev)),
      intervalMs: 5000,
      onError: (e) => console.warn("Video polling error", e)
  });

  useSecretsSync({
      isSignedIn,
      isLoaded,
      getToken,
      config,
      setConfig,
      debounceMs: 1200
  });

  // Fetch avatar from profile (account-scoped) once per session
  useEffect(() => {
      const fetchProfile = async () => {
          if (!isSignedIn || !isLoaded || hasFetchedProfileAvatar.current) return;
          hasFetchedProfileAvatar.current = true;
          try {
              const res = await fetch('/api/profile', { headers: { authorization: `Bearer ${await getToken()}` } });
              if (res.ok) {
                  const data = await res.json();
                  if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
              }
          } catch (e) {
              console.warn('Fetch profile avatar failed', e);
          }
      };
      fetchProfile();
  }, [isSignedIn, isLoaded, getToken, setAvatarUrl]);

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
          setAvatarUrl('');
          window.location.reload(); 
      }
  };

  const handleAvatarUploadClick = () => {
      avatarFileInputRef.current?.click();
  };

  const uploadAvatarToSupabase = async (file: File) => {
      try {
          const payload = {
              fileName: `avatars/${Date.now()}-${file.name}`,
              bucket: 'public-assets',
              contentType: file.type
          };
          const res = await fetch('/api/upload-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Upload URL error ${res.status}`);
          const data = await res.json();
          const signedUrl: string = data.signedUrl;
          if (!signedUrl) throw new Error('No signedUrl returned');

          const uploadRes = await fetch(signedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file
          });
          if (!uploadRes.ok) {
              const txt = await uploadRes.text();
              throw new Error(`Upload failed ${uploadRes.status}: ${txt}`);
          }

          const publicUrl: string | undefined = data.publicUrl;
          const storedUrl = publicUrl || data.path || '';
          if (!storedUrl) throw new Error('No public URL/path returned');
          setAvatarUrl(storedUrl);
          // Save to profile for multi-device sync
          try {
              const token = await getToken();
              if (token) {
                  await fetch('/api/profile', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                      body: JSON.stringify({ avatarUrl: storedUrl })
                  });
              }
          } catch (e) {
              console.warn('Save profile avatar failed', e);
          }
          alert('头像已上传并应用（Supabase public-assets）');
      } catch (e: any) {
          alert(`上传头像失败: ${e.message || e}`);
      }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      uploadAvatarToSupabase(file);
      e.target.value = '';
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
      setProcessing(true, "Concocting a hilarious script with AI...");
      
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
          setProcessing(false);
          
      } catch (e: any) {
          console.error(e);
          setProcessing(false);
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
    setProcessing(true, "Step 1/6: Analyzing Global Project Arc...");
    setActiveTab('understanding');
    try {
        const result = await GeminiService.generateProjectSummary(config.textConfig, projectData.rawScript, projectData.globalStyleGuide);
        
        setProjectData(prev => ({
            ...prev,
            context: { ...prev.context, projectSummary: result.projectSummary },
            contextUsage: GeminiService.addUsage(prev.contextUsage || {promptTokens:0,responseTokens:0,totalTokens:0}, result.usage),
            phase1Usage: { ...prev.phase1Usage, projectSummary: GeminiService.addUsage(prev.phase1Usage.projectSummary, result.usage) }
        }));
        
        setProcessing(false);
        updateStats('context', true);
    } catch (e: any) {
        setProcessing(false);
        alert("Project summary failed: " + e.message);
        updateStats('context', false);
    }
  };

  const confirmSummaryAndNext = () => {
      // Prepare batch for Episode Summaries
      const epQueue = projectData.episodes.map(ep => ep.id);
      setQueue(epQueue, epQueue.length);
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
          shiftQueue();
          return;
      }

    setProcessing(true, `Step 2/6: Analyzing Episode ${epId} (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);

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

          shiftQueue();
          setProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setProcessing(false);
          const ignore = window.confirm(`Failed to summarize Episode ${epId}: ${e.message}. Skip this episode?`);
          if (ignore) {
             shiftQueue();
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
      setProcessing(true, "Step 3/6: Identifying Character Roster...");
      try {
          const result = await GeminiService.identifyCharacters(config.textConfig, projectData.rawScript, projectData.context.projectSummary);
          setProjectData(prev => ({
              ...prev,
              context: { ...prev.context, characters: result.characters },
              contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
              phase1Usage: { ...prev.phase1Usage, charList: GeminiService.addUsage(prev.phase1Usage.charList, result.usage) }
          }));
          setProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setProcessing(false);
          alert("Character list generation failed: " + e.message);
          updateStats('context', false);
      }
  };

  const confirmCharListAndNext = () => {
      // Setup Queue for deep dive
      const mainChars = projectData.context.characters.filter(c => c.isMain).map(c => c.name);
      setQueue(mainChars, mainChars.length);
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
      setProcessing(true, `Step 4/6: Deep Analysis for '${charName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);
      
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

          shiftQueue();
          setProcessing(false);
          updateStats('context', true);

      } catch (e: any) {
          console.error(e);
          setProcessing(false);
          const ignore = window.confirm(`Failed to analyze ${charName}: ${e.message}. Skip?`);
          if (ignore) {
             shiftQueue();
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
      setProcessing(true, "Step 5/6: Mapping Locations...");
      try {
          const result = await GeminiService.identifyLocations(config.textConfig, projectData.rawScript, projectData.context.projectSummary);
          setProjectData(prev => ({
              ...prev,
              context: { ...prev.context, locations: result.locations },
              contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
              phase1Usage: { ...prev.phase1Usage, locList: GeminiService.addUsage(prev.phase1Usage.locList, result.usage) }
          }));
          setProcessing(false);
          updateStats('context', true);
      } catch (e: any) {
          setProcessing(false);
          alert("Location mapping failed: " + e.message);
          updateStats('context', false);
      }
  };

  const confirmLocListAndNext = () => {
      const coreLocs = projectData.context.locations.filter(l => l.type === 'core').map(l => l.name);
      setQueue(coreLocs, coreLocs.length);
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
      setProcessing(true, `Step 6/6: Visualizing '${locName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);
      
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

          shiftQueue();
          setProcessing(false);
          updateStats('context', true);

      } catch (e: any) {
          setProcessing(false);
          const ignore = window.confirm(`Failed to visualize ${locName}: ${e.message}. Skip?`);
          if (ignore) {
             shiftQueue();
             updateStats('context', false);
          }
      }
  };

  const finishAnalysis = () => {
      setAnalysisStep(AnalysisSubStep.COMPLETE);
      alert("Phase 1 Complete! Context is fully established.");
  };

  // === PHASE 2 & 3 Hooks ===
  const { startPhase2, confirmEpisodeShots } = useShotGeneration({
      projectDataRef,
      setProjectData,
      config,
      setStep,
      setCurrentEpIndex,
      setProcessing,
      setStatus,
      setActiveTab,
      updateStats,
      currentEpIndex
  });

  const { startPhase3, continueNextEpisodeSora, retryCurrentEpisodeSora } = useSoraGeneration({
      projectDataRef,
      setProjectData,
      config,
      setStep,
      setCurrentEpIndex,
      setProcessing,
      setStatus,
      setActiveTab,
      updateStats,
      isProcessing,
      currentEpIndex
  });

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
  const activeModelLabel = `${config.textConfig.provider === 'gemini' ? 'Gemini' : 'OpenRouter'} | ${getActiveModelName()}`;
  const safeEpisode = currentEpisode || projectData.episodes[0];

  const headerNode = (
    <Header
      isProcessing={isProcessing}
      hasGeneratedShots={hasGeneratedShots}
      onTryMe={handleTryMe}
      onExportCsv={() => {
        exportToCSV(projectData.episodes);
        setIsExportMenuOpen(false);
      }}
      onExportXls={() => {
        exportToXLS(projectData.episodes);
        setIsExportMenuOpen(false);
      }}
      onToggleExportMenu={() => setIsExportMenuOpen(prev => !prev)}
      isExportMenuOpen={isExportMenuOpen}
      onToggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      account={{
        isLoaded,
        isSignedIn: !!isSignedIn,
        user,
        onSignIn: () => openSignIn(),
        onSignOut: () => signOut(),
      onOpenSettings: () => setIsSettingsOpen(true),
      onReset: handleResetProject,
      isUserMenuOpen,
      setIsUserMenuOpen,
      onUploadAvatar: handleAvatarUploadClick,
      avatarUrl: avatarUrl || user?.imageUrl
    }}
    activeModelLabel={activeModelLabel}
    projectData={projectData}
    config={config}
  />
  );

  const sidebarNode = (
    <Sidebar
      isSidebarCollapsed={isSidebarCollapsed}
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      step={step}
      analysisStep={analysisStep}
      analysisQueueLength={analysisQueue.length}
      analysisTotal={analysisTotal}
      isProcessing={isProcessing}
      currentEpIndex={currentEpIndex}
      episodes={projectData.episodes}
      onStartAnalysis={startAnalysis}
      onConfirmSummaryNext={confirmSummaryAndNext}
      onConfirmEpSummariesNext={confirmEpSummariesAndNext}
      onConfirmCharListNext={confirmCharListAndNext}
      onConfirmCharDepthNext={confirmCharDepthAndNext}
      onConfirmLocListNext={confirmLocListAndNext}
      onFinishAnalysis={finishAnalysis}
      onStartPhase2={startPhase2}
      onConfirmEpisodeShots={confirmEpisodeShots}
      onStartPhase3={startPhase3}
      onRetryEpisodeSora={retryCurrentEpisodeSora}
      onContinueNextEpisodeSora={continueNextEpisodeSora}
      isEpListExpanded={isEpListExpanded}
      setIsEpListExpanded={setIsEpListExpanded}
      setCurrentEpIndex={setCurrentEpIndex}
    />
  );

  const renderMainContent = () => (
    <>
      {activeTab === 'assets' && (
        <AssetsModule data={projectData} onAssetLoad={handleAssetLoad} />
      )}
      {activeTab === 'script' && (
        <ScriptViewer episode={safeEpisode} rawScript={projectData.rawScript} />
      )}
      {activeTab === 'understanding' && (
        <UnderstandingModule data={projectData} onSelectEpisode={(idx) => {
          setCurrentEpIndex(idx);
          setActiveTab('table');
        }} />
      )}
      {activeTab === 'table' && (
        <ShotsModule 
          shots={projectData.episodes[currentEpIndex]?.shots || []} 
          showSora={step >= WorkflowStep.GENERATE_SORA}
        />
      )}
      {activeTab === 'visuals' && (
        <VisualsModule 
          data={projectData} 
          config={config} 
          onUpdateUsage={handleUsageUpdate} 
        />
      )}
      {activeTab === 'video' && (
        <VideoModule 
          episodes={projectData.episodes}
          onGenerateVideo={handleGenerateVideo}
          onRemixVideo={handleRemixVideo}
        />
      )}
      {activeTab === 'lab' && (
        <div className="h-full">
          <NodeLab />
        </div>
      )}
      {activeTab === 'stats' && (
        <MetricsModule data={projectData} isDarkMode={isDarkMode} />
      )}
    </>
  );

  return (
    <AppShell isDarkMode={isDarkMode} header={headerNode} sidebar={sidebarNode}>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />
      <input
        type="file"
        accept="image/*"
        ref={avatarFileInputRef}
        className="hidden"
        onChange={handleAvatarFileChange}
      />
      {renderMainContent()}
    </AppShell>
  );
};

export default App;
