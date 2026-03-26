interface LogoProps {
  width?: number;
  className?: string;
}

export default function Logo({ width = 200, className = "" }: LogoProps) {
  const height = Math.round(width * (160 / 520));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 520 160"
      width={width}
      height={height}
      className={className}
      aria-label="Kentsel Dönüşüm Rehberi"
    >
      <defs>
        <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#1B2E4B" }} />
          <stop offset="100%" style={{ stopColor: "#243a5e" }} />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#C9A84C" }} />
          <stop offset="100%" style={{ stopColor: "#e8c96a" }} />
        </linearGradient>
        <clipPath id="leftHalf">
          <rect x="0" y="0" width="52" height="120" />
        </clipPath>
        <clipPath id="rightHalf">
          <rect x="52" y="0" width="52" height="120" />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="520" height="160" rx="16" fill="url(#navyGrad)" />

      <g clipPath="url(#leftHalf)" transform="translate(22, 20)">
        <rect x="8" y="40" width="36" height="52" rx="2" fill="none" stroke="#C9A84C" strokeWidth="2" strokeDasharray="4 2" />
        <rect x="4" y="34" width="44" height="8" rx="1" fill="none" stroke="#C9A84C" strokeWidth="2" strokeDasharray="4 2" />
        <rect x="14" y="48" width="8" height="8" rx="1" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="3 1" />
        <rect x="30" y="48" width="8" height="8" rx="1" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="3 1" />
        <rect x="14" y="64" width="8" height="8" rx="1" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="3 1" />
        <path d="M26 40 L24 52 L28 58 L25 72" stroke="#C9A84C" strokeWidth="1" fill="none" opacity="0.6" />
      </g>

      <g transform="translate(74, 55)">
        <rect x="0" y="8" width="18" height="4" rx="2" fill="url(#goldGrad)" />
        <polygon points="16,0 28,10 16,20" fill="url(#goldGrad)" />
        <circle cx="8" cy="3" r="2" fill="#C9A84C" opacity="0.7" />
        <circle cx="20" cy="1" r="1.5" fill="#e8c96a" opacity="0.5" />
      </g>

      <g transform="translate(108, 20)">
        <rect x="10" y="10" width="32" height="82" rx="3" fill="url(#goldGrad)" opacity="0.15" />
        <rect x="10" y="10" width="32" height="82" rx="3" fill="none" stroke="#C9A84C" strokeWidth="2" />
        <rect x="0" y="35" width="12" height="57" rx="2" fill="url(#goldGrad)" opacity="0.1" />
        <rect x="0" y="35" width="12" height="57" rx="2" fill="none" stroke="#C9A84C" strokeWidth="1.5" />
        <rect x="16" y="4" width="20" height="8" rx="2" fill="#C9A84C" />
        <rect x="22" y="0" width="8" height="6" rx="1" fill="#C9A84C" />
        <rect x="14" y="18" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="26" y="18" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="14" y="34" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="26" y="34" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="14" y="50" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="26" y="50" width="8" height="10" rx="1" fill="#C9A84C" opacity="0.5" />
        <rect x="20" y="74" width="12" height="18" rx="2" fill="#C9A84C" opacity="0.7" />
        <rect x="2" y="42" width="7" height="7" rx="1" fill="#C9A84C" opacity="0.4" />
        <rect x="2" y="56" width="7" height="7" rx="1" fill="#C9A84C" opacity="0.4" />
      </g>

      <line x1="22" y1="112" x2="170" y2="112" stroke="#C9A84C" strokeWidth="1.5" opacity="0.4" />
      <line x1="185" y1="20" x2="185" y2="140" stroke="#C9A84C" strokeWidth="1.5" opacity="0.5" />

      <text x="200" y="62" fontFamily="Georgia, serif" fontSize="22" fontWeight="700" fill="#FFFFFF" letterSpacing="0.5">Kentsel Dönüşüm</text>
      <text x="200" y="88" fontFamily="Georgia, serif" fontSize="22" fontWeight="700" fill="#C9A84C" letterSpacing="0.5">Rehberi</text>
      <line x1="200" y1="94" x2="355" y2="94" stroke="#C9A84C" strokeWidth="1.5" />
      <text x="200" y="114" fontFamily="Arial, sans-serif" fontSize="10" fill="#a0b0c8" letterSpacing="2">YAPAY ZEKA DESTEKLİ REHBERLİK</text>

      <g transform="translate(200, 124)">
        <path d="M0,0 L8,0 L8,8 L4,12 L0,8 Z" fill="none" stroke="#C9A84C" strokeWidth="1" opacity="0.7" />
        <text x="14" y="9" fontFamily="Arial, sans-serif" fontSize="8" fill="#a0b0c8">kentseldonusumrehber.com.tr</text>
      </g>
    </svg>
  );
}
