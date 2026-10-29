import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Trash2,
  Database,
  Wand2,
  UploadCloud,
  Upload,
  ImagePlus,
  ArrowRightLeft,
  Columns,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  CheckSquare,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import { enhanceImagePromptWithAI } from '@/services/imageGenerationService';
import {
  getStoredGeneratedImages,
  saveGeneratedImageToIndexedDb,
  updateImageFavoriteInIndexedDb,
  deleteGeneratedImageFromIndexedDb,
  clearAllGeneratedImagesFromIndexedDb,
} from '@/services/imageIndexedDb';
import {
  generatePuterImage,
  resetPuterSession,
  getPuterDebugInfo,
  PuterDebugInfo,
  DEFAULT_PUTER_MODEL,
  PUTER_IMAGE_MODELS,
} from '@/services/puterImageService';
import {
  buildImageRequestBody,
  buildImageRequestHeaders,
  extractImageUrlFromJson,
} from '@/lib/imageProviderUtils';
import type {
  ImageProviderConfig,
  ImageProvidersState,
  GeneratedImageItem,
  KeyHealthStatus,
} from '@/types';

export interface KeyCandidate {
  id: string;
  key: string;
  label: string;
  status: KeyHealthStatus;
  originalIndex: number;
  cooldownUntil?: number;
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
  { label: '3:2 Photo', width: 1280, height: 800, icon: '▰' },
];

interface ReferenceImageDetails {
  isDataUrl: boolean;
  mimeType: string;
  byteSize: number;
  formattedSize: string;
  blob?: Blob;
  file?: File;
  rawUrl?: string;
  base64Only?: string;
}

