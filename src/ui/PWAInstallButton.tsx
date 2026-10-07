import React, { useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running inside standalone installed window, suppress button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 hover:text-sky-300 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer ${className}`}
          title="Install MangaFlow as a standalone application"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-neutral-950 font-semibold text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-98 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-neutral-950" />
          <span>Install / Download MangaFlow</span>
        </button>
      )}

      {/* Guided Installation Instructions Dialog */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-neutral-100">
                  {isIOS ? 'Install on iPhone / iPad' : 'Download MangaFlow'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-neutral-300">
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sky-400">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-white flex inline-flex items-center gap-1"><Share2 className="w-3 h-3" /> Share</strong> button in Safari toolbar.
                  </span>
                </p>
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sky-400">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-neutral-300">
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sky-400">
                    1
                  </span>
                  <span>
                    In Chrome, Edge, or Android browser, look for the <strong className="text-white">Install</strong> icon in the address bar.
                  </span>
                </p>
                <p className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sky-400">
                    2
                  </span>
                  <span>
                    Or tap the browser menu (⋮) and select <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
