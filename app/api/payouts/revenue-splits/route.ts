/**
 * API endpoint for managing revenue splits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { payoutService } from '../../../services/payoutService';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { db } from '../../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const admin = getFirebaseAdmin();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType') as 'page' | 'group';
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId) {
      return NextResponse.json({
        error: 'resourceType and resourceId are required'
      }, { status: 400 });
    }

    // Verify user owns the resource
    const resourceDoc = await getDoc(doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId));
    if (!resourceDoc.exists()) {
      return NextResponse.json({
        error: 'Resource not found'
      }, { status: 404 });
    }

    const resourceData = resourceDoc.data();
    const ownerId = resourceType === 'page' ? resourceData.userId : resourceData.createdBy;
    
    if (ownerId !== userId) {
      return NextResponse.json({
        error: 'Unauthorized to view this resource'
      }, { status: 403 });
    }

    // Get revenue split
    const revenueSplit = await payoutService.getRevenueSplit(resourceType, resourceId);
    
    if (!revenueSplit) {
      // Create default revenue split if none exists
      await payoutService.createDefaultRevenueSplit(resourceType, resourceId, userId);
      const newRevenueSplit = await payoutService.getRevenueSplit(resourceType, resourceId);
      
      return NextResponse.json({
        success: true,
        data: newRevenueSplit
      });
    }

    return NextResponse.json({
      success: true,
      data: revenueSplit
    });

  } catch (error) {
    console.error('Error getting revenue split:', error);
    return NextResponse.json({
      error: 'Failed to get revenue split'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resourceType, resourceId, splits } = body;

    if (!resourceType || !resourceId || !splits) {
      return NextResponse.json({
        error: 'resourceType, resourceId, and splits are required'
      }, { status: 400 });
    }

    // Verify user owns the resource
    const resourceDoc = await getDoc(doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId));
    if (!resourceDoc.exists()) {
      return NextResponse.json({
        error: 'Resource not found'
      }, { status: 404 });
    }

    const resourceData = resourceDoc.data();
    const ownerId = resourceType === 'page' ? resourceData.userId : resourceData.createdBy;
    
    if (ownerId !== userId) {
      return NextResponse.json({
        error: 'Unauthorized to modify this resource'
      }, { status: 403 });
    }

    // Validate splits
    const totalPercentage = splits.reduce((sum: number, split: any) => sum + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json({
        error: 'Revenue splits must total 100%'
      }, { status: 400 });
    }

    // Ensure platform fee is included
    const hasPlatformFee = splits.some((split: any) => split.recipientId === 'platform');
    if (!hasPlatformFee) {
      const config = await payoutService.getPayoutConfig();
      splits.push({
        recipientId: 'platform',
        percentage: config.platformFeePercentage,
        role: 'platform_fee'
      });
      
      // Adjust other splits proportionally
      const userSplitsTotal = 100 - config.platformFeePercentage;
      const currentUserTotal = splits
        .filter((split: any) => split.recipientId !== 'platform')
        .reduce((sum: number, split: any) => sum + split.percentage, 0);
      
      splits.forEach((split: any) => {
        if (split.recipientId !== 'platform') {
          split.percentage = (split.percentage / currentUserTotal) * userSplitsTotal;
        }
      });
    }

    // Create revenue split
    const result = await payoutService.createRevenueSplit(
      resourceType,
      resourceId,
      splits,
      userId
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Revenue split updated successfully'
    });

  } catch (error) {
    console.error('Error updating revenue split:', error);
    return NextResponse.json({
      error: 'Failed to update revenue split'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, resourceType, resourceId, contributorId, percentage } = body;

    if (action === 'add_contributor') {
      // Add a contributor to revenue split
      const revenueSplit = await payoutService.getRevenueSplit(resourceType, resourceId);
      
      if (!revenueSplit) {
        return NextResponse.json({
          error: 'Revenue split not found'
        }, { status: 404 });
      }

      // Verify user owns the resource
      if (revenueSplit.createdBy !== userId) {
        return NextResponse.json({
          error: 'Unauthorized to modify this revenue split'
        }, { status: 403 });
      }

      // Add contributor split
      const newSplits = [...revenueSplit.splits];
      
      // Reduce owner percentage to accommodate contributor
      const ownerSplit = newSplits.find(split => split.role === 'owner');
      if (ownerSplit && ownerSplit.percentage >= percentage) {
        ownerSplit.percentage -= percentage;
        
        newSplits.push({
          recipientId: `recipient_${contributorId}`,
          recipientType: 'user',
          percentage,
          role: 'contributor'
        });

        const result = await payoutService.createRevenueSplit(
          resourceType,
          resourceId,
          newSplits.map(split => ({
            recipientId: split.recipientId,
            percentage: split.percentage,
            role: split.role
          })),
          userId
        );

        return NextResponse.json({
          success: true,
          data: result.data,
          message: 'Contributor added successfully'
        });
      } else {
        return NextResponse.json({
          error: 'Insufficient owner percentage to add contributor'
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error modifying revenue split:', error);
    return NextResponse.json({
      error: 'Failed to modify revenue split'
    }, { status: 500 });
  }
}