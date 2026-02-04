import React, { useState } from 'react';
import { useModeration } from '../../hooks/useModeration';

interface ModerationResult {
  isAppropriate: boolean;
  category: 'spam' | 'inappropriate' | 'fake' | 'safe';
  confidence: number;
  issues: string[];
  suggestions: string[];
}

interface ContentModeratorProps {
  content: string;
  type: 'chat' | 'post' | 'comment' | 'review';
  userId: string;
  location?: string;
  onModerationResult?: (result: ModerationResult) => void;
  onContentChange?: (newContent: string) => void;
}

const ContentModerator: React.FC<ContentModeratorProps> = ({
  content,
  type,
  userId,
  location,
  onModerationResult,
  onContentChange
}) => {
  const { moderateContent, isModerating, lastResult } = useModeration();
  
  // Используем lastResult для инициализации
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(lastResult || null);
  const [showModerationInfo, setShowModerationInfo] = useState(false);
  const [showWarnings] = useState(true);

  const handleModeration = async () => {
    const result = await moderateContent({
      text: content,
      type,
      userId,
      location
    });

    setModerationResult(result);
    onModerationResult?.(result);
    
    // Используем onContentChange для обновления контента
    if (onContentChange && result.suggestions.length > 0) {
      const improvedContent = result.suggestions.reduce((acc, suggestion) => {
        return acc.replace(suggestion, '');
      }, content);
      onContentChange(improvedContent);
    }
  };

  // Используем handleModeration в useEffect
  React.useEffect(() => {
    if (content.length > 10) {
      handleModeration();
    }
  }, [content]);

  const getModerationStatus = () => {
    if (!moderationResult) return 'pending';
    if (moderationResult.isAppropriate) return 'approved';
    return 'rejected';
  };

  const getStatusIcon = () => {
    const status = getModerationStatus();
    switch (status) {
      case 'approved': return 'fas fa-check-circle text-green-500';
      case 'rejected': return 'fas fa-exclamation-triangle text-yellow-500';
      default: return 'fas fa-clock text-gray-500';
    }
  };

  const getStatusColor = () => {
    const status = getModerationStatus();
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'spam': return 'bg-red-100 text-red-800';
      case 'inappropriate': return 'bg-yellow-100 text-yellow-800';
      case 'fake': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!showWarnings) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Статус модерации */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <i className={`${getStatusIcon()} ${getStatusColor()}`}></i>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getModerationStatus() === 'approved' ? 'Одобрено' :
             getModerationStatus() === 'rejected' ? 'Требует проверки' :
             'Проверяется...'}
          </span>
        </div>
        
        <button
          onClick={() => setShowModerationInfo(!showModerationInfo)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showModerationInfo ? 'Скрыть детали' : 'Показать детали'}
        </button>
      </div>

      {/* Детали модерации */}
      {showModerationInfo && moderationResult && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(moderationResult.category)}`}>
                {moderationResult.category === 'spam' ? 'Спам' :
                 moderationResult.category === 'inappropriate' ? 'Неподходящий' :
                 moderationResult.category === 'fake' ? 'Подозрение на фейк' : 'Безопасный'}
              </span>
              <span className="text-sm text-gray-600">
                Уверенность: {Math.round(moderationResult.confidence * 100)}%
              </span>
            </div>
          </div>

          {moderationResult.issues.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Обнаруженные проблемы:</p>
              <ul className="space-y-1">
                {moderationResult.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-start">
                    <i className="fas fa-exclamation-circle text-xs mt-1 mr-2"></i>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {moderationResult.suggestions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Рекомендации:</p>
              <ul className="space-y-1">
                {moderationResult.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-blue-600 flex items-start">
                    <i className="fas fa-lightbulb text-xs mt-1 mr-2"></i>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!moderationResult.isAppropriate && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <i className="fas fa-info-circle mr-2"></i>
                Ваш контент может быть скрыт или отправлен на проверку модератору.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Индикатор загрузки */}
      {isModerating && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Проверяем контент...</span>
        </div>
      )}
    </div>
  );
};

export default ContentModerator;



