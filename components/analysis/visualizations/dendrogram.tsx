'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { NodeDetailsModal } from '@/components/modals/node-details-modal';
import { FileNode } from '@/types';
import theme from '@/utils/themes';

export function Dendrogram() {
    const { data } = useAnalysisStore();
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    useEffect(() => {
        if (!data || !svgRef.current) return;

        const width = 800;
        const height = 800;
        const radius = width / 2;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5])
            .on('zoom', (event) => {
                const currentTransform = event.transform;
                g.attr('transform', `translate(${radius + currentTransform.x},${radius + currentTransform.y}) scale(${currentTransform.k})`);
            });

        svg.call(zoom);
        svgSelectionRef.current = svg;
        zoomRef.current = zoom;

        const g = svg.append('g')
            .attr('transform', `translate(${radius},${radius})`);

        // Tooltip
        const tooltip = d3.select('body').selectAll('.dendrogram-tooltip').data([0])
            .join('div')
            .attr('class', 'dendrogram-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', theme.colors.background.card)
            .style('border', `1px solid ${theme.colors.border.accent}`)
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        const buildHierarchy = (files: any[]) => {
            const root: any = { name: 'root', children: [] };
            files.slice(0, 100).forEach(file => {
                const parts = file.path.split('/');
                let current = root;
                parts.forEach((part: string) => {
                    let child = current.children.find((c: any) => c.name === part);
                    if (!child) {
                        child = { name: part, children: [] };
                        current.children.push(child);
                    }
                    current = child;
                });
                current.path = file.path;
            });
            return root;
        };

        const root = d3.hierarchy(buildHierarchy(data.files));
        const tree = d3.cluster().size([360, radius - 100]);
        tree(root as any);

        const link = g.append('g')
            .attr('fill', 'none')
            .attr('stroke', '#1e293b')
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1)
            .selectAll('path')
            .data(root.links())
            .join('path')
            .attr('d', d3.linkRadial()
                .angle((d: any) => d.x * Math.PI / 180)
                .radius((d: any) => d.y) as any);

        const node = g.append('g')
            .selectAll('g')
            .data(root.descendants())
            .join('g')
            .attr('transform', (d: any) => `rotate(${d.x - 90}) translate(${d.y},0)`);

        node.append('circle')
            .attr('fill', (d: any) => d.children ? '#3b82f6' : '#94a3b8')
            .attr('r', 2.5);

        node.append('text')
            .attr('dy', '0.31em')
            .attr('x', (d: any) => d.x < 180 === !d.children ? 6 : -6)
            .attr('text-anchor', (d: any) => d.x < 180 === !d.children ? 'start' : 'end')
            .attr('transform', (d: any) => d.x >= 180 ? 'rotate(180)' : null)
            .attr('font-size', '8px')
            .attr('fill', '#ccc')
            .text((d: any) => d.data.name)
            .clone(true).lower()
            .attr('stroke', '#000')
            .attr('stroke-width', 3);

        node.filter((d: any) => !d.children)
            .style('cursor', 'pointer')
            .on('mouseover', function(event: any, d: any) {
                const file = data.files.find(f => f.path === d.data.path);
                if (!file) return;
                d3.select(this).select('circle').attr('fill', theme.colors.text.accent);
                tooltip.style('visibility', 'visible')
                    .html(`<div style="color: ${theme.colors.text.primary}">
                        <div style="font-weight: 600; color: ${theme.colors.text.accent}; font-size: 13px; margin-bottom: 6px">${file.name}</div>
                        <div style="color: ${theme.colors.text.secondary}; font-size: 11px; margin-bottom: 6px">${file.path}</div>
                        <div style="display: grid; grid-template-columns: auto auto; gap: 6px; padding-top: 6px; border-top: 1px solid ${theme.colors.border.accent}">
                            <div><span style="color: ${theme.colors.text.secondary}">Lines:</span> ${file.lines ?? 0}</div>
                            <div><span style="color: ${theme.colors.text.secondary}">Functions:</span> ${file.functions?.length || 0}</div>
                        </div>
                    </div>`);
            })
            .on('mousemove', (event: any) => {
                tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).select('circle').attr('fill', '#94a3b8');
                tooltip.style('visibility', 'hidden');
            })
            .on('click', (event: any, d: any) => {
                const file = data.files.find(f => f.path === d.data.path);
                if (file) {
                    setSelectedFile(file);
                    setModalOpen(true);
                }
            });

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
                    viewBox="0 0 800 800"
                    className="w-full h-full max-w-[800px] max-h-[800px]"
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
