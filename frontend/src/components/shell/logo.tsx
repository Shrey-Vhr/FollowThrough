export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <rect width="22" height="22" rx="6" fill="#7C6CFF" />
        <path
          d="M6 11.5l3.2 3.2L16 7.5"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">FollowThrough</span>
    </div>
  );
}
