import { FaceFraming } from './face-framing.js';

// Otimizador de Imagens
class ImageOptimizer {
    constructor(options = {}) {
        this.maxWidth = options.maxWidth || 1920;
        this.maxHeight = options.maxHeight || 1080;
        this.quality = options.quality || 0.85;
        this.maxFileSize = options.maxFileSize || 150 * 1024; // 150KB em bytes
        this.format = 'image/jpeg';
        this.enableFaceFraming = options.enableFaceFraming !== false; // Ativado por padrão
        this.faceFraming = new FaceFraming({
            targetSize: options.frameSize || 800,
            margin: options.frameMargin || 0.3,
            quality: this.quality,
            maxFileSize: this.maxFileSize
        });
    }

    async optimize(file, detection = null) {
        // Se tiver detecção facial e enquadramento ativado, usar face framing
        if (detection && this.enableFaceFraming) {
            try {
                const result = await this.faceFraming.frameAndCrop(file, detection);
                return {
                    file: result.file,
                    optimizedSize: result.size,
                    dimensions: result.dimensions,
                    quality: result.quality,
                    framed: true
                };
            } catch (error) {
                console.warn('Falha no enquadramento facial, usando otimização padrão:', error);
            }
        }
        
        // Otimização padrão (sem enquadramento)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = async () => {
                    try {
                        // Primeira tentativa com configurações padrão
                        let result = await this.compressImage(img, file.name, this.quality);
                        
                        // Se ainda estiver maior que 150KB, comprimir mais
                        if (result.optimizedSize > this.maxFileSize) {
                            result = await this.compressToTarget(img, file.name);
                        }
                        
                        result.framed = false;
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => reject(new Error('Falha ao carregar imagem'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
            reader.readAsDataURL(file);
        });
    }

    async compressImage(img, fileName, quality) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calcular novas dimensões mantendo proporção
            let { width, height } = this.calculateDimensions(img.width, img.height);
            
            canvas.width = width;
            canvas.height = height;
            
            // Desenhar imagem otimizada
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converter para Blob
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Falha ao comprimir imagem'));
                    return;
                }
                
                // Ajustar nome do arquivo
                const originalName = fileName.replace(/\.[^.]+$/, '');
                const newFileName = originalName + '.jpg';
                
                // Criar novo File
                const optimizedFile = new File([blob], newFileName, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                
                resolve({
                    file: optimizedFile,
                    optimizedSize: blob.size,
                    dimensions: { width, height },
                    quality: quality
                });
            }, 'image/jpeg', quality);
        });
    }

    async compressToTarget(img, fileName) {
        let quality = 0.85;
        let result;
        let attempts = 0;
        const maxAttempts = 10;
        
        // Tentar diferentes qualidades até atingir o tamanho alvo
        while (attempts < maxAttempts) {
            result = await this.compressImage(img, fileName, quality);
            
            if (result.optimizedSize <= this.maxFileSize) {
                break;
            }
            
            // Reduzir qualidade progressivamente
            quality -= 0.1;
            attempts++;
            
            // Não deixar qualidade cair abaixo de 0.3 (30%)
            if (quality < 0.3) {
                quality = 0.3;
                break;
            }
        }
        
        return result;
    }

    calculateDimensions(width, height) {
        if (width <= this.maxWidth && height <= this.maxHeight) {
            return { width, height };
        }
        
        const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
        
        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

export { ImageOptimizer };
