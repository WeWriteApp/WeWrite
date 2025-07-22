import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';

/**
 * Debug endpoint to test what the dashboard analytics API is actually returning
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Test API Response] Starting API response test...');
    
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: []
    };
    
    const baseUrl = request.url.replace('/api/debug/test-api-response', '');
    
    // Test accounts API
    try {
      const accountsUrl = `${baseUrl}/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        type: 'accounts'
      });
      
      console.log('[Test API Response] Testing accounts API:', accountsUrl);
      
      const accountsResponse = await fetch(accountsUrl, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
          'Content-Type': 'application/json'
        }
      });
      
      const accountsResult = await accountsResponse.json();
      
      testResults.tests.push({
        name: 'Accounts API',
        url: accountsUrl,
        status: accountsResponse.status,
        success: accountsResponse.ok,
        response: accountsResult,
        dataType: typeof accountsResult.data,
        isArray: Array.isArray(accountsResult.data),
        dataLength: Array.isArray(accountsResult.data) ? accountsResult.data.length : 'N/A'
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Accounts API',
        success: false,
        error: error.message
      });
    }
    
    // Test pages API
    try {
      const pagesUrl = `${baseUrl}/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        type: 'pages'
      });
      
      console.log('[Test API Response] Testing pages API:', pagesUrl);
      
      const pagesResponse = await fetch(pagesUrl, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
          'Content-Type': 'application/json'
        }
      });
      
      const pagesResult = await pagesResponse.json();
      
      testResults.tests.push({
        name: 'Pages API',
        url: pagesUrl,
        status: pagesResponse.status,
        success: pagesResponse.ok,
        response: pagesResult,
        dataType: typeof pagesResult.data,
        isArray: Array.isArray(pagesResult.data),
        dataLength: Array.isArray(pagesResult.data) ? pagesResult.data.length : 'N/A'
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Pages API',
        success: false,
        error: error.message
      });
    }
    
    // Test all API
    try {
      const allUrl = `${baseUrl}/api/admin/dashboard-analytics?` + new URLSearchParams({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        type: 'all'
      });
      
      console.log('[Test API Response] Testing all API:', allUrl);
      
      const allResponse = await fetch(allUrl, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
          'Content-Type': 'application/json'
        }
      });
      
      const allResult = await allResponse.json();
      
      testResults.tests.push({
        name: 'All API',
        url: allUrl,
        status: allResponse.status,
        success: allResponse.ok,
        response: allResult,
        dataType: typeof allResult.data,
        hasNestedArrays: allResult.data && typeof allResult.data === 'object' ? {
          newAccountsCreated: Array.isArray(allResult.data.newAccountsCreated),
          newPagesCreated: Array.isArray(allResult.data.newPagesCreated)
        } : 'N/A'
      });
    } catch (error) {
      testResults.tests.push({
        name: 'All API',
        success: false,
        error: error.message
      });
    }
    
    return NextResponse.json(testResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Test API Response] Error:', error);
    
    return NextResponse.json({
      error: 'API response test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
