import React, { useState, useRef, useEffect } from 'react';
import {
  FaStar, FaUtensils, FaHotel, FaLeaf, FaLandmark, FaGem,
  FaBus, FaWallet, FaHeart, FaUsers, FaBuilding, FaQuestion,
  FaChevronUp, FaChevronDown, FaFilter
} from 'react-icons/fa';

/** Основные категории для быстрого выбора */
const QUICK_CATEGORIES = [
  { key: 'attraction', label: 'Достопримечательности', icon: FaStar, color: '#3498db' },
  { key: 'restaurant', label: 'Рестораны', icon: FaUtensils, color: '#e74c3c' },
  { key: 'hotel', label: 'Отели', icon: FaHotel, color: '#8e44ad' },
  { key: 'nature', label: 'Природа', icon: FaLeaf, color: '#27ae60' },
  { key: 'culture', label: 'Культура', icon: FaLandmark, color: '#f1c40f' },
  { key: 'entertainment', label: 'Развлечения', icon: FaGem, color: '#f39c12' },
  { key: 'transport', label: 'Транспорт', icon: FaBus, color: '#16a085' },
  { key: 'shopping', label: 'Торговля', icon: FaWallet, color: '#e67e22' },
  { key: 'healthcare', label: 'Здоровье', icon: FaHeart, color: '#e74c3c' },
  { key: 'education', label: 'Образование', icon: FaUsers, color: '#3498db' },
  { key: 'service', label: 'Сервис', icon: FaBuilding, color: '#34495e' },
  { key: 'other', label: 'Другое', icon: FaQuestion, color: '#7f8c8d' },
] as const;

const MAX_CATEGORIES = 3;

interface CategoryQuickFilterProps {
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  /** Двухоконный режим (карта слева, посты справа) */
  isTwoPanelMode?: boolean;
}

const CategoryQuickFilter: React.FC<CategoryQuickFilterProps> = ({
  selectedCategories,
  onCategoriesChange,
  isTwoPanelMode = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const toggleCategory = (key: string) => {
    if (selectedCategories.includes(key)) {
      // Снять выбор
      onCategoriesChange(selectedCategories.filter(k => k !== key));
      setShowLimitWarning(false);
    } else {
      // Добавить — но не больше MAX_CATEGORIES
      if (selectedCategories.length >= MAX_CATEGORIES) {
        setShowLimitWarning(true);
        setTimeout(() => setShowLimitWarning(false), 2000);
        return;
      }
      onCategoriesChange([...selectedCategories, key]);
      setShowLimitWarning(false);
    }
  };

  const clearAll = () => {
    onCategoriesChange([]);
    setShowLimitWarning(false);
  };

  // Получить данные выбранных категорий
  const activeCategories = QUICK_CATEGORIES.filter(c => selectedCategories.includes(c.key));

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        left: '70px',
        bottom: '24px',
        zIndex: 1100,
        pointerEvents: 'auto',
        maxWidth: isTwoPanelMode ? 'calc(50% - 24px)' : 'calc(100% - 24px)',
      }}
    >
      {/* Предупреждение о лимите */}
      {showLimitWarning && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: '8px',
          background: 'rgba(220, 53, 69, 0.95)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          animation: 'fadeInUp 0.2s ease-out',
        }}>
          Максимум {MAX_CATEGORIES} категории одновременно
        </div>
      )}

      {/* Раскрытая панель с выбором категорий */}
      {isExpanded && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: '8px',
          background: 'rgba(25, 25, 30, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '14px',
          padding: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
          width: '280px',
          animation: 'fadeInUp 0.2s ease-out',
        }}>
          {QUICK_CATEGORIES.map(cat => {
            const isSelected = selectedCategories.includes(cat.key);
            const isDisabled = !isSelected && selectedCategories.length >= MAX_CATEGORIES;
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                title={cat.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '8px 4px',
                  borderRadius: '10px',
                  border: isSelected
                    ? `2px solid ${cat.color}`
                    : '2px solid transparent',
                  background: isSelected
                    ? `${cat.color}22`
                    : 'rgba(255,255,255,0.05)',
                  color: isSelected ? cat.color : (isDisabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)'),
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '9px',
                  fontWeight: 500,
                  opacity: isDisabled ? 0.4 : 1,
                }}
              >
                <Icon size={16} />
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '80px',
                  textAlign: 'center',
                }}>
                  {cat.label}
                </span>
              </button>
            );
          })}

          {/* Кнопка "Сбросить" */}
          {selectedCategories.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                gridColumn: '1 / -1',
                marginTop: '4px',
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
            >
              Показать все категории
            </button>
          )}
        </div>
      )}

      {/* Основная кнопка-панель */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: activeCategories.length > 0 ? '8px 14px' : '8px 12px',
          background: 'rgba(25, 25, 30, 0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: activeCategories.length > 0
            ? '1px solid rgba(76, 201, 240, 0.3)'
            : '1px solid rgba(255,255,255,0.12)',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        <FaFilter size={12} style={{ opacity: 0.7 }} />

        {activeCategories.length === 0 ? (
          <span style={{ opacity: 0.7, fontSize: '12px' }}>Все категории</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {activeCategories.map(cat => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: `${cat.color}33`,
                    color: cat.color,
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <Icon size={11} />
                  {cat.label}
                </div>
              );
            })}
          </div>
        )}

        {isExpanded ? <FaChevronDown size={10} /> : <FaChevronUp size={10} />}
      </button>

      {/* Анимация */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CategoryQuickFilter;
