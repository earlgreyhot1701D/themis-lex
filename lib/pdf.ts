/**
 * PDF generation logic for Themis Lex.
 * One responsibility: render assessment results as a branded PDF document.
 * See Architecture v1.1 Section 4 and PRD v1.3 Section 6.
 *
 * Uses @react-pdf/renderer server-side. No client-side canvas. No jsPDF.
 */

import React from 'react';
import path from 'path';
import fs from 'fs';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { CanHelpItem, MustNotTouchItem } from '@/lib/validate';

// NOTE: This helper assumes Amplify's Next.js adapter copies public/ into
// the Lambda function bundle. If post-deploy smoke testing shows missing
// fonts or images, the fix is to add `output: 'standalone'` to next.config.js
// and redeploy. Standalone output mode explicitly includes public/ in the
// server bundle. Documented here so future-me doesn't chase the wrong fix.
function resolveAssetPath(relPath: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', relPath),
    path.join(__dirname, '..', 'public', relPath),
    path.join(__dirname, '..', '..', 'public', relPath),
    path.join(__dirname, '..', '..', '..', 'public', relPath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`[pdf] resolved asset: ${relPath} -> ${candidate}`);
      return candidate;
    }
  }
  console.error(`[pdf] asset not found: ${relPath}`);
  return null;
}

// Brand asset paths — resolved at module load via resolveAssetPath, which tries
// process.cwd() first (Next.js dev) then walks up from __dirname (Lambda runtime
// where the bundled chunk may sit several directories below the function root).
const bannerPath = resolveAssetPath('themis-lex-banner.png');
const faviconPath = resolveAssetPath('favicon.png');

// ============================================================
// FONT REGISTRATION — with fallback safety
// ============================================================

const interRegular = resolveAssetPath('fonts/Inter-Regular.ttf');
const interMedium = resolveAssetPath('fonts/Inter-Medium.ttf');
const interSemiBold = resolveAssetPath('fonts/Inter-SemiBold.ttf');
const sourceSerifRegular = resolveAssetPath('fonts/SourceSerif4-Regular.ttf');
const sourceSerifMedium = resolveAssetPath('fonts/SourceSerif4-Medium.ttf');
const sourceSerifSemiBold = resolveAssetPath('fonts/SourceSerif4-SemiBold.ttf');

if (interRegular && interMedium && interSemiBold) {
  try {
    Font.register({
      family: 'Inter',
      fonts: [
        { src: interRegular, fontWeight: 400 },
        { src: interMedium, fontWeight: 500 },
        { src: interSemiBold, fontWeight: 600 },
      ],
    });
  } catch (err) {
    console.error('Failed to register Inter font:', err);
  }
} else {
  console.error('[pdf] Skipping Inter registration; missing files.');
}

if (sourceSerifRegular && sourceSerifMedium && sourceSerifSemiBold) {
  try {
    Font.register({
      family: 'SourceSerif4',
      fonts: [
        { src: sourceSerifRegular, fontWeight: 400 },
        { src: sourceSerifMedium, fontWeight: 500 },
        { src: sourceSerifSemiBold, fontWeight: 600 },
      ],
    });
  } catch (err) {
    console.error('Failed to register SourceSerif4 font:', err);
  }
} else {
  console.error('[pdf] Skipping SourceSerif4 registration; missing files.');
}

// Disable hyphenation — court documents should not hyphenate words
Font.registerHyphenationCallback((word) => [word]);

// ============================================================
// DESIGN TOKENS — matching the Themis Lex visual identity
// ============================================================

const colors = {
  bg: '#F5F0E8',
  card: '#FDFAF5',
  ink: '#1C1C1C',
  ink2: '#3A3733',
  ink3: '#6B665F',
  terra: '#C4622D',
  terraDeep: '#A04E1F',
  terraSoft: '#EBD8CB',
  sage: '#7A8C6E',
  sageSoft: '#DDE2D5',
  sageDeep: '#4E6044',
  rule: '#D9D0C1',
  ruleSoft: '#E8E0D1',
};

