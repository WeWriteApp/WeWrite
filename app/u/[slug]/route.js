import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { slug } = params;
  
  // Redirect to the new URL pattern
  return NextResponse.redirect(new URL(`/user/${slug}`, request.url));
}
