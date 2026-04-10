// frontend/src/services/routePackService.ts
// Сервис для Route Pack Builder и Hub
import type {
  RoutePackBuilderData,
  RoutePackSubmission,
  HubFilters,
} from '../types/routePackSubmission';
import storageService from './storageService';

function authHeaders(): Record<string, string> {
  const token = storageService.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─────────────────────────────────────────────────────────────
// AUTHOR — отправка и управление своими паками
// ─────────────────────────────────────────────────────────────

/** Отправить пак на модерацию */
export async function submitPack(data: RoutePackBuilderData): Promise<{ id: string; status: string }> {
  const res = await fetch('/api/route-pack-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Ошибка отправки пака');
  }
  return res.json();
}

/** Мои паки (все статусы) */
export async function getMyPacks(): Promise<RoutePackSubmission[]> {
  const res = await fetch('/api/route-pack-submissions/my', { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки паков');
  return res.json();
}

/** Редактировать пак (только pending/revision) */
export async function updatePack(
  id: string,
  data: Partial<RoutePackBuilderData>
): Promise<{ id: string; status: string }> {
  const res = await fetch(`/api/route-pack-submissions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Ошибка редактирования');
  }
  return res.json();
}

/** Удалить неопубликованный пак */
export async function deletePack(id: string): Promise<void> {
  const res = await fetch(`/api/route-pack-submissions/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Ошибка удаления');
  }
}

/** Стать автором паков */
export async function becomeAuthor(): Promise<void> {
  const res = await fetch('/api/users/become-author', { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка активации статуса автора');
}

// ─────────────────────────────────────────────────────────────
// HUB — публичный каталог
// ─────────────────────────────────────────────────────────────

/** Список одобренных паков с фильтрами */
export async function getHubPacks(filters: HubFilters = {}): Promise<RoutePackSubmission[]> {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.free) params.set('free', filters.free);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.q) params.set('q', filters.q);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const res = await fetch(`/api/hub/packs?${params}`);
  if (!res.ok) throw new Error('Ошибка загрузки Hub');
  return res.json();
}

/** Детали одного пака */
export async function getHubPack(id: string): Promise<RoutePackSubmission> {
  const res = await fetch(`/api/hub/packs/${id}`);
  if (!res.ok) throw new Error('Пак не найден');
  return res.json();
}

/** Поставить лайк/дизлайк */
export async function ratePack(
  id: string,
  vote: 1 | -1,
  review?: string
): Promise<{ rating_avg: number; rating_count: number }> {
  const res = await fetch(`/api/hub/packs/${id}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ vote, review }),
  });
  if (!res.ok) throw new Error('Ошибка голосования');
  return res.json();
}

/** Купить пак */
export async function purchaseHubPack(id: string): Promise<void> {
  const res = await fetch(`/api/hub/packs/${id}/purchase`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Ошибка покупки');
  }
}

/** Мой голос за пак */
export async function getMyVote(id: string): Promise<1 | -1 | null> {
  const res = await fetch(`/api/hub/packs/${id}/my-vote`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.vote;
}

/** Получить ссылку на скачивание тайлов */
export async function getDownloadUrl(id: string): Promise<string> {
  const res = await fetch(`/api/hub/packs/${id}/download-url`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Ошибка получения ссылки');
  }
  const data = await res.json();
  return data.url;
}

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

/** Очередь модерации */
export async function getAdminSubmissions(
  status: 'pending' | 'approved' | 'rejected' | 'revision' = 'pending'
): Promise<RoutePackSubmission[]> {
  const res = await fetch(`/api/admin/pack-submissions?status=${status}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки очереди');
  return res.json();
}

/** Кол-во pending заявок (для бейджа) */
export async function getPendingCount(): Promise<number> {
  const res = await fetch('/api/admin/pack-submissions?status=pending&count=true', { headers: authHeaders() });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count || 0;
}

/** Одобрить пак */
export async function approvePack(id: string): Promise<void> {
  const res = await fetch(`/api/admin/pack-submissions/${id}/approve`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка одобрения');
}

/** Отклонить пак */
export async function rejectPack(id: string, comment: string): Promise<void> {
  const res = await fetch(`/api/admin/pack-submissions/${id}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error('Ошибка отклонения');
}

/** Вернуть на доработку */
export async function sendToRevision(id: string, comment: string): Promise<void> {
  const res = await fetch(`/api/admin/pack-submissions/${id}/revision`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error('Ошибка отправки на доработку');
}
