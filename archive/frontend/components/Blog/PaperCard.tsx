import React from 'react';
import { motion } from 'framer-motion';

interface BlogCoverData {
  title: string;
  description: string;
  gradient: string;
  textColor: string;
  titleFont: string;
  descriptionFont: string;
}

interface PaperCardProps {
  title: string;
  rating: number;
  className?: string;
  isHovered?: boolean;
  onClick?: () => void;
  customCover?: string; // Пользовательская обложка
  customColor?: string; // Пользовательский цвет
  coverData?: BlogCoverData; // Данные из редактора обложки
}

const PaperCard: React.FC<PaperCardProps> = ({ 
  title, 
  rating, 
  className = '', 
  isHovered = false,
  onClick,
  customCover,
  customColor,
  coverData
}) => {
  // Цветовая индикация рейтинга
  const getRatingColor = (rating: number) => {
    if (rating >= 5) return '#FFD700'; // Золотой
    if (rating >= 4.5) return '#10B981'; // Зеленый
    if (rating >= 4) return '#3B82F6'; // Синий
    if (rating >= 3.5) return '#8B5CF6'; // Фиолетовый
    if (rating >= 3) return '#6B7280'; // Серый
    return '#E5E7EB'; // Светло-серый
  };

  const ratingColor = getRatingColor(rating);

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Карточка блога с пользовательским дизайном */}
      <div 
        className="relative w-28 h-36 rounded-lg overflow-hidden"
        style={{
          background: coverData?.gradient || customColor || 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
          boxShadow: isHovered ? '0 8px 25px rgba(0, 0, 0, 0.2)' : '0 4px 15px rgba(0, 0, 0, 0.1)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Пользовательская обложка или стандартная */}
        {customCover ? (
          <img 
            src={customCover} 
            alt="Custom blog cover"
            className="w-full h-full object-cover"
            style={{
              filter: isHovered ? 'brightness(1.05)' : 'brightness(1)',
              transition: 'filter 0.3s ease'
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {/* Название блога */}
            <h3 
              className="text-sm font-bold text-center leading-tight mb-2"
              style={{ 
                color: coverData?.textColor || '#FFFFFF',
                fontWeight: coverData?.titleFont || 'bold'
              }}
            >
              {(coverData?.title || title).length > 15 
                ? (coverData?.title || title).substring(0, 15) + '...' 
                : (coverData?.title || title)}
            </h3>
            
            {/* Описание блога */}
            <p 
              className="text-xs text-center opacity-80"
              style={{ 
                color: coverData?.textColor || '#FFFFFF',
                fontWeight: coverData?.descriptionFont || 'normal'
              }}
            >
              {coverData?.description || 'Описание блога'}
            </p>
          </div>
        )}
        
        {/* Рейтинг с цветовой индикацией */}
        <div className="absolute top-2 right-2">
          <span 
            className="text-xs font-bold px-2 py-1 rounded-full text-white shadow-lg"
            style={{ 
              background: ratingColor,
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            {rating > 0 ? rating.toFixed(1) : '—'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PaperCard;
