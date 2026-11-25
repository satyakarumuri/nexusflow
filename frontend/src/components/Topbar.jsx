
import { Bell } from "lucide-react";

function Topbar() {
  return (
    <header className="topbar">

      <div className="breadcrumb">
        Workspace <span>/</span> Dashboard
      </div>

      <div className="topbar-right">

        <span className="online-status">
          <span className="online-dot"></span>
          System Online
        </span>

        <Bell size={19} />

        <div className="top-avatar">R</div>

      </div>

    </header>
  );
}

export default Topbar;
