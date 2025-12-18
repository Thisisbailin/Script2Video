
import React, { useRef } from 'react';
import { ProjectData } from '../types';
import { FileText, Palette, Upload, FileSpreadsheet, CheckCircle, AlertCircle, FolderOpen, FileCode } from 'lucide-react';

interface Props {
  data: ProjectData;
  onAssetLoad: (type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'csvShots', content: string, fileName?: string) => void;
}

export const AssetsBoard: React.FC<Props> = ({ data, onAssetLoad }) => {
  // Input Refs
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'csvShots') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      onAssetLoad(type, text, file.name);
      // Reset value to allow re-uploading same file if needed
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const AssetCard = ({ 
      title, 
      desc, 
      icon: Icon, 
      isLoaded, 
      fileName, 
      onUpload,
      colorClass
  }: { 
      title: string; 
      desc: string; 
      icon: any; 
      isLoaded: boolean; 
      fileName?: string;
      onUpload: () => void;
      colorClass: string;
  }) => (
      <div
        className={`p-6 rounded-xl border transition-all duration-300 shadow-sm ${
          isLoaded
            ? 'bg-[var(--bg-panel)] border-[var(--border-subtle)] shadow-[var(--shadow-soft)]'
            : 'bg-[var(--bg-panel)]/80 border-[var(--border-subtle)] border-dashed hover:border-[var(--accent-blue)]/60'
        }`}
      >
          <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${isLoaded ? 'bg-white/5' : 'bg-white/5'}`}>
                  <Icon size={24} className={isLoaded ? colorClass : 'text-[var(--text-secondary)]'} />
              </div>
              {isLoaded && <CheckCircle size={20} className="text-green-500" />}
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{title}</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-6 h-8">{fileName ? `Current: ${fileName}` : desc}</p>
          
          <button 
              onClick={onUpload}
              className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  isLoaded 
                  ? 'bg-[#1a1a1d] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[var(--text-primary)]' 
                  : 'bg-[var(--accent-blue)] hover:bg-sky-500 text-white'
              }`}
          >
              <Upload size={16} /> {isLoaded ? 'Replace File' : 'Upload File'}
          </button>
      </div>
  );

  return (
    <div className="h-full overflow-y-auto px-8 pt-20 pb-12 bg-[var(--bg-panel)] text-[var(--text-primary)] transition-colors">
        <div className="max-w-6xl mx-auto space-y-10">
            
            {/* Core Assets */}
            <section>
                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                    Core Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Script */}
                    <input type="file" ref={scriptInputRef} className="hidden" accept=".txt" onChange={(e) => handleFileChange(e, 'script')} />
                    <AssetCard 
                        title="Screenplay (TXT)"
                        desc="The raw script text file (formatted with scenes)."
                        icon={FileText}
                        isLoaded={!!data.rawScript}
                        fileName={data.fileName}
                        onUpload={() => scriptInputRef.current?.click()}
                        colorClass="text-blue-400"
                    />

                    {/* Style Guide */}
                    <input type="file" ref={globalStyleInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileChange(e, 'globalStyleGuide')} />
                    <AssetCard 
                        title="Visual Style Bible (Optional)"
                        desc="Project-wide visual direction and tone. Optional to upload."
                        icon={Palette}
                        isLoaded={!!data.globalStyleGuide}
                        fileName={data.globalStyleGuide ? 'Style Guide Loaded' : undefined}
                        onUpload={() => globalStyleInputRef.current?.click()}
                        colorClass="text-purple-400"
                    />

                    {/* CSV Import */}
                    <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'csvShots')} />
                    <AssetCard 
                        title="Import CSV Shots (Optional)"
                        desc="Restore shot lists from a previous export. Optional."
                        icon={FileSpreadsheet}
                        isLoaded={false} // CSV import is an action, not a state usually, or check episodes
                        fileName={data.episodes.some(e => e.shots.length > 0) ? `${data.episodes.reduce((acc,e)=>acc+e.shots.length,0)} Shots Loaded` : undefined}
                        onUpload={() => csvInputRef.current?.click()}
                        colorClass="text-green-400"
                    />
                </div>
            </section>

            {/* SOPs / Guides */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    Standard Operating Procedures (AI Instructions)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Shot Guide */}
                    <input type="file" ref={shotGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileChange(e, 'shotGuide')} />
                    <AssetCard 
                        title="Shot Generation Guide"
                        desc="Rules for converting text to shots."
                        icon={FileCode}
                        isLoaded={!!data.shotGuide}
                        fileName={data.shotGuide ? 'Custom Guide Loaded' : 'Default Guide Active'}
                        onUpload={() => shotGuideInputRef.current?.click()}
                        colorClass="text-yellow-400"
                    />

                    {/* Sora Guide */}
                    <input type="file" ref={soraGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileChange(e, 'soraGuide')} />
                    <AssetCard 
                        title="Sora Prompt Guide"
                        desc="Rules for writing video prompts."
                        icon={FileCode}
                        isLoaded={!!data.soraGuide}
                        fileName={data.soraGuide ? 'Custom Guide Loaded' : 'Default Guide Active'}
                        onUpload={() => soraGuideInputRef.current?.click()}
                        colorClass="text-pink-400"
                    />
                </div>
            </section>
        </div>
    </div>
  );
};
