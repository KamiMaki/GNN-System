// ══════════════════════════════════════════════════════════════
// Mock Graph Data for 3 task types:
//   1. Single Graph — Node Prediction
//   2. Multi Graph  — Node Prediction
//   3. Multi Graph  — Graph Prediction
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

// ── Helper: deterministic pseudo-random ──
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════
// 1. Single Graph — Node Prediction
// ══════════════════════════════════════════
function buildSingleGraphNodePrediction(): MockGraphDataset {
  const rand = seededRandom(42);
  const classes = ['Normal', 'Critical', 'Warning'];
  const nodes: MockNode[] = [];
  const edges: MockEdge[] = [];

  for (let i = 0; i < 30; i++) {
    const trueClass = classes[Math.floor(rand() * classes.length)];
    const correct = rand() > 0.15;
    const predicted = correct ? trueClass : classes[Math.floor(rand() * classes.length)];
    nodes.push({
      id: `n${i}`,
      label: `Node ${i}`,
      attributes: {
        degree: Math.floor(rand() * 8) + 1,
        feature_1: +(rand() * 10).toFixed(2),
        feature_2: +(rand() * 5 - 2).toFixed(2),
        cluster: ['A', 'B', 'C'][Math.floor(rand() * 3)],
      },
      trueLabel: trueClass,
      predictedLabel: predicted,
      confidence: +(0.5 + rand() * 0.5).toFixed(3),
    });
  }

  // Create edges — sparse connected graph
  for (let i = 1; i < 30; i++) {
    const target = Math.floor(rand() * i);
    edges.push({ source: `n${i}`, target: `n${target}`, attributes: { weight: +(rand()).toFixed(3) } });
  }
  // Add extra edges for richer structure
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(rand() * 30);
    let b = Math.floor(rand() * 30);
    if (a === b) b = (b + 1) % 30;
    if (!edges.find(e => (e.source === `n${a}` && e.target === `n${b}`) || (e.source === `n${b}` && e.target === `n${a}`))) {
      edges.push({ source: `n${a}`, target: `n${b}`, attributes: { weight: +(rand()).toFixed(3) } });
    }
  }

  return {
    id: 'single-graph-node-pred',
    name: 'Circuit Node Classification',
    description: 'Single graph with 30 nodes — classify each node as Normal / Critical / Warning.',
    taskLevel: 'node',
    taskType: 'classification',
    isMultiGraph: false,
    graphs: [{
      graphId: 'g0',
      graphName: 'Circuit Graph',
      nodes,
      edges,
    }],
    nodeClasses: classes,
    metrics: { accuracy: 0.8667, f1: 0.8521, precision: 0.8612, recall: 0.8433 },
  };
}

// ══════════════════════════════════════════
// 2. Multi Graph — Node Prediction
// ══════════════════════════════════════════
function buildMultiGraphNodePrediction(): MockGraphDataset {
  const rand = seededRandom(123);
  const classes = ['Type-A', 'Type-B'];
  const graphs: MockGraph[] = [];

  for (let gi = 0; gi < 8; gi++) {
    const nodeCount = 8 + Math.floor(rand() * 8);
    const nodes: MockNode[] = [];
    const edges: MockEdge[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const trueClass = classes[rand() > 0.45 ? 0 : 1];
      const correct = rand() > 0.12;
      const predicted = correct ? trueClass : classes[1 - classes.indexOf(trueClass)];
      nodes.push({
        id: `g${gi}_n${i}`,
        label: `N${i}`,
        attributes: {
          feat_x: +(rand() * 8).toFixed(2),
          feat_y: +(rand() * 6).toFixed(2),
          centrality: +(rand()).toFixed(3),
        },
        trueLabel: trueClass,
        predictedLabel: predicted,
        confidence: +(0.55 + rand() * 0.45).toFixed(3),
      });
    }

    for (let i = 1; i < nodeCount; i++) {
      edges.push({
        source: `g${gi}_n${i}`,
        target: `g${gi}_n${Math.floor(rand() * i)}`,
        attributes: { type: rand() > 0.5 ? 'directed' : 'undirected' },
      });
    }
    for (let j = 0; j < Math.floor(nodeCount * 0.5); j++) {
      const a = Math.floor(rand() * nodeCount);
      let b = Math.floor(rand() * nodeCount);
      if (a === b) b = (b + 1) % nodeCount;
      edges.push({
        source: `g${gi}_n${a}`,
        target: `g${gi}_n${b}`,
        attributes: { type: rand() > 0.5 ? 'directed' : 'undirected' },
      });
    }

    graphs.push({
      graphId: `g${gi}`,
      graphName: `Molecule ${gi + 1}`,
      nodes,
      edges,
    });
  }

  return {
    id: 'multi-graph-node-pred',
    name: 'Molecular Atom Classification',
    description: '8 molecular graphs — classify each atom (node) as Type-A or Type-B.',
    taskLevel: 'node',
    taskType: 'classification',
    isMultiGraph: true,
    graphs,
    nodeClasses: classes,
    metrics: { accuracy: 0.8824, f1: 0.8750, precision: 0.8889, recall: 0.8615 },
  };
}

// ══════════════════════════════════════════
// 3. Multi Graph — Graph Prediction
// ══════════════════════════════════════════
function buildMultiGraphGraphPrediction(): MockGraphDataset {
  const rand = seededRandom(456);
  const classes = ['Toxic', 'Non-Toxic', 'Unknown'];
  const graphs: MockGraph[] = [];

  for (let gi = 0; gi < 12; gi++) {
    const nodeCount = 5 + Math.floor(rand() * 6);
    const nodes: MockNode[] = [];
    const edges: MockEdge[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `g${gi}_n${i}`,
        label: `Atom ${i}`,
        attributes: {
          element: ['C', 'N', 'O', 'S', 'H'][Math.floor(rand() * 5)],
          charge: +(rand() * 2 - 1).toFixed(2),
          mass: +(10 + rand() * 22).toFixed(1),
        },
      });
    }

    for (let i = 1; i < nodeCount; i++) {
      edges.push({
        source: `g${gi}_n${i}`,
        target: `g${gi}_n${Math.floor(rand() * i)}`,
        attributes: { bond: ['single', 'double', 'aromatic'][Math.floor(rand() * 3)] },
      });
    }
    for (let j = 0; j < Math.floor(nodeCount * 0.3); j++) {
      const a = Math.floor(rand() * nodeCount);
      let b = Math.floor(rand() * nodeCount);
      if (a === b) b = (b + 1) % nodeCount;
      edges.push({
        source: `g${gi}_n${a}`,
        target: `g${gi}_n${b}`,
        attributes: { bond: ['single', 'double'][Math.floor(rand() * 2)] },
      });
    }

    const trueClass = classes[Math.floor(rand() * classes.length)];
    const correct = rand() > 0.2;
    const predicted = correct ? trueClass : classes[Math.floor(rand() * classes.length)];

    graphs.push({
      graphId: `g${gi}`,
      graphName: `Compound ${String.fromCharCode(65 + gi)}`,
      nodes,
      edges,
      graphLabel: trueClass,
      predictedGraphLabel: predicted,
      graphConfidence: +(0.5 + rand() * 0.5).toFixed(3),
    });
  }

  return {
    id: 'multi-graph-graph-pred',
    name: 'Compound Toxicity Prediction',
    description: '12 compound graphs — predict graph-level toxicity class (Toxic / Non-Toxic / Unknown).',
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
