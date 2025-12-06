
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ProjectData, RequestStats } from '../types';

interface Props {
  data: ProjectData;
}

const ProgressBar = ({ stats, color, label }: { stats: RequestStats, color: string, label: string }) => {
    const percentage = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;
    return (
        <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-300 font-medium">{label}</span>
                <span className="text-gray-400">
                    {stats.success} / {stats.total} ({stats.total > 0 ? Math.round(percentage) : 0}%)
                    {stats.error > 0 && <span className="text-red-400 ml-2">({stats.error} err)</span>}
                </span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden flex">
                <div 
                    className={`h-2.5 ${color} transition-all duration-500`} 
                    style={{ width: `${percentage}%` }}
                ></div>
                {stats.error > 0 && (
                     <div className="h-2.5 bg-red-600 transition-all duration-500" style={{ width: `${(stats.error/stats.total)*100}%` }}></div>
                )}
            </div>
        </div>
    );
};

export const Dashboard: React.FC<Props> = ({ data }) => {
  // 1. Calculate general stats
  const totalEpisodes = data.episodes.length;
  const totalShots = data.episodes.reduce((acc, ep) => acc + ep.shots.length, 0);
  const completedEpisodes = data.episodes.filter(e => e.status === 'completed').length;

  // 2. Prepare Shot Count Data (Work Tracking)
  const shotData = data.episodes.map(ep => ({
    name: `Ep ${ep.id}`,
    count: ep.shots.length,
    status: ep.status
  }));

  // 3. Prepare Token Data (Cost Tracking)
  const contextTokens = data.contextUsage?.totalTokens || 0;
  
  const episodeTokenData = data.episodes.map(ep => ({
    name: `Ep ${ep.id}`,
    // Shot Generation
    shotPrompt: ep.shotGenUsage?.promptTokens || 0,
    shotResponse: ep.shotGenUsage?.responseTokens || 0,
    // Sora Generation
    soraPrompt: ep.soraGenUsage?.promptTokens || 0,
    soraResponse: ep.soraGenUsage?.responseTokens || 0,
    // Total for this episode
    total: (ep.shotGenUsage?.totalTokens || 0) + (ep.soraGenUsage?.totalTokens || 0)
  }));

  const totalShotGenTokens = episodeTokenData.reduce((acc, curr) => acc + curr.shotPrompt + curr.shotResponse, 0);
  const totalSoraGenTokens = episodeTokenData.reduce((acc, curr) => acc + curr.soraPrompt + curr.soraResponse, 0);
  const grandTotalTokens = contextTokens + totalShotGenTokens + totalSoraGenTokens;

  // Pie Chart Data
  const distributionData = [
    { name: 'Context Analysis', value: contextTokens },
    { name: 'Shot List Gen', value: totalShotGenTokens },
    { name: 'Sora Prompt Gen', value: totalSoraGenTokens },
  ].filter(d => d.value > 0);

  const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="p-6 h-full overflow-y-auto space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Episodes</h3>
          <div className="flex items-end justify-between mt-2">
             <p className="text-3xl font-bold text-white">{totalEpisodes}</p>
             <span className="text-sm text-gray-500">{completedEpisodes} Completed</span>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Shots</h3>
          <p className="text-3xl font-bold text-blue-400 mt-2">{totalShots}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Token Usage</h3>
          <p className="text-3xl font-bold text-yellow-400 mt-2">{grandTotalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Avg Tokens / Ep</h3>
          <p className="text-3xl font-bold text-purple-400 mt-2">
            {totalEpisodes > 0 ? Math.round(grandTotalTokens / totalEpisodes).toLocaleString() : 0}
          </p>
        </div>
      </div>
      
      {/* SECTION 0: SYSTEM HEALTH & PERFORMANCE */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            🛠 System Health & Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
                <ProgressBar stats={data.stats.context} color="bg-emerald-500" label="Context Analysis" />
            </div>
            <div>
                <ProgressBar stats={data.stats.shotGen} color="bg-blue-500" label="Shot List Generation" />
            </div>
            <div>
                <ProgressBar stats={data.stats.soraGen} color="bg-indigo-500" label="Sora Prompt Writing" />
            </div>
        </div>
      </div>

      {/* SECTION 1: WORK TRACKING (Shot Distribution) */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div className="flex justify-between items-center mb-6">
           <div>
             <h3 className="text-lg font-bold text-white flex items-center gap-2">
               🎬 Work Analysis
             </h3>
             <p className="text-sm text-gray-400">Shot count distribution per episode (Pacing Analysis)</p>
           </div>
           <div className="text-right">
              <span className="text-xs font-mono text-blue-400 block">Avg: {totalEpisodes > 0 ? Math.round(totalShots/totalEpisodes) : 0} shots/ep</span>
           </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shotData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: '#374151', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Bar 
                dataKey="count" 
                name="Shots" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]} 
                barSize={40}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2: COST TRACKING (Token Usage) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Usage Bar Chart */}
        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 ⚡ Cost Analysis
               </h3>
               <p className="text-sm text-gray-400">Token consumption per episode broken down by Input/Output</p>
             </div>
             
             <div className="text-xs text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600"></div>Shot Input</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-300"></div>Shot Output</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600"></div>Sora Input</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-300"></div>Sora Output</span>
             </div>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={episodeTokenData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }}
                  cursor={{ fill: '#374151', opacity: 0.2 }}
                />
                <Bar dataKey="shotPrompt" stackId="a" fill="#2563eb" name="Shot Input" />
                <Bar dataKey="shotResponse" stackId="a" fill="#93c5fd" name="Shot Output" />
                <Bar dataKey="soraPrompt" stackId="a" fill="#4f46e5" name="Sora Input" />
                <Bar dataKey="soraResponse" stackId="a" fill="#a5b4fc" name="Sora Output" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Pie Chart */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col h-[450px]">
          <h3 className="text-lg font-bold text-white mb-2">Usage Distribution</h3>
          <p className="text-sm text-gray-400 mb-6">Total cost breakdown by task type</p>
          
          <div className="flex-1 relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={distributionData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={90}
                   paddingAngle={5}
                   dataKey="value"
                   stroke="none"
                 >
                   {distributionData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px' }} />
                 <Legend verticalAlign="bottom" height={36} iconType="circle"/>
               </PieChart>
             </ResponsiveContainer>
             
             {/* Center Label */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                <div className="text-center">
                   <span className="text-xs text-gray-400 block">Total</span>
                   <span className="text-xl font-bold text-white">{(grandTotalTokens / 1000).toFixed(1)}k</span>
                </div>
             </div>
          </div>
          
          {/* Detailed Stats List */}
          <div className="mt-4 space-y-3">
             <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-800 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                   <span className="text-gray-300">Context Analysis</span>
                </div>
                <span className="font-mono text-white">{contextTokens.toLocaleString()}</span>
             </div>
             <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-800 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                   <span className="text-gray-300">Shot Generation</span>
                </div>
                <span className="font-mono text-white">{totalShotGenTokens.toLocaleString()}</span>
             </div>
             <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-800 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                   <span className="text-gray-300">Sora Prompts</span>
                </div>
                <span className="font-mono text-white">{totalSoraGenTokens.toLocaleString()}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
