
import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, AppConfig, Character, Location, TokenUsage, LocationZone } from '../types';
import { Palette, Paintbrush, ImageIcon, Send, User, MapPin, Download, Loader2, RotateCcw, ImagePlus, Sliders, ChevronDown, Sparkles, Copy, ClipboardCheck, ListChecks } from 'lucide-react';
import * as MultimodalService from '../services/multimodalService';

interface Props {
  data: ProjectData;
  config: AppConfig;
  onUpdateUsage: (usage: TokenUsage) => void;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ImageParams {
    aspectRatio: string;
    count: number;
    resolution: string;
}

export const VisualAssets: React.FC<Props> = ({ data, config, onUpdateUsage }) => {
  // Selection State
  const [activeTab, setActiveTab] = useState<'characters' | 'locations'>('characters');
  const [selectedAsset, setSelectedAsset] = useState<Character | Location | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Parameter State
  const [basePrompt, setBasePrompt] = useState('');
  const [params, setParams] = useState<ImageParams>({
      aspectRatio: '1:1',
      count: 1,
      resolution: '1024x1024'
  });

  // Init Selection
  useEffect(() => {
      if (selectedAsset) return;
      if (activeTab === 'characters' && data.context.characters.length > 0) {
          handleSelectAsset(data.context.characters[0]);
      } else if (activeTab === 'locations' && data.context.locations.length > 0) {
          handleSelectAsset(data.context.locations[0]);
      }
  }, [activeTab, data, selectedAsset]);

  // Handle Asset Selection
  const handleSelectAsset = (asset: Character | Location) => {
      setSelectedAsset(asset);
      setChatHistory([]); // Clear chat for new asset
      setCopiedKey(null);
      setCopied(null);
      
      // Construct Initial Base Prompt
      let initialPrompt = "";
      if ('bio' in asset) { // Character
          const forms = asset.forms?.length
            ? asset.forms.map(f => `${f.formName} (${f.identityOrState || f.visualTags || ''})`).join(', ')
            : 'Standard';
          initialPrompt = `【Character Asset Brief】\nName: ${asset.name}\nRole: ${asset.role}\nPriority: ${asset.assetPriority || 'n/a'}\nUsage: ${asset.episodeUsage || 'n/a'}\nBio: ${asset.bio}\nForms: ${forms}`;
      } else { // Location
          const zones = (asset as any).zones as LocationZone[] | undefined;
          const zonesLine = zones?.length
            ? zones.map(z => `${z.name} [${z.kind || 'zone'} | ${z.episodeRange}]`).join(', ')
            : 'Single zone';
          initialPrompt = `【Environment Asset Brief】\nName: ${asset.name}\nType: ${asset.type}\nPriority: ${asset.assetPriority || 'n/a'}\nUsage: ${asset.episodeUsage || 'n/a'}\nDescription: ${asset.description}\nZones: ${zonesLine}\nVisuals: ${asset.visuals}`;
      }
      
      if (data.globalStyleGuide) {
          initialPrompt += `\n\n【Global Style Guide】\n${data.globalStyleGuide}`;
      }
      
      setBasePrompt(initialPrompt);
  };

  const renderCharacterDetails = (char: Character) => {
      return (
          <div className="space-y-3">
              <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">角色: {char.role}</span>
                  {char.assetPriority && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">优先级: {char.assetPriority}</span>}
                  {char.episodeUsage && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">出现: {char.episodeUsage}</span>}
                  {char.archetype && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">人设: {char.archetype}</span>}
              </div>
              <div className="space-y-2">
                  {(char.forms && char.forms.length > 0) ? char.forms.map((f, idx) => {
                      const promptKey = `char-form-prompt-${idx}`;
                      const deliverKey = `char-form-deliv-${idx}`;
                      return (
                          <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-900/50">
                              <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                      {f.formName} <span className="text-xs text-gray-500 ml-2">{f.episodeRange}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      {f.genPrompts && (
                                          <button
                                              onClick={() => copyText(promptKey, f.genPrompts)}
                                              className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                              title="复制生成提示"
                                          >
                                              {copiedKey === promptKey ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                                          </button>
                                      )}
                                      {f.deliverables && (
                                          <button
                                              onClick={() => copyText(deliverKey, f.deliverables)}
                                              className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                              title="复制交付要求"
                                          >
                                              {copiedKey === deliverKey ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                                          </button>
                                      )}
                                  </div>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                  {f.identityOrState || f.description}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                  {f.visualTags}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300 mt-2">
                                  {f.hair && <div><span className="font-semibold">发型：</span>{f.hair}</div>}
                                  {f.face && <div><span className="font-semibold">脸部：</span>{f.face}</div>}
                                  {f.body && <div><span className="font-semibold">体态：</span>{f.body}</div>}
                                  {f.costume && <div><span className="font-semibold">服装：</span>{f.costume}</div>}
                                  {f.accessories && <div><span className="font-semibold">配饰：</span>{f.accessories}</div>}
                                  {f.props && <div><span className="font-semibold">道具：</span>{f.props}</div>}
                                  {f.materialPalette && <div className="col-span-2"><span className="font-semibold">材质/色板：</span>{f.materialPalette}</div>}
                                  {f.lightingOrPalette && <div className="col-span-2"><span className="font-semibold">光线/调色：</span>{f.lightingOrPalette}</div>}
                                  {f.poses && <div className="col-span-2"><span className="font-semibold">姿态：</span>{f.poses}</div>}
                                  {f.expressions && <div className="col-span-2"><span className="font-semibold">表情：</span>{f.expressions}</div>}
                                  {f.turnaroundNeeded !== undefined && <div><span className="font-semibold">三视图：</span>{f.turnaroundNeeded ? '需要' : '不需要'}</div>}
                                  {f.deliverables && <div className="col-span-2"><span className="font-semibold">交付：</span>{f.deliverables}</div>}
                                  {f.designRationale && <div className="col-span-2"><span className="font-semibold">理由：</span>{f.designRationale}</div>}
                              </div>
                          </div>
                      );
                  }) : (
                      <div className="text-xs text-gray-500">暂无形态细节。</div>
                  )}
              </div>
          </div>
      );
  };

  const renderLocationDetails = (loc: Location) => {
      const zones = (loc as any).zones as LocationZone[] | undefined;
      return (
          <div className="space-y-3">
              <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">类型: {loc.type}</span>
                  {loc.assetPriority && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">优先级: {loc.assetPriority}</span>}
                  {loc.episodeUsage && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">出现: {loc.episodeUsage}</span>}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-200">{loc.description}</div>
              {loc.visuals && <div className="text-xs text-gray-600 dark:text-gray-300">整体氛围：{loc.visuals}</div>}
              <div className="space-y-2">
                  {zones && zones.length ? zones.map((z, idx) => {
                      const promptKey = `loc-zone-prompt-${idx}`;
                      const deliverKey = `loc-zone-deliv-${idx}`;
                      return (
                          <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-900/50">
                              <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                      {z.name} <span className="text-xs text-gray-500 ml-2">{z.episodeRange}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      {z.genPrompts && (
                                          <button
                                              onClick={() => copyText(promptKey, z.genPrompts)}
                                              className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                              title="复制生成提示"
                                          >
                                              {copiedKey === promptKey ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                                          </button>
                                      )}
                                      {z.deliverables && (
                                          <button
                                              onClick={() => copyText(deliverKey, z.deliverables)}
                                              className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                              title="复制交付要求"
                                          >
                                              {copiedKey === deliverKey ? <ClipboardCheck size={14} /> : <Copy size={14} />}
                                          </button>
                                      )}
                                  </div>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">{z.kind || '区域'}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700 dark:text-gray-200 mt-2">
                                  {z.layoutNotes && <div className="col-span-2"><span className="font-semibold">布局：</span>{z.layoutNotes}</div>}
                                  {z.keyProps && <div className="col-span-2"><span className="font-semibold">道具/布景：</span>{z.keyProps}</div>}
                                  {z.lightingWeather && <div className="col-span-2"><span className="font-semibold">光线/天气：</span>{z.lightingWeather}</div>}
                                  {z.materialPalette && <div className="col-span-2"><span className="font-semibold">材质/色板：</span>{z.materialPalette}</div>}
                                  {z.designRationale && <div className="col-span-2"><span className="font-semibold">设计理由：</span>{z.designRationale}</div>}
                                  {z.deliverables && <div className="col-span-2"><span className="font-semibold">交付：</span>{z.deliverables}</div>}
                              </div>
                          </div>
                      );
                  }) : (
                      <div className="text-xs text-gray-500">暂无分区细节。</div>
                  )}
              </div>
          </div>
      );
  };

  // Auto-scroll chat
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [chatHistory]);

  const handleInitialGenerate = async () => {
      if (!config.multimodalConfig.apiKey) {
          alert("Please configure Multimodal Intelligence in Settings first.");
          return;
      }
      
      setIsGenerating(true);
      setChatHistory([]); // Reset history for new generation

      // System Instruction Construction
      const systemMsg: ChatMessage = {
          role: 'system',
          content: `You are an expert Concept Artist AI. Your task is to generate visual designs for a film project.
          
          Parameters:
          - Aspect Ratio: ${params.aspectRatio}
          - Count: ${params.count}
          - Resolution: ${params.resolution}
          
          Instructions:
          1. Analyze the provided Asset Data and Style Guide.
          2. Generate a highly detailed visual description or an actual image (if your model supports image generation via text) for this asset.
          3. If you are a model that returns text-to-image links, please ensure they are formatted as Markdown images: ![alt](url).
          4. If you are a text-only model, provide a stable diffusion compatible prompt block in a code block, followed by a vivid artistic description.
          5. Maintain consistency with the Global Style Guide.
          `
      };
      
      const userMsg: ChatMessage = {
          role: 'user',
          content: `Asset Data:\n${basePrompt}\n\nGenerate initial concept art.`
      };
      
      const newHistory = [systemMsg, userMsg];
      
      try {
          const { content, usage } = await MultimodalService.sendMessage(newHistory, config.multimodalConfig);
          
          onUpdateUsage(usage);

          setChatHistory([
              systemMsg,
              userMsg,
              { role: 'assistant', content: content }
          ]);
      } catch (e: any) {
          const errorMsg: ChatMessage = {
              role: 'assistant',
              content: `Error: ${e.message}`
          };
          setChatHistory([errorMsg]);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleRefineSend = async () => {
      if (!userInput.trim()) return;
      
      setIsGenerating(true);
      const input = userInput.trim();
      
      const nextUserMsg: ChatMessage = {
          role: 'user',
          content: `Refinement Instruction: ${input}\n\n(Remember parameters: ${params.aspectRatio}, ${params.resolution})`
      };
      
      // Update UI state immediately
      const currentHistory = [...chatHistory, nextUserMsg];
      setChatHistory(currentHistory);
      setUserInput('');

      // INTELLIGENT HISTORY OPTIMIZATION
      // 1. We want to keep the LATEST generated image so the AI can "see" it for refinement.
      // 2. We want to strip OLDER images to prevent Token Limits (Base64 is huge).
      
      // Find the index of the last assistant message that likely contains an image
      let lastImageIndex = -1;
      for (let i = currentHistory.length - 1; i >= 0; i--) {
          if (currentHistory[i].role === 'assistant' && currentHistory[i].content.includes('data:image')) {
              lastImageIndex = i;
              break;
          }
      }

      const optimizedHistory = currentHistory.map((msg, index) => {
          // If it's an image message...
          if (msg.role === 'assistant' && msg.content.includes('data:image')) {
              // ...and it is NOT the last image in the conversation
              if (index !== lastImageIndex) {
                  // Strip the data to save tokens
                  let clean = msg.content.replace(/!\[(.*?)\]\(data:image\/.*?\)/g, "![Old Image]([Image Omitted])");
                  clean = clean.replace(/data:image\/[a-zA-Z]+;base64,[^\s")]+/g, "[Base64 Omitted]");
                  return { ...msg, content: clean };
              }
              // If it IS the last image, KEEP IT intact. 
              // The Service layer will transform it into an { image_url } object so it doesn't count as 600k text tokens.
          }
          return msg;
      });

      try {
          const { content, usage } = await MultimodalService.sendMessage(optimizedHistory, config.multimodalConfig);
          onUpdateUsage(usage);
          setChatHistory(prev => [...prev, { role: 'assistant', content: content }]);
      } catch (e: any) {
          setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
      } finally {
          setIsGenerating(false);
      }
  };

  const copyText = (key: string, text?: string) => {
      if (!text) return;
      if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 1400);
      }
  };

  const MarkdownRenderer = ({ content }: { content: string }) => {
    // Improved regex to catch ![alt](url) or ![alt](url) with looser matching inside []
    const parts = content.split(/(!\[[^\]]*\]\([^\)]+\))/g);
      
      return (
          <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
              {parts.map((part, i) => {
                  // Check for Markdown Image
                  const imgMatch = part.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                  if (imgMatch) {
                      const alt = imgMatch[1];
                      const src = imgMatch[2];
                      
                      // Handle Omitted Data Placeholder
                      if (src.includes("[Image Omitted]") || src.includes("[Base64 Omitted]")) {
                          return (
                              <div key={i} className="my-2 p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-500 italic text-center">
                                  [Previous generation history hidden to save context]
                              </div>
                          );
                      }

                      return (
                          <div key={i} className="my-4 relative group inline-block">
                              <img src={src} alt={alt} className="rounded-lg shadow-lg max-w-full border border-gray-200 dark:border-gray-700" />
                              <a 
                                  href={src} 
                                  download={`asset_${Date.now()}`} 
                                  target="_blank"
                                  rel="noreferrer"
                                  className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <Download size={16} />
                              </a>
                          </div>
                      );
                  }
                  
                  // Fallback: Check for raw Base64 data (data:image/...) that might be in the text but not in MD format
                  if (part.includes('data:image')) {
                      const b64Match = part.match(/(data:image\/[a-zA-Z]+;base64,[^\s\)]+)/);
                      if (b64Match) {
                           const src = b64Match[1];
                           return (
                              <div key={i} className="my-4 relative group inline-block">
                                  <img src={src} alt="Base64 Generated" className="rounded-lg shadow-lg max-w-full border border-gray-200 dark:border-gray-700" />
                                  <a 
                                      href={src} 
                                      download={`asset_b64_${Date.now()}.png`} 
                                      className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <Download size={16} />
                                  </a>
                              </div>
                           );
                      }
                  }

                  // Fallback: Check if line looks like a raw image url (http...png/jpg)
                  if (part.match(/^https?:\/\/.*\.(png|jpg|jpeg|webp)$/i)) {
                       return (
                          <div key={i} className="my-4 relative group inline-block">
                              <img src={part} alt="Generated" className="rounded-lg shadow-lg max-w-full border border-gray-200 dark:border-gray-700" />
                          </div>
                       );
                  }
                  
                  if (!part.trim()) return null;
                  
                  return <div key={i} className="whitespace-pre-wrap mb-2">{part}</div>;
              })}
          </div>
      );
  };

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors">
      
      {/* LEFT COLUMN: CONTROLS & ASSETS */}
      <div className="w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
              <button 
                  onClick={() => setActiveTab('characters')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'characters' ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                  <User size={16} /> Characters
              </button>
              <button 
                  onClick={() => setActiveTab('locations')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'locations' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                  <MapPin size={16} /> Locations
              </button>
          </div>

          {/* Asset List */}
          <div className="h-48 overflow-y-auto border-b border-gray-200 dark:border-gray-800 custom-scrollbar">
              {activeTab === 'characters' ? (
                  data.context.characters.length > 0 ? (
                      data.context.characters.map((char, idx) => (
                          <div 
                              key={idx} 
                              onClick={() => handleSelectAsset(char)}
                              className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${selectedAsset?.id === char.id ? 'bg-pink-50 dark:bg-pink-900/20 border-l-2 border-pink-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                          >
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                  {char.name.substring(0,2)}
                              </div>
                              <div>
                                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{char.name}</div>
                                  <div className="text-[11px] text-gray-500 flex gap-2 flex-wrap">
                                      <span>{char.role}</span>
                                      {char.assetPriority && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">{char.assetPriority}</span>}
                                      {char.episodeUsage && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">{char.episodeUsage}</span>}
                                  </div>
                              </div>
                          </div>
                      ))
                  ) : <div className="p-4 text-gray-500 text-xs text-center">No characters found.</div>
              ) : (
                  data.context.locations.length > 0 ? (
                      data.context.locations.map((loc, idx) => (
                          <div 
                              key={idx} 
                              onClick={() => handleSelectAsset(loc)}
                              className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${selectedAsset?.id === loc.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                          >
                              <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <MapPin size={14}/>
                              </div>
                              <div>
                                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{loc.name}</div>
                                  <div className="text-[11px] text-gray-500 flex gap-2 flex-wrap">
                                      <span>{loc.type}</span>
                                      {loc.assetPriority && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">{loc.assetPriority}</span>}
                                      {loc.episodeUsage && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">{loc.episodeUsage}</span>}
                                  </div>
                              </div>
                          </div>
                      ))
                  ) : <div className="p-4 text-gray-500 text-xs text-center">No locations found.</div>
              )}
          </div>

          {/* Parameters, Asset Checklist & Base Prompt */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
              {/* Asset Checklist */}
              {selectedAsset && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">
                          <ListChecks size={14} /> 资产清单
                      </div>
                      {'bio' in selectedAsset
                        ? renderCharacterDetails(selectedAsset as Character)
                        : renderLocationDetails(selectedAsset as Location)}
                  </div>
              )}

              <div className="bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700/50">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <Sliders size={12}/> Generation Params
                  </h3>
                  <div className="space-y-3">
                      <div className="flex justify-between gap-2">
                           <div className="flex-1">
                               <label className="text-[10px] text-gray-500 uppercase block mb-1">Ratio</label>
                               <select 
                                  value={params.aspectRatio}
                                  onChange={(e) => setParams({...params, aspectRatio: e.target.value})}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white rounded px-2 py-1.5 focus:outline-none"
                               >
                                   <option>1:1</option>
                                   <option>16:9</option>
                                   <option>9:16</option>
                                   <option>4:3</option>
                                   <option>3:2</option>
                               </select>
                           </div>
                           <div className="flex-1">
                               <label className="text-[10px] text-gray-500 uppercase block mb-1">Count</label>
                               <select 
                                  value={params.count}
                                  onChange={(e) => setParams({...params, count: Number(e.target.value)})}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white rounded px-2 py-1.5 focus:outline-none"
                               >
                                   <option value={1}>1</option>
                                   <option value={2}>2</option>
                                   <option value={4}>4</option>
                               </select>
                           </div>
                      </div>
                      <div>
                           <label className="text-[10px] text-gray-500 uppercase block mb-1">Resolution</label>
                           <select 
                              value={params.resolution}
                              onChange={(e) => setParams({...params, resolution: e.target.value})}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs text-gray-900 dark:text-white rounded px-2 py-1.5 focus:outline-none"
                           >
                               <option value="1024x1024">Square (1K)</option>
                               <option value="1280x720">Landscape (720p)</option>
                               <option value="1920x1080">Landscape (1080p)</option>
                               <option value="720x1280">Portrait (720p)</option>
                           </select>
                      </div>
                  </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Base Context Prompt</h3>
                  <textarea 
                      value={basePrompt}
                      onChange={(e) => setBasePrompt(e.target.value)}
                      disabled={chatHistory.length > 0} // Disable while refining
                      className={`w-full flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 font-mono resize-none focus:outline-none focus:border-pink-500 ${chatHistory.length > 0 ? 'opacity-50' : ''}`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1 mb-2">
                      {chatHistory.length > 0 ? "Prompt locked during refinement. Reset to edit." : "This prompt is sent as context to the AI."}
                  </p>
                  
                  {/* Initial Generation Button */}
                  <button 
                      onClick={handleInitialGenerate}
                      disabled={isGenerating || !selectedAsset || chatHistory.length > 0}
                      className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-sm ${
                          chatHistory.length > 0
                          ? 'bg-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed border-2 border-dashed border-gray-300 dark:border-gray-700'
                          : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-500/20'
                      }`}
                  >
                      {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      Generate Initial Draft
                  </button>
              </div>
          </div>
      </div>

      {/* RIGHT COLUMN: INTERACTIVE STUDIO */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-950 relative">
          
          {/* Header */}
          <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between bg-white dark:bg-gray-900/50">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Palette size={16} className="text-pink-500"/> Concept Studio
                  {selectedAsset && <span className="text-gray-500 font-normal">/ {selectedAsset.name}</span>}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${config.multimodalConfig.apiKey ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {config.multimodalConfig.apiKey ? 'Connected' : 'No API Key'}
              </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
              {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 space-y-4 opacity-50">
                      <Paintbrush size={64} />
                      <p className="text-lg">Edit Base Prompt & Click Generate to Start.</p>
                  </div>
              ) : (
                  chatHistory.map((msg, idx) => (
                      msg.role !== 'system' && (msg.role !== 'user' || msg.content.startsWith("Refinement Instruction")) && ( 
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[90%] rounded-2xl px-5 py-4 shadow-sm ${
                                  msg.role === 'user' 
                                  ? 'bg-blue-600 text-white rounded-br-none' 
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none'
                              }`}>
                                  {msg.role === 'assistant' ? (
                                      <MarkdownRenderer content={msg.content} />
                                  ) : (
                                      <p className="whitespace-pre-wrap text-sm">{msg.content.replace("Refinement Instruction:", "").trim()}</p>
                                  )}
                              </div>
                          </div>
                      )
                  ))
              )}

              {isGenerating && (
                  <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-5 py-4 rounded-2xl rounded-bl-none flex items-center gap-3">
                          <Loader2 size={18} className="animate-spin text-pink-500" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">AI Artist is working...</span>
                      </div>
                  </div>
              )}
          </div>

          {/* Input Area (Refinement) */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                  {chatHistory.length > 0 && (
                     <button 
                        onClick={() => setChatHistory([])}
                        className="p-3 text-gray-500 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                        title="Clear History & Start Over"
                     >
                        <RotateCcw size={18} />
                     </button>
                  )}
                  <div className="flex-1 relative">
                      <input
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleRefineSend()}
                          placeholder={chatHistory.length === 0 ? "Generate initial draft first..." : "Refine result (e.g., 'Make the lighting darker', 'Change background to...')"}
                          disabled={isGenerating || !selectedAsset || chatHistory.length === 0}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-full pl-5 pr-12 py-3 focus:outline-none focus:border-pink-500 shadow-sm inner disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button 
                          onClick={handleRefineSend}
                          disabled={isGenerating || !selectedAsset || chatHistory.length === 0}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-pink-600 text-white rounded-full hover:bg-pink-500 disabled:opacity-50 disabled:hover:bg-pink-600 transition-all shadow-md shadow-pink-900/10"
                      >
                          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
