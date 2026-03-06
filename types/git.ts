// Git-related types for commits, branches, contributors, blame, PRs, tags

export interface CommitData {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
    login?: string;
    avatar_url?: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: CommitFile[];
  parents: string[];
}

export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface BranchData {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
  aheadBy?: number;
  behindBy?: number;
  lastCommitDate?: string;
  lastCommitter?: string;
}

export interface ContributorData {
  login: string;
  name?: string;
  avatar_url: string;
  contributions: number;
  additions?: number;
  deletions?: number;
  commits: number;
  firstCommit?: string;
  lastCommit?: string;
  filesModified?: number;
  topLanguages?: string[];
}

export interface BlameHunk {
  startLine: number;
  endLine: number;
  commit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  lines: string[];
}

export interface FileDiff {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  previousFilename?: string;
}

export interface TagData {
  name: string;
  sha: string;
  message?: string;
  date: string;
  author?: string;
  isRelease: boolean;
  releaseBody?: string;
}

export interface PRListItem {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{ name: string; color: string }>;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  draft: boolean;
  reviewDecision?: string;
  headBranch: string;
  baseBranch: string;
  body?: string;
}

export interface PRDetail extends PRListItem {
  files: FileDiff[];
  commits: CommitData[];
  reviews: PRReview[];
  comments: PRComment[];
  checksStatus?: 'success' | 'failure' | 'pending' | 'neutral';
}

export interface PRReview {
  author: string;
  avatar_url: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING';
  body: string;
  submittedAt: string;
}

export interface PRComment {
  author: string;
  avatar_url: string;
  body: string;
  createdAt: string;
  path?: string;
  line?: number;
}

export interface BranchComparison {
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: FileDiff[];
  commits: CommitData[];
}

export type PRStateFilter = 'all' | 'open' | 'closed' | 'merged';

// ─── Branch Graph Types ──────────────────────────────────────────────

export interface BranchGraphNode {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorAvatar?: string;
  date: string;
  branch: string;
  parents: string[];
  lane: number;
  isMerge: boolean;
  isFork: boolean;
  color: string;
}

export interface MergePoint {
  sha: string;
  fromBranch: string;
  toBranch: string;
  fromLane: number;
  toLane: number;
}

export interface ForkPoint {
  sha: string;
  parentBranch: string;
  childBranch: string;
  parentLane: number;
  childLane: number;
}

export interface BranchGraphData {
  nodes: BranchGraphNode[];
  merges: MergePoint[];
  forks: ForkPoint[];
  branches: string[];
  laneCount: number;
  colorMap: Record<string, string>;
}

export interface BranchAnalysis {
  name: string;
  aheadBy: number;
  behindBy: number;
  commitCount: number;
  contributors: string[];
  lastActivity: string;
  isDefault: boolean;
  isProtected: boolean;
}
