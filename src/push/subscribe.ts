import { supabase } from '../sync/supabase';

export type PushResult = 'granted' | 'denied' | 'unsupported';

interface SubscriptionLike {
  toJSON(): { endpoint?: string; keys?: Record<string, string> };
}

export interface PushDeps {
  supported: boolean;
  vapidPublicKey: string | undefined;
  requestPermission(): Promise<NotificationPermission>;
  getRegistration(): Promise<{
    pushManager: {
      getSubscription(): Promise<SubscriptionLike | null>;
      subscribe(o: { userVisibleOnly: boolean; applicationServerKey: string }): Promise<SubscriptionLike>;
    };
  }>;
  save(s: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
}

export const browserPushDeps = (): PushDeps => ({
  supported: typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  requestPermission: () => Notification.requestPermission(),
  getRegistration: () => navigator.serviceWorker.ready as unknown as ReturnType<PushDeps['getRegistration']>,
  async save(s) {
    if (!supabase) throw new Error('Supabase nuk është konfiguruar');
    const { error } = await supabase.from('push_subscriptions').upsert(s, { onConflict: 'endpoint' });
    if (error) throw error;
  },
});

/** Kërkon leje për njoftime dhe ruan abonimin e kësaj pajisjeje në server. */
export async function subscribeToPush(deps: PushDeps = browserPushDeps()): Promise<PushResult> {
  if (!deps.supported || !deps.vapidPublicKey) return 'unsupported';
  const permission = await deps.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await deps.getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deps.vapidPublicKey }));
  const json = sub.toJSON();
  await deps.save({ endpoint: json.endpoint ?? '', p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' });
  return 'granted';
}

export { notificationFromPayload } from './notification';
