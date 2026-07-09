import React from 'react';
import { Home, PlusCircle, Book, Map, MessageSquare, TrendingUp, Flame, Brain, CheckCircle2, ChevronRight, Activity, Sparkles } from 'lucide-react';

export default function DepthMockup() {
  return (
    <div 
      className="font-['Outfit'] text-white select-none flex flex-col"
      style={{
        width: 430, 
        height: 870, 
        overflow: 'hidden', 
        position: 'relative', 
        backgroundColor: '#0B0F1E'
      }}
    >
      {/* Noise overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Radial glow for greeting */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[450px] h-[450px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(123, 140, 222, 0.12) 0%, rgba(11, 15, 30, 0) 70%)',
          top: '-150px'
        }}
      />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-28 relative z-10 px-6 pt-16 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Greeting */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-[300] tracking-wide text-white/90">Good morning, <span className="font-[500] text-white">Alex</span></h1>
            <p className="text-[15px] text-[#7B8CDE]/80 mt-1">Ready to challenge some thoughts?</p>
          </div>
          <div className="w-12 h-12 rounded-full overflow-hidden border border-[#252D47] flex items-center justify-center bg-[#1C2338] shadow-[0_0_15px_rgba(123,140,222,0.1)]">
             <img src="https://i.pravatar.cc/150?u=alex" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-10">
          <StatCard title="Active Beliefs" count="3" icon={<Brain size={18} strokeWidth={2.5} />} color="#7B8CDE" />
          <StatCard title="Day Streak" count="7" icon={<Flame size={18} strokeWidth={2.5} />} color="#F0A055" />
          <StatCard title="Resolved" count="12" icon={<CheckCircle2 size={18} strokeWidth={2.5} />} color="#4ADE80" />
        </div>

        {/* Recent Beliefs */}
        <div className="mb-10">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-[18px] font-[500] text-white tracking-wide">Recent Beliefs</h2>
            <button className="text-[#7B8CDE] text-[14px] flex items-center font-[500]">View all <ChevronRight size={16} /></button>
          </div>

          <div className="flex flex-col gap-4">
            <BeliefCard 
              text="I must be perfect or I'm worthless" 
              tags={["All-or-Nothing", "Demand"]} 
              progress={35}
            />
            <BeliefCard 
              text="Nobody really likes me" 
              tags={["Mind Reading"]} 
              progress={65}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-[18px] font-[500] text-white tracking-wide mb-5">Quick Actions</h2>
          <div className="flex flex-col gap-3">
            <button 
              className="w-full h-[54px] rounded-2xl flex items-center justify-center gap-2.5 font-[500] text-white text-[16px] shadow-lg transition-transform active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #F0A055 0%, #D4793A 100%)',
                boxShadow: '0 8px 24px -6px rgba(240, 160, 85, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
              }}
            >
              <Sparkles size={20} className="text-white/90" />
              Start a Session
            </button>

            <button 
              className="w-full h-[54px] rounded-2xl flex items-center justify-center gap-2.5 font-[500] text-[#CDD6F4] text-[16px] transition-transform active:scale-[0.98] border border-[#252D47]"
              style={{
                background: '#131929',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              <Activity size={20} className="text-[#7B8CDE]" />
              View Mind Map
            </button>
          </div>
        </div>

      </div>

      {/* Tab Bar */}
      <div 
        className="absolute bottom-0 w-full h-[88px] flex items-center justify-between px-4 z-20 pb-4 pt-2"
        style={{
          background: 'rgba(11, 15, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid #252D47',
        }}
      >
        <Tab icon={<Home />} label="Home" active />
        <Tab icon={<PlusCircle />} label="Check-In" />
        <Tab icon={<Book />} label="Library" />
        <Tab icon={<Map />} label="Map" />
        <Tab icon={<MessageSquare />} label="Coach" />
        <Tab icon={<TrendingUp />} label="Progress" />
      </div>
    </div>
  );
}

function StatCard({ title, count, icon, color }: { title: string, count: string, icon: React.ReactNode, color: string }) {
  return (
    <div 
      className="flex-1 rounded-2xl relative overflow-hidden p-3.5 flex flex-col justify-between aspect-[4/4.5]"
      style={{
        background: 'linear-gradient(180deg, #1C2338 0%, #131929 100%)',
        border: '1px solid #252D47',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2), 0 -1px 12px ${color}15`
      }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: color,
          opacity: 0.8,
          boxShadow: `0 0 12px ${color}`
        }}
      />
      <div className="flex justify-between items-start">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: `${color}15`, color: color }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div className="text-[32px] font-[700] leading-none mb-1 text-white">{count}</div>
        <div className="text-[12px] font-[500] text-[#7B8CDE]/80 leading-tight">{title}</div>
      </div>
    </div>
  );
}

function BeliefCard({ text, tags, progress }: { text: string, tags: string[], progress: number }) {
  return (
    <div 
      className="rounded-2xl p-4.5 relative"
      style={{
        background: '#131929',
        border: '1px solid #252D47',
        borderLeft: '3px solid #7B8CDE',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}
    >
      <div className="text-[#CDD6F4] text-[16px] font-[400] mb-3.5 leading-snug">{text}</div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {tags.map(tag => (
          <div 
            key={tag} 
            className="px-2 py-1 rounded-md text-[11px] font-[600] uppercase tracking-wider"
            style={{
              background: '#1C2338',
              color: '#7B8CDE',
              border: '1px solid #252D47'
            }}
          >
            {tag}
          </div>
        ))}
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#1C2338' }}>
        <div 
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7B8CDE 0%, #F0A055 100%)',
            boxShadow: '0 0 8px rgba(240, 160, 85, 0.4)'
          }}
        />
      </div>
    </div>
  );
}

function Tab({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 justify-center w-[60px] cursor-pointer">
      <div 
        className={`[&>svg]:w-[24px] [&>svg]:h-[24px] transition-colors ${active ? 'text-[#F0A055]' : 'text-[#485066]'}`}
        style={active ? { filter: 'drop-shadow(0 0 8px rgba(240,160,85,0.4))' } : {}}
      >
        {icon}
      </div>
      <span 
        className={`text-[10px] font-[500] ${active ? 'text-[#F0A055]' : 'text-[#485066]'}`}
      >
        {label}
      </span>
    </div>
  );
}
