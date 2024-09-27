import { NextResponse } from 'next/server';


export async function POST(request) {
  const { amount, currency } = await request.json();

  try {
    // return test route

    return NextResponse.json({ amount, currency });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}