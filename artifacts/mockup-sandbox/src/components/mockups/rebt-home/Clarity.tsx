import React from 'react';
import { Home, CheckSquare, BookOpen, Map, MessageCircle, BarChart2, Zap, ArrowRight, Play, Compass } from 'lucide-react';

export default function ClarityHome() {
  return (
    <div className="font-['DM_Sans'] bg-[#FAFAF7]" style={{ width: 430, height: 870, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-[90px]" style={{ backgroundColor: '#FAFAF7' }}>
        
        {/* Header */}
        <div className="px-6 pt-14 pb-6">
          <h1 className="text-[22px] font-bold text-[#5C8A6F] leading-tight">Good morning, Sarah</h1>
          <p className="text-[15px] text-[#7A6F63] mt-1">Ready for your practice today?</p>
        </div>
        
        {/* Stats */}
        <div className="px-6 flex gap-3 mb-8">
          <div className="flex-1 bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 flex flex-col justify-center items-center">
            <span className="text-[22px] font-bold text-[#5C8A6F]">3</span>
            <span className="text-[12px] font-medium uppercase tracking-wide text-[#7A6F63] mt-1 text-center leading-tight">Active<br/>Beliefs</span>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 flex flex-col justify-center items-center">
            <div className="flex items-center text-[#D4823A]">
              <Zap size={18} className="mr-1 fill-current" />
              <span className="text-[22px] font-bold">7</span>
            </div>
            <span className="text-[12px] font-medium uppercase tracking-wide text-[#7A6F63] mt-1 text-center leading-tight">Day<br/>Streak</span>
          </div>
          <div className="flex-1 bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-4 flex flex-col justify-center items-center">
            <span className="text-[22px] font-bold text-[#5C8A6F]">12</span>
            <span className="text-[12px] font-medium uppercase tracking-wide text-[#7A6F63] mt-1 text-center leading-tight">Resolved</span>
          </div>
        </div>

        {/* Alternate Background Section */}
        <div className="px-6 py-8" style={{ backgroundColor: '#F4F3EF' }}>
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-[22px] font-bold text-[#5C8A6F] leading-tight">Recent Beliefs</h2>
            <button className="text-[15px] font-medium text-[#7A6F63] flex items-center hover:text-[#5C8A6F] transition-colors">
              View all <ArrowRight size={16} className="ml-1" />
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Belief Card 1 */}
            <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
              <p className="text-[15px] text-[#333333] font-medium leading-relaxed mb-4">
                "I must be perfect or I'm completely worthless."
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="bg-[#5C8A6F] bg-opacity-10 text-[#5C8A6F] px-3 py-1 rounded-full text-[12px] font-medium tracking-wide">All-or-Nothing</span>
                <span className="bg-[#5C8A6F] bg-opacity-10 text-[#5C8A6F] px-3 py-1 rounded-full text-[12px] font-medium tracking-wide">Demandingness</span>
              </div>
              <div className="flex items-center justify-between mt-auto mb-2">
                <span className="text-[12px] font-medium uppercase tracking-wide text-[#7A6F63]">Progress</span>
                <span className="text-[12px] font-bold text-[#5C8A6F]">45%</span>
              </div>
              <div className="w-full bg-[#E8E4DF] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#5C8A6F] h-full rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>

            {/* Belief Card 2 */}
            <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
              <p className="text-[15px] text-[#333333] font-medium leading-relaxed mb-4">
                "Nobody really likes me, they just tolerate me."
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="bg-[#5C8A6F] bg-opacity-10 text-[#5C8A6F] px-3 py-1 rounded-full text-[12px] font-medium tracking-wide">Mind Reading</span>
              </div>
              <div className="flex items-center justify-between mt-auto mb-2">
                <span className="text-[12px] font-medium uppercase tracking-wide text-[#7A6F63]">Progress</span>
                <span className="text-[12px] font-bold text-[#5C8A6F]">70%</span>
              </div>
              <div className="w-full bg-[#E8E4DF] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#5C8A6F] h-full rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 pt-8 pb-12">
          <h2 className="text-[22px] font-bold text-[#5C8A6F] leading-tight mb-5">Quick Actions</h2>
          <div className="flex flex-col gap-3">
            <button className="w-full h-[52px] bg-[#5C8A6F] text-white rounded-2xl font-medium text-[15px] flex items-center justify-center shadow-[0_2px_8px_rgba(92,138,111,0.25)] hover:bg-[#4A735B] transition-colors">
              <Play size={18} className="mr-2 fill-current" />
              Start a Session
            </button>
            <button className="w-full h-[52px] bg-white border border-[#E8E4DF] text-[#5C8A6F] rounded-2xl font-medium text-[15px] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-[#FAFAF7] transition-colors">
              <Compass size={18} className="mr-2" />
              View Mind Map
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-[#E8E4DF] flex justify-between px-4 pb-8 pt-4 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <button className="flex flex-col items-center flex-1 text-[#5C8A6F]">
          <Home size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button className="flex flex-col items-center flex-1 text-[#9E9A95] hover:text-[#7A6F63] transition-colors">
          <CheckSquare size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Check-In</span>
        </button>
        <button className="flex flex-col items-center flex-1 text-[#9E9A95] hover:text-[#7A6F63] transition-colors">
          <BookOpen size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Library</span>
        </button>
        <button className="flex flex-col items-center flex-1 text-[#9E9A95] hover:text-[#7A6F63] transition-colors">
          <Map size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <button className="flex flex-col items-center flex-1 text-[#9E9A95] hover:text-[#7A6F63] transition-colors">
          <MessageCircle size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Coach</span>
        </button>
        <button className="flex flex-col items-center flex-1 text-[#9E9A95] hover:text-[#7A6F63] transition-colors">
          <BarChart2 size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Progress</span>
        </button>
      </div>

    </div>
  );
}
