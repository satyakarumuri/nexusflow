import {
  Subject,
  combineLatest,
  merge,
  filter,
  map,
  pairwise,
  scan,
  share,
  tap
} from 'rxjs';

const VALID_OPERATORS = new Set(['>', '>=', '<', '<=', '==', '!=']);

/**
 * Evaluates a numeric comparison operator safely.
 */
export function evaluateComparison(value, operator, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) {
    return false;
  }
  switch (operator) {
    case '>':
      return value > target;
    case '>=':
      return value >= target;
    case '<':
      return value < target;
    case '<=':
      return value <= target;
    case '==':
      return value === target;
    case '!=':
      return value !== target;
    default:
      return false;
  }
}

/**
 * Validates React Flow JSON graph structure, detects cycles, and returns topological execution plan.
 */
export function validateAndAnalyzeGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph: "nodes" and "edges" arrays are required.');
  }

  const nodeMap = new Map();
  for (const node of graph.nodes) {
    if (!node || !node.id || !node.type) {
      throw new Error('Each node must include "id" and "type".');
    }
    nodeMap.set(node.id, node);
  }

  const validEdges = graph.edges.filter(
    (edge) => edge && nodeMap.has(edge.source) && nodeMap.has(edge.target)
  );

  const adjacency = new Map();
  const reverseAdjacency = new Map();
  for (const nodeId of nodeMap.keys()) {
    adjacency.set(nodeId, []);
    reverseAdjacency.set(nodeId, []);
  }

  for (const edge of validEdges) {
    adjacency.get(edge.source).push(edge);
    reverseAdjacency.get(edge.target).push(edge);
  }

  // Cycle detection via 3-color DFS
  const color = new Map(); // 0=unvisited, 1=visiting, 2=visited
  const topoOrder = [];

  function dfs(nodeId) {
    const state = color.get(nodeId) || 0;
    if (state === 1) {
      throw new Error(`Cycle detected in rule graph involving node "${nodeId}".`);
    }
    if (state === 2) {
      return;
    }
    color.set(nodeId, 1);
    for (const edge of adjacency.get(nodeId)) {
      dfs(edge.target);
    }
    color.set(nodeId, 2);
    topoOrder.push(nodeId);
  }

  for (const nodeId of nodeMap.keys()) {
    if ((color.get(nodeId) || 0) === 0) {
      dfs(nodeId);
    }
  }
  topoOrder.reverse();

  const sourceNodes = graph.nodes.filter((n) => n.type === 'sensorSource');
  const actionNodes = graph.nodes.filter(
    (n) => n.type === 'smsAlert' || n.type === 'webhookAction'
  );

  if (sourceNodes.length === 0) {
    throw new Error('Rule graph requires at least one Sensor Data Source node.');
  }
  if (actionNodes.length === 0) {
    throw new Error('Rule graph requires at least one Action Trigger node (SMS or Webhook).');
  }

  // Verify at least one action node is reachable from a source node
  const reachable = new Set();
  const queue = sourceNodes.map((n) => n.id);
  for (const id of queue) {
    reachable.add(id);
  }
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of adjacency.get(current) || []) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  const connectedActions = actionNodes.filter((n) => reachable.has(n.id));
  if (connectedActions.length === 0) {
    throw new Error(
      'At least one Action Trigger node must be connected downstream of a Sensor Data Source.'
    );
  }

  return {
    nodeMap,
    validEdges,
    adjacency,
    reverseAdjacency,
    topoOrder,
    sourceNodes,
    connectedActions
  };
}

/**
 * Extracts a numeric metric reading from a raw telemetry document for a sensorSource node.
 */
function extractSensorPacket(reading, config = {}) {
  if (!reading) {
    return null;
  }

  const deviceId = reading.meta?.deviceId || reading.deviceId || 'unknown';
  const targetDevice = config.deviceId;
  if (targetDevice && targetDevice !== '*' && targetDevice !== 'all' && deviceId !== targetDevice) {
    return null;
  }

  const metric = config.metric || 'temperature';
  let value = null;

  if (reading.metrics && typeof reading.metrics[metric] === 'number') {
    value = reading.metrics[metric];
  } else if (typeof reading[metric] === 'number') {
    value = reading[metric];
  } else if (reading.metric === metric && typeof reading.value === 'number') {
    value = reading.value;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    deviceId,
    metric,
    value,
    rawValue: value,
    timestamp: reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now(),
    meta: reading.meta || { deviceId }
  };
}

/**
 * Compiles a React Flow JSON graph into live RxJS Observable pipelines wired to telemetry$.
 */
