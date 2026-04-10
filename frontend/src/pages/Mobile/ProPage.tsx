import React from 'react';
import TopBar from '@/components/Mobile/TopBar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ProPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full m-glass-page">
      <TopBar title="Pro" />
      <main className="flex-1 overflow-y-auto p-4">
        <h2 className="text-xl font-bold mb-4">Преимущества премиум‑аккаунта</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Доступ к эксклюзивным оффлайн‑пакетам</li>
          <li>Приоритетная поддержка</li>
          <li>Увеличение лимитов на посты и метки</li>
          <li>Отсутствие рекламы и промо‑объявлений</li>
          <li>Специальные баффы геймификации</li>
        </ul>
        <div className="mt-6">
          <Button onClick={() => navigate('/pro/subscribe')} className="w-full">
            Перейти на Pro
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProPage;