import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Flame, Heart, MessageCircle, Share2, Bookmark, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { listPosts } from "../../services/postsService";

// Вспомогательная функция для форматирования времени
function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'только что';
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return date.toLocaleDateString('ru-RU');
}

interface TrendingPost {
  id: number;
  author: string;
  avatar: string | null;
  title: string;
  excerpt: string;
  image: string | null;
  likes: number;
  comments: number;
  timeAgo: string;
  trending: boolean;
}

export function TrendingPosts() {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await listPosts({ limit: 5, sort: 'created_at DESC' });
        const mapped: TrendingPost[] = (result.data || []).map((p: any) => ({
          id: p.id,
          author: p.author_name || 'Автор',
          avatar: p.author_avatar || null,
          title: p.title || 'Без заголовка',
          excerpt: (p.body || '').substring(0, 120) + (p.body?.length > 120 ? '...' : ''),
          image: p.photo_urls ? p.photo_urls.split(',')[0] : null,
          likes: p.likes_count || 0,
          comments: p.comments_count || 0,
          timeAgo: timeAgo(new Date(p.created_at)),
          trending: (p.likes_count || 0) >= 5
        }));
        setPosts(mapped);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden">
      <CardHeader className="pb-6 bg-gradient-to-r from-orange-500/10 to-pink-500/10">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-gray-900">Трендовые публикации</div>
            <div className="text-sm text-gray-500 font-normal">Самые обсуждаемые посты сообщества</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Загрузка...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Пока нет публикаций</div>
        ) : posts.map((post, index) => (
          <article 
            key={post.id}
            className="group cursor-pointer bg-white/50 hover:bg-white/80 rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-4 ring-white shadow-lg flex-shrink-0 bg-gray-200 flex items-center justify-center">
                {post.avatar ? (
                  <img 
                    src={post.avatar} 
                    alt={post.author}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-500">{post.author[0]}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-bold text-gray-900">{post.author}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">{post.timeAgo}</span>
                  {post.trending && (
                    <Badge className="text-xs bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0">
                      <Flame className="w-3 h-3 mr-1" />
                      Тренд
                    </Badge>
                  )}
                </div>
                
                <h3 className="font-bold text-lg mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {post.title}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-xs text-blue-500 border-2">
                    <MapPin className="w-3 h-3 mr-1" />
                    Пост
                  </Badge>
                </div>
                
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <button className="flex items-center gap-2 hover:text-red-500 transition-colors font-medium">
                    <Heart className="w-4 h-4" />
                    {post.likes}
                  </button>
                  <button className="flex items-center gap-2 hover:text-blue-500 transition-colors font-medium">
                    <MessageCircle className="w-4 h-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-2 hover:text-green-500 transition-colors font-medium">
                    <Share2 className="w-4 h-4" />
                    0
                  </button>
                  <button className="flex items-center gap-2 hover:text-yellow-500 transition-colors ml-auto font-medium">
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {post.image && (
                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              )}
            </div>
          </article>
        ))}
        
        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full">
            Показать все публикации
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}