export function compileRuleGraph({
  ruleId = 'preview',
  ruleName = 'Unnamed Rule',
  graph,
  telemetry$ = new Subject(),
  onAction,
  onEdgePulse,
  pulseThrottleMs = 120
}) {
  const analysis = validateAndAnalyzeGraph(graph);
  const { nodeMap, reverseAdjacency, connectedActions } = analysis;

  const streamCache = new Map();
  const lastEdgePulse = new Map();
  const subscriptions = [];

  function emitEdgePulse(edge, packet) {
    if (!onEdgePulse) {
      return;
    }
    const now = Date.now();
    const prev = lastEdgePulse.get(edge.id) || 0;
    if (now - prev < pulseThrottleMs) {
      return;
    }
    lastEdgePulse.set(edge.id, now);
    onEdgePulse({
      ruleId,
      edgeId: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      deviceId: packet.deviceId,
      metric: packet.metric,
      value: Number(packet.value.toFixed(2)),
      timestamp: now
    });
  }

  function buildIncomingStreams(nodeId) {
    const incomingEdges = reverseAdjacency.get(nodeId) || [];
    return incomingEdges
      .map((edge) => {
        const upstream$ = buildNodeStream(edge.source);
        if (!upstream$) {
          return null;
        }
        return upstream$.pipe(tap((packet) => emitEdgePulse(edge, packet)));
      })
      .filter(Boolean);
  }

  function buildNodeStream(nodeId) {
    if (streamCache.has(nodeId)) {
      return streamCache.get(nodeId);
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
      return null;
    }

    const data = node.data || {};
    let node$;

    if (node.type === 'sensorSource') {
      node$ = telemetry$.pipe(
        map((reading) => extractSensorPacket(reading, data)),
        filter((packet) => packet !== null),
        share()
      );
    } else {
      const incoming = buildIncomingStreams(nodeId);
      if (incoming.length === 0) {
        return null;
      }

      const primary$ = incoming.length === 1 ? incoming[0] : merge(...incoming);

      switch (node.type) {
        case 'movingAverage': {
          const windowSize = Math.max(1, Math.min(500, Number.parseInt(data.windowSize, 10) || 5));
          node$ = primary$.pipe(
            scan((acc, pkt) => {
              const nextWindow =
                acc.window.length >= windowSize
                  ? [...acc.window.slice(1), pkt.value]
                  : [...acc.window, pkt.value];
              const sum = nextWindow.reduce((s, v) => s + v, 0);
              return {
                window: nextWindow,
                packet: {
                  ...pkt,
                  value: sum / nextWindow.length
                }
              };
            }, { window: [], packet: null }),
            map((state) => state.packet),
            share()
          );
          break;
        }

        case 'mathTransform': {
          const op = data.operation || 'multiply';
          const operand = Number.isFinite(Number(data.operand)) ? Number(data.operand) : 1;

          if (op === 'rateOfChange') {
            node$ = primary$.pipe(
              pairwise(),
              map(([prev, curr]) => {
                const dtSec = Math.max(0.001, (curr.timestamp - prev.timestamp) / 1000);
                return {
                  ...curr,
                  value: (curr.value - prev.value) / dtSec
                };
              }),
              share()
            );
          } else {
            node$ = primary$.pipe(
              map((pkt) => {
                let nextVal = pkt.value;
                switch (op) {
                  case 'add':
                    nextVal = pkt.value + operand;
                    break;
                  case 'subtract':
                    nextVal = pkt.value - operand;
                    break;
                  case 'multiply':
                    nextVal = pkt.value * operand;
                    break;
                  case 'divide':
                    nextVal = operand !== 0 ? pkt.value / operand : pkt.value;
                    break;
                  case 'cToF':
                    nextVal = (pkt.value * 9) / 5 + 32;
                    break;
                  case 'fToC':
                    nextVal = ((pkt.value - 32) * 5) / 9;
                    break;
                  case 'abs':
                    nextVal = Math.abs(pkt.value);
                    break;
                  default:
                    nextVal = pkt.value;
                }
                return { ...pkt, value: nextVal };
              }),
              share()
            );
          }
          break;
        }

        case 'threshold': {
          const operator = VALID_OPERATORS.has(data.operator) ? data.operator : '>';
          const target = Number.isFinite(Number(data.thresholdValue))
            ? Number(data.thresholdValue)
            : 80;
          const cooldownMs = Math.max(0, Number.parseInt(data.cooldownMs, 10) || 0);
          let lastTriggeredAt = 0;

          node$ = primary$.pipe(
            filter((pkt) => {
              if (!evaluateComparison(pkt.value, operator, target)) {
                return false;
              }
              if (cooldownMs > 0) {
                const now = Date.now();
                if (now - lastTriggeredAt < cooldownMs) {
                  return false;
                }
                lastTriggeredAt = now;
              }
              return true;
            }),
            share()
          );
          break;
        }

        case 'logicGate': {
          const gateType = data.gateType === 'OR' ? 'OR' : 'AND';
          const windowMs = Math.max(500, Number.parseInt(data.windowMs, 10) || 5000);

          if (gateType === 'OR' || incoming.length === 1) {
            node$ = primary$.pipe(share());
          } else {
            node$ = combineLatest(incoming).pipe(
              filter((packets) => {
                const times = packets.map((p) => p.timestamp || 0);
                const maxT = Math.max(...times);
                const minT = Math.min(...times);
                return maxT - minT <= windowMs;
              }),
              map((packets) => packets[packets.length - 1]),
              share()
            );
          }
          break;
        }

        case 'smsAlert':
        case 'webhookAction': {
          const cooldownMs = Math.max(
            0,
            data.cooldownMs !== undefined ? Number.parseInt(data.cooldownMs, 10) || 0 : 2000
          );
          let lastActionAt = 0;

          node$ = primary$.pipe(
            filter(() => {
              if (cooldownMs === 0) {
                return true;
              }
              const now = Date.now();
              if (now - lastActionAt < cooldownMs) {
                return false;
              }
              lastActionAt = now;
              return true;
            }),
            tap((pkt) => {
              if (onAction) {
                onAction(node, pkt, { ruleId, ruleName });
              }
            }),
            share()
          );
          break;
        }

        default:
          throw new Error(`Unsupported node type "${node.type}".`);
      }
    }

    streamCache.set(nodeId, node$);
    return node$;
  }

  for (const actionNode of connectedActions) {
    const action$ = buildNodeStream(actionNode.id);
    if (action$) {
      subscriptions.push(action$.subscribe());
    }
  }

  return {
    ruleId,
    ruleName,
    executionPlan: {
      topoOrder: analysis.topoOrder,
      sourceCount: analysis.sourceNodes.length,
      actionCount: connectedActions.length,
      edgeCount: analysis.validEdges.length
    },
    dispose() {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    }
  };
}
