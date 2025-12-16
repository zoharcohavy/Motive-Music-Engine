/**
 * Compact, collapsible "notice" row.
 * Intended for hiding advanced controls (mouse mode, analyser, etc.) behind a small header.
 */
export default function CollapsibleNotice({
  title,
  subtitle,
  isOpen,
  setIsOpen,
  className = "",
  children,
}) {
  return (
    <section className={`notice ${className}`.trim()} aria-label={title}>
      <button
        type="button"
        className="notice__header"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={!!isOpen}
      >
        <span className="notice__icon" aria-hidden>
          {isOpen ? "▾" : "▸"}
        </span>
        <span className="notice__title">{title}</span>
        {subtitle ? <span className="notice__subtitle">{subtitle}</span> : null}
        <span className="notice__spacer" />
        <span className="notice__hint">{isOpen ? "Hide" : "Show"}</span>
      </button>

      <div
        className="notice__body"
        style={{ display: isOpen ? "block" : "none" }}
      >
        {children}
      </div>

    </section>
  );
}
