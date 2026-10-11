'use client';

/**
 * LoadingState.tsx — Loading indicator during the assessment API call.
 * One responsibility: show honest, active progress feedback.
 * See Architecture v1.1 Section 6 — owns elapsed time state.
 *
 * Honesty note:
 * The assessment is a single Bedrock call with no intermediate milestones
 * the frontend can observe. This component therefore makes NO claim that any
 * step has "completed." It shows an indeterminate progress bar, an elapsed
 * timer, and rotating present-tense status messages that describe the kind of
 * work in progress without asserting a verified backend stage.
 *
 * Features:
 * - Rotating status messages (~8s each), present-tense, never "done"
 * - Elapsed-time counter (visual only; not announced per-second)
 * - Indeterminate shimmer bar (no fake percentage, no completion dots)
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

export default function LoadingState() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Elapsed counter — ticks every second (visual only)
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Message rotation — every 8 seconds; holds on the final message
    messageRef.current = setInterval(() => {
      setMessageIndex((prev) => {
        if (prev >= MESSAGES.length - 1) return MESSAGES.length - 1;
        return prev + 1;
      });
    }, MESSAGE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (messageRef.current) clearInterval(messageRef.current);
    };
  }, []);

  return (
    <div className="loading" aria-busy="true">
      {/*
        Single polite live region. The rotating message is the status source,
        so a screen reader hears each new honest status (~every 8s) and nothing
        more. The elapsed timer below is deliberately excluded from the live
        region to avoid per-second announcement spam.
      */}
      <p className="loading__title" role="status" aria-live="polite">
        {MESSAGES[messageIndex]}
      </p>
      <p className="loading__sub">
        Reviewing your workflow against court-approved readiness rules.
      </p>
      <div
        className="loading__bar"
        role="progressbar"
        aria-label="Assessment in progress"
        aria-valuetext="Assessment in progress"
      />
      {/*
        Elapsed time is visual reassurance only. aria-hidden so assistive tech
        is not handed a number that would otherwise read as stale (the live
        region is not watching it).
      */}
      <p className="loading__elapsed" aria-hidden="true">
        {formatElapsed(elapsed)}
      </p>
    </div>
  );
}
