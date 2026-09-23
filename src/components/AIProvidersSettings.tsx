import { useState, useEffect } from 'react';
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
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';
import type {
  AIProviderConfig,
  ImageProviderConfig,
  VoiceProviderConfig,
  AIKeyItem,
  AIProvidersState,
  ImageProvidersState,
  VoiceProvidersState,
  KeyHealthStatus,
  AIProviderType,
  ReasoningOverrideMode,
} from '@/types';
import { storage } from '@/lib/storage';
import { api } from '@/services/api';
import {
  loadPuterScript,
  getPuterDebugInfo,
  PuterDebugInfo,
  PUTER_IMAGE_MODELS,
  DEFAULT_PUTER_MODEL,
  PUTER_TIMEOUT_ERROR_MESSAGE,
} from '@/services/puterImageService';
import {
  buildImageRequestBody,
  buildImageRequestHeaders,
  extractImageUrlFromJson,
} from '@/lib/imageProviderUtils';
import {
  buildVoiceRequestHeaders,
} from '@/lib/voiceProviderUtils';

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
  const [imageProvidersState, setImageProvidersState] = useState<ImageProvidersState>(() =>
    storage.getImageProvidersState()
  );
  const [voiceProvidersState, setVoiceProvidersState] = useState<VoiceProvidersState>(() =>
    storage.getVoiceProvidersState()
  );

  const [isEditing, setIsEditing] = useState(false);
  const [providerType, setProviderType] = useState<AIProviderType>('text');
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [editingImageProvider, setEditingImageProvider] = useState<ImageProviderConfig | null>(null);
  const [editingVoiceProvider, setEditingVoiceProvider] = useState<VoiceProviderConfig | null>(null);

  const [showKeySecretMap, setShowKeySecretMap] = useState<Record<string, boolean>>({});
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [keyTestResults, setKeyTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [puterDebugInfo, setPuterDebugInfo] = useState<PuterDebugInfo | null>(null);
  const [showPuterDebug, setShowPuterDebug] = useState(true);
  const [deletingProvider, setDeletingProvider] = useState<{
    id: string;
    name: string;
    type: AIProviderType;
  } | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state to storage
  const updateProvidersState = (newState: AIProvidersState) => {
    setProvidersState(newState);
    storage.saveAIProvidersState(newState);
  };

  const updateImageProvidersState = (newState: ImageProvidersState) => {
    setImageProvidersState(newState);
    storage.saveImageProvidersState(newState);
  };

  const updateVoiceProvidersState = (newState: VoiceProvidersState) => {
    setVoiceProvidersState(newState);
    storage.saveVoiceProvidersState(newState);
  };

  // Keep state synchronized with storage events
  useEffect(() => {
    const handleSync = () => {
      setProvidersState(storage.getAIProvidersState());
      setImageProvidersState(storage.getImageProvidersState());
      setVoiceProvidersState(storage.getVoiceProvidersState());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('nexus-ai-providers-updated', handleSync);
    window.addEventListener('nexus-image-providers-updated', handleSync);
    window.addEventListener('nexus-voice-providers-updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('nexus-ai-providers-updated', handleSync);
      window.removeEventListener('nexus-image-providers-updated', handleSync);
      window.removeEventListener('nexus-voice-providers-updated', handleSync);
    };
  }, []);

  // Open modal/editor for a new provider
  const handleAddNew = (type: AIProviderType = 'text') => {
    setProviderType(type);
    if (type === 'text') {
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
      setEditingImageProvider(null);
      setEditingVoiceProvider(null);
    } else if (type === 'image') {
      const newId = `img_provider_${Date.now()}`;
      const initialKeyId = `img_key_${Date.now()}_1`;
      setEditingImageProvider({
        id: newId,
        name: '',
        url: 'https://image.pollinations.ai/prompt/',
        requestType: 'get',
        keyStrategy: 'failover',
        keys: [
          {
            id: initialKeyId,
            key: '',
            label: 'API Key 1',
            status: 'untested',
          },
        ],
      });
      setEditingProvider(null);
      setEditingVoiceProvider(null);
    } else {
      const newId = `voice_provider_${Date.now()}`;
      const initialKeyId = `voice_key_${Date.now()}_1`;
      setEditingVoiceProvider({
        id: newId,
        name: '',
        url: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
        voicesUrl: 'https://api.elevenlabs.io/v1/voices',
        model: 'eleven_multilingual_v2',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        requestType: 'post',
        customHeaderName: 'xi-api-key',
        requestBodyTemplate: '{\n  "text": "{text}",\n  "model_id": "eleven_multilingual_v2"\n}',
        keyStrategy: 'failover',
        keys: [
          {
            id: initialKeyId,
            key: '',
            label: 'ElevenLabs API Key 1',
            status: 'untested',
          },
        ],
      });
      setEditingProvider(null);
      setEditingImageProvider(null);
    }
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Open editor for an existing text provider
  const handleEdit = (provider: AIProviderConfig) => {
    setProviderType('text');
    setEditingProvider(JSON.parse(JSON.stringify(provider)));
    setEditingImageProvider(null);
    setEditingVoiceProvider(null);
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Open editor for an existing image provider
  const handleEditImageProvider = (provider: ImageProviderConfig) => {
    setProviderType('image');
    setEditingImageProvider(JSON.parse(JSON.stringify(provider)));
    setEditingProvider(null);
    setEditingVoiceProvider(null);
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Open editor for an existing voice provider
  const handleEditVoiceProvider = (provider: VoiceProviderConfig) => {
    setProviderType('voice');
    setEditingVoiceProvider(JSON.parse(JSON.stringify(provider)));
    setEditingProvider(null);
    setEditingImageProvider(null);
    setKeyTestResults({});
    setFormError(null);
    setIsEditing(true);
  };

  // Save Text Provider
  const handleSaveTextProvider = () => {
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
        key: k.key.trim(),
      }));

    const finalKeys: AIKeyItem[] =
      cleanedKeys.length > 0
        ? cleanedKeys
        : [
            {
              id: `key_${Date.now()}`,
              key: '',
              label: 'API Key 1',
              status: 'untested',
            },
          ];

    const finalProvider: AIProviderConfig = {
      ...editingProvider,
      name: editingProvider.name.trim(),
      url: editingProvider.url.trim(),
      model: editingProvider.model.trim(),
      keys: finalKeys,
    };

    const currentStored = storage.getAIProvidersState();
    const existingIndex = currentStored.providers.findIndex(
      (p) => p.id === finalProvider.id
    );
    let updatedList: AIProviderConfig[];

    if (existingIndex >= 0) {
      updatedList = currentStored.providers.map((p) =>
        p.id === finalProvider.id ? finalProvider : p
      );
    } else {
      updatedList = [...currentStored.providers, finalProvider];
    }

    const newState: AIProvidersState = {
      activeProviderId: currentStored.activeProviderId || providersState.activeProviderId,
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

  // Update provider reasoning override mode ('auto' | 'force_on' | 'force_off')
  const handleUpdateProviderReasoningOverride = (
    providerId: string,
    override: ReasoningOverrideMode
  ) => {
    const current = storage.getAIProvidersState();
    const updatedProviders = current.providers.map((p) =>
      p.id === providerId ? { ...p, reasoningOverride: override } : p
    );
    const newState: AIProvidersState = {
      ...current,
      providers: updatedProviders,
    };
    updateProvidersState(newState);

    if (editingProvider && editingProvider.id === providerId) {
      setEditingProvider({ ...editingProvider, reasoningOverride: override });
    }

    const providerName = current.providers.find((p) => p.id === providerId)?.name || 'Provider';
    const label =
      override === 'auto'
        ? 'Auto (role-based)'
        : override === 'force_on'
        ? 'Forced On'
        : 'Forced Off';
    setNotificationMessage(`Reasoning mode for "${providerName}" set to ${label}.`);
    setTimeout(() => {
      setNotificationMessage(null);
    }, 2500);
  };

  // Save Image Provider
  const handleSaveImageProvider = () => {
    if (!editingImageProvider) return;
    setFormError(null);

    if (!editingImageProvider.name.trim()) {
      setFormError('Please enter a Provider Name');
      return;
    }

    const isSdk = editingImageProvider.requestType === 'sdk';
    if (!isSdk && !editingImageProvider.url.trim()) {
      setFormError('Please enter an API URL');
      return;
    }

    if (!isSdk && editingImageProvider.url.includes('YOUR_ACCOUNT_ID')) {
      setFormError("Please replace 'YOUR_ACCOUNT_ID' in the API URL with your actual Cloudflare Account ID.");
      return;
    }

    const cleanedKeys = editingImageProvider.keys
      .filter((k) => k.key.trim().length > 0)
      .map((k, idx) => ({
        ...k,
        label: k.label?.trim() || `API Key ${idx + 1}`,
        key: k.key.trim(),
      }));

    const finalKeys: AIKeyItem[] = isSdk
      ? []
      : cleanedKeys.length > 0
        ? cleanedKeys
        : [
            {
              id: `img_key_${Date.now()}`,
              key: '',
              label: 'API Key 1',
              status: 'untested',
            },
          ];

    const finalProvider: ImageProviderConfig = {
      ...editingImageProvider,
      name: editingImageProvider.name.trim(),
      url: isSdk
        ? (editingImageProvider.url?.trim() || 'https://js.puter.com/v2/')
        : editingImageProvider.url.trim(),
      model: isSdk
        ? (editingImageProvider.model || DEFAULT_PUTER_MODEL)
        : (editingImageProvider.model?.trim() || undefined),
      requestType: editingImageProvider.requestType || 'get',
      customHeaderName: editingImageProvider.customHeaderName?.trim() || undefined,
      requestBodyTemplate: editingImageProvider.requestBodyTemplate?.trim() || undefined,
      keys: finalKeys,
    };

    const currentStoredImage = storage.getImageProvidersState();
    const existingIndex = currentStoredImage.providers.findIndex(
      (p) => p.id === finalProvider.id
    );
    let updatedList: ImageProviderConfig[];

    if (existingIndex >= 0) {
      updatedList = currentStoredImage.providers.map((p) =>
        p.id === finalProvider.id ? finalProvider : p
      );
    } else {
      updatedList = [...currentStoredImage.providers, finalProvider];
    }

    const newState: ImageProvidersState = {
      activeProviderId: currentStoredImage.activeProviderId || imageProvidersState.activeProviderId || finalProvider.id,
      providers: updatedList,
    };

    updateImageProvidersState(newState);
    setIsEditing(false);
    setEditingImageProvider(null);
    setFormError(null);
    setNotificationMessage(`Image Provider "${finalProvider.name}" saved.`);
    setTimeout(() => {
      setNotificationMessage(null);
    }, 3000);
  };

  // Save Voice Provider
  const handleSaveVoiceProvider = () => {
    if (!editingVoiceProvider) return;
    setFormError(null);

    if (!editingVoiceProvider.name.trim()) {
      setFormError('Please enter a Provider Name');
      return;
    }
    if (!editingVoiceProvider.url.trim()) {
      setFormError('Please enter an API URL');
      return;
    }

    const cleanedKeys = editingVoiceProvider.keys
      .filter((k) => k.key.trim().length > 0)
      .map((k, idx) => ({
        ...k,
        label: k.label?.trim() || `API Key ${idx + 1}`,
        key: k.key.trim(),
      }));

    const finalKeys: AIKeyItem[] =
      cleanedKeys.length > 0
        ? cleanedKeys
        : [
            {
              id: `voice_key_${Date.now()}`,
              key: '',
              label: 'API Key 1',
              status: 'untested',
            },
          ];

    const finalProvider: VoiceProviderConfig = {
      ...editingVoiceProvider,
      name: editingVoiceProvider.name.trim(),
      url: editingVoiceProvider.url.trim(),
      voicesUrl: editingVoiceProvider.voicesUrl?.trim() || undefined,
      model: editingVoiceProvider.model?.trim() || undefined,
      voiceId: editingVoiceProvider.voiceId?.trim() || undefined,
      requestType: editingVoiceProvider.requestType || 'post',
      customHeaderName: editingVoiceProvider.customHeaderName?.trim() || undefined,
      requestBodyTemplate: editingVoiceProvider.requestBodyTemplate?.trim() || undefined,
      keys: finalKeys,
    };

    const currentStoredVoice = storage.getVoiceProvidersState();
    const existingIndex = currentStoredVoice.providers.findIndex(
      (p) => p.id === finalProvider.id
    );
    let updatedList: VoiceProviderConfig[];

    if (existingIndex >= 0) {
      updatedList = currentStoredVoice.providers.map((p) =>
        p.id === finalProvider.id ? finalProvider : p
      );
    } else {
      updatedList = [...currentStoredVoice.providers, finalProvider];
    }

    const newState: VoiceProvidersState = {
      activeProviderId: currentStoredVoice.activeProviderId || voiceProvidersState.activeProviderId || finalProvider.id,
      providers: updatedList,
    };

    updateVoiceProvidersState(newState);
    setIsEditing(false);
    setEditingVoiceProvider(null);
    setFormError(null);
    setNotificationMessage(`Voice Provider "${finalProvider.name}" saved.`);
    setTimeout(() => {
      setNotificationMessage(null);
    }, 3000);
  };

  // Unified Save handler based on active providerType
  const handleSave = () => {
    if (providerType === 'text') {
      handleSaveTextProvider();
    } else if (providerType === 'image') {
      handleSaveImageProvider();
    } else {
      handleSaveVoiceProvider();
    }
  };

  // Switch Provider Type within form
  const handleSwitchType = (newType: AIProviderType) => {
    setProviderType(newType);
    setFormError(null);
    if (newType === 'text') {
      if (!editingProvider) {
        const sourceKeys = editingImageProvider?.keys || editingVoiceProvider?.keys || [];
        setEditingProvider({
          id: (editingImageProvider?.id || editingVoiceProvider?.id || '').startsWith('img_') || (editingImageProvider?.id || editingVoiceProvider?.id || '').startsWith('voice_')
            ? (editingImageProvider?.id || editingVoiceProvider?.id || '').replace(/^img_|^voice_/, 'provider_')
            : `provider_${Date.now()}`,
          name: editingImageProvider?.name || editingVoiceProvider?.name || '',
          url: 'https://openrouter.ai/api/v1/chat/completions',
          model: 'deepseek/deepseek-chat',
          maxTokens: 128,
          keyStrategy: editingImageProvider?.keyStrategy || editingVoiceProvider?.keyStrategy || 'failover',
          keys:
            sourceKeys.length > 0
              ? sourceKeys
              : [
                  {
                    id: `key_${Date.now()}_1`,
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
      }
    } else if (newType === 'image') {
      if (!editingImageProvider) {
        const sourceKeys = editingProvider?.keys || editingVoiceProvider?.keys || [];
        setEditingImageProvider({
          id: (editingProvider?.id || editingVoiceProvider?.id || '').startsWith('provider_') || (editingProvider?.id || editingVoiceProvider?.id || '').startsWith('voice_')
            ? (editingProvider?.id || editingVoiceProvider?.id || '').replace(/^provider_|^voice_/, 'img_provider_')
            : `img_provider_${Date.now()}`,
          name: editingProvider?.name || editingVoiceProvider?.name || '',
          url: 'https://image.pollinations.ai/prompt/',
          requestType: 'get',
          keyStrategy: editingProvider?.keyStrategy || editingVoiceProvider?.keyStrategy || 'failover',
          keys:
            sourceKeys.length > 0
              ? sourceKeys
              : [
                  {
                    id: `img_key_${Date.now()}_1`,
                    key: '',
                    label: 'API Key 1',
                    status: 'untested',
                  },
                ],
        });
      }
    } else {
      if (!editingVoiceProvider) {
        const sourceKeys = editingProvider?.keys || editingImageProvider?.keys || [];
        setEditingVoiceProvider({
          id: (editingProvider?.id || editingImageProvider?.id || '').startsWith('provider_') || (editingProvider?.id || editingImageProvider?.id || '').startsWith('img_')
            ? (editingProvider?.id || editingImageProvider?.id || '').replace(/^provider_|^img_provider_|^img_/, 'voice_provider_')
            : `voice_provider_${Date.now()}`,
          name: editingProvider?.name || editingImageProvider?.name || '',
          url: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
          voicesUrl: 'https://api.elevenlabs.io/v1/voices',
          model: 'eleven_multilingual_v2',
          voiceId: 'EXAVITQu4vr4xnSDxMaL',
          requestType: 'post',
          customHeaderName: 'xi-api-key',
          requestBodyTemplate: '{\n  "text": "{text}",\n  "model_id": "eleven_multilingual_v2"\n}',
          keyStrategy: editingProvider?.keyStrategy || editingImageProvider?.keyStrategy || 'failover',
          keys:
            sourceKeys.length > 0
              ? sourceKeys
              : [
                  {
                    id: `voice_key_${Date.now()}_1`,
                    key: '',
                    label: 'ElevenLabs API Key 1',
                    status: 'untested',
                  },
                ],
        });
      }
    }
  };

  // Initiate Delete provider flow
  const handleDeleteProvider = (id: string, name: string, type: AIProviderType = 'text') => {
    if (id === 'existing') return;
    setDeletingProvider({ id, name, type });
  };

  // Confirm provider deletion
  const confirmDeleteProvider = () => {
    if (!deletingProvider || deletingProvider.id === 'existing') {
      setDeletingProvider(null);
      return;
    }

    const { id: targetId, type } = deletingProvider;

    if (type === 'text') {
      const filtered = providersState.providers.filter((p) => p.id !== targetId);
      const newActive =
        providersState.activeProviderId === targetId ? 'existing' : providersState.activeProviderId;

      const newState: AIProvidersState = {
        activeProviderId: newActive,
        providers: filtered,
      };

      updateProvidersState(newState);
    } else if (type === 'image') {
      const filtered = imageProvidersState.providers.filter((p) => p.id !== targetId);
      const newActive =
        imageProvidersState.activeProviderId === targetId
          ? filtered[0]?.id || ''
          : imageProvidersState.activeProviderId;

      const newState: ImageProvidersState = {
        activeProviderId: newActive,
        providers: filtered,
      };

      updateImageProvidersState(newState);
    } else {
      const filtered = voiceProvidersState.providers.filter((p) => p.id !== targetId);
      const newActive =
        voiceProvidersState.activeProviderId === targetId
          ? filtered[0]?.id || ''
          : voiceProvidersState.activeProviderId;

      const newState: VoiceProvidersState = {
        activeProviderId: newActive,
        providers: filtered,
      };

      updateVoiceProvidersState(newState);
    }

    setDeletingProvider(null);

    // If editing this provider, close editor
    if (
      (type === 'text' && editingProvider && editingProvider.id === targetId) ||
      (type === 'image' && editingImageProvider && editingImageProvider.id === targetId) ||
      (type === 'voice' && editingVoiceProvider && editingVoiceProvider.id === targetId)
    ) {
      setIsEditing(false);
      setEditingProvider(null);
      setEditingImageProvider(null);
      setEditingVoiceProvider(null);
      setFormError(null);
    }

    setNotificationMessage(
      type === 'text'
        ? 'AI text provider deleted.'
        : type === 'image'
        ? 'Image AI provider deleted.'
        : 'Voice AI provider deleted.'
    );
    setTimeout(() => {
      setNotificationMessage(null);
    }, 3500);
  };

  // Switch active text provider
  const handleSelectActiveText = (id: string) => {
    updateProvidersState({
      ...providersState,
      activeProviderId: id,
    });
  };

  // Switch active image provider
  const handleSelectActiveImage = (id: string) => {
    updateImageProvidersState({
      ...imageProvidersState,
      activeProviderId: id,
    });
  };

  // Switch active voice provider
  const handleSelectActiveVoice = (id: string) => {
    updateVoiceProvidersState({
      ...voiceProvidersState,
      activeProviderId: id,
    });
  };

  // Add key to currently editing provider
  const handleAddKeyToEditing = () => {
    if (providerType === 'text') {
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
    } else if (providerType === 'image') {
      if (!editingImageProvider) return;
      const newKeyId = `img_key_${Date.now()}_${editingImageProvider.keys.length + 1}`;
      const isPixazo =
        editingImageProvider.name.toLowerCase().includes('pixazo') ||
        editingImageProvider.url.toLowerCase().includes('pixazo') ||
        editingImageProvider.customHeaderName?.includes('Ocp-Apim');
      const isCloudflare =
        editingImageProvider.name.toLowerCase().includes('cloudflare') ||
        editingImageProvider.url.toLowerCase().includes('cloudflare');
      const labelPrefix = isPixazo
        ? 'Pixazo API Key'
        : isCloudflare
        ? 'Cloudflare API Token'
        : 'API Key';

      setEditingImageProvider({
        ...editingImageProvider,
        keys: [
          ...editingImageProvider.keys,
          {
            id: newKeyId,
            key: '',
            label: `${labelPrefix} ${editingImageProvider.keys.length + 1}`,
            status: 'untested',
          },
        ],
      });
    } else {
      if (!editingVoiceProvider) return;
      const newKeyId = `voice_key_${Date.now()}_${editingVoiceProvider.keys.length + 1}`;
      const isElevenLabs =
        editingVoiceProvider.name.toLowerCase().includes('eleven') ||
        editingVoiceProvider.url.toLowerCase().includes('elevenlabs');
      const labelPrefix = isElevenLabs ? 'ElevenLabs API Key' : 'API Key';

      setEditingVoiceProvider({
        ...editingVoiceProvider,
        keys: [
          ...editingVoiceProvider.keys,
          {
            id: newKeyId,
            key: '',
            label: `${labelPrefix} ${editingVoiceProvider.keys.length + 1}`,
            status: 'untested',
          },
        ],
      });
    }
  };

  // Remove key from editing provider
  const handleRemoveKeyFromEditing = (keyId: string) => {
    if (providerType === 'text') {
      if (!editingProvider) return;
      if (editingProvider.keys.length <= 1) {
        alert('A provider must have at least one API Key slot.');
        return;
      }
      const filtered = editingProvider.keys.filter((k) => k.id !== keyId);
      setEditingProvider({
        ...editingProvider,
        keys: filtered,
        preferredKeyId:
          editingProvider.preferredKeyId === keyId ? undefined : editingProvider.preferredKeyId,
      });
    } else if (providerType === 'image') {
      if (!editingImageProvider) return;
      if (editingImageProvider.keys.length <= 1) {
        alert('A provider must have at least one API Key slot.');
        return;
      }
      const filtered = editingImageProvider.keys.filter((k) => k.id !== keyId);
      setEditingImageProvider({
        ...editingImageProvider,
        keys: filtered,
        preferredKeyId:
          editingImageProvider.preferredKeyId === keyId
            ? undefined
            : editingImageProvider.preferredKeyId,
      });
    } else {
      if (!editingVoiceProvider) return;
      if (editingVoiceProvider.keys.length <= 1) {
        alert('A provider must have at least one API Key slot.');
        return;
      }
      const filtered = editingVoiceProvider.keys.filter((k) => k.id !== keyId);
      setEditingVoiceProvider({
        ...editingVoiceProvider,
        keys: filtered,
        preferredKeyId:
          editingVoiceProvider.preferredKeyId === keyId
            ? undefined
            : editingVoiceProvider.preferredKeyId,
      });
    }
  };

  // Test individual voice key
  const handleTestVoiceKey = async (
    keyItem: AIKeyItem,
    url: string,
    providerConfig: VoiceProviderConfig
  ) => {
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
      [keyItem.id]: { ok: false, message: 'Testing voice connection & key...' },
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const testUrl = providerConfig.voicesUrl?.trim() || 'https://api.elevenlabs.io/v1/voices';
      const testHeaders = buildVoiceRequestHeaders(providerConfig, keyItem.key.trim());

      const resp = await fetch(testUrl, {
        method: 'GET',
        headers: testHeaders,
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: true, message: '✓ Voice key verified & active' },
        }));
        if (editingVoiceProvider) {
          setEditingVoiceProvider({
            ...editingVoiceProvider,
            keys: editingVoiceProvider.keys.map((k) =>
              k.id === keyItem.id
                ? { ...k, status: 'healthy', lastTested: Date.now(), lastError: undefined }
                : k
            ),
          });
        }
      } else {
        const errorMsg = `HTTP ${resp.status}: ${resp.statusText || 'Error'}`;
        const statusType: KeyHealthStatus = resp.status === 429 ? 'cooldown' : 'invalid';
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: false, message: `✕ ${errorMsg}` },
        }));
        if (editingVoiceProvider) {
          setEditingVoiceProvider({
            ...editingVoiceProvider,
            keys: editingVoiceProvider.keys.map((k) =>
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
      const isTimeout = msg.includes('aborted') || msg.includes('Timeout');
      setKeyTestResults((prev) => ({
        ...prev,
        [keyItem.id]: {
          ok: false,
          message: isTimeout ? '✕ Request timed out' : `✕ Connection failed: ${msg}`,
        },
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test full voice provider
  const handleTestVoiceProvider = async (provider: VoiceProviderConfig) => {
    setTestingProviderId(provider.id);
    setProviderTestResults((prev) => ({
      ...prev,
      [provider.id]: { ok: false, message: 'Testing voice provider connection...' },
    }));

    try {
      const validKeys = provider.keys.filter((k) => k.key.trim().length > 0);
      const keyToTest = validKeys[0]?.key.trim();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const testUrl = provider.voicesUrl?.trim() || 'https://api.elevenlabs.io/v1/voices';
      const testHeaders = buildVoiceRequestHeaders(provider, keyToTest);

      const resp = await fetch(testUrl, {
        method: 'GET',
        headers: testHeaders,
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        setProviderTestResults((prev) => ({
          ...prev,
          [provider.id]: { ok: true, message: '✓ Voice provider connected & verified' },
        }));
        if (validKeys.length > 0) {
          storage.updateVoiceKeyHealth(provider.id, validKeys[0].id, 'healthy');
        }
      } else {
        const errorText = `HTTP ${resp.status}: ${resp.statusText || 'Error'}`;
        setProviderTestResults((prev) => ({
          ...prev,
          [provider.id]: { ok: false, message: `✕ Test failed: ${errorText}` },
        }));
        if (validKeys.length > 0) {
          storage.updateVoiceKeyHealth(
            provider.id,
            validKeys[0].id,
            resp.status === 429 ? 'cooldown' : 'invalid',
            errorText
          );
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setProviderTestResults((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: `✕ Test failed: ${errorMsg}` },
      }));
      const validKeys = provider.keys.filter((k) => k.key.trim().length > 0);
      if (validKeys.length > 0) {
        storage.updateVoiceKeyHealth(provider.id, validKeys[0].id, 'invalid', errorMsg);
      }
    } finally {
      setTestingProviderId(null);
      setVoiceProvidersState(storage.getVoiceProvidersState());
    }
  };

  // Test individual text key
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
        const successMessage = res.note
          ? `✓ ${res.note}`
          : `✓ Connection successful (${res.model || model})`;
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: true, message: successMessage },
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
        const isGoogle = url.includes('google') || url.includes('generativelanguage') || model.toLowerCase().includes('gemini');
        let errorMsg = res.error || `HTTP ${res.status || 'Error'}`;
        if (isGoogle && res.status === 503) {
          errorMsg = `HTTP 503: High demand on "${model}". Switch to "gemini-3.6-flash".`;
        } else if (isGoogle && res.status === 404) {
          errorMsg = `HTTP 404: Model "${model}" not found or deprecated. Switch to "gemini-3.6-flash".`;
        }
        const isAuth = res.status === 401 || res.status === 403;
        const statusType: KeyHealthStatus = isAuth ? 'invalid' : 'cooldown';
        const cooldownMs = 60000; // 60s cooldown (1 minute)
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
                    cooldownUntil: statusType === 'cooldown' ? Date.now() + cooldownMs : undefined,
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

  // Test individual image key
  const handleTestImageKey = async (keyItem: AIKeyItem, url: string) => {
    setTestingKeyId(keyItem.id);
    setKeyTestResults((prev) => ({
      ...prev,
      [keyItem.id]: { ok: false, message: 'Verifying endpoint & key...' },
    }));

    try {
      const isPost =
        editingImageProvider?.requestType === 'post' ||
        url.toLowerCase().includes('huggingface') ||
        url.toLowerCase().includes('hf-inference');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let resp: Response;
      if (isPost) {
        const testHeaders = editingImageProvider
          ? buildImageRequestHeaders(editingImageProvider, keyItem.key.trim())
          : {
              'Content-Type': 'application/json',
              ...(keyItem.key.trim() ? { Authorization: `Bearer ${keyItem.key.trim()}` } : {}),
            };
        const testBody = editingImageProvider?.requestBodyTemplate
          ? buildImageRequestBody(editingImageProvider.requestBodyTemplate, 'A simple geometric icon test', 1024, 1024)
          : { inputs: 'A simple geometric icon test', prompt: 'A simple geometric icon test' };

        resp = await fetch(url.trim(), {
          method: 'POST',
          headers: testHeaders,
          body: JSON.stringify(testBody),
          signal: controller.signal,
          mode: 'cors',
        });
      } else {
        const base = url.trim().replace(/\/+$/, '');
        const testUrl = `${base}/${encodeURIComponent('ping_test')}${
          keyItem.key.trim()
            ? `?key=${encodeURIComponent(keyItem.key.trim())}&width=64&height=64&nologo=true`
            : '?width=64&height=64&nologo=true'
        }`;
        resp = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
        });
      }
      clearTimeout(timeoutId);

      // Status 200 or 503 (HF model loading means credentials are valid)
      if (resp.ok || resp.status === 503 || (resp.status >= 200 && resp.status < 400)) {
        const msg = resp.status === 503
          ? '✓ Key valid (Model currently loading on HF)'
          : '✓ Key valid & endpoint responded';
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: true, message: msg },
        }));
        if (editingImageProvider) {
          setEditingImageProvider({
            ...editingImageProvider,
            keys: editingImageProvider.keys.map((k) =>
              k.id === keyItem.id
                ? { ...k, status: 'healthy', lastTested: Date.now(), lastError: undefined }
                : k
            ),
          });
        }
      } else {
        const errorMsg = `HTTP ${resp.status}: ${resp.statusText || 'Error'}`;
        const statusType: KeyHealthStatus = resp.status === 429 ? 'cooldown' : 'invalid';
        setKeyTestResults((prev) => ({
          ...prev,
          [keyItem.id]: { ok: false, message: `✕ ${errorMsg}` },
        }));
        if (editingImageProvider) {
          setEditingImageProvider({
            ...editingImageProvider,
            keys: editingImageProvider.keys.map((k) =>
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
      const isTimeout = msg.includes('aborted') || msg.includes('Timeout');
      setKeyTestResults((prev) => ({
        ...prev,
        [keyItem.id]: {
          ok: false,
          message: isTimeout ? '✕ Request timed out' : `✕ Connection failed: ${msg}`,
        },
      }));
    } finally {
      setTestingKeyId(null);
    }
  };

  // Test full text provider connection
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

  // Test full image provider connection
  const handleTestImageProvider = async (provider: ImageProviderConfig) => {
    setTestingProviderId(provider.id);
    setProviderTestResults((prev) => ({
      ...prev,
      [provider.id]: { ok: false, message: 'Testing image endpoint...' },
    }));

    if (provider.requestType === 'sdk') {
      try {
        const puter = await loadPuterScript(15000);
        const debug = getPuterDebugInfo();
        setPuterDebugInfo(debug);
        if (puter?.ai?.txt2img) {
          setProviderTestResults((prev) => ({
            ...prev,
            [provider.id]: { ok: true, message: `✓ Puter.js SDK ready (${provider.model || 'SD3 Medium'})` },
          }));
        } else {
          throw new Error('Puter SDK loaded but txt2img is unavailable');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const debug = getPuterDebugInfo();
        setPuterDebugInfo(debug);
        console.error('[AIProvidersSettings: Test Puter SDK] Error:', errorMsg);
        setProviderTestResults((prev) => ({
          ...prev,
          [provider.id]: {
            ok: false,
            message: errorMsg.includes('not respond in time')
              ? `✕ ${PUTER_TIMEOUT_ERROR_MESSAGE}`
              : `✕ SDK Error: ${errorMsg}`,
          },
        }));
      } finally {
        setTestingProviderId(null);
        setImageProvidersState(storage.getImageProvidersState());
      }
      return;
    }

    if (provider.url.includes('YOUR_ACCOUNT_ID')) {
      setProviderTestResults((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: "✕ Please replace 'YOUR_ACCOUNT_ID' in the API URL with your actual Cloudflare Account ID." },
      }));
      setTestingProviderId(null);
      return;
    }

    const validKeys = provider.keys.filter((k) => k.key && k.key.trim().length > 0);
    const keyToTest = validKeys.length > 0 ? validKeys[0].key.trim() : '';

    try {
      const isCloudflare =
        provider.url.toLowerCase().includes('cloudflare') ||
        provider.name.toLowerCase().includes('cloudflare');
      const isPost =
        provider.requestType === 'post' ||
        isCloudflare ||
        provider.url.toLowerCase().includes('huggingface') ||
        provider.url.toLowerCase().includes('hf-inference');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let resp: Response;
      if (isPost) {
        const testTargetUrl = isCloudflare ? '/api/proxy/cloudflare-image' : provider.url.trim();
        const testPayload = isCloudflare
          ? {
              prompt: 'A simple geometric test icon',
              url: provider.url.trim(),
              model: provider.model,
              apiKey: keyToTest,
              apiToken: keyToTest,
            }
          : provider.requestBodyTemplate
          ? buildImageRequestBody(provider.requestBodyTemplate, 'A simple geometric test icon', 1024, 1024)
          : { inputs: 'A simple geometric icon test', prompt: 'A simple geometric test icon' };

        const testHeaders = buildImageRequestHeaders(provider, keyToTest);

        resp = await fetch(testTargetUrl, {
          method: 'POST',
          headers: testHeaders,
          body: JSON.stringify(testPayload),
          signal: controller.signal,
          mode: 'cors',
        });
      } else {
        const base = provider.url.trim().replace(/\/+$/, '');
        const testUrl = `${base}/${encodeURIComponent('ping_test')}${
          keyToTest
            ? `?key=${encodeURIComponent(keyToTest)}&width=64&height=64&nologo=true`
            : '?width=64&height=64&nologo=true'
        }`;
        resp = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
        });
      }
      clearTimeout(timeoutId);

      if (resp.ok || resp.status === 503 || (resp.status >= 200 && resp.status < 400)) {
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        let successMsg = resp.status === 503
          ? '✓ Endpoint reachable (Model currently loading on HF)'
          : '✓ Image endpoint verified and responsive';

        if (contentType.includes('application/json')) {
          try {
            const json = await resp.clone().json();
            if (json?.success === false || (Array.isArray(json?.errors) && json.errors.length > 0)) {
              const errDetail = json.errors?.[0]?.message || json.errors?.[0] || json.error || 'API returned error';
              throw new Error(String(errDetail));
            }
            if (json?.output) {
              successMsg = '✓ Pixazo AI verified (image URL returned)';
            } else if (json?.result?.image) {
              successMsg = '✓ Cloudflare Workers AI verified (image base64 returned)';
            } else if (extractImageUrlFromJson(json)) {
              successMsg = '✓ Image endpoint verified (image returned)';
            }
          } catch (jsonErr) {
            if (jsonErr instanceof Error && !jsonErr.message.includes('JSON')) {
              throw jsonErr;
            }
          }
        }

        setProviderTestResults((prev) => ({
          ...prev,
          [provider.id]: { ok: true, message: successMsg },
        }));
        if (validKeys.length > 0) {
          storage.updateImageKeyHealth(provider.id, validKeys[0].id, 'healthy');
        }
      } else {
        let errDetail = '';
        try {
          const errJson = await resp.json();
          errDetail = (Array.isArray(errJson?.errors) && errJson.errors[0]?.message) || errJson?.error || errJson?.message || '';
        } catch {
          // ignore
        }
        const errorText = errDetail ? `HTTP ${resp.status}: ${errDetail}` : `HTTP ${resp.status}: ${resp.statusText || 'Error'}`;
        setProviderTestResults((prev) => ({
          ...prev,
          [provider.id]: { ok: false, message: `✕ Test failed: ${errorText}` },
        }));
        if (validKeys.length > 0) {
          storage.updateImageKeyHealth(
            provider.id,
            validKeys[0].id,
            resp.status === 429 ? 'cooldown' : 'invalid',
            errorText
          );
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setProviderTestResults((prev) => ({
        ...prev,
        [provider.id]: { ok: false, message: `✕ Test failed: ${errorMsg}` },
      }));
      if (validKeys.length > 0) {
        storage.updateImageKeyHealth(provider.id, validKeys[0].id, 'invalid', errorMsg);
      }
    } finally {
      setTestingProviderId(null);
      setImageProvidersState(storage.getImageProvidersState());
    }
  };

  // Helper variables for editing active provider
  const currentEditingKeys =
    providerType === 'text'
      ? editingProvider?.keys || []
      : providerType === 'image'
      ? editingImageProvider?.keys || []
      : editingVoiceProvider?.keys || [];

  const currentStrategy =
    providerType === 'text'
      ? editingProvider?.keyStrategy || 'failover'
      : providerType === 'image'
      ? editingImageProvider?.keyStrategy || 'failover'
      : editingVoiceProvider?.keyStrategy || 'failover';

  const currentPreferredKeyId =
    providerType === 'text'
      ? editingProvider?.preferredKeyId
      : providerType === 'image'
      ? editingImageProvider?.preferredKeyId
      : editingVoiceProvider?.preferredKeyId;

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
              border: 0,
              color: '#34d399',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: Active Text AI Provider Overview */}
      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,28,48,0.7) 100%)',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Active Chat AI Provider</h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Selected provider handles multi-turn chat, JARVIS sub-agents, and knowledge synthesis.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            id="active-ai-provider-select"
            value={providersState.activeProviderId}
            onChange={(e) => handleSelectActiveText(e.target.value)}
            style={{
              background: 'rgba(10,22,28,0.85)',
              color: '#fff',
              border: '1px solid var(--line)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              minWidth: '220px',
            }}
          >
            <option value="existing">🧠 Existing AI (Built-in DeepSeek / Default)</option>
            {providersState.providers.map((p) => (
              <option key={p.id} value={p.id}>
                🔵 {p.name} ({p.model})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SECTION 2: Text AI Providers List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={17} style={{ color: 'var(--accent)' }} /> Text AI Providers
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              LLM endpoints for conversational AI, agentic reasoning, and tools.
            </p>
          </div>

          {!isEditing && (
            <button
              onClick={() => handleAddNew('text')}
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <Plus size={15} /> Add Text Provider
            </button>
          )}
        </div>

        {/* Text Provider Cards */}
        <div style={{ display: 'grid', gap: '12px' }}>
          {/* Default Built-in Card */}
          <div
            style={{
              padding: '18px 20px',
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
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Existing AI</h4>
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
                  margin: '4px 0 0',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                Model: Built-in DeepSeek / OpenRouter Fallback
              </p>
            </div>

            <div>
              {providersState.activeProviderId === 'existing' ? (
                <button
                  disabled
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
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
                  onClick={() => handleSelectActiveText('existing')}
                  className="secondary-button"
                  style={{
                    padding: '7px 14px',
                    borderRadius: '7px',
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

          {/* Configured Text Providers Cards */}
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
                  padding: '18px 20px',
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
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{p.name}</h4>
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

                    {/* Reasoning Mode Override 3-State Control */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(10, 22, 28, 0.75)',
                        border: '1px solid rgba(165, 207, 214, 0.22)',
                        borderRadius: '16px',
                        padding: '1px 2px',
                        gap: '2px',
                      }}
                      title={`Reasoning Control: ${
                        (p.reasoningOverride || 'auto') === 'auto'
                          ? 'Auto (uses role-based logic: fast roles off, Coder/Architect/Data Analyst on)'
                          : p.reasoningOverride === 'force_on'
                          ? 'Forced On (always sends high reasoning effort parameters)'
                          : 'Forced Off (always sends disabled reasoning parameters)'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateProviderReasoningOverride(p.id, 'auto');
                        }}
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: (p.reasoningOverride || 'auto') === 'auto' ? 700 : 500,
                          background:
                            (p.reasoningOverride || 'auto') === 'auto'
                              ? 'rgba(97,215,201,0.25)'
                              : 'transparent',
                          color:
                            (p.reasoningOverride || 'auto') === 'auto'
                              ? 'var(--accent)'
                              : 'var(--muted)',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        🧠 Auto
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateProviderReasoningOverride(p.id, 'force_on');
                        }}
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: p.reasoningOverride === 'force_on' ? 700 : 500,
                          background:
                            p.reasoningOverride === 'force_on'
                              ? 'rgba(52,211,153,0.3)'
                              : 'transparent',
                          color:
                            p.reasoningOverride === 'force_on'
                              ? '#34d399'
                              : 'var(--muted)',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        {p.reasoningOverride === 'force_on' ? '🧠 Forced On' : 'Force On'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateProviderReasoningOverride(p.id, 'force_off');
                        }}
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: p.reasoningOverride === 'force_off' ? 700 : 500,
                          background:
                            p.reasoningOverride === 'force_off'
                              ? 'rgba(239,68,68,0.25)'
                              : 'transparent',
                          color:
                            p.reasoningOverride === 'force_off'
                              ? '#f87171'
                              : 'var(--muted)',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        {p.reasoningOverride === 'force_off' ? '🧠 Forced Off' : 'Force Off'}
                      </button>
                    </div>
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
                      margin: '4px 0 0',
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
                      marginTop: '6px',
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
                        marginTop: '6px',
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
                        padding: '7px 12px',
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
                      onClick={() => handleSelectActiveText(p.id)}
                      className="secondary-button"
                      style={{
                        padding: '7px 12px',
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
                      padding: '7px 11px',
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
                      padding: '7px 11px',
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
                    onClick={() => handleDeleteProvider(p.id, p.name, 'text')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      background: 'rgba(237,139,139,0.1)',
                      border: '1px solid rgba(237,139,139,0.3)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    title="Delete provider"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Image AI Providers Section */}
      <div style={{ display: 'grid', gap: '16px', marginTop: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={17} style={{ color: '#ec4899' }} /> Image AI Providers
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Generative image endpoints (Pollinations, SD, Flux, etc.) with automatic key failover for Image Studio.
            </p>
          </div>

          {!isEditing && (
            <button
              onClick={() => handleAddNew('image')}
              className="secondary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                borderColor: 'rgba(236,72,153,0.3)',
                color: '#f472b6',
              }}
            >
              <Plus size={15} /> Add Image Provider
            </button>
          )}
        </div>

        {/* Image Provider Cards */}
        <div style={{ display: 'grid', gap: '12px' }}>
          {imageProvidersState.providers.map((p) => {
            const isActive = imageProvidersState.activeProviderId === p.id;
            const healthyKeys = p.keys.filter((k) => k.status === 'healthy').length;
            const cooldownKeys = p.keys.filter((k) => k.status === 'cooldown').length;
            const invalidKeys = p.keys.filter((k) => k.status === 'invalid').length;
            const testResult = providerTestResults[p.id];

            return (
              <div
                key={p.id}
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  border: `1px solid ${
                    isActive ? 'rgba(236,72,153,0.8)' : 'rgba(165,207,214,0.18)'
                  }`,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(38,14,32,0.7) 0%, rgba(20,24,48,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(14,31,39,0.55) 0%, rgba(18,22,40,0.55) 100%)',
                  boxShadow: isActive ? '0 0 16px rgba(236,72,153,0.18)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🎨</span>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{p.name}</h4>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background:
                          p.requestType === 'sdk'
                            ? 'rgba(56,189,248,0.18)'
                            : p.requestType === 'post'
                            ? 'rgba(168,85,247,0.18)'
                            : 'rgba(236,72,153,0.15)',
                        color:
                          p.requestType === 'sdk'
                            ? '#38bdf8'
                            : p.requestType === 'post'
                            ? '#c084fc'
                            : '#f472b6',
                        fontWeight: 600,
                      }}
                    >
                      {p.requestType === 'sdk'
                        ? 'JS SDK / Puter'
                        : p.requestType === 'post'
                        ? 'POST / JSON'
                        : 'GET / URL'}
                    </span>
                    {p.requestType === 'sdk' ? (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(56,189,248,0.15)',
                          color: '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        Free Guest Sessions (No Key)
                      </span>
                    ) : (
                      <>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'rgba(236,72,153,0.15)',
                            color: '#f472b6',
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
                      </>
                    )}
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
                        Active Image Provider
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {p.requestType === 'sdk' ? (
                      <>
                        Model: <span style={{ color: '#38bdf8' }}>{p.model || DEFAULT_PUTER_MODEL}</span>
                      </>
                    ) : (
                      <>
                        Base URL: <span style={{ color: '#fff' }}>{p.url}</span>
                      </>
                    )}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '6px',
                      fontSize: '11px',
                    }}
                  >
                    {p.requestType === 'sdk' ? (
                      <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚡ Free Unlimited Client-Side SDK
                      </span>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  {testResult && (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '11px',
                        color: testResult.ok ? '#34d399' : '#f87171',
                        fontWeight: 500,
                      }}
                    >
                      {testResult.message}
                    </div>
                  )}

                  {/* Collapsible Puter Debug Info */}
                  {p.requestType === 'sdk' && puterDebugInfo && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(15,23,42,0.7)',
                        border: '1px solid rgba(56,189,248,0.25)',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#94a3b8',
                      }}
                    >
                      <div
                        onClick={() => setShowPuterDebug(!showPuterDebug)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none',
                          color: '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        <span>🔍 Puter SDK Debug Info</span>
                        <span style={{ fontSize: '10px' }}>{showPuterDebug ? '▲ Hide' : '▼ Show'}</span>
                      </div>
                      {showPuterDebug && (
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div>
                            • Script Appended: <span style={{ color: puterDebugInfo.scriptAppended ? '#34d399' : '#f87171' }}>{String(puterDebugInfo.scriptAppended)}</span>
                            {puterDebugInfo.scriptAppendedAt && <span style={{ color: '#64748b', marginLeft: '4px' }}>({puterDebugInfo.scriptAppendedAt.split('T')[1]?.slice(0, 8)})</span>}
                          </div>
                          <div>
                            • Onload Fired: <span style={{ color: puterDebugInfo.onloadFired ? '#34d399' : '#f87171' }}>{String(puterDebugInfo.onloadFired)}</span>
                            {puterDebugInfo.onloadFiredAt && <span style={{ color: '#64748b', marginLeft: '4px' }}>({puterDebugInfo.onloadFiredAt.split('T')[1]?.slice(0, 8)})</span>}
                          </div>
                          <div>
                            • Onerror Fired: <span style={{ color: puterDebugInfo.onerrorFired ? '#f87171' : '#34d399' }}>{String(puterDebugInfo.onerrorFired)}</span>
                            {puterDebugInfo.onerrorDetails && <span style={{ color: '#f87171', marginLeft: '4px' }}>({puterDebugInfo.onerrorDetails})</span>}
                          </div>
                          <div>
                            • typeof window.puter: <span style={{ color: '#fff' }}>"{puterDebugInfo.typeofWindowPuter}"</span>
                          </div>
                          <div>
                            • typeof window.puter?.ai: <span style={{ color: '#fff' }}>"{puterDebugInfo.typeofWindowPuterAi}"</span>
                          </div>
                          <div>
                            • typeof window.puter?.ai?.txt2img: <span style={{ color: puterDebugInfo.typeofWindowPuterAiTxt2img === 'function' ? '#34d399' : '#f87171' }}>"{puterDebugInfo.typeofWindowPuterAiTxt2img}"</span>
                          </div>
                          <div>
                            • window.puter Keys: <span style={{ color: '#38bdf8', wordBreak: 'break-all' }}>{JSON.stringify(puterDebugInfo.windowPuterTopLevelKeys)}</span>
                          </div>
                          {puterDebugInfo.error && (
                            <div style={{ color: '#f87171', marginTop: '2px' }}>
                              • Error: {puterDebugInfo.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {isActive ? (
                    <button
                      disabled
                      style={{
                        padding: '7px 12px',
                        borderRadius: '7px',
                        background: 'rgba(236,72,153,0.2)',
                        color: '#f472b6',
                        border: '1px solid #ec4899',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'default',
                      }}
                    >
                      Active
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectActiveImage(p.id)}
                      className="secondary-button"
                      style={{
                        padding: '7px 12px',
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
                    onClick={() => handleTestImageProvider(p)}
                    disabled={testingProviderId === p.id}
                    className="secondary-button"
                    style={{
                      padding: '7px 11px',
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
                    onClick={() => handleEditImageProvider(p)}
                    className="secondary-button"
                    style={{
                      padding: '7px 11px',
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
                    onClick={() => handleDeleteProvider(p.id, p.name, 'image')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      background: 'rgba(237,139,139,0.1)',
                      border: '1px solid rgba(237,139,139,0.3)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    title="Delete image provider"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Voice AI Providers Overview & List */}
      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(28,14,39,0.7) 0%, rgba(20,20,48,0.7) 100%)',
          border: '1px solid rgba(168,85,247,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={18} style={{ color: '#c084fc' }} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Active Voice AI Engine</h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Selected provider powers audio synthesis and realistic speech generation across Voice AI Studio.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            id="active-voice-ai-provider-select"
            value={voiceProvidersState.activeProviderId}
            onChange={(e) => handleSelectActiveVoice(e.target.value)}
            style={{
              background: 'rgba(10,22,28,0.85)',
              color: '#fff',
              border: '1px solid rgba(168,85,247,0.4)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              minWidth: '220px',
            }}
          >
            <option value="edge_tts">🎙️ Microsoft Edge TTS (Built-in / Free)</option>
            {voiceProvidersState.providers.map((p) => (
              <option key={p.id} value={p.id}>
                🟣 {p.name} ({p.model || 'ElevenLabs TTS'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Voice AI Providers List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 size={17} style={{ color: '#c084fc' }} /> Voice AI Providers
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Text-to-Speech (TTS) cloud voice engines (e.g. ElevenLabs) with customizable voice models and multi-key failover pools.
            </p>
          </div>

          <button
            onClick={() => handleAddNew('voice')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: '#c084fc',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Add Voice AI Provider
          </button>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {voiceProvidersState.providers.map((p) => {
            const isActive = voiceProvidersState.activeProviderId === p.id;
            const healthyKeys = p.keys.filter((k) => k.status === 'healthy').length;
            const cooldownKeys = p.keys.filter((k) => k.status === 'cooldown').length;
            const invalidKeys = p.keys.filter((k) => k.status === 'invalid').length;
            const untestedKeys = p.keys.filter((k) => !k.status || k.status === 'untested').length;
            const isTesting = testingProviderId === p.id;
            const testResult = providerTestResults[p.id];

            return (
              <div
                key={p.id}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(168,85,247,0.08)' : 'rgba(10,22,28,0.5)',
                  border: `1px solid ${isActive ? 'rgba(168,85,247,0.5)' : 'var(--line)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'grid', gap: '6px', flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                      {p.name}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(168,85,247,0.2)',
                          color: '#c084fc',
                          border: '1px solid rgba(168,85,247,0.4)',
                          fontWeight: 600,
                        }}
                      >
                        Active Voice Engine
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--muted)',
                      }}
                    >
                      {p.requestType === 'get' ? 'GET / URL' : 'POST / JSON'}
                    </span>
                    {p.customHeaderName && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(168,85,247,0.12)',
                          color: '#d8b4fe',
                          border: '1px solid rgba(168,85,247,0.25)',
                        }}
                      >
                        {p.customHeaderName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span>
                      Model: <code style={{ color: 'var(--text)' }}>{p.model || 'eleven_multilingual_v2'}</code>
                    </span>
                    {p.voiceId && (
                      <span>
                        Default Voice: <code style={{ color: 'var(--text)' }}>{p.voiceId}</code>
                      </span>
                    )}
                    <span>
                      URL: <span style={{ fontFamily: 'DM Mono, monospace' }}>{p.url}</span>
                    </span>
                  </div>

                  {/* Key health badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--muted)' }}>
                      Keys ({p.keys.length}):
                    </span>
                    {healthyKeys > 0 && (
                      <span style={{ color: '#34d399', fontWeight: 600 }}>
                        ● {healthyKeys} healthy
                      </span>
                    )}
                    {cooldownKeys > 0 && (
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                        ● {cooldownKeys} rate-limited
                      </span>
                    )}
                    {invalidKeys > 0 && (
                      <span style={{ color: '#f87171', fontWeight: 600 }}>
                        ● {invalidKeys} invalid
                      </span>
                    )}
                    {untestedKeys > 0 && (
                      <span style={{ color: 'var(--muted)' }}>
                        ● {untestedKeys} untested
                      </span>
                    )}
                    <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>
                      Strategy: <strong style={{ color: 'var(--text)' }}>{p.keyStrategy || 'failover'}</strong>
                    </span>
                  </div>

                  {testResult && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: testResult.ok ? '#34d399' : '#f87171',
                        fontWeight: 500,
                        marginTop: '2px',
                      }}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {!isActive && (
                    <button
                      onClick={() => handleSelectActiveVoice(p.id)}
                      className="secondary-button"
                      style={{
                        padding: '7px 11px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Use as Active
                    </button>
                  )}

                  <button
                    onClick={() => handleTestVoiceProvider(p)}
                    disabled={isTesting}
                    className="secondary-button"
                    style={{
                      padding: '7px 11px',
                      borderRadius: '7px',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCw size={13} className={isTesting ? 'animate-spin' : ''} />
                    {isTesting ? 'Testing' : 'Test'}
                  </button>

                  <button
                    onClick={() => handleEditVoiceProvider(p)}
                    className="secondary-button"
                    style={{
                      padding: '7px 11px',
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
                    onClick={() => handleDeleteProvider(p.id, p.name, 'voice')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      background: 'rgba(237,139,139,0.1)',
                      border: '1px solid rgba(237,139,139,0.3)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    title="Delete voice provider"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Add / Edit AI Provider Modal / Form */}
      {isEditing && (
        <div
          style={{
            marginTop: '10px',
            padding: '24px',
            borderRadius: '14px',
            border: `1px solid ${
              providerType === 'image'
                ? '#ec4899'
                : providerType === 'voice'
                ? '#a855f7'
                : 'var(--accent)'
            }`,
            background: 'linear-gradient(135deg, rgba(12,26,34,0.95) 0%, rgba(18,22,46,0.98) 100%)',
            boxShadow:
              providerType === 'image'
                ? '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(236,72,153,0.2)'
                : providerType === 'voice'
                ? '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(168,85,247,0.2)'
                : '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(97,215,201,0.2)',
            display: 'grid',
            gap: '20px',
          }}
        >
          {/* Header & Provider Type Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--line)',
              paddingBottom: '16px',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>
                {providerType === 'text'
                  ? editingProvider && providersState.providers.some((p) => p.id === editingProvider.id)
                    ? 'Edit Text AI Provider'
                    : 'Add Text AI Provider'
                  : providerType === 'image'
                  ? editingImageProvider && imageProvidersState.providers.some((p) => p.id === editingImageProvider.id)
                    ? 'Edit Image AI Provider'
                    : 'Add Image AI Provider'
                  : editingVoiceProvider && voiceProvidersState.providers.some((p) => p.id === editingVoiceProvider.id)
                  ? 'Edit Voice AI Provider'
                  : 'Add Voice AI Provider'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                {providerType === 'text'
                  ? 'Configure endpoint URL, model, and multiple API keys for automatic failover & rotation.'
                  : providerType === 'image'
                  ? 'Configure base image generation endpoint URL and API keys with automatic failover.'
                  : 'Configure Text-to-Speech endpoint (e.g. ElevenLabs), voices, models, and failover API keys.'}
              </p>
            </div>

            {/* Provider Type Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                Provider Type:
              </span>
              <div className="segmented-control" style={{ display: 'inline-flex' }}>
                <button
                  type="button"
                  className={providerType === 'text' ? 'selected' : ''}
                  onClick={() => handleSwitchType('text')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Layers size={13} /> Text
                </button>
                <button
                  type="button"
                  className={providerType === 'image' ? 'selected' : ''}
                  onClick={() => handleSwitchType('image')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <ImageIcon size={13} /> Image
                </button>
                <button
                  type="button"
                  className={providerType === 'voice' ? 'selected' : ''}
                  onClick={() => handleSwitchType('voice')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Volume2 size={13} /> Voice
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets for Text vs Image */}
          {providerType === 'text' && editingProvider && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'Google Gemini',
                    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                    model: 'gemini-3.6-flash',
                    reasoningOverride: 'auto',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px', borderColor: 'rgba(66, 133, 244, 0.4)', color: '#60a5fa' }}
              >
                ✨ Google Gemini
              </button>
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
                OpenRouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'Mistral AI',
                    url: 'https://api.mistral.ai/v1/chat/completions',
                    model: 'mistral-small-latest',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px' }}
              >
                Mistral Direct
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProvider({
                    ...editingProvider,
                    name: 'Cloudflare Workers AI',
                    url: 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/chat/completions',
                    model: '@cf/meta/llama-3.1-8b-instruct',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px' }}
              >
                Cloudflare Gateway
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
                DeepSeek
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
                Groq
              </button>
            </div>
          )}

          {providerType === 'image' && editingImageProvider && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setEditingImageProvider({
                    ...editingImageProvider,
                    name: 'Pollinations',
                    url: 'https://image.pollinations.ai/prompt/',
                    requestType: 'get',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', borderColor: 'rgba(236,72,153,0.3)', color: '#f472b6' }}
              >
                🎨 Pollinations AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageProvider({
                    ...editingImageProvider,
                    name: 'Hugging Face',
                    url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers',
                    requestType: 'post',
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', borderColor: 'rgba(251,191,36,0.3)', color: '#fbbf24' }}
              >
                🤗 Hugging Face
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageProvider({
                    ...editingImageProvider,
                    name: 'Puter',
                    url: 'https://js.puter.com/v2/',
                    requestType: 'sdk',
                    model: 'stabilityai/stable-diffusion-3-medium',
                    keys: [],
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8' }}
              >
                ⚡ Puter (Free Unlimited)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageProvider({
                    ...editingImageProvider,
                    name: 'Pixazo AI',
                    url: 'https://gateway.pixazo.ai/flux-1-schnell/v1/getData',
                    requestType: 'post',
                    model: 'Flux Schnell (Black Forest Labs)',
                    customHeaderName: 'Ocp-Apim-Subscription-Key',
                    requestBodyTemplate: '{\n  "prompt": "{prompt}",\n  "num_steps": 4,\n  "height": "{height}",\n  "width": "{width}"\n}',
                    keys:
                      editingImageProvider.keys && editingImageProvider.keys.length > 0
                        ? editingImageProvider.keys.map((k, idx) => ({
                            ...k,
                            label: k.label && !k.label.includes('API Key') && !k.label.includes('Pollinations') && !k.label.includes('Hugging') && !k.label.includes('Cloudflare')
                              ? k.label
                              : `Pixazo API Key ${idx + 1}`,
                          }))
                        : [
                            {
                              id: `pixazo_key_${Date.now()}`,
                              label: 'Pixazo API Key',
                              key: '',
                              status: 'untested',
                            },
                          ],
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', borderColor: 'rgba(168,85,247,0.35)', color: '#c084fc' }}
              >
                🔮 Pixazo AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingImageProvider({
                    ...editingImageProvider,
                    name: 'Cloudflare Workers AI',
                    url: 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/run/@cf/black-forest-labs/flux-1-schnell',
                    requestType: 'post',
                    model: '@cf/black-forest-labs/flux-1-schnell',
                    keys:
                      editingImageProvider.keys && editingImageProvider.keys.length > 0
                        ? editingImageProvider.keys.map((k, idx) => ({
                            ...k,
                            label: k.label && !k.label.includes('API Key') && !k.label.includes('Pollinations') && !k.label.includes('Hugging')
                              ? k.label
                              : `Cloudflare API Token ${idx + 1}`,
                          }))
                        : [
                            {
                              id: `cf_key_${Date.now()}`,
                              label: 'Cloudflare API Token',
                              key: '',
                              status: 'untested',
                            },
                          ],
                  });
                }}
                className="secondary-button"
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px', borderColor: 'rgba(249,115,22,0.35)', color: '#fb923c' }}
              >
                ☁️ Cloudflare Workers AI
              </button>
            </div>
          )}

          {/* Quick Presets for Voice */}
          {providerType === 'voice' && editingVoiceProvider && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setEditingVoiceProvider({
                    ...editingVoiceProvider,
                    name: 'ElevenLabs',
                    url: 'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
                    voicesUrl: 'https://api.elevenlabs.io/v1/voices',
                    model: 'eleven_multilingual_v2',
                    voiceId: 'EXAVITQu4vr4xnSDxMaL',
                    requestType: 'post',
                    customHeaderName: 'xi-api-key',
                    requestBodyTemplate: '{\n  "text": "{text}",\n  "model_id": "eleven_multilingual_v2"\n}',
                    keys:
                      editingVoiceProvider.keys && editingVoiceProvider.keys.length > 0
                        ? editingVoiceProvider.keys.map((k, idx) => ({
                            ...k,
                            label: k.label && !k.label.includes('API Key') && !k.label.includes('Voice')
                              ? k.label
                              : `ElevenLabs API Key ${idx + 1}`,
                          }))
                        : [
                            {
                              id: `voice_key_${Date.now()}`,
                              label: 'ElevenLabs API Key',
                              key: '',
                              status: 'untested',
                            },
                          ],
                  });
                }}
                className="secondary-button"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '5px',
                  borderColor: 'rgba(168,85,247,0.35)',
                  color: '#c084fc',
                  fontWeight: 600,
                }}
              >
                🎙️ ElevenLabs
              </button>
            </div>
          )}

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

          {/* Form Fields: Text Mode */}
          {providerType === 'text' && editingProvider && (
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
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  Direct endpoints require chat completions path (e.g. <code>.../v1/chat/completions</code>).
                </p>
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
                {/* Google Gemini Quick Model Selector */}
                {(editingProvider.url.includes('google') ||
                  editingProvider.url.includes('generativelanguage') ||
                  editingProvider.name.toLowerCase().includes('google') ||
                  editingProvider.name.toLowerCase().includes('gemini') ||
                  editingProvider.model.toLowerCase().includes('gemini')) && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                      Google Gemini Models:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'gemini-3.6-flash', label: 'gemini-3.6-flash (Recommended)' },
                        { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
                        { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite' },
                        { id: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setEditingProvider({ ...editingProvider, model: m.id })}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            border: editingProvider.model === m.id ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                            background: editingProvider.model === m.id ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)',
                            color: editingProvider.model === m.id ? '#60a5fa' : 'var(--text)',
                            fontWeight: editingProvider.model === m.id ? 600 : 400,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: '#93c5fd', display: 'block', marginTop: '5px' }}>
                      💡 Tip: <strong>gemini-3.6-flash</strong> is Google&apos;s most reliable model. If other models return HTTP 503 (high demand), switch to gemini-3.6-flash.
                    </span>
                  </div>
                )}
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
                  Default: 128.
                </span>
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
                  Reasoning Effort Mode
                </label>
                <select
                  value={editingProvider.reasoningOverride || 'auto'}
                  onChange={(e) =>
                    setEditingProvider({
                      ...editingProvider,
                      reasoningOverride: e.target.value as ReasoningOverrideMode,
                    })
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
                >
                  <option value="auto">🧠 Auto (Role-Based: Deep for Coder/Architect/Data Analyst, Off for Fast Roles)</option>
                  <option value="force_on">🧠 Force On (Always High Effort Reasoning)</option>
                  <option value="force_off">🧠 Force Off (Always Disabled Reasoning)</option>
                </select>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                  Per-provider override for Groq, OpenRouter, Cloudflare, HF, Ollama, and BazaarLink endpoints.
                </span>
              </div>
            </div>
          )}

          {/* Form Fields: Simplified Image Mode */}
          {providerType === 'image' && editingImageProvider && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
                  placeholder="e.g. Pollinations, Hugging Face, Cloudflare Workers AI, Custom Image API"
                  value={editingImageProvider.name}
                  onChange={(e) =>
                    setEditingImageProvider({ ...editingImageProvider, name: e.target.value })
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
                  Request Type
                </label>
                <div className="segmented-control" style={{ display: 'flex', width: '100%', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={(!editingImageProvider.requestType || editingImageProvider.requestType === 'get') ? 'selected' : ''}
                    onClick={() => setEditingImageProvider({ ...editingImageProvider, requestType: 'get' })}
                    style={{ flex: 1, minWidth: '95px', fontSize: '11px', padding: '9px 6px', justifyContent: 'center' }}
                  >
                    GET / URL-based
                  </button>
                  <button
                    type="button"
                    className={editingImageProvider.requestType === 'post' ? 'selected' : ''}
                    onClick={() => setEditingImageProvider({ ...editingImageProvider, requestType: 'post' })}
                    style={{ flex: 1, minWidth: '95px', fontSize: '11px', padding: '9px 6px', justifyContent: 'center' }}
                  >
                    POST / JSON-based
                  </button>
                  <button
                    type="button"
                    className={editingImageProvider.requestType === 'sdk' ? 'selected' : ''}
                    onClick={() =>
                      setEditingImageProvider({
                        ...editingImageProvider,
                        requestType: 'sdk',
                        model: editingImageProvider.model || DEFAULT_PUTER_MODEL,
                        url: editingImageProvider.url || 'https://js.puter.com/v2/',
                        keys: [],
                      })
                    }
                    style={{ flex: 1, minWidth: '130px', fontSize: '11px', padding: '9px 6px', justifyContent: 'center' }}
                  >
                    JS SDK / Library-Based
                  </button>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  {editingImageProvider.requestType === 'sdk'
                    ? 'Puter.js client library: Direct in-browser JavaScript SDK with free temporary guest sessions.'
                    : editingImageProvider.requestType === 'post'
                    ? (editingImageProvider.url?.toLowerCase().includes('cloudflare') || editingImageProvider.name?.toLowerCase().includes('cloudflare')
                        ? 'Cloudflare Workers AI style: POST with Bearer token & {"prompt": "<prompt>"}.'
                        : 'POST/JSON-Based: POST with Bearer token & {"inputs": "<prompt>"} or {"prompt": "<prompt>"} (Hugging Face, Cloudflare, or custom REST APIs).')
                    : 'Pollinations style: Direct URL with path & query params.'}
                </p>
              </div>

              {editingImageProvider.requestType === 'sdk' ? (
                <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '14px' }}>
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
                      Puter Model Selection
                    </label>
                    <select
                      value={editingImageProvider.model || DEFAULT_PUTER_MODEL}
                      onChange={(e) =>
                        setEditingImageProvider({ ...editingImageProvider, model: e.target.value })
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
                    >
                      {PUTER_IMAGE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(56,189,248,0.1)',
                      border: '1px solid rgba(56,189,248,0.3)',
                      color: '#7dd3fc',
                      fontSize: '12px',
                      lineHeight: '1.5',
                    }}
                  >
                    ⚡ <strong>Automatic Free Guest Sessions:</strong> Puter loads in-browser via Puter.js SDK. No API URL, endpoint configuration, or API key needed from the user.
                  </div>
                </div>
              ) : (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: '6px',
                    }}
                  >
                    API URL (Image Generation Endpoint)
                  </label>
                  <input
                    type="text"
                    placeholder={
                      editingImageProvider.requestType === 'post'
                        ? 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/run/@cf/black-forest-labs/flux-1-schnell'
                        : 'https://image.pollinations.ai/prompt/'
                    }
                    value={editingImageProvider.url}
                    onChange={(e) =>
                      setEditingImageProvider({ ...editingImageProvider, url: e.target.value })
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
                  <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                    {editingImageProvider.requestType === 'post'
                      ? (editingImageProvider.url?.toLowerCase().includes('cloudflare') || editingImageProvider.name?.toLowerCase().includes('cloudflare')
                          ? 'Cloudflare Workers AI endpoint. Replace YOUR_ACCOUNT_ID with your actual Cloudflare Account ID.'
                          : 'Endpoint to which JSON POST requests are sent with Authorization header.')
                      : 'Prompts and API key parameters (e.g. ?key=...) are dynamically appended.'}
                  </p>
                  {editingImageProvider.url.includes('YOUR_ACCOUNT_ID') && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(249,115,22,0.12)',
                        border: '1px solid rgba(249,115,22,0.35)',
                        color: '#fdba74',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}
                    >
                      ⚠️ <strong>Action Required:</strong> Please replace <code>YOUR_ACCOUNT_ID</code> in the API URL with your actual Cloudflare account ID before saving. Enter your Cloudflare API Token in the Bearer token API key field below.
                    </div>
                  )}
                </div>
              )}

              {editingImageProvider.requestType === 'post' && (
                <>
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
                      Model Identifier <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flux Schnell (Black Forest Labs) or @cf/black-forest-labs/flux-1-schnell"
                      value={editingImageProvider.model || ''}
                      onChange={(e) =>
                        setEditingImageProvider({ ...editingImageProvider, model: e.target.value })
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
                      Custom Authentication Header Name <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ocp-Apim-Subscription-Key (leave empty for Authorization: Bearer)"
                      value={editingImageProvider.customHeaderName || ''}
                      onChange={(e) =>
                        setEditingImageProvider({ ...editingImageProvider, customHeaderName: e.target.value })
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
                    <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      {editingImageProvider.customHeaderName?.includes('Ocp-Apim')
                        ? '🔑 Pixazo AI format: API key will be sent directly via Ocp-Apim-Subscription-Key header without "Bearer " prefix.'
                        : 'If specified, the API key will be sent directly in this header (e.g. Ocp-Apim-Subscription-Key for Pixazo AI). If empty, standard "Authorization: Bearer <key>" is used.'}
                    </p>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '6px',
                      }}
                    >
                      Request Body Template (JSON) <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder={'{\n  "prompt": "{prompt}",\n  "num_steps": 4,\n  "height": "{height}",\n  "width": "{width}"\n}'}
                      value={editingImageProvider.requestBodyTemplate || ''}
                      onChange={(e) =>
                        setEditingImageProvider({ ...editingImageProvider, requestBodyTemplate: e.target.value })
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'rgba(10,22,28,0.8)',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#fff',
                        fontSize: '12px',
                        outline: 'none',
                        fontFamily: 'DM Mono, monospace',
                        resize: 'vertical',
                      }}
                    />
                    <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      JSON payload template. Supported dynamic placeholders: <code>{'{prompt}'}</code> (user's prompt), <code>{'{width}'}</code>, and <code>{'{height}'}</code> (dynamically populated from selected aspect ratio in Image Studio).
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Form Fields: Voice Mode */}
          {providerType === 'voice' && editingVoiceProvider && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
                  placeholder="e.g. ElevenLabs or Custom TTS Engine"
                  value={editingVoiceProvider.name}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, name: e.target.value })
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
                  Request Type
                </label>
                <div className="segmented-control" style={{ display: 'flex', width: '100%' }}>
                  <button
                    type="button"
                    className={editingVoiceProvider.requestType === 'post' ? 'selected' : ''}
                    onClick={() => setEditingVoiceProvider({ ...editingVoiceProvider, requestType: 'post' })}
                    style={{ flex: 1, fontSize: '12px', padding: '9px 12px', justifyContent: 'center' }}
                  >
                    POST / JSON-Based
                  </button>
                  <button
                    type="button"
                    className={editingVoiceProvider.requestType === 'get' ? 'selected' : ''}
                    onClick={() => setEditingVoiceProvider({ ...editingVoiceProvider, requestType: 'get' })}
                    style={{ flex: 1, fontSize: '12px', padding: '9px 12px', justifyContent: 'center' }}
                  >
                    GET / URL-Based
                  </button>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  ElevenLabs and major speech APIs use POST/JSON-based text-to-speech generation.
                </p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: '6px',
                  }}
                >
                  API URL (Text-to-Speech Endpoint)
                </label>
                <input
                  type="text"
                  placeholder="https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                  value={editingVoiceProvider.url}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, url: e.target.value })
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
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  Target synthesis endpoint. Use <code>{'{voice_id}'}</code> placeholder to dynamically inject the chosen voice ID.
                </p>
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
                  Voices List Endpoint <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://api.elevenlabs.io/v1/voices"
                  value={editingVoiceProvider.voicesUrl || ''}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, voicesUrl: e.target.value })
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
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  Endpoint used to dynamically fetch available voice models into the Cloud Voice AI selector.
                </p>
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
                  Custom Auth Header Name <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. xi-api-key"
                  value={editingVoiceProvider.customHeaderName || ''}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, customHeaderName: e.target.value })
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
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  ElevenLabs uses <code>xi-api-key</code>. If left empty, standard <code>Authorization: Bearer &lt;key&gt;</code> is sent.
                </p>
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
                  Model Identifier <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. eleven_multilingual_v2 or eleven_turbo_v2_5"
                  value={editingVoiceProvider.model || ''}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, model: e.target.value })
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
                  Default Voice ID <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. EXAVITQu4vr4xnSDxMaL (Sarah - Free Tier Safe)"
                  value={editingVoiceProvider.voiceId || ''}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, voiceId: e.target.value })
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
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  Note: Free-tier ElevenLabs accounts require official premade system voices (e.g. Sarah: <code>EXAVITQu4vr4xnSDxMaL</code>, George: <code>JBFqnCBsd6RMkjVDRZzb</code>).
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: '6px',
                  }}
                >
                  Request Body Template (JSON) <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Optional)</span>
                </label>
                <textarea
                  rows={4}
                  placeholder={'{\n  "text": "{text}",\n  "model_id": "eleven_multilingual_v2"\n}'}
                  value={editingVoiceProvider.requestBodyTemplate || ''}
                  onChange={(e) =>
                    setEditingVoiceProvider({ ...editingVoiceProvider, requestBodyTemplate: e.target.value })
                  }
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(10,22,28,0.8)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    fontFamily: 'DM Mono, monospace',
                    resize: 'vertical',
                  }}
                />
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                  JSON payload template. Supported dynamic placeholders: <code>{'{text}'}</code> (text to synthesize) and <code>{'{voice_id}'}</code>.
                </p>
              </div>
            </div>
          )}

          {/* Key Strategy Selector & Configured Keys (Hidden for JS SDK) */}
          {!(providerType === 'image' && editingImageProvider?.requestType === 'sdk') && (
            <>
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
                Automatic Failover rotates through backup keys on 429 rate-limits, 402 credit exhaustion, auth errors, and timeouts. Round Robin balances requests.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="segmented-control">
                <button
                  type="button"
                  className={currentStrategy === 'failover' ? 'selected' : ''}
                  onClick={() => {
                    if (providerType === 'text' && editingProvider) {
                      setEditingProvider({ ...editingProvider, keyStrategy: 'failover' });
                    } else if (providerType === 'image' && editingImageProvider) {
                      setEditingImageProvider({ ...editingImageProvider, keyStrategy: 'failover' });
                    } else if (providerType === 'voice' && editingVoiceProvider) {
                      setEditingVoiceProvider({ ...editingVoiceProvider, keyStrategy: 'failover' });
                    }
                  }}
                >
                  Automatic Failover
                </button>
                <button
                  type="button"
                  className={currentStrategy === 'round_robin' ? 'selected' : ''}
                  onClick={() => {
                    if (providerType === 'text' && editingProvider) {
                      setEditingProvider({ ...editingProvider, keyStrategy: 'round_robin' });
                    } else if (providerType === 'image' && editingImageProvider) {
                      setEditingImageProvider({ ...editingImageProvider, keyStrategy: 'round_robin' });
                    } else if (providerType === 'voice' && editingVoiceProvider) {
                      setEditingVoiceProvider({ ...editingVoiceProvider, keyStrategy: 'round_robin' });
                    }
                  }}
                >
                  Round Robin
                </button>
                <button
                  type="button"
                  className={currentStrategy === 'manual' ? 'selected' : ''}
                  onClick={() => {
                    if (providerType === 'text' && editingProvider) {
                      setEditingProvider({ ...editingProvider, keyStrategy: 'manual' });
                    } else if (providerType === 'image' && editingImageProvider) {
                      setEditingImageProvider({ ...editingImageProvider, keyStrategy: 'manual' });
                    } else if (providerType === 'voice' && editingVoiceProvider) {
                      setEditingVoiceProvider({ ...editingVoiceProvider, keyStrategy: 'manual' });
                    }
                  }}
                >
                  Manual
                </button>
              </div>

              {currentStrategy === 'manual' && (
                <select
                  value={currentPreferredKeyId || ''}
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    if (providerType === 'text' && editingProvider) {
                      setEditingProvider({ ...editingProvider, preferredKeyId: val });
                    } else if (providerType === 'image' && editingImageProvider) {
                      setEditingImageProvider({ ...editingImageProvider, preferredKeyId: val });
                    } else if (providerType === 'voice' && editingVoiceProvider) {
                      setEditingVoiceProvider({ ...editingVoiceProvider, preferredKeyId: val });
                    }
                  }}
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
                  {currentEditingKeys.map((k, i) => (
                    <option key={k.id} value={k.id}>
                      {k.label || `Key ${i + 1}`} ({maskKey(k.key)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Configured API Keys Management Section */}
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
                  <Key size={15} /> Configured API Keys ({currentEditingKeys.length})
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
              {currentEditingKeys.map((keyItem, index) => {
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
                        placeholder={
                          providerType === 'voice'
                            ? 'ElevenLabs API Key'
                            : providerType === 'image'
                            ? editingImageProvider?.name?.toLowerCase().includes('pixazo') ||
                              editingImageProvider?.url?.toLowerCase().includes('pixazo') ||
                              editingImageProvider?.customHeaderName?.includes('Ocp-Apim')
                              ? 'Pixazo API Key'
                              : editingImageProvider?.name?.toLowerCase().includes('cloudflare') ||
                                editingImageProvider?.url?.toLowerCase().includes('cloudflare')
                              ? 'Cloudflare API Token'
                              : 'API Key'
                            : `Key ${index + 1}`
                        }
                        value={keyItem.label || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (providerType === 'text' && editingProvider) {
                            setEditingProvider({
                              ...editingProvider,
                              keys: editingProvider.keys.map((k) =>
                                k.id === keyItem.id ? { ...k, label: val } : k
                              ),
                            });
                          } else if (providerType === 'image' && editingImageProvider) {
                            setEditingImageProvider({
                              ...editingImageProvider,
                              keys: editingImageProvider.keys.map((k) =>
                                k.id === keyItem.id ? { ...k, label: val } : k
                              ),
                            });
                          } else if (providerType === 'voice' && editingVoiceProvider) {
                            setEditingVoiceProvider({
                              ...editingVoiceProvider,
                              keys: editingVoiceProvider.keys.map((k) =>
                                k.id === keyItem.id ? { ...k, label: val } : k
                              ),
                            });
                          }
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
                          placeholder={
                            providerType === 'voice'
                              ? editingVoiceProvider?.customHeaderName
                                ? `${editingVoiceProvider.customHeaderName} value`
                                : 'xi-api-key value'
                              : providerType === 'image'
                              ? editingImageProvider?.url?.toLowerCase().includes('cloudflare') ||
                                editingImageProvider?.name?.toLowerCase().includes('cloudflare')
                                ? 'Cloudflare API Token (Bearer token)'
                                : editingImageProvider?.url?.toLowerCase().includes('pixazo') ||
                                  editingImageProvider?.name?.toLowerCase().includes('pixazo') ||
                                  editingImageProvider?.customHeaderName?.includes('Ocp-Apim')
                                ? 'Pixazo API Key (Ocp-Apim-Subscription-Key)'
                                : editingImageProvider?.requestType === 'post'
                                ? (editingImageProvider?.customHeaderName ? `${editingImageProvider.customHeaderName} value` : 'Bearer API Key / Token')
                                : 'Pollinations API Key / Token (optional for basic tier)'
                              : 'sk-...'
                          }
                          value={keyItem.key}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (providerType === 'text' && editingProvider) {
                              setEditingProvider({
                                ...editingProvider,
                                keys: editingProvider.keys.map((k) =>
                                  k.id === keyItem.id
                                    ? { ...k, key: val, status: 'untested' }
                                    : k
                                ),
                              });
                            } else if (providerType === 'image' && editingImageProvider) {
                              setEditingImageProvider({
                                ...editingImageProvider,
                                keys: editingImageProvider.keys.map((k) =>
                                  k.id === keyItem.id
                                    ? { ...k, key: val, status: 'untested' }
                                    : k
                                ),
                              });
                            } else if (providerType === 'voice' && editingVoiceProvider) {
                              setEditingVoiceProvider({
                                ...editingVoiceProvider,
                                keys: editingVoiceProvider.keys.map((k) =>
                                  k.id === keyItem.id
                                    ? { ...k, key: val, status: 'untested' }
                                    : k
                                ),
                              });
                            }
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
                        onClick={() => {
                          if (providerType === 'text' && editingProvider) {
                            handleTestKey(keyItem, editingProvider.url, editingProvider.model);
                          } else if (providerType === 'image' && editingImageProvider) {
                            handleTestImageKey(keyItem, editingImageProvider.url);
                          } else if (providerType === 'voice' && editingVoiceProvider) {
                            handleTestVoiceKey(keyItem, editingVoiceProvider.url, editingVoiceProvider);
                          }
                        }}
                        disabled={isTesting}
                        className="secondary-button"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCw size={12} className={isTesting ? 'animate-spin' : ''} />
                        {isTesting ? 'Testing' : 'Test Key'}
                      </button>

                      {/* Delete Key Button */}
                      {currentEditingKeys.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyFromEditing(keyItem.id)}
                          style={{
                            background: 'none',
                            border: 0,
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Remove key"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Test result display */}
                    {testResult && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: testResult.ok ? '#34d399' : '#f87171',
                          fontWeight: 500,
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
        </>
      )}

      {/* Form Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              borderTop: '1px solid var(--line)',
              paddingTop: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditingProvider(null);
                setEditingImageProvider(null);
                setEditingVoiceProvider(null);
                setFormError(null);
              }}
              className="secondary-button"
              style={{
                padding: '9px 18px',
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
              onClick={handleSave}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                background:
                  providerType === 'image'
                    ? '#ec4899'
                    : providerType === 'voice'
                    ? '#a855f7'
                    : 'var(--accent)',
                color: '#0a161c',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow:
                  providerType === 'image'
                    ? '0 0 16px rgba(236,72,153,0.4)'
                    : providerType === 'voice'
                    ? '0 0 16px rgba(168,85,247,0.4)'
                    : '0 0 16px rgba(97,215,201,0.4)',
              }}
            >
              Save Provider
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProvider && (
        <div
          id="delete-provider-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
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
                  This will remove this {deletingProvider.type === 'image' ? 'Image AI' : 'Text AI'} provider and its configured API keys.
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
