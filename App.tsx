
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Play, CheckCircle, FileText, Video, Download, Upload, AlertCircle, ChevronRight, Loader2, RotateCcw, XCircle, FileSpreadsheet, BarChart2, BrainCircuit, Palette, FolderOpen } from 'lucide-react';
import { ProjectData, AppConfig, WorkflowStep, Episode, Shot, TokenUsage } from './types';
import { INITIAL_PROJECT_DATA, AVAILABLE_MODELS } from './constants';
import { parseScriptToEpisodes, exportToExcel, parseCSVToShots } from './utils/parser';
import { SettingsModal } from './components/SettingsModal';
import { ShotTable } from './components/ShotTable';
import { Dashboard } from './components/Dashboard';
import { ContentBoard } from './components/ContentBoard';
import * as GeminiService from './services/geminiService';

const App: React.FC = () => {
  // Initialize state
  const [projectData, setProjectData] = useState<ProjectData>(INITIAL_PROJECT_DATA);
  const [config, setConfig] = useState<AppConfig>({ model: AVAILABLE_MODELS[0].id });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Workflow State
  const [step, setStep] = useState<WorkflowStep>(WorkflowStep.IDLE);
  const [currentEpIndex, setCurrentEpIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState<'script' | 'understanding' | 'table' | 'stats'>('script');

  // Input Refs
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);

  // Load default guides on mount
  useEffect(() => {
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
             shotGuide: shotText,
             soraGuide: soraText
           }));
        } else {
           console.warn("Could not load default guides from file system.");
        }
      } catch (e) {
        console.error("Error loading default guides:", e);
      }
    };
    loadDefaultGuides();
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

  // --- Handlers ---

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

  // --- Workflow Logic ---

  const startPhase1 = async () => {
    if (!projectData.shotGuide) {
      alert("Please upload or define Shot Guidelines first.");
      return;
    }
    setStep(WorkflowStep.SETUP_CONTEXT);
    setIsProcessing(true);
    setProcessingStatus("Analyzing Content: Generating Project & Character Data...");

    try {
      // PHASE 1: Pass global style guide for context awareness (if available)
      const result = await GeminiService.generateProjectContext(
        config.model,
        projectData.rawScript,
        projectData.shotGuide,
        projectData.globalStyleGuide
      );
      setProjectData(prev => ({ ...prev, context: result.data, contextUsage: result.usage }));
      setProcessingStatus("Content Analysis Complete.");
      setIsProcessing(false);
      updateStats('context', true);
      
      // Auto-switch to the new Understanding Tab
      setActiveTab('understanding');

    } catch (e: any) {
      console.error(e);
      setProcessingStatus("Error generating context: " + (e.message || "Unknown error"));
      setIsProcessing(false);
      updateStats('context', false);
      alert("Failed to generate context. Please check API settings and try again.");
    }
  };

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
      // PHASE 2: Pass global style guide
      const result = await GeminiService.generateEpisodeShots(
        config.model,
        episode.title,
        episode.content,
        projectData.context,
        projectData.shotGuide,
        index,
        projectData.globalStyleGuide
      );

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          summary: result.summary,
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
    setCurrentEpIndex(nextIndex);
    
    if (nextIndex < projectData.episodes.length) {
       generateCurrentEpisodeShots(nextIndex);
    } else {
       alert("Phase 2 Complete! Please upload Sora Guide to proceed.");
       setStep(WorkflowStep.GENERATE_SORA);
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
      setStep(WorkflowStep.COMPLETED);
      alert("All tasks completed! You can now export.");
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
             config.model,
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
    setCurrentEpIndex(nextIndex);
    
    if (nextIndex < projectData.episodes.length) {
       generateCurrentEpisodeSora(nextIndex);
    } else {
       setStep(WorkflowStep.COMPLETED);
    }
  };

  const handleRetry = () => {
      if(step === WorkflowStep.GENERATE_SHOTS) {
          generateCurrentEpisodeShots(currentEpIndex);
      } else if (step === WorkflowStep.GENERATE_SORA) {
          generateCurrentEpisodeSora(currentEpIndex);
      }
  };

  // --- Render Helpers ---

  const currentEpisode = projectData.episodes[currentEpIndex];
  const hasGeneratedShots = projectData.episodes.some(ep => ep.shots.length > 0);

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
             {config.model}
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
        <aside className="w-80 border-r border-gray-800 bg-gray-900 flex flex-col shrink-0 z-10">
          
          {/* GROUP 1: Project Assets */}
          <div className="p-4 border-b border-gray-800 space-y-4 shrink-0">
             <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider mb-2">
                <FolderOpen size={12} className="text-blue-500" /> Project Assets
             </div>

             {/* Script */}
             <div className="space-y-1">
               <span className="text-xs font-semibold text-gray-500 uppercase">Script (TXT)</span>
               <div className="flex gap-2">
                 <input type="file" ref={scriptInputRef} className="hidden" accept=".txt" onChange={(e) => handleFileUpload(e, 'script')} />
                 <button onClick={() => scriptInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm text-gray-200">
                    <FileText size={14} /> {projectData.fileName ? 'Change Script' : 'Upload Script'}
                 </button>
               </div>
               {projectData.fileName && <p className="text-xs text-green-400 truncate">Loaded: {projectData.fileName} ({projectData.episodes.length} Eps)</p>}
             </div>

             {/* Global Style Guide */}
             <div className="space-y-1">
               <span className="text-xs font-semibold text-gray-500 uppercase">Visual Style Guide (MD)</span>
               <div className="flex gap-2">
                 <input type="file" ref={globalStyleInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'globalStyleGuide')} />
                 <button onClick={() => globalStyleInputRef.current?.click()} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm transition-colors ${projectData.globalStyleGuide ? 'bg-purple-900/30 border-purple-800 text-purple-300' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 border-dashed'}`}>
                    <Palette size={14} /> {projectData.globalStyleGuide ? 'Style Bible Loaded' : 'Upload Style Bible'}
                 </button>
               </div>
             </div>

             {/* Import CSV */}
             <div className="space-y-1 pt-2">
                <div className="flex gap-2">
                    <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileUpload(e, 'csvShots')} />
                    <button 
                        onClick={() => csvInputRef.current?.click()} 
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs text-gray-500"
                        title="Import a previously generated CSV to skip Phase 2"
                    >
                        <FileSpreadsheet size={12} /> Import CSV (Restore)
                    </button>
                </div>
             </div>
          </div>

          {/* GROUP 2: Standard SOPs */}
          <div className="p-4 border-b border-gray-800 space-y-3 shrink-0">
             <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider mb-2">
                <CheckCircle size={12} className="text-green-500" /> Standard SOPs
             </div>
             
             {/* Shot Guide */}
             <div className="space-y-1">
               <span className="text-xs font-semibold text-gray-500 uppercase">Shot Guide</span>
               <div className="flex gap-2">
                 <input type="file" ref={shotGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'shotGuide')} />
                 <button onClick={() => shotGuideInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300" title="Upload Custom Standard">
                    <Upload size={12} /> Custom
                 </button>
               </div>
               {projectData.shotGuide && <p className="text-[10px] text-green-400 mt-0.5">System Standard Loaded</p>}
             </div>

             {/* Sora Guide */}
             <div className="space-y-1">
               <span className="text-xs font-semibold text-gray-500 uppercase">Sora Prompt Guide</span>
               <div className="flex gap-2">
                 <input type="file" ref={soraGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileUpload(e, 'soraGuide')} />
                 <button onClick={() => soraGuideInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300" title="Upload Custom Standard">
                    <Upload size={12} /> Custom
                 </button>
               </div>
               {projectData.soraGuide && <p className="text-[10px] text-green-400 mt-0.5">System Standard Loaded</p>}
             </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 shrink-0">
             {/* Phase 1 Control */}
             {step === WorkflowStep.IDLE && projectData.episodes.length > 0 && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                   <h3 className="font-semibold text-white mb-2">Phase 1: Understanding</h3>
                   <p className="text-xs text-gray-400 mb-4">Analyze script to generate project summary and character profiles.</p>
                   <button 
                     onClick={startPhase1}
                     className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                     disabled={isProcessing}
                   >
                     {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <BrainCircuit size={16} />} 
                     Analyze Content
                   </button>
                </div>
             )}

            {/* Context Review */}
            {step === WorkflowStep.SETUP_CONTEXT && !isProcessing && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                   <h3 className="font-semibold text-green-400 flex items-center gap-2"><CheckCircle size={16}/> Analysis Ready</h3>
                   <p className="text-xs text-gray-400">Review the character cards and summaries in the main view before proceeding.</p>
                   <button 
                     onClick={startPhase2}
                     className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                   >
                     Confirm & Next <ChevronRight size={16} />
                   </button>
                </div>
            )}

            {/* Phase 2: Shot Gen Loop */}
            {step === WorkflowStep.GENERATE_SHOTS && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                   <h3 className="font-semibold text-white mb-1">Phase 2: Shot List</h3>
                   <div className="w-full bg-gray-900 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{width: `${((currentEpIndex)/projectData.episodes.length)*100}%`}}></div>
                   </div>
                   <p className="text-xs text-gray-400 flex justify-between">
                     <span>Ep {currentEpIndex + 1} / {projectData.episodes.length}</span>
                     <span>{currentEpisode?.status === 'review_shots' ? 'Reviewing' : currentEpisode?.status === 'error' ? 'Error' : 'Processing'}</span>
                   </p>

                   {currentEpisode?.status === 'review_shots' && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                       <button onClick={handleRetry} className="py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"><RotateCcw size={12}/> Regenerate</button>
                       <button onClick={confirmEpisodeShots} className="py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors">Confirm & Next</button>
                     </div>
                   )}
                   {currentEpisode?.status === 'error' && (
                     <div className="mt-2">
                        <div className="text-xs text-red-400 mb-2 p-2 bg-red-900/20 rounded border border-red-900/50 break-words">
                            {currentEpisode.errorMsg}
                        </div>
                        <button onClick={handleRetry} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2">
                            <RotateCcw size={14}/> Retry Episode
                        </button>
                     </div>
                   )}
                   {isProcessing && <div className="text-xs text-blue-300 animate-pulse flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Generating...</div>}
                </div>
            )}

             {/* Phase 3: Sora Gen Loop */}
             {step === WorkflowStep.GENERATE_SORA && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                   <h3 className="font-semibold text-indigo-300 mb-1">Phase 3: Sora Prompts</h3>
                   
                   {projectData.soraGuide ? (
                     <>
                        <div className="w-full bg-gray-900 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{width: `${((currentEpIndex)/projectData.episodes.length)*100}%`}}></div>
                        </div>
                        <p className="text-xs text-gray-400 flex justify-between">
                            <span>Ep {currentEpIndex + 1} / {projectData.episodes.length}</span>
                            <span>{currentEpisode?.status === 'review_sora' ? 'Reviewing' : currentEpisode?.status === 'error' ? 'Error' : 'Processing'}</span>
                        </p>

                        {currentEpisode?.status === 'review_sora' && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                            <button onClick={handleRetry} className="py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"><RotateCcw size={12}/> Regenerate</button>
                            <button onClick={confirmEpisodeSora} className="py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors">Confirm & Next</button>
                            </div>
                        )}
                        {currentEpisode?.status === 'error' && (
                             <div className="mt-2">
                                <div className="text-xs text-red-400 mb-2 p-2 bg-red-900/20 rounded border border-red-900/50 break-words">
                                    {currentEpisode.errorMsg}
                                </div>
                                <button onClick={handleRetry} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2">
                                    <RotateCcw size={14}/> Retry Episode
                                </button>
                             </div>
                        )}
                        {!isProcessing && currentEpIndex === 0 && currentEpisode?.status !== 'review_sora' && currentEpisode?.status !== 'error' && (
                            <button onClick={startPhase3} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold transition-colors">Start Batch Generation</button>
                        )}
                        {isProcessing && <div className="text-xs text-indigo-300 animate-pulse flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Writing Prompts...</div>}
                     </>
                   ) : (
                     <div className="text-xs text-yellow-500 flex items-center gap-2 bg-yellow-900/20 p-2 rounded border border-yellow-900">
                        <AlertCircle size={16} /> Upload Sora Guide above to start Phase 3.
                     </div>
                   )}
                </div>
            )}

             {step === WorkflowStep.COMPLETED && (
                 <div className="p-4 bg-green-900/20 border border-green-900 rounded-lg text-center">
                    <CheckCircle className="mx-auto text-green-500 mb-2" size={32}/>
                    <h3 className="text-green-400 font-bold">Workflow Complete</h3>
                    <p className="text-xs text-green-600/80 mb-4">All episodes processed.</p>
                 </div>
             )}

          </div>

          {/* Episode List Sidebar */}
          {projectData.episodes.length > 0 && (
            <div className="flex-1 overflow-y-auto border-t border-gray-800 bg-gray-900/50">
                <div className="p-4">
                   <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block tracking-wider">Episode List</span>
                   <div className="space-y-1">
                     {projectData.episodes.map((ep, idx) => (
                       <button
                         key={ep.id}
                         onClick={() => {
                            if (!isProcessing) {
                                setCurrentEpIndex(idx);
                                setActiveTab('script'); // Switch to script tab on click
                            }
                         }}
                         disabled={isProcessing}
                         className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between group transition-colors ${
                           currentEpIndex === idx 
                             ? 'bg-blue-900/40 text-blue-200 border border-blue-800/50' 
                             : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                         }`}
                       >
                         <span className="truncate font-medium">{ep.title}</span>
                         <div className="flex items-center gap-2">
                             {ep.status === 'error' && <XCircle size={12} className="text-red-500" />}
                             {ep.status === 'completed' && <CheckCircle size={12} className="text-green-500" />}
                             {(ep.status === 'confirmed_shots' || ep.status === 'review_sora') && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                         </div>
                       </button>
                     ))}
                   </div>
                </div>
            </div>
          )}
        </aside>

        {/* Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Tabs */}
          <div className="h-10 border-b border-gray-800 bg-gray-900 flex items-end px-4 gap-1 shrink-0">
             <button 
               onClick={() => setActiveTab('script')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent ${activeTab === 'script' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <FileText size={14} /> Script
             </button>
             <button 
               onClick={() => setActiveTab('understanding')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent ${activeTab === 'understanding' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <BrainCircuit size={14} /> Understanding
             </button>
             <button 
               onClick={() => setActiveTab('table')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent ${activeTab === 'table' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <Video size={14} /> Shot List
             </button>
              <button 
               onClick={() => setActiveTab('stats')}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 border-t border-x border-transparent ${activeTab === 'stats' ? 'bg-gray-800 text-white border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
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