import React, { useState } from 'react';
import { ProjectData } from '../types';
import { User, BookOpen, Film, Clock, FileText, Palette, MapPin, Layers } from 'lucide-react';

interface Props {
  data: ProjectData;
  onSelectEpisode: (index: number) => void;
}

export const ContentBoard: React.FC<Props> = ({ data, onSelectEpisode }) => {
  const { context, episodes } = data;

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-900 space-y-8">
      
      {/* 1. Project Summary Section */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <BookOpen className="text-blue-500" size={24}/>
           Project Overview
        </h2>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            {context.projectSummary ? (
               <div className="space-y-6 relative z-10">
                   <div>
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Global Story Arc</h3>
                        <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {context.projectSummary}
                        </p>
                   </div>
                   {/* Episode Breakdown removed from here to avoid duplication. It is now shown in Section 5. */}
               </div>
            ) : (
               <div className="text-gray-500 italic flex items-center gap-2">
                 <Clock size={16} /> Analysis pending...
               </div>
            )}
        </div>
      </section>

      {/* 2. Visual Style Bible Section */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <Palette className="text-pink-500" size={24}/>
           Visual Style Bible
        </h2>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
            {data.globalStyleGuide ? (
               <div className="relative">
                 <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-pink-400 border border-pink-900 bg-pink-900/20 px-2 py-1 rounded">User Uploaded</span>
                 </div>
                 <pre className="text-gray-300 font-sans leading-relaxed text-sm whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                   {data.globalStyleGuide}
                 </pre>
               </div>
            ) : (
               <div className="h-24 border border-gray-700 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 gap-2">
                 <Palette size={20} className="opacity-50"/>
                 <span className="italic">No specific visual style guide uploaded.</span>
                 <span className="text-xs">AI will infer style from context and standard guidelines.</span>
               </div>
            )}
        </div>
      </section>

      {/* 3. Character Cards Section */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <User className="text-purple-500" size={24}/>
           Character Profiles
        </h2>
        
        {context.characters && context.characters.length > 0 ? (
           <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
             {context.characters.map((char, idx) => (
               <CharacterCard key={idx} char={char} />
             ))}
           </div>
        ) : (
           <div className="h-32 bg-gray-800/30 rounded-xl border border-gray-700 border-dashed flex items-center justify-center text-gray-500 italic">
              No character data extracted yet.
           </div>
        )}
      </section>

      {/* 4. Location Section (NEW) */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <MapPin className="text-orange-500" size={24}/>
           Key Locations
        </h2>
        {context.locations && context.locations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {context.locations.map((loc, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border ${loc.type === 'core' ? 'bg-gray-800 border-orange-900/50 shadow-lg' : 'bg-gray-800/50 border-gray-800'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-white">{loc.name}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase ${loc.type === 'core' ? 'bg-orange-900/30 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>
                                {loc.type}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{loc.description}</p>
                        {loc.visuals && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Visual Atmosphere</span>
                                <p className="text-xs text-orange-200/80 leading-relaxed">{loc.visuals}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        ) : (
             <div className="h-32 bg-gray-800/30 rounded-xl border border-gray-700 border-dashed flex items-center justify-center text-gray-500 italic">
              No location data extracted yet.
           </div>
        )}
      </section>

      {/* 5. Episode List Section */}
      <section>
         <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
           <Film className="text-green-500" size={24}/>
           Episode Outline
        </h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
            {episodes.length > 0 ? (
               <div className="divide-y divide-gray-700">
                  {episodes.map((ep, idx) => (
                    <div key={ep.id} className="p-4 hover:bg-gray-700/50 transition-colors group">
                       <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">
                             {ep.title}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                             ep.status === 'completed' ? 'bg-green-900/30 text-green-400 border-green-800' : 
                             ep.summary ? 'bg-blue-900/30 text-blue-400 border-blue-800' :
                             'bg-gray-700 text-gray-400 border-gray-600'
                          }`}>
                             {ep.status === 'completed' ? 'Done' : ep.summary ? 'Processed' : 'Pending'}
                          </span>
                       </div>
                       
                       {ep.summary ? (
                         <p className="text-sm text-gray-300 leading-relaxed pl-4 border-l-2 border-green-500/50">
                           {ep.summary}
                         </p>
                       ) : (
                         <div className="flex items-center gap-2 text-sm text-gray-500 italic pl-4 border-l-2 border-gray-700">
                            <FileText size={14} />
                            <span>Summary will be generated during Phase 1 analysis.</span>
                         </div>
                       )}
                       
                       <div className="mt-2 pl-4">
                          <button 
                            onClick={() => onSelectEpisode(idx)}
                            className="text-xs text-blue-500 hover:text-blue-400 underline decoration-blue-500/30"
                          >
                             View Script & Shots
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
               <div className="p-8 text-center text-gray-500 italic">
                  Upload a script to see episodes breakdown.
               </div>
            )}
        </div>
      </section>
    </div>
  );
};

// Helper Component for Character Card to handle tabs for "Forms"
const CharacterCard = ({ char }: { char: any }) => {
    const [activeFormIndex, setActiveFormIndex] = useState(0);
    const hasForms = char.forms && char.forms.length > 0;
    const currentForm = hasForms ? char.forms[activeFormIndex] : null;

    return (
        <div className="snap-start min-w-[320px] w-[320px] bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col hover:border-purple-500/50 transition-colors">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-white">{char.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full border ${char.isMain ? 'bg-purple-900/40 text-purple-300 border-purple-800/50' : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                        {char.role}
                    </span>
                </div>
                {hasForms && char.forms.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                        {char.forms.map((form: any, idx: number) => (
                            <button 
                                key={idx}
                                onClick={() => setActiveFormIndex(idx)}
                                className={`text-[10px] whitespace-nowrap px-2 py-1 rounded transition-colors ${
                                    activeFormIndex === idx 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                            >
                                {form.formName}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-3">
                {currentForm ? (
                    <>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">State: {currentForm.formName}</span>
                                <span className="text-[10px] text-gray-600 font-mono">{currentForm.episodeRange}</span>
                            </div>
                            <p className="text-sm text-gray-300 h-20 overflow-y-auto custom-scrollbar">{currentForm.description}</p>
                        </div>
                        <div className="mt-auto">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Visual Tags</span>
                            <div className="flex flex-wrap gap-1">
                                {currentForm.visualTags.split(/[,，]/).map((tag: string, i: number) => (
                                    <span key={i} className="text-xs text-blue-300 bg-blue-900/20 px-1.5 py-0.5 rounded">
                                        {tag.trim()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div>
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Biography</span>
                         <p className="text-sm text-gray-300">{char.bio}</p>
                    </div>
                )}
            </div>
        </div>
    );
};