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
  if (!open) return null;

  return (
    <div className={dialogStyles.overlay} onClick={onCancel}>
      <div className={dialogStyles.dialogSm} onClick={(e) => e.stopPropagation()}>
        <div className={dialogStyles.header}>
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onCancel} type="button">
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
