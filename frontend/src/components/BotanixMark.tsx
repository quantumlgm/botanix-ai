interface BotanixMarkProps {
  className?: string;
}

export function BotanixMark({ className }: BotanixMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 27.5V16.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.6 20.2C10.3 20.2 6.8 16.2 6.8 10.6C12.1 10.6 15.6 14.6 15.6 20.2Z"
        fill="currentColor"
      />
      <path
        d="M16.4 17.1C16.4 11.5 20 7.5 25.6 7.5C25.6 13.1 22 17.1 16.4 17.1Z"
        fill="currentColor"
        opacity="0.62"
      />
      <path
        d="M11.2 13.5C12.2 15.4 13.6 17.2 15.4 18.6M21.3 10.7C19.8 12.9 18.2 14.5 16.3 15.8"
        stroke="var(--canvas)"
        strokeOpacity="0.55"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
