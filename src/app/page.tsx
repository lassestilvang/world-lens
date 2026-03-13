'use client';

import { useState } from 'react';
import CameraStream from '../components/CameraStream';

export default function Page() {
  const [goal, setGoal] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');

  const handleSetGoal = () => {
    setGoal(inputValue);
    setInputValue('');
  };

  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white'>
      <div className='w-full max-w-md flex flex-col gap-6'>
        <header className='text-center'>
          <h1 className='text-3xl font-bold tracking-tight'>WorldLens</h1>
          <p className='text-sm text-zinc-400 mt-2'>AI that understands the world around you</p>
        </header>

        <section 
          className='aspect-[3/4] bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center relative overflow-hidden'
          data-testid='camera-container'
        >
          <CameraStream />
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
            <div className='w-2 h-2 rounded-full bg-zinc-500 animate-pulse' />
            <span className='text-sm text-zinc-300'>Ready</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
