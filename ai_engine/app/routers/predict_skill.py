from fastapi import APIRouter

from ..models import PredictSkillRequest, PredictSkillResponse
from ..services.skill_estimation import estimate_skill

router = APIRouter()


@router.post("/", response_model=PredictSkillResponse)
async def predict_skill(payload: PredictSkillRequest) -> PredictSkillResponse:
    estimate = estimate_skill(payload.history)
    return PredictSkillResponse(
        student_id=payload.student_id,
        skill_id=payload.skill_id,
        estimated_skill=estimate,
    )


