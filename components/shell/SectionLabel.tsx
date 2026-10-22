export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`section-label ${className}`}>{children}</div>;
}
