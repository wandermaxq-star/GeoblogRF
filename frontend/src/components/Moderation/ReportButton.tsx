import React, { useState } from 'react';
import { FaFlag } from 'react-icons/fa';

interface ReportButtonProps {
  contentId: string;
  contentType: 'marker' | 'route' | 'post' | 'event' | 'comment';
  contentTitle: string;
  variant?: 'button' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  contentId,
  contentType,
  contentTitle,
  variant = 'button',
  size = 'md',
  className = ''
}) => {
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = async () => {
    setIsReporting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create activity for the report
      console.log('Report submitted:', { contentId, contentType, contentTitle });
      
      // Show success notification
      alert('Жалоба успешно отправлена!');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Ошибка при отправке жалобы');
    } finally {
      setIsReporting(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-base px-4 py-3';
      default:
        return 'text-sm px-3 py-2';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'icon':
        return 'p-2 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors';
      case 'text':
        return 'text-red-600 hover:text-red-700 underline hover:no-underline transition-colors';
      default:
        return `bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg transition-colors ${getSizeClasses()}`;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-lg';
      default:
        return 'text-sm';
    }
  };

  const getButtonContent = () => {
    if (variant === 'icon') {
      return <FaFlag className={getIconSize()} />;
    }
    
    if (variant === 'text') {
      return (
        <span className="flex items-center space-x-1">
          <FaFlag className={getIconSize()} />
          <span>Пожаловаться</span>
        </span>
      );
    }

    return (
      <span className="flex items-center space-x-2">
        <FaFlag className={getIconSize()} />
        <span>Пожаловаться</span>
      </span>
    );
  };

  return (
    <button
      onClick={handleReport}
      disabled={isReporting}
      className={`flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed ${getVariantClasses()} ${className}`}
      title="Пожаловаться на контент"
    >
      {isReporting ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
          <span>Отправка...</span>
        </div>
      ) : (
        getButtonContent()
      )}
    </button>
  );
};

export default ReportButton;
