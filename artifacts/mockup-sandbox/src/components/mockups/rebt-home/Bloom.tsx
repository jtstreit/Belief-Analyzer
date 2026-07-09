import React from "react";
import { 
  Brain, 
  Flame, 
  CheckCircle2, 
  Sparkles, 
  Map as MapIcon, 
  MessageSquare, 
  Home, 
  Book, 
  Activity, 
  Play, 
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Map
} from "lucide-react";

export default function BloomHome() {
  return (
    <div 
      className="font-['Plus_Jakarta_Sans'] flex flex-col"
      style={{
        width: 430,
        height: 870,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, #EEE9F8 0%, #F9EFF4 100%)',
      }}
    >
      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto pb-[100px] hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        
        {/* Header */}
        <div className="px-6 pt-14 pb-6">
          <p className="text-[#5A4A7A] text-[15px] font-medium mb-1">Thursday, 24 Oct</p>
          <h1 className="text-[#2D1B69] text-[26px] font-extrabold tracking-tight">Good morning, Sarah 👋</h1>
        </div>

        {/* Stats Section */}
        <div className="px-6 grid grid-cols-3 gap-3 mb-6">
          {/* Active Beliefs */}
          <div 
            className="bg-white rounded-[20px] p-4 flex flex-col items-center text-center"
            style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.12)' }}
          >
            <div className="w-10 h-10 rounded-full bg-[#7C5CBF] flex items-center justify-center mb-3 shadow-md">
              <Brain size={20} className="text-white" />
            </div>
            <p className="text-[#2D1B69] text-[22px] font-bold leading-none mb-1">3</p>
            <p className="text-[#5A4A7A] text-[12px] font-medium leading-tight">Active<br/>Beliefs</p>
          </div>
          
          {/* Day Streak */}
          <div 
            className="bg-white rounded-[20px] p-4 flex flex-col items-center text-center relative overflow-hidden"
            style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.12)' }}
          >
            <div className="absolute top-[-10px] right-[-10px] w-16 h-16 bg-[#E8607A] opacity-5 rounded-full"></div>
            <div className="w-10 h-10 rounded-full bg-[#E8607A] flex items-center justify-center mb-3 shadow-md">
              <Flame size={20} className="text-white" />
            </div>
            <p className="text-[#2D1B69] text-[22px] font-bold leading-none mb-1">7</p>
            <p className="text-[#5A4A7A] text-[12px] font-medium leading-tight">Day<br/>Streak</p>
          </div>
          
          {/* Resolved */}
          <div 
            className="bg-white rounded-[20px] p-4 flex flex-col items-center text-center"
            style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.12)' }}
          >
            <div className="w-10 h-10 rounded-full bg-[#4ABDA0] flex items-center justify-center mb-3 shadow-md">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <p className="text-[#2D1B69] text-[22px] font-bold leading-none mb-1">12</p>
            <p className="text-[#5A4A7A] text-[12px] font-medium leading-tight">Resolved<br/>Beliefs</p>
          </div>
        </div>

        {/* Today's Insight */}
        <div className="px-6 mb-8">
          <div className="bg-[#F0EBF8] rounded-[16px] p-5 relative overflow-hidden border border-white/40">
            <Sparkles size={40} className="absolute -top-2 -right-2 text-[#7C5CBF] opacity-10" />
            <p className="text-[#7C5CBF] text-[15px] italic font-medium leading-relaxed pr-6">
              "The universe doesn't demand you to be perfect, it just asks you to be present. One step at a time."
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 mb-8">
          <h2 className="text-[#2D1B69] text-[18px] font-bold mb-4">Up Next for You</h2>
          <div className="flex flex-col gap-3">
            <button 
              className="w-full h-[54px] rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-[16px] shadow-lg transition-transform active:scale-95"
              style={{ 
                background: 'linear-gradient(90deg, #7C5CBF 0%, #9B6FD4 100%)',
                boxShadow: '0 8px 20px rgba(124,92,191,0.3)'
              }}
            >
              <Play fill="currentColor" size={18} />
              Start a Session
            </button>
            <button 
              className="w-full h-[54px] rounded-2xl bg-white flex items-center justify-between px-5 font-bold text-[16px] text-[#7C5CBF]"
              style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <MapIcon size={20} className="text-[#7C5CBF]" />
                View Mind Map
              </div>
              <ChevronRight size={20} className="text-[#BDB5CC]" />
            </button>
          </div>
        </div>

        {/* Recent Beliefs */}
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#2D1B69] text-[18px] font-bold">Recent Beliefs</h2>
            <button className="text-[#7C5CBF] text-[14px] font-bold flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Belief Card 1 */}
            <div 
              className="bg-white rounded-[20px] p-5 relative overflow-hidden flex flex-col gap-3"
              style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.12)' }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#7C5CBF]"></div>
              
              <div className="flex justify-between items-start pl-2">
                <p className="text-[#3D2A60] text-[16px] font-bold leading-snug pr-4">
                  "I must be perfect or I'm completely worthless"
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 pl-2">
                <span className="bg-[#F9EFF4] text-[#E8607A] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#E8607A]/20">
                  All-or-Nothing
                </span>
                <span className="bg-[#EEE9F8] text-[#7C5CBF] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#7C5CBF]/20">
                  Demandingness
                </span>
              </div>
              
              <div className="pl-2 pt-2 flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-[#EEE9F8] rounded-full overflow-hidden">
                  <div className="h-full bg-[#7C5CBF] rounded-full" style={{ width: '60%' }}></div>
                </div>
                <span className="text-[#BDB5CC] text-[12px] font-bold">In progress</span>
              </div>
            </div>

            {/* Belief Card 2 */}
            <div 
              className="bg-white rounded-[20px] p-5 relative overflow-hidden flex flex-col gap-3"
              style={{ boxShadow: '0 4px 20px rgba(120,80,180,0.12)' }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#E8607A]"></div>
              
              <div className="flex justify-between items-start pl-2">
                <p className="text-[#3D2A60] text-[16px] font-bold leading-snug pr-4">
                  "Nobody really likes me, they just tolerate me"
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 pl-2">
                <span className="bg-[#F9EFF4] text-[#E8607A] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#E8607A]/20">
                  Mind Reading
                </span>
                <span className="bg-[#F9EFF4] text-[#E8607A] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#E8607A]/20">
                  Catastrophizing
                </span>
              </div>
              
              <div className="pl-2 pt-2 flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-[#EEE9F8] rounded-full overflow-hidden">
                  <div className="h-full bg-[#7C5CBF] rounded-full" style={{ width: '25%' }}></div>
                </div>
                <span className="text-[#BDB5CC] text-[12px] font-bold">Just started</span>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div 
        className="absolute bottom-0 w-full bg-white pt-4 pb-8 px-6 flex justify-between items-center rounded-t-[30px]"
        style={{ boxShadow: '0 -10px 30px rgba(120,80,180,0.1)' }}
      >
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <Home size={24} className="text-[#7C5CBF]" />
          <span className="text-[#7C5CBF] text-[11px] font-bold">Home</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
          <Activity size={24} className="text-[#BDB5CC]" />
          <span className="text-[#BDB5CC] text-[11px] font-bold">Check-In</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
          <Book size={24} className="text-[#BDB5CC]" />
          <span className="text-[#BDB5CC] text-[11px] font-bold">Library</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
          <Map size={24} className="text-[#BDB5CC]" />
          <span className="text-[#BDB5CC] text-[11px] font-bold">Map</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
          <MessageSquare size={24} className="text-[#BDB5CC]" />
          <span className="text-[#BDB5CC] text-[11px] font-bold">Coach</span>
        </div>
      </div>
    </div>
  );
}