const s = StyleSheet.create({
  page: {
    backgroundColor: colors.bg,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.ink,
    lineHeight: 1.5,
  },
  // Header — brand banner on page 1
  // Banner is ~3:1 aspect ratio. At full printable width (~6.5" = 468pt),
  // that's ~156pt tall. Metadata block + first card must still fit on page 1.
  // If layout is tight, reduce banner width to 80% or compress metadata spacing.
  headerBlock: {
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    marginBottom: 8,
  },
  terraRule: {
    height: 1.5,
    backgroundColor: colors.terra,
    marginBottom: 16,
  },
  // Metadata
  metaBlock: {
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.ink3,
    width: 110,
    paddingTop: 1,
  },
  metaValue: {
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.ink,
  },
  // Section headings
  sectionHeadingHelp: {
    fontFamily: 'SourceSerif4',
    fontWeight: 500,
    fontSize: 14,
    color: colors.sageDeep,
    marginBottom: 12,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.sage,
    borderLeftStyle: 'solid',
  },
  sectionHeadingNoTouch: {
    fontFamily: 'SourceSerif4',
    fontWeight: 500,
    fontSize: 14,
    color: colors.terraDeep,
    marginBottom: 12,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.terra,
    borderLeftStyle: 'solid',
  },
  sectionSpacer: {
    height: 24,
  },
  // Cards
  cardHelp: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderTopWidth: 3,
    borderTopColor: colors.sage,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  cardNoTouch: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderTopWidth: 3,
    borderTopColor: colors.terra,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: 'SourceSerif4',
    fontWeight: 600,
    fontSize: 12,
    color: colors.ink,
    marginBottom: 4,
  },
  cardDescription: {
    fontFamily: 'Inter',
    fontSize: 9,
    lineHeight: 1.5,
    color: colors.ink3,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleSoft,
    borderBottomStyle: 'solid',
  },
  cardRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.ruleSoft,
    borderTopStyle: 'solid',
  },
  cardRowFirst: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  cardRowLabel: {
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.ink2,
    width: 80,
    paddingTop: 1,
  },
  cardRowValue: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: colors.ink,
    flex: 1,
  },
  // Disclaimer
  disclaimerBlock: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    borderTopStyle: 'solid',
  },
  disclaimerText: {
    fontFamily: 'Inter',
    fontSize: 9,
    lineHeight: 1.6,
    color: colors.ink3,
  },
  // Page footer — favicon mark (left), wordmark (center), page number (right)
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerFavicon: {
    width: 12,
    height: 12,
  },
  footerWordmark: {
    fontFamily: 'SourceSerif4',
    fontWeight: 600,
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.ink3,
  },
  pageNumber: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: colors.ink3,
  },
});

// ============================================================
// DOCUMENT COMPONENTS
// ============================================================

interface PdfData {
  roleLabel: string;
  sensitivityLabel: string;
  timestamp: string;
  canHelp: CanHelpItem[];
  mustNotTouch: MustNotTouchItem[];
}

function HelpCard({ item, isFirst }: { item: CanHelpItem; isFirst: boolean }) {
  return React.createElement(
    View,
    { style: s.cardHelp, wrap: false, ...(isFirst ? {} : {}) },
    React.createElement(Text, { style: s.cardTitle }, item.workflow_name),
    item.description
      ? React.createElement(Text, { style: s.cardDescription }, item.description)
      : null,
    React.createElement(
      View,
      { style: s.cardRowFirst },
      React.createElement(Text, { style: s.cardRowLabel }, "WHY IT'S SAFE"),
      React.createElement(Text, { style: s.cardRowValue }, item.why_safe)
    ),
    React.createElement(
      View,
      { style: s.cardRow },
      React.createElement(Text, { style: s.cardRowLabel }, 'GUARDRAILS'),
      React.createElement(Text, { style: s.cardRowValue }, item.guardrails)
    )
  );
}

function NoTouchCard({ item }: { item: MustNotTouchItem }) {
  return React.createElement(
    View,
    { style: s.cardNoTouch, wrap: false },
    React.createElement(Text, { style: s.cardTitle }, item.workflow_name),
    item.description
      ? React.createElement(Text, { style: s.cardDescription }, item.description)
      : null,
    React.createElement(
      View,
      { style: s.cardRowFirst },
      React.createElement(Text, { style: s.cardRowLabel }, 'RULE'),
      React.createElement(Text, { style: s.cardRowValue }, item.rule)
    ),
    React.createElement(
      View,
      { style: s.cardRow },
      React.createElement(Text, { style: s.cardRowLabel }, 'RISK'),
      React.createElement(Text, { style: s.cardRowValue }, item.risk)
    ),
    React.createElement(
      View,
      { style: s.cardRow },
      React.createElement(Text, { style: s.cardRowLabel }, 'INSTEAD'),
      React.createElement(Text, { style: s.cardRowValue }, item.instead)
    )
  );
}

