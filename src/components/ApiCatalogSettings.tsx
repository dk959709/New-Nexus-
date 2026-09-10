import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Globe,
  Newspaper,
  CloudRain,
  Rocket,
  Image as ImageIcon,
  Search,
  Lock,
  Server,
  Edit2,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '@/services/api';
import type { ApiCatalogItem } from '@/types';

export function ApiCatalogSettings() {
  const [catalog, setCatalog] = useState<ApiCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Key revealing states
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [revealedVisibility, setRevealedVisibility] = useState<Record<string, boolean>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  // Copy indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline editing state for updating/setting a key
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKeyInput, setShowKeyInput] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [actionNotice, setActionNotice] = useState<{ id?: string; type: 'success' | 'error'; message: string } | null>(null);

  // Custom API Modal state
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [showCustomKeyMask, setShowCustomKeyMask] = useState<boolean>(false);
  const [copiedCustomKey, setCopiedCustomKey] = useState<boolean>(false);
  const [showCustomAdvanced, setShowCustomAdvanced] = useState<boolean>(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    envVar: '',
    baseUrl: '',
    queryParamName: 'q',
    key: '',
    description: '',
    docsUrl: '',
    category: 'custom',
  });
  const [addingCustom, setAddingCustom] = useState<boolean>(false);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCatalog();
      if (res && res.data) {
        setCatalog(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load API catalog';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const copyToClipboard = async (text: string, identifier: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const toggleRevealKey = async (item: ApiCatalogItem) => {
    const isCurrentlyVisible = Boolean(revealedVisibility[item.id]);
    if (isCurrentlyVisible) {
      setRevealedVisibility((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    // If key not yet fetched, fetch it from the server
    if (!revealedKeys[item.id]) {
      try {
        setRevealingId(item.id);
        const res = await api.revealCatalogKey(item.id);
        if (res && res.ok && res.key) {
          setRevealedKeys((prev) => ({ ...prev, [item.id]: res.key }));
          setRevealedVisibility((prev) => ({ ...prev, [item.id]: true }));
        } else {
          setActionNotice({ id: item.id, type: 'error', message: 'Could not reveal API key.' });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve key from vault.';
        setActionNotice({ id: item.id, type: 'error', message: msg });
      } finally {
        setRevealingId(null);
      }
    } else {
      setRevealedVisibility((prev) => ({ ...prev, [item.id]: true }));
    }
  };

  const handleCopyKey = async (item: ApiCatalogItem) => {
    let keyToCopy = revealedKeys[item.id];
    if (!keyToCopy) {
      try {
        const res = await api.revealCatalogKey(item.id);
        if (res && res.ok && res.key) {
          keyToCopy = res.key;
          setRevealedKeys((prev) => ({ ...prev, [item.id]: res.key }));
        }
      } catch {
        // Fallback
      }
    }

    if (keyToCopy) {
      await copyToClipboard(keyToCopy, `key-${item.id}`);
      setActionNotice({ id: item.id, type: 'success', message: `Copied API key for ${item.name} to clipboard!` });
    } else if (item.maskedKey) {
      await copyToClipboard(item.maskedKey, `key-${item.id}`);
      setActionNotice({ id: item.id, type: 'success', message: `Copied masked key string for ${item.name}` });
    }
  };

  const handleSaveKey = async (item: ApiCatalogItem) => {
    const rawKey = (keyInputs[item.id] || '').trim();
    if (!rawKey) {
      setActionNotice({ id: item.id, type: 'error', message: 'Please enter a valid API key string' });
      return;
    }

    try {
      setSavingId(item.id);
      setActionNotice(null);
      const res = await api.saveCatalogKey({
        id: item.id,
        key: rawKey,
        name: item.name,
        envVar: item.envVar,
        description: item.description,
        docsUrl: item.docsUrl,
        baseUrl: item.baseUrl,
        queryParamName: item.queryParamName,
        isCustom: item.isCustom,
      });

      if (res.ok) {
        setKeyInputs((prev) => ({ ...prev, [item.id]: '' }));
        setEditingKeyId(null);
        // Cache revealed key locally
        setRevealedKeys((prev) => ({ ...prev, [item.id]: rawKey }));
        setRevealedVisibility((prev) => ({ ...prev, [item.id]: false }));
        setActionNotice({
          id: item.id,
          type: 'success',
          message: `Saved "${item.name}" key securely into local vault!`,
        });
        await fetchCatalog();
      } else {
        setActionNotice({
          id: item.id,
          type: 'error',
          message: res.message || 'Failed to save key',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save key';
      setActionNotice({ id: item.id, type: 'error', message: msg });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteKey = async (item: ApiCatalogItem) => {
    if (!window.confirm(`Are you sure you want to remove the stored key/record for ${item.name}?`)) {
      return;
    }

    try {
      setSavingId(item.id);
      setActionNotice(null);
      const res = await api.deleteCatalogKey(item.id);
      if (res.ok) {
        setRevealedKeys((prev) => {
          const c = { ...prev };
          delete c[item.id];
          return c;
        });
        setRevealedVisibility((prev) => {
          const c = { ...prev };
          delete c[item.id];
          return c;
        });
        setActionNotice({
          id: item.id,
          type: 'success',
          message: `Removed key for "${item.name}" from catalog vault.`,
        });
        await fetchCatalog();
      } else {
        setActionNotice({ id: item.id, type: 'error', message: res.message || 'Failed to delete key' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove key';
      setActionNotice({ id: item.id, type: 'error', message: msg });
    } finally {
      setSavingId(null);
    }
  };

  const handleTestKey = async (item: ApiCatalogItem) => {
    try {
      setTestingId(item.id);
      setTestResults((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });

      const res = await api.testCatalogKey(item.id);
      setTestResults((prev) => ({
        ...prev,
        [item.id]: { ok: res.ok, message: res.message },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test request failed';
      setTestResults((prev) => ({
        ...prev,
        [item.id]: { ok: false, message: msg },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawKeyName = (customForm.envVar || customForm.name).trim();
    const rawVal = customForm.key.trim();

    if (!rawKeyName || !rawVal) {
      alert('Please provide an Environment Variable / Key Name and an API Key value');
      return;
    }
    if (!customForm.baseUrl.trim()) {
      alert('Base URL is required for custom APIs (e.g. https://api.weatherstack.com/current)');
      return;
    }

    const envVar = rawKeyName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    let finalName = customForm.name.trim();
    if (!finalName) {
      finalName = envVar
        .replace(/_API_KEY$|_KEY$|_SECRET$|_TOKEN$/i, '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || envVar;
    }

    const id = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || envVar.toLowerCase().replace(/_/g, '-');

    try {
      setAddingCustom(true);
      const res = await api.saveCatalogKey({
        id,
        name: finalName,
        envVar,
        baseUrl: customForm.baseUrl.trim(),
        queryParamName: customForm.queryParamName.trim() || 'q',
        key: rawVal,
        description: customForm.description.trim() || `Custom backend integration for ${finalName}`,
        docsUrl: customForm.docsUrl.trim() || '',
        isCustom: true,
      });

      if (res.ok) {
        setCustomForm({
          name: '',
          envVar: '',
          baseUrl: '',
          queryParamName: 'q',
          key: '',
          description: '',
          docsUrl: '',
          category: 'custom',
        });
        setShowCustomAdvanced(false);
        setShowAddCustom(false);
        setActionNotice({
          type: 'success',
          message: `Custom API "${finalName}" successfully registered and ready for /customapi slash commands!`,
        });
        await fetchCatalog();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register custom API';
      alert(msg);
    } finally {
      setAddingCustom(false);
    }
  };

  // Helper icons per category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'news':
        return <Newspaper size={14} className="text-cyan-400" />;
      case 'search':
        return <Search size={14} className="text-sky-400" />;
      case 'weather':
        return <CloudRain size={14} className="text-amber-400" />;
      case 'space':
        return <Rocket size={14} className="text-purple-400" />;
      case 'media':
        return <ImageIcon size={14} className="text-emerald-400" />;
      default:
        return <Globe size={14} className="text-indigo-400" />;
    }
  };

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'news', label: 'News & Media' },
    { id: 'search', label: 'Web Search' },
    { id: 'weather', label: 'Atmospheric & Maps' },
    { id: 'space', label: 'Space & Astronomy' },
    { id: 'media', label: 'Media & Wallpapers' },
    { id: 'custom', label: 'Custom APIs' },
  ];

  const filteredCatalog = catalog.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'custom'
          ? item.isCustom
          : item.category === selectedCategory;

    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.envVar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.baseUrl && item.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const connectedCount = catalog.filter((i) => i.status === 'connected').length;

  const targetApiId = (() => {
    if (customForm.name.trim()) {
      return customForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    const keyRef = customForm.envVar.trim();
    if (keyRef) {
      return (
        keyRef
          .replace(/_API_KEY$|_KEY$|_SECRET$|_TOKEN$/i, '')
          .replace(/_/g, '-')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '') || 'api-name'
      );
    }
    return '[api_name]';
  })();

  return (
    <div className="space-y-6">
      {/* Informational Header & Storage Isolation Notice */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(13,26,45,0.7) 100%)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Server size={18} />
              </span>
              <h2 className="text-lg font-bold text-slate-100 m-0">Backend API Catalog</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                {connectedCount} / {catalog.length} Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl m-0 leading-relaxed">
              Manage environment credentials and callable custom endpoints. Configure keys, inspect active values, test connection health, or invoke custom APIs directly via the JARVIS slash command <code className="text-cyan-300 font-mono">/customapi [api] [query]</code>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors"
            >
              <Plus size={14} />
              Add Custom API
            </button>
            <button
              onClick={fetchCatalog}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Security / Architecture badge banner */}
        <div className="mt-4 p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-300 leading-normal">
          <Shield size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>Encrypted Local Vault Storage (AES-256-GCM)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                Render Safe & Isolated
              </span>
            </div>
            <p className="text-slate-400 text-[11px] m-0">
              Keys added through this table are encrypted into local vault storage (<code>data/api_catalog.json</code>). Runtime lookups resolve <strong>1. System Environment (Render)</strong> first, falling back to <strong>2. Local Vault</strong>. Render variables are never modified or overwritten.
            </p>
          </div>
        </div>
      </section>

      {/* Global Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Custom API Modal / Form */}
      {showAddCustom && (
        <section
          style={{
            background: 'rgba(16,28,42,0.95)',
            border: '1px solid rgba(97,215,201,0.3)',
            borderRadius: '12px',
            padding: '20px',
          }}
          className="space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 m-0">
                <Plus size={16} className="text-cyan-400" /> Register Custom API
              </h3>
              <p className="text-[11px] text-slate-400 m-0 mt-0.5">
                Add an environment variable key and configure an endpoint to invoke via JARVIS.
              </p>
            </div>
            <button
              onClick={() => setShowAddCustom(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddCustom} className="space-y-4">
            {/* Row 1: Key | Value (Render Environment Variable Style) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Environment Variable / Key Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WEATHERSTACK_API_KEY"
                  value={customForm.envVar}
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, envVar: e.target.value }))}
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono tracking-wide"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Value <span className="text-cyan-400">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showCustomKeyMask ? 'text' : 'password'}
                      placeholder="Paste API key value..."
                      value={customForm.key}
                      onChange={(e) => setCustomForm((prev) => ({ ...prev, key: e.target.value }))}
                      className="w-full text-xs pl-3 pr-8 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomKeyMask(!showCustomKeyMask)}
                      title={showCustomKeyMask ? 'Hide value' : 'Show value'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showCustomKeyMask ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (customForm.key) {
                        navigator.clipboard.writeText(customForm.key);
                        setCopiedCustomKey(true);
                        setTimeout(() => setCopiedCustomKey(false), 1500);
                      }
                    }}
                    disabled={!customForm.key}
                    title="Copy Key Value"
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-300 hover:border-cyan-500/40 disabled:opacity-40 transition-colors"
                  >
                    {copiedCustomKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomForm((prev) => ({ ...prev, key: '' }))}
                    disabled={!customForm.key}
                    title="Delete Key Value"
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Base URL | Query Parameter Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Base URL (API Endpoint) <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://api.weatherstack.com/current"
                  value={customForm.baseUrl}
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Query Parameter Name
                </label>
                <input
                  type="text"
                  placeholder="q (default if blank, e.g. 'query', 'search', 'city')"
                  value={customForm.queryParamName}
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, queryParamName: e.target.value }))}
                  className="w-full text-xs px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {/* Optional Advanced Expandable Section */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCustomAdvanced(!showCustomAdvanced)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 font-medium transition-colors"
              >
                {showCustomAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Advanced Options (Display Name, Description, Docs URL)</span>
              </button>

              {showCustomAdvanced && (
                <div className="mt-3 p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Service Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Weatherstack (auto-derived from key if blank)"
                      value={customForm.name}
                      onChange={(e) => setCustomForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Documentation URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://weatherstack.com/documentation"
                      value={customForm.docsUrl}
                      onChange={(e) => setCustomForm((prev) => ({ ...prev, docsUrl: e.target.value }))}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Description & Purpose (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Real-time global weather and historical forecasts"
                      value={customForm.description}
                      onChange={(e) => setCustomForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Form Footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                <Terminal size={13} />
                <span>Callable via: <code>/customapi {targetApiId} [query]</code></span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="text-xs px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCustom}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50"
                >
                  <Lock size={14} />
                  {addingCustom ? 'Encrypting & Saving...' : 'Save & Register Custom API'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search APIs by name, env, endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchCatalog} className="underline hover:text-rose-100">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && catalog.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
          <RefreshCw size={24} className="animate-spin text-cyan-400" />
          <span>Synchronizing API Catalog & Vault status...</span>
        </div>
      )}

      {/* PART 1: Clean Table Layout (Render Environment Variables Table Style) */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 shadow-lg">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="bg-slate-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <th className="py-3 px-4 w-[25%]">Service Name</th>
              <th className="py-3 px-4 w-[22%]">Environment Variable</th>
              <th className="py-3 px-4 w-[28%]">Value</th>
              <th className="py-3 px-4 w-[12%]">Status</th>
              <th className="py-3 px-4 w-[13%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredCatalog.map((item) => {
              const isConnected = item.status === 'connected';
              const isRevealed = Boolean(revealedVisibility[item.id]);
              const isRevealing = revealingId === item.id;
              const isTesting = testingId === item.id;
              const isSaving = savingId === item.id;
              const isEditing = editingKeyId === item.id;
              const testRes = testResults[item.id];
              const isCopied = copiedId === `key-${item.id}`;
              const isEnvCopied = copiedId === `env-${item.id}`;

              // Determine display value
              let displayValue = '••••••••••••••••';
              if (isConnected) {
                if (isRevealed && revealedKeys[item.id]) {
                  displayValue = revealedKeys[item.id];
                } else if (item.maskedKey) {
                  displayValue = item.maskedKey;
                }
              }

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-900/40 transition-colors group"
                >
                  {/* Column 1: Service Name */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 flex-shrink-0 mt-0.5">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-200">
                            {item.name}
                          </span>
                          {item.isCustom && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              Custom
                            </span>
                          )}
                          {item.docsUrl && (
                            <a
                              href={item.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-cyan-400 transition-colors inline-flex items-center"
                              title="Open Documentation"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        {item.baseUrl ? (
                          <span
                            className="font-mono text-[10px] text-slate-500 truncate block max-w-[240px] mt-0.5"
                            title={item.baseUrl}
                          >
                            {item.baseUrl}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 max-w-[240px]">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Environment Variable */}
                  <td className="py-3.5 px-4 align-middle font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-cyan-400/95 font-medium tracking-wide">
                        {item.envVar}
                      </span>
                      <button
                        onClick={() => copyToClipboard(item.envVar, `env-${item.id}`)}
                        className="text-slate-500 hover:text-cyan-300 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy variable name"
                      >
                        {isEnvCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </td>

                  {/* Column 3: Value (Masked with Eye Toggle) */}
                  <td className="py-3.5 px-4 align-middle">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type={showKeyInput[item.id] ? 'text' : 'password'}
                          placeholder={isConnected ? 'Update API key...' : 'Paste API key...'}
                          value={keyInputs[item.id] || ''}
                          onChange={(e) =>
                            setKeyInputs({ ...keyInputs, [item.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveKey(item);
                            }
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md bg-slate-900 border border-cyan-500/50 text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeyInput((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                          }
                          className="p-1.5 text-slate-400 hover:text-slate-200"
                        >
                          {showKeyInput[item.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          onClick={() => handleSaveKey(item)}
                          disabled={isSaving || !(keyInputs[item.id] || '').trim()}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
                        >
                          {isSaving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingKeyId(null);
                            setKeyInputs((prev) => ({ ...prev, [item.id]: '' }));
                          }}
                          className="text-[11px] px-2 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : isConnected ? (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 font-mono text-xs max-w-[280px]">
                        <span className={`truncate select-all ${isRevealed ? 'text-amber-300 font-mono' : 'text-slate-400'}`}>
                          {displayValue}
                        </span>
                        <button
                          onClick={() => toggleRevealKey(item)}
                          disabled={isRevealing}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 transition-colors flex-shrink-0 ml-auto"
                          title={isRevealed ? 'Hide API key' : 'Reveal API key'}
                        >
                          {isRevealing ? (
                            <RefreshCw size={12} className="animate-spin text-cyan-400" />
                          ) : isRevealed ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px] italic">Not configured</span>
                        <button
                          onClick={() => setEditingKeyId(item.id)}
                          className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 underline"
                        >
                          + Set Key
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Column 4: Status & Source Badge */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex flex-col items-start gap-1">
                      {isConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          Not Configured
                        </span>
                      )}

                      {isConnected && (
                        <span className="text-[10px] text-slate-500">
                          {item.source === 'env' ? (
                            <span className="text-indigo-400 font-medium">Render Env</span>
                          ) : (
                            <span className="text-cyan-400 font-medium">Catalog Vault</span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Column 5: Actions (Test, Copy, Edit, Delete) */}
                  <td className="py-3.5 px-4 align-middle text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* Test / Verify Icon Button */}
                      <button
                        onClick={() => handleTestKey(item)}
                        disabled={isTesting || !isConnected}
                        className={`p-1.5 rounded-md border transition-colors ${
                          isConnected
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-cyan-300 hover:border-cyan-500/50'
                            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                        }`}
                        title={isConnected ? 'Test connection health & verify key' : 'Configure key first to test'}
                      >
                        <RefreshCw size={13} className={isTesting ? 'animate-spin text-cyan-400' : ''} />
                      </button>

                      {/* Copy Key Button */}
                      <button
                        onClick={() => handleCopyKey(item)}
                        disabled={!isConnected}
                        className={`p-1.5 rounded-md border transition-colors ${
                          isConnected
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-cyan-300 hover:border-cyan-500/50'
                            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                        }`}
                        title="Copy API key to clipboard"
                      >
                        {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>

                      {/* Edit / Update Key Button */}
                      <button
                        onClick={() => {
                          setEditingKeyId(isEditing ? null : item.id);
                        }}
                        className={`p-1.5 rounded-md border transition-colors ${
                          isEditing
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-cyan-300 hover:border-cyan-500/50'
                        }`}
                        title="Edit / Update key"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteKey(item)}
                        disabled={isSaving || (!item.isCustom && item.source !== 'catalog')}
                        className={`p-1.5 rounded-md border transition-colors ${
                          item.isCustom || item.source === 'catalog'
                            ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400 hover:border-rose-500/50'
                            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                        }`}
                        title={
                          item.isCustom || item.source === 'catalog'
                            ? 'Delete key/record from local vault'
                            : 'System predefined key in Render env (cannot be deleted from vault)'
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Inline Test Result Toast if present */}
                    {testRes && (
                      <div
                        className={`mt-2 p-1.5 rounded text-[10px] text-left inline-flex items-center gap-1.5 border max-w-xs ${
                          testRes.ok
                            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/50 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {testRes.ok ? (
                          <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle size={11} className="text-rose-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{testRes.message}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredCatalog.length === 0 && !loading && (
        <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
          No API providers found matching "{searchQuery}".
        </div>
      )}
    </div>
  );
}
