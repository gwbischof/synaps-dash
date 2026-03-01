import { NextRequest, NextResponse } from 'next/server';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const tiledPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${TILED_URL}/api/v1/${tiledPath}${searchParams ? `?${searchParams}` : ''}`;

    const authHeader = request.headers.get('Authorization');

    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(url, { headers });

    // Get the content type to handle different response types
    const contentType = response.headers.get('Content-Type') || '';

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || `Request failed: ${response.status}` },
        { status: response.status }
      );
    }

    // Handle binary responses (images)
    if (contentType.startsWith('image/')) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    // Handle JSON responses
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // Handle SVG
    if (contentType.includes('svg')) {
      const text = await response.text();
      return new NextResponse(text, {
        headers: {
          'Content-Type': contentType,
        },
      });
    }

    // Default: return as text
    const text = await response.text();
    return new NextResponse(text, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Tiled proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}
