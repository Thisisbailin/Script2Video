
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
      <div className={`p-6 rounded-xl border transition-all duration-300 shadow-sm ${isLoaded ? 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-md' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 border-dashed hover:border-gray-300 dark:hover:border-gray-600'}`}>
          <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${isLoaded ? colorClass.replace('text-', 'bg-').replace('400', '100 dark:bg-') + (colorClass.includes('400') ? '/30' : '') : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Icon size={24} className={isLoaded ? colorClass.replace('400', '600 dark:text-') + (colorClass.includes('400') ? '400' : '') : 'text-gray-400 dark:text-gray-500'} />
              </div>
              {isLoaded && <CheckCircle size={20} className="text-green-500" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-200 mb-1">{title}</h3>
          <p className="text-xs text-gray-500 mb-6 h-8">{fileName ? `Current: ${fileName}` : desc}</p>
          
          <button 
              onClick={onUpload}
              className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  isLoaded 
                  ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
          >
              <Upload size={16} /> {isLoaded ? 'Replace File' : 'Upload File'}
          </button>
      </div>
  );

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-gray-950 transition-colors">
        <div className="max-w-6xl mx-auto space-y-10">
            
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
                    <FolderOpen size={28} className="text-blue-500" /> Project Assets
                </h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your screenplay, style guides, and operational documents here.</p>
            </div>

            {/* Core Assets */}
            <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
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
                        title="Visual Style Bible"
                        desc="Project-wide visual direction and tone."
                        icon={Palette}
                        isLoaded={!!data.globalStyleGuide}
                        fileName={data.globalStyleGuide ? 'Style Guide Loaded' : undefined}
                        onUpload={() => globalStyleInputRef.current?.click()}
                        colorClass="text-purple-400"
                    />

                    {/* CSV Import */}
                    <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'csvShots')} />
                    <AssetCard 
                        title="Import CSV Shots"
                        desc="Restore shot lists from a previous export."
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
