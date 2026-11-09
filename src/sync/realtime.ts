import { TABLES } from '../domain/types';
import { syncNow } from './engine';
import { supabase } from './supabase';

interface ChannelLike {
  on(type: 'postgres_changes', filter: { event: '*'; schema: string; table: string; filter: string }, cb: () => void): ChannelLike;
  subscribe(): ChannelLike;
}

export interface RealtimeClient {
  channel(name: string): ChannelLike;
  removeChannel(ch: ChannelLike): Promise<unknown>;
}

/**
 * Dëgjon ndryshimet në server dhe thërret sinkronizimin. Payload-i nuk zbatohet
 * drejtpërdrejt, që rregulli "fiton më i vonshmi" të mbetet vetëm te engine.ts.
 */
export function startRealtime(
  userId: string,
  client: RealtimeClient | null = supabase as unknown as RealtimeClient | null,
  sync: () => void = () => void syncNow(),
): () => void {
  if (!client) return () => {};
  let ch = client.channel(`changes-${userId}`);
  for (const table of TABLES) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () => sync());
  }
  const sub = ch.subscribe();
  return () => void client.removeChannel(sub);
}
