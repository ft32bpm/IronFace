import { EmbeddingGenerator } from './embedding.js';
import { FaceComparator } from './compare.js';

class IronFaceApp {
    constructor() {
        this.embeddingGenerator = new EmbeddingGenerator();
        this.comparator = new FaceComparator();
        
        this.databaseFiles = [];
        this.databaseEmbeddings = [];
        this.queryFile = null;
        this.queryEmbedding = null;
        this.currentResults = [];
        
        this.initializeUI();
        this.initializeModels();
    }

    async initializeModels() {
        try {
            await this.embeddingGenerator.initialize();
            console.log('Sistema inicializado');
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao carregar',
                text: 'Erro ao carregar modelos. Verifique a conexão.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        }
    }

    initializeUI() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Database
        document.getElementById('load-database').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*';
            input.webkitdirectory = true;
            input.addEventListener('change', (e) => this.loadDatabase(e.target.files));
            input.click();
        });

        // Query
        document.getElementById('select-query').addEventListener('click', () => {
            document.getElementById('query-image').click();
        });

        document.getElementById('query-image').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadQueryImage(e.target.files[0]);
            }
        });

        // Compare
        document.getElementById('compare-btn').addEventListener('click', () => {
            this.compareWithDatabase();
        });

        // Threshold
        document.getElementById('threshold').addEventListener('change', (e) => {
            this.comparator.setThreshold(parseFloat(e.target.value));
        });

        // Modal
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    async loadDatabase(files) {
        this.databaseFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        
        document.getElementById('db-count').textContent = `${this.databaseFiles.length} imagens carregadas`;
        
        const listEl = document.getElementById('db-list');
        listEl.innerHTML = '';
        
        this.databaseFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.textContent = file.name;
            listEl.appendChild(item);
        });

        // Gerar embeddings
        await this.generateDatabaseEmbeddings();
    }

    async generateDatabaseEmbeddings() {
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressContainer.style.display = 'block';
        
        this.databaseEmbeddings = await this.embeddingGenerator.batchGenerate(
            this.databaseFiles,
            (progress) => {
                const percent = Math.round(progress * 100);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
            }
        );
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
    }

    async loadQueryImage(file) {
        this.queryFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('query-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Query">`;
        };
        reader.readAsDataURL(file);

        this.queryEmbedding = await this.embeddingGenerator.generateFromFile(file);
        
        document.getElementById('compare-btn').disabled = this.databaseEmbeddings.length === 0;
    }

    async compareWithDatabase() {
        if (!this.queryEmbedding || this.databaseEmbeddings.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Dados incompletos',
                text: 'Carregue o banco de dados e a imagem de consulta',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        const minSimilarity = parseFloat(document.getElementById('min-similarity').value);
        
        const results = this.comparator.compareWithDatabase(
            this.queryEmbedding,
            this.databaseEmbeddings,
            minSimilarity
        );
        
        // Armazenar embeddings nos resultados para garantir consistência
        this.currentResults = results.map(result => {
            const dbItem = this.databaseEmbeddings.find(
                item => item.file.name === result.file.name
            );
            return {
                ...result,
                dbEmbedding: dbItem?.embedding
            };
        });

        this.displayResults();
    }

    displayResults() {
        const resultsInfo = document.getElementById('results-info');
        const resultsList = document.getElementById('results-list');
        
        resultsInfo.textContent = `${this.currentResults.length} resultados encontrados`;
        resultsList.innerHTML = '';

        this.currentResults.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'result-item';
            
            if (result.percentage >= 80) {
                item.classList.add('high-match');
            } else if (result.percentage >= 60) {
                item.classList.add('medium-match');
            }

            item.innerHTML = `
                <div class="result-header">
                    <span class="result-name">${result.file.name}</span>
                    <span class="result-similarity">${result.percentage}%</span>
                </div>
                <div class="result-details">
                    Cosine: ${result.cosineSimilarity.toFixed(4)} | 
                    Euclidean: ${result.euclideanDistance.toFixed(4)} | 
                    Score: ${result.score.toFixed(4)}
                </div>
                <div class="result-actions">
                    <button class="btn-compare" data-index="${index}">Comparação Individual</button>
                </div>
            `;

            item.querySelector('.btn-compare').addEventListener('click', () => {
                this.showComparison(result);
            });

            resultsList.appendChild(item);
        });
    }

    async showComparison(result) {
        const modal = document.getElementById('comparison-modal');
        
        // Usar os mesmos embeddings da comparação múltipla
        if (result.dbEmbedding && this.queryEmbedding) {
            const freshComparison = this.comparator.compare(this.queryEmbedding, result.dbEmbedding);
            
            document.getElementById('modal-cosine').textContent = freshComparison.cosineSimilarity.toFixed(4);
            document.getElementById('modal-euclidean').textContent = freshComparison.euclideanDistance.toFixed(4);
            document.getElementById('modal-score').textContent = `${freshComparison.percentage}%`;
        } else {
            // Fallback para valores já calculados
            document.getElementById('modal-cosine').textContent = result.cosineSimilarity.toFixed(4);
            document.getElementById('modal-euclidean').textContent = result.euclideanDistance.toFixed(4);
            document.getElementById('modal-score').textContent = `${result.percentage}%`;
        }
        
        const queryReader = new FileReader();
        queryReader.onload = (e) => {
            document.getElementById('modal-query').src = e.target.result;
        };
        queryReader.readAsDataURL(this.queryFile);

        const resultReader = new FileReader();
        resultReader.onload = (e) => {
            document.getElementById('modal-result').src = e.target.result;
        };
        resultReader.readAsDataURL(result.file);

        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('comparison-modal').classList.remove('active');
    }
}

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
    new IronFaceApp();
});
