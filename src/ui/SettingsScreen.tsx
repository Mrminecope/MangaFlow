import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { AppSettings, ScrollMode } from '../types';
import { settingsRepository } from '../data/SettingsRepository';

interface SettingsScreenProps {
  onBack: () => void;
  onCalibrate: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onCalibrate }) => {
  const [settings, setSettings] = useState<AppSettings>(settingsRepository.settings);

  useEffect(() => {
    return settingsRepository.subscribe(setSettings);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    settingsRepository.update((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetDefaults = () => {
    settingsRepository.reset();
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-y-auto">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 flex items-center h-16 px-4 sm:px-6 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-800 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="ml-3 text-lg font-semibold tracking-tight text-neutral-100">Settings</h1>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Scrolling */}
          <section className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 space-y-6 shadow-md">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-100">Scrolling</h2>
              <p className="text-xs text-neutral-400 mt-1">Configure reading movement and pacing.</p>
            </div>

            {/* Mode Segmented Controls */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">Mode</label>
              <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => updateSetting('mode', 'MANUAL')}
                  className={`py-2 text-sm font-medium rounded-lg transition-all ${
                    settings.mode === 'MANUAL'
                      ? 'bg-neutral-800 text-neutral-100 shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Manual scroll
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('mode', 'AUTO')}
                  className={`py-2 text-sm font-medium rounded-lg transition-all ${
                    settings.mode === 'AUTO'
                      ? 'bg-neutral-800 text-neutral-100 shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Auto scroll
                </button>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {settings.mode === 'AUTO'
                  ? 'Pages move continuously. Closing your eyes pauses or resumes auto-scroll.'
                  : 'Pages move one step each time you hold your eyes closed (or swipe).'}
              </p>
            </div>

            {/* Scroll speed slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-300">Scroll speed</span>
                <span className="text-sm font-semibold text-sky-400">{settings.scrollSpeed}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.scrollSpeed}
                onChange={(e) => updateSetting('scrollSpeed', parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-500">
                <span>Slow (1)</span>
                <span>Fast (10)</span>
              </div>
            </div>

            {/* Scroll distance slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-300">Scroll distance</span>
                <span className="text-sm font-semibold text-sky-400">{settings.scrollDistancePct}% of screen</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={settings.scrollDistancePct}
                onChange={(e) => updateSetting('scrollDistancePct', parseInt(e.target.value, 10))}
                className="w-full accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-500">
                <span>20%</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          {/* Card 2: Eye Control */}
          <section className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 space-y-6 shadow-md flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-100">Eye control</h2>
                <p className="text-xs text-neutral-400 mt-1">Adjust gesture detection thresholds.</p>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <h3 className="text-sm font-medium text-neutral-200">Enable eye control</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Close both eyes to scroll. Normal blinks are ignored.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.eyeControlEnabled}
                    onChange={(e) => updateSetting('eyeControlEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Eye-close duration slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-300">Eye-close duration</span>
                  <span className="text-sm font-semibold text-sky-400">{settings.eyeCloseMs} ms</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="1500"
                  step="50"
                  value={settings.eyeCloseMs}
                  onChange={(e) => updateSetting('eyeCloseMs', parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>Quick (500 ms)</span>
                  <span>Long (1500 ms)</span>
                </div>
              </div>

              {/* Sensitivity slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-300">Sensitivity</span>
                  <span className="text-sm font-semibold text-sky-400">
                    {Math.round(settings.sensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sensitivity}
                  onChange={(e) => updateSetting('sensitivity', parseFloat(e.target.value))}
                  className="w-full accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>Strict (0%)</span>
                  <span>Sensitive (100%)</span>
                </div>
              </div>

              {/* Cooldown slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-neutral-300">Cooldown</span>
                  <span className="text-sm font-semibold text-sky-400">{settings.cooldownMs} ms</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={settings.cooldownMs}
                  onChange={(e) => updateSetting('cooldownMs', parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>300 ms</span>
                  <span>3000 ms</span>
                </div>
              </div>
            </div>

            {/* Calibrate button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onCalibrate}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 text-neutral-100 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-sky-400" />
                Calibrate eye tracking
              </button>
            </div>
          </section>
        </div>

        {/* Privacy Card */}
        <section className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-neutral-200">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold tracking-tight">Strict On-Device Privacy</h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Eye tracking runs entirely in memory on this device with MediaPipe. Camera frames are
            analysed in memory and discarded immediately — they are never recorded, saved or
            uploaded. MangaFlow does not send any camera frames to external servers.
          </p>
        </section>

        {/* Reset button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </button>
        </div>
      </main>
    </div>
  );
};
