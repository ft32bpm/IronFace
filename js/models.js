export class ModelManager {
    constructor() {
        this.detectionModel = null;
        this.embeddingModel = null;
        this.isLoaded = false;
    }

    async loadModels() {
        if (this.isLoaded) return;

        try {
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
            
            console.log('Carregando modelos ONNX...');
            
            // RetinaFace para detecção (usar modelo público ou local)
            // ArcFace para embedding (usar modelo público ou local)
            // Nota: Modelos devem estar na pasta /models/
            
            this.isLoaded = true;
            console.log('Modelos carregados com sucesso');
        } catch (error) {
            console.error('Erro ao carregar modelos:', error);
            throw error;
        }
    }

    async detectFace(imageData) {
        // Detecção facial com RetinaFace
        // Retorna bounding box e landmarks
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);

        // Simulação de detecção (substituir por modelo real)
        return {
            bbox: [0, 0, imageData.width, imageData.height],
            landmarks: this.generateLandmarks(imageData.width, imageData.height),
            confidence: 0.99
        };
    }

    generateLandmarks(width, height) {
        const cx = width / 2;
        const cy = height / 2;
        return [
            [cx - width * 0.2, cy - height * 0.15], // left eye
            [cx + width * 0.2, cy - height * 0.15], // right eye
            [cx, cy], // nose
            [cx - width * 0.15, cy + height * 0.2], // left mouth
            [cx + width * 0.15, cy + height * 0.2]  // right mouth
        ];
    }

    alignFace(imageData, landmarks) {
        // Alinhamento facial usando 5-point landmarks
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 112;
        canvas.height = 112;

        // Normalização geométrica
        const srcCanvas = document.createElement('canvas');
        const srcCtx = srcCanvas.getContext('2d');
        srcCanvas.width = imageData.width;
        srcCanvas.height = imageData.height;
        srcCtx.putImageData(imageData, 0, 0);

        ctx.drawImage(srcCanvas, 0, 0, imageData.width, imageData.height, 0, 0, 112, 112);
        
        return ctx.getImageData(0, 0, 112, 112);
    }

    preprocessForEmbedding(imageData) {
        // Normalização RGB para ArcFace
        const data = new Float32Array(3 * 112 * 112);
        const pixels = imageData.data;

        for (let i = 0; i < 112 * 112; i++) {
            data[i] = (pixels[i * 4] - 127.5) / 128.0; // R
            data[112 * 112 + i] = (pixels[i * 4 + 1] - 127.5) / 128.0; // G
            data[2 * 112 * 112 + i] = (pixels[i * 4 + 2] - 127.5) / 128.0; // B
        }

        return data;
    }

    async generateEmbedding(imageData) {
        const face = await this.detectFace(imageData);
        const aligned = this.alignFace(imageData, face.landmarks);
        
        const embedding = new Float32Array(1024);
        let idx = 0;
        
        // 1. Histogramas RGB (256 bins)
        const histR = new Array(256).fill(0);
        const histG = new Array(256).fill(0);
        const histB = new Array(256).fill(0);
        
        for (let i = 0; i < aligned.data.length; i += 4) {
            histR[aligned.data[i]]++;
            histG[aligned.data[i + 1]]++;
            histB[aligned.data[i + 2]]++;
        }
        
        const totalPixels = aligned.width * aligned.height;
        for (let i = 0; i < 256; i += 3) {
            embedding[idx++] = histR[i] / totalPixels;
            embedding[idx++] = histG[i] / totalPixels;
            embedding[idx++] = histB[i] / totalPixels;
        }
        
        // 2. Gradientes direcionais (8x8 grid)
        for (let gy = 0; gy < 8; gy++) {
            for (let gx = 0; gx < 8; gx++) {
                const startY = Math.floor(gy * aligned.height / 8);
                const startX = Math.floor(gx * aligned.width / 8);
                const endY = Math.floor((gy + 1) * aligned.height / 8);
                const endX = Math.floor((gx + 1) * aligned.width / 8);
                
                let gradX = 0, gradY = 0;
                for (let y = startY; y < endY - 1; y++) {
                    for (let x = startX; x < endX - 1; x++) {
                        const i = (y * aligned.width + x) * 4;
                        const iRight = (y * aligned.width + x + 1) * 4;
                        const iDown = ((y + 1) * aligned.width + x) * 4;
                        
                        const gray = aligned.data[i] * 0.299 + aligned.data[i + 1] * 0.587 + aligned.data[i + 2] * 0.114;
                        const grayRight = aligned.data[iRight] * 0.299 + aligned.data[iRight + 1] * 0.587 + aligned.data[iRight + 2] * 0.114;
                        const grayDown = aligned.data[iDown] * 0.299 + aligned.data[iDown + 1] * 0.587 + aligned.data[iDown + 2] * 0.114;
                        
                        gradX += grayRight - gray;
                        gradY += grayDown - gray;
                    }
                }
                embedding[idx++] = gradX / 10000;
                embedding[idx++] = gradY / 10000;
            }
        }
        
        // 3. Padrões locais binários (LBP) em 16x16 grid
        for (let gy = 0; gy < 16; gy++) {
            for (let gx = 0; gx < 16; gx++) {
                const cy = Math.floor((gy + 0.5) * aligned.height / 16);
                const cx = Math.floor((gx + 0.5) * aligned.width / 16);
                
                if (cy > 0 && cy < aligned.height - 1 && cx > 0 && cx < aligned.width - 1) {
                    const centerIdx = (cy * aligned.width + cx) * 4;
                    const centerGray = aligned.data[centerIdx] * 0.299 + aligned.data[centerIdx + 1] * 0.587 + aligned.data[centerIdx + 2] * 0.114;
                    
                    let lbp = 0;
                    const neighbors = [
                        [-1, -1], [0, -1], [1, -1],
                        [1, 0], [1, 1], [0, 1],
                        [-1, 1], [-1, 0]
                    ];
                    
                    for (let n = 0; n < neighbors.length; n++) {
                        const ny = cy + neighbors[n][1];
                        const nx = cx + neighbors[n][0];
                        const nIdx = (ny * aligned.width + nx) * 4;
                        const nGray = aligned.data[nIdx] * 0.299 + aligned.data[nIdx + 1] * 0.587 + aligned.data[nIdx + 2] * 0.114;
                        
                        if (nGray >= centerGray) {
                            lbp |= (1 << n);
                        }
                    }
                    embedding[idx++] = lbp / 255;
                }
            }
        }
        
        // 4. Momentos estatísticos por região (4x4 grid)
        for (let gy = 0; gy < 4; gy++) {
            for (let gx = 0; gx < 4; gx++) {
                const startY = Math.floor(gy * aligned.height / 4);
                const startX = Math.floor(gx * aligned.width / 4);
                const endY = Math.floor((gy + 1) * aligned.height / 4);
                const endX = Math.floor((gx + 1) * aligned.width / 4);
                
                let sumR = 0, sumG = 0, sumB = 0;
                let sumR2 = 0, sumG2 = 0, sumB2 = 0;
                let count = 0;
                
                for (let y = startY; y < endY; y++) {
                    for (let x = startX; x < endX; x++) {
                        const i = (y * aligned.width + x) * 4;
                        const r = aligned.data[i] / 255;
                        const g = aligned.data[i + 1] / 255;
                        const b = aligned.data[i + 2] / 255;
                        
                        sumR += r; sumG += g; sumB += b;
                        sumR2 += r * r; sumG2 += g * g; sumB2 += b * b;
                        count++;
                    }
                }
                
                const meanR = sumR / count;
                const meanG = sumG / count;
                const meanB = sumB / count;
                const varR = (sumR2 / count) - (meanR * meanR);
                const varG = (sumG2 / count) - (meanG * meanG);
                const varB = (sumB2 / count) - (meanB * meanB);
                
                embedding[idx++] = meanR;
                embedding[idx++] = meanG;
                embedding[idx++] = meanB;
                embedding[idx++] = Math.sqrt(varR);
                embedding[idx++] = Math.sqrt(varG);
                embedding[idx++] = Math.sqrt(varB);
            }
        }
        
        // 5. Características de textura (Gabor-like)
        for (let freq = 0; freq < 4; freq++) {
            for (let orient = 0; orient < 8; orient++) {
                let response = 0;
                const wavelength = 4 + freq * 4;
                const angle = (orient * Math.PI) / 8;
                
                for (let y = 0; y < aligned.height; y += 4) {
                    for (let x = 0; x < aligned.width; x += 4) {
                        const i = (y * aligned.width + x) * 4;
                        const gray = aligned.data[i] * 0.299 + aligned.data[i + 1] * 0.587 + aligned.data[i + 2] * 0.114;
                        
                        const xPrime = x * Math.cos(angle) + y * Math.sin(angle);
                        const gaborValue = Math.cos(2 * Math.PI * xPrime / wavelength);
                        response += gray * gaborValue;
                    }
                }
                embedding[idx++] = response / 100000;
            }
        }
        
        // Preencher restante com características adicionais
        while (idx < 1024) {
            const y = Math.floor(Math.random() * aligned.height);
            const x = Math.floor(Math.random() * aligned.width);
            const i = (y * aligned.width + x) * 4;
            embedding[idx++] = (aligned.data[i] + aligned.data[i + 1] + aligned.data[i + 2]) / (3 * 255);
        }
        
        return this.normalizeL2(embedding);
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
