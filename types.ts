
export enum AspectRatio {
  Square = "1:1",
  Portrait34 = "3:4",
  Landscape43 = "4:3",
  Portrait916 = "9:16",
  Landscape169 = "16:9"
}

export enum ImageResolution {
  Res1K = "1K",
  Res2K = "2K",
  Res4K = "4K"
}

export enum OutputFormat {
  PNG = "png",
  JPG = "jpg"
}

export interface ImageInput {
  type: 'file' | 'url';
  value: File | string;
  previewUrl: string; // For display
  id: string;
}

export enum TaskStatus {
  IDLE = "IDLE",
  SUBMITTED = "SUBMITTED",
  PROCESSING = "PROCESSING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED"
}

export interface GenerationConfig {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: ImageResolution;
  outputFormat: OutputFormat;
  imageInputs: ImageInput[];
}

export interface GeneratedImageResult {
  imageUrl: string | null;
  status: TaskStatus;
  progress?: number;
  error: string | null;
  rawJson?: any; // To display JSON response
  taskId?: string; // ID for polling/debugging
  startTime?: number; // Timestamp when task started
}

export interface HistoryItem {
  taskId: string;
  createdAt: number;
  status: TaskStatus;
  prompt: string;
  inputPreviews: string[]; // URLs of input images
  resultUrl: string | null;
  error: string | null;
  rawJson: any;
}