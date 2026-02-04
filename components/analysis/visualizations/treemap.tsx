'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { FileNode } from '@/types';
import theme from '@/utils/themes';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';

export function Treemap() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 2000;
        const height = 1600;

        const hierarchyData = (() => {
            const root: any = { name: 'root', children: [] };
            data.files.forEach(file => {
                const parts = file.path.split('/');
                let current = root;
                parts.forEach((part, i) => {
                    let child = current.children.find((c: any) => c.name === part);
                    if (!child) {
                        child = { name: part, children: [] };
                        current.children.push(child);
                    }
                    if (i === parts.length - 1) {
                        // Ensure minimum value so all files are visible
                        child.value = Math.max(50, (file.functions?.length || 1) * 10 + (file.complexity?.score || 1));
                        child.filePath = file.path;
                        delete child.children;
                    }
                    current = child;
                });
            });
            return root;
        })();

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.value)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        d3.treemap()
            .size([width, height])
            .paddingInner(6)
            .paddingOuter(6)
            .paddingTop(28)
            .tile(d3.treemapSquarify.ratio(1))
            .round(true)(root);

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Add zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform.toString());
            });

        svg.call(zoom);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g');

        // Tooltip
        const tooltip = d3.select('body').selectAll('.treemap-tooltip').data([0])
            .join('div')
            .attr('class', 'treemap-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)');

        const color = d3.scaleOrdinal(theme.colors.visualization.palette);

        const leaf = g.selectAll('g')
            .data(root.leaves())
            .join('g')
            .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

        leaf.append('rect')
            .attr('fill', (d: any) => {
                let node = d;
                while (node.depth > 1) node = node.parent;
                return color(node.data.name);
            })
            .attr('fill-opacity', 0.8)
            .attr('stroke', theme.colors.border.strong)
            .attr('stroke-width', 2)
            .attr('width', (d: any) => Math.max(20, d.x1 - d.x0))
            .attr('height', (d: any) => Math.max(20, d.y1 - d.y0))
            .attr('rx', 4)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                d3.select(this).attr('stroke-width', 3).attr('stroke', theme.colors.primary.cyan['400']);
                const file = data.files.find(f => f.path === d.data.filePath);
                if (file) {
                    tooltip.style('visibility', 'visible')
                        .html(`
                            <div style="color: ${theme.colors.text.primary}">
                                <div style="font-weight: 600; color: ${theme.colors.primary.cyan['400']}">${file.name}</div>
                                <div style="margin-top: 4px; color: ${theme.colors.text.secondary}">
                                    ${file.functions?.length || 0} functions · ${file.lines || 0} lines
                                </div>
                                ${file.complexity ? `<div style="margin-top: 2px; color: ${theme.colors.text.accent}">Complexity: ${file.complexity.level}</div>` : ''}
                            </div>
                        `);
                }
            })
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY - 10) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('stroke-width', 2).attr('stroke', theme.colors.border.strong);
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
                const file = data.files.find(f => f.path === d.data.filePath);
                if (file) {
                    setSelectedFile(file);
                    setModalOpen(true);
                }
            });

        // Add text with proper clipping
        leaf.append('clipPath')
            .attr('id', (d: any, i: number) => `clip-${i}`)
            .append('rect')
            .attr('width', (d: any) => Math.max(0, d.x1 - d.x0 - 4))
            .attr('height', (d: any) => Math.max(0, d.y1 - d.y0 - 4))
            .attr('x', 2)
            .attr('y', 2);

        leaf.append('text')
            .attr('clip-path', (d: any, i: number) => `url(#clip-${i})`)
            .attr('x', 4)
            .attr('y', 16)
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('fill', theme.colors.text.primary)
            .text((d: any) => d.data.name);

        svg.selectAll('.title')
            .data(root.descendants().filter(d => d.depth === 1))
            .join('text')
            .attr('class', 'title')
            .attr('x', (d: any) => d.x0 + 5)
            .attr('y', (d: any) => d.y0 + 15)
            .attr('fill', '#ccc')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text((d: any) => d.data.name);

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
            <div className="w-full h-full overflow-auto p-4 bg-slate-950">
                <svg
                    ref={svgRef}
                    viewBox="0 0 2000 1600"
                    className="min-w-[2000px] min-h-[1600px]"
                    style={{ fontFamily: 'Inter, sans-serif', cursor: 'grab' }}
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
