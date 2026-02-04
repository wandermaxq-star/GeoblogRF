import React, { useState } from 'react';

interface AddToFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (category: string) => void;
  itemType?: 'marker' | 'event' | 'route' | 'photo';
  itemTitle?: string;
}

const AddToFavoritesModal: React.FC<AddToFavoritesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemType = 'marker',
  itemTitle
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const categories = [
    { id: 'post', name: 'Посты' },
    { id: 'event', name: 'События' },
    { id: 'personal', name: 'Избранное' }
  ];

  const handleConfirm = () => {
    if (selectedCategory) {
      onConfirm(selectedCategory);
      setSelectedCategory('');
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedCategory('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-xs w-full mx-4">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 text-center">
            Добавить в избранное
          </h3>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full px-3 py-2 rounded border transition-all text-center ${
                  selectedCategory === category.id
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-xs">{category.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end space-x-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCategory}
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 border border-transparent rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Да
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToFavoritesModal;
