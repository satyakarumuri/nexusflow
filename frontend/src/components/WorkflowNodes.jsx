
import { Handle, Position } from "@xyflow/react";
import { Radio, Activity, Bell } from "lucide-react";

function SensorNode({ data }) {
  return (
    <div className="custom-node sensor-node">
      <Handle type="source" position={Position.Right} />

      <div className="node-heading">
        <Radio size={18} />
        <span>SENSOR INPUT</span>
      </div>

      <h4>{data.label}</h4>

      <p>{data.sensorType || "Temperature"} Sensor</p>
      <p>{data.description || "Collect real-time sensor readings"}</p>

      <span className="node-status">● Active</span>
    </div>
  );
}

function ProcessingNode({ data }) {
  return (
    <div className="custom-node process-node">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="node-heading">
        <Activity size={18} />
        <span>DATA PROCESSING</span>
      </div>

      <h4>{data.label}</h4>

      <p>{data.description || "Filter and calculate sensor data"}</p>

      <span className="node-status">● Ready</span>
    </div>
  );
}

function AlertNode({ data }) {
  return (
    <div className="custom-node alert-node">
      <Handle type="target" position={Position.Left} />

      <div className="node-heading">
        <Bell size={18} />
        <span>ALERT GENERATION</span>
      </div>

      <h4>{data.label}</h4>

      <p>{data.description || "Generate alerts when limits are crossed"}</p>

      <span className="node-status">● Waiting</span>
    </div>
  );
}

export const nodeTypes = {
  sensor: SensorNode,
  processing: ProcessingNode,
  alert: AlertNode,
};
