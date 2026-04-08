// ══════════════════════════════════════════════════════════════
// Mock Graph Data — realistic IC / circuit graph datasets
//   1. Single Graph — Node Prediction  (cell criticality)
//   2. Multi Graph  — Node Prediction  (block-level cell type)
//   3. Multi Graph  — Graph Prediction (block quality)
// ══════════════════════════════════════════════════════════════

export interface MockNode {
  id: string;
  label: string;
  attributes: Record<string, number | string>;
  predictedLabel?: string;
  trueLabel?: string;
  confidence?: number;
}

export interface MockEdge {
  source: string;
  target: string;
  attributes?: Record<string, number | string>;
}

export interface MockGraph {
  graphId: string;
  graphName: string;
  nodes: MockNode[];
  edges: MockEdge[];
  graphLabel?: string;
  predictedGraphLabel?: string;
  graphConfidence?: number;
}

export interface MockGraphDataset {
  id: string;
  name: string;
  description: string;
  taskLevel: 'node' | 'graph';
  taskType: 'classification' | 'regression';
  isMultiGraph: boolean;
  graphs: MockGraph[];
  nodeClasses?: string[];
  graphClasses?: string[];
  metrics: {
    accuracy?: number;
    f1?: number;
    precision?: number;
    recall?: number;
    mse?: number;
    mae?: number;
    r2?: number;
  };
}

// ── Helper ──
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ── Realistic cell types & net types ──
const CELL_TYPES = ['INV', 'NAND2', 'NOR2', 'BUF', 'DFF', 'MUX2', 'AOI21', 'XOR2', 'LATCH', 'TGATE'] as const;
const DRIVE_STRENGTHS = ['X1', 'X2', 'X4', 'X8'] as const;
const NET_TYPES = ['signal', 'clock', 'reset', 'scan'] as const;

// ══════════════════════════════════════════
// 1. Single Graph — Node Prediction
//    Classify each cell: Normal / Critical / Warning
// ══════════════════════════════════════════
function buildSingleGraphNodePrediction(): MockGraphDataset {
  const rand = seededRandom(42);
  const classes = ['Normal', 'Critical', 'Warning'];

  const nodes: MockNode[] = [];
  const edges: MockEdge[] = [];

  for (let i = 0; i < 35; i++) {
    const cellType = pick(CELL_TYPES, rand);
    const drive = pick(DRIVE_STRENGTHS, rand);
    const fanout = Math.floor(rand() * 6) + 1;
    const slackNs = +(rand() * 2 - 0.3).toFixed(3);
    const isCritical = slackNs < 0.2;
    const isWarning = !isCritical && slackNs < 0.6;
    const trueClass = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
    const correct = rand() > 0.13;
    const predicted = correct ? trueClass : pick(classes, rand);

    nodes.push({
      id: `c${i}`,
      label: `${cellType}_${drive}_${i}`,
      attributes: {
        cell_type: cellType,
        drive_strength: drive,
        fanout,
        logic_depth: Math.floor(rand() * 12) + 1,
        slack_ns: slackNs,
        cell_area_um2: +(0.5 + rand() * 4).toFixed(2),
        x_coord: +(rand() * 1000).toFixed(1),
        y_coord: +(rand() * 800).toFixed(1),
      },
      trueLabel: trueClass,
      predictedLabel: predicted,
      confidence: +(0.52 + rand() * 0.48).toFixed(3),
    });
  }

  // Build connectivity: spanning tree + extra wires
  for (let i = 1; i < 35; i++) {
    const target = Math.floor(rand() * i);
    const netType = pick(NET_TYPES, rand);
    edges.push({
      source: `c${i}`, target: `c${target}`,
      attributes: { net_type: netType, wire_length_um: +(1 + rand() * 50).toFixed(1), capacitance_fF: +(rand() * 30).toFixed(2) },
    });
  }
  for (let j = 0; j < 22; j++) {
    const a = Math.floor(rand() * 35);
    let b = Math.floor(rand() * 35);
    if (a === b) b = (b + 1) % 35;
    if (!edges.find(e => (e.source === `c${a}` && e.target === `c${b}`) || (e.source === `c${b}` && e.target === `c${a}`))) {
      edges.push({
        source: `c${a}`, target: `c${b}`,
        attributes: { net_type: pick(NET_TYPES, rand), wire_length_um: +(1 + rand() * 50).toFixed(1), capacitance_fF: +(rand() * 30).toFixed(2) },
      });
    }
  }

  return {
    id: 'single-graph-node-pred',
    name: 'Timing Criticality Classification',
    description: 'Single netlist graph (35 cells) — classify each cell as Normal / Critical / Warning based on timing slack.',
    taskLevel: 'node',
    taskType: 'classification',
    isMultiGraph: false,
    graphs: [{ graphId: 'g0', graphName: 'ALU Datapath', nodes, edges }],
    nodeClasses: classes,
    metrics: { accuracy: 0.8571, f1: 0.8402, precision: 0.8533, recall: 0.8275 },
  };
}

