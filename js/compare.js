export class FaceComparator {
    constructor() {
        this.threshold = 0.75;
    }

    cosineSimilarity(embedding1, embedding2) {
        let dotProduct = 0;
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
        }
        return dotProduct;
    }

    euclideanDistance(embedding1, embedding2) {
        let sum = 0;
        for (let i = 0; i < embedding1.length; i++) {
            const diff = embedding1[i] - embedding2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    compare(embedding1, embedding2) {
        const cosineSim = this.cosineSimilarity(embedding1, embedding2);
        const euclideanDist = this.euclideanDistance(embedding1, embedding2);
        
        // Score otimizado para características visuais
        const cosineScore = Math.max(0, Math.min(1, (cosineSim + 1) / 2));
        const euclideanScore = Math.max(0, 1 - (euclideanDist / 4));
        
        // Peso maior para cosine em características visuais
        const finalScore = (cosineScore * 0.85 + euclideanScore * 0.15);
        
        return {
            cosineSimilarity: cosineSim,
            euclideanDistance: euclideanDist,
            score: finalScore,
            percentage: Math.round(finalScore * 100),
            isMatch: finalScore >= this.threshold
        };
    }

    compareWithDatabase(queryEmbedding, databaseEmbeddings, minSimilarity = 0) {
        const results = [];
        
        for (const dbItem of databaseEmbeddings) {
            const comparison = this.compare(queryEmbedding, dbItem.embedding);
            
            if (comparison.percentage >= minSimilarity) {
                results.push({
                    file: dbItem.file,
                    ...comparison
                });
            }
        }
        
        // Ordenar por score decrescente
        results.sort((a, b) => b.score - a.score);
        
        return results;
    }

    setThreshold(threshold) {
        this.threshold = threshold / 100;
    }

    verifyMatch(embedding1, embedding2, strictMode = true) {
        const result = this.compare(embedding1, embedding2);
        
        if (strictMode) {
            // Verificação dupla para reduzir falso positivo
            return result.cosineSimilarity >= this.threshold && 
                   result.euclideanDistance < 1.0;
        }
        
        return result.isMatch;
    }
}
