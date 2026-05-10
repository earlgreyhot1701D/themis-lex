'use client';

/**
 * AssessmentForm.tsx — Role selector, workflow textarea, sensitivity pills.
 * One responsibility: collect user inputs and fire submit.
 * See Architecture v1.1 Section 6 for component contract.
 * Design matches the locked HTML reference (themis-lex-v1.html).
 */

import { useState, useCallback, useRef, KeyboardEvent } from 'react';

export interface FormData {
  role: string;
  workflow: string;
  sensitivity: string;
}

interface AssessmentFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

const MIN_CHARS = 120;
const MAX_CHARS = 3000;
const WARN_THRESHOLD = 2500;

const ACTIVE_ROLES = [
  { value: 'ja1_2', label: 'Judicial Assistant I / II' },
  { value: 'ja3_courtroom', label: 'Judicial Assistant III Courtroom' },
  { value: 'jss', label: 'Judicial Services Supervisor / Sr.' },
];

const DISABLED_ROLES = [
  'Courtroom Clerk',
  'Deputy Clerk',
  'Research Attorney',
  'Family Law Facilitator',
  'Self-Help Center Staff',
  'Court Administrator',
];

// STUB V2: Additional role classifications
// Courtroom Clerk, Deputy Clerk, Research Attorney, Family Law Facilitator,
// Self-Help Center Staff, Court Administrator
// Do not build until job description PDFs are extracted and role_context.json updated

const SENSITIVITY_OPTIONS = [
  { value: 'low', label: 'Low', sub: 'Public filings, scheduling' },
  { value: 'medium', label: 'Medium', sub: 'Internal, non-sealed' },
  { value: 'high', label: 'High', sub: 'Sealed · minors · PII' },
];

const PLACEHOLDER_TEXT =
  'Describe the task in your own words. Example: I review family law petitions for procedural completeness before they go to the judge, flagging missing exhibits and inconsistent dates.';

export default function AssessmentForm({
  onSubmit,
  isLoading,
}: AssessmentFormProps) {
  const [role, setRole] = useState('ja1_2');
  const [workflow, setWorkflow] = useState('');
  const [sensitivity, setSensitivity] = useState('high');
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const charCount = workflow.length;
  const isMet = charCount >= MIN_CHARS;
  const isApproachingMax = charCount >= WARN_THRESHOLD;
  const canSubmit = isMet && !isLoading;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit({ role, workflow, sensitivity });
    },
    [canSubmit, role, workflow, sensitivity, onSubmit]
  );

  const handlePillKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (index + 1) % SENSITIVITY_OPTIONS.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex =
          (index - 1 + SENSITIVITY_OPTIONS.length) %
          SENSITIVITY_OPTIONS.length;
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setSensitivity(SENSITIVITY_OPTIONS[index].value);
        return;
      } else {
        return;
      }
      setSensitivity(SENSITIVITY_OPTIONS[nextIndex].value);
      pillRefs.current[nextIndex]?.focus();
    },
    []
  );

  return (
    <section className="wrap form-section" aria-labelledby="form-title">
      <div className="form-section__head">
        <div>
          <div className="section-label">
            <span className="section-label__num">01</span>
            <span className="section-label__text">Your Workflow</span>
          </div>
          <h2 id="form-title" className="form-section__title">
            Tell us what you do.
          </h2>
        </div>
        <p className="form-section__copy">
          Three short inputs. Nothing you enter is stored or used to train any
          model. We count completed assessments to improve the tool — no
          identifying information is collected.
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        {/* Role selector */}
        <div className="field">
          <label className="label" htmlFor="role">
            Your Role <span className="label-req">Required</span>
          </label>
          <div className="select">
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading}
              aria-describedby="role-hint"
            >
              <optgroup label="Phase 1 — Active">
                {ACTIVE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Coming Soon">
                {DISABLED_ROLES.map((r) => (
                  <option key={r} disabled>
                    {r} — Role context pending
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <p className="hint" id="role-hint">
            Used only to calibrate guidance — not recorded.
          </p>
        </div>

        {/* Workflow textarea */}
        <div className="field">
          <label className="label" htmlFor="workflow">
            Workflow Description <span className="label-req">Required</span>
          </label>
          <div className="textarea-wrap">
            <textarea
              id="workflow"
              name="workflow"
              placeholder={PLACEHOLDER_TEXT}
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              disabled={isLoading}
              aria-describedby="workflow-counter"
              minLength={MIN_CHARS}
              maxLength={MAX_CHARS}
            />
          </div>
          <div className="counter" id="workflow-counter" aria-live="polite">
            {charCount < MIN_CHARS && (
              <>
                <span className="counter__min">
                  Minimum {MIN_CHARS} characters for a meaningful assessment.
                </span>
                <span className="counter__count">
                  {charCount} / {MIN_CHARS}
                </span>
              </>
            )}
            {charCount >= MIN_CHARS && charCount < WARN_THRESHOLD && (
              <>
                <span className="counter__min" />
                <span
                  className="counter__count"
                  style={{ color: 'var(--sage-deep)' }}
                >
                  {charCount}
                </span>
              </>
            )}
            {charCount >= WARN_THRESHOLD && (
              <>
                <span
                  className="counter__min"
                  style={{ color: 'var(--terra-deep)' }}
                >
                  Approaching maximum length. Keep it short and specific for the
                  best results.
                </span>
                <span
                  className="counter__count"
                  style={{ color: 'var(--terra-deep)' }}
                >
                  {charCount} / {MAX_CHARS}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Sensitivity pills */}
        <fieldset
          className="field"
          style={{ border: 0, padding: 0, margin: '0 0 var(--s5) 0' }}
        >
          <legend className="label" style={{ padding: 0 }}>
            Data Sensitivity <span className="label-req">Required</span>
          </legend>
          <div
            className="pill-group"
            role="radiogroup"
            aria-label="Data sensitivity level"
          >
            {SENSITIVITY_OPTIONS.map((opt, i) => {
              const isSelected = sensitivity === opt.value;
              return (
                <button
                  key={opt.value}
                  ref={(el) => { pillRefs.current[i] = el; }}
                  type="button"
                  className="pill"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  disabled={isLoading}
                  onClick={() => setSensitivity(opt.value)}
                  onKeyDown={(e) => handlePillKeyDown(e, i)}
                >
                  <span className="pill__label">{opt.label}</span>
                  <span className="pill__sub">{opt.sub}</span>
                </button>
              );
            })}
          </div>
          <p className="hint" id="sens-hint">
            Arrow keys navigate · Space selects. When in doubt, choose the
            higher level.
          </p>
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          className={`btn-primary${isLoading ? ' is-loading' : ''}`}
          aria-disabled={!canSubmit}
          disabled={isLoading}
        >
          <span className="btn-label">
            {isLoading ? 'Running Assessment…' : 'Run My Assessment'}
          </span>
          {!isLoading && (
            <span className="arrow-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </span>
          )}
          {isLoading && <span className="spinner" aria-hidden="true" />}
        </button>
        {!canSubmit && !isLoading && (
          <p className="disabled-helper" style={{ display: 'block' }}>
            Add a workflow description of at least {MIN_CHARS} characters to
            enable the assessment.
          </p>
        )}
      </form>
    </section>
  );
}
