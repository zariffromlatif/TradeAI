function StatCard({ icon, title, value, subtitle }) {
  return (
    <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-5 flex items-start gap-4">
      <div className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">{icon}</div>
      <div>
        <p className="text-neutral-400 text-sm">{title}</p>
        <p className="text-neutral-100 text-2xl font-semibold mt-1 tracking-tight">{value}</p>
        {subtitle && <p className="text-neutral-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default StatCard;
