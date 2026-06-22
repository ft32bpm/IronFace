let modelsLoaded = false;
let databaseDescriptors = [];
let databaseFiles = [];
let databaseRejected = [];
let queryDescriptors = [];
let queryFiles = [];
let queryRejected = [];
let imageURLCache = new Map();
let faceVisualCache = new Map();
let modalComparisonVisuals = null;
let hideLandmarksPreference = false;
let currentResults = [];
let currentComparisonSettings = null;
let searchIndex = {
    byName: new Map(),
    byCPF: new Map(),
    byRG: new Map(),
    byAlcunha: new Map()
};

const HIDE_LANDMARKS_STORAGE_KEY = 'ironface.hideLandmarks';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const DEFAULT_SCORE_THRESHOLD = 82;
const DEFAULT_MIN_DISPLAY_SCORE = 65;
const DEFAULT_MAX_MATCH_DISTANCE = 0.52;
const REVIEW_MARGIN = 8;
const REVIEW_DISTANCE_MARGIN = 0.08;
const MIN_DETECTION_SCORE = 0.82;
const MIN_FACE_SIZE = 80;
const MIN_FACE_AREA_RATIO = 0.005;
const REQUIRED_COLLECTIVE_RATIO = 0.6;
const ANNOTATION_COLOR = '#00ff88';
const ANNOTATION_MAX_DIMENSION = 900;
const FACE_CROP_MAX_DIMENSION = 440;
const FACE_CROP_PADDING = 0.35;
const BATCH_SIZE = 5; // Processar 5 imagens em paralelo

async function loadModels() {
    const container = document.getElementById('model-status-container');
    const statusText = document.getElementById('model-status');
    
    container.classList.add('status-loading');
    statusText.textContent = 'Carregando...';
    
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        
        container.classList.remove('status-loading');
        container.classList.add('status-success');
        statusText.textContent = 'Carregados';
        
        // Atualizar ícone
        const icon = container.querySelector('.status-icon');
        icon.setAttribute('data-lucide', 'check-circle');
        lucide.createIcons();
    } catch (error) {
        container.classList.remove('status-loading');
        container.classList.add('status-error');
        statusText.textContent = 'Erro ao carregar';
        
        // Atualizar ícone
        const icon = container.querySelector('.status-icon');
        icon.setAttribute('data-lucide', 'x-circle');
        lucide.createIcons();
        
        console.error(error);
    }
}

async function getFaceAnalysis(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = async (event) => {
            imageURLCache.set(file, event.target.result);
            img.onload = async () => {
                try {
                    const detections = await faceapi
                        .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.72 }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();

                    if (detections.length === 0) {
                        resolve({ accepted: false, reason: 'nenhum rosto detectado' });
                        return;
                    }

                    if (detections.length > 1) {
                        resolve({ accepted: false, reason: 'mais de um rosto na imagem' });
                        return;
                    }

                    const detection = detections[0];
                    const box = toPlainBox(detection.detection.box);
                    const landmarks = toLandmarkPoints(detection.landmarks);
                    const visual = createFaceVisuals(img, event.target.result, box, landmarks);
                    const quality = evaluateFaceQuality(detection.detection, img.width, img.height);
                    if (!quality.accepted) {
                        resolve({ accepted: false, reason: quality.reason, quality });
                        return;
                    }

                    faceVisualCache.set(file, visual);
                    resolve({
                        accepted: true,
                        descriptor: detection.descriptor,
                        detection: {
                            box,
                            landmarks
                        },
                        visual,
                        quality
                    });
                } catch (error) {
                    resolve({ accepted: false, reason: 'erro ao processar imagem' });
                }
            };
            img.onerror = () => resolve({ accepted: false, reason: 'imagem inválida' });
            img.src = event.target.result;
        };
        reader.onerror = () => resolve({ accepted: false, reason: 'falha ao ler arquivo' });
        reader.readAsDataURL(file);
    });
}

function toPlainBox(box) {
    return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
    };
}

function toLandmarkPoints(landmarks) {
    const positions = landmarks.positions ||
        landmarks.relativePositions ||
        landmarks._positions ||
        (typeof landmarks.getPositions === 'function' ? landmarks.getPositions() : []);

    return positions.map(point => ({
        x: point.x,
        y: point.y
    }));
}

function createFaceVisuals(img, sourceUrl, box, landmarks) {
    return {
        sourceUrl,
        annotatedUrl: createAnnotatedImageUrl(img, box, landmarks, {
            maxDimension: ANNOTATION_MAX_DIMENSION
        }),
        boxedUrl: createAnnotatedImageUrl(img, box, landmarks, {
            maxDimension: ANNOTATION_MAX_DIMENSION,
            showLandmarks: false
        }),
        faceUrl: createAnnotatedImageUrl(img, box, landmarks, {
            maxDimension: FACE_CROP_MAX_DIMENSION,
            region: getFaceCropRegion(box, img.width, img.height)
        }),
        boxedFaceUrl: createAnnotatedImageUrl(img, box, landmarks, {
            maxDimension: FACE_CROP_MAX_DIMENSION,
            region: getFaceCropRegion(box, img.width, img.height),
            showLandmarks: false
        })
    };
}

