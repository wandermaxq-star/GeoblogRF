import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface MirrorGradientContextType {
  panelCount: number;
  setPanelCount: React.Dispatch<React.SetStateAction<number>>;
  getGradientClass: () => string;
}

const MirrorGradientContext = createContext<MirrorGradientContextType | undefined>(undefined);

interface MirrorGradientProviderProps {
  children: ReactNode;
}

export const MirrorGradientProvider: React.FC<MirrorGradientProviderProps> = ({ children }) => {
  const [panelCount, setPanelCount] = useState(1);

  const getGradientClass = useCallback(() => {
    switch (panelCount) {
      case 1:
        return 'mirror-bg';
      case 2:
        return 'mirror-bg-2panels';
      case 3:
        return 'mirror-bg-3panels';
      case 4:
        return 'mirror-bg-4panels';
      default:
        return 'mirror-bg';
    }
  }, [panelCount]);

  const contextValue = useMemo(() => ({
    panelCount,
    setPanelCount,
    getGradientClass
  }), [panelCount, getGradientClass]);

  return (
    <MirrorGradientContext.Provider value={contextValue}>
      {children}
    </MirrorGradientContext.Provider>
  );
};

export const useMirrorGradient = () => {
  const context = useContext(MirrorGradientContext);
  if (!context) {
    // Возвращаем заглушку вместо undefined для предотвращения блокировки рендеринга
    return {
      panelCount: 1,
      setPanelCount: () => {},
      getGradientClass: () => 'mirror-bg',
    };
  }
  return context;
};

// Компонент для автоматического применения градиента к контейнеру
interface MirrorGradientContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const MirrorGradientContainer: React.FC<MirrorGradientContainerProps> = ({ 
  children, 
  className = '',
  style 
}) => {
  const context = useMirrorGradient();
  
  if (!context) {
    // Если контекст не загружен, показываем обычный контейнер
    return (
      <div className={`page-container ${className}`} style={style}>
        {children}
      </div>
    );
  }
  
  const { getGradientClass } = context;
  
  return (
    <div className={`page-container ${getGradientClass()} ${className}`} style={style}>
      {children}
    </div>
  );
};

// Хук для регистрации панели
export const usePanelRegistration = () => {
  const context = useMirrorGradient();
  
  if (!context) {
    // Возвращаем заглушку, если контекст не загружен
    return {
      registerPanel: () => {},
      unregisterPanel: () => {}
    };
  }
  
  const { setPanelCount } = context;
  
  const registerPanel = useCallback(() => {
    setPanelCount((prev: number) => prev + 1);
  }, [setPanelCount]);
  
  const unregisterPanel = useCallback(() => {
    setPanelCount((prev: number) => Math.max(1, prev - 1));
  }, [setPanelCount]);
  
  return { registerPanel, unregisterPanel };
}; 