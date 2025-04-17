import { NextResponse } from 'next/server';

// This route handler will redirect to the main page route
export async function GET(request, { params }) {
  const { id } = params;
  return NextResponse.redirect(new URL(`/${id}`, request.url));
}
