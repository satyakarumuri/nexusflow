import { SensorSourceNode } from './SensorSourceNode';
import { MovingAverageNode } from './MovingAverageNode';
import { MathTransformNode } from './MathTransformNode';
import { ThresholdNode } from './ThresholdNode';
import { LogicGateNode } from './LogicGateNode';
import { SmsAlertNode } from './SmsAlertNode';
import { WebhookActionNode } from './WebhookActionNode';

export const nodeTypes = {
  sensorSource: SensorSourceNode,
  movingAverage: MovingAverageNode,
  mathTransform: MathTransformNode,
  threshold: ThresholdNode,
  logicGate: LogicGateNode,
  smsAlert: SmsAlertNode,
  webhookAction: WebhookActionNode
};
