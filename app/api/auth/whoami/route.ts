import { NextRequest, NextResponse } from 'next/server';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const response = await fetch(`${TILED_URL}/api/v1/auth/whoami`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get user' },
      { status: 500 }
    );
  }
}
