from typing import List, Literal

from pydantic import BaseModel, Field


class SkillObservation(BaseModel):
    correct: bool
    difficulty: float = Field(ge=0.0, le=1.0)


class PredictSkillRequest(BaseModel):
    student_id: str
    skill_id: str
    history: List[SkillObservation] = Field(default_factory=list)


class PredictSkillResponse(BaseModel):
    student_id: str
    skill_id: str
    estimated_skill: float = Field(ge=0.0, le=1.0)


class RecommendNextRequest(BaseModel):
    student_id: str
    skill_id: str
    current_skill_estimate: float = Field(ge=0.0, le=1.0)


class Recommendation(BaseModel):
    exercise_id: str
    difficulty: float
    rationale: str


class RecommendNextResponse(BaseModel):
    student_id: str
    skill_id: str
    recommendations: List[Recommendation]


class ScoreResponseRequest(BaseModel):
    student_id: str
    exercise_id: str
    raw_score: float = Field(ge=0.0, le=1.0)
    response_time_seconds: float = Field(gt=0)


class ScoreResponseResult(BaseModel):
    normalized_score: float = Field(ge=0.0, le=1.0)
    feedback: str
    mastery_delta: float


class ScoreResponseResponse(BaseModel):
    student_id: str
    exercise_id: str
    result: ScoreResponseResult


class SimulateStep(BaseModel):
    step_index: int
    difficulty: float
    success_probability: float
    expected_skill: float


class SimulateLearningPathRequest(BaseModel):
    initial_skill: float = Field(ge=0.0, le=1.0)
    steps: int = Field(ge=1, le=50)
    target_skill: float = Field(ge=0.0, le=1.0)


class SimulateLearningPathResponse(BaseModel):
    steps: List[SimulateStep]
    reached_target: bool

class Badge(BaseModel):
    code: str
    name: str
    awarded_at: str

class GamificationProfile(BaseModel):
    student_id: str
    xp: int
    level: int
    badges: List[Badge] = Field(default_factory=list)

class ProcessEventRequest(BaseModel):
    student_id: str
    event_type: Literal["exercise_completion", "lesson_completion", "login"]
    payload: dict

class ProcessEventResponse(BaseModel):
    student_id: str
    xp_gained: int
    new_total_xp: int
    level_up: bool
    new_level: int
    badges_earned: List[str]