// ══════════════════════════════════════════
// 2. Multi Graph — Node Prediction
//    Multiple sub-circuit blocks, classify cells
// ══════════════════════════════════════════
function buildMultiGraphNodePrediction(): MockGraphDataset {
  const rand = seededRandom(123);
  const classes = ['Logic', 'Sequential'];
  const blockNames = ['Decoder', 'Encoder', 'Arbiter', 'FIFO_Ctrl', 'FSM', 'Shifter'];
  const graphs: MockGraph[] = [];

  for (let gi = 0; gi < 6; gi++) {
    const nodeCount = 10 + Math.floor(rand() * 10);
    const nodes: MockNode[] = [];
    const edges: MockEdge[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const cellType = pick(CELL_TYPES, rand);
      const isSeq = cellType === 'DFF' || cellType === 'LATCH';
      const trueClass = isSeq ? 'Sequential' : 'Logic';
      const correct = rand() > 0.1;
      const predicted = correct ? trueClass : (trueClass === 'Logic' ? 'Sequential' : 'Logic');

      nodes.push({
        id: `g${gi}_c${i}`,
        label: `${cellType}_${pick(DRIVE_STRENGTHS, rand)}`,
        attributes: {
          cell_type: cellType,
          drive_strength: pick(DRIVE_STRENGTHS, rand),
          fanout: Math.floor(rand() * 5) + 1,
          slack_ns: +(rand() * 1.5).toFixed(3),
          toggle_rate: +(rand() * 0.8).toFixed(3),
        },
        trueLabel: trueClass,
        predictedLabel: predicted,
        confidence: +(0.6 + rand() * 0.4).toFixed(3),
      });
    }

    for (let i = 1; i < nodeCount; i++) {
      edges.push({
        source: `g${gi}_c${i}`,
        target: `g${gi}_c${Math.floor(rand() * i)}`,
        attributes: { net_type: pick(NET_TYPES, rand), delay_ps: +(rand() * 200).toFixed(1) },
      });
    }
    for (let j = 0; j < Math.floor(nodeCount * 0.4); j++) {
      const a = Math.floor(rand() * nodeCount);
      let b = Math.floor(rand() * nodeCount);
      if (a === b) b = (b + 1) % nodeCount;
      edges.push({
        source: `g${gi}_c${a}`,
        target: `g${gi}_c${b}`,
        attributes: { net_type: pick(NET_TYPES, rand), delay_ps: +(rand() * 200).toFixed(1) },
      });
    }

    graphs.push({ graphId: `g${gi}`, graphName: blockNames[gi], nodes, edges });
  }

  return {
    id: 'multi-graph-node-pred',
    name: 'Cell Type Classification',
    description: '6 sub-circuit blocks — classify each cell node as Logic or Sequential.',
    taskLevel: 'node',
    taskType: 'classification',
    isMultiGraph: true,
    graphs,
    nodeClasses: classes,
    metrics: { accuracy: 0.9048, f1: 0.8889, precision: 0.9032, recall: 0.8750 },
  };
}

