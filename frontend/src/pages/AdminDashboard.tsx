import React, { useState } from 'react';
import { MirrorGradientContainer } from '../components/MirrorGradientProvider';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboardComponent from '../components/Admin/AdminDashboard';

export default function AdminDashboardPage() {
  const { user } = useAuth() || { user: null } as any;
  const isAllowed = !!user && user.role === 'admin';

  if (!isAllowed) {
    return (
      <MirrorGradientContainer className="page-layout-container page-container">
        <div className="page-main-area">
          <div className="page-content-wrapper">
            <div className="page-main-panel relative">
              <div className="p-6 max-w-xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Нет доступа</h1>
                <p className="text-gray-600">Войдите под учётной записью администратора</p>
              </div>
            </div>
          </div>
        </div>
      </MirrorGradientContainer>
    );
  }

  return (
    <MirrorGradientContainer className="page-layout-container page-container admin-mode">
      <div className="page-main-area">
        <div className="page-content-wrapper">
          <div className="page-main-panel relative">
            <div className="p-6 max-w-7xl mx-auto">
              <AdminDashboardComponent />
            </div>
          </div>
        </div>
      </div>
    </MirrorGradientContainer>
  );
}
