import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Check, Volume2, Globe, User } from 'lucide-react';
import { EDGE_VOICES, EdgeVoice } from '@/data/edgeVoices';
import { playTapSound } from '@/lib/audio';

interface EdgeVoicePickerProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
}

export function EdgeVoicePicker({ selectedVoice, onSelectVoice }: EdgeVoicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLanguages, setExpandedLanguages] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const currentVoiceObj = useMemo(() => {
    return EDGE_VOICES.find((v) => v.id === selectedVoice) || {
      id: selectedVoice,
      name: selectedVoice.split('-')[2]?.replace('Neural', '') || selectedVoice,
      gender: 'Voice',
      language: selectedVoice,
      accent: selectedVoice.split('-')[0] || '',
    };
  }, [selectedVoice]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter voices based on search query
  const filteredVoices = useMemo(() => {
    if (!searchQuery.trim()) return EDGE_VOICES;
    const q = searchQuery.toLowerCase().trim();
    return EDGE_VOICES.filter(
      (v) =>
        v.language.toLowerCase().includes(q) ||
        v.accent.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group filtered voices by language
  const groupedVoices = useMemo(() => {
    const map: Record<string, EdgeVoice[]> = {};
    for (const voice of filteredVoices) {
      if (!map[voice.language]) {
        map[voice.language] = [];
      }
      map[voice.language].push(voice);
    }
    return map;
  }, [filteredVoices]);

  const toggleLanguageGroup = (lang: string) => {
    playTapSound();
    setExpandedLanguages((prev) => ({
      ...prev,
      [lang]: !prev[lang],
    }));
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Neural Voice Model
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          playTapSound();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-slate-950 border border-slate-700/80 hover:border-cyan-500/60 rounded-xl px-4 py-3 text-slate-100 text-sm flex items-center justify-between transition shadow-inner cursor-pointer"
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Volume2 size={15} />
          </div>
          <div className="text-left truncate">
            <div className="font-semibold text-slate-100 truncate">
              {currentVoiceObj.name} ({currentVoiceObj.gender})
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {currentVoiceObj.language} • {currentVoiceObj.accent}
            </div>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown / Selection Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn backdrop-blur-2xl">
          {/* Search Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 space-y-2">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accent and language"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400">
              <span>{filteredVoices.length} voices available</span>
              <span>Click language to expand</span>
            </div>
          </div>

          {/* Voice List Container */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {Object.keys(groupedVoices).length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No voices found matching "{searchQuery}"
              </div>
            ) : (
              Object.entries(groupedVoices).map(([language, voices]) => {
                const isExpanded = searchQuery.trim() !== '' || expandedLanguages[language];
                const hasSelectedVoice = voices.some((v) => v.id === selectedVoice);

                return (
                  <div key={language} className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                    {/* Language Header */}
                    <button
                      type="button"
                      onClick={() => toggleLanguageGroup(language)}
                      className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/60 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe size={13} className="text-cyan-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 truncate">{language}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {voices.length}
                        </span>
                        {hasSelectedVoice && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400" />
                      )}
                    </button>

                    {/* Voices in Language Group */}
                    {isExpanded && (
                      <div className="p-1.5 space-y-1 bg-slate-950/60 border-t border-slate-800/60">
                        {voices.map((v) => {
                          const isSelected = v.id === selectedVoice;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                playTapSound();
                                onSelectVoice(v.id);
                                setIsOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-medium'
                                  : 'hover:bg-slate-800/80 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <User size={13} className={isSelected ? 'text-cyan-400' : 'text-slate-500'} />
                                <div className="truncate">
                                  <span className="font-semibold text-slate-100">{v.name}</span>
                                  <span className="text-[11px] text-slate-400 ml-1.5 font-mono">({v.gender})</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono text-slate-400">{v.accent}</span>
                                {isSelected && <Check size={13} className="text-cyan-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
