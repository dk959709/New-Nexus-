import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  RotateCw,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  Key,
} from 'lucide-react';
import type {
  AIProviderConfig,
  AIKeyItem,
  AIProvidersState,
  KeyHealthStatus,
} from '@/types';
import { storage } from '@/lib/storage';
import { api } from '@/services/api';

function maskKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  return `••••••••${trimmed.slice(-4)}`;
}

export function AIProvidersSettings() {
  const [providersState, setProvidersState] = useState<AIProvidersState>(() =>
    storage.getAIProvidersState()
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [showKeySecretMap, setShowKeySecretMap] = useState<Record<string, boolean>>({});
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [keyTestResults, setKeyTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [deletingProvider, setDeletingProvider] = useState<{ id: string; name: string } | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state to storage
  const updateProvidersState = (newState: AIProvidersState) => {
    setProvidersState(newState);
    storage.saveAIProvidersState(newState);
  };



  // Open modal/editor for a new provider
  const handleAddNew = () => {
    const newId = `provider_${Date.now()}`;
    const initialKeyId = `key_${Date.now()}_1`;
    setEditingProvider({
      id: newId,
      name: '',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'deepseek/deepseek-chat',
      maxTokens: 128,
      keyStrategy: 'failover',
      keys: [
        {
          id: initialKeyId,
          key: '',
          label: 'API Key 1',
          status: 'untested',
        },
      ],
      capabilities: {
        text: true,
        tools: true,
        web: true,
        wikipedia: true,
        memory: true,
      },
    });
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Open editor for an existing provider
  const handleEdit = (provider: AIProviderConfig) => {
    setEditingProvider(JSON.parse(JSON.stringify(provider)));
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Save provider
  const handleSaveProvider = () => {
    if (!editingProvider) return;
    setFormError(null);

    if (!editingProvider.name.trim()) {
      setFormError('Please enter a Provider Name');
      return;
    }
    if (!editingProvider.url.trim()) {
      setFormError('Please enter an API URL');
      return;
    }
    if (!editingProvider.model.trim()) {
      setFormError('Please enter a Model identifier');
      return;
    }

    const cleanedKeys = editingProvider.keys
      .filter((k) => k.key.trim().length > 0)
      .map((k, idx) => ({
        ...k,
        label: k.label?.trim() || `API Key ${idx + 1}`,
      }));

    if (cleanedKeys.length === 0) {
      setFormError('Please configure at least one API Key for this provider.');
      return;
    }

    const finalProvider: AIProviderConfig = {
      ...editingProvider,
      name: editingProvider.name.trim(),
      url: editingProvider.url.trim(),
      model: editingProvider.model.trim(),
      keys: cleanedKeys,
    };

    const existingIndex = providersState.providers.findIndex(
      (p) => p.id === finalProvider.id
    );

    let updatedList: AIProviderConfig[];
    if (existingIndex >= 0) {
      updatedList = [...providersState.providers];
      updatedList[existingIndex] = finalProvider;
    } else {
      updatedList = [...providersState.providers, finalProvider];
    }

    const newState: AIProvidersState = {
      ...providersState,
      providers: updatedList,
    };

    updateProvidersState(newState);
    setIsEditing(false);
    setEditingProvider(null);
    setFormError(null);
    setNotificationMessage(`Provider "${finalProvider.name}" saved.`);
    setTimeout(() => {
      setNotificationMessage(null);
    }, 3000);
  };

  // Initiate Delete provider flow (shows confirmation dialog)
  const handleDeleteProvider = (id: string, name: string) => {
    if (id === 'existing') return;
    setDeletingProvider({ id, name });
  };

  // Confirm provider deletion
  const confirmDeleteProvider = () => {
    if (!deletingProvider || deletingProvider.id === 'existing') {
      setDeletingProvider(null);
      return;
    }

    const targetId = deletingProvider.id;
    const filtered = providersState.providers.filter((p) => p.id !== targetId);
    const newActive =
      providersState.activeProviderId === targetId ? 'existing' : providersState.activeProviderId;

    const newState: AIProvidersState = {
      activeProviderId: newActive,
      providers: filtered,
    };

    updateProvidersState(newState);
    setDeletingProvider(null);

    // If editing this provider, close editor
    if (editingProvider && editingProvider.id === targetId) {
      setIsEditing(false);
      setEditingProvider(null);
      setFormError(null);
    }

    setNotificationMessage('AI provider deleted.');
    setTimeout(() => {
      setNotificationMessage(null);
    }, 3500);
  };

  // Switch active provider
  const handleSelectActive = (id: string) => {
    updateProvidersState({
      ...providersState,
      activeProviderId: id,
    });
  };

  // Add key to currently editing provider
  const handleAddKeyToEditing = () => {
    if (!editingProvider) return;
    const newKeyId = `key_${Date.now()}_${editingProvider.keys.length + 1}`;
    setEditingProvider({
      ...editingProvider,
      keys: [
        ...editingProvider.keys,
        {
          id: newKeyId,
          key: '',
          label: `API Key ${editingProvider.keys.length + 1}`,
          status: 'untested',
        },
      ],
    });
  };

  // Remove key from editing provider
  const handleRemoveKeyFromEditing = (keyId: string) => {
    if (!editingProvider) return;
    if (editingProvider.keys.length <= 1) {
      alert('A provider must have at least one API Key.');
      return;
    }
    const filtered = editingProvider.keys.filter((k) => k.id !== keyId);
    setEditingProvider({
      ...editingProvider,
      keys: filtered,
      preferredKeyId:
        editingProvider.preferredKeyId === keyId ? undefined : editingProvider.preferredKeyId,
    });
  };

  // Test individual key
  const handleTestKey = async (keyItem: AIKeyItem, url: string, model: string) => {
    if (!keyItem.key.trim()) {
      setKeyTestResults((prev) => ({
        ...prev,
        [keyItem.id]: { ok: false, message: 'Please enter an API Key first' },
      }));
      return;
    }

    setTestingKeyId(keyItem.id);
    setKeyTestResults((prev) => ({
      ...prev,
      [keyItem.id]: { ok: false, message: 'Testing connection...' },
    }));

    try {
      const res = await api.testAIProviderConnection({
        url,
        model,
        key: keyItem.key.trim(),
      });

      if (res.ok) {
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: true, message: `✓ Connection successful (${model})` },
        }));
        if (editingProvider) {
          setEditingProvider({
            ...editingProvider,
            keys: editingProvider.keys.map((k) =>
              k.id === keyItem.id
                ? { ...k, status: 'healthy', lastTested: Date.now(), lastError: undefined }
                : k
            ),
          });
        }
      } else {
        const errorMsg = res.error || `HTTP ${res.status || 'Error'}`;
        const statusType: KeyHealthStatus =
          res.status === 429 ? 'cooldown' : res.status === 401 ? 'invalid' : 'cooldown';
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: false, message: `✕ ${errorMsg}` },
        }));
        if (editingProvider) {
          setEditingProvider({
            ...editingProvider,
            keys: editingProvider.keys.map((k) =>
              k.id === keyItem.id
                ? {
                    ...k,
                    status: statusType,
                    lastTested: Date.now(),
                    lastError: errorMsg,
                  }
                : k
            ),
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setKeyTestResults((prev) => ({
        ...prev,
        [keyItem.id]: { ok: false, message: `✕ Connection failed: ${msg}` },
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test full provider connection
  const handleTestProvider = async (provider: AIProviderConfig) => {
    if (provider.keys.length === 0) return;
    setTestingProviderId(provider.id);
    setProviderTestResults((prev) => ({
      ...prev,
      [provider.id]: { ok: false, message: 'Testing keys...' },
    }));

    let anySuccess = false;
    let lastError = '';

    for (const k of provider.keys) {
      try {
        const res = await api.testAIProviderConnection({
          url: provider.url,
          model: provider.model,
          key: k.key,
        });
        if (res.ok) {
          anySuccess = true;
          storage.updateKeyHealth(provider.id, k.id, 'healthy');
          break;
        } else {
          lastError = res.error || `HTTP ${res.status}`;
          storage.updateKeyHealth(
            provider.id,
            k.id,
            res.status === 401 ? 'invalid' : 'cooldown',
            lastError
          );
        }
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    // Refresh state from storage
    setProvidersState(storage.getAIProvidersState());

    if (anySuccess) {
      setProviderTestResults((prev) => ({
        ...prev,
        [provider.id]: { ok: true, message: `✓ Connection verified on ${provider.model}` },
      }));
    } else {
      setProviderTestResults((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: `✕ Test failed: ${lastError}` },
      }));
    }
    setTestingProviderId(null);
  };

  return (
    <div className="ai-providers-container" style={{ display: 'grid', gap: '24px', position: 'relative' }}>
      {/* Toast Notification Banner */}
      {notificationMessage && (
        <div
          id="ai-provider-toast"
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(52,211,153,0.15)',
            border: '1px solid rgba(52,211,153,0.4)',
            color: '#34d399',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✓</span>
            <span>{notificationMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#34d399',
              cursor: 'pointer',
              fontSize: '16px',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Active AI Provider Selector Header */}
      <section
        className="setting-row"
        style={{
          background: 'linear-gradient(135deg, rgba(14,33,42,0.7) 0%, rgba(20,24,48,0.75) 100%)',
          border: '1px solid var(--line-strong)',
          borderRadius: '12px',
          padding: '22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'rgba(97,215,201,0.15)',
                color: 'var(--accent)',
              }}
            >
              <Cpu size={16} />
            </span>
            <h2 style={{ margin: 0, fontSize: '17px', letterSpacing: '-0.02em' }}>
              Active AI Provider
            </h2>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
            Currently powering NEXUS Smart Answers, Assistant Chat, and shared Knowledge tools.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={providersState.activeProviderId}
            onChange={(e) => handleSelectActive(e.target.value)}
            aria-label="Active AI Provider"
            style={{
              background: 'rgba(10,22,28,0.85)',
              color: '#fff',
              border: '1px solid var(--accent)',
              padding: '9px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(97,215,201,0.2)',
            }}
          >
            <option value="existing">🧠 Existing AI (Built-in / Protected)</option>
            {providersState.providers.map((p) => (
              <option key={p.id} value={p.id}>
                🔵 {p.name} ({p.model})
              </option>
            ))}
          </select>
        </div>
      </section>



      {/* Provider Cards List */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>
              Your AI Providers
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Add multiple API keys with auto-failover, round-robin rotation, and full NEXUS tool
              integration.
            </p>
          </div>

          {!isEditing && (
            <button
              onClick={handleAddNew}
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Add AI Provider
            </button>
          )}
        </div>

        {/* List of Provider Cards */}
        <div style={{ display: 'grid', gap: '14px' }}>
          {/* Card 1: Protected Existing AI */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${
                providersState.activeProviderId === 'existing'
                  ? 'var(--accent)'
                  : 'rgba(165,207,214,0.18)'
              }`,
              background:
                providersState.activeProviderId === 'existing'
                  ? 'linear-gradient(135deg, rgba(14,38,48,0.7) 0%, rgba(20,28,56,0.7) 100%)'
                  : 'linear-gradient(135deg, rgba(14,31,39,0.55) 0%, rgba(18,22,40,0.55) 100%)',
              boxShadow:
                providersState.activeProviderId === 'existing'
                  ? '0 0 16px rgba(97,215,201,0.15)'
                  : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🧠</span>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Existing AI</h4>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Protected / Default
                </span>
                {providersState.activeProviderId === 'existing' && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(52,211,153,0.2)',
                      color: '#34d399',
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                Model: Built-in DeepSeek / OpenRouter Fallback
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px',
                  fontSize: '11px',
                  color: 'var(--muted)',
                }}
              >
                <span>✓ Web Grounding</span>
                <span>✓ Wikipedia Knowledge</span>
                <span>✓ Weather & Space Tools</span>
                <span>✓ Smart Memory</span>
              </div>
            </div>

            <div>
              {providersState.activeProviderId === 'existing' ? (
                <button
                  disabled
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(97,215,201,0.2)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'default',
                  }}
                >
                  Active Provider
                </button>
              ) : (
                <button
                  onClick={() => handleSelectActive('existing')}
                  className="secondary-button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Use This Provider
                </button>
              )}
            </div>
          </div>

          {providersState.providers.map((p) => {
            const isActive = providersState.activeProviderId === p.id;
            const healthyKeys = p.keys.filter((k) => k.status === 'healthy').length;
            const cooldownKeys = p.keys.filter((k) => k.status === 'cooldown').length;
            const invalidKeys = p.keys.filter((k) => k.status === 'invalid').length;
            const testResult = providerTestResults[p.id];

            return (
              <div
                key={p.id}
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${
                    isActive ? 'var(--accent)' : 'rgba(165,207,214,0.18)'
                  }`,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(14,38,48,0.7) 0%, rgba(20,28,56,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(14,31,39,0.55) 0%, rgba(18,22,40,0.55) 100%)',
                  boxShadow: isActive ? '0 0 16px rgba(97,215,201,0.15)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔵</span>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{p.name}</h4>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(97,215,201,0.12)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {p.keys.length} API {p.keys.length === 1 ? 'Key' : 'Keys'}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(147,197,253,0.15)',
                        color: '#93c5fd',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                      }}
                    >
                      Strategy: {p.keyStrategy.replace('_', ' ')}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(52,211,153,0.2)',
                          color: '#34d399',
                          fontWeight: 600,
                        }}
                      >
                        Active Chat Provider
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      margin: '6px 0 0',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    Model: <span style={{ color: '#fff' }}>{p.model}</span> · Max Tokens:{' '}
                    <span style={{ color: 'var(--accent)' }}>{p.maxTokens ?? 128}</span> · Endpoint:{' '}
                    <span style={{ color: 'var(--muted)' }}>
                      {p.url.replace(/^https?:\/\//, '').slice(0, 30)}...
                    </span>
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '8px',
                      fontSize: '11px',
                    }}
                  >
                    {healthyKeys > 0 && (
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🟢 {healthyKeys} Healthy
                      </span>
                    )}
                    {cooldownKeys > 0 && (
                      <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🟡 {cooldownKeys} Rate Limited
                      </span>
                    )}
                    {invalidKeys > 0 && (
                      <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🔴 {invalidKeys} Invalid
                      </span>
                    )}
                    {healthyKeys === 0 && cooldownKeys === 0 && invalidKeys === 0 && (
                      <span style={{ color: 'var(--muted)' }}>⚪ Untested Keys</span>
                    )}
                  </div>

                  {testResult && (
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: testResult.ok ? '#34d399' : '#f87171',
                        fontWeight: 500,
                      }}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {isActive ? (
                    <button
                      disabled
                      style={{
                        padding: '8px 14px',
                        borderRadius: '7px',
                        background: 'rgba(97,215,201,0.2)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'default',
                      }}
                    >
                      Active
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectActive(p.id)}
                      className="secondary-button"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Use
                    </button>
                  )}

                  <button
                    onClick={() => handleTestProvider(p)}
                    disabled={testingProviderId === p.id}
                    className="secondary-button"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '7px',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCw
                      size={13}
                      className={testingProviderId === p.id ? 'animate-spin' : ''}
                    />
                    Test
                  </button>

                  <button
                    onClick={() => handleEdit(p)}
                    className="secondary-button"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '7px',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>

                  <button
                    onClick={() => handleDeleteProvider(p.id, p.name)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '7px',
                      background: 'rgba(237,139,139,0.1)',
                      border: '1px solid rgba(237,139,139,0.3)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    title="Delete provider"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Provider Button at the Bottom */}
        {!isEditing && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleAddNew}
              className="secondary-button"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                borderStyle: 'dashed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> ＋ Add AI Provider
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit AI Provider Modal / Form */}
      {isEditing && editingProvider && (
        <div
          style={{
            marginTop: '10px',
            padding: '24px',
            borderRadius: '14px',
            border: '1px solid var(--accent)',
            background: 'linear-gradient(135deg, rgba(12,26,34,0.92) 0%, rgba(18,22,46,0.95) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(97,215,201,0.2)',
            display: 'grid',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '14px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                {providersState.providers.some((p) => p.id === editingProvider.id)
                  ? 'Edit AI Provider'
                  : 'Add AI Provider'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Configure endpoint URL, model, and multiple API keys for automatic failover & rotation.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'OpenRouter',
                    url: 'https://openrouter.ai/api/v1/chat/completions',
                    model: 'deepseek/deepseek-chat',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px' }}
              >
                OpenRouter Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'DeepSeek Direct',
                    url: 'https://api.deepseek.com/chat/completions',
                    model: 'deepseek-chat',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px' }}
              >
                DeepSeek Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'Groq',
                    url: 'https://api.groq.com/openai/v1/chat/completions',
                    model: 'llama-3.3-70b-versatile',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px' }}
              >
                Groq Preset
              </button>

            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(237,139,139,0.15)',
                border: '1px solid rgba(237,139,139,0.4)',
                color: 'var(--danger)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✕ {formError}
            </div>
          )}

          {/* Form Fields: Provider Name, API URL, Model */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Provider Name
              </label>
              <input
                type="text"
                placeholder="e.g. My DeepSeek, OpenRouter, Gemini"
                value={editingProvider.name}
                onChange={(e) =>
                  setEditingProvider({ ...editingProvider, name: e.target.value })
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                API URL
              </label>
              <input
                type="text"
                placeholder="https://openrouter.ai/api/v1/chat/completions"
                value={editingProvider.url}
                onChange={(e) =>
                  setEditingProvider({ ...editingProvider, url: e.target.value })
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'DM Mono, monospace',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Model ID
              </label>
              <input
                type="text"
                placeholder="e.g. deepseek/deepseek-chat, gpt-4o, etc."
                value={editingProvider.model}
                onChange={(e) =>
                  setEditingProvider({ ...editingProvider, model: e.target.value })
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'DM Mono, monospace',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Max Output Tokens
              </label>
              <input
                type="number"
                min={16}
                max={4096}
                placeholder="128"
                value={editingProvider.maxTokens ?? 128}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setEditingProvider({
                    ...editingProvider,
                    maxTokens: isNaN(val) ? 128 : Math.max(16, Math.min(4096, val)),
                  });
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(10,22,28,0.8)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'DM Mono, monospace',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                Default: 128 (keeps credit consumption low).
              </span>
            </div>
          </div>

          {/* Key Strategy Selector */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(10,22,28,0.5)',
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                API Key Strategy
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                Automatic Failover tries backup keys on 429/rate-limit. Round Robin balances requests.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="segmented-control">
                <button
                  type="button"
                  className={editingProvider.keyStrategy === 'failover' ? 'selected' : ''}
                  onClick={() =>
                    setEditingProvider({ ...editingProvider, keyStrategy: 'failover' })
                  }
                >
                  Automatic Failover
                </button>
                <button
                  type="button"
                  className={editingProvider.keyStrategy === 'round_robin' ? 'selected' : ''}
                  onClick={() =>
                    setEditingProvider({ ...editingProvider, keyStrategy: 'round_robin' })
                  }
                >
                  Round Robin
                </button>
                <button
                  type="button"
                  className={editingProvider.keyStrategy === 'manual' ? 'selected' : ''}
                  onClick={() =>
                    setEditingProvider({ ...editingProvider, keyStrategy: 'manual' })
                  }
                >
                  Manual
                </button>
              </div>

              {editingProvider.keyStrategy === 'manual' && (
                <select
                  value={editingProvider.preferredKeyId || ''}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      preferredKeyId: e.target.value || undefined,
                    })
                  }
                  style={{
                    background: 'rgba(14,31,39,0.8)',
                    color: '#fff',
                    border: '1px solid var(--line)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                >
                  <option value="">Select Preferred Key</option>
                  {editingProvider.keys.map((k, i) => (
                    <option key={k.id} value={k.id}>
                      {k.label || `Key ${i + 1}`} ({maskKey(k.key)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Multiple API Keys Section */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Key size={15} /> Configured API Keys ({editingProvider.keys.length})
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  Add multiple API keys to this provider pool. Keys are securely stored and masked.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddKeyToEditing}
                className="secondary-button"
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add API Key
              </button>
            </div>

            {/* List of keys inputs */}
            <div style={{ display: 'grid', gap: '10px' }}>
              {editingProvider.keys.map((keyItem, index) => {
                const isRevealed = Boolean(showKeySecretMap[keyItem.id]);
                const isTesting = testingKeyId === keyItem.id;
                const testResult = keyTestResults[keyItem.id];

                return (
                  <div
                    key={keyItem.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(10,22,28,0.6)',
                      border: '1px solid var(--line)',
                      display: 'grid',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Key Label */}
                      <input
                        type="text"
                        placeholder={`Key ${index + 1}`}
                        value={keyItem.label || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingProvider({
                            ...editingProvider,
                            keys: editingProvider.keys.map((k) =>
                              k.id === keyItem.id ? { ...k, label: val } : k
                            ),
                          });
                        }}
                        style={{
                          width: '110px',
                          background: 'none',
                          border: '1px solid var(--line)',
                          borderRadius: '6px',
                          padding: '7px 8px',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      />

                      {/* Secret Key Input */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: '220px',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type={isRevealed ? 'text' : 'password'}
                          placeholder="sk-..."
                          value={keyItem.key}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingProvider({
                              ...editingProvider,
                              keys: editingProvider.keys.map((k) =>
                                k.id === keyItem.id
                                  ? { ...k, key: val, status: 'untested' }
                                  : k
                              ),
                            });
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'rgba(7,16,22,0.8)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            padding: '7px 32px 7px 10px',
                            color: '#fff',
                            fontSize: '12px',
                            fontFamily: 'DM Mono, monospace',
                            letterSpacing: isRevealed ? '0' : '0.1em',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeySecretMap((prev) => ({
                              ...prev,
                              [keyItem.id]: !prev[keyItem.id],
                            }))
                          }
                          style={{
                            position: 'absolute',
                            right: '6px',
                            background: 'none',
                            border: 0,
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title={isRevealed ? 'Hide API Key' : 'Reveal API Key'}
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      {/* Status Tag */}
                      <div style={{ minWidth: '90px' }}>
                        {keyItem.status === 'healthy' && (
                          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                            🟢 Healthy
                          </span>
                        )}
                        {keyItem.status === 'cooldown' && (
                          <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>
                            🟡 Rate limited
                          </span>
                        )}
                        {keyItem.status === 'invalid' && (
                          <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>
                            🔴 Invalid
                          </span>
                        )}
                        {(!keyItem.status || keyItem.status === 'untested') && (
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            ⚪ Untested
                          </span>
                        )}
                      </div>

                      {/* Test Key Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleTestKey(keyItem, editingProvider.url, editingProvider.model)
                        }
                        disabled={isTesting || !keyItem.key.trim()}
                        className="secondary-button"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <RotateCw size={12} className={isTesting ? 'animate-spin' : ''} />
                        Test
                      </button>

                      {/* Delete Key Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyFromEditing(keyItem.id)}
                        disabled={editingProvider.keys.length <= 1}
                        style={{
                          background: 'rgba(237,139,139,0.1)',
                          border: '1px solid rgba(237,139,139,0.2)',
                          color: 'var(--danger)',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor:
                            editingProvider.keys.length <= 1 ? 'not-allowed' : 'pointer',
                          opacity: editingProvider.keys.length <= 1 ? 0.4 : 1,
                        }}
                        title="Delete key"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Test result message */}
                    {testResult && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: testResult.ok ? '#34d399' : '#f87171',
                          paddingLeft: '4px',
                        }}
                      >
                        {testResult.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capabilities */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(10,22,28,0.4)',
              border: '1px solid var(--line)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)' }}>
              NEXUS Shared Capabilities Enabled:
            </h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={editingProvider.capabilities.text}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      capabilities: { ...editingProvider.capabilities, text: e.target.checked },
                    })
                  }
                />
                Text Generation
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={editingProvider.capabilities.tools}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      capabilities: { ...editingProvider.capabilities, tools: e.target.checked },
                    })
                  }
                />
                Tool Context Layer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={editingProvider.capabilities.web}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      capabilities: { ...editingProvider.capabilities, web: e.target.checked },
                    })
                  }
                />
                Web & News Grounding
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={editingProvider.capabilities.wikipedia}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      capabilities: {
                        ...editingProvider.capabilities,
                        wikipedia: e.target.checked,
                      },
                    })
                  }
                />
                Wikipedia Reference
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={editingProvider.capabilities.memory}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      capabilities: { ...editingProvider.capabilities, memory: e.target.checked },
                    })
                  }
                />
                Shared Smart Memory
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              borderTop: '1px solid var(--line)',
              paddingTop: '16px',
            }}
          >
            {providersState.providers.some((p) => p.id === editingProvider.id) && (
              <button
                type="button"
                onClick={() => handleDeleteProvider(editingProvider.id, editingProvider.name)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'rgba(237,139,139,0.1)',
                  border: '1px solid rgba(237,139,139,0.3)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginRight: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} /> Delete Provider
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditingProvider(null);
                setFormError(null);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--line)',
                color: 'var(--muted)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveProvider}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: '#071016',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(97,215,201,0.4)',
              }}
            >
              Save Provider
            </button>
          </div>
        </div>
      )}

      {/* Shared NEXUS Tool System Architecture Diagram */}
      <section
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(10,22,28,0.4)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Layers size={16} color="var(--accent)" />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            NEXUS Shared Architecture
          </h4>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
          All configured AI providers act as interchangeable neural engines plugged directly into
          the centralized <b>NEXUS Tool Layer</b>. Whether using the protected Existing AI or custom
          endpoints, your requests automatically receive compact verified intelligence from{' '}
          <b>Web Search</b>, <b>Wikipedia</b>, <b>Atmospheric Weather</b>, <b>NASA Space Data</b>,{' '}
          <b>Live News</b>, and <b>Smart Memory</b>.
        </p>
      </section>

      {/* Delete Provider Confirmation Dialog */}
      {deletingProvider && (
        <div
          id="delete-provider-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeletingProvider(null);
            }
          }}
        >
          <div
            id="delete-provider-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'linear-gradient(135deg, rgba(16,28,36,0.98) 0%, rgba(20,24,44,0.98) 100%)',
              border: '1px solid rgba(237,139,139,0.4)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 24px rgba(237,139,139,0.15)',
              display: 'grid',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(237,139,139,0.15)',
                  color: 'var(--danger)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={22} />
              </div>
              <div>
                <h3
                  id="delete-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Delete {deletingProvider.name || 'Provider'}?
                </h3>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '13px',
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                  }}
                >
                  This will remove this AI provider and its configured API keys.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '8px',
                borderTop: '1px solid var(--line)',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                id="cancel-delete-provider-btn"
                onClick={() => setDeletingProvider(null)}
                className="secondary-button"
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-delete-provider-btn"
                onClick={confirmDeleteProvider}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: 'var(--danger)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 12px rgba(237,139,139,0.3)',
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
