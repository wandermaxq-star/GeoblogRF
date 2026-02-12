import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Smile } from 'lucide-react';

// Набор эмодзи для реакций (можно настроить)
const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'Нравится', color: '#3b82f6' },
  { emoji: '❤️', label: 'Люблю', color: '#ef4444' },
  { emoji: '😂', label: 'Смешно', color: '#f59e0b' },
  { emoji: '😮', label: 'Удивительно', color: '#8b5cf6' },
  { emoji: '😢', label: 'Грустно', color: '#06b6d4' },
  { emoji: '🔥', label: 'Горячо', color: '#f97316' },
  { emoji: '👏', label: 'Аплодирую', color: '#10b981' },
  { emoji: '🎉', label: 'Праздную', color: '#ec4899' },
  { emoji: '🤔', label: 'Думаю', color: '#6366f1' },
  { emoji: '💪', label: 'Сила', color: '#14b8a6' },
];

export interface PostReactionComponent {
  emoji: string;
  count: number;
  userReacted: boolean; // Реагировал ли текущий пользователь
  users?: string[]; // Список пользователей, которые поставили реакцию (опционально)
}

interface PostReactionsProps {
  reactions: PostReactionComponent[];
  onReactionClick: (emoji: string) => void;
  onAddReaction?: () => void;
  disabled?: boolean;
  maxVisible?: number; // Максимум видимых реакций перед "ещё"
}

const ReactionsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  position: relative;
`;

const ReactionButton = styled.button<{ active?: boolean; color?: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 2px solid ${props => props.active ? props.color || '#3b82f6' : '#e5e7eb'};
  background: ${props => props.active 
    ? `${props.color || '#3b82f6'}15` 
    : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  font-weight: ${props => props.active ? '600' : '500'};
  color: ${props => props.active ? props.color || '#3b82f6' : '#6b7280'};
  
  &:hover {
    background: ${props => props.active 
      ? `${props.color || '#3b82f6'}25` 
      : '#f9fafb'};
    border-color: ${props => props.color || '#3b82f6'};
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AddReactionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 2px dashed #d1d5db;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #6b7280;
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #f0f9ff;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmojiPicker = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  padding: 12px;
  display: ${props => props.$visible ? 'grid' : 'none'};
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  z-index: 1000;
  min-width: 280px;
  animation: slideUp 0.2s ease-out;
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const EmojiOption = styled.button<{ color?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 24px;
  
  &:hover {
    background: ${props => props.color ? `${props.color}15` : '#f9fafb'};
    border-color: ${props => props.color || '#e5e7eb'};
    transform: scale(1.1);
  }
  
  span {
    font-size: 10px;
    color: #6b7280;
    font-weight: 500;
  }
`;

const MoreReactionsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 2px solid #e5e7eb;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  
  &:hover {
    background: #f9fafb;
    border-color: #3b82f6;
    color: #3b82f6;
  }
`;

const PostReactions: React.FC<PostReactionsProps> = ({
  reactions = [],
  onReactionClick,
  onAddReaction,
  disabled = false,
  maxVisible = 8
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Закрываем пикер при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        buttonRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  // Сортируем реакции: сначала активные, потом по количеству
  const sortedReactions = [...reactions].sort((a, b) => {
    if (a.userReacted && !b.userReacted) return -1;
    if (!a.userReacted && b.userReacted) return 1;
    return b.count - a.count;
  });

  const visibleReactions = sortedReactions.slice(0, maxVisible);
  const hiddenReactions = sortedReactions.slice(maxVisible);

  const handleEmojiClick = (emoji: string) => {
    onReactionClick(emoji);
    setShowPicker(false);
  };

  const getEmojiInfo = (emoji: string) => {
    return EMOJI_REACTIONS.find(e => e.emoji === emoji) || { emoji, label: '', color: '#3b82f6' };
  };

  return (
    <ReactionsContainer>
      {visibleReactions.map((reaction, index) => {
        const emojiInfo = getEmojiInfo(reaction.emoji);
        return (
          <ReactionButton
            key={`${reaction.emoji}-${index}`}
            active={reaction.userReacted}
            color={emojiInfo.color}
            onClick={() => onReactionClick(reaction.emoji)}
            disabled={disabled}
            title={`${emojiInfo.label}: ${reaction.count}`}
          >
            <span>{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </ReactionButton>
        );
      })}

      {hiddenReactions.length > 0 && (
        <MoreReactionsButton
          onClick={() => setShowPicker(true)}
          disabled={disabled}
          title={`Ещё ${hiddenReactions.length} реакций`}
        >
          <span>+{hiddenReactions.length}</span>
        </MoreReactionsButton>
      )}

      <div style={{ position: 'relative' }}>
        <AddReactionButton
          ref={buttonRef}
          onClick={() => setShowPicker(!showPicker)}
          disabled={disabled}
          title="Добавить реакцию"
        >
          <Smile size={18} />
        </AddReactionButton>

        <EmojiPicker $visible={showPicker} ref={pickerRef}>
          {EMOJI_REACTIONS.map((emojiInfo) => {
            const existingReaction = reactions.find(r => r.emoji === emojiInfo.emoji);
            return (
              <EmojiOption
                key={emojiInfo.emoji}
                color={emojiInfo.color}
                onClick={() => handleEmojiClick(emojiInfo.emoji)}
                title={emojiInfo.label}
              >
                <span>{emojiInfo.emoji}</span>
                {existingReaction && (
                  <span>{existingReaction.count}</span>
                )}
              </EmojiOption>
            );
          })}
        </EmojiPicker>
      </div>
    </ReactionsContainer>
  );
};

export default PostReactions;

