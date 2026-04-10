import React, { useState, useEffect } from 'react';
import ExecutiveOverview from '../components/ExecutiveOverview';
import ProductTeamDashboard from '../components/ProductTeamDashboard';
import TechnicalDashboard from '../components/TechnicalDashboard';

type DashboardView = 'executive' | 'product' | 'technical';

interface AnalyticsDashboardProps {
  initialView?: DashboardView;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  initialView = 'executive' 
}) => {
  const [activeView, setActiveView] = useState<DashboardView>(initialView);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  const views = [
    { id: 'executive' as DashboardView, label: 'Обзор для руководства', icon: '🎯' },
    { id: 'product' as DashboardView, label: 'Команда продукта', icon: '🎮' },
    { id: 'technical' as DashboardView, label: 'Технический', icon: '⚡' }
  ];

  return (
    <div className="w-full">
      {/* Навигация по дашбордам */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-1">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeView === view.id
                  ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{view.icon}</span>
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Контент дашборда */}
      <div className="mt-6">
        {activeView === 'executive' && <ExecutiveOverview />}
        {activeView === 'product' && <ProductTeamDashboard />}
        {activeView === 'technical' && <TechnicalDashboard />}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

