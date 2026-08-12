import { useCallback, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function useSpeechSearch(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<SpeechRecognitionLike | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    !!((window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition);

  const start = useCallback(() => {
    const Ctor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.onresult = (event) => onText(event.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    ref.current = recognition;
    setListening(true);
    recognition.start();
  }, [onText]);

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
