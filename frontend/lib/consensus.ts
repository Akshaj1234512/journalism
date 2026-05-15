import { Critique, AgentName } from "./types";

/**
 * Detect overlap: when two or more *different* agents flag spans that
 * intersect, those critiques get a "consensus" group id. The frontend
 * uses this to mark "hotspot" passages — the single strongest signal the
 * room produces, because multiple specialists independently arrived at
 * the same line.
 *
 * Two spans overlap when their intervals intersect on the character axis.
 * Singleton flags (only one agent on that span) get group = null.
 *
 * This is one of the things no competitor surfaces. A generic AI editor
 * outputs a flat list of suggestions; the Red Room can tell you "three of
 * us looked at this sentence."
 */
export interface ConsensusInfo {
  /** group id (stable per cluster) or null if this critique is alone */
  groupId: string | null;
  /** how many distinct agents are in this cluster (1 = singleton) */
  agentCount: number;
  /** the agents in this cluster (handy for tooltips) */
  agents: AgentName[];
}

export function computeConsensus(critiques: Critique[]): Map<string, ConsensusInfo> {
  // Stable per-critique key. We use _id when present, else span+agent.
  const idOf = (c: Critique) =>
    c._id ?? `${c.agent}-${c.span[0]}-${c.span[1]}`;

  // Sort by span start; merge overlapping spans into clusters.
  const ordered = [...critiques].sort((a, b) =>
    a.span[0] !== b.span[0] ? a.span[0] - b.span[0] : a.span[1] - b.span[1],
  );

  const clusters: Critique[][] = [];
  for (const c of ordered) {
    const last = clusters[clusters.length - 1];
    if (last && c.span[0] < Math.max(...last.map((x) => x.span[1]))) {
      last.push(c);
    } else {
      clusters.push([c]);
    }
  }

  const out = new Map<string, ConsensusInfo>();
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const agents = Array.from(new Set(cluster.map((c) => c.agent)));
    const groupId = agents.length >= 2 ? `consensus-${i}` : null;
    for (const c of cluster) {
      out.set(idOf(c), {
        groupId,
        agentCount: agents.length,
        agents,
      });
    }
  }
  return out;
}
