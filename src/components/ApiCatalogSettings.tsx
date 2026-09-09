import { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Newspaper,
  CloudRain,
  Rocket,
  Image as ImageIcon,
  Search,
  Lock,
  Server,
} from 'lucide-react';
import { api } from '@/services/api';
import type { ApiCatalogItem } from '@/types';

export function ApiCatalogSettings() {
  const [catalog, setCatalog] = useState<ApiCatalogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Input states for updating/entering keys per service ID
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [actionNotice, setActionNotice] = useState<{ id?: string; type: 'success' | 'error'; message: string } | null>(null);

  // Custom API Modal / Accordion state
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    envVar: '',
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
        isCustom: item.isCustom,
      });

      if (res.ok) {
        // Clear plaintext input after successful save for security
        setKeyInputs((prev) => ({ ...prev, [item.id]: '' }));
        setShowKey((prev) => ({ ...prev, [item.id]: false }));
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
    if (!window.confirm(`Are you sure you want to remove the stored key for ${item.name}?`)) {
      return;
    }

    try {
      setSavingId(item.id);
      setActionNotice(null);
      const res = await api.deleteCatalogKey(item.id);
      if (res.ok) {
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
    if (!customForm.name.trim() || !customForm.key.trim()) {
      alert('Please provide at least a service name and an API key');
      return;
    }

    const id = customForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const envVar = customForm.envVar.trim()
      ? customForm.envVar.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      : `${id.toUpperCase().replace(/-/g, '_')}_API_KEY`;

    try {
      setAddingCustom(true);
      const res = await api.saveCatalogKey({
        id,
        name: customForm.name.trim(),
        envVar,
        key: customForm.key.trim(),
        description: customForm.description.trim() || `Custom backend integration for ${customForm.name.trim()}`,
        docsUrl: customForm.docsUrl.trim() || '',
        isCustom: true,
      });

      if (res.ok) {
        setCustomForm({
          name: '',
          envVar: '',
          key: '',
          description: '',
          docsUrl: '',
          category: 'custom',
        });
        setShowAddCustom(false);
        setActionNotice({
          type: 'success',
          message: `Custom API "${customForm.name.trim()}" successfully registered!`,
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
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const connectedCount = catalog.filter((i) => i.status === 'connected').length;

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
              Configure external third-party service credentials (news feeds, web search engines, satellite maps, weather observations, and space telemetry).
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
                Isolated from Render Env
              </span>
            </div>
            <p className="text-slate-400 text-[11px] m-0">
              Keys added through this interface are written to an encrypted server config vault (<code>data/api_catalog.json</code>).
              Runtime resolution follows a strict priority order: <strong>1. System Environment (Render)</strong> takes primary precedence; if not set, <strong>2. Local Vault Storage</strong> is resolved. Render environment variables remain untouched.
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

      {/* Custom API Modal / Collapse Form */}
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2 m-0">
              <Plus size={16} /> Register Custom Backend API
            </h3>
            <button
              onClick={() => setShowAddCustom(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddCustom} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Service / Provider Name *
              </label>
              <input
                type="text"
                placeholder="e.g. SerpApi, Wolfram Alpha, Finnhub"
                value={customForm.name}
                onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Environment Variable Identifier
              </label>
              <input
                type="text"
                placeholder="e.g. SERPAPI_API_KEY (optional, auto-generated if blank)"
                value={customForm.envVar}
                onChange={(e) => setCustomForm({ ...customForm, envVar: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                API Key Value *
              </label>
              <input
                type="password"
                placeholder="Paste API secret or credential string"
                value={customForm.key}
                onChange={(e) => setCustomForm({ ...customForm, key: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Documentation or Dashboard URL
              </label>
              <input
                type="url"
                placeholder="https://provider.com/api-keys"
                value={customForm.docsUrl}
                onChange={(e) => setCustomForm({ ...customForm, docsUrl: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Description & Purpose
              </label>
              <input
                type="text"
                placeholder="Brief summary of how this backend service is leveraged"
                value={customForm.description}
                onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="text-xs px-4 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingCustom}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                <Lock size={14} />
                {addingCustom ? 'Encrypting & Saving...' : 'Save Custom API to Vault'}
              </button>
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

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search APIs by name or env..."
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

      {/* Card-based List of APIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCatalog.map((item) => {
          const isConnected = item.status === 'connected';
          const isSaving = savingId === item.id;
          const isTesting = testingId === item.id;
          const testRes = testResults[item.id];
          const isVisible = showKey[item.id];

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between p-5 rounded-xl transition-all"
              style={{
                background: 'rgba(14,31,39,0.7)',
                border: isConnected
                  ? '1px solid rgba(97,215,201,0.25)'
                  : '1px solid var(--line)',
                boxShadow: isConnected ? '0 4px 20px -8px rgba(97,215,201,0.1)' : 'none',
              }}
            >
              {/* Card Header: Icon, Name, Category, Status Badge */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100 m-0">
                          {item.name}
                        </h4>
                        {item.isCustom && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-cyan-400/90 font-medium">
                          {item.envVar}
                        </span>
                        {item.docsUrl && (
                          <a
                            href={item.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-cyan-400 transition-colors"
                            title="Open provider docs / get API key"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        Not Configured
                      </span>
                    )}

                    {/* Source Indicator */}
                    {isConnected && (
                      <span className="text-[10px] text-slate-400">
                        Source:{' '}
                        <strong className="text-slate-300">
                          {item.source === 'env'
                            ? 'Render Env'
                            : item.source === 'catalog'
                              ? 'Catalog Vault'
                              : 'System'}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 m-0 line-clamp-2 leading-relaxed mb-3">
                  {item.description}
                </p>

                {/* Masked Key Display if Connected */}
                {item.maskedKey && (
                  <div className="mb-3 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Key size={13} className="text-cyan-400" />
                      <span className="text-slate-400 text-[11px]">Active Key:</span>
                      <span className="font-mono text-cyan-300 font-semibold tracking-wider">
                        {item.maskedKey}
                      </span>
                    </div>
                    {item.source === 'catalog' && (
                      <button
                        onClick={() => handleDeleteKey(item)}
                        disabled={isSaving}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Delete key from local vault"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer: Key Input, Save Button, Test Connection Button */}
              <div className="pt-3 border-t border-slate-800/60 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      placeholder={isConnected ? 'Update / replace API key...' : 'Paste API key here...'}
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
                      className="w-full text-xs px-3 py-1.5 pr-8 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKey((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>

                  <button
                    onClick={() => handleSaveKey(item)}
                    disabled={isSaving || !(keyInputs[item.id] || '').trim()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:hover:bg-cyan-500 flex-shrink-0"
                  >
                    {isSaving ? 'Saving...' : 'Save Key'}
                  </button>
                </div>

                {/* Test Connection and Verification Button */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => handleTestKey(item)}
                    disabled={isTesting}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isTesting ? 'animate-spin text-cyan-400' : ''} />
                    {isTesting ? 'Testing Connection...' : 'Test Connection / Verify'}
                  </button>

                  {item.docsUrl && (
                    <a
                      href={item.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400/80 hover:text-cyan-300 hover:underline inline-flex items-center gap-1"
                    >
                      Get Key
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                {/* Inline Test Result */}
                {testRes && (
                  <div
                    className={`mt-2 p-2 rounded-lg text-[11px] flex items-center gap-2 border ${
                      testRes.ok
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {testRes.ok ? (
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={13} className="text-rose-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{testRes.message}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCatalog.length === 0 && !loading && (
        <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
          No API providers found matching "{searchQuery}".
        </div>
      )}
    </div>
  );
}
