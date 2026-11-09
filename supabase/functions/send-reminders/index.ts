// Supabase Edge Function (Deno). Thirret çdo minutë nga pg_cron (shih docs/setup.md).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { isGone, selectDue, shouldMarkReminded, type ReminderRow } from './logic.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('authorization') !== `Bearer ${expected}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const now = new Date();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, remind_at, done, deleted, reminded_at')
    .lte('remind_at', now.toISOString())
    .is('reminded_at', null)
    .eq('done', false)
    .eq('deleted', false)
    .limit(500);
  if (error) return new Response(error.message, { status: 500 });

  const due = selectDue(data as ReminderRow[], now);
  let sent = 0;
  for (const task of due) {
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', task.user_id);
    const payload = JSON.stringify({ title: task.title || 'Kujtesë', taskId: task.id });
    let delivered = 0;
    let transientFailures = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? 0;
        if (isGone(status)) await supabase.from('push_subscriptions').delete().eq('id', s.id);
        else {
          transientFailures++;
          console.error('push failed', status, e);
        }
      }
    }
    sent += delivered;
    if (shouldMarkReminded({ subsError: Boolean(subsErr), subscriptions: subs?.length ?? 0, delivered, transientFailures })) {
      await supabase.from('tasks').update({ reminded_at: now.toISOString() }).eq('id', task.id);
    }
  }

  return Response.json({ due: due.length, sent });
});
