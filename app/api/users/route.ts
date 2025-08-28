import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Return a simple response to stop 404 errors
  return NextResponse.json({ 
    message: "Users API not implemented",
    status: "success"
  }, { status: 200 });
}

export async function POST(req: NextRequest) {
  // Return a simple response to stop 404 errors
  return NextResponse.json({ 
    message: "Users API not implemented",
    status: "success"
  }, { status: 200 });
} 