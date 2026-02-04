'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal, type SankeyNode, type SankeyLink, type SankeyGraph } from 'd3-sankey';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';
import theme from '@/utils/themes';

export function Sankey() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 800;
        const height = 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                g.attr('transform', event.transform.toString());
            });

        svg.call(zoom);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g');

        // Tooltip
        const tooltip = d3.select('body').selectAll('.sankey-tooltip').data([0])
            .join('div')
            .attr('class', 'sankey-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        const files = data.files.filter(f => f.isCode).slice(0, 30);
        type SankeyNodeData = { name: string; id: string };
        type SankeyLinkData = { source: number; target: number; value: number };

        const nodeMap = new Map<string, number>();
        const nodes: SankeyNodeData[] = files.map((f, i) => {
            nodeMap.set(f.path, i);
            return { name: f.name, id: f.path };
        });

        // Create links and detect circular paths
        const linkMap = new Map<string, boolean>();
        const links: SankeyLinkData[] = data.connections
            .filter(c => nodeMap.has(c.source) && nodeMap.has(c.target) && c.source !== c.target)
            .map(c => ({
                source: nodeMap.get(c.source) ?? 0,
                target: nodeMap.get(c.target) ?? 0,
                value: c.count || 1
            }))
            .filter((link, index, self) => {
                // Deduplicate
                if (index !== self.findIndex(l => l.source === link.source && l.target === link.target)) {
                    return false;
                }
                // Remove circular links (if A->B exists, remove B->A)
                const key = `${link.source}-${link.target}`;
                const reverseKey = `${link.target}-${link.source}`;
                if (linkMap.has(reverseKey)) {
                    return false;
                }
                linkMap.set(key, true);
                return true;
            });

        if (nodes.length === 0 || links.length === 0) return;

        const generator = d3Sankey<SankeyNodeData, SankeyLinkData>()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 5]]);

        const graph: SankeyGraph<SankeyNodeData, SankeyLinkData> = {
            nodes: nodes.map(d => ({ ...d })),
            links: links.map(d => ({ ...d })),
        };

        const { nodes: sNodes, links: sLinks } = generator(graph);

        const color = d3.scaleOrdinal(theme.colors.visualization.palette);

        g.append('g')
            .attr('stroke', theme.colors.border.accent)
            .attr('stroke-opacity', 0.6)
            .selectAll('rect')
            .data(sNodes)
            .join('rect')
            .attr('x', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.x0 ?? 0)
            .attr('y', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.y0 ?? 0)
            .attr('height', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.y1 ?? 0) - (d.y0 ?? 0))
            .attr('width', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x1 ?? 0) - (d.x0 ?? 0))
            .attr('fill', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => color(d.name))
            .attr('opacity', 0.9)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: MouseEvent, d: SankeyNode<SankeyNodeData, SankeyLinkData>) {
                d3.select(this).attr('stroke', theme.colors.text.accent).attr('stroke-width', 3);
                const file = files.find(f => f.name === d.name);
                const incomingLinks = sLinks.filter(l => (l.target as SankeyNode<SankeyNodeData, SankeyLinkData>).name === d.name).length;
                const outgoingLinks = sLinks.filter(l => (l.source as SankeyNode<SankeyNodeData, SankeyLinkData>).name === d.name).length;
                
                tooltip.style('visibility', 'visible')
                    .html(`<div style="color: ${theme.colors.text.primary}">
                        <div style="font-weight: 600; color: ${theme.colors.text.accent}; font-size: 13px; margin-bottom: 6px">${d.name}</div>
                        <div style="display: grid; grid-template-columns: auto auto; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 1px solid ${theme.colors.border.accent}">
                            <div><span style="color: ${theme.colors.text.secondary}">Size:</span> <span style="color: ${theme.colors.text.accent}">${file ? (file.size / 1024).toFixed(1) + ' KB' : 'N/A'}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Lines:</span> <span style="color: ${theme.colors.text.accent}">${file?.lines ?? 0}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Imports:</span> <span style="color: ${theme.colors.text.accent}">${incomingLinks}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Exports:</span> <span style="color: ${theme.colors.text.accent}">${outgoingLinks}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Functions:</span> <span style="color: ${theme.colors.text.accent}">${file?.functions?.length || 0}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Flow:</span> <span style="color: ${theme.colors.text.accent}">${d.value}</span></div>
                        </div>
                    </div>`);
            })
            .on('mousemove', (event: MouseEvent) => {
                tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', '#000').attr('stroke-width', 0);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: MouseEvent, d: SankeyNode<SankeyNodeData, SankeyLinkData>) => {
                const file = files.find(f => f.name === d.name);
                if (file) {
                    setSelectedFile(file);
                    setModalOpen(true);
                }
            });

        const link = g.append('g')
            .attr('fill', 'none')
            .attr('stroke-opacity', 0.4)
            .selectAll('g')
            .data(sLinks)
            .join('g')
            .style('mix-blend-mode', 'multiply');

        link.append('path')
            .attr('d', sankeyLinkHorizontal<SankeyNodeData, SankeyLinkData>())
            .attr('stroke', (d: SankeyLink<SankeyNodeData, SankeyLinkData>) => color((d.source as SankeyNode<SankeyNodeData, SankeyLinkData>).name))
            .attr('stroke-width', (d: SankeyLink<SankeyNodeData, SankeyLinkData>) => Math.max(2, d.width || 1))
            .on('mouseover', function() {
                d3.select(this).attr('stroke-opacity', 0.8);
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke-opacity', 1);
            });

        g.append('g')
            .attr('font-size', 11)
            .attr('font-weight', 500)
            .selectAll('text')
            .data(sNodes)
            .join('text')
            .attr('x', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6)
            .attr('y', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => ((d.y1 ?? 0) + (d.y0 ?? 0)) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', (d: SankeyNode<SankeyNodeData, SankeyLinkData>) => (d.x0 ?? 0) < width / 2 ? 'start' : 'end')
            .attr('fill', theme.colors.text.primary)
            .attr('stroke', theme.colors.background.dark)
            .attr('stroke-width', 0.5)
            .attr('paint-order', 'stroke')
            .text((d: SankeyNode<SankeyNodeData, SankeyLinkData>) => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name);

    }, [data]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ action: string }>).detail;
            if (!detail?.action || !zoomRef.current || !svgSelectionRef.current) return;
            const svg = svgSelectionRef.current;
            const zoom = zoomRef.current;
            if (detail.action === 'reset') {
                svg.transition().duration(250).call(zoom.transform as any, d3.zoomIdentity);
                return;
            }
            if (detail.action === 'zoom-in') {
                svg.transition().duration(200).call(zoom.scaleBy as any, 1.2);
            }
            if (detail.action === 'zoom-out') {
                svg.transition().duration(200).call(zoom.scaleBy as any, 0.8);
            }
        };
        window.addEventListener('viz-control', handler as EventListener);
        return () => window.removeEventListener('viz-control', handler as EventListener);
    }, []);

    return (
        <>
            <div className="w-full h-full flex items-center justify-center p-4">
                <svg
                    ref={svgRef}
                    viewBox="0 0 800 600"
                    className="w-full h-full max-w-[800px] max-h-[600px]"
                    style={{ cursor: 'grab' }}
                />
            </div>
            <NodeDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                file={selectedFile}
                connections={selectedFile ? {
                    imports: data?.connections.filter(c => c.target === selectedFile.path).length || 0,
                    exports: data?.connections.filter(c => c.source === selectedFile.path).length || 0
                } : undefined}
            />
        </>
    );
}
