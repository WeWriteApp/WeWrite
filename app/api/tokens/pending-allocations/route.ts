/**
 * Pending Token Allocations API
 *
 * Handles token allocations that can be adjusted throughout the month
 * until the allocation deadline (end of month).
 *
 * @deprecated This API is deprecated as the token system has been migrated to USD.
 * Use USD-based allocation APIs instead.
 */

import { NextRequest, NextResponse } from 'next/server';

// GET - Get user's pending allocations summary
export async function GET(request: NextRequest) {
  // DEPRECATED: Token allocations have been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token allocations have been migrated to USD system. Use USD-based allocation APIs instead.',
    replacement: '/api/usd/allocations',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}

// POST - Create or update pending allocation
export async function POST(request: NextRequest) {
  // DEPRECATED: Token allocations have been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token allocations have been migrated to USD system. Use USD-based allocation APIs instead.',
    replacement: '/api/usd/allocations',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}

// DELETE - Remove a token allocation
export async function DELETE(request: NextRequest) {
  // DEPRECATED: Token allocations have been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token allocations have been migrated to USD system. Use USD-based allocation APIs instead.',
    replacement: '/api/usd/allocations',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}