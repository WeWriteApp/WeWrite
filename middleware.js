import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    // OpenGraph route
    '/api/og/:path*',
    
    // Match all request paths except for:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public folder
    // - public files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};

export function middleware(request) {
  const response = NextResponse.next();
  
  // Add CORS headers only for OpenGraph routes
  if (request.nextUrl.pathname.startsWith('/api/og')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  return response;
} 