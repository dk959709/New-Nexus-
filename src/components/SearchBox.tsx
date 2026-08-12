import { Eraser, Mic, Search } from 'lucide-react';
import { useState } from 'react';
import { useSpeechSearch } from '@/hooks/useSpeechSearch';

const suggestions = ['What is happening in the world today?', 'Best places to visit this weekend', 'How does quantum computing work?'];

export function SearchBox({ initialValue = '', onSearch, recent = [] }: { initialValue?: string; onSearch: (value: string) => void; recent?: string[] }) {
  const [value, setValue] = useState(initialValue);
  const { listening, supported, start } = useSpeechSearch(setValue);
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (value.trim()) onSearch(value.trim()); };
  return <div className="search-wrap">
    <form className="search-box" onSubmit={submit}>
      <Search size={22} className="search-icon" aria-hidden="true" />
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="What do you want to know?" aria-label="Search the web" />
      {value && <button type="button" className="icon-button" onClick={() => setValue('')} aria-label="Clear search"><Eraser size={18} /></button>}
      {supported && <button type="button" className={`icon-button ${listening ? 'listening' : ''}`} onClick={start} aria-label="Voice search"><Mic size={19} /></button>}
      <button className="search-submit" type="submit" aria-label="Search"><Search size={18} /><span>Search</span></button>
    </form>
    <div className="suggestion-row">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setValue(suggestion); onSearch(suggestion); }}>{suggestion}</button>)}</div>
    {(recent.length > 0 && !value) && <div className="recent-row"><span>Recent</span>{recent.slice(0, 3).map((item) => <button key={item} onClick={() => { setValue(item); onSearch(item); }}>{item}</button>)}</div>}
  </div>;
}
