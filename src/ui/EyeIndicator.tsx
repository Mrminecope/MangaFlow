import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TrackerStatus } from '../types';

interface EyeIndicatorProps {
  progress: number; // 0..1
  faceDetected: boolean;
  status: TrackerStatus;
  onClick?: () => void;
  title?: string;
}

export const EyeIndicator: React.FC<EyeIndicatorProps> = ({
  progress,
  faceDetected,
  status,
  onClick,
  title = 'Hold eyes closed to scroll',
}) => {
  const radius = 24;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.max(0, Math.min(1, progress)) * circumference;

  const isError = status.type === 'error';
  const isLoading = status.type === 'loading';

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" title={title}>
      <button
        type="button"
        onClick={onClick}
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-black/60 backdrop-blur-md shadow-lg border border-white/10 transition-transform active:scale-95 focus:outline-none cursor-pointer group"
      >
        {/* SVG Circular Progress Ring */}
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle
            stroke="rgba(255, 255, 255, 0.15)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={progress > 0.8 ? '#38bdf8' : '#60a5fa'}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 50ms linear' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {faceDetected ? (
            <Eye
              className={`w-5 h-5 transition-colors ${
                progress > 0 ? 'text-sky-400 scale-110' : 'text-neutral-100'
              }`}
            />
          ) : (
            <EyeOff className="w-5 h-5 text-neutral-400 opacity-60" />
          )}
        </div>
      </button>

      {/* Status indicator pill */}
      {isError && (
        <span className="text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800/50 max-w-[130px] truncate">
          {status.message}
        </span>
      )}
      {isLoading && (
        <span className="text-[10px] text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800/50">
          Loading model...
        </span>
      )}
    </div>
  );
};
