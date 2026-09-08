/** Geometric git-graph mark — not Octocat. */
export default function Mark({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="mark-svg"
    >
      <rect width="64" height="64" rx="14" fill="#1f883d" />
      <circle cx="22" cy="18" r="5" fill="#fff" />
      <circle cx="22" cy="32" r="5" fill="#fff" />
      <circle cx="22" cy="46" r="5" fill="#fff" />
      <circle cx="42" cy="32" r="5" fill="#fff" />
      <path
        d="M22 23v4M22 37v4M27 32h10"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
