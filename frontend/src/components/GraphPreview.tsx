'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, Select, Tag, Descriptions, Typography, Empty, Space, Tooltip as AntTooltip, theme } from 'antd';
import { EyeOutlined, NodeIndexOutlined } from '@ant-design/icons';
import type { MockGraph, MockNode, MockEdge, MockGraphDataset } from '@/lib/mockGraphData';

const { Text } = Typography;

// ── Simple force-directed layout ──
interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function computeLayout(nodes: MockNode[], edges: MockEdge[], width: number, height: number): Map<string, { x: number; y: number }> {
  const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const cx = width / 2;
  const cy = height / 2;
  const layoutNodes: LayoutNode[] = nodes.map(n => ({
    id: n.id,
    x: cx + (rand() - 0.5) * width * 0.6,
    y: cy + (rand() - 0.5) * height * 0.6,
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.8;
  const iterations = 80;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 0.1 * (1 - iter / iterations);

    // Repulsive forces
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i], b = layoutNodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force * temp;
        const fy = (dy / dist) * force * temp;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }

    // Attractive forces
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      let dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force * temp;
      const fy = (dy / dist) * force * temp;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }

    // Apply + center gravity
    for (const n of layoutNodes) {
      n.vx += (cx - n.x) * 0.005;
      n.vy += (cy - n.y) * 0.005;
      n.x += n.vx; n.y += n.vy;
      n.vx *= 0.8; n.vy *= 0.8;
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }
  }

  const result = new Map<string, { x: number; y: number }>();
  for (const n of layoutNodes) result.set(n.id, { x: n.x, y: n.y });
  return result;
}

// ── Color palette for classes ──
const CLASS_COLORS = ['#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getClassColor(cls: string, classes: string[]): string {
  const idx = classes.indexOf(cls);
  return CLASS_COLORS[idx >= 0 ? idx % CLASS_COLORS.length : 0];
}

// ── SVG Graph Renderer ──
interface GraphSVGProps {
  graph: MockGraph;
  nodeClasses?: string[];
  width: number;
  height: number;
}

