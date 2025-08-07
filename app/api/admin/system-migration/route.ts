/**
 * System Migration API
 * 
 * Admin API endpoint to manage migration from old escrow system
 * to new fund holding model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { systemMigrationService } from '../../../services/systemMigrationService';
import { isAdminUser } from '../../../utils/adminUtils';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    console.log(`🔧 [ADMIN] System migration request: ${action}`);

    switch (action) {
      case 'start_migration':
        return await handleStartMigration();
      
      case 'get_status':
        return await handleGetStatus();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: start_migration, get_status'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in system migration:', error);
    return NextResponse.json({
      error: 'System migration request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`📊 [ADMIN] Getting migration status`);
    
    const status = await systemMigrationService.getMigrationStatus();
    
    return NextResponse.json({
      success: true,
      status: status || {
        phase: 'not_started',
        currentStep: 'Migration not started',
        totalSteps: 6,
        completedSteps: 0,
        errors: [],
        summary: {
          usersProcessed: 0,
          subscriptionsProcessed: 0,
          allocationsProcessed: 0,
          totalFundsMigrated: 0
        }
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error getting migration status:', error);
    return NextResponse.json({
      error: 'Failed to get migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleStartMigration() {
  console.log(`🚀 [ADMIN] Starting system migration`);
  
  const result = await systemMigrationService.executeMigration();
  
  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'System migration completed successfully',
      status: result.status
    });
  } else {
    return NextResponse.json({
      success: false,
      error: result.error,
      status: result.status
    }, { status: 500 });
  }
}

async function handleGetStatus() {
  console.log(`📊 [ADMIN] Getting migration status`);
  
  const status = await systemMigrationService.getMigrationStatus();
  
  return NextResponse.json({
    success: true,
    status: status || {
      phase: 'not_started',
      currentStep: 'Migration not started',
      totalSteps: 6,
      completedSteps: 0,
      errors: [],
      summary: {
        usersProcessed: 0,
        subscriptionsProcessed: 0,
        allocationsProcessed: 0,
        totalFundsMigrated: 0
      }
    }
  });
}