function getFaceCropRegion(box, imageWidth, imageHeight) {
    const paddingX = box.width * FACE_CROP_PADDING;
    const paddingY = box.height * (FACE_CROP_PADDING + 0.1);
    const x = clamp(box.x - paddingX, 0, imageWidth);
    const y = clamp(box.y - paddingY, 0, imageHeight);
    const right = clamp(box.x + box.width + paddingX, 0, imageWidth);
    const bottom = clamp(box.y + box.height + paddingY, 0, imageHeight);

    return {
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y)
    };
}

function createAnnotatedImageUrl(img, box, landmarks, options = {}) {
    const region = options.region || {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
    };
    const maxDimension = options.maxDimension || ANNOTATION_MAX_DIMENSION;
    const scale = Math.min(1, maxDimension / Math.max(region.width, region.height));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = Math.max(1, Math.round(region.width * scale));
    canvas.height = Math.max(1, Math.round(region.height * scale));

    ctx.drawImage(
        img,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const scaledBox = {
        x: (box.x - region.x) * scale,
        y: (box.y - region.y) * scale,
        width: box.width * scale,
        height: box.height * scale
    };
    const scaledLandmarks = landmarks.map(point => ({
        x: (point.x - region.x) * scale,
        y: (point.y - region.y) * scale
    }));

    drawFaceOverlay(ctx, scaledBox, scaledLandmarks, canvas.width, canvas.height, options.showLandmarks !== false);
    return canvas.toDataURL('image/jpeg', 0.92);
}

function drawFaceOverlay(ctx, box, landmarks, width, height, showLandmarks = true) {
    const lineWidth = Math.max(2, Math.round(Math.max(width, height) / 280));

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.fillStyle = ANNOTATION_COLOR;
    ctx.shadowColor = 'rgba(0, 255, 136, 0.8)';
    ctx.shadowBlur = lineWidth * 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    if (showLandmarks) {
        ctx.shadowBlur = 0;
        drawLandmarkLines(ctx, landmarks, lineWidth);
        drawLandmarkPoints(ctx, landmarks, lineWidth);
    }

    ctx.restore();
}

function drawLandmarkLines(ctx, landmarks, lineWidth) {
    const groups = [
        { start: 0, end: 16, closed: false },
        { start: 17, end: 21, closed: false },
        { start: 22, end: 26, closed: false },
        { start: 27, end: 30, closed: false },
        { start: 31, end: 35, closed: false },
        { start: 36, end: 41, closed: true },
        { start: 42, end: 47, closed: true },
        { start: 48, end: 59, closed: true },
        { start: 60, end: 67, closed: true }
    ];

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = Math.max(1, lineWidth * 0.75);
    ctx.strokeStyle = ANNOTATION_COLOR;

    groups.forEach(group => {
        if (!landmarks[group.start] || !landmarks[group.end]) return;

        ctx.beginPath();
        ctx.moveTo(landmarks[group.start].x, landmarks[group.start].y);

        for (let i = group.start + 1; i <= group.end; i++) {
            ctx.lineTo(landmarks[i].x, landmarks[i].y);
        }

        if (group.closed) {
            ctx.closePath();
        }

        ctx.stroke();
    });

    ctx.restore();
}

function drawLandmarkPoints(ctx, landmarks, lineWidth) {
    const radius = Math.max(2, lineWidth * 1.1);

    landmarks.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function evaluateFaceQuality(detection, imageWidth, imageHeight) {
    const box = detection.box;
    const faceAreaRatio = (box.width * box.height) / (imageWidth * imageHeight);
    const reasons = [];

    if (detection.score < MIN_DETECTION_SCORE) {
        reasons.push(`detecção fraca (${Math.round(detection.score * 100)}%)`);
    }

    if (box.width < MIN_FACE_SIZE || box.height < MIN_FACE_SIZE) {
        reasons.push('rosto pequeno');
    }

    if (faceAreaRatio < MIN_FACE_AREA_RATIO) {
        reasons.push('rosto distante');
    }

    return {
        accepted: reasons.length === 0,
        reason: reasons.join(', '),
        detectionScore: detection.score,
        faceWidth: Math.round(box.width),
        faceHeight: Math.round(box.height),
        faceAreaRatio
    };
}

function euclideanDistance(desc1, desc2) {
    return faceapi.euclideanDistance(desc1, desc2);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

function buildSearchIndex(metadata, file) {
    if (!metadata) return;
    
    const dados = metadata.dados_pessoais;
    if (!dados) return;
    
    if (dados.nome_completo) {
        const nome = dados.nome_completo.toLowerCase();
        searchIndex.byName.set(nome, file);
    }
    
    if (dados.cpf) {
        const cpf = dados.cpf.replace(/\D/g, '');
        searchIndex.byCPF.set(cpf, file);
    }
    
    if (dados.rg) {
        const rg = dados.rg.replace(/\D/g, '');
        searchIndex.byRG.set(rg, file);
    }
    
    if (dados.alcunha) {
        const alcunha = dados.alcunha.toLowerCase();
        searchIndex.byAlcunha.set(alcunha, file);
    }
}

function quickSearchByField(field, value) {
    const normalizedValue = value.toLowerCase().replace(/\D/g, '');
    
    switch(field) {
        case 'cpf':
            return searchIndex.byCPF.get(normalizedValue);
        case 'rg':
            return searchIndex.byRG.get(normalizedValue);
        case 'nome':
            return searchIndex.byName.get(value.toLowerCase());
        case 'alcunha':
            return searchIndex.byAlcunha.get(value.toLowerCase());
        default:
            return null;
    }
}

function getFaceVisual(file) {
    return faceVisualCache.get(file) || {
        sourceUrl: imageURLCache.get(file),
        annotatedUrl: imageURLCache.get(file),
        boxedUrl: imageURLCache.get(file),
        faceUrl: imageURLCache.get(file),
        boxedFaceUrl: imageURLCache.get(file)
    };
}

function getVisualUrl(visual, variant = 'full') {
    if (variant === 'face') {
        return hideLandmarksPreference
            ? (visual.boxedFaceUrl || visual.faceUrl)
            : visual.faceUrl;
    }

    return hideLandmarksPreference
        ? (visual.boxedUrl || visual.annotatedUrl)
        : visual.annotatedUrl;
}

function loadHideLandmarksPreference() {
    try {
        return localStorage.getItem(HIDE_LANDMARKS_STORAGE_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

function saveHideLandmarksPreference(value) {
    try {
        localStorage.setItem(HIDE_LANDMARKS_STORAGE_KEY, String(value));
    } catch (error) {
        console.warn('Não foi possível salvar a preferência de landmarks', error);
    }
}

function initializeLandmarksPreference() {
    const checkbox = document.getElementById('hide-landmarks');
    hideLandmarksPreference = loadHideLandmarksPreference();

    if (!checkbox) return;

    checkbox.checked = hideLandmarksPreference;
    checkbox.addEventListener('change', () => {
        hideLandmarksPreference = checkbox.checked;
        saveHideLandmarksPreference(hideLandmarksPreference);
        refreshLandmarkViews();
    });
}

function refreshLandmarkViews() {
    renderDatabaseList();
    renderQueryPreview();

    if (currentResults.length > 0 && currentComparisonSettings) {
        displayResults(currentResults, currentComparisonSettings);
    }

    updateModalLandmarkView();
}

function readPercentInput(id, fallback) {
    const value = parseFloat(document.getElementById(id).value);
    return Number.isFinite(value) ? clamp(value, 0, 100) : fallback;
}

function readDistanceInput(id, fallback) {
    const value = parseFloat(document.getElementById(id).value);
    return Number.isFinite(value) ? clamp(value, 0.35, 0.75) : fallback;
}

function getComparisonSettings() {
    return {
        threshold: readPercentInput('threshold', DEFAULT_SCORE_THRESHOLD),
        minDisplayScore: readPercentInput('min-similarity', DEFAULT_MIN_DISPLAY_SCORE),
        maxMatchDistance: readDistanceInput('max-distance', DEFAULT_MAX_MATCH_DISTANCE)
    };
}

function calculateSimilarity(distance) {
    const normalized = clamp(distance, 0, 1.1);

    if (normalized <= 0.35) {
        return 100 - ((normalized / 0.35) * 4);
    }

    if (normalized <= 0.45) {
        return 96 - (((normalized - 0.35) / 0.1) * 6);
    }

    if (normalized <= 0.52) {
        return 90 - (((normalized - 0.45) / 0.07) * 8);
    }

    if (normalized <= 0.6) {
        return 82 - (((normalized - 0.52) / 0.08) * 22);
    }

    if (normalized <= 0.75) {
        return 60 - (((normalized - 0.6) / 0.15) * 35);
    }

    return Math.max(0, 25 - (((normalized - 0.75) / 0.35) * 25));
}

function requiredVotesFor(referenceCount) {
    // Para uma única imagem, precisa apenas 1 voto
    // Para múltiplas, precisa pelo menos 1 voto (mais flexível)
    return 1;
}

function compareDescriptorSet(referenceDescriptors, targetDescriptor, settings) {
    const comparisons = referenceDescriptors.map((queryItem) => {
        const distance = euclideanDistance(queryItem.descriptor, targetDescriptor);
        const similarity = calculateSimilarity(distance);

        return {
            file: queryItem.file,
            visual: queryItem.visual,
            distance,
            similarity
        };
    });

    comparisons.sort((a, b) => a.distance - b.distance);

    const best = comparisons[0];
    const averageScore = comparisons.reduce((sum, item) => sum + item.similarity, 0) / comparisons.length;
    const requiredVotes = requiredVotesFor(referenceDescriptors.length);
    const strictVotes = comparisons.filter(item =>
        item.similarity >= settings.threshold
    ).length;
    const closeVotes = comparisons.filter(item =>
        item.similarity >= Math.max(0, settings.threshold - REVIEW_MARGIN)
    ).length;
    const strictVoteRatio = strictVotes / comparisons.length;
    const score = referenceDescriptors.length === 1
        ? best.similarity
        : (best.similarity * 0.55) + (averageScore * 0.25) + (strictVoteRatio * 20);
    const roundedScore = Math.round(clamp(score, 0, 100));
    
    // Usar a similaridade da melhor correspondência para classificar
    const isCandidate = best.similarity >= settings.threshold &&
        strictVotes >= requiredVotes;
    const needsReview = !isCandidate && (
        best.similarity >= Math.max(0, settings.threshold - REVIEW_MARGIN) ||
        closeVotes >= requiredVotes
    );

    return {
        best,
        comparisons,
        strictVotes,
        closeVotes,
        requiredVotes,
        averageScore,
        score: roundedScore,
        distance: best.distance,
        similarity: Math.round(best.similarity),
        isCandidate,
        needsReview
    };
}

function getVerdict(result) {
    if (result.isCandidate) {
        return {
            label: 'Candidato forte',
            className: 'match'
        };
    }

    if (result.needsReview) {
        return {
            label: 'Revisar manualmente',
            className: 'review'
        };
    }

    return {
        label: 'Descartar',
        className: 'reject'
    };
}

function setCompareButtonState() {
    document.getElementById('compare-btn').disabled = queryDescriptors.length === 0 || databaseDescriptors.length === 0;
}

function renderDatabaseList() {
    const listEl = document.getElementById('db-list');
    listEl.innerHTML = '';

    const rejected = new Map(databaseRejected.map(item => [item.file, item.reason]));
    const accepted = new Map(databaseDescriptors.map(item => [item.file, item]));

    databaseFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';

        if (accepted.has(file)) {
            const dbItem = accepted.get(file);
            const visual = dbItem.visual || getFaceVisual(file);
            const nome = dbItem.metadata?.dados_pessoais?.nome_completo || 'Nome não disponível';
            const cacheIcon = dbItem.fromCache ? '<i data-lucide="zap" style="width:16px; height:16px; color:var(--color-success); position:absolute; top:4px; left:4px; filter:drop-shadow(0 0 2px rgba(0,0,0,0.8));"></i>' : '';
            
            item.classList.add('accepted');
            item.style.cursor = 'pointer';
            item.style.position = 'relative';
            
            // Usar thumbnail do Drive se disponível e vier do cache
            const thumbSrc = (dbItem.fromCache && visual.thumbnailLink) 
                ? visual.thumbnailLink 
                : getVisualUrl(visual, 'face');
            
            item.innerHTML = `
                ${cacheIcon}
                <img class="file-face-thumb" 
                     src="${thumbSrc}" 
                     loading="lazy"
                     alt="${escapeHTML(file.name)} anotada">
                <div class="file-item-meta">
                    <span>${escapeHTML(nome)}</span>
                    <small>Rosto capturado | confiança ${Math.round(dbItem.quality.detectionScore * 100)}%</small>
                </div>
            `;
            
            // Inicializar ícones Lucide após adicionar ao DOM
            setTimeout(() => lucide.createIcons(), 0);
            
            item.addEventListener('click', () => {
                showPersonDetails(dbItem);
            });
        } else if (rejected.has(file)) {
            item.classList.add('rejected');
            item.textContent = `${file.name} - rejeitada: ${rejected.get(file)}`;
            item.title = rejected.get(file);
        } else {
            item.textContent = file.name;
        }

        listEl.appendChild(item);
    });
}

function renderQueryPreview() {
    const preview = document.getElementById('query-preview');

    if (queryDescriptors.length === 0) {
        return;
    }

    if (queryDescriptors.length === 1) {
        const queryItem = queryDescriptors[0];
        const visual = queryItem.visual || getFaceVisual(queryItem.file);
        preview.innerHTML = `<img class="annotated-preview" src="${getVisualUrl(visual)}" alt="Consulta anotada">`;
        return;
    }

    preview.innerHTML = '<div class="query-preview-grid"></div>';
    const grid = preview.querySelector('.query-preview-grid');

    queryDescriptors.forEach(queryItem => {
        const visual = queryItem.visual || getFaceVisual(queryItem.file);
        const img = document.createElement('img');
        img.src = getVisualUrl(visual, 'face');
        img.alt = `${queryItem.file.name} anotada`;
        grid.appendChild(img);
    });
}

document.getElementById('load-database').addEventListener('click', async () => {
    if (!driveManager.isAuthenticated()) {
        Swal.fire({
            icon: 'warning',
            title: 'Não conectado',
            text: 'Conecte-se ao Google Drive primeiro na aba "Configurações"',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }
    await loadDatabaseFromDrive();
});

async function loadDatabaseFromDrive() {
    if (!modelsLoaded) {
        Swal.fire({
            icon: 'info',
            title: 'Aguarde',
            text: 'Aguarde o carregamento dos modelos antes de processar imagens',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }

    try {
        databaseDescriptors = [];
        databaseRejected = [];
        currentResults = [];
        currentComparisonSettings = null;
        faceVisualCache = new Map(queryDescriptors.map(item => [item.file, item.visual]));
        searchIndex = {
            byName: new Map(),
            byCPF: new Map(),
            byRG: new Map(),
            byAlcunha: new Map()
        };

        document.getElementById('db-count').textContent = 'Carregando do Google Drive...';

        const progressContainer = document.getElementById('global-progress');
        const progressFill = document.getElementById('global-progress-fill');
        const progressText = document.getElementById('global-progress-text');

        progressContainer.classList.add('active');
        progressFill.style.width = '0%';
        progressText.textContent = 'Buscando imagens no Google Drive...';

        const driveFiles = await driveManager.getAllImages();
        
        if (driveFiles.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Banco vazio',
                text: 'Nenhuma imagem encontrada no banco de dados do Google Drive',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            progressContainer.style.display = 'none';
            document.getElementById('db-count').textContent = '0 imagens carregadas';
            return;
        }

        progressText.textContent = `${driveFiles.length} imagens encontradas. Processando em lotes...`;
        progressFill.style.width = '10%';

        databaseFiles = [];
        let processedCount = 0;
        let cachedCount = 0;

        // Processar em lotes paralelos
        for (let i = 0; i < driveFiles.length; i += BATCH_SIZE) {
            const batch = driveFiles.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (driveFile) => {
                try {
                    // Verificar cache primeiro
                    const cached = driveManager.getCachedDescriptor(driveFile.id, driveFile.modifiedTime);
                    
                    if (cached && cached.descriptor) {
                        // Usar dados do cache
                        const metadata = driveFile.description ? JSON.parse(driveFile.description) : null;
                        const file = { name: driveFile.name, id: driveFile.id, cached: true };
                        databaseFiles.push(file);
                        
                        databaseDescriptors.push({
                            file: file,
                            descriptor: cached.descriptor,
                            detection: cached.detection,
                            visual: cached.visual || { thumbnailLink: driveFile.thumbnailLink },
                            quality: cached.quality,
                            driveFileId: driveFile.id,
                            metadata: metadata,
                            fromCache: true
                        });
                        
                        // Adicionar ao índice de busca
                        buildSearchIndex(metadata, file);
                        cachedCount++;
                        return;
                    }

                    // Se não estiver em cache, baixar e processar
                    const blob = await driveManager.downloadImage(driveFile.id);
                    const file = new File([blob], driveFile.name, { type: 'image/jpeg' });
                    databaseFiles.push(file);

                    const analysis = await getFaceAnalysis(file);
                    
                    if (analysis.accepted) {
                        const metadata = driveFile.description ? JSON.parse(driveFile.description) : null;
                        
                        databaseDescriptors.push({
                            file: file,
                            descriptor: analysis.descriptor,
                            detection: analysis.detection,
                            visual: analysis.visual,
                            quality: analysis.quality,
                            driveFileId: driveFile.id,
                            metadata: metadata
                        });
                        
                        // Salvar no cache
                        driveManager.setCachedDescriptor(driveFile.id, driveFile.modifiedTime, {
                            descriptor: analysis.descriptor,
                            detection: analysis.detection,
                            visual: analysis.visual,
                            quality: analysis.quality
                        });
                        
                        // Adicionar ao índice de busca
                        buildSearchIndex(metadata, file);
                    } else {
                        databaseRejected.push({
                            file: file,
                            reason: analysis.reason
                        });
                    }

                } catch (error) {
                    console.error('Erro ao processar imagem:', driveFile.name, error);
                    databaseRejected.push({
                        file: { name: driveFile.name },
                        reason: 'erro ao baixar/processar'
                    });
                }
            }));

            processedCount += batch.length;
            const percent = Math.round(10 + (processedCount / driveFiles.length) * 90);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `Processando: ${processedCount}/${driveFiles.length} (${cachedCount} do cache)`;
        }

        renderDatabaseList();
        document.getElementById('db-count').textContent =
            `${databaseDescriptors.length}/${driveFiles.length} válidas | ${databaseRejected.length} rejeitadas | ${cachedCount} do cache`;

        setTimeout(() => {
            progressContainer.classList.remove('active');
        }, 1000);

        setCompareButtonState();

        // Mostrar estatísticas de cache
        if (cachedCount > 0) {
            console.log(`✓ Cache: ${cachedCount}/${driveFiles.length} imagens carregadas do cache (${Math.round(cachedCount/driveFiles.length*100)}% mais rápido)`);
        }

    } catch (error) {
        console.error('Erro ao carregar banco de dados:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao carregar',
            text: 'Erro ao carregar banco de dados do Google Drive: ' + error.message,
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        document.getElementById('global-progress').classList.remove('active');
    }
}

async function loadDatabase(event) {
    if (!modelsLoaded) {
        Swal.fire({
            icon: 'info',
            title: 'Aguarde',
            text: 'Aguarde o carregamento dos modelos antes de processar imagens',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }

    const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'));
    databaseFiles = files;
    databaseDescriptors = [];
    databaseRejected = [];
    currentResults = [];
    currentComparisonSettings = null;
    faceVisualCache = new Map(queryDescriptors.map(item => [item.file, item.visual]));

    document.getElementById('db-count').textContent = `${files.length} imagens carregadas`;
    renderDatabaseList();

    const progressContainer = document.getElementById('global-progress');
    const progressFill = document.getElementById('global-progress-fill');
    const progressText = document.getElementById('global-progress-text');

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Processando banco de dados: 0%';

    for (let i = 0; i < files.length; i++) {
        const analysis = await getFaceAnalysis(files[i]);
        if (analysis.accepted) {
            databaseDescriptors.push({
                file: files[i],
                descriptor: analysis.descriptor,
                detection: analysis.detection,
                visual: analysis.visual,
                quality: analysis.quality
            });
        } else {
            databaseRejected.push({
                file: files[i],
                reason: analysis.reason
            });
        }

        const percent = Math.round(((i + 1) / files.length) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Processando banco de dados: ${percent}%`;
    }

    renderDatabaseList();
    document.getElementById('db-count').textContent =
        `${databaseDescriptors.length}/${files.length} válidas | ${databaseRejected.length} rejeitadas`;

    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 1000);

    setCompareButtonState();
}

document.getElementById('select-query').addEventListener('click', () => {
    const input = document.getElementById('query-image');
    
    Swal.fire({
        title: 'Selecionar imagens',
        text: 'Deseja selecionar múltiplas imagens ou um diretório completo?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Múltiplas Imagens',
        denyButtonText: 'Diretório',
        cancelButtonText: 'Cancelar',
        background: '#1a1a1a',
        color: '#e0e0e0',
        confirmButtonColor: '#00d4ff',
        denyButtonColor: '#6c757d',
        cancelButtonColor: '#dc3545'
    }).then((result) => {
        if (result.isConfirmed) {
            input.removeAttribute('webkitdirectory');
            input.removeAttribute('directory');
            input.multiple = true;
            input.value = '';
            input.click();
        } else if (result.isDenied) {
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.multiple = true;
            input.value = '';
            input.click();
        }
    });
});

document.getElementById('query-image').addEventListener('change', async (event) => {
    if (event.target.files.length === 0) return;
    await loadQueryImages(Array.from(event.target.files));
});

async function loadQueryImages(files) {
    if (!modelsLoaded) {
        Swal.fire({
            icon: 'info',
            title: 'Aguarde',
            text: 'Aguarde o carregamento dos modelos antes de processar imagens',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }

    queryFiles = files.filter(f => f.type.startsWith('image/'));
    queryDescriptors = [];
    queryRejected = [];
    currentResults = [];
    currentComparisonSettings = null;

    const preview = document.getElementById('query-preview');
    preview.innerHTML = queryFiles.length > 1 ? '<div class="query-preview-grid"></div>' : '';
    const grid = preview.querySelector('.query-preview-grid');

    const progressContainer = document.getElementById('global-progress');
    const progressFill = document.getElementById('global-progress-fill');
    const progressText = document.getElementById('global-progress-text');

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Processando consulta: 0%';

    for (let i = 0; i < queryFiles.length; i++) {
        const file = queryFiles[i];
        const analysis = await getFaceAnalysis(file);

        if (analysis.accepted) {
            queryDescriptors.push({
                file,
                descriptor: analysis.descriptor,
                detection: analysis.detection,
                visual: analysis.visual,
                quality: analysis.quality
            });

            if (queryFiles.length === 1) {
                preview.innerHTML = `<img class="annotated-preview" src="${getVisualUrl(analysis.visual)}" alt="Consulta anotada">`;
            } else {
                const img = document.createElement('img');
                img.src = getVisualUrl(analysis.visual, 'face');
                img.alt = `${file.name} anotada`;
                grid.appendChild(img);
            }
        } else {
            queryRejected.push({ file, reason: analysis.reason });
        }

        const percent = Math.round(((i + 1) / queryFiles.length) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Processando consulta: ${percent}%`;
    }

    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 600);

    if (queryDescriptors.length === 0) {
        preview.innerHTML = '<div class="empty-state">Nenhuma imagem de consulta válida</div>';
        Swal.fire({
            icon: 'warning',
            title: 'Nenhum rosto detectado',
            text: 'Nenhum rosto válido detectado nas imagens de consulta',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
    } else {
        renderQueryPreview();
    }

    setCompareButtonState();
    document.getElementById('results-info').textContent =
        `${queryDescriptors.length} referência(s) válidas | ${queryRejected.length} rejeitada(s)`;
    document.getElementById('results-list').innerHTML = '';
}

document.getElementById('compare-btn').addEventListener('click', compareWithDatabase);
initializeLandmarksPreference();

['threshold', 'min-similarity', 'max-distance'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        if (document.querySelector('.result-item')) {
            compareWithDatabase();
        }
    });
});

function compareWithDatabase() {
    if (queryDescriptors.length === 0 || databaseDescriptors.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Dados incompletos',
            text: 'Carregue o banco de dados e uma consulta válida',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }

    const settings = getComparisonSettings();
    const results = [];

    for (const dbItem of databaseDescriptors) {
        const aggregate = compareDescriptorSet(queryDescriptors, dbItem.descriptor, settings);

        if (aggregate.score >= settings.minDisplayScore || aggregate.needsReview || aggregate.isCandidate) {
            results.push({
                file: dbItem.file,
                descriptor: dbItem.descriptor,
                detection: dbItem.detection,
                visual: dbItem.visual,
                quality: dbItem.quality,
                ...aggregate
            });
        }
    }

    results.sort((a, b) => {
        if (a.isCandidate !== b.isCandidate) return Number(b.isCandidate) - Number(a.isCandidate);
        if (a.needsReview !== b.needsReview) return Number(b.needsReview) - Number(a.needsReview);
        if (a.score !== b.score) return b.score - a.score;
        return a.distance - b.distance;
    });

    currentResults = results;
    currentComparisonSettings = settings;
    displayResults(currentResults, currentComparisonSettings);
}

function displayResults(results, settings) {
    const resultsInfo = document.getElementById('results-info');
    const resultsList = document.getElementById('results-list');
    const mode = queryDescriptors.length > 1 ? 'coletiva' : 'individual';
    const candidates = results.filter(result => result.isCandidate).length;
    const reviews = results.filter(result => result.needsReview).length;

    resultsInfo.textContent =
        `${candidates} candidato(s) forte(s) | ${reviews} para revisão | consulta ${mode}`;
    resultsList.innerHTML = '';

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        const verdict = getVerdict(result);

        if (result.isCandidate) {
            item.classList.add('high-match');
        } else if (result.needsReview) {
            item.classList.add('medium-match');
        } else {
            item.classList.add('low-match');
        }

        const visual = result.visual || getFaceVisual(result.file);
        const collectiveDetails = queryDescriptors.length > 1
            ? ` | Votos fortes: ${result.strictVotes}/${queryDescriptors.length} | Votos próximos: ${result.closeVotes}/${queryDescriptors.length}`
            : '';

        const dbItem = databaseDescriptors.find(db => db.file === result.file);
        const meta = dbItem?.metadata;
        const nome = meta?.dados_pessoais?.nome_completo || 'N/A';
        const rg = meta?.dados_pessoais?.rg || 'N/A';
        const cpf = meta?.dados_pessoais?.cpf || 'N/A';
        const alcunha = meta?.dados_pessoais?.alcunha || '';

        // Identificar outros candidatos da mesma pessoa
        const samePerson = results.filter(r => {
            const rMeta = databaseDescriptors.find(db => db.file === r.file)?.metadata;
            return rMeta && meta && 
                   (rMeta.dados_pessoais.cpf === meta.dados_pessoais.cpf ||
                    rMeta.dados_pessoais.rg === meta.dados_pessoais.rg) &&
                   r !== result;
        });
        
        const otherCandidatesHtml = samePerson.length > 0 ? `
            <div class="result-other-candidates">
                <span class="result-info-label">Outros candidatos desta pessoa:</span>
                ${samePerson.slice(0, 3).map(r => `<span class="other-candidate-badge">${r.score}%</span>`).join(' ')}
                ${samePerson.length > 3 ? `<span class="other-candidate-more">+${samePerson.length - 3}</span>` : ''}
            </div>
        ` : '';

        item.innerHTML = `
            <div class="result-face-preview">
                <img src="${getVisualUrl(visual, 'face')}" alt="${escapeHTML(result.file.name)} anotada">
            </div>
            <div class="result-header">
                <span class="result-name">${escapeHTML(nome)}</span>
                <span class="result-similarity">${result.similarity}%</span>
            </div>
            <span class="result-verdict ${verdict.className}">${verdict.label}</span>
            <div class="result-person-info">
                <div class="result-info-field">
                    <span class="result-info-label">RG:</span>
                    <span class="result-info-value" data-copy="${escapeHTML(rg)}">${escapeHTML(rg)}</span>
                    <button class="btn-copy-field" title="Copiar RG" data-value="${escapeHTML(rg)}"><i data-lucide="copy" style="width:14px; height:14px;"></i></button>
                </div>
                <div class="result-info-field">
                    <span class="result-info-label">CPF:</span>
                    <span class="result-info-value" data-copy="${escapeHTML(cpf)}">${escapeHTML(cpf)}</span>
                    <button class="btn-copy-field" title="Copiar CPF" data-value="${escapeHTML(cpf)}"><i data-lucide="copy" style="width:14px; height:14px;"></i></button>
                </div>
                ${alcunha ? `<div class="result-info-field">
                    <span class="result-info-label">Alcunha:</span>
                    <span class="result-info-value">${escapeHTML(alcunha)}</span>
                </div>` : ''}
                ${otherCandidatesHtml}
            </div>
            <div class="result-details">
                Distância: ${result.distance.toFixed(4)} / limite ${settings.maxMatchDistance.toFixed(2)} |
                Similaridade: ${result.similarity}% | Média: ${Math.round(result.averageScore)}%${collectiveDetails}
            </div>
            <div class="result-actions">
                <button class="btn-compare" data-index="${index}">Análise Individual</button>
            </div>
        `;

        item.querySelector('.btn-compare').addEventListener('click', () => {
            showComparison(result);
        });

        item.querySelectorAll('.btn-copy-field').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.getAttribute('data-value');
                navigator.clipboard.writeText(value).then(() => {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i data-lucide="check" style="width:14px; height:14px;"></i>';
                    btn.style.color = '#3fb950';
                    lucide.createIcons();
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.color = '';
                        lucide.createIcons();
                    }, 1500);
                }).catch(err => {
                    console.error('Erro ao copiar:', err);
                });
            });
        });

        resultsList.appendChild(item);
        lucide.createIcons({ nameAttr: 'data-lucide' });
    });
}

