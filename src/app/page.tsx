import CameraStream from '../components/CameraStream';

export default function Page() {
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