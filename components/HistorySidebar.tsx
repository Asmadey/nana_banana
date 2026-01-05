import React from 'react';
import { HistoryItem, TaskStatus } from '../types';

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  selectedTaskId?: string;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, selectedTaskId }) => {
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    // Format: 2026-01-05, 19:28:24
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}, ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="w-[320px] flex-shrink-0 bg-[#0f0f0f] border-r border-gray-800 h-full overflow-y-auto custom-scrollbar flex flex-col transition-all duration-300">
      <div className="px-5 py-4 border-b border-gray-800 bg-[#0f0f0f] sticky top-0 z-10">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">History</h2>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-xs">
            No history yet. <br/> Generate something!
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.taskId}
              onClick={() => onSelect(item)}
              className={`relative rounded-xl p-3 border cursor-pointer transition-all hover:border-gray-600 group ${
                selectedTaskId === item.taskId 
                  ? 'bg-[#1a1a1a] border-blue-900/50 shadow-lg' 
                  : 'bg-[#111] border-gray-800'
              }`}
            >
              {/* Header: Status & ID */}
              <div className="flex justify-between items-start mb-2">
                 <div className="overflow-hidden">
                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-0.5">Task ID</div>
                    <div className="text-xs font-mono text-gray-300 truncate w-32" title={item.taskId}>
                      {item.taskId.substring(0, 18)}...
                    </div>
                    <div className="text-[10px] text-gray-600 font-medium mt-0.5">
                       {formatDate(item.createdAt)}
                    </div>
                 </div>
                 
                 {/* Status Indicator */}
                 <div className="flex-shrink-0 mt-1">
                    {item.status === TaskStatus.SUCCEEDED ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Success"></div>
                    ) : item.status === TaskStatus.FAILED ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Failed"></div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" title="Processing"></div>
                    )}
                 </div>
              </div>

              {/* RESULT IMAGE (Main Content) */}
              {item.status === TaskStatus.SUCCEEDED && item.resultUrl && (
                 <div className="mb-3 rounded-lg overflow-hidden border border-gray-800 bg-black relative aspect-[4/5] w-full group-hover:border-gray-600 transition-colors">
                    <img 
                      src={item.resultUrl} 
                      alt="Generated Result" 
                      className="w-full h-full object-cover" 
                      loading="lazy" 
                    />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded border border-white/10 font-medium shadow-sm">
                      Result
                    </div>
                 </div>
              )}

              {/* Input Previews (Secondary) */}
              {item.inputPreviews && item.inputPreviews.length > 0 && (
                <div className="mb-2">
                   <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Inputs</div>
                   <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {item.inputPreviews.map((url, idx) => (
                      <div key={idx} className="w-10 h-10 flex-shrink-0 rounded bg-gray-800 overflow-hidden border border-gray-700">
                        <img src={url} alt={`input-${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt */}
              <div className="bg-[#050505] rounded p-2 border border-gray-800/50 mt-2">
                <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed font-light font-mono">
                  {item.prompt}
                </p>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;