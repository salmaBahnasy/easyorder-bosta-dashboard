import "./FeedbackModal.css";

function SuccessIcon() {
  return (
    <svg
      className="feedback-modal__icon feedback-modal__icon--success"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.12" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M20 33.5 28.5 42 44 24.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="feedback-modal__icon feedback-modal__icon--error"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.12" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M24 24 40 40M40 24 24 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function FeedbackModal({
  open = false,
  variant = "success",
  message = "",
  title,
  confirmLabel = "حسناً",
  onClose,
}) {
  if (!open) return null;

  const isSuccess = variant === "success";
  const resolvedTitle = title ?? (isSuccess ? "تم بنجاح" : "حدث خطأ");

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="feedback-modal__backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className={`feedback-modal feedback-modal--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        aria-describedby="feedback-modal-message"
      >
        {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
        <h3 id="feedback-modal-title" className="feedback-modal__title">
          {resolvedTitle}
        </h3>
        {message ? (
          <p id="feedback-modal-message" className="feedback-modal__message">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className="feedback-modal__btn"
          onClick={() => onClose?.()}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
