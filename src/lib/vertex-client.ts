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
const location = 'us-central1'; // STRICTLY ENFORCED: Quota is allocated here. Do not change.
const publisher = 'google';
const model = 'veo-3.1-fast-generate-001'; // Correct ID per Vertex AI docs

export async function generateVideo(prompt: string, images: string[] = [], aspectRatio: string = '9:16') {
    // Double check location is us-central1
    if (location !== 'us-central1') {
        console.warn(`WARNING: Location is set to ${location}, but 'us-central1' is required for Veo 3.1 quota.`);
    }

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

        promptInstance.image_input_config = {
            images: cleanedImages.map(bytes => ({ imageBytes: bytes }))
        };
    }

    const instanceValue = helpers.toValue(promptInstance);

    const parameters = helpers.toValue({
        sampleCount: 1,
        durationSeconds: 5,
        fps: 24,
        aspect_ratio: aspectRatio, // MAPPED: Request expects snake_case 'aspect_ratio'
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
