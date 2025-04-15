import { NextResponse } from 'next/server';

// This is a route handler that redirects to the page-wrapper component
export function GET(request) {
  return NextResponse.redirect(new URL('/new/wrapper', request.url));
}
