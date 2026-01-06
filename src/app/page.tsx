'use client';

import { useState } from 'react';
import ImageUploader from '@/components/ImageUploader';
import VideoPlayer from '@/components/VideoPlayer';
import { Sparkles, Loader2, AlertCircle, Wand2, Film } from 'lucide-react';

export default function Home() {
  const [images, setImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'GENERATING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    if (!prompt) return;

    setStatus('GENERATING');
    setErrorMsg('');
    setVideoUrl(null);

    // Simulate initial delay for "Encoding" feel or minimal waiting
    // await new Promise(r => setTimeout(r, 1000));

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          images: images
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

      setVideoUrl(resultUri); // Directly set the URL. Frontend VideoPlayer handles formatting/display.
      // Note: If GCS URI (gs://), you might need a signed URL proxy. 
      // Assuming for MVP the backend returns accessible http URL or the user has access.
      // If direct GCS access isn't possible from browser without auth, middleware is needed.
      // Assuming public/signed URL for now as per plan.

      setStatus('SUCCESS');

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('ERROR');
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

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={status === 'GENERATING' || !prompt}
                className={`nav-button w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-xl
                        ${status === 'GENERATING' || !prompt
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
                    : 'bg-white text-black hover:scale-[1.02] hover:shadow-white/10'}`}
              >
                {status === 'GENERATING' ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">Soñando...</span>
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

              <button
                onClick={() => { setStatus('IDLE'); setImages([]); setPrompt(''); setVideoUrl(null); }}
                className="w-full py-4 rounded-xl border border-white/10 text-neutral-400 text-sm hover:text-white hover:bg-white/5 transition-all"
              >
                Crear Otra Obra Maestra
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