function parseReferenceImageData(
  dataUrlOrUrl: string,
  fileName?: string | null
): ReferenceImageDetails {
  if (dataUrlOrUrl.startsWith('data:')) {
    const commaIndex = dataUrlOrUrl.indexOf(',');
    const header = commaIndex !== -1 ? dataUrlOrUrl.slice(0, commaIndex) : 'data:image/png;base64';
    const base64Str = commaIndex !== -1 ? dataUrlOrUrl.slice(commaIndex + 1) : dataUrlOrUrl;

    const mimeMatch = header.match(/^data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    try {
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const u8arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8arr[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([u8arr], { type: mimeType });
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      const name = fileName || `reference_image.${ext}`;
      const file = new File([blob], name, { type: mimeType });

      return {
        isDataUrl: true,
        mimeType,
        byteSize: len,
        formattedSize:
          len > 1024 * 1024
            ? `${(len / (1024 * 1024)).toFixed(2)} MB`
            : `${(len / 1024).toFixed(2)} KB`,
        blob,
        file,
        base64Only: base64Str,
      };
    } catch {
      return {
        isDataUrl: true,
        mimeType,
        byteSize: base64Str.length,
        formattedSize: `${(base64Str.length / 1024).toFixed(2)} KB (raw base64)`,
        base64Only: base64Str,
      };
    }
  }

  return {
    isDataUrl: false,
    mimeType: 'image/remote-url',
    byteSize: dataUrlOrUrl.length,
    formattedSize: `${dataUrlOrUrl.length} chars (remote URL)`,
    rawUrl: dataUrlOrUrl,
  };
}

export function ImageStudio() {
  const [searchParams] = useSearchParams();
  const [prompt, setPrompt] = useState(() => searchParams.get('prompt') || '');
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
  const [quickEnhance, setQuickEnhance] = useState(false);
  const [smartAiEnhance, setSmartAiEnhance] = useState(false);
  const [nologo, setNologo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'enhancing' | 'generating'>('idle');
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);
  const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [history, setHistory] = useState<GeneratedImageItem[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImageItem | null>(null);
  const [isTrueFullscreen, setIsTrueFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  const [galleryModalOpen, setGalleryModalOpen] = useState<boolean>(false);
  const [gallerySortOrder, setGallerySortOrder] = useState<'newest' | 'oldest'>('newest');
  const [galleryModelFilter, setGalleryModelFilter] = useState<string | null>(null);
  const [galleryFavoritesOnly, setGalleryFavoritesOnly] = useState<boolean>(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Gallery Selection Mode states
  const [gallerySelectionMode, setGallerySelectionMode] = useState<boolean>(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // Gallery Backup states & handlers
  const [backupExporting, setBackupExporting] = useState<boolean>(false);
  const [backupImporting, setBackupImporting] = useState<boolean>(false);
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error' | 'info' | 'progress';
    message: string;
  } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const exportImagesToJson = async (
    imagesToExport: GeneratedImageItem[],
    filename: string
  ) => {
    if (backupExporting || backupImporting) return;
    playTapSound();
    setBackupExporting(true);
    setBackupStatus({
      type: 'progress',
      message: `Packaging ${imagesToExport.length} ${imagesToExport.length === 1 ? 'image' : 'images'}...`,
    });

    try {
      if (imagesToExport.length === 0) {
        setBackupStatus({
          type: 'info',
          message: 'No images to export.',
        });
        setBackupExporting(false);
        return;
      }

      // Small tick so UI reflects progress message
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Sanitize each image: prompt, provider, model, seed, dimensions, created date, and image data itself
      // Strictly exclude any API keys, provider settings, or confidential secrets.
      const sanitizedImages = imagesToExport.map((item) => ({
        id: item.id,
        prompt: item.prompt || '',
        originalPrompt: item.originalPrompt || undefined,
        enhancedPrompt: item.enhancedPrompt || undefined,
        providerName: item.providerName || 'AI Image Provider',
        model: item.model || '',
        seed: typeof item.seed === 'number' ? item.seed : 0,
        width: typeof item.width === 'number' ? item.width : 1024,
        height: typeof item.height === 'number' ? item.height : 1024,
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
        createdAt: new Date(item.timestamp || Date.now()).toISOString(),
        imageData: item.imageData || item.url || '',
        url: item.url || item.imageData || '',
        referenceImageUrl: item.referenceImageUrl || undefined,
        isEdit: Boolean(item.isEdit),
        isFavorite: Boolean(item.isFavorite),
      }));

      const backupPayload = {
        version: 1,
        type: 'NEXUS_IMAGE_GALLERY_BACKUP',
        exportedAt: new Date().toISOString(),
        count: sanitizedImages.length,
        images: sanitizedImages,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 15000);

      setBackupStatus({
        type: 'success',
        message: `Exported ${sanitizedImages.length} ${sanitizedImages.length === 1 ? 'image' : 'images'} to ${filename}`,
      });
    } catch (err: unknown) {
      console.error('[ImageStudio] Backup export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({
        type: 'error',
        message: `Failed to export gallery backup: ${msg}`,
      });
    } finally {
      setBackupExporting(false);
    }
  };

  const handleDownloadAllImages = async () => {
    if (backupExporting || backupImporting) return;
    playTapSound();
    setBackupExporting(true);
    setBackupStatus({
      type: 'progress',
      message: 'Reading gallery from IndexedDB...',
    });

    try {
      const stored = await getStoredGeneratedImages();
      if (!stored || stored.length === 0) {
        setBackupStatus({
          type: 'info',
          message: 'No images in gallery to export.',
        });
        setBackupExporting(false);
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `nexus-image-gallery-${dateStr}.json`;
      await exportImagesToJson(stored, filename);
    } catch (err: unknown) {
      console.error('[ImageStudio] Backup export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({
        type: 'error',
        message: `Failed to export gallery backup: ${msg}`,
      });
      setBackupExporting(false);
    }
  };

  const handleOpenSelectionMode = () => {
    playTapSound();
    setGalleryModalOpen(true);
    setGallerySelectionMode(true);
  };

  const handleToggleSelectImage = (id: string) => {
    playTapSound();
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllDisplayed = () => {
    playTapSound();
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      displayedGalleryImages.forEach((img) => next.add(img.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    playTapSound();
    setSelectedImageIds(new Set());
  };

  const handleCancelSelectionMode = () => {
    playTapSound();
    setGallerySelectionMode(false);
    setSelectedImageIds(new Set());
  };

  const handleDownloadSelected = async () => {
    if (backupExporting || backupImporting) return;
    if (selectedImageIds.size === 0) {
      setBackupStatus({
        type: 'info',
        message: 'No images selected. Please select at least one image to download.',
      });
      return;
    }
    const selectedItems = history.filter((img) => selectedImageIds.has(img.id));
    if (selectedItems.length === 0) {
      setBackupStatus({
        type: 'info',
        message: 'No selected images found in current gallery.',
      });
      return;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const count = selectedItems.length;
    const countSuffix = count === 1 ? '1-image' : `${count}-images`;
    const filename = `nexus-image-gallery-${dateStr}-${countSuffix}.json`;

    await exportImagesToJson(selectedItems, filename);
  };

  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    playTapSound();
    setBackupImporting(true);
    setBackupStatus({
      type: 'progress',
      message: files.length > 1 ? `Preparing ${files.length} backup files...` : 'Reading backup file...',
    });

    try {
      // Fetch currently stored images from IndexedDB to check for duplicates
      const currentStored = await getStoredGeneratedImages();
      const existingIds = new Set<string>();
      const existingSignatures = new Set<string>();

      const makeSignature = (prompt: string, seed: unknown, timestamp: unknown) => {
        const p = (prompt || '').replace(/\s+/g, ' ').trim();
        const s = String(seed ?? '');
        const dateStr = typeof timestamp === 'number' && timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : '';
        return `${p}__${s}__${dateStr}`;
      };

      const makeExactSignature = (prompt: string, seed: unknown, timestamp: unknown) => {
        const p = (prompt || '').replace(/\s+/g, ' ').trim();
        const s = String(seed ?? '');
        return `${p}__${s}__${timestamp ?? ''}`;
      };

      for (const item of currentStored) {
        if (item.id) existingIds.add(item.id);
        existingSignatures.add(makeSignature(item.prompt, item.seed, item.timestamp));
        existingSignatures.add(makeExactSignature(item.prompt, item.seed, item.timestamp));
      }

      let totalAdded = 0;
      let totalSkipped = 0;
      const failedFiles: string[] = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        setBackupStatus({
          type: 'progress',
          message: files.length > 1
            ? `Processing file ${fIdx + 1} of ${files.length}: "${file.name}"...`
            : `Reading backup file "${file.name}"...`,
        });
        await new Promise((resolve) => setTimeout(resolve, 10));

        try {
          const text = await file.text();
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            failedFiles.push(file.name);
            continue;
          }

          // Validate NEXUS gallery backup format
          let incomingImages: unknown[] | null = null;
          if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            if (obj.type === 'NEXUS_IMAGE_GALLERY_BACKUP' && Array.isArray(obj.images)) {
              incomingImages = obj.images;
            } else if (Array.isArray(obj.images)) {
              incomingImages = obj.images;
            } else if (Array.isArray(parsed)) {
              incomingImages = parsed;
            }
          }

          if (!incomingImages || !Array.isArray(incomingImages) || incomingImages.length === 0) {
            failedFiles.push(file.name);
            continue;
          }

          const validRecords = incomingImages.filter((raw): raw is Record<string, unknown> => {
            if (!raw || typeof raw !== 'object') return false;
            const item = raw as Record<string, unknown>;
            return Boolean((item.imageData || item.url) && typeof item.prompt === 'string');
          });

          if (validRecords.length === 0) {
            failedFiles.push(file.name);
            continue;
          }

          // Any malformed records in the file count as skipped
          totalSkipped += (incomingImages.length - validRecords.length);

          for (let rIdx = 0; rIdx < validRecords.length; rIdx++) {
            const item = validRecords[rIdx];
            const imgData = (item.imageData as string) || (item.url as string);
            const itemId = (item.id as string) || `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const itemSeed = typeof item.seed === 'number' ? item.seed : 0;
            let itemTimestamp = Date.now();
            if (typeof item.timestamp === 'number' && item.timestamp > 0) {
              itemTimestamp = item.timestamp;
            } else if (typeof item.createdAt === 'string' && item.createdAt) {
              const parsedTime = new Date(item.createdAt).getTime();
              if (!isNaN(parsedTime)) itemTimestamp = parsedTime;
            }
            const itemPrompt = (item.prompt as string) || '';
            const incomingFavorite = Boolean(item.isFavorite);

            const sig = makeSignature(itemPrompt, itemSeed, itemTimestamp);
            const sigExact = makeExactSignature(itemPrompt, itemSeed, itemTimestamp);

            // Deduplication: match by image ID, or by the same prompt, seed and date
            // (including matching against images added in earlier files of this batch)
            if (existingIds.has(itemId) || existingSignatures.has(sig) || existingSignatures.has(sigExact)) {
              totalSkipped++;
              // When merging, if an image already exists and the file marks it as a favorite, mark it as a favorite too.
              if (incomingFavorite) {
                const existingItem = currentStored.find(
                  (cs) =>
                    cs.id === itemId ||
                    makeSignature(cs.prompt, cs.seed, cs.timestamp) === sig ||
                    makeExactSignature(cs.prompt, cs.seed, cs.timestamp) === sigExact
                );
                if (existingItem && !existingItem.isFavorite) {
                  existingItem.isFavorite = true;
                  await updateImageFavoriteInIndexedDb(existingItem.id, true);
                }
              }
              continue;
            }

            const validItem: GeneratedImageItem = {
              id: itemId,
              url: (item.url as string) || imgData,
              imageData: imgData,
              prompt: itemPrompt,
              originalPrompt: (item.originalPrompt as string) || undefined,
              enhancedPrompt: (item.enhancedPrompt as string) || undefined,
              providerName: (item.providerName as string) || 'Imported Provider',
              model: (item.model as string) || '',
              width: typeof item.width === 'number' ? item.width : 1024,
              height: typeof item.height === 'number' ? item.height : 1024,
              seed: itemSeed,
              timestamp: itemTimestamp,
              referenceImageUrl: (item.referenceImageUrl as string) || undefined,
              isEdit: Boolean(item.isEdit),
              isFavorite: incomingFavorite,
            };

            await saveGeneratedImageToIndexedDb(validItem);
            totalAdded++;
            currentStored.push(validItem);
            existingIds.add(itemId);
            existingSignatures.add(sig);
            existingSignatures.add(sigExact);

            if (totalAdded % 4 === 0) {
              setBackupStatus({
                type: 'progress',
                message: files.length > 1
                  ? `Importing file ${fIdx + 1} of ${files.length}: ${totalAdded} images added...`
                  : `Importing images... ${totalAdded} added so far`,
              });
              // Yield to event loop to prevent UI freezing on large gallery backups
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        } catch (fileErr) {
          console.error(`[ImageStudio] Error processing backup file "${file.name}":`, fileErr);
          failedFiles.push(file.name);
        }
      }

      // Refresh Recent Generations and Full Gallery immediately without page reload
      const updatedHistory = await getStoredGeneratedImages();
      setHistory(updatedHistory);
      setCurrentImage((prev) => prev || updatedHistory[0] || null);

      // Build single consolidated summary
      const failedCount = failedFiles.length;
      const failedNames = failedCount > 0 ? ` (${failedFiles.join(', ')})` : '';
      const summaryMsg = `Gallery backup summary: ${totalAdded} added, ${totalSkipped} skipped as duplicates, ${failedCount} ${failedCount === 1 ? 'file' : 'files'} failed${failedNames}.`;

      setBackupStatus({
        type: failedCount > 0 && totalAdded === 0 && totalSkipped === 0 ? 'error' : failedCount > 0 ? 'info' : 'success',
        message: summaryMsg,
      });
    } catch (err: unknown) {
      console.error('[ImageStudio] Backup import overall error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({
        type: 'error',
        message: `Failed to import backup: ${msg}`,
      });
    } finally {
      setBackupImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleCopyGalleryPrompt = (e: React.MouseEvent, promptText: string, id: string) => {
    e.stopPropagation();
    playTapSound();
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => {
      setCopiedPromptId(null);
    }, 1800);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playTapSound();
    const item = history.find((img) => img.id === id);
    if (!item) return;
    const newStatus = !item.isFavorite;

    // Optimistically update React state immediately across all relevant image references
    setHistory((prev) =>
      prev.map((img) => (img.id === id ? { ...img, isFavorite: newStatus } : img))
    );
    if (fullscreenImage && fullscreenImage.id === id) {
      setFullscreenImage((prev) => (prev ? { ...prev, isFavorite: newStatus } : null));
    }
    if (currentImage && currentImage.id === id) {
      setCurrentImage((prev) => (prev ? { ...prev, isFavorite: newStatus } : null));
    }

    // Persist permanently in IndexedDB
    try {
      await updateImageFavoriteInIndexedDb(id, newStatus);
    } catch (err) {
      console.error('[ImageStudio] Error updating favorite status in IndexedDB:', err);
    }
  };

  const favoritesCount = useMemo(() => {
    return history.filter((item) => Boolean(item.isFavorite)).length;
  }, [history]);

  const distinctGalleryModels = useMemo(() => {
    const models = new Set<string>();
    history.forEach((item) => {
      const m = item.model || item.providerName;
      if (m && m.trim()) {
        models.add(m.trim());
      }
    });
    return Array.from(models);
  }, [history]);

  const displayedGalleryImages = useMemo(() => {
    let list = [...history];
    if (galleryFavoritesOnly) {
      list = list.filter((item) => Boolean(item.isFavorite));
    }
    if (galleryModelFilter) {
      list = list.filter((item) => (item.model || item.providerName) === galleryModelFilter);
    }
    list.sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return gallerySortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
    return list;
  }, [history, galleryFavoritesOnly, galleryModelFilter, gallerySortOrder]);

  // Reset isTrueFullscreen, zoom, and pan whenever fullscreenImage changes or closes
  useEffect(() => {
    setIsTrueFullscreen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
  }, [fullscreenImage]);

  const navigationImagesList = displayedGalleryImages.length > 0 ? displayedGalleryImages : history;
  const currentFullscreenIndex = navigationImagesList.findIndex((item) => item.id === fullscreenImage?.id);

  const handlePrevFullscreenImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigationImagesList.length <= 1) return;
    playTapSound();
    setIsTrueFullscreen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    const prevIdx = currentFullscreenIndex <= 0 ? navigationImagesList.length - 1 : currentFullscreenIndex - 1;
    setFullscreenImage(navigationImagesList[prevIdx]);
  };

  const handleNextFullscreenImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigationImagesList.length <= 1) return;
    playTapSound();
    setIsTrueFullscreen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    const nextIdx = (currentFullscreenIndex + 1) % navigationImagesList.length;
    setFullscreenImage(navigationImagesList[nextIdx]);
  };

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playTapSound();
    setZoomLevel((prev) => Math.min(Number((prev + 0.5).toFixed(1)), 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playTapSound();
    setZoomLevel((prev) => {
      const next = Math.max(Number((prev - 0.5).toFixed(1)), 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playTapSound();
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleToggleZoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playTapSound();
    if (zoomLevel > 1) {
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomLevel(2.5);
    }
  };

  // Mouse wheel zoom
  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoomLevel((prev) => {
      const next = Math.min(Math.max(Number((prev + delta).toFixed(2)), 1), 4);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Mouse drag panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanOffsetRef.current = { ...panOffset };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoomLevel > 1) {
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: initialPanOffsetRef.current.x + dx,
        y: initialPanOffsetRef.current.y + dy,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Touch handlers for Pan, Pinch-to-Zoom, and Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinchStartDistRef.current = dist;
      initialPinchZoomRef.current = zoomLevel;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      if (zoomLevel > 1) {
        setIsPanning(true);
        panStartRef.current = { x: touch.clientX, y: touch.clientY };
        initialPanOffsetRef.current = { ...panOffset };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const scaleFactor = dist / pinchStartDistRef.current;
      const nextZoom = Math.min(Math.max(Number((initialPinchZoomRef.current * scaleFactor).toFixed(2)), 1), 4);
      setZoomLevel(nextZoom);
      if (nextZoom === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isPanning && zoomLevel > 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - panStartRef.current.x;
      const dy = touch.clientY - panStartRef.current.y;
      setPanOffset({
        x: initialPanOffsetRef.current.x + dx,
        y: initialPanOffsetRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchStartDistRef.current = null;
    setIsPanning(false);

    if (zoomLevel <= 1 && touchStartPosRef.current !== null && e.changedTouches.length > 0) {
      const diffX = e.changedTouches[0].clientX - touchStartPosRef.current.x;
      const diffY = e.changedTouches[0].clientY - touchStartPosRef.current.y;
      const threshold = 50; // px
      if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          handlePrevFullscreenImage();
        } else {
          handleNextFullscreenImage();
        }
      }
    }
    touchStartPosRef.current = null;
  };

  // Keyboard navigation & zoom shortcuts for fullscreen viewer
  useEffect(() => {
    if (!fullscreenImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomLevel > 1) {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        } else {
          setFullscreenImage(null);
          setIsTrueFullscreen(false);
        }
      } else if (e.key === 'ArrowLeft') {
        if (zoomLevel <= 1) {
          handlePrevFullscreenImage();
        } else {
          setPanOffset((prev) => ({ ...prev, x: prev.x + 40 }));
        }
      } else if (e.key === 'ArrowRight') {
        if (zoomLevel <= 1) {
          handleNextFullscreenImage();
        } else {
          setPanOffset((prev) => ({ ...prev, x: prev.x - 40 }));
        }
      } else if (e.key === 'ArrowUp' && zoomLevel > 1) {
        setPanOffset((prev) => ({ ...prev, y: prev.y + 40 }));
      } else if (e.key === 'ArrowDown' && zoomLevel > 1) {
        setPanOffset((prev) => ({ ...prev, y: prev.y - 40 }));
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenImage, currentFullscreenIndex, history, zoomLevel]);
  const [hasDismissedPuterNotice, setHasDismissedPuterNotice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus_seen_puter_notice') === 'true';
    } catch {
      return false;
    }
  });
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [sessionResetMessage, setSessionResetMessage] = useState<string | null>(null);
  const [puterDebugInfo, setPuterDebugInfo] = useState<PuterDebugInfo | null>(null);
  const [showPuterDebug, setShowPuterDebug] = useState(true);

  // Image editing (img2img) state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string | null>(null);
  const [referenceImageSize, setReferenceImageSize] = useState<number | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [comparisonLayout, setComparisonLayout] = useState<'side-by-side' | 'result-only'>('side-by-side');
  const [puterSelectedModel, setPuterSelectedModel] = useState<string>(() => {
    const fresh = storage.getImageProvidersState();
    const curP = fresh.providers.find((p) => p.id === fresh.activeProviderId);
    return curP?.model || DEFAULT_PUTER_MODEL;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync provider list on mount / tab focus
  useEffect(() => {
    const fresh = storage.getImageProvidersState();
    setImageProvidersState(fresh);
    if (!selectedProviderId || !fresh.providers.some((p) => p.id === selectedProviderId)) {
      setSelectedProviderId(fresh.activeProviderId || fresh.providers[0]?.id || '');
    }
  }, [selectedProviderId]);

  // Sync Puter model when active provider changes
  useEffect(() => {
    const cur = imageProvidersState.providers.find((p) => p.id === selectedProviderId);
    if (cur?.requestType === 'sdk' && cur.model) {
      setPuterSelectedModel(cur.model);
    }
  }, [selectedProviderId, imageProvidersState]);

  // Sync prompt from URL search parameters if passed
  useEffect(() => {
    const paramPrompt = searchParams.get('prompt');
    if (paramPrompt) {
      setPrompt(paramPrompt);
    }
  }, [searchParams]);

  // Restore persistent generated images history from IndexedDB on page load
  useEffect(() => {
    let isMounted = true;
    const loadStoredHistory = async () => {
      try {
        const stored = await getStoredGeneratedImages();
        if (isMounted && stored && stored.length > 0) {
          setHistory(stored);
          setCurrentImage((prev) => prev || stored[0]);
        }
      } catch (err) {
        console.warn('[ImageStudio] Failed to load image history from IndexedDB:', err);
      }
    };
    loadStoredHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeProvider: ImageProviderConfig | undefined =
    imageProvidersState.providers.find((p) => p.id === selectedProviderId) ||
    imageProvidersState.providers[0];

  const isSdk = activeProvider?.requestType === 'sdk';
  const isCloudflare = Boolean(
    activeProvider &&
      !isSdk &&
      (activeProvider.url?.toLowerCase().includes('cloudflare') ||
        activeProvider.name?.toLowerCase().includes('cloudflare'))
  );
  const isPost =
    !isSdk &&
    (activeProvider?.requestType === 'post' ||
      activeProvider?.url?.toLowerCase().includes('huggingface') ||
      isCloudflare ||
      activeProvider?.name?.toLowerCase().includes('hugging'));
  const isPollinations = !isSdk && !isPost;

  const pollinationsProvider = imageProvidersState.providers.find(
    (p) =>
      p.requestType !== 'sdk' &&
      p.requestType !== 'post' &&
      !p.url.toLowerCase().includes('huggingface') &&
      !p.url.toLowerCase().includes('cloudflare')
  );
  const cloudflareProvider = imageProvidersState.providers.find(
    (p) =>
      p.requestType !== 'sdk' &&
      (p.url.toLowerCase().includes('cloudflare') || p.name.toLowerCase().includes('cloudflare'))
  );
  const puterProvider = imageProvidersState.providers.find((p) => p.requestType === 'sdk');

  // Handle image file upload for img2img editing
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image file is too large (maximum size is 15 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReferenceImage(result);
      setReferenceImageName(file.name);
      setReferenceImageSize(file.size);
      setError(null);
      playTapSound();

      // If Pollinations is selected, auto-select 'kontext' for image editing
      if (isPollinations) {
        setModelType('kontext');
      }
      // If Puter is selected, ensure an editing-capable model is selected
      if (activeProvider?.requestType === 'sdk') {
        if (
          puterSelectedModel !== 'black-forest-labs/flux-kontext-pro' &&
          puterSelectedModel !== 'google/gemini-2.5-flash-image'
        ) {
          setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
        }
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearReferenceImage = () => {
    playTapSound();
    setReferenceImage(null);
    setReferenceImageName(null);
    setReferenceImageSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (modelType === 'kontext') {
      setModelType('flux');
    }
  };

  // Return all candidate keys for the provider, prioritized according to strategy (failover, manual, round_robin)
  const getProviderKeyCandidates = useCallback((provider: ImageProviderConfig): KeyCandidate[] => {
    if (!provider.keys || provider.keys.length === 0) {
      return [{ id: 'default', key: '', label: 'Default / Unauthenticated', status: 'untested', originalIndex: -1 }];
    }

    const valid = provider.keys
      .map((k, idx) => ({
        id: k.id,
        key: (k.key || '').trim(),
        label: k.label || `Key ${idx + 1}`,
        status: k.status,
        originalIndex: idx,
        cooldownUntil: k.cooldownUntil,
      }))
      .filter((k) => k.key.length > 0);

    if (valid.length === 0) {
      return [{ id: 'default', key: '', label: 'Default / Unauthenticated', status: 'untested', originalIndex: -1 }];
    }

    // Manual strategy: place preferred key first, then remaining valid keys in original order
    if (provider.keyStrategy === 'manual' && provider.preferredKeyId) {
      const preferred = valid.find((k) => k.id === provider.preferredKeyId);
      if (preferred) {
        const remaining = valid.filter((k) => k.id !== provider.preferredKeyId);
        return [preferred, ...remaining];
      }
    }

    // Failover strategy: prioritize healthy and untested keys first, then expired cooldown, then active cooldown, then invalid
    const now = Date.now();
    const sorted = [...valid].sort((a, b) => {
      const getPriority = (k: typeof a) => {
        if (k.status === 'healthy') return 1;
        if (k.status === 'untested') return 2;
        if (k.status === 'cooldown' && k.cooldownUntil && k.cooldownUntil <= now) return 3;
        if (k.status === 'cooldown') return 4;
        if (k.status === 'invalid') return 5;
        return 2;
      };
      const pDiff = getPriority(a) - getPriority(b);
      if (pDiff !== 0) return pDiff;
      return a.originalIndex - b.originalIndex;
    });

    return sorted;
  }, []);

  // Resolve active API key for the selected provider (picks highest-priority candidate)
  const getResolvedApiKey = useCallback(
    (provider: ImageProviderConfig): string => {
      const candidates = getProviderKeyCandidates(provider);
      return candidates[0]?.key || '';
    },
    [getProviderKeyCandidates]
  );

  // Update key health in storage and refresh local state
  const markKeyHealth = useCallback(
    (providerId: string, candidate: KeyCandidate, status: KeyHealthStatus, errorMsg?: string) => {
      if (!candidate.id || candidate.id === 'default') return;
      storage.updateImageKeyHealth(providerId, candidate.id, status, errorMsg);
      setImageProvidersState(storage.getImageProvidersState());
    },
    []
  );

  // Build the generation URL
  const buildGenerationUrl = useCallback(
    (
      promptText: string,
      provider: ImageProviderConfig,
      opts: {
        width: number;
        height: number;
        seed: number;
        model?: string;
        quickEnhance?: boolean;
        nologo?: boolean;
        apiKey?: string;
      }
    ) => {
      const base = provider.url.trim().replace(/\/+$/, '');
      const encodedPrompt = encodeURIComponent(promptText.trim());
      let fullUrl = `${base}/${encodedPrompt}`;

      const key = opts.apiKey !== undefined ? opts.apiKey : getResolvedApiKey(provider);
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
      if (opts.quickEnhance) {
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

  // Generate Image Handler with Smart AI Enhance & Quick Enhance support
  const handleGenerate = async (overridePrompt?: string) => {
    const rawInputPrompt = (overridePrompt ?? prompt).trim();
    if (!rawInputPrompt) {
      setError('Please enter a description for your image.');
      return;
    }

    if (!activeProvider) {
      setError('No Image Provider configured. Please check Settings -> AI Providers.');
      return;
    }

    playTapSound();
    setError(null);
    setFailoverNotice(null);
    setLoading(true);

    let promptToUse = rawInputPrompt;
    let enhancedPromptUsed: string | undefined = undefined;

    // Phase 1: Smart AI Enhance (if enabled)
    if (smartAiEnhance) {
      setLoadingPhase('enhancing');
      try {
        const enhanced = await enhanceImagePromptWithAI(rawInputPrompt);
        if (enhanced) {
          promptToUse = enhanced;
          enhancedPromptUsed = enhanced;
          setLastEnhancedPrompt(enhanced);
        }
      } catch (enhanceErr) {
        console.warn('[ImageStudio] Smart AI Enhance failed, proceeding with original prompt:', enhanceErr);
      }
    }

    // Phase 2: Image Generation
    setLoadingPhase('generating');
    const ratio = ASPECT_RATIOS[selectedRatioIndex] || ASPECT_RATIOS[0];
    const currentSeed = seed;

    const isSdk = activeProvider.requestType === 'sdk';
    const isCloudflare =
      !isSdk &&
      (activeProvider.url.toLowerCase().includes('cloudflare') ||
        activeProvider.name.toLowerCase().includes('cloudflare'));
    const isPost =
      !isSdk &&
      (activeProvider.requestType === 'post' ||
        activeProvider.url.toLowerCase().includes('huggingface') ||
        activeProvider.url.toLowerCase().includes('hf-inference') ||
        isCloudflare ||
        activeProvider.name.toLowerCase().includes('hugging'));

    // Check: Non-img2img POST providers (e.g. Hugging Face) do not support direct img2img editing
    if (isPost && !isCloudflare && referenceImage) {
      setError(
        `${activeProvider.name} does not support image editing (img2img). Please switch to Cloudflare, Pollinations (using the 'kontext' model), or Puter (using FLUX Kontext Pro or Gemini 2.5 Flash Image) to edit your reference image.`
      );
      setLoading(false);
      setLoadingPhase('idle');
      return;
    }

    if (isPost && activeProvider.url.includes('YOUR_ACCOUNT_ID')) {
      setError(
        "Please replace 'YOUR_ACCOUNT_ID' in your Cloudflare provider settings with your actual Cloudflare Account ID (Settings -> AI Providers)."
      );
      setLoading(false);
      setLoadingPhase('idle');
      return;
    }

    try {
      let finalImageUrl = '';

      if (isSdk) {
        // Puter.js in-browser SDK generation with free guest session
        // Pass reference image to Puter's editing-capable call when present
        const selectedModel =
          puterSelectedModel ||
          activeProvider.model ||
          (referenceImage ? 'black-forest-labs/flux-kontext-pro' : DEFAULT_PUTER_MODEL);
        const puterResult = await generatePuterImage(promptToUse, selectedModel, referenceImage || undefined);
        finalImageUrl = puterResult.url;
      } else if (isPost) {
        // POST inference (Cloudflare Workers AI or Hugging Face) with automatic key failover
        const candidateKeys = getProviderKeyCandidates(activeProvider);
        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [${activeProvider.name}] Attempting Generation (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const controller = new AbortController();
          const postTimeoutMs = activeProvider.url?.includes('flux-dev') ? 110000 : 45000;
          const timeoutId = setTimeout(() => controller.abort(), postTimeoutMs);

          try {
            const targetFetchUrl = isCloudflare ? '/api/proxy/cloudflare-image' : activeProvider.url.trim();
            const requestPayload = isCloudflare
              ? {
                  prompt: promptToUse,
                  url: activeProvider.url.trim(),
                  model: referenceImage
                    ? '@cf/runwayml/stable-diffusion-v1-5-img2img'
                    : (activeProvider.model || '@cf/black-forest-labs/flux-1-schnell'),
                  image_b64: referenceImage || undefined,
                  referenceImage: referenceImage || undefined,
                  apiToken: candidate.key,
                  apiKey: candidate.key,
                }
              : activeProvider.requestBodyTemplate
              ? buildImageRequestBody(
                  activeProvider.requestBodyTemplate,
                  promptToUse,
                  ratio.width,
                  ratio.height
                )
              : { inputs: promptToUse, prompt: promptToUse };

            const reqHeaders = buildImageRequestHeaders(activeProvider, candidate.key);

            const response = await fetch(targetFetchUrl, {
              method: 'POST',
              headers: reqHeaders,
              body: JSON.stringify(requestPayload),
              signal: controller.signal,
              mode: 'cors',
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              let errDetail = '';
              try {
                const errJson = await response.json();
                errDetail =
                  (Array.isArray(errJson?.errors) && errJson.errors[0]?.message) ||
                  errJson?.error ||
                  errJson?.message ||
                  JSON.stringify(errJson);
              } catch {
                try {
                  errDetail = await response.text();
                } catch {
                  errDetail = `HTTP ${response.status}: ${response.statusText}`;
                }
              }

              const isRateLimit = response.status === 429 || /rate[- ]?limit|too many requests|quota/i.test(errDetail);
              const isAuthFailure =
                response.status === 401 ||
                response.status === 403 ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(errDetail);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  errDetail || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${response.status})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [${activeProvider.name}] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${response.status})`}: "${errDetail}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${response.status}): ${errDetail || response.statusText}`
                  );
                  continue;
                }
              }

              if (response.status === 503) {
                throw new Error(
                  `Model is currently warming up on ${activeProvider.name} (${errDetail || 'Estimated time ~20s'}). Please click Generate again in a few moments.`
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

            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [${activeProvider.name}] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            // Handle Pixazo AI format ({ output: "https://..." }), Cloudflare Workers AI JSON format (result.image base64), and Hugging Face raw binary blob format
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json') || contentType.includes('+json')) {
              const json = await response.json();
              const extracted = extractImageUrlFromJson(json);

              if (extracted) {
                finalImageUrl = extracted;
              } else if (json?.success === false || (Array.isArray(json?.errors) && json.errors.length > 0)) {
                const errMsg = json.errors?.[0]?.message || json.errors?.[0] || json.error || `${activeProvider.name} returned an error`;
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
              } else if (json?.error || json?.message) {
                const errMsg = json.error || json.message;
                throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
              } else {
                throw new Error(`${activeProvider.name} JSON response did not contain an image field (expected output or result.image).`);
              }
            } else {
              // Raw binary blob (Hugging Face / direct binary stream)
              const imageBlob = await response.blob();
              if (imageBlob.type.includes('json')) {
                try {
                  const text = await imageBlob.text();
                  const json = JSON.parse(text);
                  const extracted = extractImageUrlFromJson(json);
                  if (extracted) {
                    finalImageUrl = extracted;
                  }
                } catch {
                  // Not JSON, continue with blob reader
                }
              }

              if (!finalImageUrl) {
                const blobToDataUrl = (blob: Blob): Promise<string> =>
                  new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });
                finalImageUrl = await blobToDataUrl(imageBlob);
              }
            }

            lastError = null;
            break;
          } catch (fetchErr: unknown) {
            clearTimeout(timeoutId);
            const errObj = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [${activeProvider.name}] Exception on key index ${keyIdx} (${candidate.label}): "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) error. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }
            throw fetchErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      } else if (referenceImage && (modelType === 'kontext' || isPollinations)) {
        // Pollinations OpenAI-compatible image editing API (/v1/images/edits) with automatic key failover
        const providerUrl = (activeProvider.url || '').trim();
        let endpoint = 'https://gen.pollinations.ai/v1/images/edits';
        if (providerUrl.includes('/v1/images/edits')) {
          endpoint = providerUrl;
        } else if (providerUrl.includes('gen.pollinations.ai')) {
          endpoint = `${providerUrl.replace(/\/+$/, '')}/v1/images/edits`;
        } else if (
          providerUrl &&
          !providerUrl.includes('image.pollinations.ai') &&
          !providerUrl.includes('pollinations.ai/prompt')
        ) {
          endpoint = providerUrl.endsWith('/edits')
            ? providerUrl
            : `${providerUrl.replace(/\/+$/, '')}/v1/images/edits`;
        }

        const candidateKeys = getProviderKeyCandidates(activeProvider);
        const imgDetails = parseReferenceImageData(referenceImage, referenceImageName);

        console.group('%c[Pollinations kontext img2img] Request Setup', 'color: #38bdf8; font-weight: bold;');
        console.log('Target Endpoint:', endpoint);
        console.log('Model:', 'kontext');
        console.log('Prompt:', promptToUse);
        console.log('Reference Image Format:', imgDetails.mimeType);
        console.log('Reference Image Data Size:', imgDetails.formattedSize);
        console.log('Reference Image Byte Count:', imgDetails.byteSize, 'bytes');
        console.log('Is Base64 Data URL:', imgDetails.isDataUrl);
        console.log('File Name Attached:', referenceImageName || 'reference_image.png');
        console.log('Output Dimensions:', `${ratio.width}x${ratio.height}`);
        console.log('Seed:', currentSeed);
        console.log('Available Candidate Keys:', candidateKeys.length);
        console.groupEnd();

        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [Pollinations kontext] Attempting Request (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Has Key Value:', Boolean(candidate.key));
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          // Construct Multipart FormData with attached reference image file/blob
          const formData = new FormData();
          formData.append('prompt', promptToUse);
          formData.append('model', 'kontext');
          formData.append('size', `${ratio.width}x${ratio.height}`);
          formData.append('response_format', 'b64_json');
          if (currentSeed !== undefined) {
            formData.append('seed', String(currentSeed));
          }
          if (nologo) {
            formData.append('nologo', 'true');
          }

          if (imgDetails.file) {
            formData.append('image', imgDetails.file);
          } else if (imgDetails.blob) {
            formData.append('image', imgDetails.blob, referenceImageName || 'reference_image.png');
          } else if (imgDetails.rawUrl) {
            formData.append('image', imgDetails.rawUrl);
          } else {
            formData.append('image', referenceImage);
          }

          const headers: Record<string, string> = {};
          if (candidate.key) {
            headers['Authorization'] = `Bearer ${candidate.key}`;
          }

          try {
            console.log(
              `[Pollinations kontext] Transmitting payload with key index ${keyIdx} (${candidate.label}) to ${endpoint}...`
            );

            const response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: formData,
              signal: controller.signal,
              mode: 'cors',
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
              let errDetail = '';
              try {
                const errJson = await response.json();
                errDetail =
                  errJson?.error?.message ||
                  errJson?.message ||
                  errJson?.error ||
                  JSON.stringify(errJson);
              } catch {
                errDetail = `HTTP ${response.status}: ${response.statusText}`;
              }
              console.error('[Pollinations kontext] Error response from server:', response.status, errDetail);

              const isRateLimit = response.status === 429 || /rate[- ]?limit|too many requests|quota/i.test(errDetail);
              const isAuthFailure =
                response.status === 401 ||
                response.status === 403 ||
                errDetail.toLowerCase().includes('api key') ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(errDetail);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  errDetail || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${response.status})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [Pollinations kontext] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${response.status})`}: "${errDetail}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${response.status}): ${errDetail}`
                  );
                  continue;
                }
              }

              if (response.status === 401 || errDetail.toLowerCase().includes('api key')) {
                throw new Error(
                  `Pollinations image editing requires an API key (${errDetail}). You can obtain a free key at https://enter.pollinations.ai/keys and add it in Settings -> AI Providers -> Pollinations. Or switch to Puter (FLUX Kontext Pro) for free in-browser guest editing.`
                );
              }
              throw new Error(`Pollinations editing failed (${response.status}): ${errDetail}`);
            }

            // Success!
            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [Pollinations kontext] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            const contentType = response.headers.get('content-type') || '';
            console.log(`[Pollinations kontext] Received response (${response.status}), Content-Type: ${contentType}`);

            if (contentType.includes('application/json')) {
              const json = await response.json();
              const item = json?.data?.[0];
              if (item?.b64_json) {
                finalImageUrl = item.b64_json.startsWith('data:')
                  ? item.b64_json
                  : `data:image/png;base64,${item.b64_json}`;
              } else if (item?.url) {
                finalImageUrl = item.url;
              } else if (json?.url) {
                finalImageUrl = json.url;
              } else if (json?.image) {
                finalImageUrl = json.image.startsWith('data:')
                  ? json.image
                  : `data:image/png;base64,${json.image}`;
              } else {
                throw new Error('Pollinations returned JSON without an edited image result.');
              }
            } else {
              // Binary image response
              const imageBlob = await response.blob();
              const blobToDataUrl = (blob: Blob): Promise<string> =>
                new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              finalImageUrl = await blobToDataUrl(imageBlob);
            }

            lastError = null;
            break;
          } catch (pollErr: unknown) {
            clearTimeout(timeoutId);
            const errObj = pollErr instanceof Error ? pollErr : new Error(String(pollErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [Pollinations kontext] Exception on key index ${keyIdx} (${candidate.label}): "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) error. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }
            throw pollErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      } else {
        // Standard text-to-image synthesis with automatic key failover
        const candidateKeys = getProviderKeyCandidates(activeProvider);
        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < candidateKeys.length; attemptIndex++) {
          const candidate = candidateKeys[attemptIndex];
          const keyIdx = candidate.originalIndex >= 0 ? candidate.originalIndex : 0;
          console.group(
            `%c[ImageStudio Failover] [Standard Gen] Attempting Request (Key Index: ${keyIdx})`,
            'color: #38bdf8; font-weight: bold;'
          );
          console.log('Provider:', activeProvider.name);
          console.log('Key Index Used:', keyIdx);
          console.log('Key Label:', candidate.label);
          console.log('Key ID:', candidate.id);
          console.log('Has Key Value:', Boolean(candidate.key));
          console.log('Attempt:', `${attemptIndex + 1} of ${candidateKeys.length}`);
          console.groupEnd();

          const generatedUrl = buildGenerationUrl(promptToUse, activeProvider, {
            width: ratio.width,
            height: ratio.height,
            seed: currentSeed,
            model: modelType,
            quickEnhance,
            nologo,
            apiKey: candidate.key,
          });

          try {
            // First perform a fetch test to verify endpoint responsiveness and check for HTTP 429/401/403
            let fetchFailedStatus: number | null = null;
            let fetchErrMsg = '';

            try {
              const fetchController = new AbortController();
              const fetchTimeout = setTimeout(() => fetchController.abort(), 35000);
              const testRes = await fetch(generatedUrl, {
                method: 'GET',
                signal: fetchController.signal,
                mode: 'cors',
              });
              clearTimeout(fetchTimeout);

              if (!testRes.ok) {
                fetchFailedStatus = testRes.status;
                try {
                  const errJson = await testRes.json();
                  fetchErrMsg = errJson?.error || errJson?.message || JSON.stringify(errJson);
                } catch {
                  try {
                    fetchErrMsg = await testRes.text();
                  } catch {
                    fetchErrMsg = `HTTP ${testRes.status}: ${testRes.statusText}`;
                  }
                }
              }
            } catch (netErr: unknown) {
              if (netErr instanceof Error && netErr.name === 'AbortError') {
                throw new Error('Image generation timed out after 35 seconds.');
              }
              // If CORS blocks GET fetch directly, proceed to preloading with Image()
            }

            if (fetchFailedStatus !== null) {
              const isRateLimit = fetchFailedStatus === 429 || /rate[- ]?limit|too many requests|quota/i.test(fetchErrMsg);
              const isAuthFailure =
                fetchFailedStatus === 401 ||
                fetchFailedStatus === 403 ||
                /unauthori[zs]ed|invalid.*key|authentication/i.test(fetchErrMsg);

              if (isRateLimit || isAuthFailure) {
                markKeyHealth(
                  activeProvider.id,
                  candidate,
                  isRateLimit ? 'cooldown' : 'invalid',
                  fetchErrMsg || (isRateLimit ? 'Rate limit exceeded (HTTP 429)' : `Auth error (${fetchFailedStatus})`)
                );

                console.warn(
                  `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) encountered ${isRateLimit ? 'Rate-Limit (HTTP 429)' : `Auth-Failure (HTTP ${fetchFailedStatus})`}: "${fetchErrMsg}". ${attemptIndex < candidateKeys.length - 1 ? `Automatically retrying with next available key index ${candidateKeys[attemptIndex + 1].originalIndex}...` : 'All available keys exhausted.'}`,
                  'color: #f59e0b; font-weight: bold;'
                );

                if (attemptIndex < candidateKeys.length - 1) {
                  setFailoverNotice(
                    `Key #${keyIdx + 1} (${candidate.label}) hit ${isRateLimit ? 'Rate-Limit (429)' : 'Auth error'}. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
                  );
                  lastError = new Error(
                    `Key index ${keyIdx} failed (${fetchFailedStatus}): ${fetchErrMsg}`
                  );
                  continue;
                }
              }
              throw new Error(`Provider returned error (${fetchFailedStatus}): ${fetchErrMsg}`);
            }

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

            markKeyHealth(activeProvider.id, candidate, 'healthy');
            console.log(
              `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) succeeded! Marked healthy.`,
              'color: #34d399; font-weight: bold;'
            );

            finalImageUrl = generatedUrl;
            lastError = null;
            break;
          } catch (genErr: unknown) {
            const errObj = genErr instanceof Error ? genErr : new Error(String(genErr));
            lastError = errObj;
            const errMsg = errObj.message;
            const isAuthOrRate = /429|401|403|rate[- ]?limit|unauthori[zs]ed|api key/i.test(errMsg);

            if (isAuthOrRate && attemptIndex < candidateKeys.length - 1) {
              markKeyHealth(
                activeProvider.id,
                candidate,
                /429|rate/i.test(errMsg) ? 'cooldown' : 'invalid',
                errMsg
              );
              console.warn(
                `%c[ImageStudio Failover] [Standard Gen] Key index ${keyIdx} (${candidate.label}) failed: "${errMsg}". Failing over to next key index ${candidateKeys[attemptIndex + 1].originalIndex}...`,
                'color: #f59e0b; font-weight: bold;'
              );
              setFailoverNotice(
                `Key #${keyIdx + 1} (${candidate.label}) failed. Failing over to Key #${candidateKeys[attemptIndex + 1].originalIndex + 1}...`
              );
              continue;
            }

            throw genErr;
          }
        }

        if (!finalImageUrl && lastError) {
          throw lastError;
        }
      }

      // Determine the real model used for this generation
      let actualModelUsed = modelType;
      if (isSdk) {
        actualModelUsed =
          puterSelectedModel ||
          activeProvider.model ||
          (referenceImage ? 'black-forest-labs/flux-kontext-pro' : DEFAULT_PUTER_MODEL);
      } else if (isPost) {
        if (isCloudflare) {
          actualModelUsed = referenceImage
            ? '@cf/runwayml/stable-diffusion-v1-5-img2img'
            : activeProvider.model ||
              (activeProvider.url.split('/').filter(Boolean).pop()) ||
              '@cf/black-forest-labs/flux-1-schnell';
        } else {
          actualModelUsed =
            activeProvider.model ||
            (activeProvider.url.split('/').filter(Boolean).pop()) ||
            'POST Inference Model';
        }
      } else {
        actualModelUsed = modelType;
      }

      const newItem: GeneratedImageItem = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        url: finalImageUrl,
        imageData: finalImageUrl,
        referenceImageUrl: referenceImage || undefined,
        isEdit: Boolean(referenceImage),
        prompt: promptToUse,
        originalPrompt: enhancedPromptUsed ? rawInputPrompt : undefined,
        enhancedPrompt: enhancedPromptUsed,
        providerName: activeProvider.name,
        width: ratio.width,
        height: ratio.height,
        seed: currentSeed,
        model: actualModelUsed,
        timestamp: Date.now(),
      };

      // Persist permanently in IndexedDB
      try {
        await saveGeneratedImageToIndexedDb(newItem);
      } catch (saveErr) {
        console.warn('[ImageStudio] Error saving to IndexedDB:', saveErr);
      }

      setCurrentImage(newItem);
      setHistory((prev) => [newItem, ...prev.filter((item) => item.id !== newItem.id)]);

      // Auto-advance seed for next generation
      setSeed(Math.floor(Math.random() * 1000000));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ImageStudio: Generation Failed]', msg, err);
      if (activeProvider.requestType === 'sdk') {
        setPuterDebugInfo(getPuterDebugInfo());
      }
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingPhase('idle');
      setFailoverNotice(null);
    }
  };

  // Reset Puter guest session if requested or encountered error
  const handleResetPuterSession = async () => {
    try {
      setIsResettingSession(true);
      playTapSound();
      await resetPuterSession();
      setError(null);
      setSessionResetMessage('Puter guest session was reset. Click Generate to start a clean new session.');
      setTimeout(() => setSessionResetMessage(null), 6000);
    } catch (resetErr) {
      console.error('[ImageStudio] Failed to reset Puter session:', resetErr);
      setError('Could not reset Puter session. Please refresh the page.');
    } finally {
      setIsResettingSession(false);
    }
  };

  // Clear all generation history from IndexedDB
  const handleClearHistory = async () => {
    if (history.length === 0) return;
    const confirmed = window.confirm(
      'Are you sure you want to clear your generation history? This will permanently delete all saved images from storage.'
    );
    if (!confirmed) return;

    playTapSound();
    try {
      await clearAllGeneratedImagesFromIndexedDb();
      setHistory([]);
      setCurrentImage(null);
    } catch (err) {
      console.error('[ImageStudio] Failed to clear image history:', err);
    }
  };

  // Delete an individual image from IndexedDB
  const handleDeleteImage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playTapSound();
    try {
      await deleteGeneratedImageFromIndexedDb(id);
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        if (currentImage?.id === id) {
          setCurrentImage(updated[0] || null);
        }
        return updated;
      });
    } catch (err) {
      console.error('[ImageStudio] Failed to delete image from IndexedDB:', err);
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

      if (item.url.startsWith('blob:') || item.url.startsWith('data:')) {
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

  // Set current image as reference image for next edit
  const handleUseAsReference = (url: string) => {
    setReferenceImage(url);
    setReferenceImageName('Previous Generation');
    setReferenceImageSize(null);
    if (activeProvider?.requestType === 'sdk' || selectedProviderId === 'puter-official') {
      setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
    } else {
      setModelType('kontext');
    }
    setError(null);
    playTapSound();
    window.scrollTo({ top: 120, behavior: 'smooth' });
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
    <div className="page-container image-studio-stitch-root min-h-screen bg-[#070709] text-gray-100 rounded-2xl px-3.5 sm:px-6 py-4 sm:py-6 max-w-[1160px] mx-auto pb-16 overflow-x-hidden">
      {/* Hidden Backup File Input (shared across Header and Gallery Toolbar) */}
      <input
        ref={backupFileInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        style={{ display: 'none' }}
        onChange={handleUploadBackup}
      />

      {/* 1. HEADER */}
      <header className="flex flex-col gap-3 pb-4 border-b border-[#191922]/80 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2d87] to-[#8b2cf5] p-[1px] shadow-glow-subtle shrink-0">
              <div className="w-full h-full bg-[#121218] rounded-[11px] flex items-center justify-center text-[#ff2d87]">
                <ImageIcon size={20} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white m-0">
                  Image Studio
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  AI VISION ENGINE
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 m-0 leading-relaxed">
                Generate high-fidelity artwork and photorealistic visuals using configured AI image providers.
              </p>
            </div>
          </div>

          {/* Right Header Actions: Export, Restore, Gallery Modal Button & Settings Link */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleDownloadAllImages}
              disabled={backupExporting || backupImporting}
              className="h-9 px-2.5 rounded-xl bg-[#17171e] border border-[#252532] hover:border-pink-500/40 flex items-center justify-center gap-1.5 text-gray-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Export all saved generations into a JSON backup file"
            >
              {backupExporting ? (
                <RotateCw size={14} className="animate-spin text-pink-400" />
              ) : (
                <Download size={14} className="text-gray-300" />
              )}
              <span className="hidden md:inline text-xs font-mono font-medium">Export</span>
            </button>

            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              disabled={backupExporting || backupImporting}
              className="h-9 px-2.5 rounded-xl bg-[#17171e] border border-[#252532] hover:border-pink-500/40 flex items-center justify-center gap-1.5 text-gray-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Restore and merge images from backup files"
            >
              {backupImporting ? (
                <RotateCw size={14} className="animate-spin text-violet-400" />
              ) : (
                <Upload size={14} className="text-gray-300" />
              )}
              <span className="hidden md:inline text-xs font-mono font-medium">Restore</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                setGalleryModalOpen(true);
              }}
              className="h-9 px-2.5 rounded-xl bg-[#17171e] border border-[#252532] hover:border-pink-500/40 flex items-center justify-center gap-1.5 text-gray-300 hover:text-white transition relative cursor-pointer"
              title="Open Photo Gallery"
            >
              <ImageIcon size={15} className="text-pink-400" />
              <span className="hidden sm:inline text-xs font-mono font-medium">Gallery</span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                {history.length}
              </span>
            </button>

            <Link
              to="/settings?category=ai"
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#17171e] border border-[#252532] hover:border-pink-500/40 flex items-center justify-center gap-1.5 text-gray-300 hover:text-white transition no-underline"
              title="Configure Image Providers"
            >
              <Settings size={15} className="text-gray-300" />
              <span className="hidden sm:inline text-xs font-mono font-medium">Providers</span>
            </Link>
          </div>
        </div>

        {/* Backup / Export / Restore Status Banner */}
        {backupStatus && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-mono border ${
              backupStatus.type === 'error'
                ? 'bg-red-950/35 border-red-800/50 text-red-300'
                : backupStatus.type === 'success'
                ? 'bg-emerald-950/35 border-emerald-700/40 text-emerald-300'
                : backupStatus.type === 'info'
                ? 'bg-[#14141d] border-pink-500/30 text-pink-300'
                : 'bg-[#14141d] border-violet-500/40 text-violet-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {backupStatus.type === 'progress' && (
                <RotateCw size={13} className="animate-spin shrink-0 text-pink-400" />
              )}
              {backupStatus.type === 'success' && <Check size={13} className="shrink-0 text-emerald-400" />}
              {backupStatus.type === 'error' && <AlertCircle size={13} className="shrink-0 text-red-400" />}
              <span className="break-words leading-snug">{backupStatus.message}</span>
            </div>
            {backupStatus.type !== 'progress' && (
              <button
                type="button"
                onClick={() => setBackupStatus(null)}
                className="text-gray-400 hover:text-white p-0.5 cursor-pointer bg-transparent border-0 flex items-center"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Studio Layout: Mobile single-column stack, Desktop 2-column balanced grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Controls, Providers, Prompt & Parameters */}
        <div className="lg:col-span-6 flex flex-col gap-4 min-w-0">
          {/* 2. PROVIDER / PRESET CHIPS */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Layers size={13} className="text-[#ff2d87]" />
                Active Engine Preset
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                {activeProvider && (
                  <>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#161622] border border-[#252534] text-gray-300 capitalize">
                      Strategy: {activeProvider.keyStrategy.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#161622] border border-[#252534] text-gray-400">
                      {activeProvider.keys?.length || 0} API {activeProvider.keys?.length === 1 ? 'Key' : 'Keys'}
                    </span>
                  </>
                )}
                <Link
                  to="/settings?category=ai"
                  className="text-[11px] font-mono text-[#ff2d87] hover:underline no-underline"
                >
                  Configure →
                </Link>
              </div>
            </div>

            {/* Keep accessible select with id="image-provider-select" for any DOM/handler reference */}
            <select
              id="image-provider-select"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="sr-only"
              aria-label="Image Provider"
            >
              {imageProvidersState.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Horizontal Scroll Provider Chips */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-none">
              {imageProvidersState.providers.map((p) => {
                const isSelected = p.id === selectedProviderId;
                const badgeText =
                  p.requestType === 'sdk'
                    ? 'JS SDK'
                    : p.requestType === 'post'
                    ? p.name.toLowerCase().includes('cloudflare')
                      ? 'EDGE'
                      : 'POST'
                    : 'FAST';

                if (isSelected) {
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(p.id);
                        playTapSound();
                      }}
                      className="shrink-0 p-[1px] rounded-xl bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] shadow-glow-subtle cursor-pointer border-0 text-left transition active:scale-95"
                    >
                      <div className="bg-[#16161f] rounded-[11px] px-3 py-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ff2d87] animate-pulse shrink-0" />
                        <span className="font-mono text-xs font-semibold text-white whitespace-nowrap">
                          {p.name}
                        </span>
                        <span className="text-[9px] font-mono bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/30">
                          {badgeText}
                        </span>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProviderId(p.id);
                      playTapSound();
                    }}
                    className="shrink-0 px-3 py-2 rounded-xl bg-[#121218] border border-[#1f1f2b] hover:border-gray-700 flex items-center gap-2 transition cursor-pointer text-left active:scale-95"
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />
                    <span className="font-mono text-xs font-medium text-gray-300 whitespace-nowrap">
                      {p.name}
                    </span>
                    <span className="text-[9px] font-mono bg-[#1e1e2c] text-gray-400 px-1.5 py-0.5 rounded">
                      {badgeText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Provider Model Bar */}
            <div className="bg-[#121218] border border-[#1e1e29] rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {activeProvider?.requestType === 'sdk' ? (
                <>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-gray-400 shrink-0">
                    Puter Model {referenceImage ? '(Editing Capable)' : ''}
                  </label>
                  <select
                    value={puterSelectedModel}
                    onChange={(e) => {
                      setPuterSelectedModel(e.target.value);
                      playTapSound();
                    }}
                    className="w-full sm:w-auto sm:min-w-[230px] bg-[#181822] border border-[#262635] focus:border-pink-500/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-100 outline-none cursor-pointer"
                  >
                    {PUTER_IMAGE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : activeProvider?.requestType === 'post' ? (
                <>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400 shrink-0">
                    Inference Model
                  </span>
                  <div
                    className="px-2.5 py-1 rounded-lg bg-[#181822] border border-[#262635] text-xs font-mono text-pink-300 truncate max-w-full"
                    title={activeProvider.model || activeProvider.url}
                  >
                    {isCloudflare
                      ? referenceImage
                        ? 'CF: @cf/runwayml/stable-diffusion-v1-5-img2img (img2img)'
                        : `CF: ${activeProvider.model || (activeProvider.url.split('/').filter(Boolean).pop()) || '@cf/black-forest-labs/flux-1-schnell'}`
                      : activeProvider.name.toLowerCase().includes('hugging')
                      ? `HF: ${activeProvider.model || (activeProvider.url.split('/').filter(Boolean).pop()) || 'Default'}`
                      : `POST: ${activeProvider.model || (activeProvider.url.split('/').filter(Boolean).pop()) || 'Default'}`}
                  </div>
                </>
              ) : (
                <>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-gray-400 shrink-0">
                    Engine Model
                  </label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value)}
                    className="w-full sm:w-auto sm:min-w-[210px] bg-[#181822] border border-[#262635] focus:border-pink-500/60 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-100 outline-none cursor-pointer"
                  >
                    {referenceImage && (
                      <option value="kontext">kontext (Image Edit / img2img)</option>
                    )}
                    <option value="flux">Flux (High Detail)</option>
                    <option value="turbo">Turbo (Ultra Fast)</option>
                    <option value="default">Default Provider Model</option>
                  </select>
                </>
              )}
            </div>

            {/* Puter.js Guest Mode Welcome Card */}
            {activeProvider?.requestType === 'sdk' && !hasDismissedPuterNotice && (
              <div className="p-3 rounded-xl bg-[#121218] border border-pink-500/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5 min-w-[200px] flex-1">
                  <span className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                    <Sparkles size={14} />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-gray-100">
                      Image generation is powered by Puter — no signup needed for basic use
                    </div>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                      Active Model: <strong className="text-pink-300">{activeProvider.model || DEFAULT_PUTER_MODEL}</strong> (Free Guest Session)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasDismissedPuterNotice(true);
                    try {
                      localStorage.setItem('nexus_seen_puter_notice', 'true');
                    } catch {
                      // ignore localStorage errors
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] text-white text-xs font-mono font-bold border-0 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 transition"
                >
                  <Check size={13} /> Continue with Puter
                </button>
              </div>
            )}
          </div>

          {/* 3. PROMPT CARD (with Reference Image Strip & Toolbar) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingImage(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingImage(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingImage(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleImageFile(e.dataTransfer.files[0]);
              }
            }}
            className={`bg-[#121218] border rounded-2xl p-3.5 flex flex-col gap-3 shadow-lg transition-all duration-300 ${
              isDraggingImage
                ? 'border-[#ff2d87] shadow-glow-pink'
                : 'border-[#1e1e29]'
            }`}
          >
            {/* Hidden Reference Image File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageFile(e.target.files[0]);
                }
              }}
              style={{ display: 'none' }}
            />

            {/* Top Prompt Header Row */}
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="image-prompt-textarea"
                className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff2d87]" />
                {referenceImage ? 'Edit Instructions (img2img)' : 'Synthesis Prompt'}
              </label>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSurpriseMe}
                  className="text-[11px] font-mono text-pink-400 hover:text-pink-300 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition"
                  title="Load a random sample prompt"
                >
                  <Dice5 size={12} /> Surprise Me
                </button>
                <span className="text-[10px] font-mono text-gray-500">
                  {prompt.length} chars • Ctrl+Enter
                </span>
              </div>
            </div>

            {/* Prompt Textarea */}
            <textarea
              id="image-prompt-textarea"
              rows={3}
              placeholder={
                referenceImage
                  ? "Describe what to edit or change in the reference image (e.g. 'Turn into a futuristic cyberpunk painting with neon lighting', 'Change background to sunset beach')..."
                  : 'Describe your visual concept in detail...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
              className="w-full bg-[#0c0c11] border border-[#1d1d28] focus:border-pink-500/60 rounded-xl p-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none resize-y leading-relaxed font-sans"
            />

            {/* Reference Image Indicator Strip (when referenceImage is attached) */}
            {referenceImage && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-pink-500/10 border border-pink-500/25">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-pink-500/40 bg-[#070709] shrink-0">
                    <img
                      src={referenceImage}
                      alt="Reference preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-mono text-pink-300 font-semibold leading-tight flex items-center gap-1">
                      <Sparkles size={10} className="shrink-0" /> Reference Image Attached • img2img
                    </span>
                    <span
                      className="text-[10px] font-mono text-gray-400 truncate"
                      title={referenceImageName || 'Uploaded Reference'}
                    >
                      {referenceImageName || 'Uploaded Reference'}
                      {referenceImageSize
                        ? ` (${(referenceImageSize / (1024 * 1024)).toFixed(2)} MB)`
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded-lg bg-[#181822] hover:bg-[#222230] border border-[#2a2a3a] text-[10px] font-mono text-gray-200 cursor-pointer transition"
                    title="Replace reference image"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleClearReferenceImage}
                    className="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 flex items-center justify-center cursor-pointer transition"
                    title="Remove reference image"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Non-img2img Provider Warning with Quick-Switch buttons */}
            {isPost && !isCloudflare && referenceImage && (
              <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/35 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <strong className="text-amber-300 font-mono">
                      {activeProvider?.name || 'Provider'} Does Not Support Image Editing:
                    </strong>{' '}
                    Switch to <strong>Cloudflare</strong> (SD 1.5 img2img), <strong>Pollinations</strong> (kontext), or <strong>Puter</strong> (FLUX Kontext Pro).
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {cloudflareProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(cloudflareProvider.id);
                        setError(null);
                        playTapSound();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-[10px] font-mono font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                    >
                      <Sparkles size={11} /> Cloudflare img2img
                    </button>
                  )}
                  {pollinationsProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(pollinationsProvider.id);
                        setModelType('kontext');
                        setError(null);
                        playTapSound();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-[10px] font-mono font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                    >
                      <Sparkles size={11} /> Pollinations (kontext)
                    </button>
                  )}
                  {puterProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderId(puterProvider.id);
                        setPuterSelectedModel('black-forest-labs/flux-kontext-pro');
                        setError(null);
                        playTapSound();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-[10px] font-mono font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                    >
                      <Check size={11} /> Puter (FLUX Kontext Pro)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cloudflare img2img Active Indicator */}
            {isCloudflare && referenceImage && (
              <div className="px-2.5 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-2 text-[11px] font-mono text-orange-300">
                <Sparkles size={13} className="text-orange-400 shrink-0" />
                <span className="truncate">
                  Cloudflare img2img: <code className="text-orange-200">@cf/runwayml/stable-diffusion-v1-5-img2img</code>
                </span>
              </div>
            )}

            {/* Smart AI Enhanced Prompt Banner (if generated with Smart AI) */}
            {lastEnhancedPrompt && (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-pink-500/10 to-violet-600/10 border border-pink-500/30 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-pink-400 inline-flex items-center gap-1">
                    <Wand2 size={11} /> Enhanced prompt used by AI
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(lastEnhancedPrompt);
                        playTapSound();
                      }}
                      className="px-2 py-0.5 rounded bg-[#181822] hover:bg-[#222230] border border-[#2a2a3a] text-[10px] font-mono text-gray-200 cursor-pointer"
                    >
                      Use in editor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lastEnhancedPrompt);
                        playTapSound();
                      }}
                      className="px-2 py-0.5 rounded bg-[#181822] hover:bg-[#222230] border border-[#2a2a3a] text-[10px] font-mono text-gray-200 cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <p className="m-0 text-xs text-gray-300 italic leading-relaxed">
                  "{lastEnhancedPrompt}"
                </p>
              </div>
            )}

            {/* Inspiration Sample Prompts Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider shrink-0">
                Ideas:
              </span>
              {SAMPLE_PROMPTS.slice(0, 4).map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    playTapSound();
                  }}
                  className="shrink-0 px-2 py-1 rounded-lg bg-[#161620] hover:bg-[#1e1e2c] border border-[#242434] text-[10px] font-mono text-gray-400 hover:text-gray-200 transition cursor-pointer truncate max-w-[180px]"
                  title={p}
                >
                  {p.slice(0, 32)}...
                </button>
              ))}
            </div>

            {/* Prompt Action Toolbar (Ref Img, Seed + Roll, HQ Boost, Smart AI Enhance) */}
            <div className="pt-2 border-t border-[#1e1e29] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Left: Upload Reference + Seed Input & Roll */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Ref Img Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                      referenceImage
                        ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                        : 'bg-[#181822] hover:bg-[#1f1f2e] border-[#262635] text-gray-300'
                    }`}
                    title="Upload or replace reference image (img2img)"
                  >
                    <UploadCloud size={14} className="text-pink-400" />
                    <span>Ref Img</span>
                  </button>

                  {/* Seed Control (Real Seed input + Roll dice button, NO Auto/Lock toggle) */}
                  <div className="flex items-center bg-[#181822] border border-[#262635] rounded-lg p-0.5 gap-1">
                    <div className="flex items-center gap-1 pl-2 pr-1 py-1">
                      <span className="text-[10px] font-mono text-gray-500 uppercase select-none">
                        Seed
                      </span>
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                        className="w-[74px] bg-transparent text-xs font-mono text-gray-200 focus:outline-none focus:text-pink-400 text-center border-0 p-0"
                        title="Generation Seed"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRollSeed}
                      className="px-2 py-1 rounded-md bg-[#121218] hover:bg-[#222230] text-gray-300 hover:text-pink-400 border border-[#262635] transition active:scale-90 flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                      title="Roll New Random Seed"
                    >
                      <Dice5 size={12} className="stitch-dice-icon transition-transform duration-300" />
                      <span>Roll</span>
                    </button>
                  </div>
                </div>

                {/* Right: HQ Boost Switch (quickEnhance) */}
                <label
                  className="flex items-center gap-2 cursor-pointer select-none ml-auto"
                  title="Adds aesthetic and high-detail quality enhancers to the prompt"
                >
                  <input
                    type="checkbox"
                    checked={quickEnhance}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setQuickEnhance(val);
                      if (val) setSmartAiEnhance(false);
                      playTapSound();
                    }}
                    className="sr-only"
                  />
                  <span className="text-xs font-mono text-gray-300">HQ Boost</span>
                  <div
                    className={`w-8 h-4 rounded-full relative flex items-center px-0.5 transition-colors ${
                      quickEnhance
                        ? 'bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5]'
                        : 'bg-[#181822] border border-[#2a2a3a]'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${
                        quickEnhance ? 'translate-x-3.5' : 'translate-x-0 bg-gray-400'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Secondary Enhancer & Clean Render Row */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                {/* Smart AI Enhance Button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !smartAiEnhance;
                    setSmartAiEnhance(next);
                    if (next) setQuickEnhance(false);
                    playTapSound();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium inline-flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                    smartAiEnhance
                      ? 'bg-gradient-to-r from-pink-500/20 to-violet-600/20 border-pink-500/50 text-pink-300 shadow-glow-subtle'
                      : 'bg-[#181822] hover:bg-[#1f1f2e] border-[#262635] text-gray-400 hover:text-gray-200'
                  }`}
                  title="Sends prompt to active NEXUS AI model to rewrite into vivid scene descriptions"
                >
                  <Wand2 size={12} className={smartAiEnhance ? 'text-pink-400' : 'text-violet-400'} />
                  <span>Smart AI Enhance</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    AI Rewrite
                  </span>
                </button>

                {/* Clean Render (No Logo) Toggle */}
                <label className="inline-flex items-center gap-1.5 text-[11px] font-mono text-gray-400 hover:text-gray-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nologo}
                    onChange={(e) => setNologo(e.target.checked)}
                    className="accent-[#ff2d87] rounded cursor-pointer"
                  />
                  <span>Clean Render</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. ASPECT RATIO PICKER (ALL 5 REAL RATIOS) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Aspect Ratio &amp; Dimensions
              </span>
              <span className="text-[11px] font-mono text-pink-400 font-semibold">
                {ASPECT_RATIOS[selectedRatioIndex]?.label.split(' ')[0]} •{' '}
                {ASPECT_RATIOS[selectedRatioIndex]?.width}×{ASPECT_RATIOS[selectedRatioIndex]?.height}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {ASPECT_RATIOS.map((ratio, idx) => {
                const isSelected = selectedRatioIndex === idx;
                const shortRatio = ratio.label.split(' ')[0];
                const shapeSizeClass =
                  shortRatio === '1:1'
                    ? 'w-2.5 h-2.5'
                    : shortRatio === '16:9'
                    ? 'w-3 h-2'
                    : shortRatio === '9:16'
                    ? 'w-2 h-3'
                    : shortRatio === '4:3'
                    ? 'w-2.5 h-2'
                    : 'w-3 h-2';

                return (
                  <button
                    key={ratio.label}
                    type="button"
                    onClick={() => {
                      setSelectedRatioIndex(idx);
                      playTapSound();
                    }}
                    className={
                      isSelected
                        ? 'group/rbtn flex flex-col items-center justify-center py-2 px-1 rounded-xl border bg-gradient-to-b from-[#ff2d87]/20 via-[#8b2cf5]/15 to-[#171724] border-[#ff2d87] text-white shadow-glow-chip transition-all duration-200 cursor-pointer active:scale-95'
                        : 'group/rbtn flex flex-col items-center justify-center py-2 px-1 rounded-xl border bg-[#14141d] hover:bg-[#1a1a26] border-[#222232] hover:border-gray-600 text-gray-400 hover:text-gray-200 transition-all duration-200 cursor-pointer active:scale-95'
                    }
                    title={`${ratio.label} (${ratio.width}×${ratio.height})`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <span
                        className={`${shapeSizeClass} rounded-[2px] shrink-0 inline-block ${
                          isSelected
                            ? 'border border-pink-400 bg-pink-500/40'
                            : 'border border-gray-500 bg-transparent'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-mono tracking-tight truncate ${
                          isSelected
                            ? 'font-bold text-white'
                            : 'font-semibold text-gray-300 group-hover/rbtn:text-white'
                        }`}
                      >
                        {shortRatio}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono tracking-tighter scale-95 origin-center ${
                        isSelected ? 'text-pink-300 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {ratio.width}×{ratio.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Puter Session Reset Notice */}
          {sessionResetMessage && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#121218] border border-pink-500/35 text-pink-300 text-xs font-mono flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>{sessionResetMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSessionResetMessage(null)}
                className="text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer p-0.5 flex items-center"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Soft-Red Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/35 border border-red-800/50 text-red-300 text-xs font-mono flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <span className="break-words leading-snug">{error}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(activeProvider?.requestType === 'sdk' ||
                  error.toLowerCase().includes('puter') ||
                  error.toLowerCase().includes('session')) && (
                  <button
                    type="button"
                    onClick={handleResetPuterSession}
                    disabled={isResettingSession}
                    className="px-2.5 py-1 rounded-lg bg-[#181822] hover:bg-[#222230] border border-pink-500/40 text-pink-300 text-[11px] font-mono font-semibold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCw size={11} className={isResettingSession ? 'animate-spin' : ''} />
                    {isResettingSession ? 'Resetting...' : 'Reset Session'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="w-6 h-6 rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-800/40 text-red-300 flex items-center justify-center cursor-pointer"
                  title="Dismiss error"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Puter Debug Info */}
          {activeProvider?.requestType === 'sdk' && puterDebugInfo && (
            <div className="p-3 rounded-xl bg-[#121218] border border-[#252536] text-[11px] font-mono text-gray-400">
              <div
                onClick={() => setShowPuterDebug(!showPuterDebug)}
                className="flex items-center justify-between cursor-pointer select-none text-pink-400 font-semibold"
              >
                <span>Puter SDK Diagnostics</span>
                <span className="text-[10px]">{showPuterDebug ? '▲ Hide' : '▼ Show'}</span>
              </div>
              {showPuterDebug && (
                <div className="mt-2 flex flex-col gap-1 text-[10px]">
                  <div>
                    • Script Appended:{' '}
                    <span className={puterDebugInfo.scriptAppended ? 'text-emerald-400' : 'text-red-400'}>
                      {String(puterDebugInfo.scriptAppended)}
                    </span>
                    {puterDebugInfo.scriptAppendedAt && (
                      <span className="text-gray-500 ml-1">
                        ({puterDebugInfo.scriptAppendedAt.split('T')[1]?.slice(0, 8)})
                      </span>
                    )}
                  </div>
                  <div>
                    • Onload Fired:{' '}
                    <span className={puterDebugInfo.onloadFired ? 'text-emerald-400' : 'text-red-400'}>
                      {String(puterDebugInfo.onloadFired)}
                    </span>
                    {puterDebugInfo.onloadFiredAt && (
                      <span className="text-gray-500 ml-1">
                        ({puterDebugInfo.onloadFiredAt.split('T')[1]?.slice(0, 8)})
                      </span>
                    )}
                  </div>
                  <div>
                    • Onerror Fired:{' '}
                    <span className={puterDebugInfo.onerrorFired ? 'text-red-400' : 'text-emerald-400'}>
                      {String(puterDebugInfo.onerrorFired)}
                    </span>
                    {puterDebugInfo.onerrorDetails && (
                      <span className="text-red-400 ml-1">({puterDebugInfo.onerrorDetails})</span>
                    )}
                  </div>
                  <div>
                    • typeof window.puter: <span className="text-white">"{puterDebugInfo.typeofWindowPuter}"</span>
                  </div>
                  <div>
                    • typeof window.puter?.ai:{' '}
                    <span className="text-white">"{puterDebugInfo.typeofWindowPuterAi}"</span>
                  </div>
                  <div>
                    • typeof window.puter?.ai?.txt2img:{' '}
                    <span
                      className={
                        puterDebugInfo.typeofWindowPuterAiTxt2img === 'function'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }
                    >
                      "{puterDebugInfo.typeofWindowPuterAiTxt2img}"
                    </span>
                  </div>
                  <div>
                    • window.puter Keys:{' '}
                    <span className="text-pink-300 break-all">
                      {JSON.stringify(puterDebugInfo.windowPuterTopLevelKeys)}
                    </span>
                  </div>
                  {puterDebugInfo.error && (
                    <div className="text-red-400 mt-0.5">• Error: {puterDebugInfo.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. FULL-WIDTH GENERATE BUTTON & SLIM LOADING BAR */}
          <div className="flex flex-col gap-2.5">
            <button
              id="generate-image-btn"
              type="button"
              onClick={() => handleGenerate()}
              disabled={loading || !prompt.trim()}
              className={`stitch-generate-btn w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#ff2d87] via-[#d42cf5] to-[#8b2cf5] text-white font-mono font-bold text-sm tracking-wide shadow-glow-pink hover:opacity-95 active:scale-[0.98] transition flex items-center justify-center gap-2 relative overflow-hidden group border-0 cursor-pointer disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${
                loading ? 'stitch-generate-btn-busy' : ''
              }`}
            >
              <span className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              {loading ? (
                loadingPhase === 'enhancing' ? (
                  <>
                    <Wand2 size={17} className="animate-spin shrink-0" />
                    <span>REFINING WITH AI...</span>
                  </>
                ) : (
                  <>
                    <RotateCw size={17} className="animate-spin shrink-0" />
                    <span>
                      {referenceImage ? 'SYNTHESIZING EDITED IMAGE...' : 'SYNTHESIZING IMAGE...'}
                    </span>
                  </>
                )
              ) : referenceImage ? (
                <>
                  <Wand2 size={17} className="shrink-0" />
                  <span>EDIT IMAGE (IMG2IMG)</span>
                </>
              ) : (
                <>
                  <Sparkles size={17} className="shrink-0" />
                  <span>GENERATE ARTWORK</span>
                </>
              )}
            </button>

            {/* Slim Indeterminate Loading Bar (shown when loading is active; real state only) */}
            {loading && (
              <div className="flex flex-col gap-1.5 px-1">
                <div className="flex items-center justify-between text-[10px] font-mono gap-2">
                  <span className="text-pink-400 flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping shrink-0" />
                    <span className="truncate">
                      {loadingPhase === 'enhancing'
                        ? 'Refining prompt with Smart AI...'
                        : failoverNotice ||
                          `Synthesizing via ${activeProvider?.name || 'AI Engine'}...`}
                    </span>
                  </span>
                  <span className="text-gray-400 shrink-0 uppercase">
                    {loadingPhase === 'enhancing' ? 'AI REWRITE' : 'RENDERING'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#161620] rounded-full overflow-hidden p-[1px]">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-[#ff2d87] via-[#8b2cf5] to-[#ff2d87] stitch-loading-shimmer" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Primary Render Output & Your Creations Gallery */}
        <div className="lg:col-span-6 flex flex-col gap-5 min-w-0">
          {/* 6. RESULT CARD ("Primary Render Output") */}
          <div className="flex flex-col gap-2.5">
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-mono uppercase tracking-wider text-gray-300 font-semibold">
                  Primary Render Output
                </span>
                {currentImage?.referenceImageUrl && (
                  <span className="text-[10px] font-mono font-bold bg-pink-500/15 text-pink-300 px-2 py-0.5 rounded-md border border-pink-500/30 inline-flex items-center gap-1">
                    <ArrowRightLeft size={10} /> Before &amp; After
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {currentImage?.referenceImageUrl && (
                  <div className="flex bg-[#121218] rounded-lg p-0.5 border border-[#252534]">
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonLayout('side-by-side');
                        playTapSound();
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold inline-flex items-center gap-1 border-0 cursor-pointer transition ${
                        comparisonLayout === 'side-by-side'
                          ? 'bg-pink-500/25 text-pink-300'
                          : 'bg-transparent text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <Columns size={10} /> Side-by-Side
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonLayout('result-only');
                        playTapSound();
                      }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold inline-flex items-center gap-1 border-0 cursor-pointer transition ${
                        comparisonLayout === 'result-only'
                          ? 'bg-pink-500/25 text-pink-300'
                          : 'bg-transparent text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <ImageIcon size={10} /> Result Only
                    </button>
                  </div>
                )}

                <span
                  id="render-dimension-badge"
                  className="text-[10px] font-mono text-gray-400 bg-[#16161f] px-2 py-0.5 rounded border border-[#252534]"
                >
                  {currentImage
                    ? `${currentImage.width} × ${currentImage.height} • Seed ${currentImage.seed}`
                    : `${ASPECT_RATIOS[selectedRatioIndex]?.width} × ${ASPECT_RATIOS[selectedRatioIndex]?.height}`}
                </span>
              </div>
            </div>

            {/* Render Card Container */}
            <div className="relative rounded-2xl overflow-hidden bg-[#121218] border border-[#232332] shadow-2xl flex flex-col">
              {loading ? (
                <div
                  className="w-full min-h-[340px] flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#0c0c12]"
                  style={{
                    aspectRatio: `${ASPECT_RATIOS[selectedRatioIndex]?.width || 1024} / ${
                      ASPECT_RATIOS[selectedRatioIndex]?.height || 1024
                    }`,
                    maxHeight: '480px',
                  }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff2d87]/20 to-[#8b2cf5]/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shadow-glow-subtle">
                    {loadingPhase === 'enhancing' ? (
                      <Wand2 size={26} className="animate-spin" />
                    ) : (
                      <RotateCw size={26} className="animate-spin" />
                    )}
                  </div>
                  <div className="max-w-xs">
                    <h4 className="m-0 text-sm font-mono font-bold text-white uppercase tracking-wide">
                      {loadingPhase === 'enhancing'
                        ? 'Refining Prompt with Smart AI...'
                        : 'Synthesizing Visual Output...'}
                    </h4>
                    <p
                      className={`mt-1.5 mb-0 text-xs font-mono leading-relaxed ${
                        failoverNotice ? 'text-amber-300 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {loadingPhase === 'enhancing'
                        ? 'Rewriting scene description with lighting & detail...'
                        : failoverNotice ||
                          `Active Engine: ${activeProvider?.name || 'Image Provider'}`}
                    </p>
                  </div>
                </div>
              ) : currentImage ? (
                <div className="flex flex-col stitch-result-fade-in">
                  {/* Image Display: Side-by-Side Comparison vs Single View */}
                  {currentImage.referenceImageUrl && comparisonLayout === 'side-by-side' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-[#0a0a0f]">
                      {/* Before: Reference Image */}
                      <div className="rounded-xl overflow-hidden bg-[#121218] border border-[#232332] flex flex-col">
                        <div className="px-2.5 py-1.5 bg-[#161620] border-b border-[#232332] text-[10px] font-mono text-gray-400 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <ImagePlus size={11} className="text-gray-400" /> BEFORE (Reference)
                          </span>
                          <span>Input</span>
                        </div>
                        <div className="relative flex-1 flex items-center justify-center min-h-[220px] max-h-[420px] bg-[#070709] overflow-hidden">
                          <img
                            src={currentImage.referenceImageUrl}
                            alt="Reference Before"
                            className="w-full h-full max-h-[420px] object-contain block"
                          />
                        </div>
                      </div>

                      {/* After: AI Edited Result */}
                      <div className="rounded-xl overflow-hidden bg-[#121218] border border-pink-500/40 shadow-glow-subtle flex flex-col relative">
                        <div className="px-2.5 py-1.5 bg-pink-500/10 border-b border-pink-500/25 text-[10px] font-mono text-pink-300 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 font-bold">
                            <Sparkles size={11} className="text-pink-400" /> AFTER (Edited)
                          </span>
                          <span className="bg-pink-500/20 px-1.5 py-0.5 rounded text-[9px]">
                            {currentImage.model || 'kontext'}
                          </span>
                        </div>
                        <div className="relative flex-1 flex items-center justify-center min-h-[220px] max-h-[420px] bg-[#070709] overflow-hidden">
                          <img
                            src={currentImage.url}
                            alt={currentImage.prompt}
                            className="w-full h-full max-h-[420px] object-contain block cursor-pointer"
                            onClick={() => setFullscreenImage(currentImage)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Single Render Preview Container following image/selected aspect ratio */
                    <div
                      id="render-preview-container"
                      className="relative w-full mx-auto bg-[#09090d] overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: `${currentImage.width || ASPECT_RATIOS[selectedRatioIndex]?.width || 1024} / ${
                          currentImage.height || ASPECT_RATIOS[selectedRatioIndex]?.height || 1024
                        }`,
                        maxHeight: '520px',
                      }}
                    >
                      <img
                        src={currentImage.url}
                        alt={currentImage.prompt}
                        className="w-full h-full object-contain block cursor-pointer"
                        onClick={() => setFullscreenImage(currentImage)}
                      />

                      {/* Top Overlay Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-[10px] font-mono text-gray-200 flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                          <span className="truncate">
                            {currentImage.model || currentImage.providerName} • #{currentImage.seed}
                          </span>
                        </span>

                        {currentImage.isFavorite && (
                          <span className="px-2 py-1 rounded-lg bg-pink-500/25 backdrop-blur-md border border-pink-500/40 text-[10px] font-mono text-pink-300 flex items-center gap-1 shrink-0">
                            <Heart size={10} className="fill-pink-400 text-pink-400" /> Liked
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottom Details & Stitch 5-Button Action Row */}
                  <div className="p-3.5 bg-[#121218] border-t border-[#1e1e29] flex flex-col gap-3">
                    {/* Prompt & Real Metadata */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-pink-400 font-semibold">
                            {currentImage.providerName}
                          </span>
                          {currentImage.isEdit && (
                            <span className="text-[9px] font-mono font-bold bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded border border-pink-500/30 inline-flex items-center gap-1">
                              <Wand2 size={9} /> img2img
                            </span>
                          )}
                          {currentImage.enhancedPrompt && (
                            <span className="text-[9px] font-mono font-bold bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/30 inline-flex items-center gap-1">
                              <Sparkles size={9} /> Smart AI Enhanced
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) =>
                              handleCopyGalleryPrompt(e, currentImage.prompt, currentImage.id)
                            }
                            className="text-[10px] font-mono text-gray-400 hover:text-pink-300 bg-transparent border-0 cursor-pointer inline-flex items-center gap-1 p-0 transition"
                            title="Copy prompt text"
                          >
                            {copiedPromptId === currentImage.id ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-400">Prompt Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy Prompt</span>
                              </>
                            )}
                          </button>
                          <a
                            href={currentImage.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-mono text-gray-400 hover:text-white no-underline inline-flex items-center gap-1 transition"
                            title="Open image in new tab"
                          >
                            <ExternalLink size={11} />
                            <span>Open</span>
                          </a>
                        </div>
                      </div>

                      <p className="m-0 text-xs text-gray-200 leading-relaxed line-clamp-2 font-sans">
                        "{currentImage.prompt}"
                      </p>

                      {currentImage.originalPrompt &&
                        currentImage.originalPrompt !== currentImage.prompt && (
                          <p className="m-0 text-[11px] text-gray-500 italic line-clamp-1">
                            Original: "{currentImage.originalPrompt}"
                          </p>
                        )}
                    </div>

                    {/* Stitch 5-Column Quick Action Bar: Expand, Save/Download, Favorite, Remix/Edit, Copy */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {/* 1. Expand */}
                      <button
                        type="button"
                        onClick={() => setFullscreenImage(currentImage)}
                        className="py-2 px-1 rounded-xl bg-[#181822] hover:bg-[#222230] border border-[#262635] text-gray-200 flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Expand Fullscreen"
                      >
                        <Maximize2 size={14} className="text-pink-400" />
                        <span className="text-[9px] font-mono">Expand</span>
                      </button>

                      {/* 2. Save / Download */}
                      <button
                        id="download-image-btn"
                        type="button"
                        onClick={() => handleDownload(currentImage)}
                        disabled={downloading}
                        className="py-2 px-1 rounded-xl bg-[#181822] hover:bg-[#222230] border border-[#262635] text-gray-200 flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Download Image"
                      >
                        {downloading ? (
                          <RotateCw size={14} className="animate-spin text-emerald-400" />
                        ) : (
                          <Download size={14} className="text-emerald-400" />
                        )}
                        <span className="text-[9px] font-mono">
                          {downloading ? 'Saving' : 'Save'}
                        </span>
                      </button>

                      {/* 3. Favorite */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, currentImage.id)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer ${
                          currentImage.isFavorite
                            ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                            : 'bg-[#181822] hover:bg-[#222230] border-[#262635] text-gray-200'
                        }`}
                        title={
                          currentImage.isFavorite ? 'Remove from favorites' : 'Add to favorites'
                        }
                      >
                        <Heart
                          size={14}
                          className={`stitch-heart-icon ${
                            currentImage.isFavorite
                              ? 'text-pink-400 fill-pink-400'
                              : 'text-pink-400'
                          }`}
                        />
                        <span className="text-[9px] font-mono">
                          {currentImage.isFavorite ? 'Liked' : 'Favorite'}
                        </span>
                      </button>

                      {/* 4. Remix / Edit (Use as Reference) */}
                      <button
                        type="button"
                        onClick={() => handleUseAsReference(currentImage.url)}
                        className="py-2 px-1 rounded-xl bg-[#181822] hover:bg-[#222230] border border-[#262635] text-gray-200 flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Load this result as the reference image to edit or remix it"
                      >
                        <Wand2 size={14} className="text-violet-400" />
                        <span className="text-[9px] font-mono">Remix</span>
                      </button>

                      {/* 5. Copy URL */}
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(currentImage.url)}
                        className="py-2 px-1 rounded-xl bg-[#181822] hover:bg-[#222230] border border-[#262635] text-gray-200 flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Copy image URL"
                      >
                        {copiedUrl ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Copy size={14} className="text-cyan-400" />
                        )}
                        <span className="text-[9px] font-mono">
                          {copiedUrl ? 'Copied' : 'Copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty Output State */
                <div
                  className="w-full min-h-[320px] flex flex-col items-center justify-center gap-3 p-6 text-center bg-[#0c0c12]"
                  style={{
                    aspectRatio: `${ASPECT_RATIOS[selectedRatioIndex]?.width || 1024} / ${
                      ASPECT_RATIOS[selectedRatioIndex]?.height || 1024
                    }`,
                    maxHeight: '440px',
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400">
                    <ImageIcon size={24} />
                  </div>
                  <div className="max-w-xs">
                    <h4 className="m-0 text-sm font-mono font-bold text-gray-200">
                      Ready for Synthesis
                    </h4>
                    <p className="mt-1 mb-0 text-xs text-gray-400 leading-relaxed">
                      Enter a prompt and click Generate Artwork to render high-fidelity visuals.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* YOUR CREATIONS Gallery Section (IndexedDB Persistent) */}
          <section className="space-y-3 pt-1">
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-mono uppercase tracking-wider text-gray-300 font-bold m-0">
                  YOUR CREATIONS
                </h3>
                <span className="bg-[#181822] text-gray-300 border border-[#2a2a38] px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold">
                  {history.length}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-300">
                  <Database size={10} className="text-emerald-400" /> IndexedDB
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setGalleryModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-mono text-pink-400 hover:text-pink-300 bg-pink-500/10 hover:bg-pink-500/15 border border-pink-500/25 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                title="Open full photo gallery grid view"
              >
                <ImageIcon size={12} />
                <span>See Full Gallery</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Gallery Action Toolbar */}
            <div className="flex items-center justify-between gap-1.5 bg-[#121218] border border-[#1e1e29] p-2 rounded-xl text-xs font-mono flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (gallerySelectionMode) {
                      handleCancelSelectionMode();
                    } else {
                      handleOpenSelectionMode();
                    }
                  }}
                  disabled={history.length === 0}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    gallerySelectionMode
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300 font-semibold'
                      : 'bg-[#181822] hover:bg-[#222230] text-gray-200 border-[#262635]'
                  }`}
                  title={gallerySelectionMode ? 'Exit selection mode' : 'Select images to export'}
                >
                  <CheckSquare size={12} className="text-pink-400" />
                  <span>{gallerySelectionMode ? 'Selecting' : 'Select'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllImages}
                  disabled={history.length === 0 || backupExporting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181822] hover:bg-[#222230] text-gray-300 border border-[#262635] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Export all saved images to a JSON backup file"
                >
                  {backupExporting ? (
                    <RotateCw size={12} className="animate-spin text-pink-400" />
                  ) : (
                    <Download size={12} />
                  )}
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    backupFileInputRef.current?.click();
                  }}
                  disabled={backupImporting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181822] hover:bg-[#222230] text-gray-300 border border-[#262635] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Restore images from a JSON backup file"
                >
                  {backupImporting ? (
                    <RotateCw size={12} className="animate-spin text-purple-400" />
                  ) : (
                    <Upload size={12} />
                  )}
                  <span>Restore</span>
                </button>
              </div>

              {history.length > 0 && (
                <button
                  id="clear-image-history-btn"
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40 transition-all cursor-pointer"
                  title="Delete all saved generations from IndexedDB"
                >
                  <Trash2 size={12} />
                  <span>Purge</span>
                </button>
              )}
            </div>

            {/* 2-Column Creations Grid */}
            {history.length === 0 ? (
              <div className="rounded-2xl bg-[#121218] border border-[#1e1e29] p-6 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#181822] border border-[#262635] flex items-center justify-center text-gray-500">
                  <ImageIcon size={18} />
                </div>
                <p className="m-0 text-xs font-mono text-gray-400">
                  No saved creations yet. Generated artwork is automatically stored in IndexedDB.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {history.map((item) => {
                  const isSelected = selectedImageIds.has(item.id);
                  const isCurrent = currentImage?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (gallerySelectionMode) {
                          handleToggleSelectImage(item.id);
                          return;
                        }
                        setCurrentImage(item);
                        playTapSound();
                      }}
                      className={`group relative rounded-xl overflow-hidden bg-[#121218] transition-all cursor-pointer stitch-gallery-card ${
                        gallerySelectionMode && isSelected
                          ? 'border-2 border-pink-500 shadow-glow-subtle'
                          : isCurrent
                          ? 'border-2 border-pink-500/80 shadow-glow-subtle'
                          : 'border border-[#232331] hover:border-gray-600'
                      }`}
                      title={`"${item.prompt}" — ${item.providerName} (Seed: ${item.seed})`}
                    >
                      <div className="aspect-square overflow-hidden relative bg-[#0c0c12]">
                        <img
                          src={item.url}
                          alt={item.prompt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25 opacity-90 pointer-events-none" />

                        {/* Top-left: Selection Checkmark OR Active indicator */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                          {gallerySelectionMode ? (
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all stitch-check-pop ${
                                isSelected
                                  ? 'bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] text-white shadow-md'
                                  : 'bg-black/65 backdrop-blur-md border border-white/30 text-transparent'
                              }`}
                            >
                              <Check size={13} strokeWidth={3} />
                            </div>
                          ) : isCurrent ? (
                            <span className="px-1.5 py-0.5 rounded bg-pink-500/85 text-white text-[9px] font-mono font-bold uppercase tracking-wider shadow">
                              Active
                            </span>
                          ) : null}

                          {/* Edit / Enhanced tags */}
                          {(item.isEdit || item.referenceImageUrl) && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-600/90 text-white text-[9px] font-mono font-bold shadow"
                              title="Image Edit (img2img)"
                            >
                              <Wand2 size={9} /> Edit
                            </span>
                          )}
                          {item.enhancedPrompt && !(item.isEdit || item.referenceImageUrl) && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600/90 text-white text-[9px] font-mono font-semibold shadow"
                              title="Smart AI Enhanced prompt"
                            >
                              <Wand2 size={9} /> AI
                            </span>
                          )}
                        </div>

                        {/* Top-right: Favorite Heart + Fullscreen + Delete */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(e, item.id)}
                            className={`w-6 h-6 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer stitch-heart-btn ${
                              item.isFavorite
                                ? 'bg-pink-500/25 border-pink-500/60 text-pink-400'
                                : 'bg-black/60 border-white/15 text-gray-300 hover:text-pink-400'
                            }`}
                            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart
                              size={12}
                              className={item.isFavorite ? 'fill-current stitch-heart-pop' : ''}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTapSound();
                              setFullscreenImage(item);
                            }}
                            className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
                            title="Open fullscreen viewer"
                          >
                            <Maximize2 size={11} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteImage(e, item.id)}
                            className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                            title="Delete this image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Card Footer: Real Prompt Snippet + Real Model Tag + Copy Prompt */}
                      <div className="p-2 flex items-center justify-between gap-1.5 bg-[#14141d] border-t border-[#1e1e29]">
                        <span className="truncate text-[10px] font-mono text-gray-300 flex-1 min-w-0">
                          {item.prompt}
                        </span>
                        <span className="text-[9px] font-mono text-pink-300 bg-pink-500/15 border border-pink-500/20 px-1.5 py-0.5 rounded shrink-0 max-w-[88px] truncate">
                          {item.model || item.providerName}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyGalleryPrompt(e, item.prompt, item.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            copiedPromptId === item.id
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-[#1e1e2a] text-gray-400 hover:text-white'
                          }`}
                          title={copiedPromptId === item.id ? 'Prompt copied!' : 'Copy prompt'}
                        >
                          {copiedPromptId === item.id ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Floating / Inline Selection Mode Bar when selecting on main page */}
            {gallerySelectionMode && !galleryModalOpen && (
              <div className="sticky bottom-3 z-30 bg-[#161622]/95 backdrop-blur-xl border border-pink-500/40 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedImageIds.size} {selectedImageIds.size === 1 ? 'item' : 'items'} selected
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllDisplayed}
                    className="px-2.5 py-1.5 rounded-lg bg-[#222230] hover:bg-[#2c2c3e] text-gray-200 border border-[#343448] text-[11px] font-mono cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    disabled={selectedImageIds.size === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-[#222230] hover:bg-[#2c2c3e] text-gray-300 border border-[#343448] text-[11px] font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSelected}
                    disabled={selectedImageIds.size === 0 || backupExporting}
                    className="px-2.5 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-[11px] font-mono font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {backupExporting ? (
                      <RotateCw size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    <span>Download Selected</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSelectionMode}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1c1c28] hover:bg-[#252535] text-gray-300 border border-[#2d2d3d] text-[11px] font-mono cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 8a. Full Photo Gallery Overlay Modal (Stitch Dark Theme) */}
      {galleryModalOpen && (
        <div
          className="fixed inset-0 z-[99990] bg-[#070709]/95 backdrop-blur-xl flex flex-col overflow-hidden stitch-modal-backdrop"
          onClick={() => setGalleryModalOpen(false)}
        >
          <div
            className="w-full h-full flex flex-col max-w-[1440px] mx-auto stitch-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Compact Sticky Modal Header + Filters */}
            <div className="bg-[#08080a]/95 backdrop-blur-xl border-b border-[#1c1c26] px-4 py-3.5 flex flex-col gap-3 shrink-0">
              {/* Row 1: Title + Count + Actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2d87]/20 to-[#8b2cf5]/20 border border-pink-500/35 flex items-center justify-center text-pink-400 shrink-0">
                    <ImageIcon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="m-0 text-sm sm:text-base font-bold text-white tracking-tight">
                        Photo Gallery
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                          galleryModelFilter || galleryFavoritesOnly
                            ? 'bg-pink-500/15 border-pink-500/35 text-pink-300 font-semibold'
                            : 'bg-[#17171f] border-[#262635] text-gray-300'
                        }`}
                      >
                        {displayedGalleryImages.length} {displayedGalleryImages.length === 1 ? 'image' : 'images'}
                        {galleryModelFilter && ` (filtered from ${history.length})`}
                      </span>
                    </div>
                    <p className="m-0 mt-0.5 text-[10px] font-mono text-gray-400 truncate">
                      All saved AI generations in IndexedDB • Tap any thumbnail for full resolution
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!gallerySelectionMode && (
                    <button
                      type="button"
                      onClick={handleOpenSelectionMode}
                      className="px-2.5 py-1.5 rounded-lg bg-[#17171f] hover:bg-[#22222e] border border-[#2a2a38] text-xs font-mono text-pink-300 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Select images to download"
                    >
                      <CheckSquare size={13} className="text-pink-400" />
                      <span>Select Images</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setGalleryModalOpen(false);
                      setGallerySelectionMode(false);
                      setSelectedImageIds(new Set());
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#17171f] hover:bg-[#232330] border border-[#2a2a38] text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Close gallery"
                  >
                    <X size={14} />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* Selection Mode Bar inside Gallery Modal */}
              {gallerySelectionMode && (
                <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2d87]/15 via-[#181824] to-[#8b2cf5]/15 border border-pink-500/40 shadow-glow-subtle">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] flex items-center justify-center text-white shadow">
                      <Check size={13} strokeWidth={3} />
                    </div>
                    <span className="text-xs font-mono font-bold text-white">
                      {selectedImageIds.size} {selectedImageIds.size === 1 ? 'image' : 'images'} selected
                    </span>
                    <span className="text-[11px] font-mono text-gray-400 hidden sm:inline">
                      • Tap thumbnails to toggle
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectAllDisplayed}
                      className="px-2.5 py-1 rounded-lg bg-[#1c1c28] hover:bg-[#262636] border border-[#2e2e40] text-gray-200 text-[11px] font-mono inline-flex items-center gap-1.5 cursor-pointer"
                      title="Select all images currently displayed"
                    >
                      <CheckSquare size={12} className="text-pink-400" />
                      <span>Select All ({displayedGalleryImages.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={selectedImageIds.size === 0}
                      className="px-2.5 py-1 rounded-lg bg-[#1c1c28] hover:bg-[#262636] border border-[#2e2e40] text-gray-300 text-[11px] font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Clear all selections"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSelected}
                      disabled={selectedImageIds.size === 0 || backupExporting}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] text-white text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 shadow-glow-subtle cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Download selected images into a backup JSON file"
                    >
                      {backupExporting ? (
                        <RotateCw size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      <span>
                        Download Selected {selectedImageIds.size > 0 && `(${selectedImageIds.size})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelSelectionMode}
                      className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 text-[11px] font-mono cursor-pointer"
                      title="Leave selection mode"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2: Sort & Filter Controls Toolbar (Model Dropdown, Favorites Filter, Newest/Oldest Sort) */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#1c1c26]">
                {/* Left: Model Filter Dropdown */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-gray-400 inline-flex items-center gap-1">
                    <Filter size={11} className="text-pink-400" /> Model:
                  </span>
                  <select
                    value={galleryModelFilter || 'all'}
                    onChange={(e) => {
                      playTapSound();
                      setGalleryModelFilter(e.target.value === 'all' ? null : e.target.value);
                    }}
                    className="bg-[#121218] border border-[#262635] text-gray-200 text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-pink-500 cursor-pointer"
                  >
                    <option value="all">All Models ({history.length})</option>
                    {distinctGalleryModels.map((m) => {
                      const count = history.filter((item) => (item.model || item.providerName) === m).length;
                      return (
                        <option key={`filter-model-${m}`} value={m}>
                          {m} ({count})
                        </option>
                      );
                    })}
                  </select>

                  {galleryModelFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setGalleryModelFilter(null);
                      }}
                      className="text-[11px] font-mono text-pink-400 hover:text-pink-300 underline cursor-pointer px-1"
                    >
                      Clear filter
                    </button>
                  )}
                </div>

                {/* Right: Favorites Filter + Sort Newest | Oldest */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setGalleryFavoritesOnly((prev) => !prev);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                      galleryFavoritesOnly
                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 font-semibold shadow-glow-subtle'
                        : 'bg-[#121218] border-[#262635] text-gray-300 hover:text-white'
                    }`}
                    title={galleryFavoritesOnly ? 'Show all images' : 'Show only favorites'}
                  >
                    <Heart
                      size={12}
                      className={
                        galleryFavoritesOnly
                          ? 'text-pink-400 fill-current stitch-heart-pop'
                          : 'text-pink-400'
                      }
                    />
                    <span>Favorites ({favoritesCount})</span>
                  </button>

                  <div className="flex items-center bg-[#121218] border border-[#262635] rounded-lg p-0.5 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setGallerySortOrder('newest');
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        gallerySortOrder === 'newest'
                          ? 'bg-[#222230] text-white font-semibold border border-pink-500/30'
                          : 'text-gray-400 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      Newest
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setGallerySortOrder('oldest');
                      }}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        gallerySortOrder === 'oldest'
                          ? 'bg-[#222230] text-white font-semibold border border-pink-500/30'
                          : 'text-gray-400 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      Oldest
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Grid Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {history.length === 0 ? (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-400 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#121218] border border-[#262635] flex items-center justify-center text-gray-500">
                    <ImageIcon size={24} />
                  </div>
                  <p className="text-sm font-mono m-0">No saved images found in gallery yet.</p>
                </div>
              ) : displayedGalleryImages.length === 0 ? (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-400 gap-3 text-center">
                  {galleryFavoritesOnly ? (
                    <>
                      <Heart size={36} className="text-pink-400/50" />
                      <p className="text-sm font-mono font-bold text-gray-200 m-0">No favorites yet</p>
                      <p className="text-xs font-mono text-gray-400 m-0 max-w-xs">
                        Tap the heart icon on any image thumbnail to add it to your favorites.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setGalleryFavoritesOnly(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/35 text-pink-300 text-xs font-mono cursor-pointer"
                      >
                        Show all images
                      </button>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={36} className="text-gray-500" />
                      <p className="text-sm font-mono text-gray-200 m-0">No images from this model yet.</p>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setGalleryModelFilter(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/35 text-pink-300 text-xs font-mono cursor-pointer"
                      >
                        Show all models
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {displayedGalleryImages.map((item) => {
                    const isSelected = selectedImageIds.has(item.id);
                    return (
                      <div
                        key={`gallery-grid-${item.id}`}
                        onClick={() => {
                          if (gallerySelectionMode) {
                            handleToggleSelectImage(item.id);
                            return;
                          }
                          playTapSound();
                          setFullscreenImage(item);
                        }}
                        className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-[#121218] transition-all stitch-gallery-card ${
                          gallerySelectionMode && isSelected
                            ? 'border-2 border-pink-500 shadow-glow-subtle'
                            : 'border border-[#232331] hover:border-gray-500'
                        }`}
                        title={
                          gallerySelectionMode
                            ? isSelected
                              ? 'Selected - tap to deselect'
                              : 'Tap to select'
                            : `"${item.prompt}"\nProvider: ${item.providerName || 'AI Studio'} (Seed: ${item.seed})`
                        }
                      >
                        <img
                          src={item.url}
                          alt={item.prompt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />

                        {/* Selection Mode Overlay & Checkmark */}
                        {gallerySelectionMode && (
                          <>
                            {isSelected && (
                              <div className="absolute inset-0 bg-pink-500/15 pointer-events-none z-[6]" />
                            )}
                            <div
                              className={`absolute bottom-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center z-[15] backdrop-blur-md transition-all pointer-events-none stitch-check-pop ${
                                isSelected
                                  ? 'bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] border border-pink-400 text-white shadow-glow-subtle'
                                  : 'bg-black/65 border border-white/40 text-transparent'
                              }`}
                            >
                              {isSelected ? (
                                <Check size={15} strokeWidth={3} className="text-white" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-xs border border-white/50" />
                              )}
                            </div>
                          </>
                        )}

                        {/* Bottom gradient with real prompt + real model & seed */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-85 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 pointer-events-none">
                          <p className="m-0 text-white text-[10px] font-mono leading-snug line-clamp-2">
                            {item.prompt}
                          </p>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[9px] font-mono text-pink-300">
                            <span className="truncate">{item.model || item.providerName || 'AI'}</span>
                            <span className="text-gray-400 shrink-0">#{item.seed}</span>
                          </div>
                        </div>

                        {/* Top-left: Edit / Enhanced badge */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10 pointer-events-none">
                          {(item.isEdit || item.referenceImageUrl) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-600/90 text-white text-[9px] font-mono font-bold shadow">
                              <Wand2 size={9} /> Edit
                            </span>
                          )}
                          {item.enhancedPrompt && !(item.isEdit || item.referenceImageUrl) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-600/90 text-white text-[9px] font-mono font-semibold shadow">
                              <Wand2 size={9} /> Enhanced
                            </span>
                          )}
                        </div>

                        {/* Top-right: Copy Prompt Button */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyGalleryPrompt(e, item.prompt, item.id)}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer z-10 ${
                            copiedPromptId === item.id
                              ? 'bg-emerald-500/85 border-emerald-400 text-white'
                              : 'bg-black/60 border-white/20 text-white hover:bg-pink-500/80 hover:border-pink-400'
                          }`}
                          title={copiedPromptId === item.id ? 'Prompt copied to clipboard!' : 'Copy prompt'}
                          aria-label="Copy prompt"
                        >
                          {copiedPromptId === item.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>

                        {/* Bottom-right: Favorite Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, item.id)}
                          className={`absolute bottom-2 right-2 w-7 h-7 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer z-10 stitch-heart-btn ${
                            item.isFavorite
                              ? 'bg-pink-500/30 border-pink-400 text-pink-400 shadow-glow-subtle'
                              : 'bg-black/55 border-white/20 text-white/80 hover:text-pink-400'
                          }`}
                          title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart
                            size={14}
                            className={item.isFavorite ? 'fill-current stitch-heart-pop' : ''}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8b. Fullscreen Lightbox Viewer Modal (Stitch Dark Theme) */}
      {fullscreenImage && (
        <div
          className={`fixed inset-0 z-[99999] flex flex-col justify-between select-none overflow-hidden stitch-modal-backdrop ${
            isTrueFullscreen ? 'bg-black p-0' : 'bg-black/95 backdrop-blur-2xl'
          }`}
          style={{
            touchAction: zoomLevel > 1 ? 'none' : 'pan-y',
          }}
          onClick={() => {
            if (zoomLevel > 1) {
              setZoomLevel(1);
              setPanOffset({ x: 0, y: 0 });
            } else if (isTrueFullscreen) {
              setIsTrueFullscreen(false);
            } else {
              setFullscreenImage(null);
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Viewer Bar (Hidden in True Edge-to-Edge Fullscreen) */}
          {!isTrueFullscreen && (
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f2b] bg-[#0b0b10]/90 backdrop-blur-md z-[100001] shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 min-w-0">
                {currentFullscreenIndex >= 0 && navigationImagesList.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-[#181822] border border-[#2b2b3a] text-[10px] font-mono text-pink-400 font-semibold shrink-0">
                    {String(currentFullscreenIndex + 1).padStart(2, '0')} /{' '}
                    {String(navigationImagesList.length).padStart(2, '0')}
                  </span>
                )}
                <span className="text-xs font-mono text-gray-300 truncate">
                  {fullscreenImage.model || fullscreenImage.providerName}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#15151f] border border-[#252533] text-[10px] font-mono text-gray-400">
                  {fullscreenImage.width}×{fullscreenImage.height}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center gap-1 bg-[#15151f] border border-[#2b2b3a] rounded-lg px-1.5 py-0.5 mr-1">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    className="px-1.5 py-0.5 text-xs font-mono text-gray-300 hover:text-white disabled:opacity-35 cursor-pointer"
                    title="Zoom Out (-)"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[10px] font-mono text-pink-300 hover:text-pink-200 cursor-pointer"
                    title="Reset Zoom (0)"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 4}
                    className="px-1.5 py-0.5 text-xs font-mono text-gray-300 hover:text-white disabled:opacity-35 cursor-pointer"
                    title="Zoom In (+)"
                  >
                    +
                  </button>
                </div>

                {/* Favorite Heart Button */}
                <button
                  type="button"
                  onClick={(e) => handleToggleFavorite(e, fullscreenImage.id)}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer stitch-heart-btn ${
                    fullscreenImage.isFavorite
                      ? 'bg-pink-500/25 border-pink-500/60 text-pink-400 shadow-glow-subtle'
                      : 'bg-[#181822] border-[#2b2b3a] text-gray-300 hover:text-pink-400'
                  }`}
                  title={fullscreenImage.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={fullscreenImage.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart
                    size={15}
                    className={fullscreenImage.isFavorite ? 'fill-current stitch-heart-pop' : ''}
                  />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImage(null);
                    setIsTrueFullscreen(false);
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="w-8 h-8 rounded-full bg-[#181822] hover:bg-[#242432] border border-[#2b2b3a] flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
                  title="Close viewer (Escape)"
                  aria-label="Close viewer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Floating Close + Favorite in True Edge-to-Edge Fullscreen */}
          {isTrueFullscreen && (
            <div className="fixed top-4 right-4 z-[100001] flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleToggleFavorite(e, fullscreenImage.id)}
                className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
                  fullscreenImage.isFavorite
                    ? 'bg-pink-500/30 border-pink-400 text-pink-400'
                    : 'bg-black/60 border-white/20 text-white'
                }`}
                title={fullscreenImage.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={16} className={fullscreenImage.isFavorite ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(null);
                  setIsTrueFullscreen(false);
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer"
                title="Close viewer (Escape)"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Center Viewport with Left/Right Arrows and Pannable/Zoomable Image */}
          <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
            {/* Previous Image Arrow */}
            {navigationImagesList.length > 1 && (
              <button
                type="button"
                onClick={handlePrevFullscreenImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 flex items-center justify-center text-white z-[100000] transition-all cursor-pointer"
                title="Previous image (Swipe right or Left Arrow)"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Next Image Arrow */}
            {navigationImagesList.length > 1 && (
              <button
                type="button"
                onClick={handleNextFullscreenImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 flex items-center justify-center text-white z-[100000] transition-all cursor-pointer"
                title="Next image (Swipe left or Right Arrow)"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
            )}

            <div
              className="relative flex items-center justify-center overflow-visible select-none stitch-modal-panel"
              style={{
                cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheelZoom}
              onClick={(e) => {
                if (zoomLevel <= 1) {
                  e.stopPropagation();
                  setIsTrueFullscreen((prev) => !prev);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleToggleZoom();
              }}
            >
              <img
                src={fullscreenImage.url}
                alt={fullscreenImage.prompt}
                style={{
                  width: isTrueFullscreen ? '100vw' : 'auto',
                  height: isTrueFullscreen ? '100vh' : 'auto',
                  maxWidth: isTrueFullscreen ? '100vw' : '90vw',
                  maxHeight: isTrueFullscreen ? '100vh' : '68vh',
                  borderRadius: isTrueFullscreen ? '0px' : '16px',
                  objectFit: 'contain',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  display: 'block',
                  pointerEvents: 'auto',
                  touchAction: zoomLevel > 1 ? 'none' : 'pan-y',
                }}
                className={isTrueFullscreen ? '' : 'border border-[#2b2b3a] shadow-2xl'}
                draggable={false}
                title={
                  zoomLevel > 1
                    ? 'Drag / scroll to pan image • Double click to reset'
                    : isTrueFullscreen
                    ? 'Click to toggle standard view • Double click to zoom'
                    : 'Click to expand edge-to-edge • Double click or scroll wheel to zoom'
                }
              />
            </div>
          </div>

          {/* Bottom Details & Action Drawer (Hidden in True Edge-to-Edge Fullscreen or when Zoomed) */}
          {!isTrueFullscreen && zoomLevel <= 1 && (
            <div
              className="bg-[#0e0e14]/95 border-t border-[#1f1f2b] p-4 space-y-3 z-[100001] shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-w-3xl mx-auto space-y-2.5">
                {/* Real Prompt + Copy Prompt */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    {fullscreenImage.enhancedPrompt && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-semibold">
                        <Wand2 size={10} /> Smart AI Enhanced Prompt
                      </span>
                    )}
                    <p className="m-0 text-xs font-mono text-gray-200 leading-relaxed break-words">
                      "{fullscreenImage.prompt}"
                    </p>
                    {fullscreenImage.originalPrompt &&
                      fullscreenImage.originalPrompt !== fullscreenImage.prompt && (
                        <p className="m-0 text-[11px] font-mono text-gray-400 italic">
                          Original: "{fullscreenImage.originalPrompt}"
                        </p>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) =>
                      handleCopyGalleryPrompt(e, fullscreenImage.prompt, fullscreenImage.id)
                    }
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                      copiedPromptId === fullscreenImage.id
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#181822] hover:bg-[#222230] border-[#2b2b3a] text-gray-300'
                    }`}
                  >
                    {copiedPromptId === fullscreenImage.id ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Real Metadata Pills (Model, Seed, Dimensions — NO fake CFG/Sampler) */}
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-[#161620] border border-[#252533] text-pink-300">
                    Model: {fullscreenImage.model || fullscreenImage.providerName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161620] border border-[#252533]">
                    Seed: {fullscreenImage.seed}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161620] border border-[#252533]">
                    {fullscreenImage.width}×{fullscreenImage.height}
                  </span>
                </div>

                {/* Bottom Action Buttons: Remix / Edit, Download, Favorite, Delete */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleUseAsReference(fullscreenImage);
                      setFullscreenImage(null);
                      setGalleryModalOpen(false);
                    }}
                    className="py-2 rounded-xl bg-[#181822] hover:bg-[#232332] border border-[#2b2b3a] text-xs font-mono text-gray-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Wand2 size={13} className="text-pink-400" />
                    <span>Edit / Remix</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(fullscreenImage)}
                    className="py-2 rounded-xl bg-gradient-to-r from-[#ff2d87] to-[#8b2cf5] text-xs font-mono font-bold text-white flex items-center justify-center gap-1.5 shadow-glow-pink transition-all cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(e, fullscreenImage.id)}
                    className={`py-2 rounded-xl border text-xs font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      fullscreenImage.isFavorite
                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 font-semibold'
                        : 'bg-[#181822] hover:bg-[#232332] border-[#2b2b3a] text-gray-200'
                    }`}
                  >
                    <Heart
                      size={13}
                      className={
                        fullscreenImage.isFavorite ? 'text-pink-400 fill-current' : 'text-pink-400'
                      }
                    />
                    <span>{fullscreenImage.isFavorite ? 'Favorited' : 'Favorite'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteImage(e, fullscreenImage.id)}
                    className="py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/40 text-xs font-mono text-red-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
