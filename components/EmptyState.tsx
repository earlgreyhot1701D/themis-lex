/**
 * EmptyState.tsx — Default state before assessment runs.
 * One responsibility: show placeholder content.
 * See Architecture v1.1 Section 6 — pure display, no state.
 */

export default function EmptyState() {
  return (
    <div className="empty">
      <p className="empty__title">Your assessment will appear here.</p>
      <p className="empty__sub">
        Two columns — what AI can help with, and what it must not touch —
        populated once you submit the form above.
      </p>
    </div>
  );
}
