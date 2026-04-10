import apiClient from '../api/apiClient';

export type RatingTarget = 'marker' | 'route' | 'event' | 'post';

export interface RatingSummary {
  avg: number;
  count: number;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const numericRegex = /^\d+$/;

export async function getSummary(target: RatingTarget, id: string): Promise<RatingSummary> {
  // Skip server call for locally generated markers/ids (e.g. "marker-...", "fav-...")
  if (target === 'marker' && !uuidRegex.test(id)) {
    return { avg: 0, count: 0 };
  }
  // Numeric IDs (e.g. event IDs like 5) are not stored as UUID — skip API call
  if (numericRegex.test(id)) {
    return { avg: 0, count: 0 };
  }

  try {
    const { data } = await apiClient.get('/ratings/summary', { params: { type: target, id } });
    return data?.summary || { avg: 0, count: 0 };
  } catch {
    return { avg: 0, count: 0 };
  }
}

export async function getUserRating(target: RatingTarget, id: string): Promise<number | null> {
  // Numeric IDs (e.g. event IDs like 5) are not stored as UUID — skip API call
  if (numericRegex.test(id)) {
    return null;
  }
  try {
    const { data } = await apiClient.get('/ratings/user', { params: { type: target, id } });
    return (data?.value ?? null) as number | null;
  } catch {
    return null;
  }
}

export async function rate(target: RatingTarget, id: string, value: number): Promise<RatingSummary> {
  const { data } = await apiClient.post('/ratings', { target_type: target, target_id: id, value });
  return data?.summary || { avg: 0, count: 0 };
}