// ══════════════════════════════════════════
// 3. Multi Graph — Graph Prediction
//    Predict block-level quality: Pass / Marginal / Fail
// ══════════════════════════════════════════
function buildMultiGraphGraphPrediction(): MockGraphDataset {
  const rand = seededRandom(456);
  const classes = ['Pass', 'Marginal', 'Fail'];
  const blockNames = [
    'PLL_Core', 'ADC_Frontend', 'DAC_Output', 'LDO_Reg',
    'IO_Pad_Ring', 'SRAM_Macro', 'Clock_Tree', 'Scan_Chain',
    'Power_Grid', 'ESD_Clamp', 'SerDes_TX', 'SerDes_RX',
  ];
  const graphs: MockGraph[] = [];

  for (let gi = 0; gi < 12; gi++) {
    const nodeCount = 6 + Math.floor(rand() * 7);
    const nodes: MockNode[] = [];
    const edges: MockEdge[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const cellType = pick(CELL_TYPES, rand);
      nodes.push({
        id: `g${gi}_c${i}`,
        label: `${cellType}_${pick(DRIVE_STRENGTHS, rand)}`,
        attributes: {
          cell_type: cellType,
          drive_strength: pick(DRIVE_STRENGTHS, rand),
          power_uW: +(0.1 + rand() * 5).toFixed(2),
          leakage_nA: +(rand() * 100).toFixed(1),
          area_um2: +(0.3 + rand() * 3).toFixed(2),
        },
      });
    }

    for (let i = 1; i < nodeCount; i++) {
      edges.push({
        source: `g${gi}_c${i}`,
        target: `g${gi}_c${Math.floor(rand() * i)}`,
        attributes: { net_type: pick(NET_TYPES, rand), resistance_ohm: +(rand() * 50).toFixed(1) },
      });
    }
    for (let j = 0; j < Math.floor(nodeCount * 0.3); j++) {
      const a = Math.floor(rand() * nodeCount);
      let b = Math.floor(rand() * nodeCount);
      if (a === b) b = (b + 1) % nodeCount;
      edges.push({
        source: `g${gi}_c${a}`,
        target: `g${gi}_c${b}`,
        attributes: { net_type: pick(NET_TYPES, rand), resistance_ohm: +(rand() * 50).toFixed(1) },
      });
    }

    const trueClass = pick(classes, rand);
    const correct = rand() > 0.18;
    const predicted = correct ? trueClass : pick(classes, rand);

    graphs.push({
      graphId: `g${gi}`,
      graphName: blockNames[gi],
      nodes,
      edges,
      graphLabel: trueClass,
      predictedGraphLabel: predicted,
      graphConfidence: +(0.5 + rand() * 0.5).toFixed(3),
    });
  }

  return {
    id: 'multi-graph-graph-pred',
    name: 'Block Quality Prediction',
    description: '12 IP blocks — predict graph-level quality: Pass / Marginal / Fail.',
    taskLevel: 'graph',
    taskType: 'classification',
    isMultiGraph: true,
    graphs,
    graphClasses: classes,
    metrics: { accuracy: 0.8333, f1: 0.8125, precision: 0.8200, recall: 0.8050 },
  };
}

// ── Exports ──

export const MOCK_GRAPH_DATASETS: MockGraphDataset[] = [
  buildSingleGraphNodePrediction(),
  buildMultiGraphNodePrediction(),
  buildMultiGraphGraphPrediction(),
];

export function getMockGraphDataset(id: string): MockGraphDataset | undefined {
  return MOCK_GRAPH_DATASETS.find(d => d.id === id);
}
