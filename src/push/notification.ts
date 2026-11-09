export function notificationFromPayload(payload: { title?: string; taskId?: string } | null): {
  title: string;
  options: NotificationOptions & { data: { url: string } };
} {
  return {
    title: payload?.title || 'Kujtesë',
    options: { body: 'Kujtesë për detyrën', tag: payload?.taskId, data: { url: '/tasks' } },
  };
}
