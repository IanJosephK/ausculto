import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const SkipBackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8V3.5M4 8h4.5M4 8c1.8-3 5-4.5 8.3-4.4A9 9 0 1 1 3 12.5" />
    <text x="12" y="16.5" fontSize="8.5" fontFamily="inherit" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="bold">
      15
    </text>
  </Icon>
);

export const SkipForwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 8V3.5M20 8h-4.5M20 8c-1.8-3-5-4.5-8.3-4.4A9 9 0 1 0 21 12.5" />
    <text x="12" y="16.5" fontSize="8.5" fontFamily="inherit" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="bold">
      15
    </text>
  </Icon>
);

export const PrevIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 5v14" />
    <path d="M18 6.5v11L9.5 12z" fill="currentColor" stroke="none" />
  </Icon>
);

export const NextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 5v14" />
    <path d="M6 6.5v11l8.5-5.5z" fill="currentColor" stroke="none" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </Icon>
);

export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path d="M6.5 4h11a.5.5 0 0 1 .5.5V20l-6-4-6 4V4.5a.5.5 0 0 1 .5-.5z" fill={filled ? 'currentColor' : 'none'} />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="0.8" fill="currentColor" />
    <circle cx="4.5" cy="12" r="0.8" fill="currentColor" />
    <circle cx="4.5" cy="18" r="0.8" fill="currentColor" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5" />
    <path d="M4 18.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="m13.5 7.5 3 3" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13" />
  </Icon>
);

export const QuoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path
      d="M5 16c-1 0-1.8-.9-1.8-2.2 0-3.3 2-6.3 4.8-7.3l.7 1.3c-1.8.9-3 2.6-3.2 4.2.2-.1.5-.2.9-.2 1.3 0 2.3 1 2.3 2.1S6.5 16 5 16zm9 0c-1 0-1.8-.9-1.8-2.2 0-3.3 2-6.3 4.8-7.3l.7 1.3c-1.8.9-3 2.6-3.2 4.2.2-.1.5-.2.9-.2 1.3 0 2.3 1 2.3 2.1S15.5 16 14 16z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);

export const SpinnerIcon = (p: IconProps) => (
  <Icon {...p} className={`animate-spin ${p.className ?? ''}`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
);
