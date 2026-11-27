import { v4 as uuidv4 } from 'uuid';
import { getCollections } from '../config/db.js';
import { compileRuleGraph, validateAndAnalyzeGraph } from '../engine/streamCompiler.js';
import { telemetry$ } from './ingestionService.js';
import { triggerSmsAlert, triggerWebhookAction } from './alertService.js';
import { broadcast } from '../ws/wsServer.js';

const activePipelines = new Map();

const DEFAULT_STARTER_RULE = {
  name: 'Turbine Overheat Protection',
  description: 'Moving average filter over Turbine-01 temperature triggering SMS alert above 80°C',
  active: true,
  graph: {
    nodes: [
      {
        id: 'node-sensor-1',
        type: 'sensorSource',
        position: { x: 60, y: 140 },
        data: {
          label: 'Turbine Sensor',
          deviceId: 'turbine-01',
          metric: 'temperature',
          unit: '°C'
        }
      },
      {
        id: 'node-mavg-1',
        type: 'movingAverage',
        position: { x: 350, y: 140 },
        data: {
          label: 'Moving Average Filter',
          windowSize: 5
        }
      },
      {
        id: 'node-thresh-1',
        type: 'threshold',
        position: { x: 640, y: 140 },
        data: {
          label: 'Overheat Check',
          operator: '>',
          thresholdValue: 80,
          cooldownMs: 3000
        }
      },
      {
        id: 'node-sms-1',
        type: 'smsAlert',
        position: { x: 930, y: 140 },
        data: {
          label: 'SMS Alert',
          phoneNumber: '+1-555-0199',
          severity: 'critical',
          cooldownMs: 3000,
          messageTemplate: 'ALERT [{{ruleName}}]: {{deviceId}} {{metric}} reached {{value}}°C!'
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-sensor-1',
        target: 'node-mavg-1',
        type: 'glowing'
      },
      {
        id: 'edge-2',
        source: 'node-mavg-1',
        target: 'node-thresh-1',
        type: 'glowing'
      },
      {
        id: 'edge-3',
        source: 'node-thresh-1',
        target: 'node-sms-1',
        type: 'glowing'
      }
    ]
  }
};

function handleCompiledAction(node, packet, meta) {
  const data = node.data || {};
  if (node.type === 'smsAlert') {
    triggerSmsAlert({
      ruleId: meta.ruleId,
      ruleName: meta.ruleName,
      nodeId: node.id,
      phoneNumber: data.phoneNumber,
      severity: data.severity || 'critical',
      messageTemplate: data.messageTemplate,
      reading: packet
    }).catch((err) => console.error('[ruleManager] SMS action failed:', err.message));
  } else if (node.type === 'webhookAction') {
    triggerWebhookAction({
      ruleId: meta.ruleId,
      ruleName: meta.ruleName,
      nodeId: node.id,
      url: data.url,
      method: data.method,
      severity: data.severity || 'warning',
      messageTemplate: data.messageTemplate,
      reading: packet
    }).catch((err) => console.error('[ruleManager] Webhook action failed:', err.message));
  }
}

function handleEdgePulse(pulse) {
  broadcast('edge_pulse', pulse);
}

/**
 * Compiles and activates a rule in memory, disposing any prior pipeline for that ruleId.
 */
export function activateRulePipeline(ruleDoc) {
  stopRulePipeline(ruleDoc.ruleId);

  const compiled = compileRuleGraph({
    ruleId: ruleDoc.ruleId,
    ruleName: ruleDoc.name,
    graph: ruleDoc.graph,
    telemetry$,
    onAction: handleCompiledAction,
    onEdgePulse: handleEdgePulse
  });

  activePipelines.set(ruleDoc.ruleId, compiled);
  return compiled.executionPlan;
}

/**
 * Unsubscribes and removes an active rule pipeline from memory.
 */
export function stopRulePipeline(ruleId) {
  const existing = activePipelines.get(ruleId);
  if (existing) {
    existing.dispose();
    activePipelines.delete(ruleId);
  }
}

/**
 * Seeds starter rule if empty and compiles all active rules on server startup.
 */
export async function initRuleManager() {
  const { rules } = getCollections();
  const count = await rules.countDocuments();

  if (count === 0) {
    const now = new Date();
    await rules.insertOne({
      ruleId: uuidv4(),
      ...DEFAULT_STARTER_RULE,
      createdAt: now,
      updatedAt: now
    });
  }

  const activeRules = await rules.find({ active: true }).toArray();
  for (const rule of activeRules) {
    try {
      activateRulePipeline(rule);
    } catch (err) {
      console.error(`[ruleManager] Failed to compile rule "${rule.name}":`, err.message);
    }
  }
}

export async function listRules() {
  const { rules } = getCollections();
  const docs = await rules.find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map((doc) => ({
    ...doc,
    running: activePipelines.has(doc.ruleId)
  }));
}

export async function getRuleById(ruleId) {
  const { rules } = getCollections();
  const doc = await rules.findOne({ ruleId });
  if (!doc) {
    return null;
  }
  return {
    ...doc,
    running: activePipelines.has(doc.ruleId)
  };
}

export async function createOrUpdateRule({ ruleId, name, description = '', graph, active = true }) {
  // Validate graph upfront before saving
  const analysis = validateAndAnalyzeGraph(graph);

  const { rules } = getCollections();
  const now = new Date();
  const targetId = ruleId || uuidv4();

  const existing = await rules.findOne({ ruleId: targetId });
  const ruleDoc = {
    ruleId: targetId,
    name: name || existing?.name || 'Untitled Pipeline',
    description,
    graph,
    active: Boolean(active),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  await rules.updateOne({ ruleId: targetId }, { $set: ruleDoc }, { upsert: true });

  let executionPlan = null;
  if (ruleDoc.active) {
    executionPlan = activateRulePipeline(ruleDoc);
  } else {
    stopRulePipeline(targetId);
  }

  return {
    rule: {
      ...ruleDoc,
      running: activePipelines.has(targetId)
    },
    executionPlan: executionPlan || {
      topoOrder: analysis.topoOrder,
      sourceCount: analysis.sourceNodes.length,
      actionCount: analysis.connectedActions.length,
      edgeCount: analysis.validEdges.length
    }
  };
}

export async function deployRule(ruleId) {
  const { rules } = getCollections();
  const doc = await rules.findOne({ ruleId });
  if (!doc) {
    return null;
  }

  const executionPlan = activateRulePipeline(doc);
  await rules.updateOne({ ruleId }, { $set: { active: true, updatedAt: new Date() } });

  return {
    rule: { ...doc, active: true, running: true },
    executionPlan
  };
}

export async function deactivateRule(ruleId) {
  const { rules } = getCollections();
  const doc = await rules.findOne({ ruleId });
  if (!doc) {
    return null;
  }

  stopRulePipeline(ruleId);
  await rules.updateOne({ ruleId }, { $set: { active: false, updatedAt: new Date() } });

  return {
    rule: { ...doc, active: false, running: false }
  };
}

export async function deleteRule(ruleId) {
  stopRulePipeline(ruleId);
  const { rules } = getCollections();
  const res = await rules.deleteOne({ ruleId });
  return res.deletedCount > 0;
}

export function previewCompileGraph(graph) {
  const analysis = validateAndAnalyzeGraph(graph);
  return {
    valid: true,
    topoOrder: analysis.topoOrder,
    sourceNodes: analysis.sourceNodes.map((n) => n.id),
    connectedActionNodes: analysis.connectedActions.map((n) => n.id),
    edgeCount: analysis.validEdges.length
  };
}

export function getActivePipelineCount() {
  return activePipelines.size;
}

export function disposeAllPipelines() {
  for (const id of activePipelines.keys()) {
    stopRulePipeline(id);
  }
}
