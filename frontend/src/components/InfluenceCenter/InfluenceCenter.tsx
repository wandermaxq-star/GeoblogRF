import React from 'react';
import { CommunityHeader } from './CommunityHeader';
import { StatsCards } from './StatsCards';
import { TrendingPosts } from './TrendingPosts';
import { TopContributors } from './TopContributors';
import { CommunityFeed } from './CommunityFeed';
import { ProgressRating } from './ProgressRating';
import { TrendsSection } from './TrendsSection';
import { Button } from '../ui/button';
import { Search, Bell, Plus, Menu } from 'lucide-react';

interface InfluenceCenterProps {
  className?: string;
}

const InfluenceCenter: React.FC<InfluenceCenterProps> = ({ className = '' }) => {
  return (
    <div className={`w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 ${className}`}>
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        
        <main className="relative z-10">
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-sm">
            <div className="flex items-center justify-between px-4 md:px-8 h-16">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">ЦВ</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Центр Влияния
                    </h1>
                    <p className="text-xs text-muted-foreground">Сообщество исследователей</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="hidden sm:flex hover:bg-blue-50">
                  <Search className="w-5 h-5" />
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2 hidden sm:flex bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Создать контент
                </Button>
                <Button variant="ghost" size="icon" className="relative hover:bg-red-50">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </Button>
              </div>
            </div>
          </header>
          
          <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
            <CommunityHeader />
            <StatsCards />
            
            {/* Новые секции с геймификацией и трендами */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
              <div className="xl:col-span-2 space-y-8">
                <TrendsSection />
                <TrendingPosts />
              </div>
              <div className="space-y-8">
                <ProgressRating />
                <TopContributors />
                <CommunityFeed />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InfluenceCenter;