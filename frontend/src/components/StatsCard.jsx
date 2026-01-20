const StatsCard = ({ title, value, icon, trend }) => {
  return (
    <div className="relative group bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
      {/* Decorative gradient line */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="relative flex items-center justify-between">
        <div>
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">{title}</h3>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <span className="text-xs text-emerald-400 font-medium mt-1 inline-block">{trend}</span>
          )}
        </div>
        <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl text-cyan-400 border border-white/10 shadow-lg shadow-cyan-500/10">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
