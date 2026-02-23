import React, { useState } from 'react';
import { FaMobile, FaDesktop, FaBook, FaBullseye, FaEye, FaTimes, FaMapMarkerAlt, FaRoute, FaMap } from 'react-icons/fa';
import { Lightbulb, Check, CheckCircle, Target } from 'lucide-react';

export type GuideFormat = 'mobile' | 'desktop' | 'article' | 'focus';

interface GuideFormatOption {
  id: GuideFormat;
  title: string;
  description: string;
  hint: string;
  icon: React.ReactNode;
  features: string[];
}

const formatOptions: GuideFormatOption[] = [
  {
    id: 'mobile',
    title: 'Мобильный гид',
    description: 'Для использования в поездке',
    hint: '"Просматривайте в дороге"',
    icon: <FaMobile size={24} />,
    features: [
      'Компактный вид',
      'Крупные кнопки навигации',
      'Приоритет картам и навигации',
      'Минимум текста, максимум практики'
    ]
  },
  {
    id: 'desktop',
    title: 'Десктопный обзор',
    description: 'Для планирования дома',
    hint: '"Изучайте дома перед поездкой"',
    icon: <FaDesktop size={24} />,
    features: [
      'Подробные описания',
      'Большие фото галереи',
      'Таблицы, списки, сравнения',
      'Расширенная статистика'
    ]
  },
  {
    id: 'article',
    title: 'Статья-исследование',
    description: 'Глубокий формат',
    hint: '"Для ценителей деталей"',
    icon: <FaBook size={24} />,
    features: [
      'Академический стиль',
      'Исторические справки',
      'Анализ и выводы',
      'Богатый медиа-контент'
    ]
  },
  {
    id: 'focus',
    title: 'Фокус-гайд',
    description: 'Экспресс формат',
    hint: '"Самое главное за 5 минут"',
    icon: <FaBullseye size={24} />,
    features: [
      'Только ключевые точки',
      'Четкая структура "проблема-решение"',
      'Акцент на выводах и советах',
      'Краткость и ясность'
    ]
  }
];

interface GuideFormatSelectorProps {
  selectedFormat: GuideFormat;
  onFormatChange: (format: GuideFormat) => void;
  onPreview?: (format: GuideFormat) => void;
}

