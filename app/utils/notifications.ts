import { createNotification } from '../services/notificationsApi';

type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
};

/**
 * Compatibility helper used by payout services.
 */
export async function sendUserNotification(userId: string, payload: NotificationPayload) {
  try {
    await createNotification({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.body,
      metadata: payload.metadata || {},
      criticality: 'normal'
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Notifications] Failed to send notification', error);
    return { success: false, error: error?.message || 'Failed to send notification' };
  }
}
