import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, GeneratedImageResult, TaskStatus } from "../types";

// Helper to check for API key availability via AI Studio
export const ensureApiKey = async (): Promise<boolean> => {
  const aistudio = (window as any).aistudio;
  if (aistudio && aistudio.hasSelectedApiKey) {
    const hasKey = await aistudio.hasSelectedApiKey();
    return hasKey;
  }
  return false;
};

export const requestApiKeySelection = async (): Promise<boolean> => {
  const aistudio = (window as any).aistudio;
  if (aistudio && aistudio.openSelectKey) {
    await aistudio.openSelectKey();
    // Per instructions, assume success immediately after opening dialog to mitigate race condition
    return true;
  }
  return false;
};

export const generateImage = async (
  config: GenerationConfig
): Promise<GeneratedImageResult> => {
  try {
    // 1. Ensure we have a fresh client with the correct key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 2. Construct a rich prompt based on user selections
    // We combine the structural/stylistic requirements with the user's content prompt
    const fullPrompt = `
      Create an image with the following specifications:
      
      Core Content: ${config.prompt}
      
      Please ensure high fidelity and adherence to the aspect ratio provided.
    `.trim();

    // 3. Call the Gemini 3 Pro Image (NanoBananoPro) model
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: fullPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio,
          imageSize: config.resolution, // 1K, 2K, or 4K
        },
      },
    });

    // 4. Extract the image from the response
    return extractImageFromResponse(response);

  } catch (error: any) {
    return handleServiceError(error);
  }
};

export const editImage = async (
  imageSrc: string,
  editPrompt: string
): Promise<GeneratedImageResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Parse Data URL to get base64 and mimeType
    const matches = imageSrc.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid image data provided for editing.");
    }
    const mimeType = matches[1];
    const base64Data = matches[2];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: editPrompt,
          },
        ],
      },
    });

    return extractImageFromResponse(response);

  } catch (error: any) {
    return handleServiceError(error);
  }
};

// --- Helpers ---

const extractImageFromResponse = (response: any): GeneratedImageResult => {
  let imageUrl: string | null = null;
    
  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
          const base64EncodeString = part.inlineData.data;
          // The MIME type is usually image/png or image/jpeg depending on model output
          const mimeType = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
          break; 
      }
    }
  }

  if (!imageUrl) {
    throw new Error("No image data found in the response.");
  }

  return {
    imageUrl,
    status: TaskStatus.SUCCEEDED,
    error: null,
  };
};

const handleServiceError = (error: any): GeneratedImageResult => {
  console.error("Image operation failed:", error);
  let errorMessage = "An unexpected error occurred.";
  
  if (error.message?.includes("Requested entity was not found")) {
    errorMessage = "API Key error. Please select a valid project.";
  } else if (error.message) {
    errorMessage = error.message;
  }

  return {
    imageUrl: null,
    status: TaskStatus.FAILED,
    error: errorMessage,
  };
};