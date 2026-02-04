import React from 'react';

interface CategoryButtonProps {
  category: 'post' | 'event';
  isActive: boolean;
  onToggle: (category: 'post' | 'event') => void;
  label: string;
}

const CategoryButton: React.FC<CategoryButtonProps> = ({ 
  category, 
  isActive, 
  onToggle, 
  label 
}) => {
  return (
    <button
      className={`category-button ${isActive ? 'active' : ''}`}
      onClick={() => onToggle(category)}
      style={{
        width: '70px',
        height: '28px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        border: 'none',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        
        // Не нажатое состояние - выпуклость
        ...(isActive ? {} : {
          background: 'linear-gradient(145deg, #f8f9fa, #e9ecef)',
          boxShadow: `
            2px 2px 3px rgba(0,0,0,0.08),
            -1px -1px 2px rgba(255,255,255,0.9)
          `,
          color: '#495057',
          border: '1px solid #dee2e6'
        }),
        
        // Нажатое состояние - вогнутость
        ...(isActive ? {
          background: 'linear-gradient(145deg, #495057, #343a40)',
          boxShadow: `
            inset 2px 2px 3px rgba(0,0,0,0.2),
            inset -1px -1px 2px rgba(255,255,255,0.05)
          `,
          color: '#f8f9fa',
          border: '1px solid #6c757d'
        } : {})
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'linear-gradient(145deg, #e9ecef, #dee2e6)';
        } else {
          e.currentTarget.style.background = 'linear-gradient(145deg, #343a40, #212529)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'linear-gradient(145deg, #f8f9fa, #e9ecef)';
        } else {
          e.currentTarget.style.background = 'linear-gradient(145deg, #495057, #343a40)';
        }
      }}
    >
      {label}
    </button>
  );
};

export default CategoryButton;
