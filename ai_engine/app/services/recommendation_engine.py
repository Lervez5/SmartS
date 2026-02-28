from typing import List

from ..models import Recommendation


def build_recommendations(student_id: str, skill_id: str, current_skill: float) -> List[Recommendation]:
    base_id = f"{student_id[:4]}-{skill_id[:4]}"
    easy = max(0.1, current_skill - 0.15)
    medium = current_skill
    hard = min(0.95, current_skill + 0.15)

    recs = [
        Recommendation(
            exercise_id=f"{base_id}-easy",
            difficulty=round(easy, 2),
            rationale="Good for warming up and building confidence.",
        ),
        Recommendation(
            exercise_id=f"{base_id}-med",
            difficulty=round(medium, 2),
            rationale="Matches current skill to reinforce understanding.",
        ),
        Recommendation(
            exercise_id=f"{base_id}-hard",
            difficulty=round(hard, 2),
            rationale="A gentle challenge to stretch skills.",
        ),
    ]
    return recs


