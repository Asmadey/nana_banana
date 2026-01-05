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
  const checkStatus = useCallback(async (taskId: string) => {
    try {
      console.log(`[App] Checking status for Task ID: ${taskId}`);
      
      // We pass empty string for apiKey because getJobInfo now hardcodes it as requested
      let response = await getJobInfo(taskId, "");
      
      console.log("[App] API Response:", response);

      // 1. Update Raw JSON View
      setResult(prev => {
        if (prev.taskId === taskId) {
            return { ...prev, rawJson: response };
        }
        return prev;
      });

      const data = response?.data;
      if (!data) return;

      const state = (data.state || data.status || "").toLowerCase();
      console.log(`[App] Task State: ${state}`);

      if (state === "success" || state === "succeeded") {
          let outputUrl = null;

          // Parse resultJson string
          if (data.resultJson) {
              try {
                  let jsonStr = data.resultJson;
                  if (typeof jsonStr !== 'string') {
                      jsonStr = JSON.stringify(jsonStr);
                  }
                  
                  const parsedResult = JSON.parse(jsonStr);
                  console.log("[App] Parsed resultJson:", parsedResult);

                  if (parsedResult.resultUrls && Array.isArray(parsedResult.resultUrls) && parsedResult.resultUrls.length > 0) {
                      outputUrl = parsedResult.resultUrls[0];
                  }
              } catch (e) {
                  console.error("[App] Error parsing resultJson string:", e);
              }
          }

          if (outputUrl) {
              console.log("[App] Success! Found Image URL:", outputUrl);
              
              setResult(prev => ({
                  ...prev,
                  status: TaskStatus.SUCCEEDED,
                  imageUrl: outputUrl,
                  rawJson: response
              }));
              
              updateHistoryItem(taskId, {
                  status: TaskStatus.SUCCEEDED,
                  resultUrl: outputUrl,
                  rawJson: response
              });
              updateHistoryState();
          } else {
             console.warn("[App] Status is success but could not find URL in resultJson. Waiting for next poll or manual check.");
          }

      } else if (state === "failed" || state === "failure") {
          const errMsg = data.failMsg || data.error || "Unknown error";
          setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED,
              error: errMsg,
              rawJson: response
          }));
           updateHistoryItem(taskId, {
              status: TaskStatus.FAILED,
              error: errMsg,
              rawJson: response
          });
          updateHistoryState();
      }

    } catch (pollError: any) {
      console.error("[App] Check Status Failed:", pollError);
    }
  }, [updateHistoryState]);


  // --- Polling Effect (Cron-like logic) ---
  useEffect(() => {
    let intervalId: number;

    const isRunning = result.status === TaskStatus.PROCESSING || result.status === TaskStatus.SUBMITTED;
    const currentTaskId = result.taskId;

    if (isRunning && currentTaskId) {
      console.log(`[App] Starting 5s polling for ${currentTaskId}`);
      
      // Immediate check
      checkStatus(currentTaskId);

      // Interval check every 5s
      intervalId = window.setInterval(() => {
        checkStatus(currentTaskId);
      }, 5000); 
    }

    return () => {
      if (intervalId) {
        console.log(`[App] Stopping polling`);
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

    // Prepare snapshot of inputs
    const inputPreviews = config.imageInputs.map(i => i.previewUrl);
    const configSnapshot = {
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      outputFormat: config.outputFormat
    };

    setResult({ 
      imageUrl: null, 
      status: TaskStatus.SUBMITTED, 
      error: null, 
      rawJson: null,
      inputs: inputPreviews,
      config: configSnapshot
    });

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
        throw new Error(`No Task ID returned. Msg: ${creationData?.msg || 'Unknown'}`);
      }

      const startTime = Date.now();

      // Save to History (SQL persistence simulation)
      const newHistoryItem: HistoryItem = {
        taskId: taskId,
        createdAt: startTime,
        status: TaskStatus.PROCESSING,
        prompt: config.prompt,
        inputPreviews: inputPreviews,
        resultUrl: null,
        error: null,
        rawJson: creationData,
        // Save config parameters
        aspectRatio: config.aspectRatio,
        resolution: config.resolution,
        outputFormat: config.outputFormat
      };
      
      saveHistoryItem(newHistoryItem);
      updateHistoryState();

      // Setting state to PROCESSING triggers the useEffect above to start polling automatically
      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationData,
        taskId: taskId,
        startTime: startTime,
        // Ensure result has config snapshot
        inputs: inputPreviews,
        config: configSnapshot
      }));

    } catch (e: any) {
      console.error("Generation Start Failed", e);
      setResult(prev => ({
        ...prev,
        imageUrl: null,
        status: TaskStatus.FAILED,
        error: e.message || "Failed to start generation task",
        rawJson: { error: e.message }
      }));
    }
  };

  const handleManualCheck = () => {
    if (result.taskId) {
      console.log("MANUAL check triggered for:", result.taskId);
      alert(`Checking status for ID: ${result.taskId}`);
      checkStatus(result.taskId);
    } else {
      alert("No active task to check.");
    }
  };

  const handleNewTask = () => {
    // Reset Configuration
    setConfig({
      prompt: "",
      aspectRatio: AspectRatio.Square,
      resolution: ImageResolution.Res4K,
      outputFormat: OutputFormat.PNG,
      imageInputs: []
    });

    // Reset Result Display
    setResult({
      imageUrl: null,
      status: TaskStatus.IDLE,
      error: null,
      rawJson: null
    });
  };

  const handleHistorySelect = (item: HistoryItem) => {
    // Restore result view from history item
    setResult({
      imageUrl: item.resultUrl,
      status: item.status,
      error: item.error,
      rawJson: item.rawJson,
      taskId: item.taskId,
      startTime: item.createdAt,
      inputs: item.inputPreviews,
      config: {
        aspectRatio: item.aspectRatio,
        resolution: item.resolution,
        outputFormat: item.outputFormat
      }
    });

    // Also restore sidebar config
    setConfig({
      prompt: item.prompt,
      aspectRatio: item.aspectRatio || AspectRatio.Square,
      resolution: item.resolution || ImageResolution.Res4K,
      outputFormat: item.outputFormat || OutputFormat.PNG,
      imageInputs: [] // We don't restore actual files to input, just settings & prompt
    });
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
        onNewTask={handleNewTask}
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