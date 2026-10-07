import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Settings,
  Play,
  Pause,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import {
  MangaPage,
  AppSettings,
  TrackerStatus,
  getCloseThreshold,
  getStepDurationMs,
  getAutoSpeedPxPerSec,
} from '../types';
import { libraryRepository } from '../data/LibraryRepository';
import { settingsRepository } from '../data/SettingsRepository';
import { eyeTracker } from '../eye/EyeTracker';
import { BlinkDetector } from '../eye/BlinkDetector';
import { EyeIndicator } from './EyeIndicator';

interface ReaderScreenProps {
  mangaId: string;
  onBack: () => void;
  onSettings: () => void;
}

export const ReaderScreen: React.FC<ReaderScreenProps> = ({ mangaId, onBack, onSettings }) => {
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Settings & Eye Tracker state
  const [settings, setSettings] = useState<AppSettings>(settingsRepository.settings);
  const [closeProgress, setCloseProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>({ type: 'idle' });

  // DOM & Animation refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const detectorRef = useRef(new BlinkDetector());
  const autoScrollRafRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef(performance.now());
  const animatingStepRef = useRef(false);

  // Load Manga Data
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const mangaTitle = await libraryRepository.title(mangaId);
        const loadedPages = await libraryRepository.loadPages(mangaId);
        if (!mounted) return;

        setTitle(mangaTitle);
        setPages(loadedPages);
        const savedProgress = settingsRepository.getProgress(mangaId);
        setCurrentPage(Math.min(savedProgress, Math.max(0, loadedPages.length - 1)));
        setAutoRunning(settings.mode === 'AUTO');
      } catch (err) {
        console.error('Failed to load manga:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [mangaId, settings.mode]);

  // Subscribe to Settings
  useEffect(() => {
    return settingsRepository.subscribe((s) => {
      setSettings(s);
      if (s.mode === 'AUTO') {
        setAutoRunning(true);
      } else {
        setAutoRunning(false);
      }
    });
  }, []);

  // Jump to saved start page after load
  useEffect(() => {
    if (!loading && pages.length > 0 && containerRef.current) {
      const savedProgress = settingsRepository.getProgress(mangaId);
      if (savedProgress > 0 && pageRefs.current[savedProgress]) {
        pageRefs.current[savedProgress]?.scrollIntoView({ behavior: 'instant' });
      }
    }
  }, [loading, pages.length, mangaId]);

  // Perform smooth animated scroll step (Manual Mode)
  const performScrollStep = useCallback(() => {
    if (!containerRef.current || animatingStepRef.current) return;
    animatingStepRef.current = true;

    const container = containerRef.current;
    const viewportHeight = container.clientHeight;
    const stepDistance = (viewportHeight * settings.scrollDistancePct) / 100;
    const duration = getStepDurationMs(settings);

    const startScroll = container.scrollTop;
    const targetScroll = Math.min(
      container.scrollHeight - container.clientHeight,
      startScroll + stepDistance
    );
    const startTime = performance.now();

    const stepEase = (t: number) => {
      // FastOutSlowIn cubic bezier approx
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = stepEase(progress);

      container.scrollTop = startScroll + (targetScroll - startScroll) * eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        animatingStepRef.current = false;
      }
    };

    requestAnimationFrame(animate);
  }, [settings]);

  // Toggle Auto Scroll
  const toggleAutoRunning = useCallback(() => {
    setAutoRunning((prev) => !prev);
  }, []);

  // Eye Tracker lifecycle & sample listener
  useEffect(() => {
    const unsubStatus = eyeTracker.subscribeStatus(setTrackerStatus);

    if (settings.eyeControlEnabled) {
      eyeTracker.start(`reader_${mangaId}`);
    } else {
      eyeTracker.stop(`reader_${mangaId}`);
      detectorRef.current.reset();
      setCloseProgress(0);
    }

    const unsubSamples = eyeTracker.subscribeSamples((sample) => {
      setFaceDetected(sample.faceDetected);

      if (!settings.eyeControlEnabled) {
        detectorRef.current.reset();
        setCloseProgress(0);
        return;
      }

      const threshold = getCloseThreshold(settings);
      const fired = detectorRef.current.update(sample, {
        threshold,
        closeMs: settings.eyeCloseMs,
        cooldownMs: settings.cooldownMs,
      });

      setCloseProgress(detectorRef.current.progress);

      if (fired) {
        if (settings.mode === 'AUTO') {
          toggleAutoRunning();
        } else {
          performScrollStep();
        }
      }
    });

    return () => {
      unsubStatus();
      unsubSamples();
      eyeTracker.stop(`reader_${mangaId}`);
    };
  }, [mangaId, settings, performScrollStep, toggleAutoRunning]);

  // Continuous Auto-Scroll Engine
  useEffect(() => {
    if (settings.mode !== 'AUTO' || !autoRunning) {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      return;
    }

    lastScrollTimeRef.current = performance.now();

    const autoLoop = (now: number) => {
      if (!isUserScrollingRef.current && containerRef.current) {
        const deltaSec = (now - lastScrollTimeRef.current) / 1000;
        const pxPerSec = getAutoSpeedPxPerSec(settings);
        const shift = pxPerSec * deltaSec;

        const container = containerRef.current;
        const maxScroll = container.scrollHeight - container.clientHeight;

        if (container.scrollTop >= maxScroll - 2) {
          setAutoRunning(false);
          return;
        }

        container.scrollTop += shift;
      }

      lastScrollTimeRef.current = now;
      autoScrollRafRef.current = requestAnimationFrame(autoLoop);
    };

    autoScrollRafRef.current = requestAnimationFrame(autoLoop);

    return () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [settings, autoRunning]);

  // Monitor Scroll Position & Save Progress (debounced)
  const handleScroll = useCallback(() => {
    if (!containerRef.current || pages.length === 0) return;

    // Detect user manual interaction to pause auto-scroll temporarily
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) window.clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      lastScrollTimeRef.current = performance.now();
    }, 300);

    // Calculate current visible page
    const containerTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;
    const midPoint = containerTop + containerHeight * 0.35;

    let visibleIndex = 0;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el) {
        if (el.offsetTop <= midPoint) {
          visibleIndex = i;
        } else {
          break;
        }
      }
    }

    setCurrentPage(visibleIndex);
    settingsRepository.setProgress(mangaId, visibleIndex);
  }, [mangaId, pages.length]);

  // Jump to specific page via Scrubber slider
  const handleScrubberChange = (newIndex: number) => {
    setCurrentPage(newIndex);
    const targetEl = pageRefs.current[newIndex];
    if (targetEl && containerRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
    settingsRepository.setProgress(mangaId, newIndex);
  };

  // Keyboard shortcut listener (Spacebar simulation, arrows, f for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Spacebar hold simulation of eyes closed
        e.preventDefault();
        eyeTracker.simulateSample(0.95, true);
      } else if (e.key === 'ArrowDown') {
        performScrollStep();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        eyeTracker.simulateSample(0.05, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [performScrollStep]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full bg-black text-neutral-100 overflow-hidden select-none">
      {/* Scrollable Manga Pages Column (max width 900px, tablet-friendly) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          <p className="text-sm">Loading chapter...</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-neutral-400">
          <p>No pages found in this manga.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onClick={() => setOverlayVisible((v) => !v)}
          className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center cursor-pointer scroll-smooth"
        >
          <div className="w-full max-w-[900px] flex flex-col items-center shadow-2xl min-h-full bg-neutral-950">
            {pages.map((p, idx) => (
              <div
                key={p.name + idx}
                ref={(el) => {
                  pageRefs.current[idx] = el;
                }}
                className="w-full relative bg-neutral-950"
                style={{
                  aspectRatio: `${p.aspectRatio}`,
                }}
              >
                <img
                  src={p.url}
                  alt={`Page ${idx + 1}`}
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  className="w-full h-full object-contain block select-none pointer-events-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Eye Tracking Indicator */}
      {settings.eyeControlEnabled && (
        <div className="fixed top-20 right-4 sm:right-6 z-30 pointer-events-auto">
          <EyeIndicator
            progress={closeProgress}
            faceDetected={faceDetected}
            status={trackerStatus}
            onClick={() => {
              // Quick tap to simulate a blink trigger
              eyeTracker.simulateSample(0.95, true);
              setTimeout(() => eyeTracker.simulateSample(0.05, true), settings.eyeCloseMs + 50);
            }}
            title="Click or hold Spacebar to simulate eye close"
          />
        </div>
      )}

      {/* Top Overlay HUD Bar */}
      <div
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 pointer-events-none ${
          overlayVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="max-w-4xl mx-auto p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-800 shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                aria-label="Back to library"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm sm:text-base font-semibold truncate text-neutral-100" title={title}>
                {title}
              </h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Page indicator */}
              <span className="text-xs font-medium text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                {currentPage + 1} / {pages.length}
              </span>

              {/* Mode Toggle (Manual vs Auto) */}
              <div className="flex p-0.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => settingsRepository.update((s) => ({ ...s, mode: 'MANUAL' }))}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    settings.mode === 'MANUAL'
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => settingsRepository.update((s) => ({ ...s, mode: 'AUTO' }))}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    settings.mode === 'AUTO'
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Auto
                </button>
              </div>

              {/* Eye Control Toggle */}
              <button
                type="button"
                onClick={() =>
                  settingsRepository.update((s) => ({ ...s, eyeControlEnabled: !s.eyeControlEnabled }))
                }
                className={`p-2 rounded-xl border transition-colors ${
                  settings.eyeControlEnabled
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-400'
                }`}
                title={settings.eyeControlEnabled ? 'Eye control enabled' : 'Eye control disabled'}
              >
                {settings.eyeControlEnabled ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>

              {/* Settings button */}
              <button
                type="button"
                onClick={onSettings}
                className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Overlay HUD Bar (Scrubber & Auto-scroll controls) */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 transition-all duration-200 pointer-events-none ${
          overlayVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-800 shadow-2xl pointer-events-auto">
            {/* Auto Mode Play / Pause button */}
            {settings.mode === 'AUTO' && (
              <button
                type="button"
                onClick={toggleAutoRunning}
                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sky-400 transition-colors"
                title={autoRunning ? 'Pause auto-scroll' : 'Resume auto-scroll'}
              >
                {autoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}

            {/* Seeking Page Scrubber Slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-neutral-400 font-mono w-6 text-right">
                {currentPage + 1}
              </span>
              <input
                type="range"
                min="0"
                max={Math.max(1, pages.length - 1)}
                value={currentPage}
                onChange={(e) => handleScrubberChange(parseInt(e.target.value, 10))}
                className="flex-1 accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
              />
              <span className="text-xs text-neutral-400 font-mono w-6">{pages.length}</span>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Camera Access Card (matching Android's CameraPermission card) */}
      {settings.eyeControlEnabled && trackerStatus.type === 'error' && (
        <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 p-5 rounded-2xl shadow-2xl space-y-3">
          <h3 className="text-sm font-semibold text-neutral-100">Camera access needed</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            MangaFlow uses the front camera to detect when your eyes close. Frames are analysed on
            this device in memory and are never saved or uploaded.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => eyeTracker.start(`reader_${mangaId}`)}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold text-xs transition-colors"
            >
              Allow camera
            </button>
            <button
              type="button"
              onClick={() =>
                settingsRepository.update((s) => ({ ...s, eyeControlEnabled: false }))
              }
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
            >
              Turn off eye control
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
