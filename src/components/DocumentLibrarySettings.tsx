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
  FileCode,
  FileSpreadsheet,
  FileType,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  HardDrive,
} from 'lucide-react';
import {
  getLibraryDocuments,
  uploadDocumentToLibrary,
  toggleDocumentInclusion,
  deleteDocumentFromLibrary,
  formatDocumentSize,
  getDocumentTypeBadge,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  searchDocumentLibrary,
} from '@/services/documentLibraryService';
import type { LibraryDocument, DocumentLibraryStats, DocumentRetrievalResult } from '@/types';

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

  // Search & Filter within library
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Preview & Inspect Modal
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);
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
      const data = await getLibraryDocuments();
      setDocuments(data.documents);
      setStats(data.stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load documents';
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
        `Successfully indexed ${successCount} document${successCount > 1 ? 's' : ''} into Vector Memory.`,
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
      // Revert on error
      await loadData();
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      const id = docToDelete.id;
      setDocToDelete(null);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      await deleteDocumentFromLibrary(id);
      await loadData();
      setSuccessMsg(`Document "${docToDelete.name}" removed from library.`);
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

  // Calculate storage percentage (e.g. out of 50MB quota display)
  const MAX_STORAGE_BYTES = 50 * 1024 * 1024; // 50MB nominal
  const storagePercentage = Math.min(
    Math.round((stats.totalSizeBytes / MAX_STORAGE_BYTES) * 100),
    100,
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info & RAG Overview */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md shadow-lg shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-wide flex items-center gap-2">
                Document Library
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  Vector Memory (RAG)
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Upload your private documents (PDF, TXT, CSV, DOCX). Files are automatically split into semantic chunks, vectorized with embeddings, and seamlessly searched by JARVIS when the &apos;Search My Documents&apos; toggle is active.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition-all self-start md:self-auto"
            title="Refresh library"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Storage
          </button>
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
              <span>Storage Used</span>
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatDocumentSize(stats.totalSizeBytes)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Local Persistent Vault</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Index Health</span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hybrid Cosine + BM25</div>
          </div>
        </div>

        {/* Storage Bar Indicator */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
            <span>Library Storage Capacity</span>
            <span>
              {formatDocumentSize(stats.totalSizeBytes)} / 50 MB ({storagePercentage}%)
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
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

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center cursor-pointer ${
          isDragging
            ? 'border-cyan-400 bg-cyan-500/10'
            : 'border-white/10 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/60'
        } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.csv,.docx,.doc,.md,.json"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-inner">
            {uploading ? (
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            ) : (
              <Upload className="w-8 h-8 text-cyan-400" />
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">
              {uploading ? 'Ingesting & Indexing Document...' : 'Upload Document to Vector Memory'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {uploading
                ? uploadProgressMsg || 'Extracting text and generating embeddings...'
                : 'Drag & drop files here or click to browse (PDF, TXT, CSV, DOCX)'}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              PDF
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              DOCX
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              CSV
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              TXT
            </span>
            <span className="text-[11px] text-slate-500 ml-1">Up to 50 MB / file</span>
          </div>
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

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/10">
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
            <div className="text-sm text-slate-400">Loading Document Library...</div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-white/5 bg-slate-900/30">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-medium text-slate-300">
              {searchFilter || typeFilter !== 'all'
                ? 'No documents match the current filter.'
                : 'No documents in your library yet.'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchFilter || typeFilter !== 'all'
                ? 'Try clearing the search query or selecting All formats.'
                : 'Upload your first PDF, DOCX, CSV, or TXT file above to build your private AI vector memory.'}
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
                      title="Delete document"
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
                      Extracted Text Snippet:
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

      {/* Semantic Retrieval Sandbox (Test your RAG index) */}
      {documents.length > 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              Test Semantic Vector Retrieval (Sandbox)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Type any question or phrase below to test which vector chunks are retrieved from your active documents in real time.
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
                Found {testResults.length} matching chunk{testResults.length === 1 ? '' : 's'}:
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
              Are you sure you want to remove <strong className="text-white">&quot;{docToDelete.name}&quot;</strong> from your Document Library?
            </p>
            <p className="text-xs text-slate-400 mb-6">
              All indexed vector embeddings and semantic chunks for this document will be permanently deleted from the vector memory store.
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
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
