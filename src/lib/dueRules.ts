/**
 * Deterministic due rules (no push). Computed in-app when user opens the app.
 */
import { db } from '../db/schema';

export async function getDueNowCounts(): Promise<{ confirmations: number; queue: number }> {
  const [appointments, queue] = await Promise.all([
    db.appointments.where('status').anyOf(['hold', 'invited']).count(),
    db.messageQueue.where('status').equals('pending').count(),
  ]);
  return { confirmations: appointments, queue };
}

export async function getDueNowAppointmentIds(): Promise<string[]> {
  const list = await db.appointments.where('status').anyOf(['hold', 'invited']).toArray();
  return list.map((a) => a.id);
}
