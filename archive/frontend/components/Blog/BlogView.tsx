import React from 'react';
import { Blog, BLOG_CATEGORIES, BlogParagraph } from '../../types/blog';
import MiniMapMarker from '../Posts/MiniMapMarker';
import MiniMapRoute from '../Posts/MiniMapRoute';
import MiniEventCard from '../Posts/MiniEventCard';

interface BlogViewProps {
  blog: Blog;
  onBack: () => void;
}

const BlogView: React.FC<BlogViewProps> = ({ blog, onBack }) => {

  const getCategoryLabel = (category: string) => {
    return BLOG_CATEGORIES[category as keyof typeof BLOG_CATEGORIES] || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // Получаем абзацы из constructor_data или создаем из content
  const getParagraphs = (): BlogParagraph[] => {
    if (blog.constructor_data?.paragraphs && Array.isArray(blog.constructor_data.paragraphs)) {
      return blog.constructor_data.paragraphs.sort((a: BlogParagraph, b: BlogParagraph) => 
        (a.order || 0) - (b.order || 0)
      );
    }
    // Если нет constructor_data, создаем простые абзацы из content
    return blog.content.split('\n').filter(p => p.trim()).map((text, index) => ({
      id: `para-${index}`,
      text: text.trim(),
      state: { type: null, data: null },
      photos: [],
      links: [],
      order: index
    }));
  };

  const paragraphs = getParagraphs();

  // Рендерим компонент крючка для абзаца (слева)
  const renderHook = (paragraph: BlogParagraph) => {
    const { type, data } = paragraph.state || { type: null, data: null };
    
    if (!type || !data) return null;

    switch (type) {
      case 'marker':
        const markerId = data.id || data.marker_id;
        if (!markerId) return null;
    return (
          <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
            <MiniMapMarker markerId={markerId} height="300px" />
          </div>
        );
      
      case 'route':
        const routeId = data.id || data.route_id;
        if (!routeId) return null;
        return (
          <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
            <MiniMapRoute routeId={routeId} height="300px" />
          </div>
        );
      
      case 'event':
        const eventId = data.id || data.event_id;
        if (!eventId) return null;
        return (
          <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
            <MiniEventCard eventId={eventId} height="300px" />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-6 border-b border-gray-200">
        <button 
          onClick={onBack} 
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          ← Назад к списку
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {/* Заголовок блога */}
            <header className="mb-8">
              <div className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm mb-4">
                {getCategoryLabel(blog.category || 'other')}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{blog.title}</h1>
              <div className="flex gap-6 text-gray-600 text-sm">
                <span>Автор: {blog.author || blog.author_name || 'Неизвестно'}</span>
                <span>{formatDate(blog.date || blog.created_at || '')}</span>
              </div>
            </header>

          {/* Абзацы с интерактивностью */}
          <div className="space-y-8">
            {paragraphs.map((paragraph, index) => (
              <div key={paragraph.id} className="flex gap-6 items-start">
                {/* Левая панель - крючок */}
                <div className="w-80 flex-shrink-0">
                  {renderHook(paragraph)}
                </div>

                {/* Правая панель - текст и фото */}
                <div className="flex-1 min-w-0">
                  <div className="prose max-w-none">
                    {paragraph.text && (
                      <div className="text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap">
                        {paragraph.text}
                      </div>
                    )}
                    
                    {/* Фото абзаца */}
                    {paragraph.photos && paragraph.photos.length > 0 && (
                      <div className="grid gap-4 mb-4" style={{
                        gridTemplateColumns: paragraph.photos.length === 1 ? '1fr' : 
                          paragraph.photos.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)'
                      }}>
                        {paragraph.photos.map((photo, photoIndex) => (
                    <img 
                            key={photoIndex}
                            src={typeof photo === 'string' ? photo : (photo as any)?.url || String(photo)}
                            alt={`Фото ${index + 1}-${photoIndex + 1}`}
                            className="w-full rounded-lg shadow-md object-cover"
                            style={{ height: paragraph.photos.length === 1 ? '400px' : '200px' }}
                    />
                  ))}
                </div>
              )}
                  </div>
                </div>
              </div>
            ))}
            </div>

          {/* Футер */}
          <footer className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex gap-4">
                <button className="bg-gray-100 border border-gray-300 px-4 py-2 rounded hover:bg-gray-200 transition-colors">
                  👍 Нравится
                </button>
                <button className="bg-gray-100 border border-gray-300 px-4 py-2 rounded hover:bg-gray-200 transition-colors">
                  📤 Поделиться
                </button>
              </div>
            </footer>
        </div>
      </div>
    </div>
  );
};

export default BlogView; 