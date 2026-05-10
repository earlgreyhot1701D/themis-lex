/**
 * WorkflowCard.tsx — Individual card component (help + notouch variants).
 * One responsibility: render one workflow card.
 * See Architecture v1.1 Section 6 — pure display, no state.
 *
 * For can_help: renders workflow_name, description, why_safe, guardrails.
 * For must_not_touch: renders workflow_name, description, rule, risk, instead.
 * No "How to Start" row in v1 — see STUB below.
 */

import type { CanHelpItem, MustNotTouchItem } from '@/lib/validate';

// STUB V2: "How to Start" per can_help recommendation
// Implementation notes: generic first step per workflow type, no tool names,
// links to Judicial Council AI resources
// Do not build until court-approved tool list is confirmed

interface HelpCardProps {
  variant: 'help';
  item: CanHelpItem;
}

interface NoTouchCardProps {
  variant: 'notouch';
  item: MustNotTouchItem;
}

type WorkflowCardProps = HelpCardProps | NoTouchCardProps;

export default function WorkflowCard(props: WorkflowCardProps) {
  if (props.variant === 'help') {
    const { item } = props;
    return (
      <article className="wf-card wf-card--help">
        <h4 className="wf-card__title">{item.workflow_name}</h4>
        <p className="wf-card__description">{item.description}</p>
        <div className="wf-row">
          <div className="wf-row__label">Why it&#39;s safe</div>
          <div className="wf-row__value">{item.why_safe}</div>
        </div>
        <div className="wf-row">
          <div className="wf-row__label">Guardrails</div>
          <div className="wf-row__value">{item.guardrails}</div>
        </div>
        {/* STUB V2: "How to Start" row would render here.
            See stub comment above for implementation notes. */}
      </article>
    );
  }

  const { item } = props;
  return (
    <article className="wf-card wf-card--noTouch">
      <h4 className="wf-card__title">{item.workflow_name}</h4>
      <p className="wf-card__description">{item.description}</p>
      <div className="wf-row">
        <div className="wf-row__label">Rule</div>
        <div className="wf-row__value">{item.rule}</div>
      </div>
      <div className="wf-row">
        <div className="wf-row__label">Risk</div>
        <div className="wf-row__value">{item.risk}</div>
      </div>
      <div className="wf-row">
        <div className="wf-row__label">Instead</div>
        <div className="wf-row__value">{item.instead}</div>
      </div>
    </article>
  );
}
