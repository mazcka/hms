const COLORS = ["#1d4e89", "#0f6e56", "#8a3d12", "#6d28d9", "#9f2d2d"];

export function MemberMark({ name }: { name: string }) {
  const letter = name.trim().charAt(0) || "?";
  const color = COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="member-mark" style={{ background: color }} title={name} aria-label={name}>
      {letter}
    </span>
  );
}
