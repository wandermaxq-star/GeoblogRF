import React, { useState } from 'react';
import { FaFlag } from 'react-icons/fa';
import apiClient from '../../api/apiClient';

interface ReportButtonProps {
  contentId: string;
  contentType: 'marker' | 'route' | 'post' | 'event' | 'comment';
  contentTitle: string;
  variant?: 'button' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  contentId,
  contentType,
  contentTitle,
  variant = 'button',
  size = 'md',
  className = '',
  style
}) => {
  const [isReporting, setIsReporting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMessage, setReportMessage] = useState('');

  const handleSubmitReport = async () => {
    setIsReporting(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Требуется авторизация для отправки жалобы');
        setIsReporting(false);
        return;
      }

      // Отправляем жалобу через feedback API
      const response = await apiClient.post(
        '/feedback/submit',
        {
          type: 'complaint',
          category: contentType === 'marker' ? 'content' : 'other',
          content_type: contentType,
          content_id: contentId,
          content_title: contentTitle,
          message: reportMessage,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Успешно отправлено
      alert('Жалоба успешно отправлена администратору! Спасибо за обратную связь.');
      setReportMessage('');
      setShowReportModal(false);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      alert(error.response?.data?.message || 'Ошибка при отправке жалобы. Попробуйте позже.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleReport = () => {
    // Открываем модаль вместо сразу отправки
    setShowReportModal(true);
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
        return 'p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors duration-200';
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
    <>
      <button
        onClick={handleReport}
        disabled={isReporting}
        className={`flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed ${getVariantClasses()} ${className}`}
        style={style}
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

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[5000]" onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Пожаловаться</h3>
            <p className="text-sm text-gray-600 mb-4">
              Сообщение о проблеме: <span className="font-medium">{contentTitle}</span>
            </p>
            
            <textarea
              value={reportMessage}
              onChange={(e) => setReportMessage(e.target.value)}
              placeholder="Опишите проблему подробнее (обязательно)..."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={4}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isReporting || !reportMessage.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors disabled:cursor-not-allowed"
              >
                {isReporting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;
