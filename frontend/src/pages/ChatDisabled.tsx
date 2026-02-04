import React from 'react';
import { useNavigate } from 'react-router-dom';

const ChatDisabled: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Чат отключён в этой сборке</h1>
      <p className="text-gray-600 mb-6">Функция чата недоступна в текущей локализации. Возможно, она появится в версии для другой страны.</p>
      <div className="flex justify-center gap-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => navigate('/')}
        >
          На главную
        </button>
        <button
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
          onClick={() => navigate('/posts')}
        >
          Посмотреть посты
        </button>
      </div>
    </div>
  );
};

export default ChatDisabled;
