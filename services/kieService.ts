import { GenerationConfig, ImageInput, OutputFormat } from "../types";
import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

const DEFAULT_API_KEY = "f128787b6e0a3780b319a4d13119abf2";
const BASE_URL = "https://api.kie.ai/api/v1/jobs";

// Supabase Configuration
const SUPABASE_PROJECT_ID = "ihbzndymkizrpeoawojd";
const SUPABASE_BUCKET = "Mini Site";
// Updated default key as requested
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloYnpuZHlta2l6cnBlb2F3b2pkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc0Mjk3NiwiZXhwIjoyMDgxMzE4OTc2fQ.Wmi2HFhgNmz0bZUe5WR01BNUJwrbE_YSnUH_RqxyMko";

export const getStoredApiKey = () => {
  return localStorage.getItem("kie_api_key") || DEFAULT_API_KEY;
};

export const setStoredApiKey = (key: string) => {
  localStorage.setItem("kie_api_key", key);
};

export const getStoredSupabaseKey = () => {
  return localStorage.getItem("supabase_service_key") || DEFAULT_SUPABASE_KEY;
};

export const setStoredSupabaseKey = (key: string) => {
  localStorage.setItem("supabase_service_key", key);
};

export const getStoredVercelToken = () => {
  return localStorage.getItem("vercel_blob_token") || "";
};

export const setStoredVercelToken = (token: string) => {
  localStorage.setItem("vercel_blob_token", token);
};

// Helper delay function
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to upload file to Vercel Blob
const uploadToVercelBlob = async (file: File, token: string): Promise<string> => {
  try {
    console.log(`Uploading ${file.name} to Vercel Blob...`);
    const { url } = await put(file.name, file, {
      access: 'public',
      token: token
    });
    console.log(`Vercel Blob upload successful: ${url}`);
    return url;
  } catch (error: any) {
    console.error("Vercel Blob upload failed:", error);
    throw new Error(`Vercel Blob Error: ${error.message}`);
  }
};

// Helper to upload file to Supabase and get Public URL
const uploadToSupabase = async (file: File): Promise<string> => {
  try {
    const serviceKey = getStoredSupabaseKey();
    if (!serviceKey) {
      throw new Error("Supabase Service Key is missing. Please add it in the Sidebar configuration.");
    }

    // Initialize Supabase Client
    const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    // 1. Sanitize filename and add random string to avoid collisions
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const path = `${Date.now()}_${randomSuffix}_${cleanFileName}`;
    
    // 2. Upload using SDK
    const { data, error } = await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Supabase SDK Upload Error:", error);
      
      let msg = error.message;
      if (msg === "The resource was not found") {
          msg = `Bucket '${SUPABASE_BUCKET}' not found. Check bucket name.`;
      } else if (msg.includes("400")) {
          msg = "Bad Request (400). Check if the bucket name is correct and the key has permissions.";
      }
      
      throw new Error(`Supabase Error: ${msg}`);
    }

    // 3. Get Public URL
    const { data: publicData } = supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(path);

    if (!publicData || !publicData.publicUrl) {
        throw new Error("Failed to retrieve public URL for uploaded image.");
    }
    
    console.log(`Supabase upload successful: ${publicData.publicUrl}`);
    return publicData.publicUrl;

  } catch (error: any) {
    console.error("Upload process failed", error);
    throw error; // Re-throw to be caught by caller
  }
};

export const createKieTask = async (config: GenerationConfig, apiKey: string) => {
  const processedImages: string[] = [];
  const vercelToken = getStoredVercelToken();

  // Process images: URLs pass through, Files get uploaded
  try {
    for (const img of config.imageInputs) {
      if (img.type === 'url') {
        processedImages.push(img.value as string);
      } else {
        const file = img.value as File;
        
        // Priority: Vercel Blob > Supabase
        if (vercelToken && vercelToken.trim().length > 0) {
          const url = await uploadToVercelBlob(file, vercelToken);
          // Shorter wait for Vercel as it's usually faster to propagate
          await wait(2000); 
          processedImages.push(url);
        } else {
          // Fallback to Supabase
          const url = await uploadToSupabase(file);
          // Longer wait for Supabase
          console.log("Waiting 5 seconds for Supabase CDN propagation...");
          await wait(5000);
          processedImages.push(url);
        }
      }
    }
  } catch (uploadError: any) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const payload: any = {
    model: "nano-banana-pro",
    input: {
      prompt: config.prompt,
      aspect_ratio: config.aspectRatio,
      resolution: config.resolution,
      output_format: config.outputFormat,
    }
  };

  // Only add image_input if there are images
  if (processedImages.length > 0) {
    payload.input.image_input = processedImages;
  }

  const response = await fetch(`${BASE_URL}/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || "Failed to create task");
  }

  return response.json();
};

export const getJobInfo = async (jobId: string, apiKey: string) => {
  const url = new URL(`${BASE_URL}/recordInfo`);
  url.searchParams.append("id", jobId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
     throw new Error("Failed to fetch job info");
  }

  return response.json();
};