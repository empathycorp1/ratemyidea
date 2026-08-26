import { query } from "./db";

/** Records/refreshes a heartbeat for one device. See db/schema.sql's
 *  `presence` table and getLiveStats() in get-board-data.ts. */
export async function pingPresence(deviceId: string): Promise<void> {
  await query(
    `INSERT INTO presence (device_id, last_seen)
     VALUES ($1, now())
     ON CONFLICT (device_id) DO UPDATE SET last_seen = now()`,
    [deviceId]
  );
}
