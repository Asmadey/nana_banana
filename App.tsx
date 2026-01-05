import React, { useState, useRef, useEffect } from 'react';
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
        // If we have a successful response but no ID, it might be an immediate error wrapped in 200 OK
        // Allow 200 as a success code (some APIs return code: 200, msg: success)
        if (creationResponse?.code && creationResponse?.code !== 0 && creationResponse?.code !== 200 && creationResponse?.msg) {
             throw new Error(`API Error (${creationResponse.code}): ${creationResponse.msg}`);
        }
        
        // Include the response in the error message for debugging
        const debugResponse = JSON.stringify(creationResponse);
        console.error("Missing Task ID. Full Response:", debugResponse);
        throw new Error(`No Task ID returned. API Response: ${debugResponse}`);
      }

      setResult(prev => ({ 
        ...prev, 
        status: TaskStatus.PROCESSING, 
        rawJson: creationResponse 
      }));

      // 2. Start Polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      
      pollingRef.current = window.setInterval(async () => {
        try {
          const info = await getJobInfo(taskId, apiKey);
          
          // Debugging log to understand response structure
          console.log("Polling Info:", info);

          // Update raw JSON display
          setResult(prev => ({ ...prev, rawJson: info }));

          // Check Status - Logic depends on actual API response structure
          // Assuming structure based on typical Kie/Async APIs: 
          // data.status might be "SUCCESS", "FAILURE", "QUEUED", "RUNNING"
          // Or sometimes simpler like status: "SUCCESS" at root
          const status = info?.data?.status || info?.status; 

          if (status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") {
             if (pollingRef.current) clearInterval(pollingRef.current);
             
             // Extract image URL. Assuming data.output.results[0] or data.result or data.output.image_url
             const outputData = info?.data?.output || info?.data?.result;
             let outputUrl = null;

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
             
             setResult(prev => ({
               ...prev,
               status: TaskStatus.SUCCEEDED,
               imageUrl: outputUrl,
               rawJson: info
             }));
          } else if (status === "FAILED" || status === "FAILURE") {
             if (pollingRef.current) clearInterval(pollingRef.current);
             setResult(prev => ({
               ...prev,
               status: TaskStatus.FAILED,
               error: info?.data?.error || info?.error || "Task failed on server",
               rawJson: info
             }));
          }
          // If RUNNING/QUEUED, do nothing, keep polling

        } catch (pollError: any) {
          console.error("Polling error", pollError);
          // Don't stop polling immediately on one network blip
        }
      }, 1000); // Poll every 1 second

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

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#0a0a0a] text-gray-200 font-sans">
      <Sidebar 
        config={config} 
        setConfig={setConfig} 
        onGenerate={handleGenerate} 
        isGenerating={result.status === TaskStatus.PROCESSING || result.status === TaskStatus.SUBMITTED}
      />
      <ImageDisplay result={result} />
    </div>
  );
};

export default App;