export const getYandexMapFromPlannerContainer = (): any => {
  const container = document.getElementById('planner-map-container') as any;
  return container?.__yandexMap ?? null;
};

export const getYandexControl = (map: any, names: string[] = ['typeSelector', 'layerControl']): any => {
  if (!map || !map.controls) return null;

  try {
    for (const name of names) {
      if (typeof map.controls.get === 'function') {
        const control = map.controls.get(name);
        if (control) return control;
      }
    }
  } catch {
    // ignore
  }

  if (typeof map.controls.each === 'function') {
    let found: any = null;
    try {
      map.controls.each((control: any) => {
        if (found) return;
        const ctorName = control?.constructor?.name?.toLowerCase?.();
        if (!ctorName) return;
        for (const name of names) {
          if (ctorName.includes(name.toLowerCase())) {
            found = control;
            return;
          }
        }
      });
    } catch {
      // ignore
    }
    if (found) return found;
  }

  return null;
};

export const toggleYandexControlExpanded = (control: any): boolean => {
  if (!control) return false;

  try {
    if (control.state && typeof control.state.get === 'function' && typeof control.state.set === 'function') {
      const keys = ['expanded', 'open'];
      for (const key of keys) {
        try {
          const current = !!control.state.get(key);
          control.state.set(key, !current);
          return !current;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    if (control.options && typeof control.options.get === 'function' && typeof control.options.set === 'function') {
      const visible = !!control.options.get('visible');
      control.options.set('visible', !visible);
      return !visible;
    }
  } catch {
    // ignore
  }

  return false;
};
