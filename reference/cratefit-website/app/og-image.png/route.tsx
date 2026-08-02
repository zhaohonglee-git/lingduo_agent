import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'CrateFit';
  const description = searchParams.get('description') || '3D Bin Packing Made Simple';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1e3a5f 0%, transparent 50%), radial-gradient(circle at 75% 75%, #1e3a5f 0%, transparent 50%)',
        }}
      >
        {/* Logo/Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginRight: 20 }}
          >
            <rect x="3" y="3" width="7" height="7" rx="1" fill="#3b82f6" />
            <rect x="14" y="3" width="7" height="7" rx="1" fill="#10b981" />
            <rect x="3" y="14" width="7" height="7" rx="1" fill="#f59e0b" />
            <rect x="14" y="14" width="7" height="7" rx="1" fill="#3b82f6" opacity="0.6" />
          </svg>
          <span
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            CrateFit
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: 48,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: 800,
            marginTop: 20,
          }}
        >
          {description}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 20,
            color: '#71717a',
          }}
        >
          <span>TypeScript Native</span>
          <span>•</span>
          <span>Real-time 3D</span>
          <span>•</span>
          <span>Multiple Algorithms</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
