'use client';

import { create } from 'zustand';
import { AnalysisData, ViewMode, AppMode, ProcessDetectionResult } from '@/types';
import { AISettings, ChatSession, AIMessage, GeneratedDiagram } from '@/types/ai';
import { BranchData, ContributorData, CommitData, PRListItem } from '@/types/git';
import { FetchMode } from '@/lib/analyzer';

export type AnalysisTab = 'scope' | 'prs' | 'api' | 'analytics' | 'lens' | 'chart' | 'info' | 'mcp';

interface AnalysisState {
    // Core analysis
    data: AnalysisData | null;
    loading: boolean;
    error: string | null;
    viewMode: ViewMode;
    selectedFile: string | null;
    selectedFunction: string | null;
    filterFolder: string | null;

    // Hybrid mode
    mode: AppMode;

    // Navigation
    activeTab: AnalysisTab;
    repo: string;
    owner: string;
    repoName: string;

    // Branch support
    branches: BranchData[];
    selectedBranch: string;
    defaultBranch: string;

    // Git intelligence
    contributors: ContributorData[];
    commits: CommitData[];
    prs: PRListItem[];

    // Multi-branch graph
    branchCommits: Map<string, CommitData[]> | null;

    // Fetch settings
    fetchMode: FetchMode;
    githubToken: string;

    // AI settings
    aiSettings: AISettings;
    chatSession: ChatSession | null;
    diagrams: GeneratedDiagram[];

    // Process detection
    processes: ProcessDetectionResult | null;

    // DeepWiki / MCP
    hasDeepWiki: boolean;

    // Actions - Core
    setData: (data: AnalysisData | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setViewMode: (mode: ViewMode) => void;
    setSelectedFile: (file: string | null) => void;
    setSelectedFunction: (fn: string | null) => void;
    setFilterFolder: (folder: string | null) => void;

    // Actions - Mode
    setMode: (mode: AppMode) => void;

    // Actions - Navigation
    setActiveTab: (tab: AnalysisTab) => void;
    setRepo: (repo: string) => void;

    // Actions - Fetch
    setFetchMode: (mode: FetchMode) => void;
    setGithubToken: (token: string) => void;

    // Actions - Branch
    setBranches: (branches: BranchData[]) => void;
    setSelectedBranch: (branch: string) => void;

    // Actions - Git
    setContributors: (contributors: ContributorData[]) => void;
    setCommits: (commits: CommitData[]) => void;
    setPRs: (prs: PRListItem[]) => void;
    setBranchCommits: (map: Map<string, CommitData[]>) => void;

    // Actions - AI
    setAISettings: (settings: Partial<AISettings>) => void;
    setChatSession: (session: ChatSession | null) => void;
    addChatMessage: (message: AIMessage) => void;
    addDiagram: (diagram: GeneratedDiagram) => void;
    setDiagrams: (diagrams: GeneratedDiagram[]) => void;

    // Actions - Processes
    setProcesses: (result: ProcessDetectionResult | null) => void;

    // Actions - DeepWiki
    setHasDeepWiki: (has: boolean) => void;
}

// Load AI settings from localStorage
function loadAISettings(): AISettings {
    if (typeof window === 'undefined') return { provider: 'openai', apiKey: '' };
    try {
        const stored = localStorage.getItem('codescope_ai_settings');
        if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { provider: 'openai', apiKey: '' };
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
    // Core
    data: null,
    loading: false,
    error: null,
    viewMode: 'force',
    selectedFile: null,
    selectedFunction: null,
    filterFolder: null,

    // Hybrid mode
    mode: (typeof window !== 'undefined'
        ? (localStorage.getItem('codescope_mode') as AppMode | null) || 'simple'
        : 'simple') as AppMode,

    // Navigation
    activeTab: 'scope',
    repo: '',
    owner: '',
    repoName: '',

    // Fetch settings
    fetchMode: (typeof window !== 'undefined'
        ? (localStorage.getItem('codescope_fetch_mode') as FetchMode | null) || 'tarball'
        : 'tarball') as FetchMode,
    githubToken: (typeof window !== 'undefined'
        ? sessionStorage.getItem('github_token') || localStorage.getItem('github_token') || ''
        : ''),

    // Branch
    branches: [],
    selectedBranch: '',
    defaultBranch: 'main',

    // Git
    contributors: [],
    commits: [],
    prs: [],
    branchCommits: null,

    // AI
    aiSettings: loadAISettings(),
    chatSession: null,
    diagrams: [],

    // Processes
    processes: null,

    // DeepWiki
    hasDeepWiki: false,

    // Core actions
    setData: (data) => set({ data }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSelectedFile: (selectedFile) => set({ selectedFile }),
    setSelectedFunction: (selectedFunction) => set({ selectedFunction }),
    setFilterFolder: (filterFolder) => set({ filterFolder }),

    // Mode actions
    setMode: (mode) => {
        set({ mode });
        try { localStorage.setItem('codescope_mode', mode); } catch { /* */ }
    },

    // Navigation actions
    setActiveTab: (activeTab) => set({ activeTab }),
    setRepo: (repo) => {
        const parts = repo.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '').split('/');
        set({
            repo,
            owner: parts[0] || '',
            repoName: parts[1] || '',
        });
    },

    // Fetch actions
    setFetchMode: (fetchMode) => {
        set({ fetchMode });
        try { localStorage.setItem('codescope_fetch_mode', fetchMode); } catch { /* */ }
    },
    setGithubToken: (githubToken) => {
        set({ githubToken });
        try {
            sessionStorage.setItem('github_token', githubToken);
            // Also persist to localStorage so login survives browser restarts
            if (githubToken) {
                localStorage.setItem('github_token', githubToken);
            } else {
                localStorage.removeItem('github_token');
            }
        } catch { /* */ }
    },

    // Branch actions
    setBranches: (branches) => {
        const defaultB = branches.find(b => b.isDefault);
        set({
            branches,
            defaultBranch: defaultB?.name || 'main',
            selectedBranch: get().selectedBranch || defaultB?.name || 'main',
        });
    },
    setSelectedBranch: (selectedBranch) => set({ selectedBranch }),

    // Git actions
    setContributors: (contributors) => set({ contributors }),
    setCommits: (commits) => set({ commits }),
    setPRs: (prs) => set({ prs }),
    setBranchCommits: (branchCommits) => set({ branchCommits }),

    // AI actions
    setAISettings: (settings) => {
        const newSettings = { ...get().aiSettings, ...settings };
        set({ aiSettings: newSettings });
        try {
            localStorage.setItem('codescope_ai_settings', JSON.stringify(newSettings));
        } catch { /* ignore */ }
    },
    setChatSession: (chatSession) => set({ chatSession }),
    addChatMessage: (message) => {
        const session = get().chatSession;
        if (session) {
            set({
                chatSession: {
                    ...session,
                    messages: [...session.messages, message],
                },
            });
        }
    },
    addDiagram: (diagram) => set({ diagrams: [...get().diagrams, diagram] }),
    setDiagrams: (diagrams) => set({ diagrams }),

    // Process actions
    setProcesses: (processes) => set({ processes }),

    // DeepWiki actions
    setHasDeepWiki: (hasDeepWiki) => set({ hasDeepWiki }),
}));
