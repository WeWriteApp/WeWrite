import { NextResponse } from 'next/server';

// This route handler will redirect to the main page route
// This is needed to avoid conflicts with the app/[id]/page.js route
export async function GET(request, { params }) {
  const { id } = params;
  // Redirect to the main page route
  return NextResponse.redirect(new URL(`/${id}`, request.url));
}

// Handle all other HTTP methods
export async function POST(request, { params }) {
  return NextResponse.redirect(new URL(`/${params.id}`, request.url));
}

export async function PUT(request, { params }) {
  return NextResponse.redirect(new URL(`/${params.id}`, request.url));
}

export async function DELETE(request, { params }) {
  return NextResponse.redirect(new URL(`/${params.id}`, request.url));
}

export async function PATCH(request, { params }) {
  return NextResponse.redirect(new URL(`/${params.id}`, request.url));
}
