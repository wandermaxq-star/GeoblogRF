import { useState, useCallback } from 'react';
import ModerationService, { ContentData, ModerationResult } from '../services/moderationService';

export const useModeration = () => {
  const [isModerating, setIsModerating] = useState(false);
  const [lastResult, setLastResult] = useState<ModerationResult | null>(null);

  const moderateContent = useCallback(async (content: {
    text: string;
    type: 'chat' | 'post' | 'comment' | 'review';
    userId: string;
    location?: string;
  }): Promise<ModerationResult> => {
    setIsModerating(true);
    
    try {
      const contentData: ContentData = {
        text: content.text,
        type: content.type,
        userId: content.userId,
        location: content.location,
        timestamp: new Date()
      };

      const result = await ModerationService.moderateContent(contentData);
      setLastResult(result);
      
      return result;
    } catch (error) {
      const fallbackResult: ModerationResult = {
        isAppropriate: true,
        confidence: 0.5,
        issues: ['Ошибка проверки'],
        suggestions: ['Требуется ручная проверка'],
        category: 'safe',
        action: 'review'
      };
      setLastResult(fallbackResult);
      return fallbackResult;
    } finally {
      setIsModerating(false);
    }
  }, []);

  const moderateBatch = useCallback(async (contents: ContentData[]): Promise<ModerationResult[]> => {
    setIsModerating(true);
    
    try {
      const results = await ModerationService.moderateBatch(contents);
      return results;
    } catch (error) {
      return [];
    } finally {
      setIsModerating(false);
    }
  }, []);

  const getModerationStats = useCallback(async () => {
    try {
      return await ModerationService.getModerationStats();
    } catch (error) {
      return {
        totalChecked: 0,
        approved: 0,
        hidden: 0,
        reviewed: 0,
        blocked: 0,
        spamDetected: 0,
        fakeReviews: 0
      };
    }
  }, []);

  return {
    moderateContent,
    moderateBatch,
    getModerationStats,
    isModerating,
    lastResult
  };
};