function AssessmentDocument({ data }: { data: PdfData }) {
  const formattedDate = new Date(data.timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return React.createElement(
    Document,
    { title: 'Themis Lex — AI Readiness Assessment', author: 'Themis Lex' },
    React.createElement(
      Page,
      { size: 'LETTER', style: s.page, wrap: true },

      // Header — brand banner (page 1 only)
      React.createElement(
        View,
        { style: s.headerBlock, fixed: false },
        bannerPath
          ? React.createElement(Image, { style: s.bannerImage, src: bannerPath })
          : null,
        React.createElement(View, { style: s.terraRule })
      ),

      // Metadata
      React.createElement(
        View,
        { style: s.metaBlock },
        React.createElement(
          View,
          { style: s.metaRow },
          React.createElement(Text, { style: s.metaLabel }, 'Generated'),
          React.createElement(Text, { style: s.metaValue }, formattedDate)
        ),
        React.createElement(
          View,
          { style: s.metaRow },
          React.createElement(Text, { style: s.metaLabel }, 'Role'),
          React.createElement(Text, { style: s.metaValue }, data.roleLabel)
        ),
        React.createElement(
          View,
          { style: s.metaRow },
          React.createElement(
            Text,
            { style: s.metaLabel },
            'Data Sensitivity'
          ),
          React.createElement(
            Text,
            { style: s.metaValue },
            data.sensitivityLabel
          )
        )
      ),

      // Section 1: Where AI Can Help
      // Wrap heading + first card together so heading never orphans at page bottom
      React.createElement(
        View,
        { wrap: false },
        React.createElement(
          Text,
          { style: s.sectionHeadingHelp },
          'Where AI Can Help You'
        ),
        data.canHelp.length > 0
          ? React.createElement(HelpCard, { key: 'help-0', item: data.canHelp[0], isFirst: true })
          : null
      ),
      // Remaining can_help cards (index 1 onward)
      ...data.canHelp.slice(1).map((item, i) =>
        React.createElement(HelpCard, { key: `help-${i + 1}`, item, isFirst: false })
      ),

      // Spacer
      React.createElement(View, { style: s.sectionSpacer }),

      // Section 2: Where AI Must Not Touch
      // Wrap heading + first card together so heading never orphans at page bottom
      React.createElement(
        View,
        { wrap: false },
        React.createElement(
          Text,
          { style: s.sectionHeadingNoTouch },
          'Where AI Must Not Touch'
        ),
        data.mustNotTouch.length > 0
          ? React.createElement(NoTouchCard, { key: 'notouch-0', item: data.mustNotTouch[0] })
          : null
      ),
      // Remaining must_not_touch cards (index 1 onward)
      ...data.mustNotTouch.slice(1).map((item, i) =>
        React.createElement(NoTouchCard, { key: `notouch-${i + 1}`, item })
      ),

      // Disclaimer — bottom of final page
      React.createElement(
        View,
        { style: s.disclaimerBlock },
        React.createElement(
          Text,
          { style: s.disclaimerText },
          'Themis Lex applies California judicial branch AI governance principles to help court staff think through AI adoption. This tool provides structured guidance, not legal advice. For questions about specific legal requirements, consult your court\u2019s legal counsel or the Judicial Council of California.'
        )
      ),

      // Page footer — favicon (left), wordmark (center), page number (right)
      // Renders on every page including the disclaimer page
      React.createElement(
        View,
        { style: s.pageFooter, fixed: true },
        faviconPath
          ? React.createElement(Image, { style: s.footerFavicon, src: faviconPath })
          : null,
        React.createElement(Text, { style: s.footerWordmark }, 'THEMIS LEX'),
        React.createElement(
          Text,
          { style: s.pageNumber, render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}` },
          ''
        )
      )
    )
  );
}

// ============================================================
// PUBLIC API
// ============================================================

export interface PdfInput {
  role_label: string;
  sensitivity_label: string;
  timestamp: string;
  can_help: CanHelpItem[];
  must_not_touch: MustNotTouchItem[];
}

/**
 * Generates a PDF buffer from assessment results.
 * Returns the buffer on success, or throws on failure.
 */
export async function generatePdf(input: PdfInput): Promise<Buffer> {
  const data: PdfData = {
    roleLabel: input.role_label,
    sensitivityLabel: input.sensitivity_label,
    timestamp: input.timestamp,
    canHelp: input.can_help,
    mustNotTouch: input.must_not_touch,
  };

  const doc = React.createElement(AssessmentDocument, { data });
  // Type assertion needed: renderToBuffer expects ReactElement<DocumentProps>
  // but React.createElement returns a generic ReactElement. The AssessmentDocument
  // component returns a valid Document element at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  return Buffer.from(buffer);
}
