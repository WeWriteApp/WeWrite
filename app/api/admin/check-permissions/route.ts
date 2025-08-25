/**
 * Admin Permissions Check API
 * Provides a simple endpoint to check if the current user has admin permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    
    if (adminCheck.success) {
      return NextResponse.json({
        success: true,
        isAdmin: true,
        userEmail: adminCheck.userEmail
      });
    } else {
      return NextResponse.json({
        success: false,
        isAdmin: false,
        error: adminCheck.error
      });
    }
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return NextResponse.json({
      success: false,
      isAdmin: false,
      error: 'Failed to check admin permissions'
    }, { status: 500 });
  }
}
