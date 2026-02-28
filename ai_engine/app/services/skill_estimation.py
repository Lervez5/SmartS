from typing import Iterable

from ..models import SkillObservation


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def estimate_skill(history: Iterable[SkillObservation]) -> float:
    skill = 0.5
    k = 0.15
    for obs in history:
        p_correct = 1.0 / (1.0 + pow(2.71828, -(skill - obs.difficulty) * 4))
        error = (1.0 if obs.correct else 0.0) - p_correct
        skill = clamp(skill + k * error)
    return skill


