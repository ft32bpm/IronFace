import { ModelManager } from './models.js';

export class EmbeddingGenerator {
    constructor() {
        this.modelManager = new ModelManager();
        this.cache = new Map();
    }

    async initialize() {
        await this.modelManager.loadModels();
    }

    async getImageData(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    resolve(ctx.getImageData(0, 0, img.width, img.height));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async generateFromFile(file) {
        const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const imageData = await this.getImageData(file);
        let embedding = await this.modelManager.generateEmbedding(imageData);
        
        // Normalizar para garantir consistência
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
            embedding = embedding.map(val => val / norm);
        }
        
        this.cache.set(cacheKey, embedding);
        return embedding;
    }

    async generateFromImageData(imageData) {
        return await this.modelManager.generateEmbedding(imageData);
    }

    async batchGenerate(files, progressCallback) {
        const embeddings = [];
        
        for (let i = 0; i < files.length; i++) {
            const embedding = await this.generateFromFile(files[i]);
            embeddings.push({
                file: files[i],
                embedding: embedding
            });
            
            if (progressCallback) {
                progressCallback((i + 1) / files.length);
            }
        }
        
        return embeddings;
    }

    clearCache() {
        this.cache.clear();
    }
}
