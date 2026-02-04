import React, { useState } from 'react';
import styled from 'styled-components';
import { ActivityFilters as ActivityFiltersType } from '../../services/activityService';

const FiltersContainer = styled.div`
  padding: 20px;
  flex: 1;
`;

const FiltersTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FilterSection = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #34495e;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const FilterButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FilterButton = styled.button<{ active: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${props => props.active ? '#3498db' : 'rgba(255,255,255,0.08)'};
  border-radius: 20px;
  background: ${props => props.active ? '#3498db' : 'rgba(255,255,255,0.03)'};
  color: ${props => props.active ? 'white' : '#7f8c8d'};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #3498db;
    background: ${props => props.active ? '#2980b9' : 'rgba(255,255,255,0.05)'};
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #2c3e50;
  cursor: pointer;
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  accent-color: #3498db;
`;

const ClearFiltersButton = styled.button`
  width: 100%;
  padding: 10px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 16px;

  &:hover {
    background: #c0392b;
  }
`;

interface ActivityFiltersProps {
  filters: ActivityFiltersType;
  onFiltersChange: (filters: Partial<ActivityFiltersType>) => void;
}

const ActivityFilters: React.FC<ActivityFiltersProps> = ({ filters, onFiltersChange }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const timeFilters = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'all', label: 'Всё время' }
  ];

  const activityTypeFilters = [
    { value: 'room_created', label: 'Комнаты' },
    { value: 'post_created', label: 'Посты' },
    { value: 'marker_created', label: 'Метки' },
    { value: 'route_created', label: 'Маршруты' },
    { value: 'event_created', label: 'События' },
    { value: 'achievement_earned', label: 'Достижения' },
    { value: 'system_update', label: 'Система' }
  ];

  const targetTypeFilters = [
    { value: 'room', label: 'Комнаты' },
    { value: 'post', label: 'Посты' },
    { value: 'marker', label: 'Метки' },
    { value: 'route', label: 'Маршруты' },
    { value: 'event', label: 'События' },
    { value: 'user', label: 'Пользователи' }
  ];

  const handleTimeFilter = () => {
    const newFilters = { ...localFilters };
    
    // Здесь можно добавить логику для фильтрации по времени
    // Пока просто обновляем локальное состояние
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleActivityTypeFilter = (value: string) => {
    const newFilters = { ...localFilters };
    const currentTypes = newFilters.activity_types || [];
    
    if (currentTypes.includes(value)) {
      newFilters.activity_types = currentTypes.filter(type => type !== value);
    } else {
      newFilters.activity_types = [...currentTypes, value];
    }
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTargetTypeFilter = (value: string) => {
    const newFilters = { ...localFilters };
    const currentTypes = newFilters.target_types || [];
    
    if (currentTypes.includes(value)) {
      newFilters.target_types = currentTypes.filter(type => type !== value);
    } else {
      newFilters.target_types = [...currentTypes, value];
    }
    
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleOnlyUnreadChange = (checked: boolean) => {
    const newFilters = { ...localFilters, only_unread: checked };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      limit: 20,
      offset: 0,
      activity_types: undefined,
      target_types: undefined,
      only_unread: false
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return (
      (localFilters.activity_types && localFilters.activity_types.length > 0) ||
      (localFilters.target_types && localFilters.target_types.length > 0) ||
      localFilters.only_unread
    );
  };

  return (
    <FiltersContainer>
      <FiltersTitle>
        🔍 Фильтры
      </FiltersTitle>

      <FilterSection>
        <SectionTitle>
          ⏰ Время
        </SectionTitle>
        <FilterButtons>
          {timeFilters.map(filter => (
            <FilterButton
              key={filter.value}
              active={false} // Пока не реализована логика времени
              onClick={() => handleTimeFilter()}
            >
              {filter.label}
            </FilterButton>
          ))}
        </FilterButtons>
      </FilterSection>

      <FilterSection>
        <SectionTitle>
          ⭐ Тип активности
        </SectionTitle>
        <FilterButtons>
          {activityTypeFilters.map(filter => (
            <FilterButton
              key={filter.value}
              active={localFilters.activity_types?.includes(filter.value) || false}
              onClick={() => handleActivityTypeFilter(filter.value)}
            >
              {filter.label}
            </FilterButton>
          ))}
        </FilterButtons>
      </FilterSection>

      <FilterSection>
        <SectionTitle>
          🎯 Тип цели
        </SectionTitle>
        <FilterButtons>
          {targetTypeFilters.map(filter => (
            <FilterButton
              key={filter.value}
              active={localFilters.target_types?.includes(filter.value) || false}
              onClick={() => handleTargetTypeFilter(filter.value)}
            >
              {filter.label}
            </FilterButton>
          ))}
        </FilterButtons>
      </FilterSection>

      <FilterSection>
        <SectionTitle>
          📋 Дополнительно
        </SectionTitle>
        <CheckboxGroup>
          <CheckboxItem>
            <Checkbox
              type="checkbox"
              checked={localFilters.only_unread || false}
              onChange={(e) => handleOnlyUnreadChange(e.target.checked)}
            />
            Только непрочитанные
          </CheckboxItem>
        </CheckboxGroup>
      </FilterSection>

      {hasActiveFilters() && (
        <ClearFiltersButton onClick={clearFilters}>
          Очистить фильтры
        </ClearFiltersButton>
      )}
    </FiltersContainer>
  );
};

export default ActivityFilters;
