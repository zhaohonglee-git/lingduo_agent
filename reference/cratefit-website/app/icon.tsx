import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          borderRadius: 6,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
        >
          <rect x="2" y="2" width="9" height="9" rx="1" fill="white" />
          <rect x="13" y="2" width="9" height="9" rx="1" fill="white" opacity="0.7" />
          <rect x="2" y="13" width="9" height="9" rx="1" fill="white" opacity="0.7" />
          <rect x="13" y="13" width="9" height="9" rx="1" fill="white" opacity="0.4" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
