import { NextRequest, NextResponse } from 'next/server';

/**
 * Page visibility updates are deprecated while private pages functionality
 * is being removed. All pages are now treated as public.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pageId } = await params;
  return NextResponse.json(
    {
      success: false,
      error: 'Page visibility controls have been removed',
      pageId,
    },
    { status: 410 }
  );
}
