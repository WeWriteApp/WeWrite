/**
 * Create Secure Admin Account
 * 
 * One-time endpoint to create a secure admin test account that can access production data.
 * This should only be run once and then the endpoint should be disabled.
 * 
 * NOTE: This endpoint still uses firebase-admin auth for USER CREATION which requires
 * admin.auth().createUser(). This is unavoidable for creating Firebase Auth accounts.
 * However, the ADMIN CHECK uses session cookies to avoid jose issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { checkAdminPermissions, isAdminServer } from '../../admin-auth-helper';

// Security: Only allow this endpoint to run once
const ACCOUNT_CREATION_ENABLED = process.env.ENABLE_ADMIN_ACCOUNT_CREATION === 'true';

export async function POST(request: NextRequest) {
  try {
    // Security check: Only allow if explicitly enabled
    if (!ACCOUNT_CREATION_ENABLED) {
      return NextResponse.json({ 
        error: 'Admin account creation is disabled. Set ENABLE_ADMIN_ACCOUNT_CREATION=true to enable.' 
      }, { status: 403 });
    }

    // Check if current user is already an admin using session cookie (avoids jose issues)
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Only existing admins can create admin accounts' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 12) {
      return NextResponse.json({
        error: 'Password must be at least 12 characters long'
      }, { status: 400 });
    }

    const adminEmail = 'admin.test@wewrite.app';
    const adminPassword = password;


    // Use the same Firebase Admin SDK instance
    if (!firebaseAdmin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    try {
      // Check if user already exists
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(adminEmail);
        
        // Update existing user's password
        await firebaseAdmin.auth().updateUser(userRecord.uid, {
          password: adminPassword,
          emailVerified: true
        });

        
        return NextResponse.json({
          success: true,
          message: 'Admin account password updated successfully',
          account: {
            email: adminEmail,
            uid: userRecord.uid,
            created: false,
            updated: true
          }
        });

      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create new one
          
          userRecord = await firebaseAdmin.auth().createUser({
            email: adminEmail,
            password: adminPassword,
            emailVerified: true
            // displayName removed - WeWrite only uses username field stored in Firestore
          });


          return NextResponse.json({
            success: true,
            message: 'Secure admin account created successfully',
            account: {
              email: adminEmail,
              uid: userRecord.uid,
              created: true,
              updated: false
            },
            instructions: {
              login: 'You can now log in with this account to access the admin dashboard',
              dataAccess: 'This account will always see production data regardless of environment',
              security: 'Store the password securely and disable this endpoint by removing ENABLE_ADMIN_ACCOUNT_CREATION'
            }
          });
        } else {
          throw error;
        }
      }

    } catch (error: any) {
      console.error('❌ Error creating admin account:', error);
      
      return NextResponse.json({
        success: false,
        error: `Failed to create admin account: ${error.message}`,
        code: error.code
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in admin account creation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create admin account'
    }, { status: 500 });
  }
}

// GET endpoint to check if admin account exists
export async function GET(request: NextRequest) {
  try {
    // Check if current user is an admin using session cookie (avoids jose issues)
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 401 });
    }

    const adminEmail = 'admin.test@wewrite.app';
    
    // Use the same Firebase Admin SDK instance
    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    try {
      // NOTE: This still uses admin.auth() for checking if user exists - unavoidable for this operation
      const userRecord = await firebaseAdmin.auth().getUserByEmail(adminEmail);
      
      return NextResponse.json({
        success: true,
        exists: true,
        account: {
          email: adminEmail,
          uid: userRecord.uid,
          emailVerified: userRecord.emailVerified,
          createdAt: userRecord.metadata.creationTime,
          lastSignIn: userRecord.metadata.lastSignInTime
        }
      });

    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({
          success: true,
          exists: false,
          message: 'Admin test account does not exist yet'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Error checking admin account:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check admin account'
    }, { status: 500 });
  }
}
