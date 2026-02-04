'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';
import theme from '@/utils/themes';

export function Sankey() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 800;
        const height = 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.5, 5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom as any);

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
        const nodeMap = new Map();
        const nodes = files.map((f, i) => {
            const node = { name: f.name, id: f.path };
            nodeMap.set(f.path, i);
            return node;
        });

        // Create links and detect circular paths
        const linkMap = new Map<string, boolean>();
        const links = data.connections
            .filter(c => nodeMap.has(c.source) && nodeMap.has(c.target) && c.source !== c.target)
            .map(c => ({
                source: nodeMap.get(c.source)!,
                target: nodeMap.get(c.target)!,
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

        const generator = d3Sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 5]]);

        const { nodes: sNodes, links: sLinks } = generator({
            nodes: nodes.map(d => Object.assign({}, d)),
            links: links.map(d => Object.assign({}, d))
        } as any);

        const color = d3.scaleOrdinal(theme.colors.visualization.palette);

        g.append('g')
            .attr('stroke', theme.colors.border.accent)
            .attr('stroke-opacity', 0.6)
            .selectAll('rect')
            .data(sNodes)
            .join('rect')
            .attr('x', (d: any) => d.x0)
            .attr('y', (d: any) => d.y0)
            .attr('height', (d: any) => d.y1 - d.y0)
            .attr('width', (d: any) => d.x1 - d.x0)
            .attr('fill', (d: any) => color(d.name))
            .attr('opacity', 0.9)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                d3.select(this).attr('stroke', theme.colors.text.accent).attr('stroke-width', 3);
                const file = files.find(f => f.name === d.name);
                const incomingLinks = (sLinks as any[]).filter(l => l.target.name === d.name).length;
                const outgoingLinks = (sLinks as any[]).filter(l => l.source.name === d.name).length;
                
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
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', '#000').attr('stroke-width', 0);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
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
            .attr('d', sankeyLinkHorizontal())
            .attr('stroke', (d: any) => color(d.source.name))
            .attr('stroke-width', (d: any) => Math.max(2, d.width))
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
            .attr('x', (d: any) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr('y', (d: any) => (d.y1 + d.y0) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', (d: any) => d.x0 < width / 2 ? 'start' : 'end')
            .attr('fill', theme.colors.text.primary)
            .attr('stroke', theme.colors.background.dark)
            .attr('stroke-width', 0.5)
            .attr('paint-order', 'stroke')
            .text((d: any) => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name);

    }, [data]);

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
