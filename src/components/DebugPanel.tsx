'use client';

interface DebugPanelProps {
  visible: boolean;
  grounded?: boolean;
}

export default function DebugPanel({ visible, grounded = false }: DebugPanelProps) {
  if (!visible) return null;

  return (
    <div 
      className="absolute bottom-4 right-4 z-50 bg-black/80 border border-zinc-800 rounded-lg p-4 w-64 backdrop-blur-sm shadow-2xl"
      data-testid="debug-panel"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">System State</h3>
        {grounded ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30">
            Grounded
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Not Grounded
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-zinc-500">OCR Confidence:</span>
          <span className="text-[10px] font-mono text-zinc-300">98%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-zinc-500">Latency (p95):</span>
          <span className="text-[10px] font-mono text-zinc-300">1.2s</span>
        </div>
      </div>
    </div>
  );
}
