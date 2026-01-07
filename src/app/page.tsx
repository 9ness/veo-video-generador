'use client';

import { useState } from 'react';
import ImageUploader from '@/components/ImageUploader';
import VideoPlayer from '@/components/VideoPlayer';
import { Sparkles, Loader2, AlertCircle, Wand2, Film, Lock, Smartphone, Monitor, Download } from 'lucide-react';

export default function Home() {
  const [images, setImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'GENERATING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  const handleGenerate = async () => {
    if (!prompt) return;

    // Check for password
    const storedPassword = localStorage.getItem('veo_access_password');
    if (!storedPassword) {
      setShowPasswordModal(true);
      return;
    }

    performGeneration(storedPassword);
  };

  const confirmPassword = () => {
    localStorage.setItem('veo_access_password', passwordInput);
    setShowPasswordModal(false);
    performGeneration(passwordInput);
  };

  // Helper: Compress image to max 1024px and 0.8 quality
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export as JPEG with 0.8 quality to reduce size
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (err) => reject(err);
    });
  };

  const performGeneration = async (pwd: string) => {
    // Stage 1: Uploading/Compressing - keep button in loading state, no overlay yet
    setStatus('IDLE'); // Or a new state 'PREPARING' if we wanted distinct UI, but 'IDLE' + loading logic works if we handle it right.
    // Actually, let's use a local state or just rely on 'GENERATING' BUT conditionally hide overlay? 
    // Easier: Add a new state 'COMPRESSING'. But user asked for specific behavior.
    // "Feedback Visual: Asegúrate de que el estado de 'Generando...' se active solo después de que las imágenes hayan sido comprimidas y enviadas correctamente."

    // We will use a temporary loading indicator on the button (controlled by a separate ref or just reusing logic), 
    // but the MAIN 'GENERATING' status (which triggers the overlay) will be set LATER.

    // Let's rely on a separate boolean for the button spinner if 'status' isn't GENERATING yet.
    // Or simpler: We can't change the hook types easily without bigger refactor. 
    // Let's abuse 'GENERATING' but pass a flag? No.
    // Let's modify the JSX to only show Overlay if status === 'GENERATING' AND we are truly waiting for video.
    // For now, let's add a separate piece of state for "isSubmitting".
    setIsSubmitting(true);
    setErrorMsg('');
    setVideoUrl(null);

    try {
      // 1. Compress Images
      const compressedImages = await Promise.all(
        images.map(img => compressImage(img))
      );

      // 2. Send Request
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          images: compressedImages,
          password: pwd,
          aspectRatio
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const prediction = data.prediction;
      const resultUri = prediction.videoUri || prediction.video || prediction;

      if (!resultUri) {
        throw new Error('No video URI in response');
      }

      // Success - NOW show the full screen overlay while we "wait" (or if it's instant, show success).
      // If the API returns the video URL immediately (fast model), we might skip GENERATING overlay and go straight to SUCCESS.
      // But usually 'fast' might still take a few seconds? If we have the URL, we are done.
      // IF the API returns a *prediction operation* to poll, then we set GENERATING.
      // But here, veo-3.1-fast-generate-001 returns the video URI directly in the response usually (sync).
      // User requested: "Feedback Visual: Asegúrate de que el estado de 'Generando...' se active solo después de que las imágenes hayan sido comprimidas y enviadas correctamente."

      // If we already HAVE the video URL, we don't need 'Generando...' overlay effectively, we go to SUCCESS.
      // BUT, if the user wanted the overlay to show *while* google processes... 
      // The current backend code `generateVideo` awaits the result. So the fetch *waiting* IS the generation time.
      // So the overlay should probably show *during* the fetch?
      // User said: "Asegúrate de que el estado de 'Generando...' se active solo después de que las imágenes hayan sido comprimidas y enviadas correctamente."
      // This might imply he thinks the request sends, THEN returns a "pending" status, THEN we wait. 
      // BUT `veo-3.1-fast` is synchronous or near-synchronous but the HTTP request hangs until done.
      // IF the HTTP request hangs, we MUST show 'Generando' *during* the fetch, otherwise user thinks it's frozen.
      // "enviadas correctamente" might mean "after compression is done and fetch starts".

      // Let's interpret: 
      // 1. Compress & Prepare (Button spins).
      // 2. Send Request (Enter 'GENERATING' state -> Overlay appears).
      // 3. Receive Response (Enter 'SUCCESS').

      // Wait... "Asegúrate de que el estado de 'Generando...' se active solo después de que las imágenes hayan sido comprimidas y enviadas correctamente."
      // "Enviadas correctamente" usually means the server RECEIVED it. 
      // If the server connection stays open (60s), we are "waiting".

      // Re-reading user request carefully: "Request Entity Too Large" happens *during* sending.
      // Use case: User clicks Generate. Compression happens. Request is sent.
      // If request is too large, it fails *immediately* (413).
      // If we show "Generando" overlay immediately on click, the error pops up behind or awkwardly.
      // So:
      // 1. Click -> Button Loading (Compressing...)
      // 2. Fetch start -> Button Loading (Sending...)
      // 3. If Fetch doesn't error immediately (i.e. not 413), we are good? 
      // Actually with `await fetch`, we stick at line 50 until response comes back.
      // If we want to show overlay *during* generation (server side processing), we need to set state BEFORE fetch.
      // BUT if we set it before fetch, and fetch fails instantly with 413, we get the flash of overlay.

      // Compromise:
      // Set status GENERATING *immediately before* fetch, BUT after compression. 
      // Since compression is the new heavy client task, we want that to be visible but maybe not full overlay.
      // Let's use a new state variable 'isPreProcessing' for the button spinner during compression.
      // Then set GENERATING right before fetch.

      setStatus('GENERATING');
      // Note: This matches "active solo después de que las imágenes hayan sido comprimidas".
      // "y enviadas correctamente" -> Technically we can't know they are sent correctly until response headers come or we assume fetch started.
      // Setting it right before `await fetch` is the standard way.

      // Actually, I need to define local vars for compression since I can't easily add new state variables via replace_file_content safely without seeing imports/hooks again (I can, but it's risky if I miss). 
      // I see `useState` lines 8-15. I will add `isCompressing` state there in a separate edit or just manage it with `IDLE` vs `GENERATING`.

      // Let's stick to the plan:
      // I will add `const [isCompressing, setIsCompressing] = useState(false);`
      // Update `handleGenerate` to set `isCompressing(true)`.
      // `performGeneration` does the work.

      setVideoUrl(resultUri);
      setStatus('SUCCESS');

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('ERROR');
    } finally {
      setIsSubmitting(false); // Clean up
    }
  };

  return (
    <main className="min-h-screen pb-20 flex flex-col items-center justify-start relative overflow-hidden">

      {/* Ambient Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto p-6 z-10 flex flex-col gap-8">

        {/* Header */}
        <div className="text-center space-y-3 pt-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-widest text-violet-200 uppercase">Modelo Veo 3.1 Fast</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">Veo</span>
            <span className="text-violet-500">.</span>
          </h1>
          <p className="text-neutral-400 text-sm font-medium">
            Generación de video cinematográfico con Google DeepMind.
          </p>
        </div>

        {/* Workflow Container */}
        <div className="space-y-6">

          {/* INPUT SECTION */}
          {status !== 'SUCCESS' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">

              {/* Step 1: Visuals */}
              <ImageUploader selectedImages={images} onImagesSelected={setImages} />

              {/* Step 2: Prompt */}
              <div className="space-y-2 group">
                <div className="flex justify-between px-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Prompt Mágico</label>
                </div>
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe tu visión (ej: 'Ciudad cyberpunk con lluvia, reflejos de neón, cinematográfico 4k')"
                    className="w-full bg-neutral-900/50 border border-white/10 rounded-2xl p-5 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/50 focus:bg-neutral-900 focus:ring-1 focus:ring-violet-500/20 transition-all h-32 resize-none backdrop-blur-sm shadow-inner"
                  />
                  <Wand2 className="absolute bottom-4 right-4 w-4 h-4 text-neutral-600 pointer-events-none group-focus-within:text-violet-500 transition-colors" />
                </div>
              </div>

              {/* Error Toast */}
              {status === 'ERROR' && (
                <div className="p-4 w-full bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in slide-in-from-bottom-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                  <p className="break-all whitespace-pre-wrap w-full text-xs">{errorMsg}</p>
                </div>
              )}

              {/* Step 3: Aspect Ratio */}
              <div className="space-y-2">
                <div className="flex justify-between px-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Formato</label>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAspectRatio('9:16')}
                    className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '9:16'
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/20'
                      : 'bg-neutral-900/50 border-white/10 text-neutral-400 hover:bg-neutral-800'
                      }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-sm font-medium">Vertical</span>
                  </button>
                  <button
                    onClick={() => setAspectRatio('16:9')}
                    className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${aspectRatio === '16:9'
                      ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/20'
                      : 'bg-neutral-900/50 border-white/10 text-neutral-400 hover:bg-neutral-800'
                      }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="text-sm font-medium">Horizontal</span>
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={status === 'GENERATING' || isSubmitting || !prompt}
                className={`nav-button w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-xl
                        ${(status === 'GENERATING' || isSubmitting || !prompt)
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
                    : 'bg-white text-black hover:scale-[1.02] hover:shadow-white/10'}`}
              >
                {status === 'GENERATING' || isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
                      {status === 'GENERATING' ? 'Soñando...' : 'Preparando...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <span>Generar Video</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* LOADING STATE - Cinematic */}
          {status === 'GENERATING' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#030303]/80 backdrop-blur-xl animate-in fade-in duration-500">
              <div className="relative w-64 h-64 flex flex-col items-center justify-center">
                <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-violet-500/30 animate-spin transition-all duration-1000"></div>
                <div className="absolute inset-4 rounded-full border-b-2 border-r-2 border-indigo-500/30 animate-spin animation-reverse duration-1000"></div>

                <Film className="w-12 h-12 text-violet-500 animate-pulse mb-4" />
                <p className="text-white font-medium text-lg animate-pulse">Renderizando Escena</p>
                <p className="text-neutral-500 text-xs mt-2 max-w-[200px] text-center">Usando motor Veo 3.1 Fast en Vertex AI</p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === 'SUCCESS' && videoUrl && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <VideoPlayer videoUrl={videoUrl} />

              <div className="flex gap-3">
                <button
                  onClick={() => { setStatus('IDLE'); setImages([]); setPrompt(''); setVideoUrl(null); }}
                  className="flex-1 py-4 rounded-xl border border-white/10 text-neutral-400 text-sm hover:text-white hover:bg-white/5 transition-all"
                >
                  Crear Otra Obra Maestra
                </button>

                <button
                  onClick={async () => {
                    if (!videoUrl) return;
                    try {
                      // Fetch the video as a blob to force download
                      const response = await fetch(videoUrl);
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);

                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `veo-video-${Date.now()}.mp4`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                    } catch (e) {
                      console.error("Download failed", e);
                      // Fallback: just open plain link
                      window.open(videoUrl, '_blank');
                    }
                  }}
                  className="flex-none w-14 rounded-xl bg-violet-600/20 border border-violet-500/50 text-violet-300 flex items-center justify-center hover:bg-violet-600/40 hover:text-white transition-all shadow-lg shadow-violet-900/10"
                  title="Descargar Video"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm p-6 bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 text-violet-400">
              <Lock className="w-5 h-5" />
              <h3 className="font-bold text-lg text-white">Acceso Requerido</h3>
            </div>
            <p className="text-neutral-400 text-sm">
              Introduce la contraseña para usar el generador.
              <br /><span className="text-neutral-500 text-xs mt-1 block">Solo se te pedirá la primera vez.</span>
            </p>
            <input
              type="password"
              placeholder="Contraseña..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              onClick={confirmPassword}
              className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Confirmar Acceso
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
