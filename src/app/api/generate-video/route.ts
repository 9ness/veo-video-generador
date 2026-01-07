import { NextResponse } from 'next/server';
import { generateVideo } from '@/lib/vertex-client';

export const maxDuration = 60; // Set max duration for Vercel functions (if pro) or standard

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, images, password, aspectRatio } = body;

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

        console.log(`Generating video: Prompt="${prompt}", Images=${images?.length || 0}, Ratio=${aspectRatio || 'default'}`);

        const prediction = await generateVideo(prompt, images, aspectRatio);

        return NextResponse.json({ prediction });

    } catch (error: any) {
        console.error('API Error:', error);

        // Detailed error logging for debugging quotas
        if (error.code === 8 || error.code === 'RESOURCE_EXHAUSTED') {
            console.error('RESOURCE_EXHAUSTED Details:', JSON.stringify(error, null, 2));
        }

        return NextResponse.json(
            {
                error: error.message || 'Internal Server Error',
                details: error.details || error.statusDetails || error.toString(),
                code: error.code // passing code to frontend for debugging
            },
            { status: 500 }
        );
    }
}
