import { useEffect, useRef, useCallback } from "react";
import dialogStyles from "./Dialog.module.css";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bekräfta",
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Trap focus inside dialog and handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;

    // Save and move focus
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(timer);
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className={dialogStyles.overlay} onClick={onCancel}>
      <div
        ref={dialogRef}
        className={dialogStyles.dialogSm}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={dialogStyles.header}>
          <h3 id="confirm-dialog-title">{title}</h3>
          <button className="btn-icon" onClick={onCancel} type="button" aria-label="Stäng">
            ×
          </button>
        </div>
        <p className={dialogStyles.description}>{message}</p>
        <div className={dialogStyles.actions}>
          <button type="button" className="secondary" onClick={onCancel}>
            Avbryt
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Vänta..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
