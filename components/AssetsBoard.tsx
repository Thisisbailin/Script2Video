
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DesignAssetItem, ProjectData } from '../types';
import { createStableId } from '../utils/id';
import { FileText, Palette, Upload, FileSpreadsheet, CheckCircle, Image, Film, Sparkles, FileCode, BookOpen, Users, MapPin, ListChecks, Trash2, X } from 'lucide-react';
import { useWorkflowStore, GlobalAssetHistoryItem } from '../node-workspace/store/workflowStore';

interface Props {
  data: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  onAssetLoad: (
    type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots' | 'understandingJson',
    content: string,
    fileName?: string
  ) => void;
}

export const AssetsBoard: React.FC<Props> = ({ data, setProjectData, onAssetLoad }) => {
  // Input Refs
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const understandingInputRef = useRef<HTMLInputElement>(null);
  const globalStyleInputRef = useRef<HTMLInputElement>(null);
  const shotGuideInputRef = useRef<HTMLInputElement>(null);
  const soraGuideInputRef = useRef<HTMLInputElement>(null);
  const dramaGuideInputRef = useRef<HTMLInputElement>(null);
  const designUploadInputRef = useRef<HTMLInputElement>(null);
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const [expandedCharacterForms, setExpandedCharacterForms] = useState<Record<string, boolean>>({});
  const [designUploadTarget, setDesignUploadTarget] = useState<{
    refId: string;
    category: 'form' | 'zone';
    label: string;
  } | null>(null);
  const { globalAssetHistory, removeGlobalHistoryItem, clearGlobalHistory } = useWorkflowStore();
  const imageAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === 'image'),
    [globalAssetHistory]
  );
  const videoAssets = useMemo(
    () => globalAssetHistory.filter((item) => item.type === 'video'),
    [globalAssetHistory]
  );
  const designAssets = data.designAssets || [];
  const designAssetMap = useMemo(() => {
    const map = new Map<string, DesignAssetItem[]>();
    designAssets.forEach((asset) => {
      const key = `${asset.category}|${asset.refId}`;
      const list = map.get(key) || [];
      list.push(asset);
      map.set(key, list);
    });
    return map;
  }, [designAssets]);
  const updateCharacters = (updater: (items: ProjectData["context"]["characters"]) => ProjectData["context"]["characters"]) => {
    setProjectData((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        characters: updater(prev.context.characters || []),
      },
    }));
  };
  const updateLocations = (updater: (items: ProjectData["context"]["locations"]) => ProjectData["context"]["locations"]) => {
    setProjectData((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        locations: updater(prev.context.locations || []),
      },
    }));
  };
  const moveItem = <T,>(items: T[], from: number, to: number) => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  const addCharacter = () => {
    const id = `char-${Date.now()}`;
    updateCharacters((items) => [
      ...items,
      {
        id,
        name: "新角色",
        role: "",
        isMain: false,
        bio: "",
        forms: [],
      },
    ]);
  };
  const addLocation = () => {
    const id = `loc-${Date.now()}`;
    updateLocations((items) => [
      ...items,
      {
        id,
        name: "新场景",
        type: "core",
        description: "",
        visuals: "",
        zones: [],
      },
    ]);
  };
  const updateCharacterName = (charIdx: number, name: string) => {
    setProjectData((prev) => {
      const characters = [...(prev.context.characters || [])];
      const current = characters[charIdx];
      if (!current) return prev;
      const updated = { ...current, name };
      characters[charIdx] = updated;
      const formNameById = new Map(
        (updated.forms || []).map((form) => [form.id, form.formName])
      );
      const prefix = `${current.id}|`;
      const designAssets = prev.designAssets.map((asset) => {
        if (asset.category !== "form" || !asset.refId.startsWith(prefix)) return asset;
        const formId = asset.refId.slice(prefix.length);
        const formName = formNameById.get(formId);
        if (!formName) return asset;
        return { ...asset, label: `${name} · ${formName}` };
      });
      return {
        ...prev,
        context: { ...prev.context, characters },
        designAssets,
      };
    });
  };
  const updateLocationName = (locIdx: number, name: string) => {
    setProjectData((prev) => {
      const locations = [...(prev.context.locations || [])];
      const current = locations[locIdx];
      if (!current) return prev;
      const updated = { ...current, name };
      locations[locIdx] = updated;
      const zoneNameById = new Map(
        (updated.zones || []).map((zone) => [zone.id, zone.name])
      );
      const prefix = `${current.id}|`;
      const designAssets = prev.designAssets.map((asset) => {
        if (asset.category !== "zone" || !asset.refId.startsWith(prefix)) return asset;
        const zoneId = asset.refId.slice(prefix.length);
        const zoneName = zoneNameById.get(zoneId);
        if (!zoneName) return asset;
        return { ...asset, label: `${name} · ${zoneName}` };
      });
      return {
        ...prev,
        context: { ...prev.context, locations },
        designAssets,
      };
    });
  };
  const updateCharacterFormName = (charIdx: number, formIdx: number, formName: string) => {
    setProjectData((prev) => {
      const characters = [...(prev.context.characters || [])];
      const current = characters[charIdx];
      if (!current) return prev;
      const forms = [...(current.forms || [])];
      const currentForm = forms[formIdx];
      const refId = currentForm ? `${current.id}|${currentForm.id}` : "";
      forms[formIdx] = { ...currentForm, formName };
      characters[charIdx] = { ...current, forms };
      const designAssets = prev.designAssets.map((asset) => {
        if (asset.category !== "form" || !refId || asset.refId !== refId) return asset;
        return { ...asset, label: `${current.name} · ${formName}` };
      });
      return {
        ...prev,
        context: { ...prev.context, characters },
        designAssets,
      };
    });
  };
  const updateLocationZoneName = (locIdx: number, zoneIdx: number, zoneName: string) => {
    setProjectData((prev) => {
      const locations = [...(prev.context.locations || [])];
      const current = locations[locIdx];
      if (!current) return prev;
      const zones = [...(current.zones || [])];
      const currentZone = zones[zoneIdx];
      const refId = currentZone ? `${current.id}|${currentZone.id}` : "";
      zones[zoneIdx] = { ...currentZone, name: zoneName };
      locations[locIdx] = { ...current, zones };
      const designAssets = prev.designAssets.map((asset) => {
        if (asset.category !== "zone" || !refId || asset.refId !== refId) return asset;
        return { ...asset, label: `${current.name} · ${zoneName}` };
      });
      return {
        ...prev,
        context: { ...prev.context, locations },
        designAssets,
      };
    });
  };
  const removeCharacter = (charIdx: number) => {
    setProjectData((prev) => {
      const characters = [...(prev.context.characters || [])];
      const target = characters[charIdx];
      const nextCharacters = characters.filter((_, idx) => idx !== charIdx);
      let designAssets = prev.designAssets;
      if (target) {
        const prefix = `${target.id}|`;
        designAssets = designAssets.filter(
          (asset) => !(asset.category === "form" && asset.refId.startsWith(prefix))
        );
      }
      return {
        ...prev,
        context: { ...prev.context, characters: nextCharacters },
        designAssets,
      };
    });
  };
  const removeLocation = (locIdx: number) => {
    setProjectData((prev) => {
      const locations = [...(prev.context.locations || [])];
      const target = locations[locIdx];
      const nextLocations = locations.filter((_, idx) => idx !== locIdx);
      let designAssets = prev.designAssets;
      if (target) {
        const prefix = `${target.id}|`;
        designAssets = designAssets.filter(
          (asset) => !(asset.category === "zone" && asset.refId.startsWith(prefix))
        );
      }
      return {
        ...prev,
        context: { ...prev.context, locations: nextLocations },
        designAssets,
      };
    });
  };
  const removeCharacterForm = (charIdx: number, formIdx: number) => {
    setProjectData((prev) => {
      const characters = [...(prev.context.characters || [])];
      const current = characters[charIdx];
      if (!current) return prev;
      const forms = [...(current.forms || [])];
      const targetForm = forms[formIdx];
      const nextForms = forms.filter((_, idx) => idx !== formIdx);
      characters[charIdx] = { ...current, forms: nextForms };
      let designAssets = prev.designAssets;
      if (targetForm) {
        const refId = `${current.id}|${targetForm.id}`;
        designAssets = designAssets.filter(
          (asset) => !(asset.category === "form" && asset.refId === refId)
        );
      }
      return {
        ...prev,
        context: { ...prev.context, characters },
        designAssets,
      };
    });
  };
  const removeLocationZone = (locIdx: number, zoneIdx: number) => {
    setProjectData((prev) => {
      const locations = [...(prev.context.locations || [])];
      const current = locations[locIdx];
      if (!current) return prev;
      const zones = [...(current.zones || [])];
      const targetZone = zones[zoneIdx];
      const nextZones = zones.filter((_, idx) => idx !== zoneIdx);
      locations[locIdx] = { ...current, zones: nextZones };
      let designAssets = prev.designAssets;
      if (targetZone) {
        const refId = `${current.id}|${targetZone.id}`;
        designAssets = designAssets.filter(
          (asset) => !(asset.category === "zone" && asset.refId === refId)
        );
      }
      return {
        ...prev,
        context: { ...prev.context, locations },
        designAssets,
      };
    });
  };
  const hasUnderstandingData = Boolean(
    data.context.projectSummary ||
      data.context.episodeSummaries.length > 0 ||
      data.context.characters?.length > 0 ||
      data.context.locations?.length > 0
  );

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots' | 'understandingJson'
  ) => {
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

  const createDesignAssetId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });

  const handleDesignUploadClick = (target: { refId: string; category: 'form' | 'zone'; label: string }) => {
    setDesignUploadTarget(target);
    designUploadInputRef.current?.click();
  };

  const handleDesignFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = designUploadTarget;
    const files = Array.from(e.target.files || []);
    if (!target || files.length === 0) return;
    try {
      const urls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
      const createdAt = Date.now();
      const newAssets: DesignAssetItem[] = urls.map((url) => ({
        id: createDesignAssetId(),
        category: target.category,
        refId: target.refId,
        url,
        createdAt,
        label: target.label,
      }));
      setProjectData((prev) => ({
        ...prev,
        designAssets: [...prev.designAssets, ...newAssets],
      }));
    } catch (err) {
      alert((err as Error).message || '设定图上传失败');
    } finally {
      e.target.value = '';
      setDesignUploadTarget(null);
    }
  };

  const removeDesignAsset = (id: string) => {
    setProjectData((prev) => ({
      ...prev,
      designAssets: prev.designAssets.filter((asset) => asset.id !== id),
    }));
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

  const GeneratedLibraryCard = ({
    title,
    desc,
    icon: Icon,
    items,
    toneClass,
    type,
  }: {
    title: string;
    desc: string;
    icon: any;
    items: GlobalAssetHistoryItem[];
    toneClass: string;
    type: 'image' | 'video';
  }) => (
    <div className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/90 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[var(--bg-muted)]/60">
            <Icon size={22} className={toneClass} />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{title}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {items.length ? `${items.length} items · linked to history` : desc}
            </div>
          </div>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => clearGlobalHistory(type)}
            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition"
            title="Clear library"
          >
            <Trash2 size={14} className="mx-auto" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/50 p-3 text-xs text-[var(--text-secondary)]">
          No generated {type === 'image' ? 'images' : 'videos'} yet.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black/30"
              >
                {item.type === 'image' ? (
                  <img src={item.src} alt={item.prompt} className="h-full w-full object-cover" />
                ) : (
                  <video className="h-full w-full object-cover" muted preload="metadata" playsInline>
                    <source src={item.src} />
                  </video>
                )}
                <button
                  type="button"
                  onClick={() => removeGlobalHistoryItem(item.id)}
                  className="absolute right-1 top-1 h-6 w-6 rounded-full border border-white/20 bg-black/50 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
                  title="Remove"
                >
                  <X size={12} className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
          {items.length > 4 && (
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
              + {items.length - 4} more assets
            </div>
          )}
        </>
      )}
    </div>
  );

  const DesignAssetStrip = ({
    assets,
    onUpload,
    onRemove,
  }: {
    assets: DesignAssetItem[];
    onUpload: () => void;
    onRemove: (id: string) => void;
  }) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {assets.length === 0 && (
        <span className="text-[10px] text-[var(--text-secondary)]">暂无设定图</span>
      )}
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group relative h-16 w-20 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/30"
        >
          <img src={asset.url} alt={asset.label || 'design'} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(asset.id)}
            className="absolute right-1 top-1 h-5 w-5 rounded-full border border-white/20 bg-black/50 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
            title="Remove"
          >
            <X size={10} className="mx-auto" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onUpload}
        className="h-16 min-w-[100px] rounded-lg border border-dashed border-[var(--border-subtle)]/70 px-3 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/70 hover:text-[var(--text-primary)] transition"
      >
        上传设定图
      </button>
    </div>
  );

  const EditableText = ({
    value,
    onChange,
    placeholder,
    displayClassName,
    inputClassName,
  }: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    displayClassName?: string;
    inputClassName?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const isEmpty = !value || value.trim().length === 0;
    const displayValue = isEmpty ? (placeholder || "单击编辑") : value;

    useEffect(() => {
      if (editing) inputRef.current?.focus();
    }, [editing]);

    if (!editing) {
      return (
        <div
          className={`${displayClassName || ""} ${isEmpty ? "text-[var(--text-secondary)] italic" : ""} cursor-text`}
          onClick={() => setEditing(true)}
          role="textbox"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
        >
          {displayValue}
        </div>
      );
    }

    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setEditing(false);
          if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={inputClassName || ""}
      />
    );
  };

  const EditableTextarea = ({
    value,
    onChange,
    placeholder,
    displayClassName,
    textareaClassName,
  }: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    displayClassName?: string;
    textareaClassName?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isEmpty = !value || value.trim().length === 0;
    const displayValue = isEmpty ? (placeholder || "单击编辑") : value;

    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    useLayoutEffect(() => {
      if (editing) resize();
    }, [editing, value]);

    useEffect(() => {
      if (editing) textareaRef.current?.focus();
    }, [editing]);

    if (!editing) {
      return (
        <div
          className={`${displayClassName || ""} ${isEmpty ? "text-[var(--text-secondary)] italic" : ""} cursor-text whitespace-pre-wrap`}
          onClick={() => setEditing(true)}
          role="textbox"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
        >
          {displayValue}
        </div>
      );
    }

    return (
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        onChange={(e) => {
          onChange(e.target.value);
          window.requestAnimationFrame(resize);
        }}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        className={textareaClassName || ""}
      />
    );
  };

  const EditableSelect = ({
    value,
    onChange,
    options,
    displayClassName,
    selectClassName,
  }: {
    value: string;
    onChange: (next: string) => void;
    options: Array<{ value: string; label: string }>;
    displayClassName?: string;
    selectClassName?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const selectRef = useRef<HTMLSelectElement>(null);
    const selected = options.find((opt) => opt.value === value)?.label || value;

    useEffect(() => {
      if (editing) selectRef.current?.focus();
    }, [editing]);

    if (!editing) {
      return (
        <div
          className={`${displayClassName || ""} cursor-pointer`}
          onClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
        >
          {selected || "单击编辑"}
        </div>
      );
    }

    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className={selectClassName || ""}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const fieldLabelClass = "text-[10px] uppercase tracking-wider text-[var(--text-secondary)]";
  const fieldDisplayClass =
    "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 px-3 py-2 text-sm text-[var(--text-primary)]";
  const fieldInputClass =
    "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]";
  const fieldDisplaySmClass =
    "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 px-3 py-2 text-xs text-[var(--text-primary)]";
  const fieldInputSmClass =
    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)]";

  return (
    <div className="h-full overflow-y-auto px-8 pt-20 pb-12 bg-transparent text-[var(--text-primary)] transition-colors">
      <div className="max-w-6xl mx-auto space-y-12">
        <input
          ref={designUploadInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleDesignFileChange}
        />
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

            {/* Understanding JSON Import */}
            <input type="file" ref={understandingInputRef} className="hidden" accept=".json" onChange={(e) => handleFileChange(e, 'understandingJson')} />
            <AssetCard
              title="Import Understanding JSON (Optional)"
              desc="Restore Phase 1 understanding results from a JSON export."
              icon={BookOpen}
              isLoaded={hasUnderstandingData}
              fileName={hasUnderstandingData ? 'Understanding Loaded' : undefined}
              onUpload={() => understandingInputRef.current?.click()}
              colorClass="text-amber-400"
            />
          </div>
        </section>

        {/* SOPs / Guides */}
        <section>
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            Standard Operating Procedures (AI Instructions)
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {/* Style Guide */}
            <input type="file" ref={globalStyleInputRef} className="hidden" accept=".md,.txt" onChange={(e) => handleFileChange(e, 'globalStyleGuide')} />
            <AssetCard
              title="Style Guide (Optional)"
              desc="Project-wide style direction and tone. Optional to upload."
              icon={Palette}
              isLoaded={!!data.globalStyleGuide}
              fileName={data.globalStyleGuide ? 'Style Guide Loaded' : undefined}
              onUpload={() => globalStyleInputRef.current?.click()}
              colorClass="text-purple-400"
            />

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
                          {formsToShow.map((f, idx) => {
                            const formRefId = `${c.id}|${f.id}`;
                            const assets = designAssetMap.get(`form|${formRefId}`) || [];
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex gap-2 flex-wrap">
                                  <span className="font-semibold text-[var(--text-primary)]">{f.formName}</span>
                                  {f.episodeRange && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{f.episodeRange}</span>}
                                  {(f.identityOrState || f.visualTags) && (
                                    <span className="text-[var(--text-secondary)]">{f.identityOrState || f.visualTags}</span>
                                  )}
                                </div>
                                <DesignAssetStrip
                                  assets={assets}
                                  onUpload={() =>
                                    handleDesignUploadClick({
                                      refId: formRefId,
                                      category: 'form',
                                      label: `${c.name} · ${f.formName}`,
                                    })
                                  }
                                  onRemove={removeDesignAsset}
                                />
                              </div>
                            );
                          })}
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
                          {l.zones.slice(0, 2).map((z, idx) => {
                            const zoneRefId = `${l.id}|${z.id}`;
                            const assets = designAssetMap.get(`zone|${zoneRefId}`) || [];
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex gap-2 flex-wrap">
                                  <span className="font-semibold text-[var(--text-primary)]">{z.name}</span>
                                  {z.kind && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{z.kind}</span>}
                                  {z.episodeRange && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">{z.episodeRange}</span>}
                                  {(z.layoutNotes || z.keyProps) && (
                                    <span className="text-[var(--text-secondary)]">{z.layoutNotes || z.keyProps}</span>
                                  )}
                                </div>
                                <DesignAssetStrip
                                  assets={assets}
                                  onUpload={() =>
                                    handleDesignUploadClick({
                                      refId: zoneRefId,
                                      category: 'zone',
                                      label: `${l.name} · ${z.name}`,
                                    })
                                  }
                                  onRemove={removeDesignAsset}
                                />
                              </div>
                            );
                          })}
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
          </div>
        </section>

        {/* Asset Editor */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Character & Scene Assets
            </div>
            <div className="text-xs text-[var(--text-secondary)]">单击内容即可编辑 · 文本自适应</div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/90 shadow-[var(--shadow-soft)] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users size={16} /> 角色资产编辑
                </div>
                <button
                  type="button"
                  onClick={addCharacter}
                  className="px-3 py-1.5 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition"
                >
                  + 新角色
                </button>
              </div>
              {data.context.characters?.length ? (
                <div className="space-y-4">
                  {data.context.characters.map((char, charIdx) => (
                    <div
                      key={char.id}
                      className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/75 p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>角色名</div>
                              <EditableText
                                value={char.name}
                                onChange={(val) => updateCharacterName(charIdx, val)}
                                placeholder="角色名"
                                displayClassName={`${fieldDisplayClass} font-semibold`}
                                inputClassName={`${fieldInputClass} font-semibold`}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>角色定位</div>
                              <EditableText
                                value={char.role}
                                onChange={(val) =>
                                  updateCharacters((items) =>
                                    items.map((c, idx) => (idx === charIdx ? { ...c, role: val } : c))
                                  )
                                }
                                placeholder="角色定位"
                                displayClassName={fieldDisplayClass}
                                inputClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>资产优先级</div>
                              <EditableSelect
                                value={char.assetPriority || "medium"}
                                onChange={(val) =>
                                  updateCharacters((items) =>
                                    items.map((c, idx) =>
                                      idx === charIdx ? { ...c, assetPriority: val as any } : c
                                    )
                                  )
                                }
                                options={[
                                  { value: "high", label: "High" },
                                  { value: "medium", label: "Medium" },
                                  { value: "low", label: "Low" },
                                ]}
                                displayClassName={fieldDisplayClass}
                                selectClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>出现集数</div>
                              <EditableText
                                value={char.episodeUsage || ""}
                                onChange={(val) =>
                                  updateCharacters((items) =>
                                    items.map((c, idx) => (idx === charIdx ? { ...c, episodeUsage: val } : c))
                                  )
                                }
                                placeholder="出现场次/集数"
                                displayClassName={fieldDisplayClass}
                                inputClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className={fieldLabelClass}>人设标签</div>
                              <EditableText
                                value={char.archetype || ""}
                                onChange={(val) =>
                                  updateCharacters((items) =>
                                    items.map((c, idx) => (idx === charIdx ? { ...c, archetype: val } : c))
                                  )
                                }
                                placeholder="职业/类型/关键词"
                                displayClassName={fieldDisplayClass}
                                inputClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className={fieldLabelClass}>角色概述</div>
                              <EditableTextarea
                                value={char.bio}
                                onChange={(val) =>
                                  updateCharacters((items) =>
                                    items.map((c, idx) => (idx === charIdx ? { ...c, bio: val } : c))
                                  )
                                }
                                placeholder="角色概述"
                                displayClassName={`${fieldDisplayClass} whitespace-pre-wrap`}
                                textareaClassName={`${fieldInputClass} resize-none overflow-hidden`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => updateCharacters((items) => moveItem(items, charIdx, charIdx - 1))}
                            title="上移"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => updateCharacters((items) => moveItem(items, charIdx, charIdx + 1))}
                            title="下移"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-red-400/40 text-red-400 hover:bg-red-500/10"
                            onClick={() => removeCharacter(charIdx)}
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-overlay)]/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">角色形态</div>
                          <button
                            type="button"
                            className="text-[11px] px-2 py-1 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() =>
                              updateCharacters((items) =>
                                items.map((c, idx) =>
                                  idx === charIdx
                                    ? {
                                        ...c,
                                        forms: [
                                          ...(c.forms || []),
                                          { id: createStableId("form"), formName: "新形态", episodeRange: "", description: "", visualTags: "", identityOrState: "" },
                                        ],
                                      }
                                    : c
                                )
                              )
                            }
                          >
                            + 新形态
                          </button>
                        </div>
                        {(char.forms || []).length === 0 ? (
                          <div className="text-xs text-[var(--text-secondary)]">暂无形态</div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {(char.forms || []).map((form, formIdx) => {
                              const formRefId = `${char.id}|${form.id}`;
                              const formAssets = designAssetMap.get(`form|${formRefId}`) || [];
                              return (
                                <div
                                  key={`${char.id}-${formIdx}`}
                                  className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/70 p-4 space-y-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 space-y-1">
                                      <div className={fieldLabelClass}>形态名称</div>
                                      <EditableText
                                        value={form.formName}
                                        onChange={(val) => updateCharacterFormName(charIdx, formIdx, val)}
                                        placeholder="形态名称"
                                        displayClassName={`${fieldDisplaySmClass} font-semibold`}
                                        inputClassName={`${fieldInputSmClass} font-semibold`}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 pt-5">
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        onClick={() =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? { ...c, forms: moveItem(c.forms || [], formIdx, formIdx - 1) }
                                                : c
                                            )
                                          )
                                        }
                                        title="上移"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        onClick={() =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? { ...c, forms: moveItem(c.forms || [], formIdx, formIdx + 1) }
                                                : c
                                            )
                                          )
                                        }
                                        title="下移"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-red-400/40 text-red-400 hover:bg-red-500/10"
                                        onClick={() => removeCharacterForm(charIdx, formIdx)}
                                        title="删除"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>出现集数</div>
                                      <EditableText
                                        value={form.episodeRange || ""}
                                        onChange={(val) =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? {
                                                    ...c,
                                                    forms: (c.forms || []).map((f, i) =>
                                                      i === formIdx ? { ...f, episodeRange: val } : f
                                                    ),
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="出现集数"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>形态标签</div>
                                      <EditableText
                                        value={form.visualTags || ""}
                                        onChange={(val) =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? {
                                                    ...c,
                                                    forms: (c.forms || []).map((f, i) =>
                                                      i === formIdx ? { ...f, visualTags: val } : f
                                                    ),
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="标签/关键词"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                      <div className={fieldLabelClass}>身份/状态</div>
                                      <EditableText
                                        value={form.identityOrState || ""}
                                        onChange={(val) =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? {
                                                    ...c,
                                                    forms: (c.forms || []).map((f, i) =>
                                                      i === formIdx ? { ...f, identityOrState: val } : f
                                                    ),
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="年龄/身份/状态"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                      <div className={fieldLabelClass}>形态概述</div>
                                      <EditableTextarea
                                        value={form.description}
                                        onChange={(val) =>
                                          updateCharacters((items) =>
                                            items.map((c, idx) =>
                                              idx === charIdx
                                                ? {
                                                    ...c,
                                                    forms: (c.forms || []).map((f, i) =>
                                                      i === formIdx ? { ...f, description: val } : f
                                                    ),
                                                  }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="形态概述"
                                        displayClassName={`${fieldDisplaySmClass} whitespace-pre-wrap`}
                                        textareaClassName={`${fieldInputSmClass} resize-none overflow-hidden`}
                                      />
                                    </div>
                                  </div>
                                  <DesignAssetStrip
                                    assets={formAssets}
                                    onUpload={() =>
                                      handleDesignUploadClick({
                                        refId: formRefId,
                                        category: "form",
                                        label: `${char.name} · ${form.formName}`,
                                      })
                                    }
                                    onRemove={removeDesignAsset}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-secondary)]">暂无角色资产</div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/90 shadow-[var(--shadow-soft)] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin size={16} /> 场景资产编辑
                </div>
                <button
                  type="button"
                  onClick={addLocation}
                  className="px-3 py-1.5 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition"
                >
                  + 新场景
                </button>
              </div>
              {data.context.locations?.length ? (
                <div className="space-y-4">
                  {data.context.locations.map((loc, locIdx) => (
                    <div
                      key={loc.id}
                      className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/75 p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>场景名称</div>
                              <EditableText
                                value={loc.name}
                                onChange={(val) => updateLocationName(locIdx, val)}
                                placeholder="场景名"
                                displayClassName={`${fieldDisplayClass} font-semibold`}
                                inputClassName={`${fieldInputClass} font-semibold`}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>场景类型</div>
                              <EditableSelect
                                value={loc.type}
                                onChange={(val) =>
                                  updateLocations((items) =>
                                    items.map((l, idx) => (idx === locIdx ? { ...l, type: val as any } : l))
                                  )
                                }
                                options={[
                                  { value: "core", label: "Core" },
                                  { value: "secondary", label: "Secondary" },
                                ]}
                                displayClassName={fieldDisplayClass}
                                selectClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>资产优先级</div>
                              <EditableSelect
                                value={loc.assetPriority || "medium"}
                                onChange={(val) =>
                                  updateLocations((items) =>
                                    items.map((l, idx) =>
                                      idx === locIdx ? { ...l, assetPriority: val as any } : l
                                    )
                                  )
                                }
                                options={[
                                  { value: "high", label: "High" },
                                  { value: "medium", label: "Medium" },
                                  { value: "low", label: "Low" },
                                ]}
                                displayClassName={fieldDisplayClass}
                                selectClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <div className={fieldLabelClass}>出现集数</div>
                              <EditableText
                                value={loc.episodeUsage || ""}
                                onChange={(val) =>
                                  updateLocations((items) =>
                                    items.map((l, idx) => (idx === locIdx ? { ...l, episodeUsage: val } : l))
                                  )
                                }
                                placeholder="出现场次/集数"
                                displayClassName={fieldDisplayClass}
                                inputClassName={fieldInputClass}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className={fieldLabelClass}>场景概述</div>
                              <EditableTextarea
                                value={loc.description}
                                onChange={(val) =>
                                  updateLocations((items) =>
                                    items.map((l, idx) => (idx === locIdx ? { ...l, description: val } : l))
                                  )
                                }
                                placeholder="场景概述"
                                displayClassName={`${fieldDisplayClass} whitespace-pre-wrap`}
                                textareaClassName={`${fieldInputClass} resize-none overflow-hidden`}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <div className={fieldLabelClass}>视觉氛围</div>
                              <EditableTextarea
                                value={loc.visuals || ""}
                                onChange={(val) =>
                                  updateLocations((items) =>
                                    items.map((l, idx) => (idx === locIdx ? { ...l, visuals: val } : l))
                                  )
                                }
                                placeholder="光感/材质/色调"
                                displayClassName={`${fieldDisplayClass} whitespace-pre-wrap`}
                                textareaClassName={`${fieldInputClass} resize-none overflow-hidden`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => updateLocations((items) => moveItem(items, locIdx, locIdx - 1))}
                            title="上移"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => updateLocations((items) => moveItem(items, locIdx, locIdx + 1))}
                            title="下移"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-red-400/40 text-red-400 hover:bg-red-500/10"
                            onClick={() => removeLocation(locIdx)}
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-overlay)]/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">场景分区</div>
                          <button
                            type="button"
                            className="text-[11px] px-2 py-1 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() =>
                              updateLocations((items) =>
                                items.map((l, idx) =>
                                  idx === locIdx
                                    ? {
                                        ...l,
                                        zones: [
                                          ...(l.zones || []),
                                          { id: createStableId("zone"), name: "新分区", kind: "unspecified", episodeRange: "", layoutNotes: "", keyProps: "", lightingWeather: "", materialPalette: "" },
                                        ],
                                      }
                                    : l
                                )
                              )
                            }
                          >
                            + 新分区
                          </button>
                        </div>
                        {(loc.zones || []).length === 0 ? (
                          <div className="text-xs text-[var(--text-secondary)]">暂无分区</div>
                        ) : (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {(loc.zones || []).map((zone, zoneIdx) => {
                              const zoneRefId = `${loc.id}|${zone.id}`;
                              const zoneAssets = designAssetMap.get(`zone|${zoneRefId}`) || [];
                              return (
                                <div
                                  key={`${loc.id}-${zoneIdx}`}
                                  className="rounded-2xl border border-[var(--border-subtle)]/70 bg-[var(--bg-panel)]/70 p-4 space-y-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 space-y-1">
                                      <div className={fieldLabelClass}>分区名称</div>
                                      <EditableText
                                        value={zone.name}
                                        onChange={(val) => updateLocationZoneName(locIdx, zoneIdx, val)}
                                        placeholder="分区名称"
                                        displayClassName={`${fieldDisplaySmClass} font-semibold`}
                                        inputClassName={`${fieldInputSmClass} font-semibold`}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 pt-5">
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        onClick={() =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? { ...l, zones: moveItem(l.zones || [], zoneIdx, zoneIdx - 1) }
                                                : l
                                            )
                                          )
                                        }
                                        title="上移"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        onClick={() =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? { ...l, zones: moveItem(l.zones || [], zoneIdx, zoneIdx + 1) }
                                                : l
                                            )
                                          )
                                        }
                                        title="下移"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-red-400/40 text-red-400 hover:bg-red-500/10"
                                        onClick={() => removeLocationZone(locIdx, zoneIdx)}
                                        title="删除"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>类型</div>
                                      <EditableSelect
                                        value={zone.kind || "unspecified"}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, kind: val as any } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        options={[
                                          { value: "interior", label: "Interior" },
                                          { value: "exterior", label: "Exterior" },
                                          { value: "transition", label: "Transition" },
                                          { value: "unspecified", label: "Unspecified" },
                                        ]}
                                        displayClassName={fieldDisplaySmClass}
                                        selectClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>出现集数</div>
                                      <EditableText
                                        value={zone.episodeRange || ""}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, episodeRange: val } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        placeholder="出现集数"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>关键元素</div>
                                      <EditableText
                                        value={zone.keyProps || ""}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, keyProps: val } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        placeholder="分区标签/关键元素"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>光照/天气</div>
                                      <EditableText
                                        value={zone.lightingWeather || ""}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, lightingWeather: val } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        placeholder="光照/天气"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className={fieldLabelClass}>材质/色盘</div>
                                      <EditableText
                                        value={zone.materialPalette || ""}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, materialPalette: val } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        placeholder="材质/色盘"
                                        displayClassName={fieldDisplaySmClass}
                                        inputClassName={fieldInputSmClass}
                                      />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                      <div className={fieldLabelClass}>分区概述</div>
                                      <EditableTextarea
                                        value={zone.layoutNotes || ""}
                                        onChange={(val) =>
                                          updateLocations((items) =>
                                            items.map((l, idx) =>
                                              idx === locIdx
                                                ? {
                                                    ...l,
                                                    zones: (l.zones || []).map((z, i) =>
                                                      i === zoneIdx ? { ...z, layoutNotes: val } : z
                                                    ),
                                                  }
                                                : l
                                            )
                                          )
                                        }
                                        placeholder="分区概述"
                                        displayClassName={`${fieldDisplaySmClass} whitespace-pre-wrap`}
                                        textareaClassName={`${fieldInputSmClass} resize-none overflow-hidden`}
                                      />
                                    </div>
                                  </div>
                                  <DesignAssetStrip
                                    assets={zoneAssets}
                                    onUpload={() =>
                                      handleDesignUploadClick({
                                        refId: zoneRefId,
                                        category: "zone",
                                        label: `${loc.name} · ${zone.name}`,
                                      })
                                    }
                                    onRemove={removeDesignAsset}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-secondary)]">暂无场景资产</div>
              )}
            </div>
          </div>
        </section>

        {/* Generated Libraries */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
              Generated Libraries
            </h3>
            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
              <Sparkles size={14} /> Linked to Node Lab history
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GeneratedLibraryCard
              title="Image Library"
              desc="Generated stills, references and concept frames."
              icon={Image}
              items={imageAssets}
              toneClass="text-blue-300"
              type="image"
            />
            <GeneratedLibraryCard
              title="Video Library"
              desc="Project videos and previews from generation."
              icon={Film}
              items={videoAssets}
              toneClass="text-green-300"
              type="video"
            />
          </div>
        </section>
      </div>
    </div>
  );
};
