'use client';

/**
 * Themis Lex — Single page application.
 * Orchestrates all state, passes props to child components.
 * See Architecture v1.1 Section 6 for the state machine:
 *   'default' → form visible, empty state shown
 *   'loading' → form disabled, loading state shown
 *   'results' → form visible, results shown, PDF button visible
 *   'error'   → form visible, error state shown
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import AssessmentForm, { FormData } from '@/components/AssessmentForm';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import ResultsPanel from '@/components/ResultsPanel';
import type { AssessmentResponse } from '@/lib/validate';

// Version: also in package.json and .env.example — update all three when bumping
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.4';

type AppState = 'default' | 'loading' | 'results' | 'error';

/**
 * Fire-and-forget analytics event. Never blocks UI. Never throws.
 */
function trackEvent(event: string, meta?: Record<string, unknown>) {
  try {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...meta }),
    }).catch(() => { /* silent — analytics should never break the app */ });
  } catch {
    /* silent */
  }
}

const ROLE_LABELS: Record<string, string> = {
  ja1_2: 'Judicial Assistant I / II',
  ja3_courtroom: 'Judicial Assistant III Courtroom',
  jss: 'Judicial Services Supervisor / Sr.',
};

export default function Home() {
  const [appState, setAppState] = useState<AppState>('default');
  const [results, setResults] = useState<AssessmentResponse | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [formResetKey, setFormResetKey] = useState(0);
  const formSectionRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (data: FormData) => {
    setFormData(data);
    setAppState('loading');
    setErrorMessage('');
    const startTime = Date.now();

    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      let json;
      try {
        json = await response.json();
      } catch {
        setErrorMessage(
          "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor."
        );
        setAppState('error');
        trackEvent('assessment_error', { role: data.role, sensitivity: data.sensitivity });
        return;
      }

      if (!response.ok || json.error) {
        setErrorMessage(
          json.message ||
            "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor."
        );
        setAppState('error');
        trackEvent('assessment_error', { role: data.role, sensitivity: data.sensitivity });
        return;
      }

      setResults(json);
      setAppState('results');
      trackEvent('assessment_completed', {
        role: data.role,
        sensitivity: data.sensitivity,
        duration_ms: Date.now() - startTime,
      });
    } catch {
      setErrorMessage(
        "We weren't able to complete your assessment. Please try again. If the issue continues, contact your supervisor."
      );
      setAppState('error');
      trackEvent('assessment_error', { role: data.role, sensitivity: data.sensitivity });
    }
  }, []);

  const roleLabel = formData ? (ROLE_LABELS[formData.role] || formData.role) : '';
  const sensitivityLabel = formData
    ? formData.sensitivity.charAt(0).toUpperCase() + formData.sensitivity.slice(1)
    : '';

  const handleStartOver = useCallback(() => {
    setAppState('default');
    setResults(null);
    setFormData(null);
    setErrorMessage('');
    setFormResetKey((k) => k + 1);
    trackEvent('start_over');
    // Scroll to the top of the form section
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  // beforeunload warning during loading state only
  useEffect(() => {
    if (appState !== 'loading') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [appState]);

  return (
    <div className="page">
      {/* Header */}
      <header className="site-header">
        <div className="wrap site-header__inner">
          <span className="wordmark" aria-label="Themis Lex">
            THEMIS&nbsp;LEX
          </span>
          <span className="site-header__desc">
            AI Readiness for California Court Staff
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="wrap hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <div className="hero__text">
            <div className="hero__eyebrow">
              A Self-Check Tool · Beta Release · Spring 2026
            </div>
            <h1 id="hero-title" className="hero__title">
              Know where AI helps.
              <br />
              Know where it <em>must not</em>.
            </h1>
            <p className="hero__lede">
              Themis Lex is a plain-language readiness check for California Superior
              Court staff. Describe a workflow in your own words and receive a
              considered review — what AI can safely assist with today, and what
              stays firmly in human hands.
            </p>
          </div>
          <div className="hero__mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/themis-lex-hero.png"
              alt="Themis Lex — scales of justice with circuit board motif"
              className="hero__mark-img"
            />
          </div>
        </div>
        <div className="hero__rule" role="presentation" />
      </section>

      {/* Form */}
      <div ref={formSectionRef}>
        <AssessmentForm
          key={formResetKey}
          onSubmit={handleSubmit}
          isLoading={appState === 'loading'}
        />
      </div>

      {/* Results section */}
      <section
        className="wrap results-section"
        id="results"
        aria-labelledby="results-title"
      >
        <div className="results-head">
          <div>
            <div className="section-label">
              <span className="section-label__num">02</span>
              <span className="section-label__text">Your Assessment</span>
            </div>
            <h2 id="results-title">A considered reading.</h2>
          </div>
          {appState !== 'default' && formData && (
            <div className="context-chip-row">
              <span className="context-chip">
                <span>Role</span>
                <strong>{roleLabel}</strong>
              </span>
              <span className="context-chip context-chip--sens">
                <span>Data Sensitivity</span>
                <strong>{sensitivityLabel}</strong>
              </span>
              <span className="context-chip">
                <span>Generated</span>
                <strong>
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </span>
            </div>
          )}
        </div>

        {appState === 'default' && <EmptyState />}
        {appState === 'loading' && <LoadingState />}
        {appState === 'error' && <ErrorState message={errorMessage} onStartOver={handleStartOver} />}
        {appState === 'results' && results && (
          <ResultsPanel
            results={results}
            roleLabel={roleLabel}
            sensitivityLabel={sensitivityLabel}
            onStartOver={handleStartOver}
          />
        )}
      </section>

      {/* Footer */}
      <footer className="wrap site-footer">
        <span className="footer-wm">THEMIS&nbsp;LEX</span>
        <span className="footer-center">
          Built for California Superior Court Staff
        </span>
        <span className="footer-right">v{APP_VERSION} · Beta · Spring 2026</span>
      </footer>
    </div>
  );
}
