'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { FrameSampler } from '../utils/frameSampling';

export interface CameraStreamHandle {
  captureFrame: () => string | null;
}

interface CameraStreamProps {
  onFrameCapture?: (frameData: string) => void;
}

const CameraStream = forwardRef<CameraStreamHandle, CameraStreamProps>(({ onFrameCapture }, ref) => {
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
            const frame = (ref as any).current?.captureFrame();
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
    <div className="relative w-full h-full">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/20 text-red-500 p-4 text-center">
          {error}
        </div>
      ) : null}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        data-testid="video-stream"
      />
    </div>
  );
});

CameraStream.displayName = 'CameraStream';

export default CameraStream;
