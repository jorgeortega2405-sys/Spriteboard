import { DocTemplatePreset } from './doc.types.js';

export const DOC_TEMPLATES: DocTemplatePreset[] = [
  {
    badge: 'Popular',
    description: 'Clean blank canvas with standard margins, ready for rich unstructured writing.',
    icon: 'article',
    id: 'blank',
    initialPages: [
      {
        contentHtml: '<p><br></p>',
        id: 'page_1',
      },
    ],
    name: 'Blank Document',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      lineHeight: 1.5,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    badge: 'Executive',
    description: 'Formal proposal format with executive summary callout, project scope, deliverables table, and milestone schedule.',
    icon: 'summarize',
    id: 'tmpl-doc-proposal',
    initialPages: [
      {
        contentHtml: `
          <div style="text-align: center; padding: 36px 0 24px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 28px;">
            <div style="display: inline-block; padding: 4px 14px; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-weight: 700; font-size: 10pt; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px;">Strategic Proposal</div>
            <h1 style="font-size: 24pt; font-weight: 800; margin: 0 0 10px 0; color: #0f172a; line-height: 1.2;">Executive Project Proposal: Enterprise Workspace Migration</h1>
            <p style="font-size: 12pt; color: #64748b; margin: 0 0 16px 0;">Consolidating collaborative whiteboarding, interactive documentation &amp; presentation systems</p>
            <div style="font-size: 9.5pt; color: #94a3b8;">Author: Product &amp; Architecture Lead • Target: Q4 2026 • Status: Open Review</div>
          </div>

          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1d4ed8; margin-bottom: 4px; font-size: 11pt;">
              Executive Summary &amp; Strategic Alignment
            </div>
            <p style="margin: 0; color: #1e3a8a; font-size: 10.5pt; line-height: 1.55;">
              This proposal outlines the business and technical roadmap to consolidate our organization's fragmented toolchain into Spriteboard. Unifying whiteboard ideation, architecture documentation, and presentations into one single real-time collaborative workspace reduces licensing overhead by 35% and boosts team delivery velocity.
            </p>
          </div>

          <h2 style="font-size: 15pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">1. Project Objectives &amp; Expected Impact</h2>
          <p style="line-height: 1.6; color: #334155;">Key targets for the migration and adoption program include:</p>
          <ul style="margin: 10px 0; padding-left: 24px; line-height: 1.6; color: #334155;">
            <li><strong>Toolchain Consolidation:</strong> Retire disparate single-purpose drawing and documentation licenses.</li>
            <li><strong>Real-Time Sync Performance:</strong> Deliver sub-30ms state reconciliation for all squad members.</li>
            <li><strong>Enterprise Governance:</strong> Enforce unified SAML 2.0 Single Sign-On and audit logging across teams.</li>
          </ul>

          <h2 style="font-size: 15pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px;">2. Scope Deliverables &amp; Timeline</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-weight: 700; color: #334155;">Phase</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-weight: 700; color: #334155;">Scope &amp; Deliverables</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">Target Date</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">Owner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; font-weight: 600; color: #1e293b;">Phase 1: Pilot</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; color: #475569;">Migration of 8 core engineering squads to Spriteboard</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #16a34a; font-weight: 600;">October 15</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #334155;">Platform Squad</td>
              </tr>
              <tr style="background: #fcfcfc;">
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; font-weight: 600; color: #1e293b;">Phase 2: Enterprise</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; color: #475569;">SAML 2.0 SSO provisioning, SCIM sync &amp; audit policies</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #2563eb; font-weight: 600;">November 01</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #334155;">Security Team</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; font-weight: 600; color: #1e293b;">Phase 3: Rollout</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; color: #475569;">Full company rollout, training webinars &amp; template hub</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #7c3aed; font-weight: 600;">December 01</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #334155;">Operations Lead</td>
              </tr>
            </tbody>
          </table>
        `,
        id: 'page_1',
      },
    ],
    name: 'Executive Project Proposal',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      headerText: 'Executive Project Proposal • Spriteboard Enterprise',
      lineHeight: 1.55,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    badge: 'Technical',
    description: 'Technical request for comments (RFC) template with architecture specifications, API contracts, sequence data flow, and SLA guarantees.',
    icon: 'terminal',
    id: 'tmpl-doc-rfc',
    initialPages: [
      {
        contentHtml: `
          <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-family: monospace; font-size: 10pt; font-weight: 700; color: #6d28d9; background: #f5f3ff; padding: 3px 10px; border-radius: 4px;">RFC-042</span>
              <span style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 9pt; padding: 3px 10px; border-radius: 4px;">STATUS: APPROVED</span>
            </div>
            <h1 style="font-size: 22pt; font-weight: 800; margin: 0 0 8px 0; color: #0f172a;">Distributed Real-Time Canvas Synchronization Protocol</h1>
            <p style="font-size: 11pt; color: #64748b; margin: 0;">State-based delta synchronization, peer presence heartbeat &amp; zero-latency reconciliation</p>
            <div style="font-size: 9pt; color: #94a3b8; margin-top: 10px;">Authors: Systems Architecture Guild • Target Release: Studio 2.0 • Updated: September 2026</div>
          </div>

          <div style="background: #faf5ff; border-left: 4px solid #a855f7; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <div style="font-weight: 700; color: #7e22ce; margin-bottom: 4px; font-size: 11pt;">Context &amp; Motivation</div>
            <p style="margin: 0; color: #6b21a8; font-size: 10pt; line-height: 1.55;">
              As collaborative canvas sizes exceed 5,000 vector elements with 50+ concurrent editors, naive full-document broadcasts cause unacceptable network congestion. This specification outlines an atomic delta-streaming protocol built on WebSockets and Redis pub/sub channels.
            </p>
          </div>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">1. Protocol Event Specifications</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9.5pt;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Event Name</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Direction</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Payload Format</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700;">Target SLA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-family: monospace; font-weight: 600; color: #4338ca;">canvas:op:delta</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Bi-directional</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Atomic element diff list with vector timestamp</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #16a34a; font-weight: 600;">&lt; 15ms</td>
              </tr>
              <tr style="background: #fcfcfc;">
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-family: monospace; font-weight: 600; color: #4338ca;">cursor:presence</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Client -> Cluster</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Packed Int16 coordinates (x, y) &amp; user color</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #16a34a; font-weight: 600;">&lt; 20ms</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-family: monospace; font-weight: 600; color: #4338ca;">canvas:snapshot</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Server -> Client</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Full Zstandard compressed canvas JSON state</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #2563eb; font-weight: 600;">On connect</td>
              </tr>
            </tbody>
          </table>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">2. Security &amp; Data Consistency</h2>
          <p style="line-height: 1.6; color: #334155;">All delta mutations undergo client-side optimistic execution with server-verified idempotency tokens, guaranteeing zero split-brain state.</p>
        `,
        id: 'page_1',
      },
    ],
    name: 'Technical Architecture RFC',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10.5,
      headerText: 'RFC-042 • Technical Architecture Specification',
      lineHeight: 1.55,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    badge: 'Planning',
    description: 'Sprint planning and architectural decisions log with attendees, agenda topics, ADR records, and ownership matrix.',
    icon: 'event_note',
    id: 'tmpl-doc-meeting',
    initialPages: [
      {
        contentHtml: `
          <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 4px 12px; background: #ecfdf5; color: #065f46; border-radius: 9999px; font-weight: 700; font-size: 9.5pt; text-transform: uppercase; margin-bottom: 12px;">Sprint Planning</div>
            <h1 style="font-size: 22pt; font-weight: 800; margin: 0 0 8px 0; color: #0f172a;">Sprint 24 Planning &amp; Decision Log</h1>
            <div style="font-size: 9.5pt; color: #64748b;">Date: Monday, September 21, 2026 • Facilitator: Product Lead • Attendees: 8 Members</div>
          </div>

          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <div style="font-weight: 700; color: #15803d; margin-bottom: 4px; font-size: 11pt;">Sprint Core Goal</div>
            <p style="margin: 0; color: #166534; font-size: 10pt; line-height: 1.55;">
              Finalize the unified canvas creation modal, deprecate isolated diagram views, and launch the 9 official English templates with direct visual previews and database persistence.
            </p>
          </div>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">1. Key Architectural Decisions (ADR)</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9.5pt;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Record ID</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Decision &amp; Context</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700;">Rationale &amp; Trade-off</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700;">Owner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-weight: 600; color: #1e293b;">ADR-21</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #1e293b;">Unify all canvases into 3 top-level types (Board, Presentation, Doc)</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Eliminates fragmented creation flows; diagramming is integrated into boards.</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #16a34a; font-weight: 600;">Jorge O.</td>
              </tr>
              <tr style="background: #fcfcfc;">
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-weight: 600; color: #1e293b;">ADR-22</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #1e293b;">Dedicated templates table &amp; official system account seed</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Provides clean marketplace publishing and ownership linking to 'spriteboard'.</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #2563eb; font-weight: 600;">SysArch</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-weight: 600; color: #1e293b;">ADR-23</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #1e293b;">Real content SVG thumbnails on template cards</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; color: #475569;">Replaces generic icon placeholders with authentic layout representations.</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; color: #7c3aed; font-weight: 600;">Design Guild</td>
              </tr>
            </tbody>
          </table>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">2. Action Items &amp; Ownership</h2>
          <ul style="line-height: 1.8; color: #334155; margin: 12px 0; padding-left: 20px;">
            <li>[x] <strong>Creation Modal:</strong> Remove diagram menu tab and panel from workspace modal.</li>
            <li>[x] <strong>Template Library:</strong> Replace legacy catalog with 9 high-res English templates.</li>
            <li>[x] <strong>Persistence:</strong> Define official account seed and templates table in SQL scripts.</li>
            <li>[ ] <strong>Verification:</strong> Execute full typecheck and integration suite in Docker container.</li>
          </ul>
        `,
        id: 'page_1',
      },
    ],
    name: 'Sprint Planning & Decision Log',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10.5,
      headerText: 'Sprint Planning & Decision Log • Sprint 24',
      lineHeight: 1.55,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
];

export function getDocTemplateById(templateId?: string | null): DocTemplatePreset {
  if (!templateId) return DOC_TEMPLATES[0];
  const found = DOC_TEMPLATES.find((t) => t.id === templateId);
  return found || DOC_TEMPLATES[0];
}
