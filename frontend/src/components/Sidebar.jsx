
import {
  Activity,
  Bell,
  Database,
  LayoutDashboard,
  Radio,
  Settings,
  Workflow,
  CircleHelp,
  Plus,
} from "lucide-react";

function Sidebar({ onAddNode }) {
  return (
    <aside className="sidebar">

      <div className="brand">
        <div className="brand-icon">
          <Workflow size={23} />
        </div>
        <div>
          <h2>NexusFlow</h2>
          <span>IoT Automation Platform</span>
        </div>
      </div>

      <div className="workspace-label">WORKSPACE</div>

      <nav>
        <div className="nav-item active">
          <LayoutDashboard size={18} />
          Dashboard
        </div>

        <div className="nav-item">
          <Workflow size={18} />
          Workflows
        </div>

        <div className="nav-item">
          <Radio size={18} />
          Sensors
        </div>

        <div className="nav-item">
          <Database size={18} />
          Data Storage
        </div>

        <div className="nav-item">
          <Bell size={18} />
          Alerts
        </div>
      </nav>

      <div className="workspace-label builder-label">
        NODE LIBRARY
      </div>

      <div className="node-library">
        <button onClick={() => onAddNode("sensor")}>
          <Radio size={17} />
          Sensor Input
          <Plus size={15} />
        </button>

        <button onClick={() => onAddNode("processing")}>
          <Activity size={17} />
          Data Processing
          <Plus size={15} />
        </button>

        <button onClick={() => onAddNode("alert")}>
          <Bell size={17} />
          Alert Generation
          <Plus size={15} />
        </button>
      </div>

      <div className="sidebar-bottom">
        <div className="nav-item">
          <Settings size={18} />
          Settings
        </div>

        <div className="nav-item">
          <CircleHelp size={18} />
          Help Center
        </div>

        <div className="profile">
          <div className="avatar">R</div>
          <div>
            <strong>Raktima</strong>
            <span>Frontend Developer</span>
          </div>
        </div>
      </div>

    </aside>
  );
}

export default Sidebar;
