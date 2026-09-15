/** Four-dot formation. Not Octocat. Not GitHub green. */
export default function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="mark-svg"
    >
      <rect width="64" height="64" rx="16" fill="#1c1916" />
      <path
        d="M32 18 L46 32 L32 46 L18 32 Z"
        fill="none"
        stroke="#e08a3c"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="18" r="4.2" fill="#f3efe8" />
      <circle cx="46" cy="32" r="4.2" fill="#e08a3c" />
      <circle cx="32" cy="46" r="4.2" fill="#f3efe8" />
      <circle cx="18" cy="32" r="4.2" fill="#f3efe8" />
    </svg>
  );
}
