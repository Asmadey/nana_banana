import React, { useState } from 'react';
import { 
  AspectRatio, 
  OutputFormat, 
  GenerationConfig, 
  ImageResolution, 
  ImageInput
} from '../types';

interface SidebarProps {
  config: GenerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  config, 
  setConfig, 
  onGenerate, 
  isGenerating
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');
  const [urlInput, setUrlInput] = useState("");

  const handleChange = <K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const currentCount = config.imageInputs.length;
      const remainingSlots = 8 - currentCount;
      
      const filesToAdd = newFiles.slice(0, remainingSlots).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        type: 'file' as const,
        value: file,
        previewUrl: URL.createObjectURL(file)
      }));

      setConfig(prev => ({
        ...prev,
        imageInputs: [...prev.imageInputs, ...filesToAdd]
      }));
    }
  };

  const handleAddUrl = () => {
    if (!urlInput) return;
    const currentCount = config.imageInputs.length;
    if (currentCount >= 8) return;

    const newInput: ImageInput = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'url',
      value: urlInput,
      previewUrl: urlInput // Assuming valid image URL for preview
    };

    setConfig(prev => ({
      ...prev,
      imageInputs: [...prev.imageInputs, newInput]
    }));
    setUrlInput("");
  };

  const removeImage = (id: string) => {
    setConfig(prev => ({
      ...prev,
      imageInputs: prev.imageInputs.filter(img => img.id !== id)
    }));
  };

  const handleReset = () => {
    setConfig({
      prompt: "",
      aspectRatio: AspectRatio.Square,
      resolution: ImageResolution.Res4K,
      outputFormat: OutputFormat.PNG,
      imageInputs: []
    });
  };

  return (
    <div className="w-full md:w-[420px] flex-shrink-0 bg-[#0a0a0a] border-r border-gray-800 h-full overflow-y-auto flex flex-col text-gray-300 font-sans custom-scrollbar">
      
      {/* Header Title */}
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white tracking-tight">NanoBanano Studio</h1>
        <p className="text-xs text-gray-500">Generation Settings</p>
      </div>

      <div className="p-6 space-y-8 pb-24">
        
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Prompt</label>
          <textarea
            className="w-full h-32 p-3 text-sm bg-[#111] border border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-200 placeholder-gray-600"
            placeholder="Describe your image..."
            value={config.prompt}
            onChange={(e) => handleChange('prompt', e.target.value)}
          />
        </div>

        {/* Image Input Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">Images (optional)</label>
            <span className="text-xs text-gray-500">{config.imageInputs.length}/8</span>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 mb-2">
            <button 
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2 text-xs font-medium ${activeTab === 'files' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Files
            </button>
            <button 
              onClick={() => setActiveTab('urls')}
              className={`px-4 py-2 text-xs font-medium ${activeTab === 'urls' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              URLs
            </button>
          </div>

          {/* Dropzone / Input Area */}
          <div className="bg-[#111] border border-dashed border-gray-700 rounded-lg p-6 text-center transition-colors hover:border-gray-500">
            {activeTab === 'files' ? (
              <div className="relative">
                <input 
                  type="file" 
                  multiple 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={config.imageInputs.length >= 8}
                />
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm text-gray-400">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-600">JPEG, PNG, WEBP (Max 30MB)</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste image URL here"
                  className="flex-1 bg-transparent border-b border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500 pb-1"
                />
                <button 
                  onClick={handleAddUrl}
                  disabled={!urlInput}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Preview Thumbnails */}
          {config.imageInputs.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {config.imageInputs.map((img) => (
                <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-gray-700 bg-gray-900">
                  <img src={img.previewUrl} alt="input" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 bg-black/70 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings Grid */}
        <div className="grid gap-6">
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">aspect_ratio</label>
            <div className="relative">
              <select
                className="w-full p-2.5 text-sm bg-[#111] border border-gray-700 rounded-lg text-white appearance-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={config.aspectRatio}
                onChange={(e) => handleChange('aspectRatio', e.target.value as AspectRatio)}
              >
                <option value={AspectRatio.Square}>1:1</option>
                <option value={AspectRatio.Landscape169}>16:9</option>
                <option value={AspectRatio.Portrait916}>9:16</option>
                <option value={AspectRatio.Landscape43}>4:3</option>
                <option value={AspectRatio.Portrait34}>3:4</option>
              </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          {/* Resolution */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">resolution</label>
            <div className="flex gap-2">
              {[ImageResolution.Res1K, ImageResolution.Res2K, ImageResolution.Res4K].map((res) => (
                <button
                  key={res}
                  onClick={() => handleChange('resolution', res)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border ${
                    config.resolution === res 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                    : 'bg-[#111] border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Output Format */}
           <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">output_format</label>
            <div className="flex gap-2">
              {[OutputFormat.PNG, OutputFormat.JPG].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleChange('outputFormat', fmt)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border uppercase ${
                    config.outputFormat === fmt 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                    : 'bg-[#111] border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="sticky bottom-0 left-0 right-0 p-6 bg-[#0a0a0a] border-t border-gray-800 z-10 flex gap-3">
        <button
          onClick={handleReset}
          className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 font-medium rounded-lg border border-gray-700 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onGenerate}
          disabled={isGenerating || !config.prompt}
          className={`flex-1 flex items-center justify-center gap-2 font-medium py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-900/20
            ${isGenerating || !config.prompt 
              ? 'bg-blue-900/50 text-blue-200/50 cursor-not-allowed border border-blue-900/30' 
              : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500'}`}
        >
          {isGenerating ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/></svg>
              18 Run
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;