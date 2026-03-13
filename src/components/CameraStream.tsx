'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: true,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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
    };
  }, []);

  return (
    <div className='relative w-full h-full'>
      {error ? (
        <div className='absolute inset-0 flex items-center justify-center bg-red-950/20 text-red-500 p-4 text-center'>
          {error}
        </div>
      ) : null}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className='w-full h-full object-cover'
        data-testid='video-stream'
      />
    </div>
  );
}