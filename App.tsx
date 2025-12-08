
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, CheckCircle, FileText, Video, Download, Upload, AlertCircle, ChevronRight, Loader2, RotateCcw, XCircle, FileSpreadsheet, BarChart2, BrainCircuit, Palette, FolderOpen, Layers, Users, MapPin, PlayCircle, Film, PanelLeftClose, PanelLeftOpen, Sparkles, Trash2 } from 'lucide-react';
import { ProjectData, AppConfig, WorkflowStep, Episode, Shot, TokenUsage, AnalysisSubStep, VideoParams } from './types';
import { INITIAL_PROJECT_DATA, INITIAL_VIDEO_CONFIG, INITIAL_TEXT_CONFIG, INITIAL_MULTIMODAL_CONFIG } from './constants';
import { parseScriptToEpisodes, exportToExcel, parseCSVToShots } from './utils/parser';
import { SettingsModal } from './components/SettingsModal';
import { ShotTable } from './components/ShotTable';
import { Dashboard } from './components/Dashboard';
import { ContentBoard } from './components/ContentBoard';
import { VisualAssets } from './components/VisualAssets';
import { VideoStudio } from './components/VideoStudio';
import * as GeminiService from './services/geminiService';
import * as VideoService from './services/videoService';

const PROJECT_STORAGE_KEY = 'script2video_project_v1';
const CONFIG_STORAGE_KEY = 'script2video_config_v1';
const UI_STATE_STORAGE_KEY = 'script2video_ui_state_v1';

