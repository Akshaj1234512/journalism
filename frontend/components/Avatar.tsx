"use client";

import { AgentName } from "@/lib/types";

interface Props {
  agent: AgentName;
  size?: number;
  className?: string;
  active?: boolean;     // pulses while the agent is reviewing
  muted?: boolean;      // grayscale + dimmed when the agent is turned off
}

/**
 * Flat SVG portraits, one per persona. Inspired by the slide deck:
 * a coloured circle with a stylised head-and-shoulders silhouette inside,
 * each persona distinguishable by hairstyle and accent.
 *
 * Drawn by hand. No third-party avatar service, no licensing concerns.
 */
export function Avatar({
  agent,
  size = 40,
  className = "",
  active = false,
  muted = false,
}: Props) {
  const Inner = AVATARS[agent];
  return (
    <div
      className={[
        "relative inline-flex items-center justify-center rounded-full transition",
        active ? "ring-2 ring-offset-2 ring-rose-400 animate-pulse" : "",
        className,
      ].join(" ")}
      style={{
        width: size,
        height: size,
        filter: muted ? "grayscale(1)" : undefined,
        opacity: muted ? 0.45 : 1,
      }}
      aria-label={`${agent} avatar${muted ? ", turned off" : ""}`}
    >
      <svg viewBox="0 0 80 80" width={size} height={size} className="rounded-full">
        <Inner />
      </svg>
    </div>
  );
}

/* ---------- per-agent inner SVGs ---------- */

const AVATARS: Record<AgentName, () => React.ReactNode> = {
  legal_skeptic: AnneAvatar,
  data_expert: PeterAvatar,
  human_rights: JoeAvatar,
  partisan: ParkerAvatar,
  question_master: SolAvatar,
  thesis_editor: TheoAvatar,
  evidence_quotation: EvanAvatar,
  prose_style: WillAvatar,
  structure_editor: StellaAvatar,
  logic_auditor: LoganAvatar,
  citation_editor: KateAvatar,
  argumentative_editor: AriAvatar,
  analytical_editor: AnyaAvatar,
  narrative_editor: NoraAvatar,
  research_editor: ReeseAvatar,
  rhetorical_editor: RheaAvatar,
  methodology_editor: MiraAvatar,
  cs_ml_specialist: CyrilAvatar,
};

/* Anne — Legal Skeptic. Pink background, sharp dark bob, slight angle. */
function AnneAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FCE7F3" />
      {/* shoulders */}
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#9D174D" />
      {/* neck */}
      <rect x="34" y="42" width="12" height="10" fill="#F9A8D4" />
      {/* face */}
      <circle cx="40" cy="34" r="14" fill="#FBCFE8" />
      {/* hair — bob */}
      <path d="M24 30 Q 22 16, 40 14 Q 58 16, 56 30 Q 56 36, 54 38 L 50 26 Q 40 22, 30 26 L 26 38 Q 24 36, 24 30 Z" fill="#1F2937" />
      {/* eyes */}
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* mouth */}
      <path d="M36 41 Q 40 43, 44 41" stroke="#9D174D" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Peter — Data Expert. Charcoal background, glasses, short hair. */
function PeterAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#E5E7EB" />
      {/* shoulders */}
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#0F172A" />
      {/* neck */}
      <rect x="34" y="42" width="12" height="10" fill="#A78B6E" />
      {/* face */}
      <circle cx="40" cy="34" r="14" fill="#C39A75" />
      {/* hair — short */}
      <path d="M27 28 Q 28 18, 40 16 Q 53 18, 53 30 L 50 26 Q 40 22, 30 26 Z" fill="#1F2937" />
      {/* glasses */}
      <circle cx="34" cy="34" r="3.5" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <circle cx="46" cy="34" r="3.5" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <line x1="37.5" y1="34" x2="42.5" y2="34" stroke="#0F172A" strokeWidth="1.2" />
      {/* mouth */}
      <path d="M36 41 Q 40 43, 44 41" stroke="#7C2D12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Joe — Human Rights Advocate. Indigo background, warm tone. */
function JoeAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#E0E7FF" />
      {/* shoulders */}
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#4338CA" />
      {/* neck */}
      <rect x="34" y="42" width="12" height="10" fill="#FBCFE8" />
      {/* face */}
      <circle cx="40" cy="34" r="14" fill="#FCE7DC" />
      {/* hair — neat side-swept */}
      <path d="M26 30 Q 26 18, 40 16 Q 54 18, 54 30 Q 50 24, 40 22 Q 32 24, 28 30 Z" fill="#3F2E1A" />
      {/* eyes */}
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* mouth — slight smile */}
      <path d="M35 41 Q 40 44, 45 41" stroke="#7C2D12" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  );
}


/* Sol — Question Master. Amber, older, swept-back silver hair, glasses.
   The genius of the room: looks like he is mid-thought. */
function SolAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FEF3C7" />
      {/* shoulders */}
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#B45309" />
      {/* neck */}
      <rect x="34" y="42" width="12" height="10" fill="#E8C9A0" />
      {/* face */}
      <circle cx="40" cy="34" r="14" fill="#F3D9B8" />
      {/* swept-back silver hair, high forehead */}
      <path d="M26 28 Q 28 20, 40 19 Q 53 20, 54 29 Q 50 25, 44 25 Q 42 22, 38 24 Q 32 24, 28 30 Q 26 30, 26 28 Z" fill="#9CA3AF" />
      <path d="M26 30 Q 24 26, 25 22 Q 27 27, 28 30 Z" fill="#9CA3AF" />
      {/* round scholar glasses */}
      <circle cx="34" cy="34" r="4" stroke="#78350F" strokeWidth="1.3" fill="none" />
      <circle cx="46" cy="34" r="4" stroke="#78350F" strokeWidth="1.3" fill="none" />
      <line x1="38" y1="34" x2="42" y2="34" stroke="#78350F" strokeWidth="1.3" />
      {/* slight knowing half-smile */}
      <path d="M36 42 Q 40 44, 45 41" stroke="#92400E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Theo — Thesis Editor. Violet, intense brow, square head shape. */
function TheoAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#DDD6FE" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#5B21B6" />
      <rect x="34" y="42" width="12" height="10" fill="#D6B59A" />
      <circle cx="40" cy="34" r="14" fill="#EFD3B2" />
      {/* hair — combed back, slightly long */}
      <path d="M26 28 Q 28 16, 40 14 Q 53 16, 54 28 Q 50 24, 40 22 Q 32 24, 28 30 Z" fill="#1F2937" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* brow — a serious thinker */}
      <path d="M32 30 L 38 29" stroke="#1F2937" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M42 29 L 48 30" stroke="#1F2937" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M36 42 L 44 42" stroke="#5B21B6" strokeWidth="1.3" strokeLinecap="round" />
    </>
  );
}

/* Evan — Evidence & Quotation. Sky blue, holding a book aesthetic. */
function EvanAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#BAE6FD" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#0369A1" />
      <rect x="34" y="42" width="12" height="10" fill="#D6B59A" />
      <circle cx="40" cy="34" r="14" fill="#EFD3B2" />
      {/* hair — short, parted right */}
      <path d="M26 30 Q 26 18, 40 16 Q 52 18, 54 28 Q 50 24, 42 24 L 40 22 Q 32 24, 28 30 Z" fill="#5B3A1A" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 42 Q 40 43, 44 42" stroke="#0C4A6E" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Will — Prose & Style. Teal, sharp shape, neat. */
function WillAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#99F6E4" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#0F766E" />
      <rect x="34" y="42" width="12" height="10" fill="#A78B6E" />
      <circle cx="40" cy="34" r="14" fill="#C39A75" />
      {/* hair — buzz cut, neat line */}
      <path d="M27 28 Q 28 19, 40 18 Q 52 19, 53 28 L 50 25 Q 40 23, 30 25 Z" fill="#1F2937" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 42 L 44 42" stroke="#0F766E" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

/* Stella — Structure. Amber, structured updo, architectural feel. */
function StellaAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FED7AA" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#9A3412" />
      <rect x="34" y="42" width="12" height="10" fill="#F9A8D4" />
      <circle cx="40" cy="34" r="14" fill="#FBCFE8" />
      {/* hair — high bun + parted front */}
      <path d="M26 30 Q 24 20, 32 20 Q 36 14, 40 16 Q 44 14, 48 20 Q 56 20, 54 30 Q 50 26, 44 26 Q 40 22, 36 26 Q 30 26, 26 30 Z" fill="#3F2E1A" />
      <ellipse cx="40" cy="14" rx="6" ry="4" fill="#3F2E1A" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 41 Q 40 43, 44 41" stroke="#9A3412" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Logan — Logic Auditor. Cyan, sharp glasses, neutral. */
function LoganAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#A5F3FC" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#0E7490" />
      <rect x="34" y="42" width="12" height="10" fill="#A78B6E" />
      <circle cx="40" cy="34" r="14" fill="#C39A75" />
      {/* hair — short, sharply parted left */}
      <path d="M26 30 Q 26 18, 36 16 L 36 24 Q 30 24, 28 30 Z" fill="#1F2937" />
      <path d="M36 16 Q 54 18, 54 30 Q 50 24, 36 24 Z" fill="#1F2937" />
      {/* rectangular glasses */}
      <rect x="30" y="31" width="8" height="6" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <rect x="42" y="31" width="8" height="6" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <line x1="38" y1="34" x2="42" y2="34" stroke="#0F172A" strokeWidth="1.2" />
      <path d="M36 42 L 44 42" stroke="#0E7490" strokeWidth="1.3" strokeLinecap="round" />
    </>
  );
}

/* Ari — Argumentative Editor. Orange, intense, sharp jaw, debater. */
function AriAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FED7AA" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#9A3412" />
      <rect x="34" y="42" width="12" height="10" fill="#A78B6E" />
      <circle cx="40" cy="34" r="14" fill="#C39A75" />
      {/* hair — short, parted, intense */}
      <path d="M27 28 Q 28 17, 40 15 Q 52 17, 53 28 L 50 26 Q 40 22, 30 26 Z" fill="#1F2937" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M32 30 L 38 30" stroke="#1F2937" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M42 30 L 48 30" stroke="#1F2937" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M36 42 L 44 42" stroke="#9A3412" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

/* Anya — Analytical Editor. Purple, sharp eyes, attentive reader. */
function AnyaAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#E9D5FF" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#6B21A8" />
      <rect x="34" y="42" width="12" height="10" fill="#F9A8D4" />
      <circle cx="40" cy="34" r="14" fill="#FBCFE8" />
      {/* hair — long, parted middle */}
      <path d="M24 30 Q 22 16, 40 14 Q 58 16, 56 30 Q 56 44, 54 48 L 50 28 Q 40 22, 30 28 L 26 48 Q 24 44, 24 30 Z" fill="#1F2937" />
      {/* part */}
      <line x1="40" y1="16" x2="40" y2="22" stroke="#0F0F0F" strokeWidth="0.8" />
      <circle cx="35" cy="34" r="1.6" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.6" fill="#1F2937" />
      <path d="M36 41 Q 40 42, 44 41" stroke="#6B21A8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Nora — Personal-Essay Editor. Warm pink, soft, generous expression. */
function NoraAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FBCFE8" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#9D174D" />
      <rect x="34" y="42" width="12" height="10" fill="#E8C9A0" />
      <circle cx="40" cy="34" r="14" fill="#F3D9B8" />
      {/* hair — soft wavy shoulder-length */}
      <path d="M24 28 Q 22 14, 40 13 Q 58 14, 56 28 Q 58 38, 54 46 L 50 26 Q 40 22, 30 26 L 26 46 Q 22 38, 24 28 Z" fill="#7C2D12" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* warm smile */}
      <path d="M35 41 Q 40 45, 45 41" stroke="#9D174D" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Reese — Research Editor. Teal, big round glasses, librarian energy. */
function ReeseAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#CCFBF1" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#115E59" />
      <rect x="34" y="42" width="12" height="10" fill="#D6B59A" />
      <circle cx="40" cy="34" r="14" fill="#EFD3B2" />
      {/* hair — short bob */}
      <path d="M24 30 Q 22 18, 40 16 Q 58 18, 56 30 Q 56 34, 54 36 L 50 26 Q 40 22, 30 26 L 26 36 Q 24 34, 24 30 Z" fill="#1F2937" />
      {/* big round glasses */}
      <circle cx="34" cy="34" r="4.5" stroke="#0F172A" strokeWidth="1.3" fill="none" />
      <circle cx="46" cy="34" r="4.5" stroke="#0F172A" strokeWidth="1.3" fill="none" />
      <line x1="38.5" y1="34" x2="41.5" y2="34" stroke="#0F172A" strokeWidth="1.3" />
      <path d="M36 42 Q 40 43, 44 42" stroke="#115E59" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}

