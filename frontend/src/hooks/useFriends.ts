import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { friendsApi } from '../api/friendsApi';
import { Friend } from '../types/friends';

export const useFriends = () => {
  const auth = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = async () => {
      if (!auth?.user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const friendsData = await friendsApi.getFriends(auth.user.id);
        setFriends(friendsData);
      } catch (err) {
        setError('Ошибка загрузки друзей');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadFriends();
  }, [auth?.user?.id]);

  const refetch = () => {
    if (auth?.user?.id) {
      loadFriends();
    }
  };

  return {
    friends,
    loading,
    error,
    refetch
  };
};
