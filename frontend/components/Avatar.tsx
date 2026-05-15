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
  clarity: ClaraAvatar,
  partisan: ParkerAvatar,
  question_master: SolAvatar,
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

/* Clara — Clarity Critique. Green, cropped curly hair. */
function ClaraAvatar() {
  return (
    <>
      <circle cx="40" cy="40" r="40" fill="#D1FAE5" />
      <path d="M10 80 C 14 58, 26 50, 40 50 C 54 50, 66 58, 70 80 Z" fill="#065F46" />
      <rect x="34" y="42" width="12" height="10" fill="#D6B59A" />
      <circle cx="40" cy="34" r="14" fill="#EFD3B2" />
      {/* curly hair — three bumps */}
      <path d="M26 28 Q 24 18, 32 18 Q 36 14, 40 16 Q 44 14, 48 18 Q 56 18, 54 28 Q 52 24, 46 24 Q 40 20, 34 24 Q 28 24, 26 28 Z" fill="#7C2D12" />
      <circle cx="35" cy="34" r="1.4" fill="#1F2937" />
      <circle cx="45" cy="34" r="1.4" fill="#1F2937" />
      <path d="M36 41 Q 40 42, 44 41" stroke="#7C2D12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
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
