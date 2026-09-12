import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  BookOpen,
  Layers,
  Database,
  RefreshCw,
  Eye,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Laptop,
  ShieldCheck,
  AlertTriangle,
  Clipboard,
} from 'lucide-react';
import {
  getLibraryDocuments,
  uploadDocumentToLibrary,
  toggleDocumentInclusion,
  deleteDocumentFromLibrary,
  formatDocumentSize,
  getDocumentTypeBadge,
  searchDocumentLibrary,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_LIBRARY_BYTES,
} from '@/services/documentLibraryService';
import { isIndexedDbAvailable } from '@/services/documentIndexedDb';
import type { LibraryDocument, DocumentLibraryStats, DocumentRetrievalResult } from '@/types';

function generatePastedTextFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dd = pad(now.getDate());
  const mm = pad(now.getMonth() + 1);
  const yyyy = now.getFullYear();
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `Pasted-Text-${dd}-${mm}-${yyyy}-${hh}${min}.txt`;
}

export const DocumentLibrarySettings: React.FC = () => {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [stats, setStats] = useState<DocumentLibraryStats>({
    totalDocuments: 0,
    totalChunks: 0,
    totalSizeBytes: 0,
    activeDocuments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isIdbSupported, setIsIdbSupported] = useState<boolean>(true);

  // Paste from Clipboard Preview Modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedTextContent, setPastedTextContent] = useState('');
  const [pastedFileName, setPastedFileName] = useState('');
  const [pasteReading, setPasteReading] = useState(false);

  // Search & Filter within library
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Preview & Inspect Modal
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  // Delete confirmation
  const [docToDelete, setDocToDelete] = useState<LibraryDocument | null>(null);

  // Quick Semantic Search Sandbox inside Settings
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<DocumentRetrievalResult[] | null>(null);
  const [testingSearch, setTestingSearch] = useState(false);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const supported = isIndexedDbAvailable();
      setIsIdbSupported(supported);

      const data = await getLibraryDocuments();
      setDocuments(data.documents);
      setStats(data.stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load documents from device storage';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!isIndexedDbAvailable()) {
      setError(
        'IndexedDB is not supported or is restricted in your browser. Document storage may be transient.',
      );
    }

    setError(null);
    setSuccessMsg(null);
    setUploading(true);

    const fileList = Array.from(files);
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgressMsg(`Processing ${file.name} (${i + 1}/${fileList.length})...`);
      try {
        await uploadDocumentToLibrary(file, (msg) => {
          setUploadProgressMsg(`${file.name}: ${msg}`);
        });
        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        errors.push(`${file.name}: ${msg}`);
      }
    }

    setUploading(false);
    setUploadProgressMsg('');

    if (successCount > 0) {
      setSuccessMsg(
        `Successfully saved and indexed ${successCount} document${
          successCount > 1 ? 's' : ''
        } into your browser's IndexedDB Vector Vault.`,
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadData();
    }

    if (errors.length > 0) {
      setError(errors.join(' | '));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Clipboard Paste trigger
  const handlePasteFromClipboard = async () => {
    setError(null);
    setPasteReading(true);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setError("Couldn't read clipboard — check browser permissions");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setError('Clipboard is empty.');
        return;
      }
      const fileName = generatePastedTextFileName();
      setPastedFileName(fileName);
      setPastedTextContent(text);
      setIsPasteModalOpen(true);
    } catch (err: unknown) {
      console.error('Failed to read clipboard:', err);
      setError("Couldn't read clipboard — check browser permissions");
    } finally {
      setPasteReading(false);
    }
  };

  const handleCancelPasteModal = () => {
    setIsPasteModalOpen(false);
    setPastedTextContent('');
    setPastedFileName('');
  };

  const handleConfirmPaste = async () => {
    if (!pastedTextContent.trim()) {
      setError('Pasted text is empty.');
      setIsPasteModalOpen(false);
      return;
    }

    const textBlob = new Blob([pastedTextContent], { type: 'text/plain' });
    const textBytes = textBlob.size;

    if (textBytes > MAX_FILE_SIZE_BYTES) {
      setError(`Pasted text exceeds the 50 MB per-document limit (${formatDocumentSize(textBytes)}).`);
      return;
    }

    if (stats.totalSizeBytes + textBytes > MAX_TOTAL_LIBRARY_BYTES) {
      setError(
        `Total library storage capacity exceeded (50 MB max). Current: ${formatDocumentSize(
          stats.totalSizeBytes,
        )}, adding this text requires ${formatDocumentSize(textBytes)}. Please remove unused documents.`,
      );
      return;
    }

    const fileName = pastedFileName || generatePastedTextFileName();
    const virtualFile = new File([textBlob], fileName, {
      type: 'text/plain',
      lastModified: Date.now(),
    });

    setIsPasteModalOpen(false);
    setError(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgressMsg(`Processing ${fileName}...`);

    try {
      await uploadDocumentToLibrary(virtualFile, (msg) => {
        setUploadProgressMsg(`${fileName}: ${msg}`);
      });
      setSuccessMsg(
        `Successfully saved and indexed "${fileName}" (${formatDocumentSize(
          textBytes,
        )}) into your browser's IndexedDB Vector Vault.`,
      );
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(`${fileName}: ${msg}`);
    } finally {
      setUploading(false);
      setUploadProgressMsg('');
      setPastedTextContent('');
      setPastedFileName('');
    }
  };

  const handleToggle = async (doc: LibraryDocument) => {
    const nextState = !doc.enabledForJarvis;
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, enabledForJarvis: nextState } : d)),
    );
    setStats((prev) => ({
      ...prev,
      activeDocuments: prev.activeDocuments + (nextState ? 1 : -1),
    }));

    try {
      await toggleDocumentInclusion(doc.id, nextState);
    } catch (err) {
      console.error('Failed to toggle doc inclusion:', err);
      await loadData();
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      const id = docToDelete.id;
      const name = docToDelete.name;
      setDocToDelete(null);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      await deleteDocumentFromLibrary(id);
      await loadData();
      setSuccessMsg(`Document "${name}" removed from device storage.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete document';
      setError(msg);
    }
  };

  // Run test vector search
  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setTestingSearch(true);
    try {
      const results = await searchDocumentLibrary(testQuery, { mode: 'all', topK: 4 });
      setTestResults(results);
    } catch (err: unknown) {
      console.error('Test search failed:', err);
    } finally {
      setTestingSearch(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchFilter.trim() ||
      doc.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (doc.previewSnippet && doc.previewSnippet.toLowerCase().includes(searchFilter.toLowerCase()));

    const matchesType =
      typeFilter === 'all' ||
      doc.type.toLowerCase() === typeFilter.toLowerCase() ||
      doc.name.toLowerCase().endsWith(`.${typeFilter.toLowerCase()}`);

    return matchesSearch && matchesType;
  });

  // Calculate storage percentage (50MB library limit)
  const storagePercentage = Math.min(
    Math.round((stats.totalSizeBytes / MAX_TOTAL_LIBRARY_BYTES) * 100),
    100,
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Browser / IndexedDB Compatibility Warning if restricted */}
      {!isIdbSupported && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block text-amber-300">IndexedDB Storage Notice</strong>
            Your browser does not support or has restricted IndexedDB. Stored documents will only persist in temporary memory during this session.
          </div>
        </div>
      )}

      {/* Header Info & Device Storage Overview */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md shadow-lg shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-white tracking-wide">
                  Document Library
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono flex items-center gap-1">
                  <Laptop className="w-3 h-3 text-cyan-400" />
                  Local Device Storage (IndexedDB)
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Upload private documents (PDF, TXT, CSV, DOCX). Files are parsed into semantic chunks and saved <strong className="text-slate-200">directly to this browser&apos;s IndexedDB on your device</strong>. Documents persist across restarts on this machine, but do not sync to external servers or other devices.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition-all self-start md:self-auto"
            title="Refresh local database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Device Vault
          </button>
        </div>

        {/* Local Storage Privacy & Device Isolation Notice */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/40 border border-cyan-500/20 flex items-center gap-3 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>
            <strong className="text-cyan-300">Device Privacy:</strong> Documents are stored exclusively in your browser&apos;s local IndexedDB. They never reside on server disks, and won&apos;t appear if you switch browsers or devices.
          </span>
        </div>

        {/* Storage Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Documents</span>
              <FileText className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">{stats.totalDocuments}</div>
            <div className="text-[11px] text-cyan-400 mt-0.5">
              {stats.activeDocuments} active in JARVIS
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Vector Chunks</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">{stats.totalChunks}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">~750 chars / chunk</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Device Storage</span>
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatDocumentSize(stats.totalSizeBytes)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">IndexedDB Vault</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Index Health</span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              IndexedDB Ready
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hybrid Dense + TF-IDF</div>
          </div>
        </div>

        {/* Storage Bar Indicator */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
            <span>Library Device Quota (50 MB Max Limit)</span>
            <span>
              {formatDocumentSize(stats.totalSizeBytes)} / 50 MB ({storagePercentage}%)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                storagePercentage > 90
                  ? 'bg-rose-500'
                  : storagePercentage > 70
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
              }`}
              style={{ width: `${Math.max(storagePercentage, stats.totalDocuments > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Zone & Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Main Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`lg:col-span-3 relative rounded-2xl border-2 border-dashed transition-all duration-200 p-6 sm:p-8 text-center cursor-pointer ${
            isDragging
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-white/10 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/60'
          } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.csv,.docx,.doc,.md,.json,.log"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-inner">
              {uploading ? (
                <RefreshCw className="w-7 h-7 animate-spin text-cyan-400" />
              ) : (
                <Upload className="w-7 h-7 text-cyan-400" />
              )}
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">
                {uploading ? 'Ingesting & Indexing to Device Storage...' : 'Upload Document to Device Vector Memory'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {uploading
                  ? uploadProgressMsg || 'Extracting text and saving to IndexedDB...'
                  : 'Drag & drop files here or click to browse (PDF, TXT, CSV, DOCX, MD)'}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                PDF
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                DOCX
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                CSV
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                TXT / MD
              </span>
              <span className="text-[11px] text-slate-500 ml-1">Up to 50 MB / file • Stored on this device only</span>
            </div>
          </div>
        </div>

        {/* Paste from Clipboard Action Card */}
        <div className="lg:col-span-1 flex flex-col justify-between p-5 rounded-2xl border border-cyan-500/20 bg-slate-900/50 hover:bg-slate-900/70 backdrop-blur-sm transition-all text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Clipboard className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Paste Raw Text</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Add text from your clipboard without saving a file first.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={uploading || pasteReading}
            className="mt-4 w-full py-2.5 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pasteReading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clipboard className="w-3.5 h-3.5" />
            )}
            Paste from Clipboard
          </button>
        </div>
      </div>

      {/* Document Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by name or content..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/10 overflow-x-auto">
          {(['all', 'pdf', 'docx', 'csv', 'txt'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition-all ${
                typeFilter === t
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center rounded-2xl border border-white/5 bg-slate-900/30">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
            <div className="text-sm text-slate-400">Loading IndexedDB Vault...</div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-white/5 bg-slate-900/30">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-slate-300">
              {searchFilter || typeFilter !== 'all'
                ? 'No documents match the current filter.'
                : 'No documents stored on this device yet.'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchFilter || typeFilter !== 'all'
                ? 'Try clearing the search query or selecting All formats.'
                : 'Upload your first PDF, DOCX, CSV, or TXT file above to build your private on-device vector memory.'}
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const badge = getDocumentTypeBadge(doc.type || doc.name.split('.').pop() || 'txt');
            const isExpanded = expandedDocId === doc.id;
            const uploadDate = new Date(doc.uploadedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={doc.id}
                className={`rounded-2xl border transition-all duration-200 backdrop-blur-md overflow-hidden ${
                  doc.enabledForJarvis
                    ? 'border-cyan-500/20 bg-slate-900/70 shadow-lg shadow-cyan-950/20'
                    : 'border-white/5 bg-slate-900/40 opacity-75'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left: Icon, Name, Meta */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`p-3 rounded-xl border flex-shrink-0 ${badge.bg} ${badge.border} ${badge.text}`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-white truncate max-w-md" title={doc.name}>
                          {doc.name}
                        </h4>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${badge.bg} ${badge.border} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                        {doc.chunkCount > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10 flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5 text-cyan-400" />
                            {doc.chunkCount} chunks
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                        <span>{formatDocumentSize(doc.size)}</span>
                        <span>•</span>
                        <span>{uploadDate}</span>
                        {doc.previewSnippet && (
                          <>
                            <span>•</span>
                            <button
                              onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              {isExpanded ? 'Hide Preview' : 'Quick Preview'}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Toggle & Actions */}
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {/* Toggle: Include in JARVIS searches */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={doc.enabledForJarvis}
                          onChange={() => handleToggle(doc)}
                          className="sr-only"
                        />
                        <div
                          className={`w-11 h-6 rounded-full transition-colors border ${
                            doc.enabledForJarvis
                              ? 'bg-cyan-500/30 border-cyan-400'
                              : 'bg-slate-800 border-white/10'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full transition-transform transform mt-0.5 ml-1 ${
                              doc.enabledForJarvis
                                ? 'translate-x-5 bg-cyan-400 shadow-sm shadow-cyan-400/50'
                                : 'translate-x-0 bg-slate-500'
                            }`}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-300 hidden md:inline">
                        Include in JARVIS searches
                      </span>
                    </label>

                    {/* Delete button */}
                    <button
                      onClick={() => setDocToDelete(doc)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                      title="Delete document from device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Preview */}
                {isExpanded && doc.previewSnippet && (
                  <div className="px-5 pb-4 pt-2 border-t border-white/5 bg-slate-950/40 text-xs text-slate-400">
                    <div className="font-mono text-[11px] text-slate-500 mb-1 flex items-center gap-1.5">
                      <Eye className="w-3 h-3 text-cyan-400" />
                      Extracted Text Snippet (Device Memory):
                    </div>
                    <p className="bg-slate-900/60 p-3 rounded-xl border border-white/5 font-sans leading-relaxed text-slate-300">
                      &quot;{doc.previewSnippet}&quot;
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Semantic Retrieval Sandbox (Test your IndexedDB vector memory) */}
      {documents.length > 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              Test Semantic Vector Retrieval (IndexedDB Sandbox)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Type any question or phrase below to test which vector chunks are retrieved directly from your device&apos;s IndexedDB in real time.
          </p>

          <form onSubmit={handleTestSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. What are the key points in Q3 financial summary?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              type="submit"
              disabled={testingSearch || !testQuery.trim()}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {testingSearch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Test Retrieval
            </button>
          </form>

          {testResults && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-mono text-cyan-400">
                Found {testResults.length} matching chunk{testResults.length === 1 ? '' : 's'} on device:
              </div>
              {testResults.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950/40 text-xs text-slate-400 border border-white/5">
                  No matching chunks found. Ensure relevant documents are toggled ON.
                </div>
              ) : (
                testResults.map((r, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs text-slate-300"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                      <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                        <FileText className="w-3 h-3" />
                        {r.docName} (Chunk #{r.chunkIndex + 1})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Score: {Math.round(r.score * 100)}%
                      </span>
                    </div>
                    <p className="leading-relaxed line-clamp-3 text-slate-300">&quot;{r.text}&quot;</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl shadow-rose-950/50">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-semibold text-white">Delete Document</h3>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              Are you sure you want to remove <strong className="text-white">&quot;{docToDelete.name}&quot;</strong> from this device?
            </p>
            <p className="text-xs text-slate-400 mb-6">
              All indexed vector embeddings and semantic chunks for this document will be permanently deleted from your browser&apos;s local IndexedDB.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/30"
              >
                Delete from Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste from Clipboard Preview Modal */}
      {isPasteModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelPasteModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto"
        >
          <div className="relative w-full max-w-[92vw] sm:max-w-xl md:max-w-2xl mx-auto my-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-4 sm:p-6 shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-start sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/10 gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
                  <Clipboard className="w-4 h-4 sm:w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2 flex-wrap">
                    <span>Paste from Clipboard</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                      TXT
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                    Edit or trim text before indexing into on-device vector memory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelPasteModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex-shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Document Info */}
            <div className="flex-shrink-0 mt-3 px-3 py-2 rounded-xl bg-slate-950/60 border border-white/5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-mono text-slate-300 min-w-0">
                <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span className="text-slate-400 flex-shrink-0">Target:</span>
                <span className="text-cyan-300 font-semibold truncate max-w-[170px] sm:max-w-xs">
                  {pastedFileName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 flex-shrink-0">
                {formatDocumentSize(new Blob([pastedTextContent]).size)}
              </span>
            </div>

            {/* Editable Preview Textarea with Live Character Count */}
            <div className="mt-2.5 sm:mt-3 flex-1 min-h-[140px] sm:min-h-[180px] flex flex-col overflow-hidden">
              <div className="flex-shrink-0 text-[11px] font-mono text-slate-400 mb-1.5 flex items-center justify-between flex-wrap gap-1">
                <span>Text Content (Editable):</span>
                <span className="text-cyan-300 font-semibold">
                  {pastedTextContent.length.toLocaleString()} chars
                </span>
              </div>
              <textarea
                value={pastedTextContent}
                onChange={(e) => setPastedTextContent(e.target.value)}
                className="w-full flex-1 min-h-[120px] sm:min-h-[180px] p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/60 resize-none overflow-y-auto"
                placeholder="Paste or type document content here..."
              />
            </div>

            {/* Quota & Size Warning */}
            {new Blob([pastedTextContent]).size > MAX_FILE_SIZE_BYTES ? (
              <div className="flex-shrink-0 mt-2.5 sm:mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-rose-300">50 MB File Quota Exceeded</strong>
                  Pasted text size is {formatDocumentSize(new Blob([pastedTextContent]).size)}, which exceeds the 50 MB per document limit. Please trim content.
                </div>
              </div>
            ) : stats.totalSizeBytes + new Blob([pastedTextContent]).size > MAX_TOTAL_LIBRARY_BYTES ? (
              <div className="flex-shrink-0 mt-2.5 sm:mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-rose-300">Library Storage Quota Exceeded</strong>
                  Adding this text ({formatDocumentSize(new Blob([pastedTextContent]).size)}) exceeds total 50 MB library capacity. Please remove unused documents.
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 mt-2.5 sm:mt-3 px-3 py-2 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-[11px] text-slate-400 flex items-center justify-between font-mono flex-wrap gap-1">
                <span>Estimated Vector Chunks: ~{Math.max(1, Math.ceil(pastedTextContent.length / 750))}</span>
                <span>Target: Local IndexedDB</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleCancelPasteModal}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 transition-all"
              >
                Cancel
              </button>
              {new Blob([pastedTextContent]).size > MAX_FILE_SIZE_BYTES ||
              stats.totalSizeBytes + new Blob([pastedTextContent]).size > MAX_TOTAL_LIBRARY_BYTES ? (
                <button
                  type="button"
                  disabled
                  className="px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 cursor-not-allowed opacity-75"
                >
                  Quota Exceeded
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmPaste}
                  disabled={uploading || !pastedTextContent.trim()}
                  className="px-4 sm:px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-cyan-500 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm &amp; Add
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
