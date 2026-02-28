from fastapi import APIRouter

from ..models import RecommendNextRequest, RecommendNextResponse
from ..services.adaptive_difficulty import choose_difficulty
from ..services.recommendation_engine import build_recommendations

router = APIRouter()


@router.post("/", response_model=RecommendNextResponse)
async def recommend_next(payload: RecommendNextRequest) -> RecommendNextResponse:
    _ = choose_difficulty(payload.current_skill_estimate)
    recs = build_recommendations(
        student_id=payload.student_id,
        skill_id=payload.skill_id,
        current_skill=payload.current_skill_estimate,
    )
    return RecommendNextResponse(
        student_id=payload.student_id,
        skill_id=payload.skill_id,
        recommendations=recs,
    )


