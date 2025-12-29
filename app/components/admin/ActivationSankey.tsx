"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';

interface ActivationSankeyProps {
  users: Array<{
    uid: string;
    milestones: Record<string, boolean>;
  }>;
  milestones: string[];
  milestoneLabels: Record<string, string>;
}

interface NodeData {
  id: string;
  label: string;
  count: number;
  percent: number;
  x: number;
  y: number;
  height: number;
}

interface LinkData {
  source: string;
  target: string;
  value: number;
  sourceY: number;
  targetY: number;
  thickness: number;
}

export function ActivationSankey({ users, milestones, milestoneLabels }: ActivationSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 600),
          height: 350,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { nodes, links, stats } = useMemo(() => {
    if (!users.length || !milestones.length) {
      return { nodes: [], links: [], stats: { total: 0, fullyActivated: 0, conversionRate: 0 } };
    }

    const total = users.length;
    const nodeWidth = 12;
    const padding = { top: 40, right: 120, bottom: 60, left: 60 };
    const availableWidth = dimensions.width - padding.left - padding.right;
    const availableHeight = dimensions.height - padding.top - padding.bottom;

    // Calculate counts for each milestone
    const milestoneCounts = milestones.map(m => ({
      id: m,
      label: milestoneLabels[m] || m,
      count: users.filter(u => u.milestones[m]).length,
    }));

    // Find max count for scaling
    const maxCount = Math.max(...milestoneCounts.map(m => m.count), 1);

    // Create nodes with positions
    const nodeSpacing = availableWidth / (milestones.length - 1 || 1);
    const nodes: NodeData[] = milestoneCounts.map((m, i) => {
      const height = Math.max((m.count / maxCount) * availableHeight * 0.8, 4);
      return {
        id: m.id,
        label: m.label,
        count: m.count,
        percent: total > 0 ? Math.round((m.count / total) * 100) : 0,
        x: padding.left + (i * nodeSpacing),
        y: padding.top + (availableHeight - height) / 2,
        height,
      };
    });

    // Create links between consecutive milestones
    const links: LinkData[] = [];
    for (let i = 0; i < milestones.length - 1; i++) {
      const sourceNode = nodes[i];
      const targetNode = nodes[i + 1];
      const current = milestones[i];
      const next = milestones[i + 1];

      // Users who have both milestones (flow through)
      const flowCount = users.filter(u => u.milestones[current] && u.milestones[next]).length;

      if (flowCount > 0) {
        const thickness = Math.max((flowCount / maxCount) * availableHeight * 0.8, 2);
        links.push({
          source: current,
          target: next,
          value: flowCount,
          sourceY: sourceNode.y + (sourceNode.height - thickness) / 2,
          targetY: targetNode.y + (targetNode.height - thickness) / 2,
          thickness,
        });
      }
    }

    // Stats
    const lastMilestone = milestones[milestones.length - 1];
    const fullyActivated = users.filter(u => u.milestones[lastMilestone]).length;

    return {
      nodes,
      links,
      stats: {
        total,
        fullyActivated,
        conversionRate: total > 0 ? Math.round((fullyActivated / total) * 100) : 0,
      },
    };
  }, [users, milestones, milestoneLabels, dimensions]);

  if (nodes.length === 0) {
    return null;
  }

  // Generate smooth curve path between nodes
  const generateLinkPath = (link: LinkData, sourceNode: NodeData, targetNode: NodeData) => {
    const sourceX = sourceNode.x + 12; // Node width
    const targetX = targetNode.x;
    const controlPointOffset = (targetX - sourceX) * 0.4;

    const y1Top = link.sourceY;
    const y1Bottom = link.sourceY + link.thickness;
    const y2Top = link.targetY;
    const y2Bottom = link.targetY + link.thickness;

    return `
      M ${sourceX} ${y1Top}
      C ${sourceX + controlPointOffset} ${y1Top}, ${targetX - controlPointOffset} ${y2Top}, ${targetX} ${y2Top}
      L ${targetX} ${y2Bottom}
      C ${targetX - controlPointOffset} ${y2Bottom}, ${sourceX + controlPointOffset} ${y1Bottom}, ${sourceX} ${y1Bottom}
      Z
    `;
  };

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        <defs>
          {/* Gradient for links */}
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Links (ribbons) */}
        <g className="links">
          {links.map((link, i) => {
            const sourceNode = nodes.find(n => n.id === link.source)!;
            const targetNode = nodes.find(n => n.id === link.target)!;
            return (
              <path
                key={`link-${i}`}
                d={generateLinkPath(link, sourceNode, targetNode)}
                fill="url(#linkGradient)"
                className="transition-opacity hover:opacity-80"
              >
                <title>{`${sourceNode.label} → ${targetNode.label}: ${link.value} users`}</title>
              </path>
            );
          })}
        </g>

        {/* Nodes (vertical bars) */}
        <g className="nodes">
          {nodes.map((node) => (
            <g key={node.id}>
              {/* Node bar */}
              <rect
                x={node.x}
                y={node.y}
                width={12}
                height={node.height}
                rx={3}
                fill="hsl(var(--primary))"
                className="transition-opacity hover:opacity-80"
              >
                <title>{`${node.label}: ${node.count} users (${node.percent}%)`}</title>
              </rect>

              {/* Label below */}
              <text
                x={node.x + 6}
                y={dimensions.height - 35}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-medium"
              >
                {node.label}
              </text>
              <text
                x={node.x + 6}
                y={dimensions.height - 20}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {node.count} ({node.percent}%)
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Summary stats */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground border-t border-border pt-3 mt-2">
        <div>
          <span className="font-medium text-foreground">{stats.total}</span> total users
        </div>
        <div>
          <span className="font-medium text-foreground">{stats.fullyActivated}</span> fully activated ({stats.conversionRate}%)
        </div>
      </div>
    </div>
  );
}