const GuideFormatSelector: React.FC<GuideFormatSelectorProps> = ({
  selectedFormat,
  onFormatChange,
  onPreview
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<GuideFormat>(selectedFormat);

  const handlePreview = (format: GuideFormat) => {
    setPreviewFormat(format);
    setShowPreview(true);
    if (onPreview) {
      onPreview(format);
    }
  };

  return (
    <>
      <div className="format-selector-container">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Выберите формат путеводителя</h3>
          <p className="text-sm text-gray-600">Каждый формат оптимизирован под свою цель использования</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {formatOptions.map((format) => (
            <div
              key={format.id}
              onClick={() => onFormatChange(format.id)}
              className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                selectedFormat === format.id
                  ? 'border-blue-600 bg-blue-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`mt-1 ${selectedFormat === format.id ? 'text-blue-600' : 'text-gray-400'}`}>
                  {format.icon}
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${selectedFormat === format.id ? 'text-blue-900' : 'text-gray-800'}`}>
                    {format.title}
                  </h4>
                  <p className="text-xs text-gray-600 mb-1">{format.description}</p>
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1"><Lightbulb size={11} />{format.hint}</p>
                </div>
                {selectedFormat === format.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                      <Check size={12} />
                    </div>
                  </div>
                )}
              </div>
              
              <ul className="text-xs text-gray-600 space-y-1 ml-8">
                {format.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <span className="text-blue-500">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(format.id);
                }}
                className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
              >
                <FaEye size={12} />
                Посмотреть пример
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => handlePreview(selectedFormat)}
          className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <FaEye size={14} />
          Посмотреть как будет выглядеть выбранный формат
        </button>
      </div>

      {/* Модальное окно предпросмотра */}
      {showPreview && (
        <FormatPreviewModal
          format={previewFormat}
          onClose={() => setShowPreview(false)}
          onFormatChange={(format) => {
            setPreviewFormat(format);
            onFormatChange(format);
          }}
        />
      )}

      <style>{`
        .format-selector-container {
          padding: 20px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
};

interface FormatPreviewModalProps {
  format: GuideFormat;
  onClose: () => void;
  onFormatChange: (format: GuideFormat) => void;
}

const FormatPreviewModal: React.FC<FormatPreviewModalProps> = ({
  format,
  onClose,
  onFormatChange
}) => {
  const selectedOption = formatOptions.find(f => f.id === format);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Предпросмотр формата</h2>
            <p className="text-sm text-gray-600 mt-1">{selectedOption?.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Переключатель форматов */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-2">
            {formatOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onFormatChange(opt.id);
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  format === opt.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Предпросмотр контента */}
        <div className="flex-1 overflow-y-auto p-6">
          {format === 'mobile' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl">
                <h3 className="text-2xl font-bold mb-2">Пример заголовка путеводителя</h3>
                <p className="text-blue-100">Краткое описание</p>
              </div>
              
              <div className="bg-gray-800 rounded-xl p-4" style={{ height: '300px' }}>
                <div className="text-white text-center py-8">
                  <div className="flex justify-center mb-3">
                    <FaMap size={48} className="text-blue-400" />
                  </div>
                  <p className="text-sm">Карта на весь экран</p>
                  <p className="text-xs text-gray-400 mt-2">Крупные кнопки навигации</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-100 p-4 rounded-lg flex items-start gap-3">
                  <div className="mt-1">
                    <FaMapMarkerAlt size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Место 1</h4>
                    <p className="text-sm text-gray-600">Краткое описание места</p>
                  </div>
                </div>
                <div className="bg-gray-100 p-4 rounded-lg flex items-start gap-3">
                  <div className="mt-1">
                    <FaMapMarkerAlt size={20} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Место 2</h4>
                    <p className="text-sm text-gray-600">Краткое описание места</p>
                  </div>
                </div>
                <div className="bg-blue-100 p-4 rounded-lg flex items-start gap-3 border-2 border-blue-300">
                  <div className="mt-1">
                    <FaRoute size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2 text-blue-900">Маршрут</h4>
                    <p className="text-sm text-blue-700">Описание маршрута с точками на карте</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {format === 'desktop' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-sm">Оглавление</h4>
                  <ul className="space-y-2 text-xs">
                    <li className="text-blue-600">1. Введение</li>
                    <li>2. Маршрут</li>
                    <li>3. Места</li>
                    <li>4. Советы</li>
                  </ul>
                </div>
                <div className="col-span-3 space-y-4">
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-4">Пример заголовка путеводителя</h3>
                    <p className="text-gray-700 leading-relaxed mb-4">
                      Подробное описание путешествия с детальными объяснениями, историческими справками 
                      и практическими советами для планирования поездки.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-200 rounded h-32"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {format === 'article' && (
            <div className="space-y-6">
              <div className="bg-white border-l-4 border-blue-600 p-6">
                <h3 className="text-2xl font-bold mb-4">Пример заголовка исследования</h3>
                <div className="text-sm text-gray-500 mb-4">
                  <span>Автор: Имя</span> • <span>Дата: 2024</span>
                </div>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Академический стиль с подробным анализом, историческими справками и выводами.
                  </p>
                  <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600">
                    "Цитата или важное замечание"
                  </blockquote>
                  <div className="bg-gray-50 p-4 rounded my-4">
                    <h4 className="font-semibold mb-2">Историческая справка</h4>
                    <p className="text-sm text-gray-600">
                      Дополнительная информация с ссылками и источниками.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {format === 'focus' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-xl">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Target size={24} /> Пример фокус-гайда</h3>
                <p className="text-orange-100">Только самое важное</p>
              </div>
              
              <div className="space-y-3">
                <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={24} className="text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold mb-1">Ключевой пункт 1</h4>
                      <p className="text-sm text-gray-600">Краткое решение</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={24} className="text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold mb-1">Ключевой пункт 2</h4>
                      <p className="text-sm text-gray-600">Краткое решение</p>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 border-2 border-orange-500 rounded-lg p-4">
                  <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-1.5"><Lightbulb size={16} /> Главный совет</h4>
                  <p className="text-sm text-orange-800">Важный вывод или рекомендация</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={() => {
              onFormatChange(format);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Выбрать этот формат
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuideFormatSelector;