const App: React.FC = () => {
  // Initialize state with Lazy Initializers for Persistence
  
  const [projectData, setProjectData] = useState<ProjectData>(() => {
      try {
          const saved = localStorage.getItem(PROJECT_STORAGE_KEY);
          return saved ? JSON.parse(saved) : INITIAL_PROJECT_DATA;
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
  
  // Workflow State (Persisted)
  const [step, setStep] = useState<WorkflowStep>(savedUI?.step ?? WorkflowStep.IDLE);
  const [analysisStep, setAnalysisStep] = useState<AnalysisSubStep>(savedUI?.analysisStep ?? AnalysisSubStep.IDLE);
  const [currentEpIndex, setCurrentEpIndex] = useState(savedUI?.currentEpIndex ?? 0);
  const [activeTab, setActiveTab] = useState<'script' | 'understanding' | 'table' | 'visuals' | 'video' | 'stats'>(savedUI?.activeTab ?? 'script');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  // Processing Queues for Phase 1 Batches
  const [analysisQueue, setAnalysisQueue] = useState<any[]>([]);
  const [analysisTotal, setAnalysisTotal] = useState(0);

  // Input Refs
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence Effects ---
  useEffect(() => {
      try {
          localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectData));
      } catch (e) {
          console.error("Failed to save project to local storage (quota exceeded?)", e);
      }
  }, [projectData]);

  useEffect(() => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
      const uiState = { step, analysisStep, currentEpIndex, activeTab };
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(uiState));
  }, [step, analysisStep, currentEpIndex, activeTab]);


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
          setActiveTab('script');
          localStorage.removeItem(PROJECT_STORAGE_KEY);
          localStorage.removeItem(UI_STATE_STORAGE_KEY);
          // We keep config (API Keys) for convenience, or delete CONFIG_STORAGE_KEY to fully reset.
          // Let's keep config.
          window.location.reload(); // Reload to ensure clean slate and re-fetch guides
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'csvShots') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      
      if (type === 'script') {
        const episodes = parseScriptToEpisodes(text);
        setProjectData(prev => ({ ...prev, fileName: file.name, rawScript: text, episodes }));
        if (episodes.length > 0) setCurrentEpIndex(0);
      
      } else if (type === 'csvShots') {
        try {
          const shotMap = parseCSVToShots(text);
          setProjectData(prev => {
            const updatedEpisodes = prev.episodes.map(ep => {
              // Try to find matching shots by Title
              const matchedShots = shotMap.get(ep.title);
              if (matchedShots && matchedShots.length > 0) {
                return {
                  ...ep,
                  shots: matchedShots,
                  status: matchedShots[0].soraPrompt ? 'completed' : 'confirmed_shots' // If sora prompt exists, mark completed, else just shots confirmed
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
        setProjectData(prev => ({ ...prev, globalStyleGuide: text }));
      } else if (type === 'shotGuide') {
        setProjectData(prev => ({ ...prev, shotGuide: text }));
      } else if (type === 'soraGuide') {
        setProjectData(prev => ({ ...prev, soraGuide: text }));
      }
    };
    reader.readAsText(file);
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
          // Don't auto-remove from queue to allow retry. Or we can skip.
          // For now, let's stop and let user click 'retry' if we implemented a granular retry button, 
          // but for simplicity in this wizard, we alert and pause.
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
    // Check if shots are already populated (e.g., via CSV Import)
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
    // Find first pending episode to start from, or start from 0
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
      setCurrentEpIndex(0); // Reset for next phase
      return;
    }

    const episode = projectData.episodes[index];
    
    // If episode already has shots (from import) and status is confirmed/completed, skip it
    if (episode.shots.length > 0 && (episode.status === 'confirmed_shots' || episode.status === 'completed')) {
        const next = index + 1;
        setCurrentEpIndex(next);
        generateCurrentEpisodeShots(next);
        return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Generating Shots for Episode ${episode.id}...`);
    
    // Reset error state if any
    setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = { ...newEpisodes[index], status: 'generating', errorMsg: undefined };
        return { ...prev, episodes: newEpisodes };
    });

    try {
      // PHASE 2: Pass global style guide AND existing summary from Phase 1
      const result = await GeminiService.generateEpisodeShots(
        config.textConfig,
        episode.title,
        episode.content,
        episode.summary, // Pass Phase 1 summary
        projectData.context,
        projectData.shotGuide,
        index,
        projectData.globalStyleGuide
      );

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          // Do not overwrite summary if result doesn't provide it (it shouldn't anymore)
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
       setCurrentEpIndex(0); // FIX: Reset index to 0 so Phase 3 starts from beginning
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

  // --- PHASE 3: SCENE-BASED GENERATION LOGIC ---
  const generateCurrentEpisodeSora = async (index: number) => {
    if (index >= projectData.episodes.length) {
      setStep(WorkflowStep.COMPLETED); // FINISH BATCH
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

    // SMART RESUME LOGIC
    // If we are in error state, we can resume. If manual regenerate, we force start over.
    const shouldResume = episode.status === 'error';

    setIsProcessing(true);
    setProcessingStatus(`Generating Sora Prompts for Episode ${episode.id}...`);
    
    setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = { ...newEpisodes[index], status: 'generating_sora', errorMsg: undefined };
        return { ...prev, episodes: newEpisodes };
    });

    try {
      // 1. STRICT SCENE GROUPING
      // We group shots strictly by their ID prefix (e.g. "1-1" from "1-1-01")
      // This ensures 1 Request = 1 Scene.
      const chunksMap = new Map<string, Shot[]>();
      
      episode.shots.forEach(shot => {
         const parts = shot.id.split('-');
         let sceneKey = 'default';
         
         // Logic: The Scene ID is everything except the last part (the shot number)
         if (parts.length > 1) {
            const prefixParts = parts.slice(0, parts.length - 1);
            sceneKey = prefixParts.join('-');
         }
         
         if (!chunksMap.has(sceneKey)) chunksMap.set(sceneKey, []);
         chunksMap.get(sceneKey)?.push(shot);
      });
      
      const shotChunks: Shot[][] = Array.from(chunksMap.values());

      // Initialize with existing usage if resuming, to avoid losing previous costs
      let currentTotalUsage: TokenUsage = shouldResume && episode.soraGenUsage 
          ? episode.soraGenUsage 
          : { promptTokens: 0, responseTokens: 0, totalTokens: 0 };
      
      // 2. Loop through each Scene Group sequentially
      for (let i = 0; i < shotChunks.length; i++) {
         const chunk = shotChunks[i];
         const sceneId = chunk[0].id.split('-').slice(0, -1).join('-');

         // RESUME CHECK: If resuming and all shots in this chunk have a prompt, skip it.
         const isChunkComplete = chunk.every(s => s.soraPrompt && s.soraPrompt.trim().length > 0);
         if (shouldResume && isChunkComplete) {
             setProcessingStatus(`Skipping completed Scene ${sceneId} (${i+1}/${shotChunks.length})...`);
             await new Promise(r => setTimeout(r, 100)); // Small delay for UI update
             continue;
         }

         setProcessingStatus(`Episode ${episode.id}: Processing Scene ${sceneId} (${i+1}/${shotChunks.length})...`);
         
         // Call API for this specific scene only
         // PHASE 3: Pass global style guide
         const result = await GeminiService.generateSoraPrompts(
             config.textConfig,
             chunk,
             projectData.context,
             projectData.soraGuide,
             projectData.globalStyleGuide
         );

         currentTotalUsage = GeminiService.addUsage(currentTotalUsage, result.usage);

         // Merge partial results immediately into state
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
                 soraGenUsage: currentTotalUsage // Update usage incrementally
             };
             return { ...prev, episodes: newEpisodes };
         });
         
         // Delay to prevent rate limits
         await new Promise(r => setTimeout(r, 500));
      }

      // Finalize Episode
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

  const confirmEpisodeSora = () => {
    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      newEpisodes[currentEpIndex].status = 'completed';
      return { ...prev, episodes: newEpisodes };
    });

    const nextIndex = currentEpIndex + 1;
    
    if (nextIndex < projectData.episodes.length) {
       setCurrentEpIndex(nextIndex);
       generateCurrentEpisodeSora(nextIndex);
    } else {
       setStep(WorkflowStep.COMPLETED);
       alert("Sora Prompt Generation Complete. You can now use the Video Studio.");
       setCurrentEpIndex(0); // FIX: Reset index to 0 so viewing starts from beginning
    }
  };

  // === PHASE 5: VIDEO GENERATION (Manual Trigger) ===
  
  const handleGenerateVideo = async (episodeId: number, shotId: string, customPrompt: string, params: VideoParams) => {
      const episode = projectData.episodes.find(e => e.id === episodeId);
      if(!episode) return;
      const shot = episode.shots.find(s => s.id === shotId);
      if(!shot) return;

      if (!config.videoConfig.apiKey || !config.videoConfig.baseUrl) {
          alert("Video API settings missing. Please open Settings -> Video Generation.");
          setIsSettingsOpen(true);
          return;
      }

      // 1. Set status to generating
      setProjectData(prev => {
         const newEpisodes = prev.episodes.map(e => {
             if (e.id === episodeId) {
                 return {
                     ...e,
                     shots: e.shots.map(s => s.id === shotId ? { 
                         ...s, 
                         videoStatus: 'generating', 
                         videoErrorMsg: undefined,
                         finalVideoPrompt: customPrompt, // Save the prompt used
                         videoParams: params // Save the params used
                     } : s)
                 } as Episode;
             }
             return e;
         });
         return { ...prev, episodes: newEpisodes };
      });

      try {
          // 2. Call API
          const { url, id } = await VideoService.generateVideo(customPrompt, config.videoConfig, params);

          // 3. Update Success
           setProjectData(prev => {
            const newEpisodes = prev.episodes.map(e => {
                if (e.id === episodeId) {
                    return {
                        ...e,
                        shots: e.shots.map(s => s.id === shotId ? { 
                            ...s, 
                            videoStatus: 'completed', 
                            videoUrl: url,
                            videoId: id, // Save ID for Remix
                        } : s)
                    } as Episode;
                }
                return e;
            });
            return { ...prev, episodes: newEpisodes };
          });
      } catch (e: any) {
          // 4. Update Error
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
                         videoStatus: 'generating', 
                         videoErrorMsg: undefined,
                         finalVideoPrompt: customPrompt
                     } : s)
                 } as Episode;
             }
             return e;
         });
         return { ...prev, episodes: newEpisodes };
      });

      try {
          const { url, id } = await VideoService.remixVideo(originalVideoId, customPrompt, config.videoConfig);

          setProjectData(prev => {
            const newEpisodes = prev.episodes.map(e => {
                if (e.id === episodeId) {
                    return {
                        ...e,
                        shots: e.shots.map(s => s.id === shotId ? { 
                            ...s, 
                            videoStatus: 'completed', 
                            videoUrl: url,
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

  // --- Handlers ---

  const handleRetry = () => {
      if(step === WorkflowStep.GENERATE_SHOTS) {
          generateCurrentEpisodeShots(currentEpIndex);
      } else if (step === WorkflowStep.GENERATE_SORA) {
          generateCurrentEpisodeSora(currentEpIndex);
      } else if (step === WorkflowStep.SETUP_CONTEXT) {
          // Retry logic for Phase 1 sub-steps
          if (analysisStep === AnalysisSubStep.PROJECT_SUMMARY) processProjectSummary();
          else if (analysisStep === AnalysisSubStep.EPISODE_SUMMARIES) processNextEpisodeSummary();
          else if (analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION) processCharacterList();
          else if (analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE) processNextCharacter(); // Retry current char
          else if (analysisStep === AnalysisSubStep.LOC_IDENTIFICATION) processLocationList();
          else if (analysisStep === AnalysisSubStep.LOC_DEEP_DIVE) processNextLocation();
      }
  };

  // --- Render Helpers ---

  const currentEpisode = projectData.episodes[currentEpIndex];
  const hasGeneratedShots = projectData.episodes.some(ep => ep.shots.length > 0);

  // New Helper: Dynamic Model Name based on Active Tab
  const getActiveModelName = () => {
      if (activeTab === 'visuals') return config.multimodalConfig.model || 'Multimodal';
      if (activeTab === 'video') return config.videoConfig.model || 'Video';
      return config.textConfig.model; 
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />

      {/* Header */}
      <header className="h-16 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Script2Video AI Director</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
             {config.textConfig.provider === 'gemini' ? 'Gemini' : 'OpenRouter'} | {getActiveModelName()}
          </span>
        </div>

        <div className="flex items-center gap-4">
           {hasGeneratedShots && (
             <button 
                onClick={() => exportToExcel(projectData.episodes)}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
                title="Export all generated shots to Excel format"
             >
                <Download size={16} /> Export Excel
             </button>
           )}
           <button 
            onClick={handleResetProject} 
            className="p-2 text-red-400/70 hover:text-red-300 hover:bg-gray-800 rounded-full transition-colors"
            title="Reset Project"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Sidebar / Wizard Control */}
        <aside className={`${isSidebarCollapsed ? 'w-16 items-center' : 'w-80'} transition-all duration-300 border-r border-gray-800 bg-gray-900 flex flex-col shrink-0 z-10 relative`}>
          
          {/* Collapse Toggle */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-4 z-20 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 shadow-md"
          >
             {isSidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
          </button>

          {/* Sidebar Content (Hidden if collapsed) */}
          {!isSidebarCollapsed ? (
             <>
               {/* GROUP 1: Project Assets */}
                <div className="p-4 border-b border-gray-800 space-y-4 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider mb-2">
                        <FolderOpen size={12} className="text-blue-500" /> Project Assets
                    </div>
                    {/* ... (Existing Inputs) ... */}
                     <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Script (TXT)</span>
                        <div className="flex gap-2">
                            <input type="file" ref={scriptInputRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'script')} />
                            <button onClick={() => scriptInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm text-gray-200">
                                <FileText size={14} /> {projectData.fileName ? 'Change' : 'Upload Script'}
                            </button>
                            <button 
                                onClick={handleTryMe}
                                disabled={isProcessing}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm text-gray-200 disabled:opacity-50"
                                title="Generate a funny animal script to test the app!"
                            >
                                <Sparkles size={14} className="text-pink-500" /> Try Me :)
                            </button>
                        </div>
                        {projectData.fileName && <p className="text-xs text-green-400 truncate">Loaded: {projectData.fileName}</p>}
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Visual Style Guide</span>
                        <div className="flex gap-2">
                            <input type="file" ref={globalStyleInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'globalStyleGuide')} />
                            <button onClick={() => globalStyleInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm transition-colors ${projectData.globalStyleGuide ? 'bg-purple-900/30 border-purple-800 text-purple-300' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 border-dashed'}`}>
                                <Palette size={14} /> {projectData.globalStyleGuide ? 'Loaded' : 'Upload'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-1 pt-2">
                        <div className="flex gap-2">
                            <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileUpload(e, 'csvShots')} />
                            <button 
                                onClick={() => csvInputRef.current?.click()} 
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs text-gray-500"
                            >
                                <FileSpreadsheet size={12} /> Import CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* GROUP 2: Standard SOPs */}
                <div className="p-4 border-b border-gray-800 space-y-3 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <CheckCircle size={12} className="text-green-500" /> Standard SOPs
                    </div>
                    
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Shot Guide</span>
                        <div className="flex gap-2">
                            <input type="file" ref={shotGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'shotGuide')} />
                            <button onClick={() => shotGuideInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300">
                                <Upload size={12} /> Custom
                            </button>
                        </div>
                        {projectData.shotGuide && <p className="text-[10px] text-green-400 mt-0.5">Loaded</p>}
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Sora Prompt Guide</span>
                        <div className="flex gap-2">
                            <input type="file" ref={soraGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'soraGuide')} />
                            <button onClick={() => soraGuideInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300">
                                <Upload size={12} /> Custom
                            </button>
                        </div>
                        {projectData.soraGuide && <p className="text-[10px] text-green-400 mt-0.5">Loaded</p>}
                    </div>
                </div>

                {/* Action Buttons (Wizard Steps) */}
                <div className="p-4 shrink-0 overflow-y-auto max-h-[40vh] custom-scrollbar">
                    {/* Phase 1 Control */}
                    {step === WorkflowStep.IDLE && projectData.episodes.length > 0 && (
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <h3 className="font-semibold text-white mb-2">Phase 1: Analysis</h3>
                        <button onClick={startAnalysis} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <BrainCircuit size={16} />} Start
                        </button>
                        </div>
                    )}
                    
                    {step === WorkflowStep.SETUP_CONTEXT && (
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-4">
                             <div className="flex justify-between items-center">
                                 <h3 className="font-semibold text-blue-300">Phase 1</h3>
                                 <span className="text-xs text-gray-500">Step {analysisStep}/6</span>
                             </div>

                             {/* Step 1: Summary */}
                             {analysisStep === AnalysisSubStep.PROJECT_SUMMARY && (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Project summary analysis complete.</p>
                                    <button onClick={confirmSummaryAndNext} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Next: Episode Summaries</button>
                                </div>
                             )}

                             {/* Step 2: Episodes */}
                             {analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && (
                                <div className="space-y-2">
                                     {analysisQueue.length > 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-yellow-400">
                                            <Loader2 size={12} className="animate-spin"/> Processing batch...
                                        </div>
                                     ) : (
                                        <>
                                            <p className="text-xs text-green-400">All episodes summarized.</p>
                                            <button onClick={confirmEpSummariesAndNext} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Next: Identify Characters</button>
                                        </>
                                     )}
                                </div>
                             )}

                             {/* Step 3: Char List */}
                             {analysisStep === AnalysisSubStep.CHAR_IDENTIFICATION && (
                                <div className="space-y-2">
                                    <p className="text-xs text-green-400">Characters identified.</p>
                                    <button onClick={confirmCharListAndNext} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Next: Character Deep Dive</button>
                                </div>
                             )}

                             {/* Step 4: Char Deep Dive */}
                             {analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && (
                                <div className="space-y-2">
                                     {analysisQueue.length > 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-yellow-400">
                                            <Loader2 size={12} className="animate-spin"/> Analyzing characters...
                                        </div>
                                     ) : (
                                        <>
                                            <p className="text-xs text-green-400">Character analysis complete.</p>
                                            <button onClick={confirmCharDepthAndNext} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Next: Identify Locations</button>
                                        </>
                                     )}
                                </div>
                             )}

                             {/* Step 5: Loc List */}
                             {analysisStep === AnalysisSubStep.LOC_IDENTIFICATION && (
                                <div className="space-y-2">
                                    <p className="text-xs text-green-400">Locations mapped.</p>
                                    <button onClick={confirmLocListAndNext} className="w-full py-2 bg-blue-600 rounded text-xs font-bold">Next: Location Deep Dive</button>
                                </div>
                             )}

                             {/* Step 6: Loc Deep Dive */}
                             {analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && (
                                <div className="space-y-2">
                                     {analysisQueue.length > 0 ? (
                                        <div className="flex items-center gap-2 text-xs text-yellow-400">
                                            <Loader2 size={12} className="animate-spin"/> Visualizing locations...
                                        </div>
                                     ) : (
                                        <>
                                            <p className="text-xs text-green-400">Location analysis complete.</p>
                                            <button onClick={finishAnalysis} className="w-full py-2 bg-green-600 rounded text-xs font-bold">Finish Phase 1</button>
                                        </>
                                     )}
                                </div>
                             )}
                             
                             {/* Complete */}
                             {analysisStep === AnalysisSubStep.COMPLETE && (
                                 <div className="space-y-2">
                                     <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-2">
                                         <CheckCircle size={16} /> Analysis Ready
                                     </div>
                                     <button onClick={startPhase2} className="w-full py-2 bg-blue-600 rounded text-sm font-bold flex items-center justify-center gap-2">Start Phase 2</button>
                                 </div>
                             )}
                        </div>
                    )}

                    {step === WorkflowStep.GENERATE_SHOTS && (
                         <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
                            <h3 className="font-semibold text-white">Phase 2: Shots</h3>
                            <div className="text-xs text-gray-400">Ep {currentEpIndex + 1}/{projectData.episodes.length}</div>
                            {currentEpisode?.status === 'review_shots' && (
                                <button onClick={confirmEpisodeShots} className="w-full py-2 bg-green-600 rounded text-xs font-bold">Confirm & Next</button>
                            )}
                         </div>
                    )}

                    {step === WorkflowStep.GENERATE_SORA && (
                         <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
                            <h3 className="font-semibold text-indigo-300">Phase 3: Prompts</h3>
                            <div className="text-xs text-gray-400">Ep {currentEpIndex + 1}/{projectData.episodes.length}</div>
                             {!isProcessing && currentEpIndex === 0 && currentEpisode?.status !== 'review_sora' && (
                                <button onClick={startPhase3} className="w-full py-2 bg-indigo-600 rounded text-sm font-bold">Start</button>
                            )}
                            {currentEpisode?.status === 'review_sora' && (
                                <button onClick={confirmEpisodeSora} className="w-full py-2 bg-green-600 rounded text-xs font-bold">Confirm & Next</button>
                            )}
                         </div>
                    )}

                     {step === WorkflowStep.COMPLETED && (
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 text-center space-y-2">
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                <CheckCircle size={20} />
                                <h3 className="font-bold">Workflow Complete</h3>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Batch processing finished. You can now use Visual Assets or Video Studio tabs.</p>
                            <button onClick={() => setActiveTab('video')} className="w-full py-2 bg-indigo-600 rounded text-sm font-bold flex items-center justify-center gap-2"><Video size={16}/> Go to Studio</button>
                        </div>
                    )}
                </div>
             </>
          ) : (
             // Collapsed Icons
             <div className="flex flex-col items-center py-4 space-y-6">
                 <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"><Settings size={20}/></button>
                 <div className="w-full h-px bg-gray-800"></div>
                 <div className="flex flex-col gap-4">
                     <div title="Phase 1: Analysis" className={`p-2 rounded-lg ${step >= WorkflowStep.SETUP_CONTEXT ? 'text-blue-400' : 'text-gray-600'}`}><BrainCircuit size={20}/></div>
                     <div title="Phase 2: Shot List" className={`p-2 rounded-lg ${step >= WorkflowStep.GENERATE_SHOTS ? 'text-green-400' : 'text-gray-600'}`}><FileSpreadsheet size={20}/></div>
                     <div title="Phase 3: Sora Prompts" className={`p-2 rounded-lg ${step >= WorkflowStep.GENERATE_SORA ? 'text-indigo-400' : 'text-gray-600'}`}><Film size={20}/></div>
                     <div title="Phase 5: Video Studio" className={`p-2 rounded-lg ${step === WorkflowStep.COMPLETED ? 'text-indigo-400 bg-indigo-900/20' : 'text-gray-600'}`}><Video size={20}/></div>
                 </div>
                 {/* Removed Reset button from here as requested, moved to Header */}
             </div>
          )}
        </aside>

        {/* Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Tabs */}
          <div className="h-10 border-b border-gray-800 bg-gray-900 flex items-end px-4 gap-1 shrink-0 overflow-x-auto no-scrollbar">
             <button 
               onClick={() => setActiveTab('script')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'script' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <FileText size={14} /> Script
             </button>
             <button 
               onClick={() => setActiveTab('understanding')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'understanding' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <BrainCircuit size={14} /> Understanding
             </button>
             <button 
               onClick={() => setActiveTab('table')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'table' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <FileSpreadsheet size={14} /> Shot List
             </button>
             {/* New Phase 4 Tab */}
             <button 
               onClick={() => setActiveTab('visuals')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'visuals' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <Palette size={14} /> Visual Assets
             </button>
              {/* New Phase 5 Tab */}
             <button 
               onClick={() => setActiveTab('video')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'video' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <Video size={14} /> Video Studio
             </button>

              <button 
               onClick={() => setActiveTab('stats')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent whitespace-nowrap ${activeTab === 'stats' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <BarChart2 size={14} /> Dashboard
             </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-gray-900 relative overflow-hidden">
             
             {/* Script View */}
             {activeTab === 'script' && (
                <div className="h-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-800">
                    <div className="flex-1 p-8 overflow-auto font-serif text-lg leading-relaxed text-gray-300 bg-gray-900 selection:bg-blue-900 selection:text-white">
                       {currentEpisode ? (
                         <div className="max-w-3xl mx-auto">
                            <h2 className="text-2xl font-sans font-bold text-white mb-6 sticky top-0 bg-gray-900/95 backdrop-blur py-4 border-b border-gray-800 z-10 flex items-baseline gap-2">
                                {currentEpisode.title}
                                {currentEpisode.scenes && currentEpisode.scenes.length > 0 && (
                                   <span className="text-base font-normal text-gray-500">
                                      ({currentEpisode.scenes.length} Scenes)
                                   </span>
                                )}
                            </h2>
                            
                            {/* Render Scenes if available, else raw content */}
                            {currentEpisode.scenes && currentEpisode.scenes.length > 0 ? (
                                <div className="space-y-8">
                                    {currentEpisode.scenes.map((scene, idx) => (
                                        <div key={idx} className="bg-gray-800/20 p-6 rounded-lg border border-gray-800">
                                            <h3 className="text-lg font-sans font-bold text-blue-400 mb-4 border-b border-gray-700/50 pb-2">
                                                {scene.id} {scene.title}
                                            </h3>
                                            <div className="whitespace-pre-wrap text-gray-300">{scene.content}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap">{currentEpisode.content}</div>
                            )}
                         </div>
                       ) : (
                         <div className="h-full flex items-center justify-center flex-col text-gray-600 gap-2">
                             <FileText size={48} className="opacity-20"/>
                             <p>No episode selected or script not loaded.</p>
                         </div>
                       )}
                    </div>
                </div>
             )}

             {/* New Content Understanding View */}
             {activeTab === 'understanding' && (
                <ContentBoard 
                   data={projectData} 
                   onSelectEpisode={(idx) => {
                       setCurrentEpIndex(idx);
                       setActiveTab('table');
                   }} 
                />
             )}

             {/* Table View */}
             {activeTab === 'table' && (
                <div className="h-full flex flex-col">
                  {currentEpisode ? (
                     <ShotTable shots={currentEpisode.shots} showSora={step >= WorkflowStep.GENERATE_SORA || currentEpisode.status === 'completed'} />
                  ) : (
                     <div className="flex-1 flex items-center justify-center text-gray-500">No data available</div>
                  )}
                </div>
             )}

             {/* New Phase 4 View */}
             {activeTab === 'visuals' && (
                 <VisualAssets data={projectData} config={config} onUpdateUsage={handleUsageUpdate} />
             )}

             {/* New Phase 5 View */}
             {activeTab === 'video' && (
                 <VideoStudio 
                    episodes={projectData.episodes} 
                    onGenerateVideo={handleGenerateVideo}
                    onRemixVideo={handleRemixVideo}
                 />
             )}

             {/* Stats View */}
             {activeTab === 'stats' && (
                 <Dashboard data={projectData} />
             )}

             {/* Loading Overlay */}
             {isProcessing && (
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                  <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center border border-gray-700">
                    <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">AI Processing</h3>
                    <p className="text-gray-400">{processingStatus}</p>
                  </div>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