/* Rhea — Rhetorical-Analysis Editor. Red, expressive, orator's energy. */
function RheaAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FECACA" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#7F1D1D" />
      <rect x="34" y="42" width="12" height="10" fill="#F9A8D4" />
      <circle cx="40" cy="34" r="14" fill="#FBCFE8" />
      {/* hair — high updo with curl */}
      <path d="M26 30 Q 22 16, 32 14 Q 36 10, 40 12 Q 44 10, 48 14 Q 58 16, 54 30 Q 50 24, 44 24 Q 40 20, 36 24 Q 30 24, 26 30 Z" fill="#3F2E1A" />
      <ellipse cx="40" cy="11" rx="5" ry="3.5" fill="#3F2E1A" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* expressive open-ish mouth (the speaker) */}
      <ellipse cx="40" cy="42" rx="3" ry="1.6" fill="#7F1D1D" />
    </>
  );
}


/* Kate — Citation Editor. Stone background, scholarly, glasses on chain. */
function KateAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#D6D3D1" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#44403C" />
      <rect x="34" y="42" width="12" height="10" fill="#E8C9A0" />
      <circle cx="40" cy="34" r="14" fill="#F3D9B8" />
      {/* hair — silver, neat bob */}
      <path d="M24 30 Q 22 16, 40 14 Q 58 16, 56 30 Q 56 36, 54 38 L 50 26 Q 40 22, 30 26 L 26 38 Q 24 36, 24 30 Z" fill="#9CA3AF" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      {/* reading glasses, low on nose */}
      <circle cx="34" cy="36" r="3" stroke="#1F2937" strokeWidth="1.1" fill="none" />
      <circle cx="46" cy="36" r="3" stroke="#1F2937" strokeWidth="1.1" fill="none" />
      <line x1="37" y1="36" x2="43" y2="36" stroke="#1F2937" strokeWidth="1.1" />
      <path d="M36 42 Q 40 43, 44 42" stroke="#44403C" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}


/* Parker — Partisan Checker. Red, cleanly parted hair. */
function ParkerAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#FEE2E2" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#991B1B" />
      <rect x="34" y="42" width="12" height="10" fill="#D6B59A" />
      <circle cx="40" cy="34" r="14" fill="#EFD3B2" />
      {/* hair — sharp side part */}
      <path d="M26 30 Q 26 18, 38 16 L 38 24 Q 32 24, 28 30 Z" fill="#1F2937" />
      <path d="M38 16 Q 54 18, 54 30 Q 50 24, 38 24 Z" fill="#1F2937" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 41 L 44 41" stroke="#7C2D12" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

/* Mira — Methodology Editor. Teal, lab-coat, focused expression. */
function MiraAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#CCFBF1" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#0F766E" />
      {/* lab-coat lapels suggested by lighter triangles on shoulders */}
      <path d="M34 50 L 40 62 L 46 50 Z" fill="#F0FDFA" />
      <rect x="34" y="42" width="12" height="10" fill="#F9A8D4" />
      <circle cx="40" cy="34" r="14" fill="#FBCFE8" />
      {/* hair — neat shoulder-length, parted */}
      <path d="M24 30 Q 22 14, 40 13 Q 58 14, 56 30 Q 56 38, 54 42 L 50 26 Q 40 22, 30 26 L 26 42 Q 24 38, 24 30 Z" fill="#3F2E1A" />
      <line x1="40" y1="15" x2="40" y2="20" stroke="#1F0F00" strokeWidth="0.8" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 42 L 44 42" stroke="#0F766E" strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

/* Cyril — CS / ML Specialist. Blue, glasses, slightly nerdy. */
function CyrilAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#DBEAFE" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#1D4ED8" />
      <rect x="34" y="42" width="12" height="10" fill="#A78B6E" />
      <circle cx="40" cy="34" r="14" fill="#C39A75" />
      {/* hair — short, slightly tousled */}
      <path d="M26 30 Q 28 16, 40 16 Q 52 16, 54 30 Q 50 24, 44 26 Q 40 22, 36 26 Q 30 24, 26 30 Z" fill="#1F2937" />
      {/* rectangular tech glasses */}
      <rect x="30" y="31" width="8" height="6" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <rect x="42" y="31" width="8" height="6" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
      <line x1="38" y1="34" x2="42" y2="34" stroke="#0F172A" strokeWidth="1.2" />
      <path d="M36 41 Q 40 42, 44 41" stroke="#1D4ED8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  );
}
