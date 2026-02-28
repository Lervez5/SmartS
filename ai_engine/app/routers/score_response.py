from fastapi import APIRouter

from ..models import ScoreResponseRequest, ScoreResponseResponse
from ..services.response_scoring import score_response

router = APIRouter()


@router.post("/", response_model=ScoreResponseResponse)
async def score_response_route(payload: ScoreResponseRequest) -> ScoreResponseResponse:
    result = score_response(payload)
    return ScoreResponseResponse(
        student_id=payload.student_id,
        exercise_id=payload.exercise_id,
        result=result,
    )


