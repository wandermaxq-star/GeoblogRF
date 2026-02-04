import apiClient from '../api/apiClient';

export type RatingTarget = 'marker' | 'route' | 'event' | 'post';

export interface RatingSummary {
  avg: number;
  count: number;
}

export async function getSummary(target: RatingTarget, id: string): Promise<RatingSummary> {
  const { data } = await apiClient.get('/ratings/summary', { params: { type: target, id } });
  return data?.summary || { avg: 0, count: 0 };
}

export async function getUserRating(target: RatingTarget, id: string): Promise<number | null> {
  const { data } = await apiClient.get('/ratings/user', { params: { type: target, id } });
  return (data?.value ?? null) as number | null;
}

export async function rate(target: RatingTarget, id: string, value: number): Promise<RatingSummary> {
  const { data } = await apiClient.post('/ratings', { target_type: target, target_id: id, value });
  return data?.summary || { avg: 0, count: 0 };
}


