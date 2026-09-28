import { useState, useRef, useCallback, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { cleanMarkdownForSpeech } from '@/lib/format';
import { synthesizeEdgeAudio } from '@/lib/edgeTtsUtils';

export interface UseEdgeTtsOptions {
  onStopBrowserSpeech?: () => void;
}

export function useEdgeTts(options?: UseEdgeTtsOptions) {
  const [edgeTtsLoadingId, setEdgeTtsLoadingId] = useState<string | null>(null);
  const [edgeTtsPlayingId, setEdgeTtsPlayingId] = useState<string | null>(null);
  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const edgeTtsAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopEdgeTts = useCallback(() => {
    if (edgeTtsAudioRef.current) {
      edgeTtsAudioRef.current.pause();
      edgeTtsAudioRef.current.currentTime = 0;
      edgeTtsAudioRef.current.src = '';
      edgeTtsAudioRef.current = null;
    }
    setEdgeTtsPlayingId(null);
    setEdgeTtsLoadingId(null);
  }, []);

  const handleEdgeTtsSpeak = useCallback(
    async (text: string, id: string) => {
      // If clicking on the currently playing audio item, toggle pause/stop
      if (edgeTtsPlayingId === id) {
        stopEdgeTts();
        return;
      }

      // Stop any browser speech or previous Edge audio
      if (options?.onStopBrowserSpeech) {
        options.onStopBrowserSpeech();
      }
      stopEdgeTts();

      const cleanText = cleanMarkdownForSpeech(text);
      if (!cleanText) return;

      setEdgeTtsLoadingId(id);
      try {
        const edgeVoice = storage.getEdgeVoice() || 'en-US-AriaNeural';
        const blob = await synthesizeEdgeAudio(text, edgeVoice);
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        edgeTtsAudioRef.current = audio;

        audio.onplay = () => {
          setEdgeTtsPlayingId(id);
        };

        audio.onended = () => {
          setEdgeTtsPlayingId(null);
          if (edgeTtsAudioRef.current === audio) {
            edgeTtsAudioRef.current = null;
          }
          URL.revokeObjectURL(url);
        };

        audio.onerror = () => {
          setEdgeTtsPlayingId(null);
          if (edgeTtsAudioRef.current === audio) {
            edgeTtsAudioRef.current = null;
          }
          URL.revokeObjectURL(url);
        };

        await audio.play();
        setEdgeTtsPlayingId(id);
      } catch (err) {
        console.error('[JARVIS] Edge TTS generation error:', err);
        setEdgeTtsPlayingId(null);
      } finally {
        setEdgeTtsLoadingId(null);
      }
    },
    [edgeTtsPlayingId, options, stopEdgeTts],
  );

  const handleDownloadAudio = useCallback(
    async (text: string, id: string, query?: string) => {
      const cleanText = cleanMarkdownForSpeech(text);
      if (!cleanText) return;

      setDownloadingAudioId(id);
      try {
        const edgeVoice = storage.getEdgeVoice() || 'en-US-AriaNeural';
        const blob = await synthesizeEdgeAudio(text, edgeVoice);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sanitizedQuery = (query || 'jarvis-response')
          .slice(0, 35)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .toLowerCase();
        a.download = `jarvis_${sanitizedQuery}_${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setDownloadSuccessId(id);
        setTimeout(() => {
          setDownloadSuccessId((prev) => (prev === id ? null : prev));
        }, 2500);
      } catch (err) {
        console.error('[JARVIS] Edge TTS download error:', err);
      } finally {
        setDownloadingAudioId(null);
      }
    },
    [],
  );

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      if (edgeTtsAudioRef.current) {
        edgeTtsAudioRef.current.pause();
        edgeTtsAudioRef.current.src = '';
        edgeTtsAudioRef.current = null;
      }
    };
  }, []);

  return {
    edgeTtsLoadingId,
    edgeTtsPlayingId,
    downloadingAudioId,
    downloadSuccessId,
    handleEdgeTtsSpeak,
    handleDownloadAudio,
    stopEdgeTts,
  };
}
