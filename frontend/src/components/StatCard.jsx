
function StatCard({ icon, title, value, description, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <span>{title}</span>
      <h2>{value}</h2>
      <small>{description}</small>
    </div>
  );
}

export default StatCard;