function showComparison(result) {
    const modal = document.getElementById('comparison-modal');
    const queryVisual = result.best.visual || getFaceVisual(result.best.file);
    const resultVisual = result.visual || getFaceVisual(result.file);

    modalComparisonVisuals = {
        query: queryVisual,
        result: resultVisual
    };
    updateModalLandmarkView();

    // Exibir apenas distância e similaridade
    document.getElementById('modal-euclidean').textContent = result.distance.toFixed(4);
    document.getElementById('modal-similarity').textContent = `${result.similarity}%`;

    modal.classList.add('active');
}

function updateModalLandmarkView() {
    if (!modalComparisonVisuals) return;

    document.getElementById('modal-query').src = getVisualUrl(modalComparisonVisuals.query);
    document.getElementById('modal-result').src = getVisualUrl(modalComparisonVisuals.result);
}

document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('comparison-modal').classList.remove('active');
});

window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        document.getElementById('comparison-modal').classList.remove('active');
    }
});

function showPersonDetails(dbItem) {
    const meta = dbItem.metadata;
    
    if (!meta) {
        Swal.fire({
            title: 'Dados não disponíveis',
            text: 'Não há metadados associados a esta imagem.',
            icon: 'warning',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff'
        });
        return;
    }
    
    const visual = dbItem.visual || getFaceVisual(dbItem.file);
    const imageUrl = getVisualUrl(visual, 'face');
    
    const htmlContent = `
        <div style="text-align: left; max-height: 500px; overflow-y: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${imageUrl}" style="max-width: 200px; border-radius: 8px; border: 2px solid #00d4ff;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <h3 style="color: #00d4ff; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">Dados Pessoais</h3>
                <p><strong>Nome:</strong> ${meta.dados_pessoais.nome_completo || 'N/A'}</p>
                <p><strong>Alcunha:</strong> ${meta.dados_pessoais.alcunha || 'N/A'}</p>
                <p><strong>RG:</strong> ${meta.dados_pessoais.rg || 'N/A'}</p>
                <p><strong>CPF:</strong> ${meta.dados_pessoais.cpf || 'N/A'}</p>
                <p><strong>Data de Nascimento:</strong> ${meta.dados_pessoais.data_nascimento ? new Date(meta.dados_pessoais.data_nascimento).toLocaleDateString('pt-BR') : 'N/A'}</p>
                <p><strong>Filiação - Mãe:</strong> ${meta.dados_pessoais.filiacao_mae || 'N/A'}</p>
                <p><strong>Filiação - Pai:</strong> ${meta.dados_pessoais.filiacao_pai || 'N/A'}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h3 style="color: #00d4ff; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">Endereço</h3>
                <p><strong>Logradouro:</strong> ${meta.endereco.logradouro || 'N/A'}</p>
                <p><strong>Bairro:</strong> ${meta.endereco.bairro || 'N/A'}</p>
                <p><strong>Cidade:</strong> ${meta.endereco.cidade || 'N/A'}</p>
                <p><strong>Estado:</strong> ${meta.endereco.estado || 'N/A'}</p>
                <p><strong>CEP:</strong> ${meta.endereco.cep || 'N/A'}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h3 style="color: #00d4ff; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">Características Físicas</h3>
                <p><strong>Altura:</strong> ${meta.caracteristicas.altura || 'N/A'}</p>
                <p><strong>Cor da Pele:</strong> ${meta.caracteristicas.cor_pele || 'N/A'}</p>
                <p><strong>Cor dos Olhos:</strong> ${meta.caracteristicas.cor_olhos || 'N/A'}</p>
                <p><strong>Tatuagens:</strong> ${meta.caracteristicas.tatuagens || 'N/A'}</p>
                <p><strong>Sinais Particulares:</strong> ${meta.caracteristicas.sinais_particulares || 'N/A'}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h3 style="color: #00d4ff; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">Dados da Abordagem</h3>
                <p><strong>Data da Abordagem:</strong> ${meta.dados_abordagem.data_abordagem ? new Date(meta.dados_abordagem.data_abordagem).toLocaleDateString('pt-BR') : 'N/A'}</p>
                <p><strong>Local da Abordagem:</strong> ${meta.dados_abordagem.local_abordagem || 'N/A'}</p>
                <p><strong>Local do Cadastro:</strong> ${meta.dados_abordagem.local_cadastro || 'N/A'}</p>
                <p><strong>Policial Responsável:</strong> ${meta.dados_abordagem.policial_responsavel || 'N/A'}</p>
                <p><strong>Observações:</strong> ${meta.dados_abordagem.observacoes || 'N/A'}</p>
            </div>
        </div>
    `;
    
    Swal.fire({
        title: meta.dados_pessoais.nome_completo || 'Detalhes da Pessoa',
        html: htmlContent,
        width: '700px',
        background: '#1a1a1a',
        color: '#e0e0e0',
        confirmButtonColor: '#00d4ff',
        confirmButtonText: 'Fechar',
        customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title'
        }
    });
}

window.addEventListener('DOMContentLoaded', loadModels);
