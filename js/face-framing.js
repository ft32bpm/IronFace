// Sistema de Enquadramento Facial Inteligente
class FaceFraming {
    constructor(options = {}) {
        this.targetSize = options.targetSize || 800; // Tamanho padrão quadrado
        this.margin = options.margin || 0.8; // 80% de margem ao redor do rosto (mais distante)
        this.minMargin = options.minMargin || 0.5; // Margem mínima 50%
        this.quality = options.quality || 0.88;
        this.maxFileSize = options.maxFileSize || 150 * 1024; // 150KB
    }

    async frameAndCrop(file, detection) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = async () => {
                    try {
                        const result = await this.processImage(img, file.name, detection);
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

    async processImage(img, fileName, detection) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calcular área de crop baseada na detecção facial
        const cropArea = this.calculateCropArea(img.width, img.height, detection);
        
        // Definir tamanho do canvas (quadrado)
        canvas.width = this.targetSize;
        canvas.height = this.targetSize;
        
        // Desenhar imagem enquadrada e centralizada
        ctx.drawImage(
            img,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height,
            0, 0, this.targetSize, this.targetSize
        );
        
        // Comprimir até atingir tamanho alvo
        return await this.compressToTarget(canvas, fileName);
    }

    calculateCropArea(imgWidth, imgHeight, detection) {
        const box = detection.detection.box;
        
        // Calcular centro do rosto
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;
        
        // Calcular tamanho da área de crop com margem ampla
        // Multiplicador maior para incluir cabelo e peito
        let cropSize = Math.max(box.width, box.height) * (1 + this.margin * 2);
        
        // Ajustar posição Y para capturar mais da parte superior (cabelo)
        // e inferior (peito) - deslocar o centro um pouco para baixo
        const adjustedCenterY = faceCenterY + (box.height * 0.15); // 15% para baixo
        
        // Ajustar se ultrapassar limites da imagem
        const maxSize = Math.min(imgWidth, imgHeight);
        if (cropSize > maxSize) {
            cropSize = maxSize;
        }
        
        // Calcular posição do crop centralizado no rosto ajustado
        let cropX = faceCenterX - cropSize / 2;
        let cropY = adjustedCenterY - cropSize / 2;
        
        // Ajustar para não sair dos limites
        if (cropX < 0) cropX = 0;
        if (cropY < 0) cropY = 0;
        if (cropX + cropSize > imgWidth) cropX = imgWidth - cropSize;
        if (cropY + cropSize > imgHeight) cropY = imgHeight - cropSize;
        
        return {
            x: cropX,
            y: cropY,
            width: cropSize,
            height: cropSize
        };
    }

    async compressToTarget(canvas, fileName) {
        let quality = this.quality;
        let result;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            result = await this.canvasToFile(canvas, fileName, quality);
            
            if (result.size <= this.maxFileSize) {
                break;
            }
            
            quality -= 0.08;
            attempts++;
            
            if (quality < 0.4) {
                quality = 0.4;
                break;
            }
        }
        
        return result;
    }

    canvasToFile(canvas, fileName, quality) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const newFileName = fileName.replace(/\.[^.]+$/, '') + '_framed.jpg';
                const file = new File([blob], newFileName, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                
                resolve({
                    file: file,
                    size: blob.size,
                    quality: quality,
                    dimensions: { width: canvas.width, height: canvas.height }
                });
            }, 'image/jpeg', quality);
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

export { FaceFraming };
