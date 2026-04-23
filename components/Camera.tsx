
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraProps {
  onCapture: (base64: string) => void;
  isLoading?: boolean;
}

export const Camera: React.FC<CameraProps> = ({ onCapture, isLoading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 480 }, 
          height: { ideal: 640 },
          aspectRatio: { ideal: 0.75 }
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      let msg = "Não foi possível acessar a câmera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Permissão da câmera negada. Por favor, habilite o acesso à câmera nas configurações do seu navegador.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "Nenhuma câmera encontrada no dispositivo.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = "A câmera está sendo usada por outro aplicativo.";
      }
      setError(msg);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
      {error ? (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center text-white bg-slate-800">
          <i className="fas fa-exclamation-triangle text-4xl mb-4 text-amber-500"></i>
          <p>{error}</p>
          <button 
            onClick={startCamera}
            className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover scale-x-[-1]" 
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20">
             <div className="w-full h-full border-2 border-dashed border-white/50 rounded-full opacity-30"></div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              onClick={capture}
              disabled={isLoading}
              className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
              }`}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="w-10 h-10 bg-white rounded-full opacity-50"></div>
              )}
            </button>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium text-indigo-900">Validando biometria...</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
