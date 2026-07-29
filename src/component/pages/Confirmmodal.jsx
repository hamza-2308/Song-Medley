import { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

/**
 * ConfirmModal
 * ------------
 * One reusable confirmation dialog for every destructive / important
 * action in the app (delete medley, delete clip, delete song, delete
 * review, finalize, accept-as-final, etc). Replaces window.confirm().
 *
 * PROPS
 * -----
 * isOpen       bool     show/hide
 * onClose      fn       called on Cancel / backdrop click / Escape
 * onConfirm    fn       called when the confirm button is clicked
 * title        string
 * message      string   supports \n for line breaks
 * confirmText  string   default "Confirm"
 * cancelText   string   default "Cancel"
 * variant      "danger" | "success" | "warning" | "info"   default "danger"
 * icon         string   emoji override (falls back to a variant default)
 * isLoading    bool     disables buttons + shows a "Please wait..." label
 *
 * USAGE (already matches MyLibrary.jsx):
 * <ConfirmModal
 *   isOpen={confirmState.isOpen}
 *   onClose={closeConfirm}
 *   onConfirm={confirmState.onConfirm}
 *   title={confirmState.title}
 *   message={confirmState.message}
 *   confirmText={confirmState.confirmText}
 *   variant={confirmState.variant}
 *   icon={confirmState.icon}
 *   isLoading={deleting}
 * />
 */

const VARIANT_STYLES = {
  danger: {
    defaultIcon: "🗑️",
    iconBg: "#FEECEC",
    iconColor: "#DC2626",
    confirmBg: "#DC2626",
    confirmHoverBg: "#B91C1C",
  },
  warning: {
    defaultIcon: "⚠️",
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    confirmBg: "#D97706",
    confirmHoverBg: "#B45309",
  },
  success: {
    defaultIcon: "✅",
    iconBg: "#DCFCE7",
    iconColor: "#15803D",
    confirmBg: "#16A34A",
    confirmHoverBg: "#15803D",
  },
  info: {
    defaultIcon: "ℹ️",
    iconBg: "#EEF2FF",
    iconColor: "#4F46E5",
    confirmBg: "#4F46E5",
    confirmHoverBg: "#4338CA",
  },
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  isLoading = false,
}) {
  const confirmBtnRef = useRef(null);
  const dialogRef = useRef(null);
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.danger;
  const displayIcon = icon || styles.defaultIcon;

  useEffect(() => {
    if (isOpen) confirmBtnRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape" && !isLoading) onClose?.();
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button:not(:disabled)");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="confirm-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose?.();
      }}
    >
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        ref={dialogRef}
      >
        <div
          className="confirm-modal-icon"
          style={{ background: styles.iconBg, color: styles.iconColor }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{displayIcon}</span>
        </div>

        <h2 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h2>
        <p id="confirm-modal-message" className="confirm-modal-message">
          {message}
        </p>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className="confirm-modal-btn confirm-modal-btn-confirm"
            style={{ background: styles.confirmBg }}
            onMouseEnter={(e) => (e.currentTarget.style.background = styles.confirmHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = styles.confirmBg)}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Please wait…" : confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 15, 20, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: cm-fade-in 0.15s ease-out;
          padding: 16px;
        }
        .confirm-modal {
          background: #1a1a1f;
          border: 1px solid #2e2e35;
          border-radius: 14px;
          width: 100%;
          max-width: 380px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          text-align: center;
          animation: cm-pop-in 0.16s ease-out;
        }
        .confirm-modal-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .confirm-modal-title {
          font-size: 17px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #f5f5f7;
        }
        .confirm-modal-message {
          font-size: 14px;
          line-height: 1.5;
          color: #a1a1aa;
          margin: 0 0 20px;
          white-space: pre-line;
        }
        .confirm-modal-actions {
          display: flex;
          gap: 10px;
        }
        .confirm-modal-btn {
          flex: 1;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background 0.12s ease, opacity 0.12s ease;
          color: #fff;
        }
        .confirm-modal-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .confirm-modal-btn-cancel {
          background: #2e2e35;
          color: #e4e4e7;
        }
        .confirm-modal-btn-cancel:hover:not(:disabled) {
          background: #3a3a42;
        }
        @keyframes cm-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cm-pop-in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}