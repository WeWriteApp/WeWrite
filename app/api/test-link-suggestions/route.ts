import { NextRequest, NextResponse } from 'next/server';
import { findLinkSuggestions } from '../../services/linkSuggestionService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'one of the places in Africa';
    const userId = 'dev_admin_user';
    const excludePageId = searchParams.get('excludePageId') || undefined;

    console.log('🔗 TEST_API: Testing link suggestions with:', {
      text,
      userId,
      excludePageId
    });

    const result = await findLinkSuggestions(text, userId, excludePageId);
    const suggestions = result.suggestions;

    console.log('🔗 TEST_API: Found suggestions:', suggestions);

    return NextResponse.json({
      success: true,
      text,
      userId,
      excludePageId,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('🔗 TEST_API: Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
