import { getFirebaseAdmin } from '../firebase/admin';
import { getCollectionNameAsync } from '../utils/environmentConfig';

/**
 * Email Audit Log Service
 *
 * Logs all email sends to Firestore for auditing and debugging.
 * Uses DEV_ prefix in development, no prefix in production.
 * Respects X-Force-Production-Data header for admin panel production mode.
 */

export interface EmailLogEntry {
  id?: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered' | 'scheduled' | 'complained' | 'opened' | 'clicked' | 'delayed';
  resendId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt: string;
  createdAt: string;
  // Webhook-updated fields
  lastWebhookEvent?: string;
  lastWebhookAt?: string;
  bounceReason?: string;
  bounceType?: string;
  complaintType?: string;
  openedAt?: string;
  clickedAt?: string;
  clickedLink?: string;
}

// Use the async version to support X-Force-Production-Data header
const getEmailLogsCollectionName = async () => {
  return getCollectionNameAsync('emailLogs');
};

/**
 * Log an email send to Firestore
 */
export async function logEmailSend(entry: Omit<EmailLogEntry, 'id' | 'createdAt'>): Promise<string | null> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const logEntry: Omit<EmailLogEntry, 'id'> = {
      ...entry,
      createdAt: new Date().toISOString(),
    };

    const collectionName = await getEmailLogsCollectionName();
    const docRef = await db.collection(collectionName).add(logEntry);
    return docRef.id;
  } catch (error) {
    console.error('[EmailLog] Failed to log email:', error);
    return null;
  }
}

/**
 * Get email logs for a specific template
 */
export async function getEmailLogsByTemplate(
  templateId: string,
  limit: number = 50
): Promise<EmailLogEntry[]> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const collectionName = await getEmailLogsCollectionName();
    const snapshot = await db
      .collection(collectionName)
      .where('templateId', '==', templateId)
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as EmailLogEntry[];
  } catch (error) {
    console.error('[EmailLog] Failed to get logs by template:', error);
    return [];
  }
}

/**
 * Get email logs for a specific user
 */
export async function getEmailLogsByUser(
  userId: string,
  limit: number = 50
): Promise<EmailLogEntry[]> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const collectionName = await getEmailLogsCollectionName();
    const snapshot = await db
      .collection(collectionName)
      .where('recipientUserId', '==', userId)
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as EmailLogEntry[];
  } catch (error) {
    console.error('[EmailLog] Failed to get logs by user:', error);
    return [];
  }
}

/**
 * Get all recent email logs
 */
export async function getRecentEmailLogs(limit: number = 100): Promise<EmailLogEntry[]> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const collectionName = await getEmailLogsCollectionName();
    const snapshot = await db
      .collection(collectionName)
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as EmailLogEntry[];
  } catch (error) {
    console.error('[EmailLog] Failed to get recent logs:', error);
    return [];
  }
}

/**
 * Get email stats for admin dashboard
 */
export async function getEmailStats(): Promise<{
  totalSent: number;
  totalFailed: number;
  byTemplate: Record<string, { sent: number; failed: number }>;
  last24Hours: number;
  last7Days: number;
}> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all logs from last 7 days for stats
    const collectionName = await getEmailLogsCollectionName();
    const snapshot = await db
      .collection(collectionName)
      .where('sentAt', '>=', sevenDaysAgo)
      .get();
    
    let totalSent = 0;
    let totalFailed = 0;
    let last24Hours = 0;
    const byTemplate: Record<string, { sent: number; failed: number }> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data() as EmailLogEntry;
      
      if (!byTemplate[data.templateId]) {
        byTemplate[data.templateId] = { sent: 0, failed: 0 };
      }
      
      if (data.status === 'sent' || data.status === 'delivered') {
        totalSent++;
        byTemplate[data.templateId].sent++;
      } else {
        totalFailed++;
        byTemplate[data.templateId].failed++;
      }
      
      if (data.sentAt >= oneDayAgo) {
        last24Hours++;
      }
    });
    
    return {
      totalSent,
      totalFailed,
      byTemplate,
      last24Hours,
      last7Days: totalSent + totalFailed,
    };
  } catch (error) {
    console.error('[EmailLog] Failed to get stats:', error);
    return {
      totalSent: 0,
      totalFailed: 0,
      byTemplate: {},
      last24Hours: 0,
      last7Days: 0,
    };
  }
}
