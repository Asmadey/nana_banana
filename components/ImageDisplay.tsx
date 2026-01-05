import React, { useState, useEffect } from 'react';
import { GeneratedImageResult, TaskStatus } from '../types';
import SettingsModal from './SettingsModal';

interface ImageDisplayProps {
  result: GeneratedImageResult;
  onCheckStatus?: () => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ result, onCheckStatus, onRegenerate, isGenerating }) => {
  const { imageUrl, status, error, rawJson, taskId, startTime, inputs, config } = result;
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTaskIdCopied, setIsTaskIdCopied] = useState(false);
  
  // Lightbox State
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Timer logic
  useEffect(() => {
    let interval: number;
    if ((status === TaskStatus.PROCESSING || status === TaskStatus.SUBMITTED) && startTime) {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      interval = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else if (startTime && status !== TaskStatus.IDLE) {
        // Keep static time if finished
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  // Handle ESC to close lightbox
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return "Unknown Date";
    const d = new Date(timestamp);
    // 2026-01-05, 20:25:47
    return d.toISOString().replace('T', ', ').substring(0, 20);
  };

  const handleCopyTaskId = () => {
    if (taskId) {
      navigator.clipboard.writeText(taskId);
      setIsTaskIdCopied(true);
      setTimeout(() => setIsTaskIdCopied(false), 2000);
    }
  };

  // Render "Ready" State if no task
  if (!taskId && status === TaskStatus.IDLE) {
    return (
        <div className="flex-1 bg-[#111] flex flex-col h-full overflow-hidden text-gray-200 relative">
             <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
             {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
                <h2 className="text-xl font-semibold">Output</h2>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-gray-400 hover:text-white"
                >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0a]">
                <div className="text-center p-12 border-2 border-dashed border-gray-800 rounded-xl">
                    <div className="w-20 h-20 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4 text-gray-700">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-400">Ready to Generate</h3>
                    <p className="mt-2 text-gray-600 text-sm max-w-sm">
                    Enter your prompt and click "Run" to create images.
                    </p>
                </div>
            </div>
        </div>
    );
  }

  // Active Task View
  return (
    <div className="flex-1 bg-[#0a0a0a] flex flex-col h-full overflow-hidden text-gray-200 relative">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* LIGHTBOX MODAL */}
      {lightboxUrl && (
        <div 
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
            onClick={() => setLightboxUrl(null)}
        >
            <div className="relative max-w-[95vw] max-h-[95vh]">
                <img 
                    src={lightboxUrl} 
                    className="max-w-full max-h-[95vh] object-contain rounded-sm shadow-2xl" 
                    alt="Lightbox View"
                    onClick={(e) => e.stopPropagation()} // Prevent click on image closing modal
                />
                <button 
                    onClick={() => setLightboxUrl(null)}
                    className="absolute -top-4 -right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#111]">
        <h2 className="text-lg font-semibold">Output</h2>
        <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-400 hover:text-white"
             >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>
            <div className="bg-[#1a1a1a] rounded-lg p-1 flex border border-gray-700">
              <button 
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'preview' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                Preview
              </button>
              <button 
                 onClick={() => setViewMode('json')}
                 className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'json' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                JSON
              </button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* LEFT SIDE: Task Details (Metadata) */}
         <div className="w-[300px] border-r border-gray-800 bg-[#0f0f0f] p-5 overflow-y-auto custom-scrollbar flex-shrink-0">
             
             {/* Task ID Block */}
             <div className="mb-4">
                 <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Task ID</label>
                 <div className="flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 rounded p-2">
                     <span className="font-mono text-xs text-gray-300 truncate flex-1" title={taskId}>
                        {taskId}
                     </span>
                     <button onClick={handleCopyTaskId} className="text-gray-500 hover:text-white transition-colors">
                        {isTaskIdCopied ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        )}
                     </button>
                 </div>
             </div>

             {/* Date Block */}
             <div className="mb-6">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded p-2 text-center">
                    <span className="font-mono text-xl text-gray-400 font-semibold tracking-tight block">
                        {formatDateTime(startTime)}
                    </span>
                </div>
             </div>

             {/* Inputs Block */}
             {inputs && inputs.length > 0 && (
                 <div className="mb-6">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 block">Inputs</label>
                    <div className="grid grid-cols-2 gap-3">
                        {inputs.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square bg-[#111] rounded-lg border border-gray-700 overflow-hidden">
                                <img src={url} alt={`Input ${idx}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setLightboxUrl(url)}
                                        className="bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md text-white transition-colors"
                                        title="Zoom"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             {/* Parameters Block */}
             <div className="mb-6">
                 <h3 className="text-sm font-semibold text-white mb-3">Parameters</h3>
                 <div className="space-y-4">
                     <div>
                         <span className="text-xs text-gray-500 block mb-1">Ratio</span>
                         <span className="text-sm text-gray-300 font-medium bg-[#111] px-2 py-1 rounded border border-gray-800 inline-block w-full">
                             {config?.aspectRatio || "1:1"}
                         </span>
                     </div>
                     <div>
                         <span className="text-xs text-gray-500 block mb-1">Resolution</span>
                         <span className="text-sm text-gray-300 font-medium bg-[#111] px-2 py-1 rounded border border-gray-800 inline-block w-full">
                             {config?.resolution || "1K"}
                         </span>
                     </div>
                     <div>
                         <span className="text-xs text-gray-500 block mb-1">Output format</span>
                         <span className="text-sm text-gray-300 font-medium bg-[#111] px-2 py-1 rounded border border-gray-800 inline-block w-full uppercase">
                             {config?.outputFormat || "PNG"}
                         </span>
                     </div>
                 </div>
             </div>

             {/* Regenerate Button */}
             {onRegenerate && (
                <button 
                    onClick={onRegenerate}
                    disabled={isGenerating}
                    className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                        isGenerating 
                        ? 'bg-blue-900/30 text-blue-300/50 cursor-not-allowed border border-blue-900/20' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                    }`}
                >
                    {isGenerating ? (
                        <>
                         <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                        </>
                    ) : (
                        <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Regenerate
                        </>
                    )}
                </button>
             )}

         </div>


         {/* RIGHT SIDE: Content Area */}
         <div className="flex-1 bg-[#0a0a0a] flex flex-col relative overflow-hidden">
            {viewMode === 'preview' ? (
                <div className="w-full h-full flex items-center justify-center p-8">
                     
                     {/* Processing State */}
                     {(status === TaskStatus.PROCESSING || status === TaskStatus.SUBMITTED) && (
                         <div className="text-center">
                              <div className="inline-block relative w-20 h-20 mb-6">
                                <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-800 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
                              </div>
                              <h2 className="text-2xl font-bold text-white mb-2">Generating Image</h2>
                              <p className="text-gray-400 mb-6">Waiting for Nano Banana Pro</p>
                              
                              <div className="bg-[#111] border border-gray-800 rounded-lg p-4 max-w-xs mx-auto space-y-3">
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Task ID</span>
                                      <span className="text-blue-400 font-mono text-xs">{taskId?.substring(0, 8)}...</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Elapsed</span>
                                      <span className="text-white font-mono">{formatTime(elapsedTime)}</span>
                                  </div>
                                  <button 
                                      onClick={onCheckStatus}
                                      className="w-full mt-2 py-2 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded border border-gray-700 transition-colors"
                                  >
                                      Check Status Manually
                                  </button>
                              </div>
                         </div>
                     )}

                     {/* Success State */}
                     {status === TaskStatus.SUCCEEDED && imageUrl && (
                         <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
                             <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center group">
                                 <img 
                                    src={imageUrl} 
                                    alt="Result" 
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-in" 
                                    onClick={() => setLightboxUrl(imageUrl)}
                                 />
                                 <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setLightboxUrl(imageUrl)}
                                        className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-md"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    </button>
                                 </div>
                             </div>
                             <div className="mt-6 flex gap-4">
                                <a 
                                  href={imageUrl} 
                                  download={`nano_banana_${taskId}.png`}
                                  target="_blank"
                                  rel="noreferrer" 
                                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Download
                                </a>
                             </div>
                         </div>
                     )}

                     {/* Failed State */}
                     {status === TaskStatus.FAILED && (
                         <div className="text-center max-w-md p-8 bg-red-900/10 border border-red-900/40 rounded-xl">
                             <div className="text-red-500 mb-4">
                                 <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             </div>
                             <h3 className="text-xl font-bold text-white mb-2">Generation Failed</h3>
                             <p className="text-red-300 mb-6 text-sm">{error || "Unknown error occurred"}</p>
                             <button onClick={onCheckStatus} className="bg-red-900/30 hover:bg-red-900/50 text-red-200 px-4 py-2 rounded text-sm border border-red-800/50">
                                 Retry Check
                             </button>
                         </div>
                     )}

                     {/* Fallback for odd state */}
                     {status === TaskStatus.SUCCEEDED && !imageUrl && (
                         <div className="text-gray-500 text-sm">Task succeeded but no image URL found.</div>
                     )}

                </div>
            ) : (
                <div className="w-full h-full p-4 overflow-auto">
                    <pre className="text-xs font-mono text-green-400 bg-[#050505] p-4 rounded-lg border border-gray-800">
                        {rawJson ? JSON.stringify(rawJson, null, 2) : "// No JSON data"}
                    </pre>
                </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default ImageDisplay;