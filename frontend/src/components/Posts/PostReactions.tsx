import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Smile } from 'lucide-react';
import {
  FaThumbsUp, FaHeart, FaLaughBeam, FaSurprise,
  FaSadTear, FaFire, FaHandsHelping, FaGlassCheers,
  FaBrain, FaDumbbell
} from 'react-icons/fa';

// Иконки реакций — SVG, выглядят одинаково на всех платформах
const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'Нравится',     color: '#3b82f6', Icon: FaThumbsUp     },
  { emoji: '❤️', label: 'Люблю',        color: '#ef4444', Icon: FaHeart        },
  { emoji: '😂', label: 'Смешно',       color: '#f59e0b', Icon: FaLaughBeam    },
  { emoji: '😮', label: 'Удивительно',  color: '#8b5cf6', Icon: FaSurprise     },
  { emoji: '😢', label: 'Грустно',      color: '#06b6d4', Icon: FaSadTear      },
  { emoji: '🔥', label: 'Горячо',       color: '#f97316', Icon: FaFire         },
  { emoji: '👏', label: 'Аплодирую',    color: '#10b981', Icon: FaHandsHelping },
  { emoji: '🎉', label: 'Праздную',     color: '#ec4899', Icon: FaGlassCheers  },
  { emoji: '🤔', label: 'Думаю',        color: '#6366f1', Icon: FaBrain        },
  { emoji: '💪', label: 'Сила',         color: '#14b8a6', Icon: FaDumbbell     },
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

const AddReactionButton = styled.button<{ $open?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 2px solid ${props => props.$open ? '#3b82f6' : '#d1d5db'};
  background: ${props => props.$open ? '#eff6ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;
  color: ${props => props.$open ? '#3b82f6' : '#6b7280'};
  box-shadow: ${props => props.$open ? '0 0 0 4px rgba(59,130,246,0.15)' : 'none'};
  
  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #eff6ff;
    box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
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
  bottom: calc(100% + 18px);
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 24px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.18),
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  padding: 16px;
  display: ${props => props.$visible ? 'grid' : 'none'};
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  z-index: 1000;
  min-width: 300px;
  animation: popIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Стрелка вниз — указывает на кнопку */
  &::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 16px;
    height: 16px;
    background: white;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.06);
    border-radius: 0 0 4px 0;
  }

  /* Перекрываем тень стрелки белым фоном */
  &::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: calc(50% - 12px);
    width: 24px;
    height: 12px;
    background: white;
    border-radius: 0 0 4px 4px;
    z-index: 1;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translateX(-50%) scale(0.85) translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) scale(1) translateY(0);
    }
  }
`;

const EmojiOption = styled.button<{ color?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 6px 8px;
  border-radius: 16px;
  border: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  z-index: 2;

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: ${props => props.color ? `${props.color}12` : '#f3f4f6'};
    transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  span {
    font-size: 10px;
    color: #9ca3af;
    font-weight: 500;
    line-height: 1;
    transition: color 0.18s ease;
    white-space: nowrap;
  }

  .count {
    font-size: 9px;
    color: ${props => props.color || '#6b7280'};
    font-weight: 700;
    background: ${props => props.color ? `${props.color}18` : '#f3f4f6'};
    border-radius: 8px;
    padding: 1px 5px;
  }

  &:hover {
    transform: scale(1.12) translateY(-2px);

    .icon-wrap {
      background: ${props => props.color ? `${props.color}22` : '#f3f4f6'};
      box-shadow: 0 4px 12px ${props => props.color ? `${props.color}40` : 'rgba(0,0,0,0.1)'};
    }

    span {
      color: ${props => props.color || '#374151'};
      font-weight: 600;
    }
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
    return EMOJI_REACTIONS.find(e => e.emoji === emoji) || { emoji, label: '', color: '#3b82f6', Icon: FaThumbsUp };
  };

  return (
    <ReactionsContainer>
      {visibleReactions.map((reaction, index) => {
        const emojiInfo = getEmojiInfo(reaction.emoji);
        const { Icon } = emojiInfo;
        return (
          <ReactionButton
            key={`${reaction.emoji}-${index}`}
            active={reaction.userReacted}
            color={emojiInfo.color}
            onClick={() => onReactionClick(reaction.emoji)}
            disabled={disabled}
            title={`${emojiInfo.label}: ${reaction.count}`}
          >
            <Icon size={16} />
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
          $open={showPicker}
          onClick={() => setShowPicker(!showPicker)}
          disabled={disabled}
          title="Добавить реакцию"
        >
          <Smile size={18} />
        </AddReactionButton>

        <EmojiPicker $visible={showPicker} ref={pickerRef}>
          {EMOJI_REACTIONS.map((emojiInfo) => {
            const { Icon } = emojiInfo;
            const existingReaction = reactions.find(r => r.emoji === emojiInfo.emoji);
            return (
              <EmojiOption
                key={emojiInfo.emoji}
                color={emojiInfo.color}
                onClick={() => handleEmojiClick(emojiInfo.emoji)}
                title={emojiInfo.label}
              >
                <div className="icon-wrap">
                  <Icon size={22} color={emojiInfo.color} />
                </div>
                <span>{emojiInfo.label}</span>
                {existingReaction && (
                  <span className="count">{existingReaction.count}</span>
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

