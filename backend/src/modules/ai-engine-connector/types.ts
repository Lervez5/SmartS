export interface AiPredictionPayload {
  student_id: string;
  skill_id: string;
  history: any[];
}

export interface AiRecommendationPayload {
  student_id: string;
  recent_activities: any[];
}
