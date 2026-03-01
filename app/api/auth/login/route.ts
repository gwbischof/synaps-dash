import { NextRequest, NextResponse } from 'next/server';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

export async function POST(request: NextRequest) {
  try {
    const { username, password, provider } = await request.json();

    // Try the provided provider, or fall back to common ones
    // pam is used at NSLS-II
    const providers = provider ? [provider] : ['pam', 'ldap', 'toy', 'password'];

    let lastError: string | null = null;

    for (const prov of providers) {
      try {
        const response = await fetch(`${TILED_URL}/api/v1/auth/provider/${prov}/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'password',
            username,
            password,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }

        lastError = await response.text();
      } catch {
        lastError = `Provider ${prov} not available`;
      }
    }

    return NextResponse.json(
      { error: lastError || 'Authentication failed' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 }
    );
  }
}
