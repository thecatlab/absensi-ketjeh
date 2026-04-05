export default function StatCard({ label, value, color, icon }) {
  const colorClasses = {
    blue: 'bg-accent/10 text-accent',
    green: 'bg-success/10 text-success',
    yellow: 'bg-warning/10 text-warning',
    red: 'bg-danger/10 text-danger',
    gray: 'bg-gray-100 text-gray-500',
  };

  const cls = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-xl p-4 ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}
