from fastapi import APIRouter

from ..models import SimulateLearningPathRequest, SimulateLearningPathResponse
from ..services.simulation_engine import simulate_learning_path

router = APIRouter()


@router.post("/", response_model=SimulateLearningPathResponse)
async def simulate(payload: SimulateLearningPathRequest) -> SimulateLearningPathResponse:
    return simulate_learning_path(payload)


