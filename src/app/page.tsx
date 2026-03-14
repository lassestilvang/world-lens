'use client';

import { useState, useCallback, useRef } from 'react';
import CameraStream from '../components/CameraStream';
import ModeSelector, { AssistantMode } from '../components/ModeSelector';
import DocumentOverlay from '../components/DocumentOverlay';
import DebugPanel from '../components/DebugPanel';
import { analyzeFrame, analyzeDocument, analyzeEnvironment } from '../services/novaVision';
import { evaluateProactiveSuggestion } from '../services/orchestrator';
import { generateSpeechResponse } from '../services/novaSonic';
import { optimizeMemory, addObservationToMemory, buildMemoryContext } from '../utils/memoryContext';
import { playMedicationEarcon } from '../utils/audioService';
import { detectModeSwitch } from '../utils/modeSwitching';
import { suggestModeFromScene } from '../utils/modeDetection';
import { isImmediateHazard } from '../utils/safetyInterrupt';

export default function Page() {
  const [mode, setMode] = useState<AssistantMode>('grocery');
  const [goal, setGoal] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [memory, setMemory] = useState<string[]>([]);
  const [lastSuggestion, setLastResponse] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [modeSuggestion, setModeSuggestion] = useState<AssistantMode | null>(null);
  
  const handleSetGoal = () => {
    setGoal(inputValue);
    setInputValue('');
  };

  const processUserCommand = async (command: string) => {
    const targetMode = detectModeSwitch(command);
    if (targetMode && targetMode !== mode) {
      setMode(targetMode);
      setLastResponse(`Switching to ${targetMode} mode.`);
      playMedicationEarcon('success');
    }
  };

  const onFrameCapture = useCallback(async (frameData: string) => {
    try {
      setIsProcessing(true);
      
      let analysis;
      if (mode === 'document') {
        analysis = await analyzeDocument(frameData);
      } else if (mode === 'environment') {
        analysis = await analyzeEnvironment(frameData);
      } else {
        analysis = await analyzeFrame(frameData);
      }
      
      // 1. Check for Immediate Hazards (Safety First)
      const objects = (analysis as any).objects || (analysis as any).safetyObjects || [];
      if (isImmediateHazard(objects)) {
        setLastResponse(`Hazard Detected: ${objects.find((o: string) => o.includes('red') || o.includes('obstacle'))}`);
        playMedicationEarcon('warning');
        // Interrupt flow logic would trigger speech here
      }

      // 2. Suggest Mode Improvements
      const suggested = suggestModeFromScene({
        objects,
        environment: (analysis as any).environment || (analysis as any).sceneContext || ''
      }, mode);
      setModeSuggestion(suggested);

      // 3. Update Memory
      let updatedMemory = [...memory];
      objects.forEach((obj: string) => {
        if (!updatedMemory.includes(obj)) {
          updatedMemory = addObservationToMemory(updatedMemory, obj, 100);
        }
      });

      const optimization = optimizeMemory(updatedMemory);
      if (optimization.isSummarized) {
        updatedMemory = optimization.memory;
      }
      setMemory(updatedMemory);

      // 4. Proactive Advice
      if (goal || mode === 'environment') {
        const suggestionResult = await evaluateProactiveSuggestion({
          environment: (analysis as any).environment || (analysis as any).sceneContext || 'unknown',
          objects_seen: updatedMemory,
          user_goal: goal || 'stay safe'
        }, analysis as any);

        if (suggestionResult.shouldSuggest && suggestionResult.suggestionPrompt) {
          if (suggestionResult.suggestionPrompt !== lastSuggestion) {
            setLastResponse(suggestionResult.suggestionPrompt);
            playMedicationEarcon('success');
            await generateSpeechResponse(
              suggestionResult.suggestionPrompt, 
              buildMemoryContext(updatedMemory)
            );
          }
        }
      }
    } catch (err) {
      console.error('Error in orchestration loop:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [goal, memory, lastSuggestion, mode]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white relative overflow-hidden">
      <div className="w-full max-w-md flex flex-col gap-6 z-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">WorldLens</h1>
          <p className="text-sm text-zinc-400 mt-2 tracking-wide uppercase font-semibold">
            {mode} Mode
          </p>
        </header>

        <section 
          className="aspect-[3/4] bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-black/50"
          data-testid="camera-container"
        >
          <CameraStream onFrameCapture={onFrameCapture} />
          
          <DocumentOverlay active={mode === 'document'} status={isProcessing ? 'capturing' : 'searching'} />
          
          {lastSuggestion && (
            <div className={`absolute bottom-4 left-4 right-4 ${lastSuggestion.includes('Hazard') ? 'bg-red-600/95 border-red-400' : 'bg-blue-600/95 border-blue-400'} backdrop-blur p-4 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">
                {lastSuggestion.includes('Hazard') ? 'Safety Alert' : 'AI Insight'}
              </p>
              <p className="text-sm leading-snug font-medium">{lastSuggestion}</p>
            </div>
          )}

          {modeSuggestion && (
            <div className="absolute top-4 left-4 right-4 bg-zinc-900/90 backdrop-blur p-3 rounded-xl border border-zinc-700 flex items-center justify-between animate-in slide-in-from-top-4">
              <p className="text-xs text-zinc-300">Suggest switching to <b>{modeSuggestion}</b>?</p>
              <button 
                onClick={() => { setMode(modeSuggestion); setModeSuggestion(null); }}
                className="text-[10px] bg-white text-black px-2 py-1 rounded font-bold uppercase"
              >
                Switch
              </button>
            </div>
          )}
        </section>

        <ModeSelector currentMode={mode} onModeChange={setMode} />

        {mode !== 'environment' && (
          <div className="space-y-3">
            {goal && (
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold uppercase tracking-tight">
                Current Goal: {goal}
              </div>
            )}

            <div className="flex gap-2">
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={mode === 'medication' ? 'e.g., check dosage' : 'e.g., find healthy cereal'}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
              />
              <button 
                onClick={handleSetGoal}
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
              >
                Set
              </button>
            </div>
          </div>
        )}

        <DebugPanel visible={mode === 'environment'} grounded={true} />

        <footer className="flex flex-col items-center gap-2">
          <div 
            className="flex items-center gap-3 px-5 py-2.5 bg-zinc-900/50 rounded-full border border-zinc-800 backdrop-blur"
            data-testid="status-indicator"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {isProcessing ? 'Processing' : 'Live Loop'}
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
