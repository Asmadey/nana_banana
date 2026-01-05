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
      let info = await getJobInfo(taskId, apiKey);
      console.log("Polling Info:", info);

      // Handle case where API might return an array (e.g. [ { code: 200, ... } ])
      if (Array.isArray(info)) {
        info = info.length > 0 ? info[0] : {};
      }

      // Update raw JSON display
      setResult(prev => ({ ...prev, rawJson: info }));

      // Check for status/state. 
      // 1. Check inside 'data' object (standard Kie format)
      // 2. Check root level (fallback)
      const data = info?.data || {};
      const statusRaw = data.state || data.status || info.status || info.state; 
      
      // If we absolutely cannot find a status but we have resultJson, assume success
      // This is a safeguard for malformed API responses that contain data but missing status
      let derivedStatus = statusRaw ? String(statusRaw).toUpperCase() : "";
      if (!derivedStatus && data.resultJson) {
         derivedStatus = "SUCCESS";
      }

      if (derivedStatus === "SUCCEEDED" || derivedStatus === "SUCCESS" || derivedStatus === "COMPLETED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          let outputUrl = null;

          // Strategy 1: Parse resultJson string
          if (data.resultJson) {
            try {
              const jsonStr = typeof data.resultJson === 'string' ? data.resultJson : JSON.stringify(data.resultJson);
              const parsed = JSON.parse(jsonStr);
              
              if (parsed.resultUrls && Array.isArray(parsed.resultUrls) && parsed.resultUrls.length > 0) {
                outputUrl = parsed.resultUrls[0];
              }
            } catch (e) {
              console.warn("Error parsing resultJson:", e);
            }
          }

          // Strategy 2: Fallback to other fields
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
             // Task marked as success but no URL found
             setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED,
              error: "Task succeeded but could not extract image URL from response. Check JSON tab.",
              rawJson: info
             }));

             updateHistoryItem(taskId, {
              status: TaskStatus.FAILED,
              error: "No URL found",
              rawJson: info
            });
            updateHistoryState();
          }

      } else if (derivedStatus === "FAILED" || derivedStatus === "FAILURE") {
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
      // Optional: Add a temporary error flash or keep previous state?
      // We keep previous state so polling can retry.
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

      // Handle array response for creation as well, just in case
      const creationData = Array.isArray(creationResponse) ? creationResponse[0] : creationResponse;

      const taskId = 
        creationData?.data?.taskId || 
        creationData?.data?.id || 
        creationData?.data?.task_id || 
        creationData?.taskId || 
        creationData?.id;

      if (!taskId) {
        if (creationData?.code && creationData?.code !== 0 && creationData?.code !== 200 && creationData?.msg) {
             throw new Error(`API Error (${creationData.code}): ${creationData.msg}`);
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
        rawJson: creationData
      };
      saveHistoryItem(newHistoryItem);
      updateHistoryState();

      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationData,
        taskId: taskId,
        startTime: startTime
      }));

      // 2. Start Polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      
      // Initial check after 1 second
      setTimeout(() => checkStatus(taskId, apiKey), 1000);

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
      console.log("Manual check triggered for:", result.taskId);
      checkStatus(result.taskId, apiKey);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setResult({
      imageUrl: item.resultUrl,
      status: item.status,
      error: item.error,
      rawJson: item.rawJson,
      taskId: item.taskId,
      startTime: item.createdAt
    });

    setConfig(prev => ({
      ...prev,
      prompt: item.prompt,
    }));

    if (item.status === TaskStatus.PROCESSING || item.status === TaskStatus.SUBMITTED) {
       const apiKey = getStoredApiKey();
       if (pollingRef.current) clearInterval(pollingRef.current);
       // Immediate check
       checkStatus(item.taskId, apiKey);
       // Resume polling
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