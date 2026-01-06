import { NextResponse } from 'next/server';
import { generateVideo } from '@/lib/vertex-client';

export const maxDuration = 60; // Set max duration for Vercel functions (if pro) or standard

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, images, password } = body;

        // Password Validation
        const correctPassword = process.env.APP_PASSWORD;
        if (correctPassword && password !== correctPassword) {
            return NextResponse.json(
                { error: 'Contraseña no autorizada' },
                { status: 401 }
            );
        }

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        console.log(`Generating video: Prompt="${prompt}", Images=${images?.length || 0}`);

        const prediction = await generateVideo(prompt, images);

        return NextResponse.json({ prediction });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
