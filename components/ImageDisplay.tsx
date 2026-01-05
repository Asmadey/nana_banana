import React, { useState, useEffect } from 'react';
import { GeneratedImageResult, TaskStatus } from '../types';
import SettingsModal from './SettingsModal';

interface ImageDisplayProps {
  result: GeneratedImageResult;
  onCheckStatus?: () => void;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ result, onCheckStatus }) => {
  const { imageUrl, status, error, rawJson, taskId, startTime } = result;
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer logic
  useEffect(() => {
    let interval: number;
    if ((status === TaskStatus.PROCESSING || status === TaskStatus.SUBMITTED) && startTime) {
      // Update timer immediately
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      interval = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 bg-[#111] flex flex-col h-full overflow-hidden text-gray-200 relative">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
        <h2 className="text-xl font-semibold">Output</h2>
        
        <div className="flex items-center gap-4">
             {/* Settings Button */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800 group"
                title="API Settings"
             >
                <svg className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
             </button>

             {/* View Toggle */}
            <div className="bg-[#1a1a1a] rounded-lg p-1 flex border border-gray-700">
              <button 
                onClick={() => setViewMode('preview')}
                className={`px-4 py-1.5 text-sm font-medium rounded ${viewMode === 'preview' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                Preview
              </button>
              <button 
                 onClick={() => setViewMode('json')}
                 className={`px-4 py-1.5 text-sm font-medium rounded ${viewMode === 'json' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                JSON
              </button>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-auto bg-[#0a0a0a]">
        
        {viewMode === 'preview' ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            
            {status === TaskStatus.PROCESSING || status === TaskStatus.SUBMITTED ? (
              <div className="text-center p-12 bg-[#1a1a1a] rounded-xl border border-gray-800 shadow-xl max-w-sm w-full">
                <div className="inline-block relative w-16 h-16 mb-6">
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-700 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Generating Image</h3>
                    <p className="text-gray-400 text-sm mt-1">Waiting for Nano Banana Pro</p>
                  </div>
                  
                  <div className="flex flex-col gap-2 py-2 border-y border-gray-800">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Task ID</span>
                      <span className="font-mono text-blue-300 select-all">{taskId || "..."}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Elapsed</span>
                      <span className="font-mono text-white">{formatTime(elapsedTime)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={onCheckStatus}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-gray-700"
                    >
                      Check Status Manually
                    </button>
                  </div>
                </div>
              </div>
            ) : status === TaskStatus.FAILED || error ? (
               <div className="text-center p-12 max-w-md border border-red-900/50 bg-red-900/10 rounded-xl">
                <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h3 className="text-lg font-medium text-white">Generation Failed</h3>
                <p className="mt-2 text-red-300 text-sm">{error || "Unknown error occurred"}</p>
                {taskId && (
                  <div className="mt-4 pt-4 border-t border-red-900/30">
                     <p className="text-xs text-gray-400 mb-2">Task ID: {taskId}</p>
                     <button 
                      onClick={onCheckStatus}
                      className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-white text-sm rounded-lg transition-colors border border-red-800"
                    >
                      Retry Status Check
                    </button>
                  </div>
                )}
              </div>
            ) : imageUrl ? (
              <div className="relative group max-w-full max-h-full">
                <div className="bg-[#111] p-2 rounded-xl border border-gray-800 shadow-2xl">
                   <img 
                    src={imageUrl} 
                    alt="Generated output" 
                    className="max-w-full max-h-[75vh] object-contain rounded-lg"
                  />
                  <div className="mt-3 flex items-center justify-between px-2 pb-1">
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">image</span>
                    <a 
                       href={imageUrl} 
                       download={`nano-banana-${Date.now()}`}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                       </svg>
                       Download
                     </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-12 border-2 border-dashed border-gray-800 rounded-xl">
                <div className="w-20 h-20 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4 text-gray-700">
                   <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-gray-400">Ready to Generate</h3>
                <p className="mt-2 text-gray-600 text-sm max-w-sm">
                  Enter your prompt and click "Run" to create images with Nano Banana Pro.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-[#111] border border-gray-800 rounded-lg p-4 overflow-auto">
            <pre className="text-xs text-green-400 font-mono">
              {rawJson ? JSON.stringify(rawJson, null, 2) : "// No data available yet"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageDisplay;