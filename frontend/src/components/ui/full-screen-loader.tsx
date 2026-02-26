import React from 'react';

interface FullScreenLoaderProps {
  /** Текст под спиннером */
  text?: string;
  /** Прогресс 0-100 (если указан — показывает progress bar) */
  progress?: number;
}

/**
 * Полноэкранный оверлей загрузки для критических операций.
 *
 * - Spinner по центру
 * - Опциональный progress bar (для загрузки файлов)
 * - Блокирует весь интерфейс
 */
export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({ text, progress }) => (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
    <svg
      className="animate-spin h-12 w-12 text-white mb-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>

    {text && <p className="text-white text-sm font-medium mb-3">{text}</p>}

    {progress !== undefined && (
      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    )}
  </div>
);
