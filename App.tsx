import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ImageDisplay from './components/ImageDisplay';
import { 
  GenerationConfig, 
  GeneratedImageResult, 
  AspectRatio, 
  ImageResolution, 
  OutputFormat,
  TaskStatus
} from './types';
import { createKieTask, getJobInfo, getStoredApiKey } from './services/kieService';

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

  const pollingRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const checkStatus = useCallback(async (taskId: string, apiKey: string) => {
    try {
      const info = await getJobInfo(taskId, apiKey);
      console.log("Polling Info:", info);

      // Update raw JSON display
      setResult(prev => ({ ...prev, rawJson: info }));

      // Check for status/state. Some endpoints return 'state', others 'status'.
      // Based on user feedback: data.state = "success"
      const data = info?.data || {};
      const statusRaw = data.state || data.status || info.status; 
      const status = String(statusRaw).toUpperCase();

      if (status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          let outputUrl = null;

          // Strategy 1: Parse resultJson string (Specific for this API structure)
          // Format: "resultJson": "{\"resultUrls\":[\"...\"]}"
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

          // Strategy 2: Fallback to standard output fields
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
          } else {
             // Task succeeded but no URL found yet? Keep polling or mark as error?
             // For now, let's stop and show error to avoid infinite loop of success-without-image
             setResult(prev => ({
              ...prev,
              status: TaskStatus.FAILED,
              error: "Task succeeded but could not extract image URL from response.",
              rawJson: info
             }));
          }

      } else if (status === "FAILED" || status === "FAILURE") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setResult(prev => ({
            ...prev,
            status: TaskStatus.FAILED,
            error: data.error || data.failMsg || info.error || "Task failed on server",
            rawJson: info
          }));
      }
      // If RUNNING/QUEUED, do nothing, keep polling
    } catch (pollError: any) {
      console.error("Polling error", pollError);
    }
  }, []);

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

      // Robustly check for Task ID in various common API response patterns
      const taskId = 
        creationResponse?.data?.taskId || 
        creationResponse?.data?.id || 
        creationResponse?.data?.task_id || 
        creationResponse?.data?.job_id ||
        creationResponse?.id || 
        creationResponse?.task_id || 
        creationResponse?.job_id || 
        creationResponse?.data?.uuid ||
        creationResponse?.taskId || 
        creationResponse?.requestId ||
        creationResponse?.request_id ||
        (typeof creationResponse?.data === 'string' ? creationResponse?.data : null) ||
        (typeof creationResponse?.result === 'string' ? creationResponse?.result : null) ||
        creationResponse?.result?.id;

      if (!taskId) {
        if (creationResponse?.code && creationResponse?.code !== 0 && creationResponse?.code !== 200 && creationResponse?.msg) {
             throw new Error(`API Error (${creationResponse.code}): ${creationResponse.msg}`);
        }
        
        const debugResponse = JSON.stringify(creationResponse);
        console.error("Missing Task ID. Full Response:", debugResponse);
        throw new Error(`No Task ID returned. API Response: ${debugResponse}`);
      }

      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationResponse,
        taskId: taskId,
        startTime: Date.now()
      }));

      // 2. Start Polling (Every 5 seconds)
      if (pollingRef.current) clearInterval(pollingRef.current);
      
      // Immediate check to see if it was instant (or for debugging)
      // checkStatus(taskId, apiKey);

      pollingRef.current = window.setInterval(() => {
        checkStatus(taskId, apiKey);
      }, 5000);

    } catch (e: any) {
      console.error("Generation Start Failed", e);
      setResult({
        imageUrl: null,
        status: TaskStatus.FAILED,
        error: e.message || "Failed to start generation task",
        rawJson: { error: e.message, details: "Check console logs" }
      });
    }
  };

  const handleManualCheck = () => {
    if (result.taskId) {
      const apiKey = getStoredApiKey();
      checkStatus(result.taskId, apiKey);
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
      <ImageDisplay 
        result={result} 
        onCheckStatus={handleManualCheck}
      />
    </div>
  );
};

export default App;