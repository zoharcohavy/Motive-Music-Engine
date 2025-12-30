import { useEffect } from "react";

/**
 * Lightweight app modal using existing fxModal styling.
 * - Click outside to close (default)
 * - Optional Enter/Escape handling
 */
export default function AppModal({
  isOpen,
  title,
  onClose,
  onEnter,
  closeOnOverlay = true,
  children,
  footer,
  panelClassName = "",
}) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter") onEnter?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, onEnter]);

  if (!isOpen) return null;

  return (
    <div
      className="fxModal__overlay"
      onMouseDown={() => {
        if (closeOnOverlay) onClose?.();
      }}
      role="presentation"
    >
      <div
        className={`fxModal__panel ${panelClassName}`.trim()}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
      >
        {(title || onClose) && (
          <div className="fxModal__header">
            <h2 className="fxModal__title">{title}</h2>
            {onClose && (
              <button className="fxModal__close" onClick={onClose} type="button">
                ✕
              </button>
            )}
          </div>
        )}

        <div className="fxModal__body">{children}</div>

        {footer ? <div className="fxModal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
