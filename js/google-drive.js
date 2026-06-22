// Google Drive API Integration
import { ImageOptimizer } from './image-optimizer.js';

class GoogleDriveManager {
    constructor() {
        this.CLIENT_ID = null;
        this.API_KEY = null;
        this.DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.accessToken = null;
        this.rootFolderId = null;
        
        // Carregar configurações salvas ou usar padrões
        const maxWidth = parseInt(localStorage.getItem('opt_max_width')) || 1920;
        const maxHeight = parseInt(localStorage.getItem('opt_max_height')) || 1080;
        const quality = (parseInt(localStorage.getItem('opt_quality')) || 85) / 100;
        const maxFileSize = 150 * 1024; // 150KB fixo
        
        this.imageOptimizer = new ImageOptimizer({
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            quality: quality,
            maxFileSize: maxFileSize
        });
    }

    async initialize(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;
        
        // Salvar credenciais
        localStorage.setItem('gdrive_client_id', clientId);
        localStorage.setItem('gdrive_api_key', apiKey);
        
        console.log('Carregando scripts do Google...');
        await this.loadGoogleScripts();
        console.log('Scripts carregados');
        
        console.log('Inicializando GAPI...');
        await this.initializeGapi();
        console.log('GAPI inicializado');
        
        console.log('Inicializando GIS...');
        this.initializeGis();
        console.log('GIS inicializado');
    }

    loadGoogleScripts() {
        return new Promise((resolve, reject) => {
            if (window.gapi && window.google) {
                console.log('Scripts do Google já carregados');
                resolve();
                return;
            }

            console.log('Carregando GAPI script...');
            const gapiScript = document.createElement('script');
            gapiScript.src = 'https://apis.google.com/js/api.js';
            gapiScript.onerror = () => reject(new Error('Falha ao carregar GAPI'));
            gapiScript.onload = () => {
                console.log('GAPI script carregado, carregando GIS...');
                const gisScript = document.createElement('script');
                gisScript.src = 'https://accounts.google.com/gsi/client';
                gisScript.onerror = () => reject(new Error('Falha ao carregar GIS'));
                gisScript.onload = () => {
                    console.log('GIS script carregado');
                    resolve();
                };
                document.body.appendChild(gisScript);
            };
            document.body.appendChild(gapiScript);
        });
    }

    async initializeGapi() {
        return new Promise((resolve, reject) => {
            console.log('Carregando cliente GAPI...');
            if (!window.gapi) {
                reject(new Error('GAPI não está disponível'));
                return;
            }
            
            gapi.load('client', async () => {
                try {
                    console.log('Inicializando cliente com API Key...');
                    await gapi.client.init({
                        apiKey: this.API_KEY
                    });
                    
                    console.log('Carregando Google Drive API v3...');
                    await gapi.client.load('drive', 'v3');
                    
                    this.gapiInited = true;
                    console.log('Cliente GAPI e Drive API inicializados com sucesso');
                    resolve();
                } catch (error) {
                    console.error('Erro ao inicializar GAPI:', error);
                    console.error('Detalhes:', JSON.stringify(error));
                    reject(error);
                }
            });
        });
    }

