import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Search, X } from 'lucide-react';
import { api } from '@/services/api';
import type { WallpaperPhoto, WallpaperSetting } from '@/types';

const PRESETS = ['mountains', 'ocean', 'forest', 'city', 'space', 'abstract'];

export function WallpaperSelector({ value, onSelect }: { value: WallpaperSetting | null; onSelect: (wallpaper: WallpaperSetting | null) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<WallpaperPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.configStatus().then((status) => setEnabled(status.wallpapers)).catch(() => setEnabled(false));
  }, []);

  const search = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setError('');
    api.wallpapers(term.trim())
      .then(setPhotos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  if (enabled === false) {
    return (
      <section className="setting-row wallpaper-row">
        <div>
          <h2>Wallpaper</h2>
          <p>Add PEXELS_API_KEY to the server environment to enable photo backgrounds.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="setting-row wallpaper-row">
      <div className="wallpaper-head">
        <div>
          <h2><ImageIcon size={16} /> Wallpaper</h2>
          <p>Choose a background photo for the app. Photos provided by Pexels.</p>
        </div>
        {value && (
          <button className="danger-button" onClick={() => onSelect(null)} aria-label="Reset wallpaper">
            <X size={13} /> Reset Wallpaper
          </button>
        )}
      </div>

      <div className="wallpaper-search">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') search(query); }}
          placeholder="Search photos (e.g. aurora, desert)"
          aria-label="Search wallpapers"
        />
        <button className="search-submit" onClick={() => search(query)}>Search</button>
      </div>

      <div className="wallpaper-presets">
        {PRESETS.map((preset) => (
          <button key={preset} onClick={() => { setQuery(preset); search(preset); }}>{preset}</button>
        ))}
      </div>

      {loading && <div className="loading-message"><span className="loading-dot" />Loading photos...</div>}
      {error && <div className="error-message" role="alert">{error}</div>}

      {photos.length > 0 && (
        <div className="wallpaper-grid">
          {photos.map((photo) => {
            const selected = value?.url === photo.large2x;
            return (
              <button
                key={photo.id}
                className={`wallpaper-thumb${selected ? ' selected' : ''}`}
                onClick={() => onSelect({ url: photo.large2x, photographer: photo.photographer, photographerUrl: photo.photographerUrl })}
                aria-label={`Select photo by ${photo.photographer}`}
              >
                <img src={photo.landscape} alt={`Photo by ${photo.photographer} on Pexels`} loading="lazy" />
                <span className="wallpaper-credit">Photo by {photo.photographer} on Pexels</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
