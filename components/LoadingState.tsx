'use client';

/**
 * LoadingState.tsx — Loading indicator during API call.
 * One responsibility: show active progress feedback.
 * See Architecture v1.1 Section 6 — owns elapsed time state.
 * Design matches the locked HTML reference with enhanced UX for long calls.
 *
 * Features:
 * - Rotating progress messages every 7-8 seconds
 * - Elapsed-time counter (charcoal on cream, smaller than message)
 * - Progress dots tied loosely to elapsed time (0-10s, 10-20s, 20-30s, 30s+)
 * - No fake percentage bar. Animations must actually animate.
 */

import { useState, useEffect, useRef } from 'react';

const MESSAGES = [
  'Reading your workflow…',
  'Applying judicial branch governance principles…',
  'Calibrating to your role and data sensitivity level…',
  'Drafting your assessment…',
  'Almost there. Court guidance is worth waiting for…',
];

const MESSAGE_INTERVAL = 8000; // 8 seconds per message

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Returns which dot index (0-3) should be active based on elapsed seconds.
 * Dot 0: 0-10s, Dot 1: 10-20s, Dot 2: 20-30s, Dot 3: 30s+
 */
function getActiveDot(seconds: number): number {
  if (seconds < 10) return 0;
  if (seconds < 20) return 1;
  if (seconds < 30) return 2;
  return 3;
}

export default function LoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Elapsed counter — ticks every second
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Message rotation — every 8 seconds
    messageRef.current = setInterval(() => {
      setMessageIndex((prev) => {
        // Cycle last message if we've gone through all
        if (prev >= MESSAGES.length - 1) return MESSAGES.length - 1;
        return prev + 1;
      });
    }, MESSAGE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (messageRef.current) clearInterval(messageRef.current);
    };
  }, []);

  const activeDot = getActiveDot(elapsed);

  const steps = [
    { label: 'Role context', index: 0 },
    { label: 'Workflow parsing', index: 1 },
    { label: 'Data sensitivity match', index: 2 },
    { label: 'Guidance draft', index: 3 },
  ];

  return (
    <div className="loading">
      <p className="loading__title">{MESSAGES[messageIndex]}</p>
      <p className="loading__sub">
        Reviewing your workflow against court-approved readiness rules.
      </p>
      <div
        className="loading__bar"
        role="progressbar"
        aria-label="Assessment running"
        aria-valuetext="Running"
      />
      <p className="loading__elapsed" aria-live="off">
        {formatElapsed(elapsed)}
      </p>
      <div className="loading__steps">
        {steps.map((step) => {
          const isDone = step.index < activeDot;
          const isActive = step.index === activeDot;
          const className = `loading__step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}`;
          return (
            <div key={step.label} className={className}>
              <span className="loading__dot" />
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
