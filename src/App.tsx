import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components';
import { AppBoundary } from '@/components/AppBoundary';
import { HomePage, SearchPage, WeatherPage, SettingsPage, VoiceAI } from '@/pages';
import { AssistantPage } from '@/pages/AssistantPage';
import { JarvisPage } from '@/pages/JarvisPage';
import { MultiChatPage } from '@/pages/MultiChatPage';

const SpacePage = lazy(() => import('@/pages/SpacePage').then((m) => ({ default: m.SpacePage })));
const MapPage = lazy(() => import('@/pages/MapPage').then((m) => ({ default: m.MapPage })));
const DevicesPage = lazy(() => import('@/pages/DevicesPage').then((m) => ({ default: m.DevicesPage })));
const TelegramPage = lazy(() => import('@/pages/TelegramPage').then((m) => ({ default: m.TelegramPage })));
const NewsPage = lazy(() => import('@/pages/NewsPage').then((m) => ({ default: m.NewsPage })));
const SavedPage = lazy(() => import('@/pages/SavedPage').then((m) => ({ default: m.SavedPage })));

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-cyan-400">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      <span className="text-xs font-mono text-slate-400 tracking-wider">INITIALIZING MODULE...</span>
    </div>
  );
}

export default function App() {
  return (
    <AppBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/jarvis" element={<JarvisPage />} />
            <Route path="/multi-chat" element={<MultiChatPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/voice-ai" element={<VoiceAI />} />
            <Route
              path="/devices"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <DevicesPage />
                </Suspense>
              }
            />
            <Route path="/weather" element={<WeatherPage />} />
            <Route
              path="/weather/map"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <MapPage />
                </Suspense>
              }
            />
            <Route
              path="/news"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <NewsPage />
                </Suspense>
              }
            />
            <Route
              path="/space"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <SpacePage />
                </Suspense>
              }
            />
            <Route
              path="/telegram"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <TelegramPage />
                </Suspense>
              }
            />
            <Route
              path="/saved"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <SavedPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppBoundary>
  );
}
