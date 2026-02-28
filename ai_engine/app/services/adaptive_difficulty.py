from .skill_estimation import clamp


def choose_difficulty(current_skill: float) -> float:
  target = current_skill + 0.1
  return clamp(target)


