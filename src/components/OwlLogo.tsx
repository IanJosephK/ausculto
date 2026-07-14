export function OwlLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <path
        d="M64 118 C34 118 20 96 20 66 C20 46 28 32 24 16 C36 26 44 24 64 24 C84 24 92 26 104 16 C100 32 108 46 108 66 C108 96 94 118 64 118 Z"
        className="fill-surface2"
      />
      <circle cx="46" cy="60" r="17" fill="#F5F0E8" />
      <circle cx="82" cy="60" r="17" fill="#F5F0E8" />
      <circle cx="46" cy="60" r="8.5" fill="#B8963E" />
      <circle cx="82" cy="60" r="8.5" fill="#B8963E" />
      <circle cx="46" cy="60" r="3.5" fill="#1C1C1E" />
      <circle cx="82" cy="60" r="3.5" fill="#1C1C1E" />
      <path d="M64 74 L57 83 L64 94 L71 83 Z" fill="#B8963E" />
      <path d="M50 102 Q64 96 78 102" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
