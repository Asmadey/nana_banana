import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import HistorySidebar from './components/HistorySidebar';
import ImageDisplay from './components/ImageDisplay';
import { 
  GenerationConfig, 
  GeneratedImageResult, 
  AspectRatio, 
  ImageResolution, 
  OutputFormat,
  TaskStatus,
  HistoryItem
} from './types';
import { createKieTask, getJobInfo, getStoredApiKey } from './services/kieService';
import { getHistory, saveHistoryItem, updateHistoryItem } from './services/historyService';

const App: React.FC = () => {
  // Application State
  const [config, setConfig] = useState<GenerationConfig>({
    prompt: "",
    aspectRatio: AspectRatio.Square,
    resolution: ImageResolution.Res4K,
    outputFormat: OutputFormat.PNG,
    imageInputs: []
  });

  const [result, setResult] = useState<GeneratedImageResult>({
    imageUrl: null,
    status: TaskStatus.IDLE,
    error: null,
    rawJson: null
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const pollingRef = useRef<number | null>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const updateHistoryState = useCallback(() => {
    setHistory(getHistory());
  }, []);

  const checkStatus = useCallback(async (taskId: string, apiKey: string) => {
    try {
      const info = await getJobInfo(taskId, apiKey);
      console.log("Polling Info:", info);

      // Update raw JSON display
      setResult(prev => ({ ...prev, rawJson: info }));

      // Check for status/state. Some endpoints return 'state', others 'status'.
      const data = info?.data || {};
      const statusRaw = data.state || data.status || info.status; 
      const status = String(statusRaw).toUpperCase();

      if (status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          let outputUrl = null;

          // Strategy 1: Parse resultJson string
          if (data.resultJson) {
            try {
              const parsed = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
              if (parsed.resultUrls && Array.isArray(parsed.resultUrls) && parsed.resultUrls.length > 0) {
                outputUrl = parsed.resultUrls[0];
              }
            } catch (e) {
              console.warn("Error parsing resultJson:", e);
            }
          }

          // Strategy 2: Fallback
          if (!outputUrl) {
            const outputData = data.output || data.result || data.results;
            if (outputData) {
              if (Array.isArray(outputData.results) && outputData.results.length > 0) {
                  outputUrl = outputData.results[0];
              } else if (typeof outputData === 'string') {
                  outputUrl = outputData;
              } else if (outputData.image_url) {
                  outputUrl = outputData.image_url;
              } else if (Array.isArray(outputData) && outputData.length > 0) {
                    outputUrl = outputData[0];
              }
            }
          }
          
          if (outputUrl) {
            setResult(prev => ({
              ...prev,
              status: TaskStatus.SUCCEEDED,
              imageUrl: outputUrl,
              rawJson: info
            }));
            
            // Update History
            updateHistoryItem(taskId, {
              status: TaskStatus.SUCCEEDED,
              resultUrl: outputUrl,
              rawJson: info
            });
            updateHistoryState();

          } else {
             setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED,
              error: "Task succeeded but could not extract image URL from response.",
              rawJson: info
             }));

             updateHistoryItem(taskId, {
              status: TaskStatus.FAILED,
              error: "No URL found",
              rawJson: info
            });
            updateHistoryState();
          }

      } else if (status === "FAILED" || status === "FAILURE") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          const errorMsg = data.error || data.failMsg || info.error || "Task failed on server";
          
          setResult(prev => ({
            ...prev,
            status: TaskStatus.FAILED,
            error: errorMsg,
            rawJson: info
          }));

          updateHistoryItem(taskId, {
            status: TaskStatus.FAILED,
            error: errorMsg,
            rawJson: info
          });
          updateHistoryState();
      }
      // If RUNNING/QUEUED, do nothing, keep polling
    } catch (pollError: any) {
      console.error("Polling error", pollError);
    }
  }, [updateHistoryState]);

  const handleGenerate = async () => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      alert("Please enter an API Key");
      return;
    }

    setResult({ imageUrl: null, status: TaskStatus.SUBMITTED, error: null, rawJson: null });

    try {
      // 1. Create Task
      const creationResponse = await createKieTask(config, apiKey);
      console.log("Task Creation Response:", creationResponse);

      const taskId = 
        creationResponse?.data?.taskId || 
        creationResponse?.data?.id || 
        creationResponse?.data?.task_id || 
        creationResponse?.taskId || 
        creationResponse?.id;

      if (!taskId) {
        if (creationResponse?.code && creationResponse?.code !== 0 && creationResponse?.code !== 200 && creationResponse?.msg) {
             throw new Error(`API Error (${creationResponse.code}): ${creationResponse.msg}`);
        }
        throw new Error(`No Task ID returned.`);
      }

      const startTime = Date.now();

      // Save to History
      const newHistoryItem: HistoryItem = {
        taskId: taskId,
        createdAt: startTime,
        status: TaskStatus.PROCESSING,
        prompt: config.prompt,
        inputPreviews: config.imageInputs.map(i => i.previewUrl),
        resultUrl: null,
        error: null,
        rawJson: creationResponse
      };
      saveHistoryItem(newHistoryItem);
      updateHistoryState();

      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationResponse,
        taskId: taskId,
        startTime: startTime
      }));

      // 2. Start Polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = window.setInterval(() => {
        checkStatus(taskId, apiKey);
      }, 5000);

    } catch (e: any) {
      console.error("Generation Start Failed", e);
      setResult({
        imageUrl: null,
        status: TaskStatus.FAILED,
        error: e.message || "Failed to start generation task",
        rawJson: { error: e.message }
      });
    }
  };

  const handleManualCheck = () => {
    if (result.taskId) {
      const apiKey = getStoredApiKey();
      checkStatus(result.taskId, apiKey);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    // If selecting a running task, try to hook into polling again? 
    // For simplicity, just display the state.
    
    setResult({
      imageUrl: item.resultUrl,
      status: item.status,
      error: item.error,
      rawJson: item.rawJson,
      taskId: item.taskId,
      startTime: item.createdAt
    });

    // Restore prompt
    setConfig(prev => ({
      ...prev,
      prompt: item.prompt,
      // We can't easily restore File objects for inputs, but we could technically restore URLs if we stored them better
    }));

    // If selected task is still processing, restart polling logic?
    if (item.status === TaskStatus.PROCESSING || item.status === TaskStatus.SUBMITTED) {
       const apiKey = getStoredApiKey();
       if (pollingRef.current) clearInterval(pollingRef.current);
       pollingRef.current = window.setInterval(() => {
          checkStatus(item.taskId, apiKey);
        }, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#0a0a0a] text-gray-200 font-sans">
      <Sidebar 
        config={config} 
        setConfig={setConfig} 
        onGenerate={handleGenerate} 
        isGenerating={result.status === TaskStatus.PROCESSING || result.status === TaskStatus.SUBMITTED}
      />
      <HistorySidebar 
        history={history}
        onSelect={handleHistorySelect}
        selectedTaskId={result.taskId}
      />
      <ImageDisplay 
        result={result} 
        onCheckStatus={handleManualCheck}
      />
    </div>
  );
};

export default App;