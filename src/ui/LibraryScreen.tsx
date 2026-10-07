import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Plus,
  Image as ImageIcon,
  FolderOpen,
  Archive,
  Trash2,
  BookOpen,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Manga } from '../types';
import { libraryRepository } from '../data/LibraryRepository';
import { PWAInstallButton } from './PWAInstallButton';

interface LibraryScreenProps {
  onOpen: (id: string) => void;
  onSettings: () => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onOpen, onSettings }) => {
  const [items, setItems] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const imagesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cbzInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadLibrary = async () => {
    try {
      const list = await libraryRepository.list();
      setItems(list);
    } catch (e) {
      console.error('Failed to load library:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleImportImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      const manga = await libraryRepository.importImages(Array.from(files));
      showToast(`Imported "${manga.title}" (${manga.pageCount} pages)`);
      await loadLibrary();
    } catch (err: unknown) {
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      const manga = await libraryRepository.importFolder(Array.from(files));
      showToast(`Imported "${manga.title}" (${manga.pageCount} pages)`);
      await loadLibrary();
    } catch (err: unknown) {
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleImportCbz = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        const manga = await libraryRepository.importCbz(file);
        showToast(`Imported "${manga.title}" (${manga.pageCount} pages)`);
      }
      await loadLibrary();
    } catch (err: unknown) {
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleImportSample = async () => {
    setImporting(true);
    try {
      const manga = await libraryRepository.importSample();
      showToast(`Loaded sample chapter "${manga.title}"!`);
      await loadLibrary();
    } catch (err: unknown) {
      showToast(`Failed to load sample: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, manga: Manga) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${manga.title}" from your library?`)) {
      try {
        await libraryRepository.delete(manga.id);
        showToast(`Deleted "${manga.title}"`);
        await loadLibrary();
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-y-auto">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 sm:px-6 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-950">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-100">MangaFlow</h1>
            <span className="hidden sm:inline-block text-[11px] text-neutral-400">
              Hands-Free Eye Tracking Reader
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={onSettings}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
            <p className="text-sm">Loading library...</p>
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 max-w-md mx-auto space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shadow-inner">
              <BookOpen className="w-8 h-8 text-neutral-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-100">
                Your library is empty
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Import loose images, an entire folder, or CBZ archives to start reading hands-free.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full justify-center">
              <button
                type="button"
                onClick={handleImportSample}
                className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Load Sample Manga
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="px-5 py-2.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-neutral-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Import Manga
              </button>
            </div>
          </div>
        ) : (
          /* Multi-column Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {items.map((m) => (
              <div
                key={m.id}
                onClick={() => onOpen(m.id)}
                className="group relative flex flex-col bg-neutral-900/80 rounded-2xl border border-neutral-800/80 overflow-hidden cursor-pointer hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-950/30 transition-all duration-200"
              >
                {/* Cover Image */}
                <div className="relative aspect-[0.7] w-full bg-neutral-950 overflow-hidden">
                  {m.coverUrl ? (
                    <img
                      src={m.coverUrl}
                      alt={m.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                      <BookOpen className="w-10 h-10" />
                    </div>
                  )}

                  {/* Delete button overlay */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, m)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-rose-950 text-neutral-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                    title={`Delete ${m.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Gradient shadow overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-900/90 to-transparent pointer-events-none" />
                </div>

                {/* Details */}
                <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between">
                  <div>
                    <h3
                      className="text-sm font-semibold text-neutral-100 line-clamp-2 leading-snug group-hover:text-sky-400 transition-colors"
                      title={m.title}
                    >
                      {m.title}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 flex items-center justify-between">
                    <span>{m.pageCount} pages</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) with Menu */}
      <div className="fixed bottom-6 right-6 z-30" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-16 right-0 mb-2 w-52 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                imagesInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors text-left"
            >
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>Images</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                folderInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors text-left"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Folder</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                cbzInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors text-left"
            >
              <Archive className="w-4 h-4 text-indigo-400" />
              <span>CBZ Archive</span>
            </button>
            <div className="my-1 border-t border-neutral-800" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleImportSample();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-sky-400 hover:bg-neutral-800 hover:text-sky-300 transition-colors text-left"
            >
              <Sparkles className="w-4 h-4" />
              <span>Sample Manga</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold text-sm shadow-xl shadow-sky-500/25 transition-all transform active:scale-95"
        >
          <Plus className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />
          <span>Import</span>
        </button>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={imagesInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImportImages}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error directory attribute is non-standard webkit
        webkitdirectory=""
        directory=""
        onChange={handleImportFolder}
        className="hidden"
      />
      <input
        ref={cbzInputRef}
        type="file"
        multiple
        accept=".cbz,.zip,application/zip,application/x-zip-compressed"
        onChange={handleImportCbz}
        className="hidden"
      />

      {/* Importing Indicator or Toast Notification */}
      {importing && (
        <div className="fixed bottom-6 left-6 z-30 flex items-center gap-3 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl text-sm text-neutral-200">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
          <span>Importing manga files…</span>
        </div>
      )}

      {message && !importing && (
        <div className="fixed bottom-6 left-6 z-30 flex items-center gap-2 px-4 py-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-xl text-sm text-neutral-200 animate-in fade-in slide-in-from-bottom-2">
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};
