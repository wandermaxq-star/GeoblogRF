import React, { useState } from 'react';
import styled from 'styled-components';
import { ActivityFilters as ActivityFiltersType } from '../../services/activityService';
import { FaFilter, FaUser, FaBell } from 'react-icons/fa';

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(255,255,255,0.06);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
`;

const PanelHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: transparent;
`;

const PanelTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PanelSubtitle = styled.p`
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
`;

const PanelContent = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`;

const FilterSection = styled.div`
  margin-bottom: 24px;
`;

const FilterLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
`;

const FilterSelect = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 14px;
  background: rgba(255,255,255,0.04);
  color: #2c3e50;
  
  &:focus {
    outline: none;
    border-color: rgba(102,126,234,0.9);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.08);
  }
`;


const FilterCheckbox = styled.input`
  margin-right: 8px;
`;

const FilterCheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #2c3e50;
  cursor: pointer;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  ${props => props.variant === 'primary' ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
  ` : `
    background: rgba(255,255,255,0.04);
    color: #6c757d;
    border: 1px solid rgba(255,255,255,0.08);
    
    &:hover {
      background: rgba(255,255,255,0.06);
    }
  `}
`;

interface ActivityFiltersPanelProps {
  filters: ActivityFiltersType;
  onFiltersChange: (filters: ActivityFiltersType) => void;
  onClose: () => void;
}

const ActivityFiltersPanel: React.FC<ActivityFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  onClose
}) => {
  const [localFilters, setLocalFilters] = useState<ActivityFiltersType>(filters);

  const handleFilterChange = (key: keyof ActivityFiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: ActivityFiltersType = {
      limit: 20,
      offset: 0
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  return (
    <PanelContainer>
      <PanelHeader>
        <PanelTitle>
          <FaFilter />
          Фильтры активности
        </PanelTitle>
        <PanelSubtitle>
          Настройте отображение событий в ленте
        </PanelSubtitle>
      </PanelHeader>

      <PanelContent>
        <FilterSection>
          <FilterLabel>
            <FaBell style={{ marginRight: '8px' }} />
            Тип активности
          </FilterLabel>
          <FilterSelect
            value={localFilters.activity_types?.[0] || ''}
            onChange={(e) => handleFilterChange('activity_types', e.target.value ? [e.target.value] : undefined)}
          >
            <option value="">Все типы</option>
            <option value="message">Сообщения</option>
            <option value="join">Присоединения</option>
            <option value="room_created">Создание комнат</option>
            <option value="user_promoted">Повышения</option>
            <option value="system">Системные</option>
          </FilterSelect>
        </FilterSection>

        <FilterSection>
          <FilterLabel>
            <FaUser style={{ marginRight: '8px' }} />
            Тип цели
          </FilterLabel>
          <FilterSelect
            value={localFilters.target_types?.[0] || ''}
            onChange={(e) => handleFilterChange('target_types', e.target.value ? [e.target.value] : undefined)}
          >
            <option value="">Все типы</option>
            <option value="room">Комнаты</option>
            <option value="user">Пользователи</option>
            <option value="message">Сообщения</option>
            <option value="post">Посты</option>
            <option value="marker">Метки</option>
            <option value="route">Маршруты</option>
            <option value="event">События</option>
          </FilterSelect>
        </FilterSection>

        <FilterSection>
          <FilterCheckboxLabel>
            <FilterCheckbox
              type="checkbox"
              checked={localFilters.only_unread || false}
              onChange={(e) => handleFilterChange('only_unread', e.target.checked)}
            />
            Только непрочитанные
          </FilterCheckboxLabel>
        </FilterSection>

        <ActionButtons>
          <Button variant="secondary" onClick={handleReset}>
            Сбросить
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Применить
          </Button>
        </ActionButtons>
      </PanelContent>
    </PanelContainer>
  );
};

export default ActivityFiltersPanel;
