import React, { useState, useEffect } from 'react';
import { 
  getStoredApiKey, setStoredApiKey, 
  getStoredSupabaseKey, setStoredSupabaseKey,
  getStoredVercelToken, setStoredVercelToken 
} from '../services/kieService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showVercelToken, setShowVercelToken] = useState(false);
  const [isKeyVerified, setIsKeyVerified] = useState(false);

  // Load keys when modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setSupabaseKey(getStoredSupabaseKey());
      setVercelToken(getStoredVercelToken());
      setIsKeyVerified(false);
    }
  }, [isOpen]);

  const handleSaveKeys = () => {
    setStoredApiKey(apiKey);
    setStoredSupabaseKey(supabaseKey);
    setStoredVercelToken(vercelToken);
    setIsKeyVerified(true);
    setTimeout(() => {
        setIsKeyVerified(false);
        onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API Settings
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
            {/* Kie API Key */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kie.ai API Key</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"} 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-700 text-white text-xs rounded px-2 py-2 focus:border-blue-500 focus:outline-none pr-8"
                  placeholder="Enter Kie API Key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showApiKey ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Vercel Blob Token */}
            <div>
              <label className="block text-xs text-blue-400 font-medium mb-1 flex justify-between">
                <span>Vercel Blob Token (Preferred)</span>
              </label>
              <div className="relative">
                <input 
                  type={showVercelToken ? "text" : "password"} 
                  value={vercelToken}
                  onChange={(e) => setVercelToken(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-blue-900/50 text-white text-xs rounded px-2 py-2 focus:border-blue-500 focus:outline-none pr-8"
                  placeholder="BLOB_READ_WRITE_TOKEN"
                />
                <button
                  type="button"
                  onClick={() => setShowVercelToken(!showVercelToken)}
                  className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                   {showVercelToken ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Supabase Service Key */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supabase Service Key (Fallback)</label>
              <div className="relative">
                <input 
                  type={showSupabaseKey ? "text" : "password"} 
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-700 text-white text-xs rounded px-2 py-2 focus:border-blue-500 focus:outline-none pr-8"
                  placeholder="Enter 'service_role' key"
                />
                <button
                  type="button"
                  onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                   {showSupabaseKey ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="pt-2">
                <button 
                onClick={handleSaveKeys}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${
                    isKeyVerified 
                    ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                }`}
                >
                {isKeyVerified ? 'Saved Successfully' : 'Save Configuration'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;