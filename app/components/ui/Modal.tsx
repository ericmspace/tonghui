import { useEffect } from "react";
import { cx } from "~/lib/cx";

export function Modal({
  open,
  onClose,
  children,
  className,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
      />
      <div
        className={cx(
          "relative glass-strong rounded-4xl p-7 w-full max-w-md animate-pop-in",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && <h3 className="text-xl font-bold text-ink mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