    initializeGis() {
        console.log('Criando token client com Client ID:', this.CLIENT_ID);
        
        if (!window.google || !window.google.accounts) {
            console.error('Google Identity Services não está disponível');
            throw new Error('Google Identity Services não carregado');
        }
        
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                console.log('Resposta de autenticação:', response);
                if (response.access_token) {
                    console.log('Token de acesso recebido');
                    this.accessToken = response.access_token;
                    gapi.client.setToken({ access_token: response.access_token });
                    localStorage.setItem('gdrive_token', response.access_token);
                    localStorage.setItem('gdrive_token_expiry', Date.now() + 3600000);
                } else if (response.error) {
                    console.error('Erro na autenticação:', response.error);
                }
            },
        });
        this.gisInited = true;
        console.log('Token client criado');
    }

    async authenticate() {
        const savedToken = localStorage.getItem('gdrive_token');
        const expiry = localStorage.getItem('gdrive_token_expiry');
        
        if (savedToken && expiry && Date.now() < parseInt(expiry)) {
            console.log('Usando token salvo');
            this.accessToken = savedToken;
            if (window.gapi && window.gapi.client) {
                gapi.client.setToken({ access_token: savedToken });
            }
            return true;
        }

        console.log('Solicitando novo token...');
        return new Promise((resolve) => {
            this.tokenClient.callback = (response) => {
                console.log('Callback de autenticação chamado:', response);
                if (response.access_token) {
                    console.log('Token recebido com sucesso');
                    this.accessToken = response.access_token;
                    if (window.gapi && window.gapi.client) {
                        gapi.client.setToken({ access_token: response.access_token });
                    }
                    localStorage.setItem('gdrive_token', response.access_token);
                    localStorage.setItem('gdrive_token_expiry', Date.now() + 3600000);
                    resolve(true);
                } else {
                    console.error('Falha na autenticação:', response);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro na autenticação',
                        text: 'Erro na autenticação: ' + (response.error || 'Desconhecido'),
                        background: '#1a1a1a',
                        color: '#e0e0e0',
                        confirmButtonColor: '#00d4ff'
                    });
                    resolve(false);
                }
            };
            
            console.log('Abrindo janela de autenticação...');
            try {
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (error) {
                console.error('Erro ao solicitar token:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao autenticar',
                    text: 'Erro ao abrir janela de autenticação: ' + error.message,
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
                resolve(false);
            }
        });
    }

    disconnect() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            this.accessToken = null;
            localStorage.removeItem('gdrive_token');
            localStorage.removeItem('gdrive_token_expiry');
            localStorage.removeItem('gdrive_root_folder');
            // NÃO remover client_id e api_key para manter as credenciais salvas
            console.log('Desconectado, mas credenciais mantidas');
        }
    }

    isAuthenticated() {
        const expiry = localStorage.getItem('gdrive_token_expiry');
        return this.accessToken && expiry && Date.now() < parseInt(expiry);
    }

    async findOrCreateFolder(folderName, parentId = null) {
        const query = parentId 
            ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
            : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files.length > 0) {
            return response.result.files[0].id;
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };
        
        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const folder = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        return folder.result.id;
    }

    async setupFolderStructure() {
        if (this.rootFolderId) return this.rootFolderId;

        const savedRootId = localStorage.getItem('gdrive_root_folder');
        if (savedRootId) {
            this.rootFolderId = savedRootId;
            return savedRootId;
        }

        this.rootFolderId = await this.findOrCreateFolder('IronFace_Database');
        localStorage.setItem('gdrive_root_folder', this.rootFolderId);
        return this.rootFolderId;
    }

    async uploadImage(imageFile, metadata) {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        // Validar cidade obrigatória
        if (!metadata.endereco.cidade || metadata.endereco.cidade.trim() === '') {
            throw new Error('Cidade é obrigatória para salvar o cadastro');
        }

        // Detectar rosto na imagem
        let detection = null;
        try {
            const img = await this.loadImage(imageFile);
            detection = await faceapi.detectSingleFace(img).withFaceLandmarks();
            
            if (detection) {
                console.log('✓ Rosto detectado - aplicando enquadramento inteligente');
            } else {
                console.log('⚠ Nenhum rosto detectado - usando otimização padrão');
            }
        } catch (error) {
            console.warn('Erro na detecção facial:', error);
        }

        // Otimizar imagem (com ou sem enquadramento facial)
        const optimizationResult = await this.imageOptimizer.optimize(imageFile, detection);
        
        const reduction = ((1 - optimizationResult.optimizedSize / imageFile.size) * 100).toFixed(1);
        const framingInfo = optimizationResult.framed ? ' [ENQUADRADO]' : '';
        
        console.log(`Imagem otimizada${framingInfo}: ${this.imageOptimizer.formatBytes(imageFile.size)} → ${this.imageOptimizer.formatBytes(optimizationResult.optimizedSize)} (${reduction}% redução) - Qualidade final: ${Math.round(optimizationResult.quality * 100)}%`);
        
        const optimizedFile = optimizationResult.file;

        const rootId = await this.setupFolderStructure();
        
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = now.toLocaleString('pt-BR', { month: 'long' });
        const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);

        // Estrutura: CIDADE → ANO → MÊS
        const cidadeClean = metadata.endereco.cidade.trim().replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '').replace(/\s+/g, '_');
        const cidadeFolderId = await this.findOrCreateFolder(cidadeClean, rootId);
        const yearFolderId = await this.findOrCreateFolder(year, cidadeFolderId);
        const monthFolderId = await this.findOrCreateFolder(monthCapitalized, yearFolderId);

        // Construir nome do arquivo: Nome_Cpf_Rg (usando apenas campos disponíveis)
        const parts = [];
        
        if (metadata.dados_pessoais.nome_completo) {
            const nomeClean = metadata.dados_pessoais.nome_completo
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_]/g, '');
            parts.push(nomeClean);
        }
        
        if (metadata.dados_pessoais.cpf) {
            const cpfClean = metadata.dados_pessoais.cpf.replace(/\D/g, '');
            parts.push(cpfClean);
        }
        
        if (metadata.dados_pessoais.rg) {
            const rgClean = metadata.dados_pessoais.rg.replace(/\D/g, '');
            parts.push(rgClean);
        }
        
        // Se não houver nenhum campo, usar timestamp
        const fileName = parts.length > 0 
            ? `${parts.join('_')}.jpg`
            : `foto_${Date.now()}.jpg`;

        const metadataJson = JSON.stringify(metadata, null, 2);

        const form = new FormData();
        const fileMetadata = {
            name: fileName,
            parents: [monthFolderId],
            description: metadataJson
        };
        
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', optimizedFile);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,description', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error('Erro ao fazer upload da imagem');
        }

        return await response.json();
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async searchByCPF(cpf) {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const cpfClean = cpf.replace(/\D/g, '');
        const query = `name contains 'CPF_${cpfClean}' and trashed=false`;

        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name, description, webViewLink, createdTime)',
            spaces: 'drive',
            orderBy: 'createdTime desc'
        });

        return response.result.files.map(file => ({
            ...file,
            metadata: file.description ? JSON.parse(file.description) : null
        }));
    }

    async searchByName(nome) {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const rootId = await this.setupFolderStructure();
        const query = `'${rootId}' in parents and trashed=false`;

        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name, description, webViewLink, createdTime)',
            spaces: 'drive',
            orderBy: 'createdTime desc',
            pageSize: 1000
        });

        const results = response.result.files.filter(file => {
            if (!file.description) return false;
            try {
                const metadata = JSON.parse(file.description);
                return metadata.dados_pessoais?.nome_completo?.toLowerCase().includes(nome.toLowerCase());
            } catch {
                return false;
            }
        });

        return results.map(file => ({
            ...file,
            metadata: JSON.parse(file.description)
        }));
    }

    async getAllImages() {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const rootId = await this.setupFolderStructure();
        
        // Busca otimizada: buscar todas as imagens de uma vez
        const query = `mimeType contains 'image/' and trashed=false`;
        const allFiles = [];
        let pageToken = null;

        do {
            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'nextPageToken, files(id, name, description, modifiedTime, thumbnailLink, webContentLink)',
                pageSize: 1000,
                spaces: 'drive',
                orderBy: 'modifiedTime desc'
            });

            // Filtrar apenas imagens que pertencem ao banco de dados
            const validFiles = response.result.files.filter(file => 
                file.description && file.description.includes('dados_pessoais')
            );
            
            allFiles.push(...validFiles);
            pageToken = response.result.nextPageToken;

        } while (pageToken);

        return allFiles;
    }

    async getFoldersInFolder(parentId) {
        const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const response = await gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 100
        });
        
        return response.result.files || [];
    }

    async getImagesInFolder(folderId) {
        const allFiles = [];
        let pageToken = null;

        do {
            const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`;
            
            const params = {
                q: query,
                fields: 'nextPageToken, files(id, name, description, webContentLink, thumbnailLink)',
                spaces: 'drive',
                pageSize: 100
            };

            if (pageToken) {
                params.pageToken = pageToken;
            }

            const response = await gapi.client.drive.files.list(params);
            allFiles.push(...response.result.files);
            pageToken = response.result.nextPageToken;

        } while (pageToken);

        return allFiles;
    }

    async getAllRecords() {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const rootId = await this.setupFolderStructure();
        const allFiles = [];
        let pageToken = null;

        do {
            const query = `mimeType contains 'image/' and trashed=false`;
            
            const params = {
                q: query,
                fields: 'nextPageToken, files(id, name, description, webViewLink, createdTime, parents)',
                spaces: 'drive',
                pageSize: 100,
                orderBy: 'createdTime desc'
            };

            if (pageToken) {
                params.pageToken = pageToken;
            }

            const response = await gapi.client.drive.files.list(params);
            
            const filesWithMetadata = response.result.files
                .filter(file => file.description && file.name)
                .map(file => {
                    try {
                        return {
                            ...file,
                            metadata: JSON.parse(file.description)
                        };
                    } catch {
                        return null;
                    }
                })
                .filter(file => file !== null);

            allFiles.push(...filesWithMetadata);
            pageToken = response.result.nextPageToken;

        } while (pageToken);

        return allFiles;
    }

    async downloadImage(fileId) {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao baixar imagem');
        }

        return await response.blob();
    }
    
    async deleteFile(fileId) {
        if (!this.isAuthenticated()) {
            throw new Error('Não autenticado no Google Drive');
        }

        const response = await gapi.client.drive.files.delete({
            fileId: fileId
        });

        return response;
    }

    // Sistema de cache de descritores
    getCachedDescriptor(fileId, modifiedTime) {
        try {
            const cacheKey = `desc_${fileId}_${modifiedTime}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                // Reconstruir Float32Array do descriptor
                if (data.descriptor) {
                    data.descriptor = new Float32Array(data.descriptor);
                }
                return data;
            }
        } catch (error) {
            console.warn('Erro ao ler cache:', error);
        }
        return null;
    }

    setCachedDescriptor(fileId, modifiedTime, data) {
        try {
            const cacheKey = `desc_${fileId}_${modifiedTime}`;
            // Converter Float32Array para array normal para serialização
            const cacheData = {
                ...data,
                descriptor: data.descriptor ? Array.from(data.descriptor) : null
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Erro ao salvar cache (localStorage cheio?):', error);
            // Se localStorage estiver cheio, limpar caches antigos
            this.clearOldCache();
        }
    }

    clearOldCache() {
        try {
            const keys = Object.keys(localStorage);
            const descKeys = keys.filter(k => k.startsWith('desc_'));
            // Remover 20% dos caches mais antigos
            const toRemove = Math.ceil(descKeys.length * 0.2);
            for (let i = 0; i < toRemove; i++) {
                localStorage.removeItem(descKeys[i]);
            }
        } catch (error) {
            console.warn('Erro ao limpar cache:', error);
        }
    }

    clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.filter(k => k.startsWith('desc_')).forEach(k => localStorage.removeItem(k));
            console.log('Cache de descritores limpo');
        } catch (error) {
            console.warn('Erro ao limpar cache:', error);
        }
    }
}

const driveManager = new GoogleDriveManager();

// Exportar para uso global
window.driveManager = driveManager;
