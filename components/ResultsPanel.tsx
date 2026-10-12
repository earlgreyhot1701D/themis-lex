'use client';

/**
 * ResultsPanel.tsx — Two-column output renderer.
 * One responsibility: render the can_help and must_not_touch columns.
 * See Architecture v1.1 Section 6 — receives results as props, no state.
 * Design matches the locked HTML reference.
 */

import { useState, useCallback, useRef } from 'react';
import type { AssessmentResponse } from '@/lib/validate';
import WorkflowCard from '@/components/WorkflowCard';

// STUB V2: Shareable link / unique URL per assessment
// Implementation notes: requires database (DynamoDB), unique ID generation,
// URL scheme /assessment/[id], read-only public view
// Do not build until user data storage policy is defined

interface ResultsPanelProps {
  results: AssessmentResponse;
  roleLabel: string;
  sensitivityLabel: string;
  onStartOver: () => void;
}

export default function ResultsPanel({
  results,
  roleLabel,
  sensitivityLabel,
  onStartOver,
}: ResultsPanelProps) {
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const retryGuardRef = useRef(false);

  const handleDownload = useCallback(async () => {
    // Retry guard — prevent rapid-fire requests (1.5 second cooldown)
    if (retryGuardRef.current || pdfLoading) return;
    retryGuardRef.current = true;
    setTimeout(() => { retryGuardRef.current = false; }, 1500);

    setPdfError('');
    setPdfLoading(true);

    try {
      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_label: roleLabel,
          sensitivity_label: sensitivityLabel,
          timestamp: new Date().toISOString(),
          can_help: results.can_help,
          must_not_touch: results.must_not_touch,
        }),
      });

      if (!response.ok) {
        let msg =
          "We weren't able to generate your PDF report. Please try again. If the issue continues, you can take a screenshot of your results as a temporary alternative.";
        try {
          const errJson = await response.json();
          if (errJson.message) msg = errJson.message;
        } catch {
          // Use default message
        }
        setPdfError(msg);
        setPdfLoading(false);
        return;
      }

      // Download the PDF blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'themis-lex-assessment.pdf';
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfLoading(false);
      // Track successful PDF download
      try { fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'pdf_downloaded' }) }).catch(() => {}); } catch {}
    } catch {
      setPdfError(
        "We weren't able to generate your PDF report. Please try again. If the issue continues, you can take a screenshot of your results as a temporary alternative."
      );
      setPdfLoading(false);
      // Track PDF error
      try { fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'pdf_error' }) }).catch(() => {}); } catch {}
    }
  }, [roleLabel, sensitivityLabel, results, pdfLoading]);

  return (
    <>
      {/* Compact top download trigger — convenience entry point placed above
          the results so the primary next action is discoverable without
          scrolling. Reuses the same handler/state as the bottom action bar;
          no duplicated logic or state. */}
      <div className="results-actions">
        <button
          className="btn-download"
          aria-label="Download your AI readiness assessment as a PDF"
          onClick={handleDownload}
          disabled={pdfLoading}
        >
          <span className="pdf-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 2h8l4 4v12H4V2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
              <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 9v6M7 12l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
              />
            </svg>
          </span>
          {pdfLoading ? 'Generating PDF…' : 'Download PDF Report'}
        </button>
        {/* Single source of truth for PDF error feedback. role="alert" makes a
            failure from EITHER button discoverable immediately (announced +
            visible at the top) without scrolling to the action bar. Rendered
            once in the DOM — no duplicate node, no duplicate announcement. */}
        {pdfError && (
          <p className="results-actions__error" role="alert">
            {pdfError}
          </p>
        )}
      </div>

      {/* Boundary grid: two equal-width domains separated by a central rule
          (desktop) / thin labeled divider (mobile). The findings render once;
          the boundary element is a single CSS-styled node reused at both
          breakpoints. Each domain is a labelled landmark so the distinction is
          carried by real headings, not by the decorative rule. */}
      <div className="boundary-grid">
        {/* Domain A: Where AI Can Help */}
        <section
          className="boundary-domain boundary-domain--help"
          aria-labelledby="domain-a-head"
        >
          <div className="boundary-domain__head boundary-domain__head--help">
            <span className="col-icon col-icon--sage" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 16V5M10 5l-5 5M10 5l5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="square"
                />
              </svg>
            </span>
            <h3 id="domain-a-head">
              <span className="boundary-domain__index" aria-hidden="true">A</span>
              Where AI Can Help You
            </h3>
            <span className="col-head__count">
              {results.can_help.length} workflow
              {results.can_help.length !== 1 ? 's' : ''}
            </span>
          </div>
          {results.can_help.map((item, i) => (
            <WorkflowCard
              key={i}
              variant="help"
              item={item}
              indexLabel={`A${i + 1}`}
            />
          ))}
        </section>

        {/* The boundary — decorative; meaning lives in the domain headings. */}
        <div className="boundary-rule" aria-hidden="true">
          <span className="boundary-rule__label">The Boundary</span>
        </div>

        {/* Domain B: Where AI Must Not Touch */}
        <section
          className="boundary-domain boundary-domain--notouch"
          aria-labelledby="domain-b-head"
        >
          <div className="boundary-domain__head boundary-domain__head--notouch">
            <span className="col-icon col-icon--terra" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 3l6 2v5c0 3.5-2.5 6-6 7-3.5-1-6-3.5-6-7V5l6-2z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="miter"
                  fill="none"
                />
                <path
                  d="M8 10l1.5 1.5L13 8.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="square"
                />
              </svg>
            </span>
            <h3 id="domain-b-head">
              <span className="boundary-domain__index" aria-hidden="true">B</span>
              Where AI Must Not Touch
            </h3>
            <span className="col-head__count">
              {results.must_not_touch.length} workflow
              {results.must_not_touch.length !== 1 ? 's' : ''}
            </span>
          </div>
          {results.must_not_touch.map((item, i) => (
            <WorkflowCard
              key={i}
              variant="notouch"
              item={item}
              indexLabel={`B${i + 1}`}
            />
          ))}
        </section>
      </div>

      {/* Action bar — PDF download */}
      <div className="action-bar">
        <button
          className="btn-outline"
          aria-label="Download your AI readiness assessment as a PDF"
          onClick={handleDownload}
          disabled={pdfLoading}
        >
          <span className="pdf-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 2h8l4 4v12H4V2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
              <path
                d="M12 2v4h4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10 9v6M7 12l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
              />
            </svg>
          </span>
          {pdfLoading ? 'Generating PDF…' : 'Download PDF Report'}
        </button>
        <p className="action-disclaimer">
          This assessment is advisory. It does not replace supervisory review,
          court IT policy, or the Judicial Council&#39;s forthcoming AI
          guidance. Print a copy for your supervisor before implementing any
          recommendation.
        </p>
        <div className="action-bar__secondary">
          <button
            type="button"
            className="btn-ghost"
            onClick={onStartOver}
            aria-label="Clear this assessment and start over with a new workflow"
          >
            Start over
          </button>
        </div>
      </div>
    </>
  );
}
