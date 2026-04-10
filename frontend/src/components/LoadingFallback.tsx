import React, { useEffect } from 'react';

// ЕДИНЫЙ компонент загрузки для всех случаев - одинаковый стиль везде
const UnifiedLoadingFallback: React.FC<{ message?: string }> = ({ message = 'Загрузка...' }) => {
  useEffect(() => {
    try { console.debug('[LoadingFallback] shown:', message); } catch (e) {}
  }, [message]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">{message}</p>
      </div>
    </div>
  );
};

// Fallback компоненты для Suspense - все используют единый компонент
export const PageLoadingFallback: React.FC = () => (
  <UnifiedLoadingFallback message="Загрузка страницы..." />
);

export const MapLoadingFallback: React.FC = () => (
  <UnifiedLoadingFallback message="Загрузка карты..." />
);

export const BlogLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Загрузка блогов...</p>
    </div>
  </div>
);

export const ModerationLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Загрузка панели модерации...</p>
    </div>
  </div>
);

export const AnalyticsLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Загрузка аналитики...</p>
    </div>
  </div>
);

export const AdminLoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Загрузка админ-панели...</p>
    </div>
  </div>
);

export const ComponentLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
    <span className="ml-2 text-gray-600">Загрузка...</span>
  </div>
);

export const ChartLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">Загрузка графика...</p>
    </div>
  </div>
);

export const TableLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">Загрузка таблицы...</p>
    </div>
  </div>
);

export const ImageLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto"></div>
      <p className="mt-2 text-gray-500">Загрузка изображения...</p>
    </div>
  </div>
);

export const ListLoadingFallback: React.FC = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
      </div>
    ))}
  </div>
);

export const CardLoadingFallback: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-48 bg-gray-200 rounded-t-lg"></div>
    <div className="p-4">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
    </div>
  </div>
);

export const ButtonLoadingFallback: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-10 bg-gray-200 rounded w-24"></div>
  </div>
);

export const FormLoadingFallback: React.FC = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
    <div className="h-10 bg-gray-200 rounded"></div>
    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    <div className="h-10 bg-gray-200 rounded"></div>
    <div className="h-10 bg-gray-200 rounded w-1/2"></div>
  </div>
);

export const ModalLoadingFallback: React.FC = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-2 text-gray-600">Загрузка...</p>
    </div>
  </div>
);

export const ErrorFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Что-то пошло не так</h2>
      <p className="text-gray-600 mb-4">
        Произошла ошибка при загрузке компонента
      </p>
      {error && (
        <details className="text-left bg-gray-100 p-4 rounded-lg max-w-md">
          <summary className="cursor-pointer font-medium">Детали ошибки</summary>
          <pre className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      )}
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Перезагрузить страницу
      </button>
    </div>
  </div>
);

export const EmptyStateFallback: React.FC<{ message?: string }> = ({ 
  message = "Нет данных для отображения" 
}) => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="text-gray-400 text-4xl mb-4">📭</div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

export const NetworkErrorFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="text-red-500 text-6xl mb-4">🌐</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Проблема с сетью</h2>
      <p className="text-gray-600 mb-4">
        Проверьте подключение к интернету и попробуйте снова
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Попробовать снова
      </button>
    </div>
  </div>
);
