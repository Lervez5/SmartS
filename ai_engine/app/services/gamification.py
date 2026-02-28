from datetime import datetime
from typing import List, Tuple
from ..models import Badge, GamificationProfile

def calculate_xp(accuracy: float, difficulty: float, response_time_ms: int) -> int:
    """
    Calculates XP based on performance metrics.
    Base XP: 100
    Accuracy Multiplier: up to 2x (for 100% accuracy)
    Difficulty Multiplier: up to 1.5x
    Speed Bonus: up to 50 XP
    """
    base_xp = 100
    accuracy_mult = 1.0 + accuracy
    difficulty_mult = 1.0 + (difficulty * 0.5)
    
    # Speed bonus: max 50 XP if under 5 seconds, linear decrease to 0 at 30 seconds
    speed_bonus = max(0, 50 - (response_time_ms / 1000 - 5) * 2) if response_time_ms < 30000 else 0
    
    total_xp = int((base_xp * accuracy_mult * difficulty_mult) + speed_bonus)
    return total_xp

def get_level(xp: int) -> int:
    """ Calculates level based on XP: Level = (XP/100)^(1/1.5) + 1 """
    if xp <= 0: return 1
    return int((xp / 100) ** (1/1.5)) + 1

def check_badges(profile: GamificationProfile, current_event: dict) -> List[Badge]:
    """ Checks and returns newly awarded badges based on profile and event """
    new_badges = []
    existing_codes = {b.code for b in profile.badges}
    
    # Example Badge: First Sprout
    if "first_sprout" not in existing_codes:
        new_badges.append(Badge(
            code="first_sprout",
            name="First Sprout",
            awarded_at=datetime.utcnow().isoformat()
        ))
        
    # Example Badge: Speed Demon (if response was very fast and correct)
    if "speed_demon" not in existing_codes and current_event.get("correct") and current_event.get("response_ms", 99999) < 2000:
        new_badges.append(Badge(
            code="speed_demon",
            name="Speed Demon",
            awarded_at=datetime.utcnow().isoformat()
        ))
        
    return new_badges
