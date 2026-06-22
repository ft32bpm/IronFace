export class ModelManager {
    constructor() {
        this.isLoaded = false;
        this.faceapi = null;
    }

    async loadModels() {
        if (this.isLoaded) return;

        try {
            // Carregar face-api.js dinamicamente
            await this.loadFaceAPI();
            
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
            
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            
            this.isLoaded = true;
            console.log('Modelos carregados com sucesso');
        } catch (error) {
            console.error('Erro ao carregar modelos:', error);
            throw error;
        }
    }

    async loadFaceAPI() {
        if (window.faceapi) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async generateEmbedding(imageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);

        const detection = await faceapi
            .detectSingleFace(canvas)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            throw new Error('Nenhum rosto detectado na imagem');
        }

        return new Float32Array(detection.descriptor);
    }

    normalizeL2(vector) {
        let sum = 0;
        for (let i = 0; i < vector.length; i++) {
            sum += vector[i] * vector[i];
        }
        const norm = Math.sqrt(sum);
        const normalized = new Float32Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
            normalized[i] = vector[i] / norm;
        }
        return normalized;
    }
}
