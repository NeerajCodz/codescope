export interface FileNode {
    path: string;
    name: string;
    folder: string;
    size: number;
    isCode: boolean;
    content?: string;
    functions?: FunctionDef[];
    variables?: VariableDef[];
    lines?: number;
    layer?: string;
    complexity?: ComplexityScore;
    securityIssues?: SecurityIssue[];
    rawImports?: string[];
    children?: FileNode[];
}

export interface FunctionCallSite {
    line: number;
    caller?: string;
    file?: string;
}

export interface FunctionDef {
    name: string;
    file: string;
    line: number;
    code: string;
    isTopLevel?: boolean;
    isExported?: boolean;
    type?: 'function' | 'arrow' | 'method';
    isClassMethod?: boolean;
    params?: string[];
    returnType?: string;
    returnsValue?: boolean;
    calls?: number;
    calledBy?: string[];
    callSites?: FunctionCallSite[]; // All places where this function is called
    totalCalls?: number; // Total number of calls to this function
    isDead?: boolean;
}

export interface VariableDef {
    name: string;
    file: string;
    line: number;
    kind: 'const' | 'let' | 'var' | 'unknown';
    valueType?: string;
    isTopLevel?: boolean;
    usageLines?: number[];
    totalUsages?: number;
}

export interface Connection {
    source: string;
    target: string;
    fn: string;
    count: number;
    lines?: number[]; // Line numbers where calls happen
}

export interface ComplexityScore {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
}

export interface Pattern {
    name: string;
    icon: string;
    desc: string;
    severity: 'info' | 'warning';
    isAnti?: boolean;
    files: { name: string; path: string; fns?: number; lines?: number }[];
    metrics: Record<string, number>;
}

export interface SecurityIssue {
    severity: 'low' | 'medium' | 'high';
    title: string;
    file: string;
    path: string;
    line?: number;
    desc: string;
    code?: string;
}

export interface BlastRadius {
    affected: string[];
    transitive: string[];
    count: number;
    transitiveCount: number;
    percent: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    depth: number;
    fnsUsed: number;
    totalCalls: number;
    dependencies: string[];
    impactScore: number;
    centrality: number;
}

export interface HealthScore {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface AnalysisData {
    files: FileNode[];
    connections: Connection[];
    stats: {
        files: number;
        codeFiles: number;
        functions: number;
        dead: number;
        connections: number;
        avgComplexity: number;
    };
    issues: Array<{
        title: string;
        desc: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        file?: string;
        path?: string;
    }>;
    patterns: Pattern[];
    securityIssues: SecurityIssue[];
    duplicates?: Array<{
        type: 'name' | 'code';
        name: string;
        count: number;
        files: Array<{ file: string; name?: string; line: number }>;
        similarity: number;
        suggestion: string;
    }>;
    layerViolations?: Array<{
        from: string;
        fromLayer: string;
        to: string;
        toLayer: string;
        fn: string;
        suggestion: string;
    }>;
    languages?: Record<string, number>;
    totalLines?: number;
}

export interface TreeNode {
    name: string;
    path: string;
    children: Record<string, TreeNode>;
    files: FileNode[];
}

export interface Suggestion {
    priority: 'low' | 'medium' | 'high' | 'critical';
    icon: string;
    title: string;
    desc: string;
    action: string;
    impact: string;
}

export interface PRData {
    number: number;
    title: string;
    additions: number;
    deletions: number;
    changed_files: number;
    files: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
    }>;
}

export interface PRRisk {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    totalBlast: number;
    hotspots: Array<{ file: string; blast: number }>;
}

export type ViewMode =
    | 'force'
    | 'cluster'
    | 'treemap'
    | 'matrix'
    | 'dendrogram'
    | 'sankey'
    | 'bundle'
    | 'arc'
    | 'force3d';

// ── Hybrid Mode ──
export type AppMode = 'simple' | 'advanced';

// ── Process Detection ──
export interface ProcessNode {
    id: string;
    label: string;
    entryPoint: string;
    terminal: string[];
    processType: string;
    stepCount: number;
    clusters: number[];
    trace: string[];          // ordered node IDs
    traceFiles: string[];     // corresponding file paths
    isCrossFile?: boolean;    // spans multiple files
    isCrossFolder?: boolean;  // spans multiple folders
}

export interface ProcessStep {
    id: string;
    label: string;
    file: string;
    depth: number;
    isEntry: boolean;
    isTerminal: boolean;
}

export interface ProcessDetectionResult {
    processes: ProcessNode[];
    totalEntryPoints: number;
    totalTerminals: number;
    avgChainLength: number;
    crossFileCount?: number;
    intraFileCount?: number;
}

// ── Unified Export / Import ──

/**
 * Complete CodeScope project export containing ALL analysis data.
 * Used for full save/restore, import/export, and local caching.
 */
export interface CodeScopeExport {
    /** Schema version for forward compatibility */
    version: number;
    /** Timestamp of the export */
    exportedAt: string;
    /** Repository identifier (owner/repo) */
    repo: string;
    /** Branch that was selected at time of export */
    selectedBranch: string;
    /** Default branch name */
    defaultBranch: string;
    /** App mode used during analysis */
    mode: AppMode;

    // ── Core Analysis ──
    analysis: AnalysisData | null;

    // ── Git Intelligence ──
    branches: import('@/types/git').BranchData[];
    commits: import('@/types/git').CommitData[];
    contributors: import('@/types/git').ContributorData[];
    prs: import('@/types/git').PRListItem[];
    /** Per-branch commit lists for multi-branch graph */
    branchCommits: Record<string, import('@/types/git').CommitData[]> | null;

    // ── Process Detection ──
    processes: ProcessDetectionResult | null;

    // ── AI / Diagrams ──
    diagrams: import('@/types/ai').GeneratedDiagram[];
    aiSettings?: Partial<import('@/types/ai').AISettings>;
    chatSession?: import('@/types/ai').ChatSession | null;

    // ── API Analysis ──
    apiAnalysis?: {
        created: import('@/types/apiAnalysis').CreatedAPI[];
        used: import('@/types/apiAnalysis').UsedAPI[];
        stats: import('@/types/apiAnalysis').APIStats;
        services: import('@/types/apiAnalysis').ServiceGroup[];
    } | null;

    // ── View / UI State ──
    viewMode: ViewMode;
}
