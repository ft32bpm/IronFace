export class FaceClusterer {
    constructor() {
        this.eps = 0.4;
        this.minPts = 2;
    }

    euclideanDistance(embedding1, embedding2) {
        let sum = 0;
        for (let i = 0; i < embedding1.length; i++) {
            const diff = embedding1[i] - embedding2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    dbscan(embeddings, eps = this.eps, minPts = this.minPts) {
        const n = embeddings.length;
        const labels = new Array(n).fill(-1);
        let clusterId = 0;

        for (let i = 0; i < n; i++) {
            if (labels[i] !== -1) continue;

            const neighbors = this.regionQuery(embeddings, i, eps);
            
            if (neighbors.length < minPts) {
                labels[i] = -1; // Noise
                continue;
            }

            labels[i] = clusterId;
            const seeds = [...neighbors];

            for (let j = 0; j < seeds.length; j++) {
                const q = seeds[j];
                
                if (labels[q] === -1) {
                    labels[q] = clusterId;
                }
                
                if (labels[q] !== -1) continue;
                
                labels[q] = clusterId;
                const qNeighbors = this.regionQuery(embeddings, q, eps);
                
                if (qNeighbors.length >= minPts) {
                    seeds.push(...qNeighbors);
                }
            }

            clusterId++;
        }

        return labels;
    }

    regionQuery(embeddings, pointIdx, eps) {
        const neighbors = [];
        
        for (let i = 0; i < embeddings.length; i++) {
            if (i === pointIdx) continue;
            
            const dist = this.euclideanDistance(
                embeddings[pointIdx].embedding,
                embeddings[i].embedding
            );
            
            if (dist <= eps) {
                neighbors.push(i);
            }
        }
        
        return neighbors;
    }

    clusterFrames(frameEmbeddings, threshold = 0.4) {
        this.eps = threshold;
        const labels = this.dbscan(frameEmbeddings);
        
        const clusters = new Map();
        
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (label === -1) continue; // Ignorar noise
            
            if (!clusters.has(label)) {
                clusters.set(label, []);
            }
            
            clusters.get(label).push(frameEmbeddings[i]);
        }
        
        return this.buildClusterResults(clusters);
    }

    buildClusterResults(clusters) {
        const results = [];
        
        for (const [clusterId, frames] of clusters.entries()) {
            // Selecionar frame representativo (centroide)
            const representative = this.findCentroid(frames);
            
            results.push({
                id: clusterId,
                size: frames.length,
                frames: frames,
                representative: representative,
                avgEmbedding: this.computeAvgEmbedding(frames)
            });
        }
        
        return results;
    }

    findCentroid(frames) {
        let minAvgDist = Infinity;
        let centroid = frames[0];
        
        for (const frame of frames) {
            let totalDist = 0;
            
            for (const other of frames) {
                totalDist += this.euclideanDistance(frame.embedding, other.embedding);
            }
            
            const avgDist = totalDist / frames.length;
            
            if (avgDist < minAvgDist) {
                minAvgDist = avgDist;
                centroid = frame;
            }
        }
        
        return centroid;
    }

    computeAvgEmbedding(frames) {
        const dim = frames[0].embedding.length;
        const avg = new Float32Array(dim);
        
        for (const frame of frames) {
            for (let i = 0; i < dim; i++) {
                avg[i] += frame.embedding[i];
            }
        }
        
        for (let i = 0; i < dim; i++) {
            avg[i] /= frames.length;
        }
        
        // Normalização L2
        let sum = 0;
        for (let i = 0; i < dim; i++) {
            sum += avg[i] * avg[i];
        }
        const norm = Math.sqrt(sum);
        
        for (let i = 0; i < dim; i++) {
            avg[i] /= norm;
        }
        
        return avg;
    }
}
