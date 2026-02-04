import React, { useState } from 'react';
import DynamicBookTemplate from './DynamicBookTemplate';

const BookTemplateDemo: React.FC = () => {
  const [title, setTitle] = useState('Владимиро-Суздальская земля');
  const [author, setAuthor] = useState('Автор');
  const [coverColor, setCoverColor] = useState('#92400e');
  const [spineColor, setSpineColor] = useState('#f59e0b');
  const [textColor, setTextColor] = useState('#ffffff');

  const predefinedStyles = [
    { name: 'Классический', cover: '#92400e', spine: '#f59e0b', text: '#ffffff' },
    { name: 'Синий', cover: '#1e40af', spine: '#3b82f6', text: '#ffffff' },
    { name: 'Зеленый', cover: '#166534', spine: '#22c55e', text: '#ffffff' },
    { name: 'Красный', cover: '#991b1b', spine: '#ef4444', text: '#ffffff' },
    { name: 'Фиолетовый', cover: '#7c2d12', spine: '#a855f7', text: '#ffffff' },
    { name: 'Черный', cover: '#000000', spine: '#374151', text: '#ffffff' }
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Демонстрация динамического шаблона книги
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Предпросмотр книги */}
          <div className="flex flex-col items-center justify-center bg-white rounded-lg p-8 shadow-lg">
            <h2 className="text-xl font-semibold mb-6">Предпросмотр</h2>
            <DynamicBookTemplate
              title={title}
              author={author}
              coverColor={coverColor}
              spineColor={spineColor}
              textColor={textColor}
              width={300}
              height={360}
              isInteractive={false}
            />
          </div>

          {/* Настройки */}
          <div className="bg-white rounded-lg p-8 shadow-lg">
            <h2 className="text-xl font-semibold mb-6">Настройки</h2>
            
            <div className="space-y-6">
              {/* Название и автор */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название книги
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Автор
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Быстрые стили */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Быстрые стили
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {predefinedStyles.map((style, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCoverColor(style.cover);
                        setSpineColor(style.spine);
                        setTextColor(style.text);
                      }}
                      className="p-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Настройки цветов */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цвет обложки
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={coverColor}
                      onChange={(e) => setCoverColor(e.target.value)}
                      className="w-12 h-12 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={coverColor}
                      onChange={(e) => setCoverColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цвет корешка
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={spineColor}
                      onChange={(e) => setSpineColor(e.target.value)}
                      className="w-12 h-12 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={spineColor}
                      onChange={(e) => setSpineColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цвет текста
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-12 h-12 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Примеры разных размеров */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-center mb-8">Примеры разных размеров</h2>
          <div className="flex justify-center items-end gap-8">
            <div className="text-center">
              <DynamicBookTemplate
                title="Маленькая"
                author="Автор"
                coverColor="#1e40af"
                spineColor="#3b82f6"
                textColor="#ffffff"
                width={100}
                height={120}
                isInteractive={false}
              />
              <p className="mt-2 text-sm text-gray-600">100x120px</p>
            </div>
            
            <div className="text-center">
              <DynamicBookTemplate
                title="Средняя"
                author="Автор"
                coverColor="#166534"
                spineColor="#22c55e"
                textColor="#ffffff"
                width={200}
                height={240}
                isInteractive={false}
              />
              <p className="mt-2 text-sm text-gray-600">200x240px</p>
            </div>
            
            <div className="text-center">
              <DynamicBookTemplate
                title="Большая"
                author="Автор"
                coverColor="#991b1b"
                spineColor="#ef4444"
                textColor="#ffffff"
                width={300}
                height={360}
                isInteractive={false}
              />
              <p className="mt-2 text-sm text-gray-600">300x360px</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookTemplateDemo;