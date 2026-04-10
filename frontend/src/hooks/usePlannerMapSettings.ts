import { useEffect, useState } from 'react';
import { projectManager } from '../services/projectManager';
import { applyMapSettings } from '../utils/plannerMapUtils';
import type { PlannerMapSettings } from '../types/planner';

export const usePlannerMapSettings = (isMapReady: boolean) => {
  const [settings, setSettings] = useState<PlannerMapSettings>({
    showTraffic: false,
  });

  useEffect(() => {
    if (!isMapReady) return;
    try {
      const mapApi = projectManager.getMapApi?.();
      applyMapSettings(settings, mapApi);
    } catch (error) {
      console.warn('[usePlannerMapSettings] applyMapSettings failed:', error);
    }
  }, [isMapReady, settings]);

  return {
    settings,
    setSettings,
  };
};
