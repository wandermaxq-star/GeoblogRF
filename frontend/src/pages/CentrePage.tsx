import { useAuth } from '../contexts/AuthContext';
import { MirrorGradientContainer, usePanelRegistration } from '../components/MirrorGradientProvider';
import { useEffect } from 'react';
import { InfluenceCenter } from '../components/InfluenceCenter';

export default function CentrePage() {
  const { user } = useAuth();
  const { registerPanel, unregisterPanel } = usePanelRegistration();

  useEffect(() => {
    registerPanel(); // Основная панель центра влияния
    return () => {
      unregisterPanel(); // Основная панель
    };
  }, [registerPanel, unregisterPanel]);

  if (!user) return (
    <MirrorGradientContainer>
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="deep-container p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Загрузка...</p>
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );

  return (
    <MirrorGradientContainer className="page-layout-container" style={{ overflow: 'auto' }}>
      <div className="page-main-area" style={{ overflow: 'visible', height: 'auto', minHeight: '100%', alignItems: 'stretch' }}>
        <div className="page-content-wrapper" style={{ overflow: 'visible', height: 'auto', minHeight: 'auto' }}>
          <InfluenceCenter />
        </div>
      </div>
    </MirrorGradientContainer>
  );
}