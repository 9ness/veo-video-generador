'use client';

import { Download, Sparkles, Share2 } from 'lucide-react';
import { useState } from 'react';

interface VideoPlayerProps {
    videoUrl: string;
}

export default function VideoPlayer({ videoUrl }: VideoPlayerProps) {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'veo-generated-video.mp4';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Download failed", e);
        } finally {
            setDownloading(false);
        }
    };

    const shareVideo = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Veo Video',
                    text: 'Check out this video generated with Google Veo!',
                    url: videoUrl
                });
            } catch (err) {
                console.log("Share failed", err);
            }
        } else {
            navigator.clipboard.writeText(videoUrl);
            alert("¡Enlace copiado al portapapeles!");
        }
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-10">
            {/* Video Container with Glow Effect */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
                    <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="w-full h-full object-contain"
                        onContextMenu={(e) => e.preventDefault()}
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                >
                    <Download className={`w-5 h-5 ${downloading ? 'animate-bounce' : ''}`} />
                    {downloading ? 'Guardando...' : 'Descargar MP4'}
                </button>

                <button
                    onClick={shareVideo}
                    className="p-4 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-all active:scale-95 backdrop-blur-md border border-white/5"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            <div className="text-center">
                <p className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
                    Generado con Google Veo 3.1 Fast
                </p>
            </div>
        </div>
    );
}
