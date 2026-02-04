'use client';

import { create } from 'zustand';
import { AnalysisData, ViewMode } from '@/types';

interface AnalysisState {
    data: AnalysisData | null;
    loading: boolean;
    error: string | null;
    viewMode: ViewMode;
    selectedFile: string | null;
    selectedFunction: string | null;
    filterFolder: string | null;

    setData: (data: AnalysisData | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setViewMode: (mode: ViewMode) => void;
    setSelectedFile: (file: string | null) => void;
    setSelectedFunction: (fn: string | null) => void;
    setFilterFolder: (folder: string | null) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
    data: null,
    loading: false,
    error: null,
    viewMode: 'force',
    selectedFile: null,
    selectedFunction: null,
    filterFolder: null,

    setData: (data) => set({ data }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSelectedFile: (selectedFile) => set({ selectedFile }),
    setSelectedFunction: (selectedFunction) => set({ selectedFunction }),
    setFilterFolder: (filterFolder) => set({ filterFolder }),
}));
