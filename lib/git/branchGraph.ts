/**
 * Branch Graph Algorithm
 *
 * Takes per-branch commit lists and produces a unified graph structure
 * with lane assignments, merge detection, and fork detection.
 * Designed for a GitLens-style multi-branch visualization.
 */

import {
  CommitData,
  BranchData,
  BranchGraphNode,
  BranchGraphData,
  MergePoint,
  ForkPoint,
} from '@/types/git';

// ─── Color Palette ───────────────────────────────────────────────────

const LANE_COLORS = [
  '#3b82f6', // blue-500  — default/main
  '#22c55e', // green-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#eab308', // yellow-500
  '#06b6d4', // cyan-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
];

// ─── Build Graph ─────────────────────────────────────────────────────

export function buildBranchGraph(
  branchCommitsMap: Map<string, CommitData[]>,
  branchList: BranchData[],
): BranchGraphData {
  // 1. Determine branch order: default first, then by last activity
  const defaultBranch = branchList.find(b => b.isDefault)?.name || 'main';
  const branchOrder = determineBranchOrder(branchCommitsMap, branchList, defaultBranch);

  // 2. Build color map
  const colorMap: Record<string, string> = {};
  branchOrder.forEach((name, i) => {
    colorMap[name] = LANE_COLORS[i % LANE_COLORS.length];
  });

  // 3. Assign each commit to its primary branch
  const commitBranchMap = assignCommitsToBranches(branchCommitsMap, branchOrder, defaultBranch);

  // 4. Deduplicate commits and build unified sorted list
  const allCommits = deduplicateAndSort(branchCommitsMap);

  // 5. Build lane map (branch → lane index)
  const laneMap: Record<string, number> = {};
  branchOrder.forEach((name, i) => { laneMap[name] = i; });

  // 6. Detect merges and forks
  const merges: MergePoint[] = [];
  const forks: ForkPoint[] = [];
  const shaIndex = new Map<string, BranchGraphNode>();

  // 7. Build nodes
  const nodes: BranchGraphNode[] = allCommits.map(c => {
    const branch = commitBranchMap.get(c.sha) || defaultBranch;
    const isMerge = c.parents.length > 1;

    const node: BranchGraphNode = {
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.message,
      author: c.author?.login || c.author?.name || 'Unknown',
      authorAvatar: c.author?.avatar_url,
      date: c.author?.date || new Date().toISOString(),
      branch,
      parents: c.parents,
      lane: laneMap[branch] ?? 0,
      isMerge,
      isFork: false,
      color: colorMap[branch] || LANE_COLORS[0],
    };

    shaIndex.set(c.sha, node);
    return node;
  });

  // 8. Detect merge points (commit has parents from different branches)
  for (const node of nodes) {
    if (node.parents.length > 1) {
      for (const parentSha of node.parents) {
        const parentNode = shaIndex.get(parentSha);
        if (parentNode && parentNode.branch !== node.branch) {
          merges.push({
            sha: node.sha,
            fromBranch: parentNode.branch,
            toBranch: node.branch,
            fromLane: laneMap[parentNode.branch] ?? 0,
            toLane: laneMap[node.branch] ?? 0,
          });
        }
      }
    }
  }

  // 9. Detect fork points (a commit whose child is on a different branch)
  const childMap = new Map<string, string[]>();
  for (const node of nodes) {
    for (const parentSha of node.parents) {
      const existing = childMap.get(parentSha) || [];
      existing.push(node.sha);
      childMap.set(parentSha, existing);
    }
  }

  for (const node of nodes) {
    const children = childMap.get(node.sha) || [];
    const branchChildren = children.filter(childSha => {
      const child = shaIndex.get(childSha);
      return child && child.branch !== node.branch;
    });

    if (branchChildren.length > 0) {
      node.isFork = true;
      for (const childSha of branchChildren) {
        const child = shaIndex.get(childSha);
        if (child) {
          forks.push({
            sha: node.sha,
            parentBranch: node.branch,
            childBranch: child.branch,
            parentLane: laneMap[node.branch] ?? 0,
            childLane: laneMap[child.branch] ?? 0,
          });
        }
      }
    }
  }

  return {
    nodes,
    merges,
    forks,
    branches: branchOrder,
    laneCount: branchOrder.length,
    colorMap,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function determineBranchOrder(
  branchCommitsMap: Map<string, CommitData[]>,
  branchList: BranchData[],
  defaultBranch: string,
): string[] {
  // Put default branch first, then sort by most recent commit date
  const branchDates: Array<{ name: string; date: number }> = [];

  for (const b of branchList) {
    const commits = branchCommitsMap.get(b.name) || [];
    const latestDate = commits.length > 0
      ? new Date(commits[0].author?.date || 0).getTime()
      : 0;
    branchDates.push({ name: b.name, date: latestDate });
  }

  branchDates.sort((a, b) => {
    if (a.name === defaultBranch) return -1;
    if (b.name === defaultBranch) return 1;
    return b.date - a.date;
  });

  return branchDates.map(b => b.name);
}

function assignCommitsToBranches(
  branchCommitsMap: Map<string, CommitData[]>,
  branchOrder: string[],
  defaultBranch: string,
): Map<string, string> {
  // Topology-aware assignment:
  // 1. Trace the default branch's first-parent chain (main line).
  // 2. For each non-default branch, trace first-parent chain from tip
  //    until it reaches the default main line (fork point).
  //    Commits between tip and fork point belong to that branch.
  // 3. Default main line commits belong to default.
  // 4. Any remaining commits assigned to first-seen branch.

  // Build SHA → CommitData lookup
  const lookup = new Map<string, CommitData>();
  for (const [, commits] of branchCommitsMap) {
    for (const c of commits) {
      if (!lookup.has(c.sha)) lookup.set(c.sha, c);
    }
  }

  // Trace default branch first-parent chain
  const defaultHead = branchCommitsMap.get(defaultBranch)?.[0];
  const defaultFirstParents = new Set<string>();
  if (defaultHead) {
    let cur: CommitData | undefined = defaultHead;
    while (cur) {
      defaultFirstParents.add(cur.sha);
      cur = cur.parents.length > 0 ? lookup.get(cur.parents[0]) : undefined;
    }
  }

  const result = new Map<string, string>();

  // 1. Non-default branches claim commits on their first-parent
  //    chain that are NOT on the default's main line.
  for (const branch of branchOrder) {
    if (branch === defaultBranch) continue;
    const commits = branchCommitsMap.get(branch) || [];
    const head = commits[0];
    if (!head) continue;

    let cur: CommitData | undefined = head;
    while (cur) {
      // Stop when we hit default's main line (common ancestor)
      if (defaultFirstParents.has(cur.sha)) break;
      if (!result.has(cur.sha)) {
        result.set(cur.sha, branch);
      }
      cur = cur.parents.length > 0 ? lookup.get(cur.parents[0]) : undefined;
    }
  }

  // 2. Default branch claims its first-parent chain
  for (const sha of defaultFirstParents) {
    if (!result.has(sha)) {
      result.set(sha, defaultBranch);
    }
  }

  // 3. Remaining unassigned commits → first branch that contains them
  for (const branch of branchOrder) {
    const commits = branchCommitsMap.get(branch) || [];
    for (const c of commits) {
      if (!result.has(c.sha)) {
        result.set(c.sha, branch);
      }
    }
  }

  return result;
}

function deduplicateAndSort(
  branchCommitsMap: Map<string, CommitData[]>,
): CommitData[] {
  const seen = new Set<string>();
  const all: CommitData[] = [];

  for (const [, commits] of branchCommitsMap) {
    for (const c of commits) {
      if (!seen.has(c.sha)) {
        seen.add(c.sha);
        all.push(c);
      }
    }
  }

  // Sort by date descending (newest first)
  all.sort((a, b) => {
    const da = new Date(a.author?.date || 0).getTime();
    const db = new Date(b.author?.date || 0).getTime();
    return db - da;
  });

  return all;
}