function GraphSVG({ graph, nodeClasses, width, height }: GraphSVGProps) {
  const { token } = theme.useToken();
  const [hoveredNode, setHoveredNode] = useState<MockNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<MockEdge | null>(null);

  const positions = useMemo(
    () => computeLayout(graph.nodes, graph.edges, width, height),
    [graph.nodes, graph.edges, width, height],
  );

  const classes = nodeClasses || [];

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ background: `${token.colorBgContainer}`, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill={token.colorTextQuaternary} />
          </marker>
        </defs>

        {/* Edges */}
        {graph.edges.map((edge, i) => {
          const sp = positions.get(edge.source);
          const tp = positions.get(edge.target);
          if (!sp || !tp) return null;
          const isHovered = hoveredEdge === edge;
          return (
            <line
              key={`e-${i}`}
              x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
              stroke={isHovered ? token.colorPrimary : token.colorTextQuaternary}
              strokeWidth={isHovered ? 2.5 : 1.2}
              strokeOpacity={isHovered ? 1 : 0.5}
              style={{ cursor: 'pointer', transition: 'stroke 0.15s' }}
              onMouseEnter={() => setHoveredEdge(edge)}
              onMouseLeave={() => setHoveredEdge(null)}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isHovered = hoveredNode === node;
          const fillColor = node.trueLabel ? getClassColor(node.trueLabel, classes) : token.colorPrimary;
          return (
            <g key={node.id}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x} cy={pos.y}
                r={isHovered ? 10 : 7}
                fill={fillColor}
                stroke={isHovered ? '#fff' : `${fillColor}60`}
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
              />
              {isHovered && (
                <text x={pos.x} y={pos.y - 14} textAnchor="middle" fontSize={11} fontWeight={600} fill={token.colorText}>
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover info tooltip */}
      {hoveredNode && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          maxWidth: 280,
          boxShadow: token.boxShadow,
          zIndex: 10,
        }}>
          <Text strong>{hoveredNode.label}</Text>
          {hoveredNode.trueLabel && (
            <Tag color={getClassColor(hoveredNode.trueLabel, classes)} style={{ marginLeft: 6 }}>{hoveredNode.trueLabel}</Tag>
          )}
          <div style={{ marginTop: 4 }}>
            {Object.entries(hoveredNode.attributes).map(([k, v]) => (
              <div key={k}><Text type="secondary">{k}:</Text> {String(v)}</div>
            ))}
          </div>
        </div>
      )}

      {hoveredEdge && !hoveredNode && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          maxWidth: 280,
          boxShadow: token.boxShadow,
          zIndex: 10,
        }}>
          <Text strong>{hoveredEdge.source} → {hoveredEdge.target}</Text>
          {hoveredEdge.attributes && (
            <div style={{ marginTop: 4 }}>
              {Object.entries(hoveredEdge.attributes).map(([k, v]) => (
                <div key={k}><Text type="secondary">{k}:</Text> {String(v)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main GraphPreview Component ──
interface GraphPreviewProps {
  dataset: MockGraphDataset;
}

export default function GraphPreview({ dataset }: GraphPreviewProps) {
  const { token } = theme.useToken();
  const [selectedGraphId, setSelectedGraphId] = useState<string>(dataset.graphs[0]?.graphId || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSvgWidth(Math.max(300, entry.contentRect.width - 32));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const selectedGraph = useMemo(
    () => dataset.graphs.find(g => g.graphId === selectedGraphId) || dataset.graphs[0],
    [dataset.graphs, selectedGraphId],
  );

  if (!selectedGraph) return <Empty description="No graph data available" />;

  return (
    <Card
      ref={containerRef}
      title={
        <Space>
          <EyeOutlined style={{ color: token.colorPrimary }} />
          <span>Interactive Graph Preview</span>
          <Tag color="blue">{dataset.taskLevel === 'node' ? 'Node-level' : 'Graph-level'}</Tag>
        </Space>
      }
      extra={
        dataset.graphs.length > 1 ? (
          <Select
            value={selectedGraphId}
            onChange={setSelectedGraphId}
            style={{ minWidth: 180 }}
            options={dataset.graphs.map(g => ({
              value: g.graphId,
              label: (
                <Space>
                  {g.graphName}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ({g.nodes.length}N / {g.edges.length}E)
                  </Text>
                </Space>
              ),
            }))}
          />
        ) : null
      }
    >
      {/* Graph stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Tag icon={<NodeIndexOutlined />}>{selectedGraph.nodes.length} Nodes</Tag>
        <Tag>{selectedGraph.edges.length} Edges</Tag>
        {selectedGraph.graphLabel && (
          <Tag color="gold">Label: {selectedGraph.graphLabel}</Tag>
        )}
        {dataset.nodeClasses && (
          <span style={{ display: 'flex', gap: 4 }}>
            {dataset.nodeClasses.map(cls => (
              <Tag key={cls} color={getClassColor(cls, dataset.nodeClasses!)} style={{ fontSize: 11 }}>{cls}</Tag>
            ))}
          </span>
        )}
      </div>

      {/* SVG Graph */}
      <GraphSVG
        graph={selectedGraph}
        nodeClasses={dataset.nodeClasses}
        width={svgWidth}
        height={380}
      />

      {/* Node & Edge attribute summary */}
      <div style={{ marginTop: 16 }}>
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
          bordered
          title={<Text type="secondary" style={{ fontSize: 12 }}>Sample Node Attributes</Text>}
        >
          {selectedGraph.nodes.length > 0 &&
            Object.entries(selectedGraph.nodes[0].attributes).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
              </Descriptions.Item>
            ))
          }
        </Descriptions>

        {selectedGraph.edges[0]?.attributes && (
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, md: 3 }}
            bordered
            style={{ marginTop: 12 }}
            title={<Text type="secondary" style={{ fontSize: 12 }}>Edge Attributes</Text>}
          >
            {Object.entries(selectedGraph.edges[0].attributes).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                <Tag>{typeof v === 'number' ? 'numeric' : 'categorical'}</Tag>
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </div>
    </Card>
  );
}
