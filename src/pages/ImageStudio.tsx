import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  RotateCw,
  Copy,
  ExternalLink,
  Settings,
  Dice5,
  Check,
  AlertCircle,
  Maximize2,
  X,
  Layers,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import type { ImageProviderConfig, ImageProvidersState } from '@/types';

interface GeneratedImageItem {
  id: string;
  url: string;
  prompt: string;
  providerName: string;
  width: number;
  height: number;
  seed: number;
  model?: string;
  timestamp: number;
}

const SAMPLE_PROMPTS = [
  'Futuristic cyberpunk metropolis bathed in neon rain, volumetric fog, octane render 8k',
  'Whimsical isometric greenhouse laboratory with bioluminescent alien flora, digital art',
  'Astronaut exploring an ancient crystal cave on a desolate purple moon, photorealistic',
  'Hyperrealistic macro close-up of a glass butterfly with iridescent prismatic wings',
  'Minimalist brutalist villa overlooking a calm misty Scandinavian fjord at dawn',
  'Studio portrait of a mechanical cybernetic owl with glowing brass clockwork gears',
];

const ASPECT_RATIOS = [
  { label: '1:1 Square', width: 1024, height: 1024, icon: '■' },
  { label: '16:9 Landscape', width: 1280, height: 720, icon: '▬' },
  { label: '9:16 Portrait', width: 720, height: 1280, icon: '▮' },
  { label: '4:3 Standard', width: 1024, height: 768, icon: '▭' },
  { label: '3:2 Photo', width: 1200, height: 800, icon: '▰' },
];

