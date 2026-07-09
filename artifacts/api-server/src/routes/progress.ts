import { Router } from "express";
import { db, exerciseSessions, beliefsTable, telemetryEventsTable } from "@workspace/db";
import { eq, desc, and, gte, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/progress", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // ── Mood trend: daily avg moodBefore / moodAfter for completed sessions ──
    const sessionsWithMood = await db
      .select()
      .from(exerciseSessions)
      .where(
        and(
          eq(exerciseSessions.completed, true),
          gte(exerciseSessions.createdAt, thirtyDaysAgo),
          isNotNull(exerciseSessions.moodBefore),
          isNotNull(exerciseSessions.moodAfter)
        )
      )
      .orderBy(exerciseSessions.createdAt);

    // Group by day
    const dayMap: Record<string, { beforeSum: number; afterSum: number; count: number }> = {};
    for (const s of sessionsWithMood) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dayMap[key]) dayMap[key] = { beforeSum: 0, afterSum: 0, count: 0 };
      dayMap[key]!.beforeSum += s.moodBefore ?? 0;
      dayMap[key]!.afterSum += s.moodAfter ?? 0;
      dayMap[key]!.count++;
    }
    const moodTrend = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { beforeSum, afterSum, count }]) => ({
        date,
        avgBefore: Math.round((beforeSum / count) * 10) / 10,
        avgAfter: Math.round((afterSum / count) * 10) / 10,
      }));

    // ── Exercises by modality (completed, last 30 days) ──
    const completedSessions = await db
      .select()
      .from(exerciseSessions)
      .where(
        and(
          eq(exerciseSessions.completed, true),
          gte(exerciseSessions.createdAt, thirtyDaysAgo)
        )
      );

    const modalityCounts: Record<string, number> = {};
    for (const s of completedSessions) {
      modalityCounts[s.modality] = (modalityCounts[s.modality] ?? 0) + 1;
    }
    const exercisesByModality = Object.entries(modalityCounts).map(([modality, count]) => ({
      modality,
      count,
    }));

    // ── Exercises by exerciseId (top ones, last 30 days) ──
    const exerciseIdCounts: Record<string, number> = {};
    for (const s of completedSessions) {
      exerciseIdCounts[s.exerciseId] = (exerciseIdCounts[s.exerciseId] ?? 0) + 1;
    }
    const exercisesByType = Object.entries(exerciseIdCounts)
      .map(([exerciseId, count]) => ({ exerciseId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── Belief funnel (all time) ──
    const allBeliefs = await db.select().from(beliefsTable);
    const beliefFunnel = {
      active: allBeliefs.filter((b) => b.status === "active").length,
      challenged: allBeliefs.filter((b) => b.status === "challenged").length,
      resolved: allBeliefs.filter((b) => b.status === "resolved").length,
    };

    // ── Streak calculation (days with at least one completed session or check-in) ──
    const allSessions = await db
      .select()
      .from(exerciseSessions)
      .where(eq(exerciseSessions.completed, true))
      .orderBy(desc(exerciseSessions.createdAt));

    const checkins = await db
      .select()
      .from(telemetryEventsTable)
      .where(eq(telemetryEventsTable.type, "mood_checkin"))
      .orderBy(desc(telemetryEventsTable.createdAt))
      .limit(90);

    // Build a set of active days (YYYY-MM-DD)
    const activeDays = new Set<string>();
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    for (const s of allSessions) activeDays.add(toKey(new Date(s.createdAt)));
    for (const c of checkins) activeDays.add(toKey(new Date(c.createdAt)));

    // Current streak (counting backwards from today)
    let currentStreak = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (activeDays.has(toKey(d))) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak
    const sortedDays = [...activeDays].sort();
    let longestStreak = 0;
    let runStreak = 0;
    let prevDate: Date | null = null;
    for (const key of sortedDays) {
      const cur = new Date(key);
      if (prevDate) {
        const diff = (cur.getTime() - prevDate.getTime()) / 86400000;
        if (diff === 1) {
          runStreak++;
        } else {
          runStreak = 1;
        }
      } else {
        runStreak = 1;
      }
      if (runStreak > longestStreak) longestStreak = runStreak;
      prevDate = cur;
    }

    const totalCompleted = allSessions.length;

    res.json({
      moodTrend,
      exercisesByModality,
      exercisesByType,
      beliefFunnel,
      currentStreak,
      longestStreak,
      totalCompleted,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get progress");
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

export default router;
