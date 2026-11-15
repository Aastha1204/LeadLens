export function NeoviaLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} role="img" aria-label="Neovia AI">
      <rect width="32" height="32" rx="9" fill="var(--neovia-primary)" />
      <path d="M9 23V9l14 14V9" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="25" cy="8" r="3" fill="var(--neovia-accent)" />
      <text x="40" y="21.5" fontSize="15" fontWeight="700" fill="currentColor" fontFamily="inherit">Neovia AI</text>
    </svg>
  );
}

export function UrbanNestLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 32" className={className} role="img" aria-label="Urban Nest Interiors">
      <path d="M3 15 16 3l13 12v14H3z" fill="var(--client-sand)" stroke="var(--client-primary)" strokeWidth="2" strokeLinejoin="round" />
      <text x="16" y="25" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--client-primary)" fontFamily="inherit">UN</text>
      <text x="38" y="21.5" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="inherit">Urban Nest</text>
    </svg>
  );
}
