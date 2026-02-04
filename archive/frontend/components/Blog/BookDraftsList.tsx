import React, { useState, useEffect } from 'react';
import { BookOpen, Trash2, Edit, Eye } from 'lucide-react';

interface BookDraft {
  id: string;
  title: string;
  category: string;
  blogs: string[];
  cover: {
    image: string;
    color: string;
    font: string;
  };
  segments: any[];
  created_at: string;
}

interface BookDraftsListProps {
  onEditDraft: (draft: BookDraft) => void;
  onDeleteDraft: (draftId: string) => void;
  onPublishDraft: (draft: BookDraft) => void;
}

const BookDraftsList: React.FC<BookDraftsListProps> = ({
  onEditDraft,
  onDeleteDraft,
  onPublishDraft
}) => {
  const [drafts, setDrafts] = useState<BookDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = () => {
    try {
      const draftsData = localStorage.getItem('book_drafts');
      if (draftsData) {
        const parsedDrafts = JSON.parse(draftsData);
        setDrafts(Array.isArray(parsedDrafts) ? parsedDrafts : []);
      } else {
        setDrafts([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки черновиков:', error);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm('Удалить этот черновик?')) {
      const updatedDrafts = drafts.filter(draft => draft.id !== draftId);
      localStorage.setItem('book_drafts', JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      onDeleteDraft(draftId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Нет черновиков книг</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Черновики книг ({drafts.length})
      </h3>
      
      {drafts.map((draft) => (
        <div key={draft.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h4 className="font-medium text-gray-900">{draft.title}</h4>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {draft.category}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <p>Блогов: {draft.blogs.length}</p>
                <p>Создан: {formatDate(draft.created_at)}</p>
              </div>
              
              {draft.cover.image && (
                <div className="mb-2">
                  <img
                    src={draft.cover.image}
                    alt="Обложка"
                    className="w-16 h-12 object-cover rounded border"
                  />
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 ml-4">
              <button
                onClick={() => onEditDraft(draft)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Редактировать"
              >
                <Edit className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onPublishDraft(draft)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Опубликовать"
              >
                <Eye className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleDeleteDraft(draft.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookDraftsList;
