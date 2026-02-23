// frontend/src/components/Posts/PostComments.tsx
// Раздел комментариев поста — glass-morphism UI, дерево ответов, лайки, модерация
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  Heart,
  Trash2,
  CornerDownRight,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import {
  CommentDTO,
  getComments,
  createComment,
  deleteComment,
  toggleCommentLike,
  buildCommentTree,
} from '../../services/commentsService';
import { useAuth } from '../../contexts/AuthContext';

/* ═══════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════ */

interface PostCommentsProps {
  postId: string;
  commentsCount: number;
  onCountChange?: (delta: number) => void;
  isDark?: boolean;
}

/* ═══════════════════════════════════════════════
   Keyframes
   ═══════════════════════════════════════════════ */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const popIn = keyframes`
  0%   { opacity: 0; transform: scale(0.92) translateY(-4px); }
  100% { opacity: 1; transform: scale(1)    translateY(0); }
`;

/* ═══════════════════════════════════════════════
   Glass tokens
   ═══════════════════════════════════════════════ */

const gLight = {
  bg:       'rgba(0,0,0,0.02)',
  bgHover:  'rgba(0,0,0,0.04)',
  border:   'rgba(0,0,0,0.08)',
  text:     '#1a1a2e',
  textSec:  'rgba(0,0,0,0.45)',
  accent:   '#6366f1',
  accentBg: 'rgba(99,102,241,0.10)',
  red:      '#ef4444',
  redBg:    'rgba(239,68,68,0.08)',
  green:    '#10b981',
  yellow:   '#f59e0b',
};

const gDark = {
  bg:       'rgba(255,255,255,0.06)',
  bgHover:  'rgba(255,255,255,0.10)',
  border:   'rgba(255,255,255,0.10)',
  text:     '#e8eaf0',
  textSec:  'rgba(255,255,255,0.50)',
  accent:   '#818cf8',
  accentBg: 'rgba(129,140,248,0.15)',
  red:      '#f87171',
  redBg:    'rgba(248,113,113,0.12)',
  green:    '#34d399',
  yellow:   '#fbbf24',
};

// Default used in styled-component template literals (light theme)
const g = gLight;

/* ═══════════════════════════════════════════════
   Styled: Section wrapper
   ═══════════════════════════════════════════════ */

const Section = styled.div<{ $dark?: boolean }>`
  border-top: 1px solid var(--c-border);
  animation: ${fadeIn} 0.3s ease-out;
  overflow: hidden;
  border-radius: 0 0 12px 12px;

  /* CSS custom-property bridge: lets children read the active palette */
  --c-bg: ${p => p.$dark ? gDark.bg : gLight.bg};
  --c-bgHover: ${p => p.$dark ? gDark.bgHover : gLight.bgHover};
  --c-border: ${p => p.$dark ? gDark.border : gLight.border};
  --c-text: ${p => p.$dark ? gDark.text : gLight.text};
  --c-textSec: ${p => p.$dark ? gDark.textSec : gLight.textSec};
  --c-accent: ${p => p.$dark ? gDark.accent : gLight.accent};
  --c-accentBg: ${p => p.$dark ? gDark.accentBg : gLight.accentBg};
  --c-red: ${p => p.$dark ? gDark.red : gLight.red};
  --c-redBg: ${p => p.$dark ? gDark.redBg : gLight.redBg};
  --c-green: ${p => p.$dark ? gDark.green : gLight.green};
  --c-yellow: ${p => p.$dark ? gDark.yellow : gLight.yellow};
  --c-inputBg: ${p => p.$dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)'};
  --c-inputBorder: ${p => p.$dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'};
  --c-skeletonA: ${p => p.$dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'};
  --c-skeletonB: ${p => p.$dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};
  --c-sendBg: ${p => p.$dark ? 'linear-gradient(135deg,#818cf8,#6366f1)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)'};
  --c-sendDisabled: ${p => p.$dark ? 'rgba(129,140,248,0.2)' : 'rgba(99,102,241,0.25)'};
  --c-sendShadow: ${p => p.$dark ? 'rgba(129,140,248,0.35)' : 'rgba(99,102,241,0.35)'};

  color: var(--c-text);
  border-top-color: var(--c-border);
`;

const SectionHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--c-bg);
  border: none;
  cursor: pointer;
  color: var(--c-textSec);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  transition: background 0.2s;

  &:hover { background: var(--c-bgHover); }
  svg { transition: transform 0.25s ease; }
`;

/* ═══════════════════════════════════════════════
   Styled: Compose form
   ═══════════════════════════════════════════════ */

const ComposeWrap = styled.div<{ $reply?: boolean }>`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: ${p => (p.$reply ? '10px 20px 10px 48px' : '14px 20px')};
  background: ${p => (p.$reply ? 'rgba(129,140,248,0.04)' : g.bg)};
  border-top: 1px solid var(--c-border);
  animation: ${p => (p.$reply ? css`${popIn} 0.25s ease-out` : 'none')};
`;

const Avatar = styled.div<{ $size?: number; $color?: string }>`
  width: ${p => p.$size ?? 34}px;
  height: ${p => p.$size ?? 34}px;
  border-radius: 50%;
  background: ${p => p.$color ?? 'linear-gradient(135deg,#667eea,#764ba2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => (p.$size ?? 34) * 0.36}px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);

  img { width: 100%; height: 100%; object-fit: cover; }
`;

const InputWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 56px;
  max-height: 160px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--c-inputBorder);
  background: var(--c-inputBg);
  color: var(--c-text);
  font-size: 13.5px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder { color: var(--c-textSec); }

  &:focus {
    outline: none;
    border-color: var(--c-accent);
    box-shadow: 0 0 0 3px var(--c-accentBg);
  }
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
`;

const CharCount = styled.span<{ $warn?: boolean }>`
  font-size: 11px;
  color: ${p => (p.$warn ? g.yellow : g.textSec)};
  margin-right: auto;
  font-variant-numeric: tabular-nums;
`;

const HintText = styled.span`
  font-size: 11px;
  color: var(--c-textSec);
  flex: 1;
`;

const SendBtn = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 16px;
  border-radius: 20px;
  border: none;
  background: ${p =>
    p.$disabled
      ? 'var(--c-sendDisabled)'
      : 'var(--c-sendBg)'};
  color: ${p => (p.$disabled ? 'rgba(255,255,255,0.5)' : '#fff')};
  font-size: 12.5px;
  font-weight: 600;
  cursor: ${p => (p.$disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.2s ease;
  box-shadow: ${p =>
    p.$disabled ? 'none' : '0 4px 14px var(--c-sendShadow)'};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px var(--c-sendShadow);
  }
  &:active:not(:disabled) { transform: translateY(0); }
`;

const CancelBtn = styled.button`
  font-size: 12px;
  color: var(--c-textSec);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: color 0.2s;
  &:hover { color: var(--c-text); }
`;

const ReplyHint = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--c-textSec);
  margin-bottom: 2px;

  strong { color: var(--c-accent); font-weight: 600; }
`;

/* ═══════════════════════════════════════════════
   Styled: Comment list
   ═══════════════════════════════════════════════ */

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.div<{ $depth?: number; $isNew?: boolean }>`
  display: flex;
  gap: 10px;
  padding: 12px 20px 12px ${p => 20 + (p.$depth ?? 0) * 24}px;
  border-top: 1px solid var(--c-border);
  position: relative;
  transition: background 0.2s;

  ${p =>
    p.$isNew &&
    css`animation: ${popIn} 0.35s ease-out;`}

  &:hover { background: var(--c-bgHover); }
`;

const ThreadLine = styled.div<{ $depth?: number }>`
  position: absolute;
  left: ${p => 14 + (p.$depth ?? 1) * 24}px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--c-accentBg), transparent 90%);
  border-radius: 2px;
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 3px;
`;

const AuthorName = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text);
`;

const TimeAgo = styled.span`
  font-size: 11px;
  color: var(--c-textSec);
`;

const Badge = styled.span<{ $variant: 'pending' | 'active' | 'rejected' | 'revision' }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  ${p => {
    switch (p.$variant) {
      case 'pending':
        return `background: rgba(251,191,36,0.15); color: var(--c-yellow);`;
      case 'active':
        return `background: rgba(52,211,153,0.15); color: var(--c-green);`;
      case 'rejected':
        return `background: var(--c-redBg); color: var(--c-red);`;
      case 'revision':
        return `background: var(--c-accentBg); color: var(--c-accent);`;
    }
  }}
`;

const CommentText = styled.p`
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--c-text);
  margin: 0 0 6px;
  word-break: break-word;
  opacity: 0.92;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const ActBtn = styled.button<{ $active?: boolean; $color?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${p => (p.$active ? (p.$color || g.accent) : g.textSec)};
  font-size: 12px;
  font-weight: ${p => (p.$active ? 600 : 400)};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(0,0,0,0.04);
    color: ${p => (p.$color || g.text)};
  }
`;

/* ═══════════════════════════════════════════════
   Styled: Empty / Loading / Error states
   ═══════════════════════════════════════════════ */

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px;
  color: var(--c-textSec);
  font-size: 13px;
`;

const SkeletonRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--c-border);
`;

const Skeleton = styled.div<{ $w?: string; $h?: string; $round?: boolean }>`
  width: ${p => p.$w ?? '100%'};
  height: ${p => p.$h ?? '12px'};
  border-radius: ${p => (p.$round ? '50%' : '6px')};
  background: linear-gradient(
    90deg,
    var(--c-skeletonA) 25%,
    var(--c-skeletonB) 50%,
    var(--c-skeletonA) 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.6s infinite ease-in-out;
`;

const ErrorBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 20px;
  color: var(--c-red);
  font-size: 13px;
  border-top: 1px solid var(--c-border);
`;

const RetryBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid var(--c-red);
  background: transparent;
  color: var(--c-red);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { background: var(--c-redBg); }
`;

/* ═══════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════ */

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч`;
  if (s < 2592000) return `${Math.floor(s / 86400)} дн`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
];

function avatarGradient(id: string | number): string {
  const n = String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function badgeIcon(status: string) {
  if (status === 'pending') return <Clock size={10} />;
  if (status === 'active') return <CheckCircle size={10} />;
  if (status === 'rejected') return <XCircle size={10} />;
  return null;
}

function badgeLabel(status: string): string {
  if (status === 'pending') return 'На проверке';
  if (status === 'rejected') return 'Отклонён';
  if (status === 'revision') return 'На доработке';
  return '';
}

const MAX_LEN = 2000;

/* ═══════════════════════════════════════════════
   CommentNode — single comment
   ═══════════════════════════════════════════════ */

interface NodeProps {
  comment: CommentDTO;
  postId: string;
  uid: string | null;
  isNew?: boolean;
  depth?: number;
  onReply: (c: CommentDTO) => void;
  onDelete: (id: number) => void;
  onLike: (id: number) => void;
}

const CommentNode: React.FC<NodeProps> = ({
  comment, postId, uid, isNew, depth = 0, onReply, onDelete, onLike,
}) => {
  const isOwn = uid === comment.author_id;
  const showBadge = isOwn && comment.status !== 'active';
  const name =
    comment.author_name ||
    [comment.author_first_name, comment.author_last_name].filter(Boolean).join(' ') ||
    'Пользователь';

  return (
    <>
      <Item $depth={depth} $isNew={isNew}>
        {depth > 0 && <ThreadLine $depth={depth} />}

        <Avatar $size={depth > 0 ? 26 : 32} $color={avatarGradient(comment.author_id)}>
          {comment.author_avatar
            ? <img src={comment.author_avatar} alt={name} />
            : initials(name)}
        </Avatar>

        <Body>
          <Header>
            <AuthorName>{name}</AuthorName>
            <TimeAgo>{relativeTime(comment.created_at)}</TimeAgo>
            {showBadge && (
              <Badge $variant={comment.status as 'pending'}>
                {badgeIcon(comment.status)}
                {badgeLabel(comment.status)}
              </Badge>
            )}
          </Header>

          <CommentText>{comment.content}</CommentText>

          {comment.status !== 'rejected' && (
            <Actions>
              <ActBtn
                $active={comment.user_liked}
                $color={g.red}
                onClick={() => onLike(comment.id)}
                title={comment.user_liked ? 'Снять лайк' : 'Нравится'}
              >
                <Heart size={13} fill={comment.user_liked ? 'currentColor' : 'none'} />
                {comment.likes_count > 0 && comment.likes_count}
              </ActBtn>

              {depth === 0 && uid && (
                <ActBtn onClick={() => onReply(comment)} title="Ответить">
                  <CornerDownRight size={13} />
                  Ответить
                </ActBtn>
              )}

              {isOwn && (
                <ActBtn
                  $color={g.red}
                  onClick={() => onDelete(comment.id)}
                  title="Удалить"
                  style={{ marginLeft: 'auto' }}
                >
                  <Trash2 size={12} />
                </ActBtn>
              )}
            </Actions>
          )}
        </Body>
      </Item>

      {comment.replies?.map(reply => (
        <CommentNode
          key={reply.id}
          comment={reply}
          postId={postId}
          uid={uid}
          onReply={onReply}
          onDelete={onDelete}
          onLike={onLike}
          depth={depth + 1}
        />
      ))}
    </>
  );
};

/* ═══════════════════════════════════════════════
   ComposeBox — input form
   ═══════════════════════════════════════════════ */

interface ComposeProps {
  replyTo: CommentDTO | null;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
  currentUser: { id: string; username?: string; name?: string; avatar_url?: string } | null;
  isReply?: boolean;
}

const ComposeBox: React.FC<ComposeProps> = ({ replyTo, onSubmit, onCancel, currentUser, isReply }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isReply && ref.current) ref.current.focus();
  }, [isReply]);

  const handleSubmit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setError(null);
    setSending(true);
    try {
      await onSubmit(t);
      setText('');
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз');
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const displayName = currentUser?.username || currentUser?.name || 'Вы';
  const charLeft = MAX_LEN - text.length;

  return (
    <ComposeWrap $reply={isReply}>
      <Avatar $size={isReply ? 26 : 32} $color={avatarGradient(currentUser?.id || '0')}>
        {currentUser?.avatar_url
          ? <img src={currentUser.avatar_url} alt={displayName} />
          : initials(displayName)}
      </Avatar>

      <InputWrap>
        {replyTo && (
          <ReplyHint>
            <CornerDownRight size={11} />
            Ответ для <strong>{replyTo.author_name || 'пользователя'}</strong>
            <CancelBtn onClick={onCancel} style={{ padding: '0 4px' }}>✕</CancelBtn>
          </ReplyHint>
        )}

        <Textarea
          ref={ref}
          placeholder={replyTo ? 'Напишите ответ…' : 'Оставить комментарий…'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          maxLength={MAX_LEN}
          disabled={sending}
        />

        {error && (
          <div style={{ fontSize: 11, color: g.red, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <BottomRow>
          {text.length > 0 && (
            <CharCount $warn={charLeft < 100}>
              {charLeft}
            </CharCount>
          )}
          <HintText>Ctrl+Enter — отправить</HintText>
          {isReply && <CancelBtn onClick={onCancel}>Отмена</CancelBtn>}
          <SendBtn
            $disabled={!text.trim() || sending}
            disabled={!text.trim() || sending}
            onClick={handleSubmit}
          >
            <Send size={13} />
            {sending ? 'Отправка…' : 'Отправить'}
          </SendBtn>
        </BottomRow>
      </InputWrap>
    </ComposeWrap>
  );
};

/* ═══════════════════════════════════════════════
   Skeleton loader (3 fake rows)
   ═══════════════════════════════════════════════ */

const LoadingSkeleton: React.FC = () => (
  <>
    {[0, 1, 2].map(i => (
      <SkeletonRow key={i}>
        <Skeleton $w="32px" $h="32px" $round />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton $w="90px" $h="12px" />
            <Skeleton $w="50px" $h="10px" />
          </div>
          <Skeleton $w={i === 1 ? '75%' : '90%'} $h="11px" />
          <Skeleton $w="45%" $h="11px" />
        </div>
      </SkeletonRow>
    ))}
  </>
);

/* ═══════════════════════════════════════════════
   PostComments — main component
   ═══════════════════════════════════════════════ */

const PostComments: React.FC<PostCommentsProps> = ({ postId, commentsCount, onCountChange, isDark }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentDTO | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  // Auto-load comments on mount
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const flat = await getComments(postId);
      setComments(buildCommentTree(flat));
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  // ── Submit ──────────────────────────────────

  const handleSubmit = async (text: string) => {
    const created = await createComment(postId, text, replyTo?.id);
    const withReplies = { ...created, replies: [] };

    setComments(prev => {
      if (replyTo) {
        return prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies ?? []), withReplies] }
            : c,
        );
      }
      return [...prev, withReplies];
    });

    setNewIds(prev => new Set(prev).add(created.id));
    setReplyTo(null);
    onCountChange?.(1);

    setTimeout(() => {
      setNewIds(prev => {
        const s = new Set(prev);
        s.delete(created.id);
        return s;
      });
    }, 3000);
  };

  // ── Delete ──────────────────────────────────

  const handleDelete = async (commentId: number) => {
    try {
      await deleteComment(postId, commentId);
      const removeFrom = (list: CommentDTO[]): CommentDTO[] =>
        list
          .filter(c => c.id !== commentId)
          .map(c => ({ ...c, replies: removeFrom(c.replies ?? []) }));
      setComments(prev => removeFrom(prev));
      onCountChange?.(-1);
    } catch {
      // silently ignore
    }
  };

  // ── Like ────────────────────────────────────

  const handleLike = async (commentId: number) => {
    if (!user) return;
    try {
      const res = await toggleCommentLike(postId, commentId);
      const update = (list: CommentDTO[]): CommentDTO[] =>
        list.map(c =>
          c.id === commentId
            ? { ...c, user_liked: res.liked, likes_count: res.likes_count }
            : { ...c, replies: update(c.replies ?? []) },
        );
      setComments(prev => update(prev));
    } catch {
      // ignore
    }
  };

  // ── Render ──────────────────────────────────

  const uid = user?.id ?? null;
  const total = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return (
    <Section $dark={isDark}>
      {/* Collapsible header */}
      {loaded && total > 0 && (
        <SectionHeader onClick={() => setCollapsed(prev => !prev)}>
          <span>
            <MessageCircle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
            {total} {total === 1 ? 'комментарий' : total < 5 ? 'комментария' : 'комментариев'}
          </span>
          <ChevronDown
            size={16}
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
          />
        </SectionHeader>
      )}

      {/* Compose (top) — только для авторизованных, без активного replyTo */}
      {!collapsed && user && !replyTo && (
        <ComposeBox
          replyTo={null}
          onSubmit={handleSubmit}
          onCancel={() => setReplyTo(null)}
          currentUser={{ id: user.id, username: user.username, avatar_url: user.avatar_url }}
        />
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Error with retry */}
      {!loading && error && (
        <ErrorBox>
          <AlertCircle size={16} />
          Не удалось загрузить комментарии
          <RetryBtn onClick={load}>
            <RefreshCw size={12} /> Повторить
          </RetryBtn>
        </ErrorBox>
      )}

      {/* Empty state */}
      {!loading && loaded && comments.length === 0 && (
        <EmptyBox>
          <MessageCircle size={30} strokeWidth={1.2} />
          <span>Будьте первым, кто оставит комментарий</span>
        </EmptyBox>
      )}

      {/* Comment list */}
      {!loading && !collapsed && (
        <List>
          {comments.map(comment => (
            <React.Fragment key={comment.id}>
              <CommentNode
                comment={comment}
                postId={postId}
                uid={uid}
                isNew={newIds.has(comment.id)}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onLike={handleLike}
              />

              {/* Форма ответа прямо под комментарием */}
              {replyTo?.id === comment.id && user && (
                <ComposeBox
                  replyTo={replyTo}
                  onSubmit={handleSubmit}
                  onCancel={() => setReplyTo(null)}
                  currentUser={{ id: user.id, username: user.username, avatar_url: user.avatar_url }}
                  isReply
                />
              )}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Not authenticated prompt */}
      {!user && loaded && !collapsed && (
        <div
          style={{
            padding: '14px 20px',
            fontSize: 13,
            color: isDark ? gDark.textSec : gLight.textSec,
            textAlign: 'center',
            borderTop: `1px solid ${isDark ? gDark.border : gLight.border}`,
            background: isDark ? gDark.bg : gLight.bg,
            borderRadius: '0 0 12px 12px',
          }}
        >
          💬 Войдите в аккаунт, чтобы оставить комментарий
        </div>
      )}
    </Section>
  );
};

export default PostComments;
