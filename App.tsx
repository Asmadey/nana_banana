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
      console.log(`Checking status for Task ID: ${taskId}`);
      let info = await getJobInfo(taskId, apiKey);
      console.log("API Response Info:", info);

      // Handle case where API might return an array (e.g. [ { code: 200, ... } ])
      if (Array.isArray(info)) {
        info = info.length > 0 ? info[0] : {};
      }

      // Update raw JSON display so user can see what's happening
      setResult(prev => ({ ...prev, rawJson: info }));

      // Check for status/state. 
      const data = info?.data || {};
      const statusRaw = data.state || data.status || info.status || info.state; 
      
      // If we absolutely cannot find a status but we have resultJson, assume success
      let derivedStatus = statusRaw ? String(statusRaw).toUpperCase() : "";
      if (!derivedStatus && data.resultJson) {
         derivedStatus = "SUCCESS";
      }

      console.log(`Derived Status: ${derivedStatus}`);

      if (derivedStatus === "SUCCEEDED" || derivedStatus === "SUCCESS" || derivedStatus === "COMPLETED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          let outputUrl = null;

          // Strategy 1: Parse resultJson string
          if (data.resultJson) {
            try {
              let resultObj = data.resultJson;
              
              // Handle stringified JSON
              if (typeof resultObj === 'string') {
                  try {
                    resultObj = JSON.parse(resultObj);
                  } catch (e) {
                    console.warn("First JSON parse failed", e);
                  }
              }
              // Handle double-stringified JSON (rare but possible)
              if (typeof resultObj === 'string') {
                 try {
                    resultObj = JSON.parse(resultObj);
                 } catch (e) {
                    console.warn("Second JSON parse failed", e);
                 }
              }

              console.log("Parsed resultJson object:", resultObj);
              
              if (resultObj?.resultUrls && Array.isArray(resultObj.resultUrls) && resultObj.resultUrls.length > 0) {
                outputUrl = resultObj.resultUrls[0];
              }
            } catch (e) {
              console.warn("Error processing resultJson:", e);
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
            console.log("Image URL found:", outputUrl);
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
             console.error("Task Success but NO Image URL found");
             // Task marked as success but no URL found - STOP SPINNER
             setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED, // Mark as failed in UI to stop spinner
              error: "Task completed successfully but image URL could not be parsed. See JSON tab.",
              rawJson: info
             }));

             updateHistoryItem(taskId, {
              status: TaskStatus.FAILED,
              error: "No URL found in success response",
              rawJson: info
            });
            updateHistoryState();
          }

      } else if (derivedStatus === "FAILED" || derivedStatus === "FAILURE") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          const errorMsg = data.error || data.failMsg || info.error || "Task failed on server";
          console.error("Task Failed:", errorMsg);
          
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
      } else {
          console.log("Task still processing...");
      }
      // If RUNNING/QUEUED, do nothing, keep polling
    } catch (pollError: any) {
      console.error("Polling error caught in App.tsx:", pollError);
      // We do NOT stop polling on network error immediately, hoping it's transient.
      // But we update the JSON view so user sees the error.
      setResult(prev => ({ 
        ...prev, 
        rawJson: { error: pollError.message, details: "Polling failed (network/parsing)" } 
      }));
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
      console.log("Creating Task...");
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

      console.log(`Task ID received: ${taskId}`);
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
      
      // Initial check after 1.5 second
      setTimeout(() => checkStatus(taskId, apiKey), 1500);

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