import { HistoryItem, TaskStatus } from "../types";

const HISTORY_KEY = "kie_app_history";

// In a full implementation with Vercel/Supabase SQL, 
// these functions would perform fetch/post requests to the backend.

export const getHistory = (): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to parse history", e);
    return [];
  }
};

export const saveHistoryItem = (item: HistoryItem) => {
  const history = getHistory();
  // Add to beginning
  const newHistory = [item, ...history];
  // Limit to last 50 items to keep storage clean
  if (newHistory.length > 50) newHistory.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
};

export const updateHistoryItem = (taskId: string, updates: Partial<HistoryItem>) => {
  const history = getHistory();
  const index = history.findIndex(h => h.taskId === taskId);
  
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
};

export const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
};