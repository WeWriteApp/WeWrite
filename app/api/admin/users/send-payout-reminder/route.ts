import { NextRequest, NextResponse } from "next/server";
import { checkAdminPermissions } from "../../../admin-auth-helper";
import { getCollectionName } from "../../../../utils/environmentConfig";
import { getFirebaseAdmin } from "../../../../firebase/firebaseAdmin";
import { withAdminContext } from "../../../../utils/adminRequestContext";

/**
 * POST /api/admin/users/send-payout-reminder
 * Body: { uid: string, amountUsd?: number }
 *
 * Admin-only endpoint to log/schedule a payout setup reminder notification
 * for a user who has available earnings but no payout method configured.
 */
export async function POST(req: NextRequest) {
  return withAdminContext(req, async () => {
    try {
      const { userId: adminId, isAdmin } = await checkAdminPermissions(req);
      if (!adminId || !isAdmin) {
        return NextResponse.json({ error: "Admin permissions required" }, { status: 403 });
      }

      const body = await req.json().catch(() => ({}));
      const { uid, amountUsd } = body || {};

      if (!uid) {
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });
      }

      const admin = await getFirebaseAdmin();
      const db = admin.firestore();
      const usersCol = getCollectionName("users");
      const userRef = db.collection(usersCol).doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userData: any = userSnap.data() || {};
      const hasBank = !!userData.stripeConnectedAccountId || !!userData?.financial?.payoutsSetup;
      const available = typeof amountUsd === "number" ? amountUsd : userData?.financial?.availableEarningsUsd ?? 0;

      if (hasBank) {
        return NextResponse.json({ error: "User already has payout method configured" }, { status: 400 });
      }

      if (!available || available <= 0) {
        return NextResponse.json({ error: "No available earnings to remind about" }, { status: 400 });
      }

      // Write notification in subcollection
      const notifRef = userRef.collection("notifications").doc();
      await notifRef.set({
        type: "payout_setup_reminder",
        title: "Set up payouts to get paid",
        message: `You have $${available.toFixed(2)} ready. Add your bank to receive your payout.`,
        criticality: "medium",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByAdmin: adminId,
        metadata: {
          availableUsd: available,
          hasBank: hasBank
        }
      });

      // Track last reminder time on the user doc to prevent future spam
      await userRef.set(
        {
          notifications: {
            lastPayoutReminderAt: admin.firestore.FieldValue.serverTimestamp()
          }
        },
        { merge: true }
      );

      return NextResponse.json({ ok: true, message: "Reminder scheduled", availableUsd: available });
    } catch (err: any) {
      console.error("[ADMIN] send-payout-reminder error", err);
      return NextResponse.json({ error: err?.message || "Failed to send reminder" }, { status: 500 });
    }
  }); // End withAdminContext
}
