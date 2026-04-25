import { useQuery } from '@tanstack/react-query';
import { getGamificationProfile } from '../lib/ai-service';

export const useGamificationProfile = (studentId: string | undefined) => {
  return useQuery({
    queryKey: ['gamification', 'profile', studentId],
    queryFn: () => getGamificationProfile(studentId!),
    enabled: !!studentId,
  });
};
