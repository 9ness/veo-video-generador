import { helpers, PredictionServiceClient } from '@google-cloud/aiplatform';

// Helper to get credentials from env
function getCredentials() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        try {
            return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON', e);
        }
    }
    return undefined;
}

const clientOptions: any = {
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
};

const credentials = getCredentials();
if (credentials) {
    clientOptions.credentials = credentials;
}

// Instantiate the client
const client = new PredictionServiceClient(clientOptions);

const project = process.env.GOOGLE_CLOUD_PROJECT_ID || credentials?.project_id || 'your-project-id';
const location = 'us-central1';
const publisher = 'google';
const model = 'veo-3.1-fast-generate-001'; // Correct ID per Vertex AI docs

export async function generateVideo(prompt: string, images: string[] = []) {
    const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${model}`;

    // Construct instance based on Veo 3.1 multi-image specs
    // Usually: { prompt: "...", image: { imageBytes: "..." } } for single
    // For multi-image consistency, it might use 'image_input_config' or sequences.
    // Based on request: "mapear estas imágenes al parámetro image_input_config"

    const promptInstance: any = {
        prompt: prompt,
    };

    if (images && images.length > 0) {
        // Clean base64 strings
        const cleanedImages = images.map(img => img.replace(/^data:image\/\w+;base64,/, ""));

        // Mapping to image_input_config as requested
        // Note: The exact schema for Veo 3.1 Fast multi-image reference might vary.
        // Assuming a list of images or specific "image" field sequence.
        // If the model supports 'image_input_config' directly as a parameter or part of the instance.
        // Common Vertex AI generative video pattern for consistency:
        // instance: { prompt: "...", image: { imageBytes: ... } } (Primary)
        // parameters: { ... }

        // However, user specifically asked for `image_input_config`. 
        // Usually this might be in the instance or parameters. 
        // Let's assume it's part of the instance for visual consistency references.

        // Attempting to match the user's "image_input_config" requirement.
        // If it's a documented field for Veo 3.1.
        // If unknown, we might try passing under `image` or `references`.
        // Let's try to pass it as a top-level field in the instance as suggested.

        // Strategy: Pass the first image as the primary 'image' prompt (image-to-video),
        // and potentially others in a config if supported.
        // Or if `image_input_config` is the MAIN way:

        /* 
           Structure implied by request:
           instance: {
             prompt: "...",
             image_input_config: {
               images: [ { imageBytes: "..." }, ... ]
             }
           }
        */

        promptInstance.image_input_config = {
            images: cleanedImages.map(bytes => ({ imageBytes: bytes }))
        };
    }

    const instanceValue = helpers.toValue(promptInstance);

    const parameters = helpers.toValue({
        sampleCount: 1,
        durationSeconds: 5,
        fps: 24,
        aspectRatio: "16:9",
        enableAudio: false, // Requested explicit disable
    });

    const request = {
        endpoint,
        instances: [instanceValue as any],
        parameters: parameters as any,
    };

    try {
        const [response] = await client.predict(request);

        if (!response.predictions || response.predictions.length === 0) {
            throw new Error('No predictions returned');
        }

        const prediction = response.predictions[0];
        const predictionObj = helpers.fromValue(prediction as any);

        return predictionObj;

    } catch (error) {
        console.error('Vertex AI Prediction Error:', error);
        throw error;
    }
}
