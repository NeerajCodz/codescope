'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';
import theme from '@/utils/themes';

export function Arc() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 800;
        const height = 400;
        const margin = { top: 20, right: 30, bottom: 50, left: 30 };

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g');

        // Tooltip
        const tooltip = d3.select('body').selectAll('.arc-tooltip').data([0])
            .join('div')
            .attr('class', 'arc-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        const files = data.files.filter(f => f.isCode).slice(0, 40);
        const n = files.length;

        const x = d3.scalePoint()
            .range([margin.left, width - margin.right])
            .domain(files.map(f => f.path));

        // Links
        const links = data.connections
            .filter(c => files.some(f => f.path === c.source) && files.some(f => f.path === c.target));

        g.append('g')
            .attr('fill', 'none')
            .attr('stroke', theme.colors.visualization.edges.default)
            .attr('stroke-opacity', 0.3)
            .selectAll('path')
            .data(links)
            .join('path')
            .attr('stroke-width', 1.5)
            .attr('d', (d: any) => {
                const start = x(d.source)!;
                const end = x(d.target)!;
                return `M${start},${height - margin.bottom} A${Math.abs(end - start) / 2},${Math.abs(end - start) / 2} 0 0,${start < end ? 1 : 0} ${end},${height - margin.bottom}`;
            })
            .on('mouseover', function() {
                d3.select(this).attr('stroke', theme.colors.text.accent).attr('stroke-opacity', 0.7).attr('stroke-width', 2);
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', theme.colors.visualization.edges.default).attr('stroke-opacity', 0.3).attr('stroke-width', 1.5);
            });

        // Nodes
        g.append('g')
            .selectAll('circle')
            .data(files)
            .join('circle')
            .attr('cx', (d: any) => x(d.path)!)
            .attr('cy', height - margin.bottom)
            .attr('r', 5)
            .attr('fill', (d: any) => theme.getNodeColor(d.path))
            .attr('stroke', theme.colors.border.accent)
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                d3.select(this).attr('r', 8).attr('fill', theme.colors.text.accent).attr('stroke-width', 2);
                const connectionCount = links.filter(l => l.source === d.path || l.target === d.path).length;
                tooltip.style('visibility', 'visible')
                    .html(`<div style="color: ${theme.colors.text.primary}">
                        <div style="font-weight: 600; color: ${theme.colors.text.accent}; font-size: 13px; margin-bottom: 6px">${d.name}</div>
                        <div style="color: ${theme.colors.text.secondary}; font-size: 11px; margin-bottom: 6px">${d.path}</div>
                        <div style="display: grid; grid-template-columns: auto auto; gap: 6px; padding-top: 6px; border-top: 1px solid ${theme.colors.border.accent}">
                            <div><span style="color: ${theme.colors.text.secondary}">Size:</span> <span style="color: ${theme.colors.text.accent}">${(d.size / 1024).toFixed(1)} KB</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Lines:</span> <span style="color: ${theme.colors.text.accent}">${d.lines ?? 0}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Functions:</span> <span style="color: ${theme.colors.text.accent}">${d.functions?.length || 0}</span></div>
                            <div><span style="color: ${theme.colors.text.secondary}">Connections:</span> <span style="color: ${theme.colors.text.accent}">${connectionCount}</span></div>
                        </div>
                    </div>`);
            })
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function(event: any, d: any) {
                d3.select(this)
                    .attr('r', 5)
                    .attr('fill', theme.getNodeColor(d.path))
                    .attr('stroke-width', 1.5);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
                setSelectedFile(d);
                setModalOpen(true);
            });

        // Labels
        g.append('g')
            .selectAll('text')
            .data(files)
            .join('text')
            .attr('transform', (d: any) => `translate(${x(d.path)},${height - margin.bottom + 10}) rotate(45)`)
            .attr('text-anchor', 'start')
            .attr('font-size', '9px')
            .attr('font-weight', 500)
            .attr('fill', theme.colors.text.primary)
            .attr('stroke', theme.colors.background.dark)
            .attr('stroke-width', 0.3)
            .attr('paint-order', 'stroke')
            .text((d: any) => d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name);

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
                    viewBox="0 0 800 400"
                    className="w-full h-full max-w-[800px] max-h-[400px]"
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
