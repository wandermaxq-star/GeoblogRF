import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Zap, Heart, MessageCircle, Share2, MapPin, Navigation, BookOpen, Calendar, Trophy } from "lucide-react";
import user1 from "../../assets/assets/avatars/user-1.jpg";
import user2 from "../../assets/assets/avatars/user-2.jpg";
import user4 from "../../assets/assets/avatars/user-4.jpg";
import user5 from "../../assets/assets/avatars/user-5.jpg";

const activities = [
  {
    user: "Анна Петрова",
    avatar: user1,
    action: "добавила новое место",
    target: "Озеро Байкал",
    type: "marker",
    icon: MapPin,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    time: "5 минут назад",
    likes: 23,
    comments: 7
  },
  {
    user: "Михаил Соколов",
    avatar: user2,
    action: "создал маршрут",
    target: "Золотое кольцо России",
    type: "route",
    icon: Navigation,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    time: "12 минут назад",
    likes: 45,
    comments: 12
  },
  {
    user: "Елена Козлова",
    avatar: user4,
    action: "опубликовала пост",
    target: "Путешествие по Кавказу",
    type: "post",
    icon: BookOpen,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    time: "1 час назад",
    likes: 67,
    comments: 19
  },
  
  {
    user: "Дмитрий Волков",
    avatar: user5,
    action: "организовал событие",
    target: "Фестиваль северного сияния",
    type: "event",
    icon: Calendar,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    time: "2 часа назад",
    likes: 89,
    comments: 34
  },
  {
    user: "Ольга Морозова",
    avatar: user1,
    action: "получила достижение",
    target: "Первопроходец",
    type: "achievement",
    icon: Trophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    time: "3 часа назад",
    likes: 156,
    comments: 28
  }
];

const getActionText = (activity: any) => {
  const actionTexts = {
    marker: "добавила новое место",
    route: "создал маршрут", 
    post: "опубликовала пост",
    event: "организовал событие",
    achievement: "получила достижение"
  };
  return actionTexts[activity.type as keyof typeof actionTexts] || activity.action;
};

export function CommunityFeed() {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-gray-900">Лента активности</div>
            <div className="text-sm text-gray-500 font-normal">Последние действия участников</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {activities.map((activity, index) => (
          <div 
            key={`${activity.user}-${index}`}
            className="flex gap-4 p-4 rounded-2xl bg-white/50 hover:bg-white/80 border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden ring-4 ring-white shadow-lg flex-shrink-0">
              <img 
                src={activity.avatar} 
                alt={activity.user}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-2">
                <span className="font-bold text-gray-900">{activity.user}</span>
                <span className="text-sm text-gray-600">
                  {getActionText(activity)}
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${
                    activity.type === "marker" ? "bg-blue-50 text-blue-600 border-blue-200" :
                    activity.type === "route" ? "bg-green-50 text-green-600 border-green-200" :
                    activity.type === "post" ? "bg-orange-50 text-orange-600 border-orange-200" :
                    activity.type === "event" ? "bg-purple-50 text-purple-600 border-purple-200" :
                    activity.type === "achievement" ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                    "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  <activity.icon className="w-3 h-3 mr-1" />
                  {activity.target}
                </Badge>
              </div>
              
              <div className="text-xs text-gray-500 mb-3 font-medium">
                {activity.time}
              </div>
              
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors font-medium">
                  <Heart className="w-4 h-4" />
                  {activity.likes}
                </button>
                <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-500 transition-colors font-medium">
                  <MessageCircle className="w-4 h-4" />
                  {activity.comments}
                </button>
                <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-500 transition-colors font-medium">
                  <Share2 className="w-4 h-4" />
                  Поделиться
                </button>
              </div>
            </div>
          </div>
        ))}
        
        <div className="pt-3 border-t">
          <button className="w-full text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            Показать всю активность →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}