// lib/ai-summary.ts
// Generates a short, human-readable performance summary for a member,
// grounded entirely in the stats block from getMemberStats() — the
// model is only asked to phrase real numbers, never to invent activity.

interface MemberStatsInput {
  username: string;
  rank: string;
  totalDonated: number;
  donationCount: number;
  eventsAttended: number;
  eventsRegistered: number;
  showUpRate: number | null;
  itemActionsCompleted: number;
  strikeCount: number;
  badges: string[];
  daysSinceActive: number;
}

export async function generatePerformanceSummary(stats: MemberStatsInput): Promise<string> {
  const prompt = `You are writing a short (2-3 sentence) internal performance summary for a member of a GTA V roleplay family called Brutal Carnage, based ONLY on the stats below. Be direct and specific with numbers. Neutral, professional tone — not hype, not harsh. If strikes > 0, mention it plainly. If inactive (daysSinceActive >= 14), note that too.

Stats for ${stats.username} (rank: ${stats.rank}):
- Total donated: $${stats.totalDonated.toLocaleString()} across ${stats.donationCount} donations
- Events: attended ${stats.eventsAttended} of ${stats.eventsRegistered} registered (${
    stats.showUpRate !== null ? Math.round(stats.showUpRate * 100) + "%" : "n/a"
  } show-up rate)
- Inventory actions completed: ${stats.itemActionsCompleted}
- Strikes on record: ${stats.strikeCount}
- Badges earned: ${stats.badges.length > 0 ? stats.badges.join(", ") : "none yet"}
- Days since last active: ${stats.daysSinceActive}

Write only the summary text, no preamble, no headers.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`AI summary generation failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  return text?.trim() ?? "No summary available.";
}
