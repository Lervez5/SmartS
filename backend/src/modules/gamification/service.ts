import { GamificationEventInput } from "./schema";
import { addXp, awardBadge, leaderboard, listBadges } from "./repository";

export async function handleEvent(event: GamificationEventInput) {
  let xpGain = 0;
  if (event.type === "exercise_completed") {
    xpGain = Math.round(event.score * 20);
  } else if (event.type === "streak") {
    xpGain = 15;
  } else if (event.type === "milestone") {
    xpGain = 50;
  }

  const profile = await addXp(event.studentId, xpGain);

  const badgesToAward: string[] = [];
  if (profile.xp >= 100 && profile.xp < 150) {
    badgesToAward.push("FIRST_100_XP");
  }
  if (profile.level >= 5) {
    badgesToAward.push("LEVEL_5_HERO");
  }

  const awarded = await Promise.all(
    badgesToAward.map((code) => awardBadge(event.studentId, code))
  );

  return {
    xpGained: xpGain,
    profile,
    newBadges: awarded,
  };
}

export async function getBadges(studentId: string) {
  return listBadges(studentId);
}

export async function getLeaderboard(limit = 10) {
  return leaderboard(limit);
}


