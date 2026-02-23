// frontend/src/services/commentsService.ts
import apiClient from '../api/apiClient';

export interface CommentDTO {
  id: number;
  post_id: number;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  content: string;
  parent_id: number | null;
  status: 'pending' | 'active' | 'rejected' | 'revision';
  likes_count: number;
  user_liked: boolean;
  created_at: string;
  updated_at: string;
  // Вычисляется на фронте: дочерние ответы
  replies?: CommentDTO[];
}

// Получить комментарии к посту (публичные + собственные pending)
export async function getComments(postId: string): Promise<CommentDTO[]> {
  const { data } = await apiClient.get<CommentDTO[]>(`/posts/${postId}/comments`);
  return data;
}

// Создать новый комментарий / ответ
export async function createComment(
  postId: string,
  content: string,
  parentId?: number
): Promise<CommentDTO> {
  const { data } = await apiClient.post<CommentDTO>(`/posts/${postId}/comments`, {
    content,
    parent_id: parentId ?? null,
  });
  return data;
}

// Удалить комментарий
export async function deleteComment(postId: string, commentId: number): Promise<void> {
  await apiClient.delete(`/posts/${postId}/comments/${commentId}`);
}

// Лайк / снятие лайка
export async function toggleCommentLike(
  postId: string,
  commentId: number
): Promise<{ liked: boolean; likes_count: number }> {
  const { data } = await apiClient.post(
    `/posts/${postId}/comments/${commentId}/like`
  );
  return data;
}

// Утилита: строит дерево комментариев из плоского списка
export function buildCommentTree(flat: CommentDTO[]): CommentDTO[] {
  const map = new Map<number, CommentDTO & { replies: CommentDTO[] }>();
  const roots: CommentDTO[] = [];

  flat.forEach(c => map.set(c.id, { ...c, replies: [] }));
  flat.forEach(c => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });

  return roots;
}
