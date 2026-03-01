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
          // Debug: Log the token to understand scopes issue
          console.log('[Login] Provider:', prov);
          console.log('[Login] Token response keys:', Object.keys(data));
          if (data.access_token) {
            // Decode JWT to see scopes
            const parts = data.access_token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              console.log('[Login] Token payload:', JSON.stringify(payload, null, 2));
            }
          }
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
