import { BrowserRouter,Route,Routes } from 'react-router-dom';
import { Layout } from '@/components';
import { HomePage, SearchPage, WeatherPage, NewsPage, MapPage, SavedPage, SettingsPage } from '@/pages';
export default function App(){return <BrowserRouter><Routes><Route element={<Layout/>}><Route path="/" element={<HomePage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/weather" element={<WeatherPage/>}/><Route path="/weather/map" element={<MapPage/>}/><Route path="/news" element={<NewsPage/>}/><Route path="/saved" element={<SavedPage/>}/><Route path="/settings" element={<SettingsPage/>}/></Route></Routes></BrowserRouter>}
