/**
 * ErrorState.tsx — Error display with user-facing copy.
 * One responsibility: show meaningful error, never a blank screen.
 * See Architecture v1.1 Section 6 — pure display, no state.
 */

interface ErrorStateProps {
  message: string;
  onStartOver: () => void;
}

export default function ErrorState({ message, onStartOver }: ErrorStateProps) {
  return (
    <div className="error-state">
      <p className="error-state__title">
        Something didn&#39;t work as expected.
      </p>
      <p className="error-state__sub">{message}</p>
      <button
        type="button"
        className="btn-ghost"
        onClick={onStartOver}
      >
        Start over
      </button>
    </div>
  );
}
