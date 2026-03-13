'use client';

import { useState, useCallback, useRef } from 'react';
import CameraStream from '../components/CameraStream';
import { analyzeFrame } from '../services/novaVision';
import { evaluateProactiveSuggestion } from '../services/orchestrator';
import { optimizeMemory, addObservationToMemory } from '../utils/memoryContext';

export default function Page() {
  const [goal, setGoal] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [memory, setMemory] = useState<string[]>([]);
  const [lastSuggestion, setLastResponse] = useState<string>('');
  
  const handleSetGoal = () => {
    setGoal(inputValue);
    setInputValue('');
  };

  const onFrameCapture = useCallback(async (frameData: string) => {
    try {
      // 1. Analyze Frame
      const analysis = await analyzeFrame(frameData);
      
      // 2. Update Memory
      let updatedMemory = [...memory];
      analysis.objects.forEach(obj => {
        if (!updatedMemory.includes(obj)) {
          updatedMemory = addObservationToMemory(updatedMemory, obj, 100);
        }
      });

      // 3. Optimize Memory
      const optimization = optimizeMemory(updatedMemory);
      if (optimization.isSummarized) {
        console.log('Memory summarized:', optimization.summary);
        updatedMemory = optimization.memory;
      }
      setMemory(updatedMemory);

      // 4. Evaluate Proactive Suggestion
      if (goal) {
        const suggestionResult = await evaluateProactiveSuggestion({
          environment: analysis.environment,
          objects_seen: updatedMemory,
          user_goal: goal
        }, analysis);

        if (suggestionResult.shouldSuggest && suggestionResult.suggestionPrompt) {
          setLastResponse(suggestionResult.suggestionPrompt);
          // Audio and Voice trigger will be added in the next task
        }
      }
    } catch (err) {
      console.error('Error in orchestration loop:', err);
    }
  }, [goal, memory]);

  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white relative overflow-hidden'>
      <div className='w-full max-w-md flex flex-col gap-6 z-10'>
        <header className='text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>WorldLens</h1>
          <p className='text-sm text-zinc-400 mt-2'>AI that understands the world around you</p>
        </header>

        <section 
          className='aspect-[3/4] bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center relative overflow-hidden'
          data-testid='camera-container'
        >
          <CameraStream onFrameCapture={onFrameCapture} />
          
          {lastSuggestion && (
            <div className='absolute bottom-4 left-4 right-4 bg-blue-600/90 backdrop-blur p-3 rounded-xl border border-blue-400 shadow-xl animate-in fade-in slide-in-from-bottom-2'>
              <p className='text-xs font-bold uppercase tracking-wider mb-1 opacity-80'>Proactive Tip</p>
              <p className='text-sm leading-tight'>{lastSuggestion}</p>
            </div>
          )}
        </section>

        {goal && (
          <div className='px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-medium'>
            Goal: {goal}
          </div>
        )}

        <div className='flex gap-2'>
          <input 
            type='text'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder='e.g., find healthy cereal'
            className='flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors'
          />
          <button 
            onClick={handleSetGoal}
            className='bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition-colors'
          >
            Set Goal
          </button>
        </div>

        <footer className='flex flex-col items-center gap-2'>
          <div 
            className='flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800'
            data-testid='status-indicator'
          >
            <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
            <span className='text-sm text-zinc-300'>Active Loop</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
