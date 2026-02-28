from fastapi import APIRouter, HTTPException
from ..models import ProcessEventRequest, ProcessEventResponse, GamificationProfile
from ..services.gamification import calculate_xp, get_level, check_badges
from ..database import get_db

router = APIRouter()

@router.get("/profile/{student_id}", response_model=GamificationProfile)
async def get_profile(student_id: str):
    db = get_db()
    # Note: In prisma it's 'GamificationProfile', in mongo it's usually lowercase or as defined in collation
    profile_data = await db.GamificationProfile.find_one({"studentId": student_id})
    if not profile_data:
        return GamificationProfile(student_id=student_id, xp=0, level=1, badges=[])
    
    return GamificationProfile(
        student_id=student_id,
        xp=profile_data.get("xp", 0),
        level=profile_data.get("level", 1),
        badges=profile_data.get("badges", [])
    )

@router.post("/process-event", response_model=ProcessEventResponse)
async def process_event(payload: ProcessEventRequest):
    db = get_db()
    
    # 1. Fetch current profile
    profile_data = await db.GamificationProfile.find_one({"studentId": payload.student_id})
    if not profile_data:
        profile = GamificationProfile(student_id=payload.student_id, xp=0, level=1, badges=[])
    else:
        profile = GamificationProfile(
            student_id=payload.student_id,
            xp=profile_data.get("xp", 0),
            level=profile_data.get("level", 1),
            badges=profile_data.get("badges", [])
        )

    # 2. Calculate XP gained
    xp_gained = 0
    if payload.event_type == "exercise_completion":
        accuracy = payload.payload.get("accuracy", 0.0)
        difficulty = payload.payload.get("difficulty", 0.5)
        response_time = payload.payload.get("response_ms", 10000)
        xp_gained = calculate_xp(accuracy, difficulty, response_time)
    elif payload.event_type == "lesson_completion":
        xp_gained = 200
    
    # 3. Update XP and check level
    old_level = profile.level
    profile.xp += xp_gained
    profile.level = get_level(profile.xp)
    level_up = profile.level > old_level
    
    # 4. Check for new badges
    new_badges = check_badges(profile, payload.payload)
    profile.badges.extend(new_badges)
    
    # 5. Persist to MongoDB
    await db.GamificationProfile.update_one(
        {"studentId": payload.student_id},
        {"$set": {
            "xp": profile.xp,
            "level": profile.level,
            "badges": [b.dict() for b in profile.badges],
            "updatedAt": datetime.utcnow()
        }},
        upsert=True
    )
    
    return ProcessEventResponse(
        student_id=payload.student_id,
        xp_gained=xp_gained,
        new_total_xp=profile.xp,
        level_up=level_up,
        new_level=profile.level,
        badges_earned=[b.code for b in new_badges]
    )

from datetime import datetime
