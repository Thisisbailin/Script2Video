
import React, { useRef, useState } from 'react';
import { ProjectData } from '../types';
import { FileText, Palette, Upload, FileSpreadsheet, CheckCircle, Image, Film, Sparkles, FileCode, BookOpen, Users, MapPin, ListChecks } from 'lucide-react';

interface Props {
  data: ProjectData;
  onAssetLoad: (type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots', content: string, fileName?: string) => void;
}

export const AssetsBoard: React.FC<Props> = ({ data, onAssetLoad }) => {
  // Input Refs
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);
  const dramaGuideInputRef = useRef<HTMLInputElement>(null);
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const [expandedCharacterForms, setExpandedCharacterForms] = useState<Record<string, boolean>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots') => {
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
    colorClass,
    badge,
  }: {
    title: string;
    desc: string;
    icon: any;
    isLoaded: boolean;
    fileName?: string;
    onUpload?: () => void;
    colorClass: string;
    badge?: 'required' | 'optional';
  }) => (
    <div
      className={`p-3 rounded-2xl border transition-all duration-300 ${
        isLoaded
          ? 'bg-[var(--bg-overlay)] border-[var(--border-subtle)] shadow-[var(--shadow-soft)]'
          : 'bg-[var(--bg-overlay)]/80 border-[var(--border-subtle)]/80 hover:border-[var(--accent-blue)]/70'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="p-2 rounded-xl bg-[var(--bg-muted)]/60">
          <Icon size={24} className={isLoaded ? colorClass : 'text-[var(--text-secondary)]'} />
        </div>
        {isLoaded && <CheckCircle size={20} className="text-green-500" />}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-5">{title}</h3>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase">
            {badge === 'required' ? 'Required' : 'Optional'}
          </span>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] mb-3 min-h-[24px] leading-5">
        {fileName ? `Current: ${fileName}` : desc}
      </p>

      {onUpload ? (
        <button
          onClick={onUpload}
          className={`w-full py-2 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-colors ${
            isLoaded
              ? 'bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[var(--text-primary)]'
              : 'bg-[var(--accent-blue)] hover:bg-sky-500 text-white'
          }`}
        >
          <Upload size={16} /> {isLoaded ? 'Replace File' : 'Upload File'}
        </button>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">Coming soon</div>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-8 pt-20 pb-12 bg-[var(--bg-panel)] text-[var(--text-primary)] transition-colors">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Core Assets */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              Core Documents
            </h3>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
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
              isLoaded={false}
              fileName={data.episodes.some(e => e.shots.length > 0) ? `${data.episodes.reduce((acc,e)=>acc+e.shots.length,0)} Shots Loaded` : undefined}
              onUpload={() => csvInputRef.current?.click()}
              colorClass="text-green-400"
            />
          </div>
        </section>

        {/* SOPs / Guides */}
        <section>
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            Standard Operating Procedures (AI Instructions)
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
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

            {/* Drama Guide */}
            <input type="file" ref={dramaGuideInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileChange(e, 'dramaGuide')} />
            <AssetCard
              title="Drama Writing Guide"
              desc="Amplify narrative tension and professionalism."
              icon={FileCode}
              isLoaded={!!data.dramaGuide}
              fileName={data.dramaGuide ? 'Drama Guide Loaded' : 'Default Guide Active'}
              onUpload={() => dramaGuideInputRef.current?.click()}
              colorClass="text-indigo-400"
            />
          </div>
        </section>

        {/* Understanding Snapshot */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              <BookOpen size={16} /> Understanding Snapshot
            </div>
            <div className="text-xs text-[var(--text-secondary)]">Phase 1 结果预览</div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <BookOpen size={16} /> 项目概览
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed min-h-[64px]">
                {data.context.projectSummary || '尚未生成项目概览'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Users size={16} /> 主要角色 / 资产优先级
              </div>
              {data.context.characters?.length ? (
                <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
                  {(showAllCharacters ? data.context.characters : data.context.characters.slice(0, 4)).map((c) => {
                    const formsExpanded = !!expandedCharacterForms[c.id];
                    const formsToShow = formsExpanded ? (c.forms || []) : (c.forms || []).slice(0, 2);
                    const remainingForms = (c.forms?.length || 0) - 2;
                    return (
                    <li key={c.id} className="space-y-1 rounded-xl border border-[var(--border-subtle)]/60 p-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[var(--text-primary)] font-semibold">{c.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">
                          {c.role}
                        </span>
                        {c.assetPriority && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {c.assetPriority}
                          </span>
                        )}
                        {c.episodeUsage && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {c.episodeUsage}
                          </span>
                        )}
                      </div>
                      {c.forms?.length ? (
                        <div className="text-[12px] leading-5 space-y-1">
                          {formsToShow.map((f, idx) => (
                            <div key={idx} className="flex gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--text-primary)]">{f.formName}</span>
                              {f.episodeRange && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{f.episodeRange}</span>}
                              {(f.identityOrState || f.visualTags) && (
                                <span className="text-[var(--text-secondary)]">{f.identityOrState || f.visualTags}</span>
                              )}
                            </div>
                          ))}
                          {c.forms.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCharacterForms(prev => ({
                                  ...prev,
                                  [c.id]: !prev[c.id]
                                }))
                              }
                              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              {formsExpanded ? '收起形态' : `+ ${remainingForms} 更多形态`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[var(--text-secondary)]">尚无形态解析</div>
                      )}
                    </li>
                    );
                  })}
                  {data.context.characters.length > 4 && (
                    <li className="text-[11px]">
                      <button
                        type="button"
                        onClick={() => setShowAllCharacters((prev) => !prev)}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {showAllCharacters
                          ? '收起角色列表'
                          : `+ ${data.context.characters.length - 4} 更多角色`}
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">尚未识别角色</p>
              )}
            </div>
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <MapPin size={16} /> 场景 / 资产优先级
              </div>
              {data.context.locations?.length ? (
                <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
                  {data.context.locations.slice(0, 4).map((l) => (
                    <li key={l.id} className="space-y-1 rounded-xl border border-[var(--border-subtle)]/60 p-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[var(--text-primary)] font-semibold">{l.name}</span>
                        {l.assetPriority && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">
                            {l.assetPriority}
                          </span>
                        )}
                        {l.episodeUsage && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {l.episodeUsage}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{l.description}</div>
                      {l.zones?.length ? (
                        <div className="text-[12px] leading-5 space-y-1">
                          {l.zones.slice(0, 2).map((z, idx) => (
                            <div key={idx} className="flex gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--text-primary)]">{z.name}</span>
                              {z.kind && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{z.kind}</span>}
                              {z.episodeRange && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{z.episodeRange}</span>}
                              {(z.layoutNotes || z.keyProps) && (
                                <span className="text-[var(--text-secondary)]">{z.layoutNotes || z.keyProps}</span>
                              )}
                            </div>
                          ))}
                          {l.zones.length > 2 && (
                            <div className="text-[11px] text-[var(--text-secondary)]">+ {l.zones.length - 2} 更多分区</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[var(--text-secondary)]">暂无分区解析</div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">尚未识别场景</p>
              )}
            </div>
            <div className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <ListChecks size={16} /> 集梗概（横向滚动，避免超长）
              </div>
              {data.context.episodeSummaries?.length ? (
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {data.context.episodeSummaries.map((s, idx) => (
                    <div
                      key={idx}
                      className="min-w-[220px] max-w-[260px] snap-start border border-[var(--border-subtle)] rounded-xl p-3 bg-[var(--bg-panel)]/70 shadow-[var(--shadow-soft)] text-sm text-[var(--text-secondary)] flex flex-col gap-2"
                    >
                      <div className="text-[var(--text-primary)] font-semibold">Ep {s.episodeId}</div>
                      <div className="text-xs leading-5 max-h-40 overflow-y-auto pr-1">
                        {s.summary}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">尚未生成集梗概</p>
              )}
            </div>
          </div>
        </section>

        {/* Generated Libraries Placeholder */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              Generated Libraries (Placeholder)
            </h3>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
              <Sparkles size={14} /> Coming soon
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssetCard
              title="Image Library"
              desc="Generated stills, references and concept frames."
              icon={Image}
              isLoaded={false}
              fileName="0 items · auto-saved"
              colorClass="text-blue-300"
            />
            <AssetCard
              title="Video Library"
              desc="Project videos and previews from generation."
              icon={Film}
              isLoaded={false}
              fileName="0 items · auto-saved"
              colorClass="text-green-300"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
