import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, Check, Volume2, RefreshCw } from 'lucide-react';
import { CloudVoiceItem, VoiceProviderConfig } from '@/types';
import { DEFAULT_ELEVENLABS_VOICES } from '@/data/elevenLabsVoices';
import { fetchCloudVoices } from '@/lib/voiceProviderUtils';
import { playTapSound } from '@/lib/audio';

interface CloudVoicePickerProps {
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  activeProvider?: VoiceProviderConfig | null;
}

export function CloudVoicePicker({
  selectedVoiceId,
  onSelectVoice,
  activeProvider,
}: CloudVoicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [voices, setVoices] = useState<CloudVoiceItem[]>(DEFAULT_ELEVENLABS_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Active key for API fetching
  const activeKey = useMemo(() => {
    if (!activeProvider || !activeProvider.keys || activeProvider.keys.length === 0) {
      return '';
    }
    const healthy = activeProvider.keys.find((k) => k.status === 'healthy' && k.key.trim());
    if (healthy) return healthy.key.trim();
    const firstNonEmpty = activeProvider.keys.find((k) => k.key.trim());
    return firstNonEmpty ? firstNonEmpty.key.trim() : '';
  }, [activeProvider]);

  // Load voices on mount or when provider/key changes
  const loadVoices = useCallback(async () => {
    if (!activeProvider) return;
    setLoadingVoices(true);
    try {
      const fetched = await fetchCloudVoices(activeProvider, activeKey);
      if (fetched && fetched.length > 0) {
        setVoices(fetched);
      }
    } catch (err) {
      console.warn('[CloudVoicePicker] Error fetching voices:', err);
    } finally {
      setLoadingVoices(false);
    }
  }, [activeProvider, activeKey]);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

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

  const currentVoiceObj = useMemo(() => {
    const found = voices.find((v) => v.id === selectedVoiceId);
    if (found) return found;
    const defaultFound = DEFAULT_ELEVENLABS_VOICES.find((v) => v.id === selectedVoiceId);
    if (defaultFound) return defaultFound;
    return {
      id: selectedVoiceId,
      name: selectedVoiceId || 'Select a Voice',
      gender: 'Neural Voice',
      accent: 'Cloud AI',
      category: 'cloud',
      description: 'Cloud AI Neural Voice Model',
    };
  }, [voices, selectedVoiceId]);

  const filteredVoices = useMemo(() => {
    let list = voices;

    if (tierFilter === 'free') {
      list = list.filter((v) => v.isFreeTierCompatible !== false && !v.requiresSubscription);
    } else if (tierFilter === 'pro') {
      list = list.filter((v) => v.requiresSubscription || v.isFreeTierCompatible === false);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();

    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.accent && v.accent.toLowerCase().includes(q)) ||
        (v.gender && v.gender.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.labels && Object.values(v.labels).some((val) => val.toLowerCase().includes(q)))
    );
  }, [voices, tierFilter, searchQuery]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
          Cloud Voice Model
        </label>
        {activeProvider && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Provider: {activeProvider.name}
          </span>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          playTapSound();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-slate-950 border border-slate-700/80 hover:border-purple-500/60 rounded-xl px-4 py-3 text-slate-100 text-sm flex items-center justify-between transition shadow-inner cursor-pointer"
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Volume2 size={15} />
          </div>
          <div className="text-left truncate">
            <div className="font-semibold text-slate-100 truncate flex items-center gap-2">
              <span>{currentVoiceObj.name}</span>
              {currentVoiceObj.gender && (
                <span className="text-[11px] font-normal text-purple-300">
                  ({currentVoiceObj.gender})
                </span>
              )}
              {currentVoiceObj.requiresSubscription && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Paid Plan
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {currentVoiceObj.accent || 'Neural'} {currentVoiceObj.description ? `• ${currentVoiceObj.description}` : ''}
            </div>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Warning for paid/library voices if selected */}
      {currentVoiceObj.requiresSubscription && (
        <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span className="leading-snug">
            ⚠️ <strong>{currentVoiceObj.name}</strong> requires a paid ElevenLabs plan via API.
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playTapSound();
              onSelectVoice('gOupLcAkjEnguROwi4oS'); // Darian
            }}
            className="text-[11px] font-medium px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 transition shrink-0 cursor-pointer"
          >
            Switch to Darian
          </button>
        </div>
      )}

      {/* Dropdown / Selection Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn backdrop-blur-2xl">
          {/* Search Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by voice name, accent, gender..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 transition shadow-inner"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playTapSound();
                  loadVoices();
                }}
                disabled={loadingVoices}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 transition cursor-pointer shrink-0"
                title="Refresh voices list from API"
              >
                <RefreshCw size={14} className={loadingVoices ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Quick Filter: Free Tier vs All */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setTierFilter('all')}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition ${
                  tierFilter === 'all'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                All Voices
              </button>
              <button
                type="button"
                onClick={() => setTierFilter('free')}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition ${
                  tierFilter === 'free'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Standard Voices
              </button>
              <button
                type="button"
                onClick={() => setTierFilter('pro')}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition ${
                  tierFilter === 'pro'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Paid / Library
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400">
              <span>{filteredVoices.length} voice models available</span>
              {loadingVoices && <span className="text-purple-400">Refreshing voices...</span>}
            </div>
          </div>

          {/* Voice List Container */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredVoices.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No voice models found matching "{searchQuery}"
              </div>
            ) : (
              filteredVoices.map((v) => {
                const isSelected = v.id === selectedVoiceId;
                const isPaidOnly = v.requiresSubscription || v.isFreeTierCompatible === false;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      onSelectVoice(v.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-xs flex items-start justify-between gap-3 transition cursor-pointer border ${
                      isSelected
                        ? 'bg-purple-500/20 text-purple-100 border-purple-500/50 shadow-md font-medium'
                        : 'bg-slate-900/40 hover:bg-slate-800/70 text-slate-300 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{v.name}</span>
                        {isPaidOnly && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Paid Plan Required
                          </span>
                        )}
                        {v.gender && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {v.gender}
                          </span>
                        )}
                        {v.accent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {v.accent}
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                          {v.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 self-center">
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-purple-500/30 text-purple-300 flex items-center justify-center border border-purple-500/50">
                          <Check size={13} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
