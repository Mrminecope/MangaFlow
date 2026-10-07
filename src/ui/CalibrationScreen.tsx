import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { eyeTracker } from '../eye/EyeTracker';
import { settingsRepository } from '../data/SettingsRepository';
import { EyeSample, EMPTY_EYE_SAMPLE, TrackerStatus } from '../types';

export type CalibrationPhase =
  | 'INTRO'
  | 'OPEN_EYES'
  | 'GET_READY'
  | 'CLOSE_EYES'
  | 'SUCCESS'
  | 'FAILED';

interface CalibrationScreenProps {
  onBack: () => void;
}

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({ onBack }) => {
  const [phase, setPhase] = useState<CalibrationPhase>('INTRO');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [openValue, setOpenValue] = useState(0);
  const [closedValue, setClosedValue] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [liveSample, setLiveSample] = useState<EyeSample>(EMPTY_EYE_SAMPLE);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>({ type: 'idle' });

  const abortControllerRef = useRef<boolean>(false);
  const liveSampleRef = useRef<EyeSample>(EMPTY_EYE_SAMPLE);

  // Subscribe to live samples & status, and start tracker
  useEffect(() => {
    const unsubSamples = eyeTracker.subscribeSamples((s) => {
      liveSampleRef.current = s;
      setLiveSample(s);
    });
    const unsubStatus = eyeTracker.subscribeStatus(setTrackerStatus);

    // Start camera for calibration
    eyeTracker.start('calibration');

    return () => {
      abortControllerRef.current = true;
      unsubSamples();
      unsubStatus();
      eyeTracker.stop('calibration');
    };
  }, []);

  const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const startCalibration = async () => {
    abortControllerRef.current = false;
    setErrorMessage(null);

    try {
      // Phase 1: OPEN_EYES (3 seconds, skipping initial 700ms)
      setPhase('OPEN_EYES');
      const openSamples: number[] = [];
      const openStart = Date.now();

      // Countdown ticker loop
      let openLeft = 3;
      setSecondsLeft(openLeft);

      const openInterval = setInterval(() => {
        openLeft--;
        if (openLeft >= 0) setSecondsLeft(openLeft);
      }, 1000);

      // Collect samples at ~30Hz
      const openCollector = setInterval(() => {
        const s = liveSampleRef.current;
        if (s.faceDetected && Date.now() - openStart >= 700) {
          openSamples.push(s.closure);
        }
      }, 33);

      await delay(3000);
      clearInterval(openInterval);
      clearInterval(openCollector);

      if (abortControllerRef.current) return;

      // Phase 2: GET_READY (countdown 3..2..1)
      setPhase('GET_READY');
      for (let left = 3; left >= 1; left--) {
        if (abortControllerRef.current) return;
        setSecondsLeft(left);
        await delay(1000);
      }

      if (abortControllerRef.current) return;

      // Beep cue to close eyes
      eyeTracker.playBeep(880, 250);

      // Phase 3: CLOSE_EYES (3.5 seconds, skipping initial 800ms)
      setPhase('CLOSE_EYES');
      const closedSamples: number[] = [];
      const closedStart = Date.now();

      let closedLeft = 3;
      setSecondsLeft(closedLeft);
      const closedInterval = setInterval(() => {
        closedLeft--;
        if (closedLeft >= 0) setSecondsLeft(closedLeft);
      }, 1000);

      const closedCollector = setInterval(() => {
        const s = liveSampleRef.current;
        if (s.faceDetected && Date.now() - closedStart >= 800) {
          closedSamples.push(s.closure);
        }
      }, 33);

      await delay(3500);
      clearInterval(closedInterval);
      clearInterval(closedCollector);

      if (abortControllerRef.current) return;

      // Beep cue to open eyes
      eyeTracker.playBeep(880, 250);

      // Validate sample count (min 15 samples each, matching Android app)
      const MIN_SAMPLES = 15;
      if (openSamples.length < MIN_SAMPLES || closedSamples.length < MIN_SAMPLES) {
        setErrorMessage(
          "Your face wasn't detected clearly. Look straight at your camera in good lighting and try again."
        );
        setPhase('FAILED');
        return;
      }

      const o = median(openSamples);
      const cl = median(closedSamples);

      if (cl - o < 0.25) {
        setErrorMessage(
          "Couldn't see a clear difference between open and closed eyes. Try again with both eyes fully closed."
        );
        setPhase('FAILED');
        return;
      }

      // Save baseline values to Settings
      settingsRepository.update((prev) => ({
        ...prev,
        calibOpen: Math.round(o * 100) / 100,
        calibClosed: Math.round(cl * 100) / 100,
      }));

      setOpenValue(o);
      setClosedValue(cl);
      setPhase('SUCCESS');
    } catch (e) {
      console.error('Calibration error:', e);
      setErrorMessage('Calibration error. Please ensure camera access is allowed.');
      setPhase('FAILED');
    }
  };

  const reset = () => {
    abortControllerRef.current = true;
    setPhase('INTRO');
    setSecondsLeft(0);
    setErrorMessage(null);
  };

  const isRunning =
    phase === 'OPEN_EYES' || phase === 'GET_READY' || phase === 'CLOSE_EYES';

  const getPhaseText = () => {
    switch (phase) {
      case 'INTRO':
        return {
          title: "Let's tune MangaFlow to your eyes",
          body: "Hold your device at reading distance. First you'll look at the screen normally, then you'll close your eyes when you hear a beep, and open them at the second beep.",
        };
      case 'OPEN_EYES':
        return {
          title: 'Look at the screen',
          body: `Keep your eyes naturally open… ${secondsLeft}`,
        };
      case 'GET_READY':
        return {
          title: 'Get ready',
          body: `When you hear the beep, close both eyes. Starting in ${secondsLeft}…`,
        };
      case 'CLOSE_EYES':
        return {
          title: 'Close your eyes',
          body: 'Keep them closed until you hear the second beep.',
        };
      case 'SUCCESS':
        return {
          title: 'Calibration saved',
          body: `Open-eye level ${Math.round(openValue * 100)}%, closed-eye level ${Math.round(
            closedValue * 100
          )}%. You can fine-tune with Sensitivity in Settings.`,
        };
      case 'FAILED':
        return {
          title: 'Calibration failed',
          body: errorMessage || 'Could not calibrate cleanly. Please try again.',
        };
    }
  };

  const text = getPhaseText();

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
        <h1 className="ml-3 text-lg font-semibold tracking-tight text-neutral-100">
          Calibrate eye tracking
        </h1>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl flex flex-col items-center text-center gap-8 bg-neutral-900/60 p-8 sm:p-10 rounded-3xl border border-neutral-800 shadow-xl">
          {/* Status Badge */}
          {phase === 'SUCCESS' && (
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {phase === 'FAILED' && (
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}
          {phase === 'GET_READY' && (
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 animate-pulse">
              <Volume2 className="w-8 h-8" />
            </div>
          )}

          {/* Heading and Body */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
              {text.title}
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-md mx-auto">
              {text.body}
            </p>
          </div>

          {/* Live Eye Closure Meter */}
          <div className="w-full max-w-md bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800/80 space-y-3 text-left">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-neutral-400 uppercase tracking-wider">Live Eye Closure</span>
              <span
                className={`flex items-center gap-1.5 ${
                  liveSample.faceDetected ? 'text-sky-400' : 'text-neutral-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveSample.faceDetected ? 'bg-sky-400 animate-ping' : 'bg-neutral-600'
                  }`}
                />
                {liveSample.faceDetected ? 'Face detected' : 'No face detected'}
              </span>
            </div>

            {/* Linear Progress Indicator */}
            <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-75 rounded-full"
                style={{
                  width: `${
                    liveSample.faceDetected
                      ? Math.round(Math.max(0, Math.min(1, liveSample.closure)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-neutral-500">
              <span>0% (Open)</span>
              <span>
                {liveSample.faceDetected
                  ? `${Math.round(liveSample.closure * 100)}%`
                  : '—'}
              </span>
              <span>100% (Shut)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            {trackerStatus.type === 'error' ? (
              <button
                type="button"
                onClick={() => eyeTracker.start('calibration')}
                className="px-6 py-3 rounded-full bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
              >
                Retry camera access
              </button>
            ) : isRunning ? (
              <button
                type="button"
                onClick={reset}
                className="px-6 py-2.5 rounded-full border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            ) : phase === 'SUCCESS' ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={startCalibration}
                  className="px-5 py-2.5 rounded-full border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Redo
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-2.5 rounded-full bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCalibration}
                className="px-8 py-3 rounded-full bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 text-base"
              >
                {phase === 'FAILED' ? 'Try again' : 'Start calibration'}
              </button>
            )}
          </div>

          {/* Privacy Note */}
          <p className="text-xs text-neutral-500 max-w-sm">
            🔒 The camera image is analysed on-device in memory and is never stored or sent anywhere.
          </p>
        </div>
      </main>
    </div>
  );
};
