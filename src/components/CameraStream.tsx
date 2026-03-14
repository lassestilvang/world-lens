'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { FrameSampler } from '../utils/frameSampling';

export interface CameraStreamHandle {
  captureFrame: () => string | null;
}

interface CameraStreamProps {
  onFrameCapture?: (frameData: string) => void;
  fallbackMessage?: string;
}

const CameraStream = forwardRef<CameraStreamHandle, CameraStreamProps>(({ onFrameCapture, fallbackMessage }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const samplerRef = useRef<FrameSampler | null>(null);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (!videoRef.current) return null;

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return null;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
  }));

  useEffect(() => {
    // Initialize Sampler
    samplerRef.current = new FrameSampler({ motionThreshold: 5.0 });

    let stream: MediaStream | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera API not supported in this browser');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: true,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Setup Sampling Loop (Check every 500ms for MVP demo)
        intervalId = setInterval(() => {
          if (!samplerRef.current || !onFrameCapture) return;

          // Mocked VAD and Motion for demo logic integration
          // In real production, this would use web audio api for VAD and deviceorientation/sensors
          const mockIsSpeaking = false;
          const mockMotion = 0; 

          if (samplerRef.current.shouldCapture(mockIsSpeaking, mockMotion)) {
            const frame = (ref as React.RefObject<CameraStreamHandle>).current?.captureFrame();
            if (frame) onFrameCapture(frame);
          }
        }, 500);

      } catch (err) {
        console.error('Error accessing media devices.', err);
        setError('Unable to access camera/microphone');
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [onFrameCapture, ref]);

  return (
    <div className="relative w-full h-full bg-black">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/20 text-red-500 p-4 text-center z-10">
          {error}
        </div>
      ) : null}
      
      {fallbackMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20">
          <div className="text-center p-6 border border-zinc-700 bg-zinc-900/90 rounded-2xl max-w-sm">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Analysis Paused</h3>
            <p className="text-sm text-zinc-300">{fallbackMessage}</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${fallbackMessage ? 'opacity-30 blur-md grayscale' : ''}`}
        data-testid="video-stream"
      />
    </div>
  );
});

CameraStream.displayName = 'CameraStream';

export default CameraStream;
