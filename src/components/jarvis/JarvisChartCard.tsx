import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon, Copy, Check, Sparkles, Bookmark, BookmarkCheck } from 'lucide-react';
import type { JarvisChartData } from '@/types';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import { copyToClipboard } from '@/lib/clipboard';

interface JarvisChartCardProps {
  id?: string;
  chartData: JarvisChartData;
  title?: string;
  onSaveChange?: (isSaved: boolean) => void;
}

const SERIES_COLORS = [
  '#38bdf8', // sky
  '#a855f7', // purple
  '#34d399', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export function JarvisChartCard({ id, chartData, title, onSaveChange }: JarvisChartCardProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>(() => {
    return chartData.chartType === 'line' ? 'line' : 'bar';
  });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);

  const chartTitle = chartData.title || title || 'Comparative Data Analysis';
  const chartId = id || `chart-${chartTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

  useEffect(() => {
    setSaved(storage.isSaved(chartId));
  }, [chartId]);

  const handleToggleSave = () => {
    playTapSound();
    const isNowSaved = !saved;
    if (isNowSaved) {
      storage.saveItem({
        id: chartId,
        type: 'chart',
        title: chartTitle,
        subtitle: `JARVIS Data Analyst Chart (${chartData.series?.length || 0} series, ${chartData.labels?.length || 0} points)`,
        chartData,
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
      setRecentlySaved(true);
      setTimeout(() => setRecentlySaved(false), 2000);
    } else {
      storage.removeSaved(chartId);
      setSaved(false);
      setRecentlySaved(false);
    }
    onSaveChange?.(isNowSaved);
  };

  if (
    !chartData ||
    !Array.isArray(chartData.labels) ||
    chartData.labels.length === 0 ||
    !Array.isArray(chartData.series) ||
    chartData.series.length === 0
  ) {
    return null;
  }

  // Filter valid series items
  const validSeries = (chartData.series || []).filter(
    (s): s is { name: string; values: number[] } =>
      Boolean(s && typeof s === 'object' && typeof s.name === 'string' && Array.isArray(s.values)),
  );

  if (validSeries.length === 0) {
    return null;
  }

  // Transform labels and series into Recharts row-based data structure
  const formattedData = chartData.labels.map((label, idx) => {
    const row: Record<string, string | number> = { label: String(label ?? '') };
    validSeries.forEach((s) => {
      const val = s.values && s.values[idx] !== undefined ? s.values[idx] : 0;
      row[s.name] = typeof val === 'number' && !isNaN(val) ? val : 0;
    });
    return row;
  });

  const handleCopyJson = async () => {
    playTapSound();
    const success = await copyToClipboard(JSON.stringify(chartData, null, 2));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const labelsCount = chartData.labels?.length || 0;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 mt-6 backdrop-blur-xl transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(8, 24, 40, 0.92) 0%, rgba(15, 18, 54, 0.94) 100%)',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 32px rgba(56, 189, 248, 0.15)',
      }}
    >
      {/* Ambient Top Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.4)]">
            <span className="text-base">📊</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-sky-300 uppercase font-bold">
                DATA ANALYST VISUALIZATION
              </span>
              <span className="px-2 py-0.2 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-[10px] font-mono">
                {validSeries.length} {validSeries.length === 1 ? 'Series' : 'Series'} • {labelsCount} Points
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-white m-0 tracking-tight">
              {chartTitle}
            </h4>
          </div>
        </div>

        {/* View toggles & utility actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Bar / Line toggle */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                chartType === 'bar'
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Bar Chart View"
            >
              <BarChart3 size={13} />
              <span>Bar</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                chartType === 'line'
                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Line Chart View"
            >
              <LineChartIcon size={13} />
              <span>Line</span>
            </button>
          </div>

          {/* Copy JSON action */}
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-sky-300 bg-white/5 hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 transition-colors"
            title="Copy Raw Chart Data JSON"
          >
            {copied ? <Check size={13} className="text-sky-300" /> : <Copy size={13} />}
            <span className="text-[11px]">{copied ? 'Copied' : 'JSON'}</span>
          </button>

          {/* Bookmark / Save to Library */}
          <button
            type="button"
            onClick={handleToggleSave}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              recentlySaved
                ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : saved
                ? 'bg-sky-500/25 border border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'text-slate-300 hover:text-sky-300 bg-white/5 hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40'
            }`}
            title={saved ? 'Remove from Saved Library' : 'Save Chart to Library'}
          >
            {recentlySaved ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-300">Saved ✓</span>
              </>
            ) : saved ? (
              <>
                <BookmarkCheck size={13} className="text-sky-300" />
                <span className="text-[11px] text-sky-300">Saved</span>
              </>
            ) : (
              <>
                <Bookmark size={13} />
                <span className="text-[11px]">Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative z-10 w-full h-[320px] sm:h-[360px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart
              data={formattedData}
              margin={{ top: 12, right: 16, left: -8, bottom: labelsCount > 5 ? 24 : 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                interval={0}
                angle={labelsCount > 5 ? -25 : 0}
                textAnchor={labelsCount > 5 ? 'end' : 'middle'}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(8, 20, 36, 0.95)',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                labelStyle={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}
              />
              {validSeries.length > 1 && (
                <Legend
                  wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: '#cbd5e1' }}
                />
              )}
              {validSeries.map((s, idx) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart
              data={formattedData}
              margin={{ top: 12, right: 16, left: -8, bottom: labelsCount > 5 ? 24 : 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                interval={0}
                angle={labelsCount > 5 ? -25 : 0}
                textAnchor={labelsCount > 5 ? 'end' : 'middle'}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(8, 20, 36, 0.95)',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                labelStyle={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}
              />
              {validSeries.length > 1 && (
                <Legend
                  wrapperStyle={{ paddingTop: '12px', fontSize: '12px', color: '#cbd5e1' }}
                />
              )}
              {validSeries.map((s, idx) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                  strokeWidth={3}
                  dot={{ r: 4, fill: SERIES_COLORS[idx % SERIES_COLORS.length], strokeWidth: 1.5, stroke: '#081424' }}
                  activeDot={{ r: 6, fill: '#ffffff', stroke: SERIES_COLORS[idx % SERIES_COLORS.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Meta */}
      <div className="relative z-10 flex items-center justify-between pt-3 mt-2 border-t border-white/5 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5 text-sky-400/80">
          <Sparkles size={11} />
          <span>Interactive Neural Visualization</span>
        </div>
        <span>Data Analyst v1.0</span>
      </div>
    </div>
  );
}
