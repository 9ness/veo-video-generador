'use client';

import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';

interface ImageUploaderProps {
    onImagesSelected: (images: string[]) => void;
    selectedImages: string[];
}

export default function ImageUploader({ onImagesSelected, selectedImages }: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const processFiles = (files: File[]) => {
        if (selectedImages.length + files.length > 3) {
            alert("Máximo 3 imágenes permitidas.");
            return;
        }

        const validFiles = files.filter(file => file.type.startsWith('image/'));

        Promise.all(validFiles.map(file => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
        })).then(newImages => {
            if (selectedImages.length + newImages.length > 3) {
                const availableSlots = 3 - selectedImages.length;
                onImagesSelected([...selectedImages, ...newImages.slice(0, availableSlots)]);
            } else {
                onImagesSelected([...selectedImages, ...newImages]);
            }
        });
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...selectedImages];
        newImages.splice(index, 1);
        onImagesSelected(newImages);
    };

    const triggerUpload = () => document.getElementById('fileInput')?.click();

    return (
        <div className="w-full space-y-4">
            {/* Hidden Input */}
            <input
                type="file"
                id="fileInput"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Main Container */}
            {selectedImages.length === 0 ? (
                // Empty State: Minimalist & Clean
                <div
                    className={`group relative w-full h-40 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm 
            transition-all duration-300 ease-out flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden
            ${isDragging ? 'border-violet-500/50 bg-violet-500/10' : 'hover:border-white/20 hover:bg-white/10'}`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={triggerUpload}
                >
                    {/* Subtle animated background gradient on hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="p-3 bg-white/5 rounded-full border border-white/10 group-hover:scale-110 transition-transform duration-300">
                        <ImageIcon className="w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                        Toca para subir imágenes
                    </p>
                </div>
            ) : (
                // Populated Grid State
                <div className="grid grid-cols-3 gap-3">
                    {selectedImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg group">
                            <img src={img} alt="Vista previa" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                                onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* Add Button (if slots available) */}
                    {selectedImages.length < 3 && (
                        <button
                            onClick={triggerUpload}
                            className="aspect-square rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1 hover:bg-white/10 hover:border-white/40 transition-all group"
                        >
                            <Plus className="w-6 h-6 text-neutral-400 group-hover:text-violet-400" />
                            <span className="text-[10px] uppercase font-bold text-neutral-500 group-hover:text-violet-300">Añadir</span>
                        </button>
                    )}
                </div>
            )}

            {/* Caption for constraints */}
            <div className="flex justify-between px-1">
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
                    Imágenes de Referencia {selectedImages.length > 0 && `(${selectedImages.length}/3 máx)`}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
                    5 seg • Video Mudo
                </p>
            </div>
        </div>
    );
}
