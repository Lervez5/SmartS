from typing import List

from ..models import SimulateLearningPathRequest, SimulateLearningPathResponse, SimulateStep
from .skill_estimation import clamp


def simulate_learning_path(req: SimulateLearningPathRequest) -> SimulateLearningPathResponse:
    steps: List[SimulateStep] = []
    skill = req.initial_skill
    for i in range(req.steps):
        difficulty = clamp(skill + 0.1)
        success_probability = 0.5 + (skill - difficulty) * 0.8
        success_probability = clamp(success_probability)
        expected_skill = clamp(skill + (success_probability - 0.5) * 0.08)
        steps.append(
            SimulateStep(
                step_index=i,
                difficulty=round(difficulty, 2),
                success_probability=round(success_probability, 2),
                expected_skill=round(expected_skill, 2),
            )
        )
        skill = expected_skill

    reached_target = skill >= req.target_skill
    return SimulateLearningPathResponse(steps=steps, reached_target=reached_target)


