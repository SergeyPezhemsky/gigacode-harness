export function StatusChip({ tone = "neutral", label, value }) {
  return (
    <span className={`status-chip ${tone}`}>
      <span className="status-chip-dot" />
      <span>{label}</span>
      {value ? <strong>{value}</strong> : null}
    </span>
  );
}
