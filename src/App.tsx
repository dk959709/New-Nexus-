import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HomePage, SearchPage, WeatherPage, NewsPage, MapPage, SavedPage, SettingsPage, SpacePage, TelegramPage, DevicesPage } from '@/pages';
import { AssistantPage } from '@/pages/AssistantPage';
import { OfflineAIPage } from '@/pages/OfflineAIPage';
import { JarvisPage } from '@/pages/JarvisPage';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/jarvis" element={<JarvisPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/offline-ai" element={<OfflineAIPage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/weather/map" element={<MapPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/space" element={<SpacePage />} />
            <Route path="/telegram" element={<TelegramPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
