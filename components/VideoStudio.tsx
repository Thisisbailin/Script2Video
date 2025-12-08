
import React, { useState, useEffect, useMemo } from 'react';
import { Episode, Shot, VideoParams } from '../types';
import { Play, Loader2, AlertCircle, Download, CheckCircle, Video, ChevronRight, ChevronDown, Sliders, MonitorPlay, FileText, RefreshCcw, AlignLeft, ChevronLeft, ImagePlus, Wand2, X } from 'lucide-react';

interface Props {
  episodes: Episode[];
  onGenerateVideo: (episodeId: number, shotId: string, customPrompt: string, params: VideoParams) => void;
  onRemixVideo?: (episodeId: number, shotId: string, customPrompt: string, originalVideoId: string) => void;
}

export const VideoStudio: React.FC<Props> = ({ episodes, onGenerateVideo, onRemixVideo }) => {
  // Navigation State
  const [activeEpId, setActiveEpId] = useState<number | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>('all'); 
  const [activeShotId, setActiveShotId] = useState<string | null>(null);

  // Editor State
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Params State
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('4s');
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);

  // --- Derived State with Memoization ---
  
  const activeEpisode = useMemo(() => 
    activeEpId ? episodes.find(e => e.id === activeEpId) : null
  , [activeEpId, episodes]);
  
  const isShotInScene = (shotId: string, sceneId: string) => {
      if (!shotId.startsWith(sceneId)) return false;
      const charAfter = shotId[sceneId.length];
      return !charAfter || !/\d/.test(charAfter);
  };

  const availableScenes = useMemo(() => {
      if (!activeEpisode) return [];
      return activeEpisode.scenes.filter(s => {
          return activeEpisode.shots.some(shot => isShotInScene(shot.id, s.id));
      });
  }, [activeEpisode]);

  const activeScene = useMemo(() => 
     availableScenes.find(s => s.id === activeSceneId)
  , [availableScenes, activeSceneId]);
  
  const sceneShots = useMemo(() => {
    if (!activeEpisode) return [];
    if (activeSceneId === 'all') return activeEpisode.shots;
    if (!activeSceneId) return [];
    return activeEpisode.shots.filter(shot => isShotInScene(shot.id, activeSceneId));
  }, [activeEpisode, activeSceneId]);

  const activeShot = useMemo(() => 
     sceneShots.find(s => s.id === activeShotId)
  , [sceneShots, activeShotId]);

  // --- Effects for Auto-Selection ---

  useEffect(() => {
    if (!activeEpId && episodes.length > 0) setActiveEpId(episodes[0].id);
  }, [episodes, activeEpId]);

  useEffect(() => {
    if (activeEpisode) {
        if (availableScenes.length > 0) {
             if (activeSceneId !== 'all' && (!activeSceneId || !availableScenes.find(s => s.id === activeSceneId))) {
                  setActiveSceneId(availableScenes[0].id);
             }
        } else {
             setActiveSceneId('all'); 
        }
    } else {
        setActiveSceneId('all');
    }
  }, [activeEpisode]); 

  useEffect(() => {
     if (sceneShots.length > 0) {
         const currentExists = activeShotId && sceneShots.find(s => s.id === activeShotId);
         if (!currentExists) setActiveShotId(sceneShots[0].id);
     } else {
         setActiveShotId(null);
     }
  }, [sceneShots]);

  // Update Editor State when Active Shot changes
  useEffect(() => {
    if (activeShot) {
        setCustomPrompt(activeShot.finalVideoPrompt || activeShot.soraPrompt || "");
        // Reset image when switching shots to avoid confusion
        setInputImage(null); 
        setInputImagePreview(null);
        
        if (activeShot.videoParams) {
            setAspectRatio(activeShot.videoParams.aspectRatio);
            setDuration(activeShot.videoParams.duration || '4s');
            setQuality(activeShot.videoParams.quality || 'standard');
            // We don't restore File object from saved params as it's not serializable usually
        }
    }
  }, [activeShot]);

  // --- Handlers ---

  const handleGenerate = () => {
      if (activeEpId && activeShotId) {
          onGenerateVideo(activeEpId, activeShotId, customPrompt, {
              aspectRatio,
              duration,
              quality,
              inputImage
          });
      }
  };

  const handleRemix = () => {
      if (activeEpId && activeShotId && activeShot?.videoId && onRemixVideo) {
          onRemixVideo(activeEpId, activeShotId, customPrompt, activeShot.videoId);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setInputImage(file);
          const reader = new FileReader();
          reader.onload = (ev) => {
              setInputImagePreview(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const clearImage = () => {
      setInputImage(null);
      setInputImagePreview(null);
  };

  const navigateShot = (direction: 'prev' | 'next') => {
      if (!sceneShots.length || !activeShotId) return;
      const currentIndex = sceneShots.findIndex(s => s.id === activeShotId);
      if (currentIndex === -1) return;

      if (direction === 'prev' && currentIndex > 0) {
          setActiveShotId(sceneShots[currentIndex - 1].id);
      } else if (direction === 'next' && currentIndex < sceneShots.length - 1) {
          setActiveShotId(sceneShots[currentIndex + 1].id);
      }
  };

  // Helper to show resolution text
  const getResolutionText = () => {
      if (aspectRatio === '16:9') return quality === 'high' ? '1792x1024' : '1280x720';
      return quality === 'high' ? '1024x1792' : '720x1280';
  };

  // --- Render ---

  if (episodes.length === 0) {
      return <div className="h-full flex items-center justify-center text-gray-500">No episodes available. Please import a script first.</div>;
  }

  const currentShotIndex = sceneShots.findIndex(s => s.id === activeShotId);
  const isFirstShot = currentShotIndex <= 0;
  const isLastShot = currentShotIndex >= sceneShots.length - 1;

  return (
    <div className="h-full flex bg-gray-950 text-gray-100 overflow-hidden">
      
      {/* LEFT COLUMN: WORKSTATION */}
      <div className="flex-1 flex flex-col min-w-0">
          
          {/* Top: Video Player */}
          <div className="flex-1 bg-black/50 relative flex items-center justify-center p-8 border-b border-gray-800">
              {activeShot ? (
                  activeShot.videoUrl ? (
                      <div className="w-full h-full flex items-center justify-center relative group">
                          <video 
                              key={activeShot.videoUrl} 
                              src={activeShot.videoUrl} 
                              controls 
                              autoPlay
                              className="max-w-full max-h-full rounded-lg shadow-2xl"
                          />
                          <a 
                              href={activeShot.videoUrl} 
                              download 
                              target="_blank"
                              className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur transition-opacity opacity-0 group-hover:opacity-100"
                          >
                              <Download size={12}/> Download
                          </a>
                      </div>
                  ) : (
                      <div className="text-center">
                         {activeShot.videoStatus === 'generating' ? (
                             <div className="flex flex-col items-center">
                                 <Loader2 size={48} className="text-indigo-500 animate-spin mb-4"/>
                                 <p className="text-gray-300 font-medium">Generating Video...</p>
                                 <p className="text-xs text-gray-500 mt-2">Creating Job & Polling Sora 2 API...</p>
                             </div>
                         ) : activeShot.videoStatus === 'error' ? (
                             <div className="flex flex-col items-center">
                                 <AlertCircle size={48} className="text-red-500 mb-4"/>
                                 <p className="text-red-400 font-medium">Generation Failed</p>
                                 <p className="text-xs text-red-300 mt-2 max-w-xs bg-red-900/20 p-2 rounded border border-red-900/50">{activeShot.videoErrorMsg}</p>
                             </div>
                         ) : (
                             <div className="flex flex-col items-center opacity-30">
                                 <Video size={64} className="mb-4 text-gray-500"/>
                                 <p className="text-gray-500 font-medium">Ready to Generate</p>
                             </div>
                         )}
                      </div>
                  )
              ) : (
                  <div className="flex flex-col items-center opacity-20">
                     <MonitorPlay size={48} className="mb-2"/>
                     <p>Select a shot to begin</p>
                  </div>
              )}
          </div>

          {/* Bottom: Prompt Editor & Parameters */}
          <div className="h-80 bg-gray-900 flex flex-col">
              <div className="flex items-center justify-between px-6 py-2 border-b border-gray-800 bg-gray-900/50">
                  <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wide">
                      <Sliders size={14} /> Video Parameters
                  </h3>
                  {activeShot && (
                    <button 
                        onClick={() => setCustomPrompt(activeShot.soraPrompt)}
                        className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                        title="Reset to AI generated prompt"
                    >
                        <RefreshCcw size={10} /> Reset Prompt
                    </button>
                  )}
              </div>

              <div className="flex-1 flex overflow-hidden">
                  {/* Prompt Input */}
                  <div className="flex-1 p-4 border-r border-gray-800 relative group">
                      <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          disabled={!activeShot}
                          className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none custom-scrollbar font-mono shadow-inner transition-colors disabled:opacity-50"
                          placeholder="Video prompt will appear here..."
                      />
                      <div className="absolute bottom-6 right-6 text-[10px] text-gray-600 font-mono pointer-events-none group-hover:text-gray-500 transition-colors">
                          {customPrompt.length} chars
                      </div>
                  </div>

                  {/* Controls */}
                  <div className="w-80 p-5 flex flex-col gap-5 bg-gray-900 overflow-y-auto custom-scrollbar">
                      
                      {/* Row 1: Aspect & Quality */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Aspect Ratio</label>
                              <div className="flex rounded bg-gray-800 p-0.5 border border-gray-700">
                                  {['16:9', '9:16'].map(r => (
                                      <button key={r} onClick={() => setAspectRatio(r)} className={`flex-1 py-1.5 text-[10px] rounded transition-all ${aspectRatio === r ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                                          {r}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <div>
                               <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Quality</label>
                               <div className="flex rounded bg-gray-800 p-0.5 border border-gray-700">
                                  {['standard', 'high'].map(q => (
                                      <button key={q} onClick={() => setQuality(q as any)} className={`flex-1 py-1.5 text-[10px] rounded transition-all ${quality === q ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                                          {q === 'standard' ? 'Std' : 'High'}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="text-[10px] text-center text-gray-600 -mt-3">
                           Output Size: {getResolutionText()}
                      </div>

                      {/* Row 2: Duration */}
                      <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Duration</label>
                          <div className="grid grid-cols-3 gap-2">
                              {['4s', '8s', '12s'].map(dur => (
                                  <button key={dur} onClick={() => setDuration(dur)} className={`py-1.5 text-[10px] rounded border transition-all ${duration === dur ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
                                      {dur}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Row 3: Reference Image */}
                      <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Ref Image (Start Frame)</label>
                          {!inputImagePreview ? (
                              <div className="relative">
                                  <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} className="hidden" id="ref-img-upload" disabled={!activeShot} />
                                  <label htmlFor="ref-img-upload" className={`flex items-center justify-center gap-2 w-full py-3 border border-dashed rounded cursor-pointer transition-colors ${!activeShot ? 'opacity-50 cursor-not-allowed border-gray-700' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800'}`}>
                                      <ImagePlus size={14} className="text-gray-400"/>
                                      <span className="text-xs text-gray-400">Upload Image</span>
                                  </label>
                              </div>
                          ) : (
                              <div className="relative group rounded overflow-hidden border border-gray-700 h-24 bg-black">
                                  <img src={inputImagePreview} alt="Ref" className="w-full h-full object-contain" />
                                  <button onClick={clearImage} className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X size={12} />
                                  </button>
                              </div>
                          )}
                      </div>

                      {/* Row 4: Actions */}
                      <div className="mt-auto grid grid-cols-2 gap-2">
                           <button
                              onClick={handleGenerate}
                              disabled={!activeShot || activeShot.videoStatus === 'generating' || !customPrompt.trim()}
                              className={`py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                                  activeShot?.videoStatus === 'generating'
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700 col-span-2'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] shadow-indigo-900/30 ' + (activeShot?.videoId ? '' : 'col-span-2')
                              }`}
                          >
                              {activeShot?.videoStatus === 'generating' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                              {activeShot?.videoId ? 'New Gen' : 'Generate'}
                          </button>

                          {/* Remix Button */}
                          {activeShot?.videoId && onRemixVideo && (
                              <button
                                  onClick={handleRemix}
                                  disabled={activeShot.videoStatus === 'generating'}
                                  className="py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] shadow-purple-900/30"
                              >
                                  <Wand2 size={16} /> Remix
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* RIGHT COLUMN: INSPECTOR (Unchanged) */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-800 bg-gray-900">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MonitorPlay size={12} /> Navigation
              </h4>
              <div className="space-y-3">
                  <div className="relative">
                       <select value={activeEpId || ''} onChange={(e) => setActiveEpId(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-3 py-2 appearance-none focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                          {episodes.map(ep => (<option key={ep.id} value={ep.id}>{ep.title}</option>))}
                       </select>
                       <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
                  </div>
                  <div className="relative">
                       <select value={activeSceneId || 'all'} onChange={(e) => setActiveSceneId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-3 py-2 appearance-none focus:ring-1 focus:ring-indigo-500 focus:outline-none">
                          <option value="all">All Scenes ({activeEpisode?.shots.length || 0} Shots)</option>
                          {availableScenes.map(s => (<option key={s.id} value={s.id}>{s.id} {s.title}</option>))}
                       </select>
                       <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                          <select value={activeShotId || ''} onChange={(e) => setActiveShotId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-3 py-2 appearance-none focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono" disabled={!sceneShots.length}>
                             {sceneShots.length ? sceneShots.map(s => (<option key={s.id} value={s.id}>Shot {s.id}</option>)) : <option>No Shots</option>}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
                      </div>
                      <div className="flex border border-gray-700 rounded overflow-hidden">
                          <button onClick={() => navigateShot('prev')} disabled={isFirstShot} className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors border-r border-gray-700"><ChevronLeft size={14} /></button>
                          <button onClick={() => navigateShot('next')} disabled={isLastShot} className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                      </div>
                  </div>
              </div>
          </div>
          {activeShot ? (
              <>
                 <div className="flex-1 overflow-y-auto p-0 border-b border-gray-800">
                    <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-800 text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2">
                        <AlignLeft size={10} /> Shot Details
                    </div>
                    <div className="p-4 space-y-4">
                        <div><p className="text-sm text-gray-200 leading-relaxed font-medium">{activeShot.description}</p></div>
                        {activeShot.dialogue && (<div className="pl-3 border-l-2 border-indigo-500/50"><span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Dialogue</span><p className="text-sm text-gray-300 italic">"{activeShot.dialogue}"</p></div>)}
                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700">{activeShot.shotType}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700">{activeShot.movement}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700">{activeShot.duration}</span>
                        </div>
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto bg-gray-900/50">
                    <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-800 text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2"><FileText size={10} /> Original Script</div>
                    <div className="p-4"><p className="text-xs text-gray-400 font-serif whitespace-pre-wrap leading-relaxed opacity-80">{activeScene?.content || "Select a specific scene to view script context."}</p></div>
                 </div>
              </>
          ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 italic text-xs p-8 text-center">Select a shot to view details.</div>
          )}
      </div>
    </div>
  );
};
