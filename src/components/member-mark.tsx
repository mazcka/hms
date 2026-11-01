const COLORS = ["#1f6b4a", "#3d6b8c", "#8a3d12", "#4a2d8a", "#a33b32"];

export function MemberMark({ name }: { name: string }) {
  const letter = name.trim().charAt(0) || "?";
  const color = COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className="member-mark" style={{ background: color }} title={name} aria-label={name}>
      {letter}
    </span>
  );
}
