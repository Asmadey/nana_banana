import React, { useState, useEffect, useCallback } from 'react';
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
  
  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const updateHistoryState = useCallback(() => {
    setHistory(getHistory());
  }, []);

  // --- Centralized Status Check Logic ---
  const checkStatus = useCallback(async (taskId: string, apiKey: string) => {
    try {
      console.log(`[Polling] Checking status for Task ID: ${taskId}`);
      let info = await getJobInfo(taskId, apiKey);
      
      // Handle array response
      if (Array.isArray(info)) {
        info = info.length > 0 ? info[0] : {};
      }

      console.log("[Polling] Raw Info:", info);

      // Update raw JSON display immediately so user sees activity
      setResult(prev => {
        // Only update if it's the same task to avoid UI flickering if user switched tasks quickly
        if (prev.taskId === taskId) {
            return { ...prev, rawJson: info };
        }
        return prev;
      });

      // Extract Status
      const data = info?.data || {};
      const statusRaw = data.state || data.status || info.status || info.state; 
      
      let derivedStatus = statusRaw ? String(statusRaw).toUpperCase() : "";
      
      // Fallback: if no status but resultJson exists, assume success
      // If the API returns resultJson, it means the job is done, regardless of what 'state' says
      if (data.resultJson) {
         console.log("[Polling] 'resultJson' found, assuming SUCCESS.");
         derivedStatus = "SUCCESS";
      }

      console.log(`[Polling] Derived Status: ${derivedStatus}`);

      if (derivedStatus === "SUCCEEDED" || derivedStatus === "SUCCESS" || derivedStatus === "COMPLETED") {
          
          let outputUrl = null;

          // Strategy 1: Parse resultJson (Prioritize this)
          if (data.resultJson) {
            try {
              let resultObj = data.resultJson;
              
              // It comes as a stringified JSON
              if (typeof resultObj === 'string') {
                  console.log("[Polling] Parsing resultJson string:", resultObj);
                  try { 
                    resultObj = JSON.parse(resultObj); 
                  } catch (e) { 
                    console.error("[Polling] JSON Parse Error 1:", e);
                  }
              }
              
              // Double check if it was double-encoded
              if (typeof resultObj === 'string') {
                 try { 
                    resultObj = JSON.parse(resultObj); 
                 } catch (e) { 
                    console.error("[Polling] JSON Parse Error 2:", e);
                 }
              }

              // Now check structure
              if (resultObj?.resultUrls && Array.isArray(resultObj.resultUrls) && resultObj.resultUrls.length > 0) {
                outputUrl = resultObj.resultUrls[0];
              } else if (resultObj?.image_url) {
                outputUrl = resultObj.image_url;
              }

              console.log("[Polling] Parsed URL from resultJson:", outputUrl);

            } catch (e) {
              console.warn("Error processing resultJson block:", e);
            }
          }

          // Strategy 2: Fallback fields if resultJson failed or empty
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
            console.log("[Polling] Final Image URL:", outputUrl);
            setResult(prev => ({
              ...prev,
              status: TaskStatus.SUCCEEDED,
              imageUrl: outputUrl,
              rawJson: info
            }));
            
            updateHistoryItem(taskId, {
              status: TaskStatus.SUCCEEDED,
              resultUrl: outputUrl,
              rawJson: info
            });
            updateHistoryState();

          } else {
             console.error("[Polling] Success detected but NO URL found in:", data);
             setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED,
              error: "Task completed but image URL extraction failed. Check JSON tab.",
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
          const errorMsg = data.error || data.failMsg || info.error || "Task failed on server";
          console.error("[Polling] Task Failed:", errorMsg);
          
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
      // If derivedStatus is empty or RUNNING/QUEUED, do nothing. 
      // The useEffect loop or manual click will trigger this again.

    } catch (pollError: any) {
      console.error("[Polling] Network/Parse Error:", pollError);
      setResult(prev => ({ 
        ...prev, 
        rawJson: { error: pollError.message, details: "Polling check failed, see console." } 
      }));
    }
  }, [updateHistoryState]);


  // --- Polling Effect (Cron-like logic) ---
  useEffect(() => {
    let intervalId: number;

    const needsPolling = (result.status === TaskStatus.PROCESSING || result.status === TaskStatus.SUBMITTED) && result.taskId;

    if (needsPolling) {
      const apiKey = getStoredApiKey();
      const currentTaskId = result.taskId!;

      console.log(`[Effect] Starting auto-polling for ${currentTaskId}`);
      
      // Immediate check
      checkStatus(currentTaskId, apiKey);

      // Interval check every 5s
      intervalId = window.setInterval(() => {
        checkStatus(currentTaskId, apiKey);
      }, 5000); 
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [result.status, result.taskId, checkStatus]);


  const handleGenerate = async () => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      alert("Please enter an API Key");
      return;
    }

    setResult({ imageUrl: null, status: TaskStatus.SUBMITTED, error: null, rawJson: null });

    try {
      console.log("Creating Task...");
      const creationResponse = await createKieTask(config, apiKey);
      console.log("Task Creation Response:", creationResponse);

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

      // Setting state to PROCESSING triggers the useEffect above to start polling automatically
      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationData,
        taskId: taskId,
        startTime: startTime
      }));

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
      console.log("MANUAL check triggered for:", result.taskId);
      alert(`Checking status for ${result.taskId}... Check Console for details.`);
      checkStatus(result.taskId, apiKey);
    } else {
      alert("No active task to check.");
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    // If we select an item that is still processing, the status update here
    // will trigger the useEffect to start polling again automatically.
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