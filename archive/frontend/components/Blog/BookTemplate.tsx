import React from 'react';

interface BookTemplateProps {
  title: string;
  coverImage?: string;
  rating: number;
  className?: string;
}

const BookTemplate: React.FC<BookTemplateProps> = ({ title, coverImage, rating, className = '' }) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 5) return '#FFD700'; // Золотой
    if (rating >= 4.5) return '#32CD32'; // Зеленый насыщенный
    if (rating >= 4) return '#228B22'; // Зеленый
    if (rating >= 3.5) return '#4169E1'; // Синий насыщенный
    if (rating >= 3) return '#1E90FF'; // Синий
    return '#808080'; // Серый
  };

  const getRatingIntensity = (rating: number) => {
    if (rating >= 4.5 || rating >= 3.5) return '0.8';
    return '1';
  };

  const spineColor = getRatingColor(rating);
  const intensity = getRatingIntensity(rating);

  return (
    <div className={`relative ${className}`}>
      <svg
        width="200"
        height="120"
        viewBox="0 0 200 120"
        className="drop-shadow-lg"
      >
        {/* Тень книги */}
        <defs>
          <filter id="bookShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="rgba(0,0,0,0.3)"/>
          </filter>
          <linearGradient id="spineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={spineColor} stopOpacity={intensity} />
            <stop offset="100%" stopColor={spineColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Корешок книги */}
        <rect
          x="20"
          y="20"
          width="25"
          height="80"
          fill="url(#spineGradient)"
          stroke={spineColor}
          strokeWidth="2"
          filter="url(#bookShadow)"
        />

        {/* Обложка книги */}
        <rect
          x="45"
          y="20"
          width="135"
          height="80"
          fill={coverImage ? 'url(#coverImage)' : '#F8F8F8'}
          stroke="#D0D0D0"
          strokeWidth="1"
          filter="url(#bookShadow)"
        />

        {/* Обложка с изображением */}
        {coverImage && (
          <defs>
            <pattern id="coverImage" patternUnits="userSpaceOnUse" width="135" height="80">
              <image href={coverImage} width="135" height="80" preserveAspectRatio="xMidYMid slice"/>
            </pattern>
          </defs>
        )}

        {/* Заголовок книги */}
        <text
          x="112.5"
          y="45"
          textAnchor="middle"
          className="text-sm font-bold fill-white"
          style={{ 
            fontSize: '12px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          {title.length > 18 ? title.substring(0, 18) + '...' : title}
        </text>

        {/* Рейтинг звездочки */}
        <g transform="translate(112.5, 65)">
          {[1, 2, 3, 4, 5].map((star) => (
            <text
              key={star}
              x={(star - 3) * 10}
              y="0"
              className="text-xs"
              fill={star <= Math.floor(rating) ? '#FFD700' : '#E0E0E0'}
              style={{ 
                fontSize: '10px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              ★
            </text>
          ))}
        </g>

        {/* Значение рейтинга */}
        <text
          x="112.5"
          y="85"
          textAnchor="middle"
          className="text-xs font-semibold fill-white"
          style={{ 
            fontSize: '9px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          {rating > 0 ? rating.toFixed(1) : '—'}
        </text>

        {/* Линии страниц */}
        <line x1="45" y1="25" x2="180" y2="25" stroke="#C0C0C0" strokeWidth="0.5"/>
        <line x1="45" y1="30" x2="180" y2="30" stroke="#C0C0C0" strokeWidth="0.5"/>
        <line x1="45" y1="35" x2="180" y2="35" stroke="#C0C0C0" strokeWidth="0.5"/>
      </svg>
    </div>
  );
};

export default BookTemplate;

