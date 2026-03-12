import { desc, eq } from "drizzle-orm";
import { db } from "./client.js";
import { chatMessages } from "./schema.js";
import type { ChatMessageRow } from "./schema.js";

export async function saveMessage(data: {
  roomCode: string;
  playerId: string;
  displayName: string;
  avatarColor: string;
  message: string;
}): Promise<ChatMessageRow> {
  const [row] = await db
    .insert(chatMessages)
    .values(data)
    .returning();
  return row;
}

/**
 * Returns the most recent `limit` messages for a room in chronological order
 * (oldest first), ready to be sent as chat history to a joining player.
 */
export async function getRecentMessages(
  roomCode: string,
  limit = 50
): Promise<ChatMessageRow[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.roomCode, roomCode))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  // Reverse so the client receives messages oldest → newest
  return rows.reverse();
}
