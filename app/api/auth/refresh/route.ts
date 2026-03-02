import { NextRequest, NextResponse } from 'next/server';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    const response = await fetch(`${TILED_URL}/api/v1/auth/session/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('[Auth Refresh] Failed:', response.status, error);
      return NextResponse.json(
        { error: error || 'Token refresh failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    );
  }
}
