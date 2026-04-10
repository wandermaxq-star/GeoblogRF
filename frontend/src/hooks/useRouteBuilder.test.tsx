// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRouteBuilder } from './useRouteBuilder';

describe('useRouteBuilder hook', () => {
  it('initializes empty and allows adding/removing points', () => {
    const { result } = renderHook(() => useRouteBuilder());

    expect(result.current.activePoints).toEqual([]);

    act(() => {
      result.current.pointManager.addSearchPoint('Test', [1, 2]);
    });
    expect(result.current.activePoints.length).toBe(1);
    expect(result.current.activePoints[0]!.title).toBe('Test');

    act(() => {
      result.current.pointManager.addFavoritePoint('fav1', 'Fav name', [3, 4]);
    });
    expect(result.current.activePoints.length).toBe(2);

    // duplicate favorite should be ignored
    act(() => {
      result.current.pointManager.addFavoritePoint('fav1', 'Fav name', [3, 4]);
    });
    expect(result.current.activePoints.length).toBe(2);

    const firstId = result.current.activePoints[0]!.id;
    act(() => {
      result.current.pointManager.removePoint(firstId);
    });
    expect(result.current.activePoints.length).toBe(1);

    act(() => {
      result.current.pointManager.clearRoute();
    });
    expect(result.current.activePoints).toEqual([]);
  });

  it('reorders points correctly', () => {
    const { result } = renderHook(() => useRouteBuilder());
    act(() => {
      result.current.pointManager.addSearchPoint('A', [0,0]);
      result.current.pointManager.addSearchPoint('B', [0,0]);
      result.current.pointManager.addSearchPoint('C', [0,0]);
    });
    const ids = result.current.activePoints.map((p: { id: string }) => p.id);
    // move second element up: swap ids[1] with ids[0]
    const newOrderUp = [ids[1], ids[0], ids[2]];
    act(() => {
      result.current.pointManager.reorderPoints(newOrderUp);
    });
    expect(result.current.activePoints[0]!.title).toBe('B');
    // move first down: after previous reorder, order is B, A, C; swap B and A
    const newOrderDown = [ids[0], ids[1], ids[2]]; // wait, need to recompute ids after reorder
    // Instead, get current IDs again
    const idsAfter = result.current.activePoints.map((p: { id: string }) => p.id);
    const newOrderDown2 = [idsAfter[1], idsAfter[0], idsAfter[2]];
    act(() => {
      result.current.pointManager.reorderPoints(newOrderDown2);
    });
    expect(result.current.activePoints[1]!.title).toBe('B');
  });
});