export function ImageStudio() {
  const [prompt, setPrompt] = useState('');
  const [imageProvidersState, setImageProvidersState] = useState<ImageProvidersState>(() =>
    storage.getImageProvidersState()
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => {
    const s = storage.getImageProvidersState();
    return s.activeProviderId || s.providers[0]?.id || '';
  });

  const [selectedRatioIndex, setSelectedRatioIndex] = useState(0);
  const [modelType, setModelType] = useState('flux');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000));
  const [enhance, setEnhance] = useState(false);
  const [nologo, setNologo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [history, setHistory] = useState<GeneratedImageItem[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImageItem | null>(null);

  // Sync provider list on mount / tab focus
  useEffect(() => {
    const fresh = storage.getImageProvidersState();
    setImageProvidersState(fresh);
    if (!selectedProviderId || !fresh.providers.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(fresh.activeProviderId || fresh.providers[0]?.id || '');
    }
  }, [selectedProviderId]);

  const activeProvider: ImageProviderConfig | undefined =
    imageProvidersState.providers.find((p) => p.id === selectedProviderId) ||
    imageProvidersState.providers[0];

  // Resolve active API key for the selected provider
  const getResolvedApiKey = useCallback((provider: ImageProviderConfig): string => {
    if (!provider.keys || provider.keys.length === 0) return '';
    if (provider.keyStrategy === 'manual' && provider.preferredKeyId) {
      const preferred = provider.keys.find((k) => k.id === provider.preferredKeyId);
      if (preferred?.key) return preferred.key.trim();
    }
    const valid = provider.keys.filter((k) => k.key && k.key.trim().length > 0);
    if (valid.length === 0) return '';
    const healthy = valid.find((k) => k.status === 'healthy') || valid[0];
    return healthy.key.trim();
  }, []);

  // Build the generation URL
  const buildGenerationUrl = useCallback(
    (
      promptText: string,
      provider: ImageProviderConfig,
      opts: { width: number; height: number; seed: number; model?: string; enhance?: boolean; nologo?: boolean }
    ) => {
      const base = provider.url.trim().replace(/\/+$/, '');
      const encodedPrompt = encodeURIComponent(promptText.trim());
      let fullUrl = `${base}/${encodedPrompt}`;

      const key = getResolvedApiKey(provider);
      const params = new URLSearchParams();

      if (key) {
        params.append('key', key);
      }
      if (opts.width && opts.height) {
        params.append('width', String(opts.width));
        params.append('height', String(opts.height));
      }
      if (opts.seed !== undefined) {
        params.append('seed', String(opts.seed));
      }
      if (opts.model && opts.model !== 'default') {
        params.append('model', opts.model);
      }
      if (opts.enhance) {
        params.append('enhance', 'true');
      }
      if (opts.nologo) {
        params.append('nologo', 'true');
      }

      const queryString = params.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }

      return fullUrl;
    },
    [getResolvedApiKey]
  );

  // Generate Image Handler
  const handleGenerate = async (overridePrompt?: string) => {
    const promptToUse = (overridePrompt ?? prompt).trim();
    if (!promptToUse) {
      setError('Please enter a description for your image.');
      return;
    }

    if (!activeProvider) {
      setError('No Image Provider configured. Please check Settings -> AI Providers.');
      return;
    }

    playTapSound();
    setError(null);
    setLoading(true);

    const ratio = ASPECT_RATIOS[selectedRatioIndex] || ASPECT_RATIOS[0];
    const currentSeed = seed;

    const isPost =
      activeProvider.requestType === 'post' ||
      activeProvider.url.toLowerCase().includes('huggingface') ||
      activeProvider.url.toLowerCase().includes('hf-inference');

    try {
      let finalImageUrl = '';

      if (isPost) {
        const apiKey = getResolvedApiKey(activeProvider);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(activeProvider.url.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ inputs: promptToUse }),
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errDetail = '';
          try {
            const errJson = await response.json();
            errDetail = errJson?.error || errJson?.message || JSON.stringify(errJson);
          } catch {
            try {
              errDetail = await response.text();
            } catch {
              errDetail = `HTTP ${response.status}: ${response.statusText}`;
            }
          }

          if (response.status === 503) {
            throw new Error(
              `Model is currently warming up on Hugging Face (${errDetail || 'Estimated time ~20s'}). Please click Generate again in a few moments.`
            );
          } else if (response.status === 401 || response.status === 403) {
            throw new Error(
              `Authentication Error (${response.status}): ${errDetail || 'Invalid API key or unauthorized request.'}`
            );
          } else {
            throw new Error(
              `Provider returned error (${response.status}): ${errDetail || response.statusText}`
            );
          }
        }

        const imageBlob = await response.blob();
        finalImageUrl = URL.createObjectURL(imageBlob);
      } else {
        const generatedUrl = buildGenerationUrl(promptToUse, activeProvider, {
          width: ratio.width,
          height: ratio.height,
          seed: currentSeed,
          model: modelType,
          enhance,
          nologo,
        });

        // Preload image to verify successful rendering
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          const timeout = setTimeout(() => {
            img.src = '';
            reject(new Error('Image generation timed out after 30 seconds.'));
          }, 30000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };

          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load image from provider. Please verify endpoint or API key.'));
          };

          img.src = generatedUrl;
        });

        finalImageUrl = generatedUrl;
      }

      const newItem: GeneratedImageItem = {
        id: `img_${Date.now()}`,
        url: finalImageUrl,
        prompt: promptToUse,
        providerName: activeProvider.name,
        width: ratio.width,
        height: ratio.height,
        seed: currentSeed,
        model: modelType,
        timestamp: Date.now(),
      };

      setCurrentImage(newItem);
      setHistory((prev) => [newItem, ...prev.filter((item) => item.url !== newItem.url)].slice(0, 12));

      // Auto-advance seed for next generation
      setSeed(Math.floor(Math.random() * 1000000));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Download image helper
  const handleDownload = async (item: GeneratedImageItem) => {
    try {
      setDownloading(true);
      playTapSound();

      const sanitized =
        item.prompt.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_') || 'generated_image';
      const fileName = `nexus_${sanitized}_${item.seed}.jpg`;

      if (item.url.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const response = await fetch(item.url, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // Fallback for CORS-restricted downloads
      const a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.download = `nexus_image_${item.seed}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  // Copy Image URL to clipboard
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    playTapSound();
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSurpriseMe = () => {
    playTapSound();
    const randomIndex = Math.floor(Math.random() * SAMPLE_PROMPTS.length);
    const chosen = SAMPLE_PROMPTS[randomIndex];
    setPrompt(chosen);
  };

  const handleRollSeed = () => {
    playTapSound();
    setSeed(Math.floor(Math.random() * 1000000));
  };

  return (
    <div className="page-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Page Header */}
      <header
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(168,85,247,0.2) 100%)',
                border: '1px solid rgba(236,72,153,0.4)',
                display: 'grid',
                placeItems: 'center',
                color: '#f472b6',
              }}
            >
              <ImageIcon size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Image Studio
            </h1>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                background: 'rgba(236,72,153,0.15)',
                color: '#f472b6',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              AI Vision Engine
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            Generate high-fidelity artwork and photorealistic visuals using configured AI image providers.
          </p>
        </div>

        {/* Quick link to Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to="/settings?category=ai"
            className="secondary-button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <Settings size={14} /> Configure Image Providers
          </Link>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* LEFT COLUMN: Controls & Prompt */}
        <div
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,28,48,0.7) 100%)',
            border: '1px solid var(--line)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'grid',
            gap: '20px',
          }}
        >
          {/* Provider Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} style={{ color: '#f472b6' }} /> Image Provider
              </label>
              {activeProvider && (
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                  {activeProvider.keys?.length || 0} API {activeProvider.keys?.length === 1 ? 'Key' : 'Keys'}
                </span>
              )}
            </div>

            <select
              id="image-provider-select"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(10,22,28,0.85)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              {imageProvidersState.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  🎨 {p.name} — {p.requestType === 'post' ? 'POST/JSON' : 'GET/URL'} ({p.url.replace(/^https?:\/\//, '').slice(0, 32)}...)
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Input Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} /> Image Description / Prompt
              </label>
              <button
                type="button"
                onClick={handleSurpriseMe}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                }}
              >
                <Dice5 size={12} /> Surprise Me
              </button>
            </div>

            <textarea
              id="image-prompt-textarea"
              rows={4}
              placeholder="Describe the image you want to generate in detail (e.g. A futuristic cybernetic city floating in the clouds at sunset, volumetric lighting, 8k render)..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(8,18,24,0.85)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Tip: Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px' }}>Ctrl+Enter</kbd> to generate
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                {prompt.length} chars
              </span>
            </div>
          </div>

          {/* Sample Prompts Pills */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Inspiration Prompts:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SAMPLE_PROMPTS.slice(0, 4).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    playTapSound();
                  }}
                  className="secondary-button"
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    textAlign: 'left',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p}
                >
                  {p.slice(0, 36)}...
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Picker */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
              Aspect Ratio & Dimensions
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              {ASPECT_RATIOS.map((ratio, idx) => {
                const isSelected = selectedRatioIndex === idx;
                return (
                  <button
                    key={ratio.label}
                    type="button"
                    onClick={() => {
                      setSelectedRatioIndex(idx);
                      playTapSound();
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#f472b6' : 'var(--line)'}`,
                      background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(10,22,28,0.6)',
                      color: isSelected ? '#f472b6' : 'var(--muted)',
                      fontSize: '11px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{ratio.icon}</span>
                    <span>{ratio.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.8, fontFamily: 'DM Mono, monospace' }}>
                      {ratio.width}×{ratio.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generation Parameters Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {/* Model selector */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                Engine Model
              </label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  padding: '7px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="flux">Flux (High Detail)</option>
                <option value="turbo">Turbo (Ultra Fast)</option>
                <option value="default">Default Provider Model</option>
              </select>
            </div>

            {/* Seed control */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>Seed</label>
                <button
                  type="button"
                  onClick={handleRollSeed}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--accent)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Roll 🎲
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  padding: '7px 8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: 'DM Mono, monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Options Toggles */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enhance}
                onChange={(e) => setEnhance(e.target.checked)}
                style={{ accentColor: '#f472b6' }}
              />
              Auto-Enhance Prompt
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={nologo}
                onChange={(e) => setNologo(e.target.checked)}
                style={{ accentColor: '#f472b6' }}
              />
              Clean Render (No Logo)
            </label>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(237,139,139,0.15)',
                border: '1px solid rgba(237,139,139,0.4)',
                color: 'var(--danger)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <button
            id="generate-image-btn"
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '14px 20px',
              borderRadius: '10px',
              background: loading || !prompt.trim()
                ? 'rgba(236,72,153,0.3)'
                : 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading || !prompt.trim()
                ? 'none'
                : '0 0 24px rgba(236,72,153,0.4), 0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? (
              <>
                <RotateCw size={17} className="animate-spin" /> Synthesizing Image...
              </>
            ) : (
              <>
                <Sparkles size={17} /> Generate Image
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Interactive Image Canvas & Gallery */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Main Output Box */}
          <div
            style={{
              padding: '24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,28,48,0.7) 100%)',
              border: '1px solid var(--line)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} style={{ color: '#f472b6' }} /> Output Canvas
              </h3>
              {currentImage && (
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                  {currentImage.width}×{currentImage.height} · Seed {currentImage.seed}
                </span>
              )}
            </div>

            {/* Display Area: Loading vs Rendered vs Empty */}
            {loading ? (
              <div
                style={{
                  minHeight: '380px',
                  borderRadius: '12px',
                  background: 'rgba(8,16,22,0.8)',
                  border: '1px dashed rgba(236,72,153,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  padding: '30px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(236,72,153,0.15)',
                    border: '2px solid #ec4899',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#f472b6',
                  }}
                >
                  <RotateCw size={28} className="animate-spin" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                    Generating Neural Visuals...
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                    Communicating with {activeProvider?.name || 'Image Provider'} endpoint.
                  </p>
                </div>
              </div>
            ) : currentImage ? (
              <div style={{ display: 'grid', gap: '14px' }}>
                {/* Image Container */}
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#071116',
                    border: '1px solid rgba(236,72,153,0.3)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                >
                  <img
                    src={currentImage.url}
                    alt={currentImage.prompt}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '520px',
                      objectFit: 'contain',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />

                  {/* Expand button overlay */}
                  <button
                    type="button"
                    onClick={() => setFullscreenImage(currentImage)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                    title="Fullscreen View"
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>

                {/* Prompt Caption & Meta */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(10,22,28,0.6)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '12px', color: '#fff', lineHeight: 1.5 }}>
                    "{currentImage.prompt}"
                  </p>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '10px', color: 'var(--muted)' }}>
                    <span>Provider: {currentImage.providerName}</span>
                    <span>Model: {currentImage.model || 'flux'}</span>
                    <span>Seed: {currentImage.seed}</span>
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Download Image Button (Styled similar to Voice AI's Download MP3 button) */}
                  <button
                    id="download-image-btn"
                    type="button"
                    onClick={() => handleDownload(currentImage)}
                    disabled={downloading}
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      padding: '11px 18px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(52,211,153,0.9) 0%, rgba(16,185,129,0.9) 100%)',
                      color: '#062016',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 0 16px rgba(52,211,153,0.3)',
                    }}
                  >
                    {downloading ? (
                      <>
                        <RotateCw size={15} className="animate-spin" /> Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={15} /> Download Image
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyUrl(currentImage.url)}
                    className="secondary-button"
                    style={{
                      padding: '11px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedUrl ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                    {copiedUrl ? 'Copied!' : 'Copy URL'}
                  </button>

                  <a
                    href={currentImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      textDecoration: 'none',
                      color: 'var(--text)',
                    }}
                  >
                    <ExternalLink size={14} /> Open Tab
                  </a>
                </div>
              </div>
            ) : (
              <div
                style={{
                  minHeight: '340px',
                  borderRadius: '12px',
                  background: 'rgba(8,16,22,0.5)',
                  border: '1px dashed var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '30px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: 'rgba(236,72,153,0.1)',
                    border: '1px solid rgba(236,72,153,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#f472b6',
                  }}
                >
                  <ImageIcon size={26} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Ready for Synthesis</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)', maxWidth: '320px' }}>
                    Type a prompt on the left and click "Generate Image" to render stunning visuals with Pollinations or custom endpoints.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Session History Gallery */}
          {history.length > 0 && (
            <div
              style={{
                padding: '18px 20px',
                borderRadius: '14px',
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                  Recent Generations ({history.length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Click to reload</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentImage(item);
                      playTapSound();
                    }}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'pointer',
                      border: `2px solid ${currentImage?.id === item.id ? '#f472b6' : 'transparent'}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                    title={item.prompt}
                  >
                    <img
                      src={item.url}
                      alt={item.prompt}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal View */}
      {fullscreenImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 99999,
            padding: '24px',
          }}
          onClick={() => setFullscreenImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFullscreenImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.15)',
                border: 0,
                borderRadius: '50%',
                color: '#fff',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={fullscreenImage.url}
              alt={fullscreenImage.prompt}
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
              }}
            />
            <p style={{ marginTop: '12px', color: '#fff', fontSize: '13px', textAlign: 'center', maxWidth: '600px' }}>
              {fullscreenImage.prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
