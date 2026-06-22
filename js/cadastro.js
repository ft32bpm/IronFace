// Cadastro de Abordados
class CadastroManager {
    constructor() {
        this.currentImage = null;
        this.currentImageFile = null;
        this.setupEventListeners();
        this.setupCPFMask();
    }

    formatCPF(cpf) {
        const numbers = cpf.replace(/\D/g, '');
        if (numbers.length !== 11) return cpf;
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    setupCPFMask() {
        const cpfInputs = document.querySelectorAll('[name="cpf"], #filtro-cpf');
        cpfInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) value = value.slice(0, 11);
                if (value.length === 11) {
                    e.target.value = this.formatCPF(value);
                }
            });
            input.addEventListener('blur', (e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length === 11) {
                    e.target.value = this.formatCPF(value);
                }
            });
        });
    }

    setupEventListeners() {
        document.getElementById('connect-drive-btn')?.addEventListener('click', () => this.connectDrive());
        document.getElementById('disconnect-drive-btn')?.addEventListener('click', () => this.disconnectDrive());
        document.getElementById('forget-credentials-btn')?.addEventListener('click', () => this.forgetCredentials());
        document.getElementById('foto-input')?.addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('cadastro-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('aplicar-filtros-btn')?.addEventListener('click', () => this.searchWithFilters());
        document.getElementById('limpar-filtros-btn')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('toggle-auto-fill-btn')?.addEventListener('click', () => this.toggleAutoFill());
        
        this.setupImageTransfer();
        this.updateConnectionStatus();
    }

    async toggleAutoFill() {
        const { value: text } = await Swal.fire({
            title: 'Preenchimento Automático',
            html: '<textarea id="swal-input-autofill" class="swal2-textarea" placeholder="Cole aqui os dados do sistema (RG, Nome, Pai/Mãe, Naturalidade, Data Nascimento, CPF, Altura, Cor pele, Cor olhos, Tatuagens)" rows="10" style="width:100%; max-width:100%; font-size:14px; font-family:monospace; resize:vertical; box-sizing:border-box;"></textarea>',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Preencher',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff',
            cancelButtonColor: '#6c757d',
            customClass: {
                popup: 'swal-modern-popup',
                title: 'swal-modern-title',
                htmlContainer: 'swal-modern-html',
                confirmButton: 'swal-modern-button',
                cancelButton: 'swal-modern-button'
            },
            width: '600px',
            padding: '2rem',
            backdrop: 'rgba(0, 0, 0, 0.8)',
            preConfirm: () => {
                return document.getElementById('swal-input-autofill').value;
            }
        });

        if (text && text.trim()) {
            this.autoFillFormWithText(text);
        }
    }

    setupImageTransfer() {
        const preview = document.getElementById('foto-preview');
        if (!preview) return;

        // Drag and drop
        preview.addEventListener('dragover', (e) => {
            e.preventDefault();
            preview.style.borderColor = 'var(--color-primary)';
            preview.style.backgroundColor = 'rgba(var(--color-primary-rgb), 0.05)';
        });

        preview.addEventListener('dragleave', () => {
            preview.style.borderColor = '';
            preview.style.backgroundColor = '';
        });

        preview.addEventListener('drop', (e) => {
            e.preventDefault();
            preview.style.borderColor = '';
            preview.style.backgroundColor = '';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.processImageFile(file);
            }
        });

        // Paste (Ctrl+V)
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) this.processImageFile(file);
                    break;
                }
            }
        });
    }

    autoFillFormWithText(text) {
        if (!text.trim()) return;

        try {
            let preenchidos = [];

            // Extrair RG primeiro (vários formatos possíveis)
            // 1. Formato "RG/UF: 2111784548" (com estado)
            // 2. Formato "RG: 4129023646" (sem estado, apenas números)
            // Importante: capturar RG antes do CPF para evitar confusão
            let rgMatch = text.match(/RG(?:\/[A-Z]{2})?[:\s]*(\d{7,10})(?![\.\d])/i);
            if (rgMatch && rgMatch[1].trim()) {
                document.querySelector('[name="rg"]').value = rgMatch[1].trim();
                preenchidos.push('RG');
            }

            // Extrair CPF (sempre tem formatação com pontos)
            // 1. Formato com pontos e barra: 874.146.860/00
            // 2. Formato com pontos e hífen: 068.749.580-62
            // 3. Pode vir após "RG:" ou "CPF:"
            let cpfMatch = text.match(/(?:RG|CPF)[:\s]*(\d{3}\.\d{3}\.\d{3}[\/\-]\d{2})/i);
            if (cpfMatch && cpfMatch[1].trim()) {
                const cpfFormatted = cpfMatch[1].trim().replace('/', '-');
                document.querySelector('[name="cpf"]').value = this.formatCPF(cpfFormatted);
                preenchidos.push('CPF');
            }

            // Extrair Nome
            const nomeMatch = text.match(/Nome[:\s]*([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ][A-ZÀ-ÿ\s]+?)(?=\n|Pai|Mãe|Naturalidade|$)/i);
            if (nomeMatch) {
                document.querySelector('[name="nome_completo"]').value = nomeMatch[1].trim();
                preenchidos.push('Nome');
            }

            // Extrair Pai e Mãe
            const filiacaoMatch = text.match(/Pai\/Mãe[:\s]*([^\n]+)/i);
            if (filiacaoMatch) {
                const pais = filiacaoMatch[1].split('/');
                if (pais.length >= 2) {
                    const pai = pais[0].trim();
                    const mae = pais[1].trim();
                    if (pai) {
                        document.querySelector('[name="filiacao_pai"]').value = pai;
                        preenchidos.push('Pai');
                    }
                    if (mae) {
                        document.querySelector('[name="filiacao_mae"]').value = mae;
                        preenchidos.push('Mãe');
                    }
                }
            }

            // Extrair Município/UF (ENDEREÇO - tem prioridade sobre naturalidade)
            const municipioMatch = text.match(/Município\s*\/\s*UF[:\s]*([A-Za-zÀ-ÿ\s]+?)\s+([A-Z]{2})(?=\s*\n|\s*$|\s*\t)/i);
            if (municipioMatch) {
                const cidade = municipioMatch[1].trim();
                const estado = municipioMatch[2].trim();
                if (cidade) document.querySelector('[name="cidade"]').value = cidade;
                if (estado) document.querySelector('[name="estado"]').value = estado;
                preenchidos.push('Município (Endereço)');
            }

            // Extrair Naturalidade (apenas se NÃO tiver município)
            if (!municipioMatch) {
                const naturalidadeMatch = text.match(/Naturalidade[:\s]*([A-Za-zÀ-ÿ\s]+?)\s*([A-Z]{2})(?=\s|\n|Data)/i);
                if (naturalidadeMatch) {
                    const cidade = naturalidadeMatch[1].trim();
                    const estado = naturalidadeMatch[2].trim();
                    if (cidade) document.querySelector('[name="cidade"]').value = cidade;
                    if (estado) document.querySelector('[name="estado"]').value = estado;
                    preenchidos.push('Naturalidade (como endereço)');
                }
            }

            // Extrair Data de Nascimento
            const dataNascMatch = text.match(/Data\s+Nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
            if (dataNascMatch) {
                const [dia, mes, ano] = dataNascMatch[1].split('/');
                document.querySelector('[name="data_nascimento"]').value = `${ano}-${mes}-${dia}`;
                preenchidos.push('Data de Nascimento');
            }

            // Extrair Altura
            const alturaMatch = text.match(/Altura[:\s]*([\d,]+)\s*metros?/i);
            if (alturaMatch) {
                document.querySelector('[name="altura"]').value = alturaMatch[1].replace(',', '.') + 'm';
                preenchidos.push('Altura');
            }

            // Extrair Cor da Pele
            const corPeleMatch = text.match(/Cor\s+pele[:\s]*(Branca|Parda|Preta|Amarela|Indígena)/i);
            if (corPeleMatch) {
                document.querySelector('[name="cor_pele"]').value = corPeleMatch[1].trim();
                preenchidos.push('Cor da Pele');
            }

            // Extrair Cor dos Olhos
            const corOlhosMatch = text.match(/Cor\s+olhos[:\s]*(Castanhos?|Pretos?|Azuis?|Verdes?|Mel)/i);
            if (corOlhosMatch) {
                let cor = corOlhosMatch[1].trim();
                const normalizacao = {
                    'castanho': 'Castanhos',
                    'preto': 'Pretos',
                    'azul': 'Azuis',
                    'verde': 'Verdes'
                };
                cor = normalizacao[cor.toLowerCase()] || cor;
                document.querySelector('[name="cor_olhos"]').value = cor;
                preenchidos.push('Cor dos Olhos');
            }

            // Extrair Tatuagens
            const tatuagensMatch = text.match(/Tatuagens[:\s]*([^\n]+)/i);
            if (tatuagensMatch) {
                const tatuagens = tatuagensMatch[1].trim();
                if (tatuagens && tatuagens.toLowerCase() !== 'não' && tatuagens.toLowerCase() !== 'nao') {
                    document.querySelector('[name="tatuagens"]').value = tatuagens;
                    preenchidos.push('Tatuagens');
                }
            }

            // Extrair Endereço (Logradouro)
            const enderecoMatch = text.match(/Endereço[:\s]*([^\n]+)/i);
            if (enderecoMatch) {
                const endereco = enderecoMatch[1].trim();
                if (endereco && endereco.toLowerCase() !== 'não consta') {
                    document.querySelector('[name="logradouro"]').value = endereco;
                    preenchidos.push('Endereço');
                }
            }

            // Extrair Bairro
            const bairroMatch = text.match(/Bairro[:\s]*([A-Za-zÀ-ÿ\s]+?)(?=\t|Município|\n|$)/i);
            if (bairroMatch) {
                const bairro = bairroMatch[1].trim();
                if (bairro && bairro.toLowerCase() !== 'não consta') {
                    document.querySelector('[name="bairro"]').value = bairro;
                    preenchidos.push('Bairro');
                }
            }

            // Extrair Município/UF (ENDEREÇO - tem prioridade sobre naturalidade)

            // Extrair Nacionalidade
            const nacionalidadeMatch = text.match(/Nacionalidade[:\s]*([A-Za-zÀ-ÿ\s]+?)(?=\t|Sexo|\n|$)/i);
            if (nacionalidadeMatch) {
                const nacionalidade = nacionalidadeMatch[1].trim();
                if (nacionalidade) {
                    // Pode adicionar campo de nacionalidade se existir no formulário
                    preenchidos.push('Nacionalidade');
                }
            }

            if (preenchidos.length > 0) {
                Swal.fire({
                    icon: 'success',
                    title: 'Dados preenchidos!',
                    html: `<strong>Campos preenchidos:</strong> ${preenchidos.join(', ')}<br><br>Verifique os campos e complete as informações faltantes.`,
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Nenhum dado identificado',
                    text: 'Nenhum dado foi identificado no texto. Verifique se o formato está correto.',
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            }

        } catch (error) {
            console.error('Erro ao processar dados:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao processar',
                text: 'Erro ao processar os dados. Verifique o formato do texto colado.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        }
    }

    processImageFile(file) {
        this.currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            document.getElementById('foto-preview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }

    updateConnectionStatus() {
        const isConnected = driveManager.isAuthenticated();
        const hasSavedCredentials = localStorage.getItem('gdrive_client_id') && localStorage.getItem('gdrive_api_key');
        const driveContainer = document.getElementById('drive-status-container');
        const driveStatus = document.getElementById('drive-status-unified');
        const statusConfig = document.getElementById('drive-status');
        const connectBtn = document.getElementById('connect-drive-btn');
        const disconnectBtn = document.getElementById('disconnect-drive-btn');
        const forgetBtn = document.getElementById('forget-credentials-btn');

        if (isConnected) {
            // Status unificado no header
            if (driveContainer && driveStatus) {
                driveContainer.classList.remove('status-loading', 'status-warning', 'status-disconnected');
                driveContainer.classList.add('status-success');
                driveStatus.textContent = 'Conectado';
                
                const icon = driveContainer.querySelector('.status-icon');
                icon.setAttribute('data-lucide', 'check-circle');
                setTimeout(() => lucide.createIcons(), 0);
            }
            
            // Status na aba de configurações
            if (statusConfig) {
                statusConfig.innerHTML = '<i data-lucide="check-circle" style="width:14px; height:14px;"></i> Conectado ao Google Drive';
                statusConfig.className = 'status-indicator status-connected';
                setTimeout(() => lucide.createIcons(), 0);
            }
            
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'block';
            if (forgetBtn) forgetBtn.style.display = 'block';
        } else {
            // Status unificado no header
            if (driveContainer && driveStatus) {
                driveContainer.classList.remove('status-loading', 'status-success');
                
                if (hasSavedCredentials) {
                    driveContainer.classList.add('status-warning');
                    driveStatus.textContent = 'Credenciais salvas';
                    
                    const icon = driveContainer.querySelector('.status-icon');
                    icon.setAttribute('data-lucide', 'alert-circle');
                } else {
                    driveContainer.classList.add('status-disconnected');
                    driveStatus.textContent = 'Não conectado';
                    
                    const icon = driveContainer.querySelector('.status-icon');
                    icon.setAttribute('data-lucide', 'cloud-off');
                }
                
                setTimeout(() => lucide.createIcons(), 0);
            }
            
            // Status na aba de configurações
            if (statusConfig) {
                statusConfig.innerHTML = hasSavedCredentials 
                    ? '<i data-lucide="alert-circle" style="width:14px; height:14px;"></i> Credenciais salvas - Clique em Conectar' 
                    : '<i data-lucide="x-circle" style="width:14px; height:14px;"></i> Não conectado';
                statusConfig.className = hasSavedCredentials ? 'status-indicator' : 'status-indicator status-disconnected';
                if (hasSavedCredentials) statusConfig.style.color = '#ffa500';
                setTimeout(() => lucide.createIcons(), 0);
            }
            
            if (connectBtn) {
                connectBtn.style.display = 'block';
                connectBtn.textContent = hasSavedCredentials ? 'Reconectar' : 'Conectar';
            }
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (forgetBtn) forgetBtn.style.display = hasSavedCredentials ? 'block' : 'none';
        }
    }

    async connectDrive() {
        const clientId = document.getElementById('client-id').value.trim();
        const apiKey = document.getElementById('api-key').value.trim();

        if (!clientId || !apiKey) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios',
                text: 'Por favor, preencha o Client ID e API Key',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        // Validação básica do formato
        if (!clientId.includes('.apps.googleusercontent.com')) {
            Swal.fire({
                icon: 'error',
                title: 'Client ID inválido',
                text: 'Client ID inválido. Deve terminar com ".apps.googleusercontent.com"',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        if (apiKey.length < 30) {
            Swal.fire({
                icon: 'error',
                title: 'API Key inválida',
                text: 'API Key parece inválida. Verifique se copiou corretamente.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        try {
            const connectBtn = document.getElementById('connect-drive-btn');
            connectBtn.disabled = true;
            connectBtn.textContent = 'Conectando...';

            console.log('Iniciando conexão com Google Drive...');
            console.log('Client ID:', clientId.substring(0, 20) + '...');
            console.log('API Key:', apiKey.substring(0, 10) + '...');
            
            await driveManager.initialize(clientId, apiKey);
            console.log('Google Drive API inicializada');
            
            const success = await driveManager.authenticate();
            console.log('Autenticação resultado:', success);

            if (success) {
                localStorage.setItem('gdrive_client_id', clientId);
                localStorage.setItem('gdrive_api_key', apiKey);
                this.updateConnectionStatus();
                Swal.fire({
                    icon: 'success',
                    title: 'Conectado!',
                    text: 'Conectado com sucesso ao Google Drive!',
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Falha ao conectar',
                    html: 'Falha ao conectar. Verifique:<br><br>1. Client ID e API Key estão corretos<br>2. Google Drive API está ativada no projeto<br>3. URIs autorizadas incluem sua URL atual<br><br>Abra o Console (F12) para mais detalhes.',
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            }
        } catch (error) {
            console.error('Erro ao conectar:', error);
            let errorMsg = 'Erro ao conectar: ' + error.message;
            
            if (error.message.includes('GAPI')) {
                errorMsg += '\n\nVerifique sua conexão com a internet.';
            } else if (error.message.includes('Identity')) {
                errorMsg += '\n\nProblema ao carregar Google Identity Services.';
            }
            
            errorMsg += '\n\nAbra o Console (F12) para mais detalhes.';
            Swal.fire({
                icon: 'error',
                title: 'Erro ao conectar',
                text: errorMsg,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } finally {
            const connectBtn = document.getElementById('connect-drive-btn');
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Conectar';
            }
        }
    }

    disconnectDrive() {
        Swal.fire({
            title: 'Desconectar?',
            text: 'Deseja desconectar do Google Drive? Suas credenciais serão mantidas para reconexão automática.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, desconectar',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                driveManager.disconnect();
                this.updateConnectionStatus();
                Swal.fire({
                    icon: 'success',
                    title: 'Desconectado!',
                    text: 'Desconectado com sucesso! Suas credenciais foram mantidas.',
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            }
        });
    }

    forgetCredentials() {
        Swal.fire({
            title: 'Esquecer credenciais?',
            text: 'Deseja ESQUECER as credenciais salvas? Você precisará inserir o Client ID e API Key novamente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, esquecer',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('gdrive_client_id');
                localStorage.removeItem('gdrive_api_key');
                localStorage.removeItem('gdrive_token');
                localStorage.removeItem('gdrive_token_expiry');
                localStorage.removeItem('gdrive_root_folder');
                
                document.getElementById('client-id').value = '';
                document.getElementById('api-key').value = '';
                
                driveManager.accessToken = null;
                this.updateConnectionStatus();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Credenciais esquecidas!',
                    text: 'Credenciais esquecidas com sucesso!',
                    background: '#1a1a1a',
                    color: '#e0e0e0',
                    confirmButtonColor: '#00d4ff'
                });
            }
        });
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.processImageFile(file);
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (!this.currentImageFile) {
            Swal.fire({
                icon: 'warning',
                title: 'Foto obrigatória',
                text: 'Por favor, selecione uma foto',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        if (!driveManager.isAuthenticated()) {
            Swal.fire({
                icon: 'warning',
                title: 'Não conectado',
                text: 'Conecte-se ao Google Drive primeiro',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        const formData = new FormData(event.target);
        
        // Verificar duplicatas antes de prosseguir (exceto se estiver editando)
        if (!this.editingRecordId) {
            const nome = formData.get('nome_completo');
            const rg = formData.get('rg');
            const cpf = this.formatCPF(formData.get('cpf'));
            
            const duplicata = await this.checkDuplicates(nome, rg, cpf);
            if (duplicata) {
                const shouldContinue = await this.showDuplicateDialog(duplicata);
                if (!shouldContinue) {
                    return;
                }
                this.editingRecordId = duplicata.id;
            }
        }
        
        // Validar cidade obrigatória
        const cidade = formData.get('cidade');
        if (!cidade || cidade.trim() === '') {
            Swal.fire({
                icon: 'warning',
                title: 'Cidade obrigatória',
                text: 'O campo Cidade é obrigatório para organizar os cadastros',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }
        
        const metadata = {
            dados_pessoais: {
                nome_completo: formData.get('nome_completo'),
                rg: formData.get('rg'),
                cpf: this.formatCPF(formData.get('cpf')),
                data_nascimento: formData.get('data_nascimento'),
                filiacao_mae: formData.get('filiacao_mae'),
                filiacao_pai: formData.get('filiacao_pai'),
                alcunha: formData.get('alcunha')
            },
            endereco: {
                logradouro: formData.get('logradouro'),
                bairro: formData.get('bairro'),
                cidade: formData.get('cidade'),
                estado: formData.get('estado'),
                cep: formData.get('cep')
            },
            caracteristicas: {
                altura: formData.get('altura'),
                cor_pele: formData.get('cor_pele'),
                cor_olhos: formData.get('cor_olhos'),
                tatuagens: formData.get('tatuagens'),
                sinais_particulares: formData.get('sinais_particulares')
            },
            dados_abordagem: {
                data_abordagem: formData.get('data_abordagem'),
                local_abordagem: formData.get('local_abordagem'),
                local_cadastro: formData.get('local_cadastro'),
                policial_responsavel: formData.get('policial_responsavel'),
                observacoes: formData.get('observacoes')
            },
            tags: formData.getAll('tags')
        };

        try {
            document.getElementById('submit-btn').disabled = true;
            document.getElementById('submit-btn').textContent = 'Enviando...';

            // Se estiver editando, excluir o registro antigo primeiro
            if (this.editingRecordId) {
                await driveManager.deleteFile(this.editingRecordId);
            }

            const result = await driveManager.uploadImage(this.currentImageFile, metadata);

            Swal.fire({
                icon: 'success',
                title: this.editingRecordId ? 'Cadastro atualizado!' : 'Cadastro realizado!',
                html: `<strong>Arquivo:</strong> ${result.name}<br><strong>Link:</strong> <a href="${result.webViewLink}" target="_blank" style="color: #00d4ff;">Ver no Drive</a>`,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            
            event.target.reset();
            this.currentImage = null;
            this.currentImageFile = null;
            this.editingRecordId = null;
            this.editingRecordImage = null;
            document.getElementById('foto-preview').innerHTML = '<div class="empty-preview">Nenhuma foto selecionada</div>';

        } catch (error) {
            console.error('Erro ao cadastrar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao cadastrar',
                text: 'Erro ao cadastrar: ' + error.message,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } finally {
            document.getElementById('submit-btn').disabled = false;
            document.getElementById('submit-btn').textContent = 'Cadastrar no Google Drive';
        }
    }

    async checkDuplicates(nome, rg, cpf) {
        try {
            const allRecords = await driveManager.getAllRecords();
            
            if (cpf && cpf.trim() !== '') {
                const cpfMatch = allRecords.find(record => {
                    const recordCpf = record.metadata?.dados_pessoais?.cpf;
                    return recordCpf && recordCpf.replace(/\D/g, '') === cpf.replace(/\D/g, '');
                });
                if (cpfMatch) return cpfMatch;
            }
            
            if (rg && rg.trim() !== '') {
                const rgMatch = allRecords.find(record => {
                    const recordRg = record.metadata?.dados_pessoais?.rg;
                    return recordRg && recordRg.replace(/\D/g, '') === rg.replace(/\D/g, '');
                });
                if (rgMatch) return rgMatch;
            }
            
            if (nome && nome.trim() !== '') {
                const nomeNormalizado = nome.trim().toLowerCase();
                const nomeMatch = allRecords.find(record => {
                    const recordNome = record.metadata?.dados_pessoais?.nome_completo;
                    return recordNome && recordNome.trim().toLowerCase() === nomeNormalizado;
                });
                if (nomeMatch) return nomeMatch;
            }
            
            return null;
        } catch (error) {
            console.error('Erro ao verificar duplicatas:', error);
            return null;
        }
    }

    async showDuplicateDialog(duplicata) {
        const meta = duplicata.metadata;
        const dataCadastro = new Date(duplicata.createdTime).toLocaleString('pt-BR');
        
        const result = await Swal.fire({
            title: '⚠️ Cadastro Existente Encontrado',
            html: `
                <div style="text-align:left; padding:var(--space-3);">
                    <div style="background:var(--color-surface-elevated); padding:var(--space-4); border-radius:var(--radius-md); margin-bottom:var(--space-4);">
                        <h4 style="margin:0 0 var(--space-3) 0; color:var(--color-primary); font-size:var(--font-size-base);">Dados do Cadastro Existente:</h4>
                        <div style="line-height:2; font-size:var(--font-size-sm);">
                            <div><strong>Nome:</strong> ${meta.dados_pessoais.nome_completo}</div>
                            <div><strong>CPF:</strong> ${meta.dados_pessoais.cpf}</div>
                            <div><strong>RG:</strong> ${meta.dados_pessoais.rg}</div>
                            ${meta.dados_pessoais.alcunha ? `<div><strong>Alcunha:</strong> "${meta.dados_pessoais.alcunha}"</div>` : ''}
                            <div><strong>Endereço:</strong> ${meta.endereco.logradouro || 'N/A'}, ${meta.endereco.bairro || 'N/A'}</div>
                            <div><strong>Cidade:</strong> ${meta.endereco.cidade}/${meta.endereco.estado}</div>
                            <div style="margin-top:var(--space-2); padding-top:var(--space-2); border-top:1px solid var(--color-border); color:var(--color-text-tertiary); font-size:var(--font-size-xs);">
                                <strong>Cadastrado em:</strong> ${dataCadastro}
                            </div>
                        </div>
                    </div>
                    
                    <div style="background:rgba(255, 193, 7, 0.1); border-left:3px solid #ffc107; padding:var(--space-3); border-radius:var(--radius-sm); margin-bottom:var(--space-3);">
                        <p style="margin:0; font-size:var(--font-size-sm); color:var(--color-text-secondary);">
                            <strong style="color:#ffc107;">⚠️ Atenção:</strong> Já existe um cadastro com esses dados.
                        </p>
                    </div>
                    
                    <div style="font-size:var(--font-size-sm); color:var(--color-text-secondary); line-height:1.8;">
                        <p style="margin-bottom:var(--space-2);"><strong>O que deseja fazer?</strong></p>
                        <ul style="margin-left:20px;">
                            <li><strong>Substituir:</strong> O cadastro antigo será excluído e substituído pelos novos dados</li>
                            <li><strong>Cancelar:</strong> Manter o cadastro existente e não salvar os novos dados</li>
                        </ul>
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Substituir Cadastro',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#6c757d',
            width: '600px',
            customClass: {
                popup: 'swal-modern-popup',
                title: 'swal-modern-title',
                htmlContainer: 'swal-modern-html',
                confirmButton: 'swal-modern-button',
                cancelButton: 'swal-modern-button'
            }
        });
        
        return result.isConfirmed;
    }

    async searchByCPF() {
        const cpf = document.getElementById('busca-cpf').value.trim();
        if (!cpf) {
            Swal.fire({
                icon: 'info',
                title: 'CPF obrigatório',
                text: 'Digite um CPF para buscar',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        if (!driveManager.isAuthenticated()) {
            Swal.fire({
                icon: 'warning',
                title: 'Não conectado',
                text: 'Conecte-se ao Google Drive primeiro',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        try {
            document.getElementById('buscar-cpf-btn').disabled = true;
            document.getElementById('buscar-cpf-btn').textContent = 'Buscando...';

            const results = await driveManager.searchByCPF(cpf);
            this.displaySearchResults(results);

        } catch (error) {
            console.error('Erro ao buscar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao buscar',
                text: 'Erro ao buscar: ' + error.message,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } finally {
            document.getElementById('buscar-cpf-btn').disabled = false;
            document.getElementById('buscar-cpf-btn').textContent = 'Buscar';
        }
    }

    async searchByName() {
        const nome = document.getElementById('busca-nome').value.trim();
        if (!nome) {
            Swal.fire({
                icon: 'info',
                title: 'Nome obrigatório',
                text: 'Digite um nome para buscar',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        if (!driveManager.isAuthenticated()) {
            Swal.fire({
                icon: 'warning',
                title: 'Não conectado',
                text: 'Conecte-se ao Google Drive primeiro',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }

        try {
            document.getElementById('buscar-nome-btn').disabled = true;
            document.getElementById('buscar-nome-btn').textContent = 'Buscando...';

            const results = await driveManager.searchByName(nome);
            this.displaySearchResults(results);

        } catch (error) {
            console.error('Erro ao buscar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao buscar',
                text: 'Erro ao buscar: ' + error.message,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } finally {
            document.getElementById('buscar-nome-btn').disabled = false;
            document.getElementById('buscar-nome-btn').textContent = 'Buscar';
        }
    }

    displaySearchResults(results) {
        const container = document.getElementById('search-results');
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum resultado encontrado</div>';
            return;
        }

        container.innerHTML = results.map(result => {
            const meta = result.metadata;
            const date = new Date(result.createdTime).toLocaleString('pt-BR');
            
            return `
                <div class="search-result-item">
                    <div class="result-header">
                        <strong>${meta.dados_pessoais.nome_completo}</strong>
                        <span class="result-date">${date}</span>
                    </div>
                    <div class="result-info">
                        <p><strong>CPF:</strong> ${meta.dados_pessoais.cpf}</p>
                        <p><strong>RG:</strong> ${meta.dados_pessoais.rg}</p>
                        <p><strong>Alcunha:</strong> ${meta.dados_pessoais.alcunha || 'N/A'}</p>
                        <p><strong>Endereço:</strong> ${meta.endereco.logradouro}, ${meta.endereco.bairro} - ${meta.endereco.cidade}/${meta.endereco.estado}</p>
                        <p><strong>Características:</strong> ${meta.caracteristicas.altura} | ${meta.caracteristicas.cor_pele} | ${meta.caracteristicas.cor_olhos}</p>
                        <p><strong>Data Abordagem:</strong> ${meta.dados_abordagem.data_abordagem}</p>
                        <p><strong>Local Abordagem:</strong> ${meta.dados_abordagem.local_abordagem}</p>
                        <p><strong>Local Cadastro:</strong> ${meta.dados_abordagem.local_cadastro}</p>
                        <p><strong>Policial:</strong> ${meta.dados_abordagem.policial_responsavel}</p>
                    </div>
                    <a href="${result.webViewLink}" target="_blank" class="btn-view-drive">Ver no Google Drive</a>
                </div>
            `;
        }).join('');
    }

    clearFilters() {
        document.getElementById('filtro-nome').value = '';
        document.getElementById('filtro-cpf').value = '';
        document.getElementById('filtro-rg').value = '';
        document.getElementById('filtro-alcunha').value = '';
        document.getElementById('filtro-bairro').value = '';
        document.getElementById('filtro-cidade').value = '';
        document.getElementById('filtro-estado').value = '';
        document.getElementById('filtro-cor-pele').value = '';
        document.getElementById('filtro-cor-olhos').value = '';
        document.getElementById('filtro-tatuagens').value = '';
        document.getElementById('filtro-data-inicio').value = '';
        document.getElementById('filtro-data-fim').value = '';
        document.getElementById('filtro-tag').value = '';
        
        document.getElementById('consulta-results').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="search" style="width:48px; height:48px;"></i></div>
                <div class="empty-state-text">Utilize os filtros para buscar</div>
                <div class="empty-state-hint">Preencha um ou mais campos e clique em "Buscar"</div>
            </div>
        `;
        setTimeout(() => lucide.createIcons(), 0);
        document.getElementById('results-count').textContent = '0 registros encontrados';
    }

    async searchWithFilters() {
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

        const filters = {
            nome: document.getElementById('filtro-nome').value.trim().toLowerCase(),
            cpf: document.getElementById('filtro-cpf').value.trim(),
            rg: document.getElementById('filtro-rg').value.trim(),
            alcunha: document.getElementById('filtro-alcunha').value.trim().toLowerCase(),
            bairro: document.getElementById('filtro-bairro').value.trim().toLowerCase(),
            cidade: document.getElementById('filtro-cidade').value.trim().toLowerCase(),
            estado: document.getElementById('filtro-estado').value,
            cor_pele: document.getElementById('filtro-cor-pele').value,
            cor_olhos: document.getElementById('filtro-cor-olhos').value,
            tatuagens: document.getElementById('filtro-tatuagens').value.trim().toLowerCase(),
            data_inicio: document.getElementById('filtro-data-inicio').value,
            data_fim: document.getElementById('filtro-data-fim').value,
            tag: document.getElementById('filtro-tag').value
        };

        try {
            const btn = document.getElementById('aplicar-filtros-btn');
            btn.disabled = true;
            btn.textContent = 'Buscando...';

            const allResults = await driveManager.getAllRecords();
            const filtered = allResults.filter(record => {
                const meta = record.metadata;
                
                if (filters.nome && !meta.dados_pessoais.nome_completo.toLowerCase().includes(filters.nome)) return false;
                if (filters.cpf && !meta.dados_pessoais.cpf.includes(filters.cpf)) return false;
                if (filters.rg && !meta.dados_pessoais.rg.includes(filters.rg)) return false;
                if (filters.alcunha && !meta.dados_pessoais.alcunha?.toLowerCase().includes(filters.alcunha)) return false;
                if (filters.bairro && !meta.endereco.bairro.toLowerCase().includes(filters.bairro)) return false;
                if (filters.cidade && !meta.endereco.cidade.toLowerCase().includes(filters.cidade)) return false;
                if (filters.estado && meta.endereco.estado !== filters.estado) return false;
                if (filters.cor_pele && meta.caracteristicas.cor_pele !== filters.cor_pele) return false;
                if (filters.cor_olhos && meta.caracteristicas.cor_olhos !== filters.cor_olhos) return false;
                if (filters.tatuagens && !meta.caracteristicas.tatuagens?.toLowerCase().includes(filters.tatuagens)) return false;
                if (filters.tag && (!meta.tags || !meta.tags.includes(filters.tag))) return false;
                
                if (filters.data_inicio || filters.data_fim) {
                    const dataAbordagem = new Date(meta.dados_abordagem.data_abordagem);
                    if (filters.data_inicio && dataAbordagem < new Date(filters.data_inicio)) return false;
                    if (filters.data_fim && dataAbordagem > new Date(filters.data_fim)) return false;
                }
                
                return true;
            });

            this.displayConsultaResults(filtered);

        } catch (error) {
            console.error('Erro ao buscar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao buscar',
                text: 'Erro ao buscar: ' + error.message,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } finally {
            const btn = document.getElementById('aplicar-filtros-btn');
            btn.disabled = false;
            btn.textContent = 'Buscar';
        }
    }

    displayConsultaResults(results) {
        this.allResults = results;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        
        const countEl = document.getElementById('results-count');
        countEl.textContent = `${results.length} registro${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
        
        if (results.length === 0) {
            document.getElementById('consulta-results').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i data-lucide="x-circle" style="width:48px; height:48px;"></i></div>
                    <div class="empty-state-text">Nenhum registro encontrado</div>
                    <div class="empty-state-hint">Tente ajustar os filtros de busca</div>
                </div>
            `;
            setTimeout(() => lucide.createIcons(), 0);
            return;
        }
        
        this.renderPage();
    }
    
    renderPage() {
        const container = document.getElementById('consulta-results');
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageResults = this.allResults.slice(start, end);
        const totalPages = Math.ceil(this.allResults.length / this.itemsPerPage);
        
        container.innerHTML = pageResults.map(result => {
            const meta = result.metadata;
            const date = new Date(result.createdTime).toLocaleString('pt-BR');
            const tags = meta.tags && meta.tags.length > 0 ? meta.tags.join(', ') : 'Sem ocorrências registradas';
            
            return `
                <div class="consulta-result-card-compact">
                    <div class="result-compact-image" data-file-id="${result.id}">
                        <div class="image-loading">Carregando...</div>
                    </div>
                    <div class="result-compact-info">
                        <h4>${meta.dados_pessoais.nome_completo}</h4>
                        <div class="result-compact-details">
                            <span><strong>CPF:</strong> ${meta.dados_pessoais.cpf}</span>
                            <span><strong>RG:</strong> ${meta.dados_pessoais.rg}</span>
                            ${meta.dados_pessoais.alcunha ? `<span><strong>Alcunha:</strong> "${meta.dados_pessoais.alcunha}"</span>` : ''}
                            <span><strong>Histórico:</strong> ${tags}</span>
                        </div>
                    </div>
                    <div class="result-compact-actions">
                        <button class="btn-view-details-modal" data-result-index="${this.allResults.indexOf(result)}">Ver Detalhes</button>
                        <button class="btn-edit-record" data-result-index="${this.allResults.indexOf(result)}" title="Editar cadastro"><i data-lucide="edit" style="width:16px; height:16px;"></i></button>
                        <button class="btn-delete-record" data-result-index="${this.allResults.indexOf(result)}" title="Excluir cadastro"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Adicionar paginação
        if (totalPages > 1) {
            container.innerHTML += `
                <div class="pagination">
                    <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="cadastroManager.goToPage(${this.currentPage - 1})">← Anterior</button>
                    <span class="pagination-info">Página ${this.currentPage} de ${totalPages}</span>
                    <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="cadastroManager.goToPage(${this.currentPage + 1})">Próxima →</button>
                </div>
            `;
        }
        
        // Carregar miniaturas
        pageResults.forEach(result => {
            this.loadThumbnail(result.id);
        });
        
        // Event listeners para ver detalhes
        document.querySelectorAll('.btn-view-details-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.resultIndex);
                this.showDetailsModal(this.allResults[index]);
            });
        });
        
        // Event listeners para editar
        document.querySelectorAll('.btn-edit-record').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('.btn-edit-record');
                const index = parseInt(target.dataset.resultIndex);
                this.editRecord(this.allResults[index]);
            });
        });
        
        // Event listeners para excluir
        document.querySelectorAll('.btn-delete-record').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('.btn-delete-record');
                const index = parseInt(target.dataset.resultIndex);
                this.deleteRecord(this.allResults[index]);
            });
        });
        
        // Atualizar ícones Lucide
        setTimeout(() => lucide.createIcons(), 0);
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.renderPage();
        document.getElementById('consulta-results').scrollTop = 0;
    }
    
    async loadThumbnail(fileId) {
        const container = document.querySelector(`.result-compact-image[data-file-id="${fileId}"]`);
        if (!container) return;
        
        try {
            const blob = await driveManager.downloadImage(fileId);
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<img src="${url}" alt="Miniatura">`;
        } catch (error) {
            container.innerHTML = '<div class="image-error">❌</div>';
        }
    }
    
    async showDetailsModal(result) {
        const modal = document.getElementById('details-modal');
        const meta = result.metadata;
        
        // Armazenar resultado atual para uso no botão WhatsApp
        this.currentDetailResult = result;
        
        // Nome com botão copiar
        const nomeText = document.getElementById('details-nome-text');
        const nomeBtn = document.querySelector('#details-nome .btn-copy-field');
        nomeText.textContent = meta.dados_pessoais.nome_completo;
        nomeBtn.style.display = (meta.dados_pessoais.nome_completo && meta.dados_pessoais.nome_completo !== 'N/A') ? 'inline-flex' : 'none';
        
        document.getElementById('details-alcunha').textContent = meta.dados_pessoais.alcunha || 'N/A';
        
        // CPF com botão copiar
        const cpfText = document.getElementById('details-cpf-text');
        const cpfBtn = document.querySelector('#details-cpf .btn-copy-field');
        cpfText.textContent = meta.dados_pessoais.cpf;
        cpfBtn.style.display = (meta.dados_pessoais.cpf && meta.dados_pessoais.cpf !== 'N/A') ? 'inline-flex' : 'none';
        
        // RG com botão copiar
        const rgText = document.getElementById('details-rg-text');
        const rgBtn = document.querySelector('#details-rg .btn-copy-field');
        rgText.textContent = meta.dados_pessoais.rg;
        rgBtn.style.display = (meta.dados_pessoais.rg && meta.dados_pessoais.rg !== 'N/A') ? 'inline-flex' : 'none';
        
        document.getElementById('details-nascimento').textContent = new Date(meta.dados_pessoais.data_nascimento).toLocaleDateString('pt-BR');
        document.getElementById('details-mae').textContent = meta.dados_pessoais.filiacao_mae || 'N/A';
        document.getElementById('details-pai').textContent = meta.dados_pessoais.filiacao_pai || 'N/A';
        
        document.getElementById('details-endereco').textContent = `${meta.endereco.logradouro}, ${meta.endereco.bairro}`;
        document.getElementById('details-cidade').textContent = `${meta.endereco.cidade}/${meta.endereco.estado}`;
        document.getElementById('details-cep').textContent = meta.endereco.cep || 'N/A';
        
        document.getElementById('details-altura').textContent = meta.caracteristicas.altura || 'N/A';
        document.getElementById('details-cor-pele').textContent = meta.caracteristicas.cor_pele || 'N/A';
        document.getElementById('details-cor-olhos').textContent = meta.caracteristicas.cor_olhos || 'N/A';
        document.getElementById('details-tatuagens').textContent = meta.caracteristicas.tatuagens || 'N/A';
        document.getElementById('details-sinais').textContent = meta.caracteristicas.sinais_particulares || 'N/A';
        
        document.getElementById('details-data-abordagem').textContent = new Date(meta.dados_abordagem.data_abordagem).toLocaleDateString('pt-BR');
        document.getElementById('details-local-abordagem').textContent = meta.dados_abordagem.local_abordagem;
        document.getElementById('details-local-cadastro').textContent = meta.dados_abordagem.local_cadastro;
        document.getElementById('details-policial').textContent = meta.dados_abordagem.policial_responsavel;
        document.getElementById('details-observacoes').textContent = meta.dados_abordagem.observacoes || 'N/A';
        document.getElementById('details-data-cadastro').textContent = new Date(result.createdTime).toLocaleString('pt-BR');
        
        // Exibir tags
        const tagsText = meta.tags && meta.tags.length > 0 ? meta.tags.join(', ') : 'Sem ocorrências registradas';
        const tagsElement = document.getElementById('details-tags');
        if (tagsElement) {
            tagsElement.textContent = tagsText;
        }
        
        document.getElementById('details-drive-link').href = result.webViewLink;
        
        // Carregar imagem com foco no rosto
        const imgContainer = document.getElementById('details-image');
        imgContainer.innerHTML = '<div class="image-loading">Carregando imagem...</div>';
        
        try {
            const blob = await driveManager.downloadImage(result.id);
            const url = URL.createObjectURL(blob);
            imgContainer.innerHTML = `<img src="${url}" alt="Foto" class="details-face-image">`;
        } catch (error) {
            imgContainer.innerHTML = '<div class="image-error">Erro ao carregar imagem</div>';
        }
        
        // Mostrar modal primeiro, depois atualizar ícones
        modal.style.display = 'flex';
        
        // Atualizar ícones após o modal estar visível
        setTimeout(() => lucide.createIcons(), 50);
    }
    
    editRecord(result) {
        Swal.fire({
            title: 'Editar Cadastro',
            html: `
                <div style="text-align:left;">
                    <p><strong>Nome:</strong> ${result.metadata.dados_pessoais.nome_completo}</p>
                    <p><strong>CPF:</strong> ${result.metadata.dados_pessoais.cpf}</p>
                    <p style="margin-top:20px; color:#ffa500;">⚠️ Para editar, você será redirecionado para a aba de cadastro com os dados preenchidos.</p>
                    <p style="margin-top:10px; color:#00d4ff;">ℹ️ A foto atual será mantida, a menos que você selecione uma nova.</p>
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Ir para Edição',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff',
            cancelButtonColor: '#6c757d'
        }).then(async (res) => {
            if (res.isConfirmed) {
                await this.fillFormForEdit(result);
                document.querySelector('[data-tab="pessoas"]').click();
            }
        });
    }
    
    async fillFormForEdit(result) {
        const meta = result.metadata;
        
        // Armazenar ID do registro sendo editado e a foto atual
        this.editingRecordId = result.id;
        this.editingRecordImage = result.id; // Guardar ID da imagem original
        
        document.querySelector('[name="nome_completo"]').value = meta.dados_pessoais.nome_completo || '';
        document.querySelector('[name="alcunha"]').value = meta.dados_pessoais.alcunha || '';
        document.querySelector('[name="rg"]').value = meta.dados_pessoais.rg || '';
        document.querySelector('[name="cpf"]').value = this.formatCPF(meta.dados_pessoais.cpf || '');
        document.querySelector('[name="data_nascimento"]').value = meta.dados_pessoais.data_nascimento || '';
        document.querySelector('[name="filiacao_mae"]').value = meta.dados_pessoais.filiacao_mae || '';
        document.querySelector('[name="filiacao_pai"]').value = meta.dados_pessoais.filiacao_pai || '';
        
        document.querySelector('[name="logradouro"]').value = meta.endereco.logradouro || '';
        document.querySelector('[name="bairro"]').value = meta.endereco.bairro || '';
        document.querySelector('[name="cidade"]').value = meta.endereco.cidade || '';
        document.querySelector('[name="estado"]').value = meta.endereco.estado || '';
        document.querySelector('[name="cep"]').value = meta.endereco.cep || '';
        
        document.querySelector('[name="altura"]').value = meta.caracteristicas.altura || '';
        document.querySelector('[name="cor_pele"]').value = meta.caracteristicas.cor_pele || '';
        document.querySelector('[name="cor_olhos"]').value = meta.caracteristicas.cor_olhos || '';
        document.querySelector('[name="tatuagens"]').value = meta.caracteristicas.tatuagens || '';
        document.querySelector('[name="sinais_particulares"]').value = meta.caracteristicas.sinais_particulares || '';
        
        document.querySelector('[name="data_abordagem"]').value = meta.dados_abordagem.data_abordagem || '';
        document.querySelector('[name="policial_responsavel"]').value = meta.dados_abordagem.policial_responsavel || '';
        document.querySelector('[name="local_abordagem"]').value = meta.dados_abordagem.local_abordagem || '';
        document.querySelector('[name="local_cadastro"]').value = meta.dados_abordagem.local_cadastro || '';
        document.querySelector('[name="observacoes"]').value = meta.dados_abordagem.observacoes || '';
        
        // Preencher tags
        document.querySelectorAll('[name="tags"]').forEach(checkbox => {
            checkbox.checked = meta.tags && meta.tags.includes(checkbox.value);
        });
        
        // Carregar e exibir a foto atual
        try {
            const blob = await driveManager.downloadImage(result.id);
            const url = URL.createObjectURL(blob);
            
            // Converter blob para File para usar no upload
            const file = new File([blob], 'foto_atual.jpg', { type: blob.type });
            this.currentImageFile = file;
            this.currentImage = url;
            
            document.getElementById('foto-preview').innerHTML = `<img src="${url}" alt="Preview">`;
            
            Swal.fire({
                icon: 'success',
                title: 'Formulário Preenchido',
                html: 'Dados e foto carregados! <strong>Importante:</strong> Após editar, clique em "Cadastrar" para salvar as alterações. O cadastro antigo será substituído.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        } catch (error) {
            console.error('Erro ao carregar foto:', error);
            Swal.fire({
                icon: 'warning',
                title: 'Formulário Preenchido',
                html: 'Dados carregados, mas não foi possível carregar a foto. Selecione uma nova foto antes de salvar.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        }
    }
    
    async deleteRecord(result) {
        const meta = result.metadata;
        
        Swal.fire({
            title: 'Confirmar Exclusão',
            html: `
                <div style="text-align:left;">
                    <p><strong>Nome:</strong> ${meta.dados_pessoais.nome_completo}</p>
                    <p><strong>CPF:</strong> ${meta.dados_pessoais.cpf}</p>
                    <p><strong>RG:</strong> ${meta.dados_pessoais.rg}</p>
                    <p style="margin-top:20px; color:#ff4444;">⚠️ Esta ação não pode ser desfeita!</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, Excluir',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        }).then(async (res) => {
            if (res.isConfirmed) {
                try {
                    await driveManager.deleteFile(result.id);
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Cadastro Excluído',
                        text: 'O cadastro foi excluído com sucesso!',
                        background: '#1a1a1a',
                        color: '#e0e0e0',
                        confirmButtonColor: '#00d4ff'
                    });
                    
                    // Atualizar lista
                    this.searchWithFilters();
                    
                } catch (error) {
                    console.error('Erro ao excluir:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro ao Excluir',
                        text: 'Erro ao excluir cadastro: ' + error.message,
                        background: '#1a1a1a',
                        color: '#e0e0e0',
                        confirmButtonColor: '#00d4ff'
                    });
                }
            }
        });
    }
    
    async copyToWhatsApp() {
        if (!this.currentDetailResult) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Nenhum cadastro selecionado',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
            return;
        }
        
        const meta = this.currentDetailResult.metadata;
        const hasHistorico = meta.tags && meta.tags.length > 0;
        
        const result = await Swal.fire({
            title: 'Compartilhar Cadastro',
            html: `
                <div style="text-align:left; padding:var(--space-3);">
                    <p style="margin-bottom:var(--space-3); color:var(--color-text-secondary);">Selecione as informações que deseja compartilhar:</p>
                    ${hasHistorico ? `
                    <label style="display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3); background:var(--color-surface-elevated); border-radius:var(--radius-md); cursor:pointer; margin-bottom:var(--space-2);">
                        <input type="checkbox" id="include-historico" checked style="width:18px; height:18px;">
                        <span style="font-size:var(--font-size-sm);">Incluir Histórico Criminal</span>
                    </label>
                    <div style="font-size:var(--font-size-xs); color:var(--color-text-tertiary); padding-left:var(--space-5);">
                        ${meta.tags.join(', ')}
                    </div>
                    ` : `
                    <div style="padding:var(--space-3); background:var(--color-surface); border-radius:var(--radius-md); color:var(--color-text-tertiary); font-size:var(--font-size-sm);">
                        ℹ️ Este cadastro não possui ocorrências registradas
                    </div>
                    `}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Copiar',
            cancelButtonText: 'Cancelar',
            background: '#1a1a1a',
            color: '#e0e0e0',
            confirmButtonColor: '#00d4ff',
            cancelButtonColor: '#6c757d',
            customClass: {
                container: 'swal-high-z'
            },
            preConfirm: () => {
                return {
                    includeHistorico: document.getElementById('include-historico')?.checked || false
                };
            }
        });
        
        if (!result.isConfirmed) return;
        
        const btn = document.getElementById('btn-copy-whatsapp');
        const originalHTML = btn.innerHTML;
        
        try {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" style="width:18px; height:18px; animation: spin 1s linear infinite;"></i> Preparando...';
            lucide.createIcons();
            
            // Formatar texto para WhatsApp
            let texto = '*CADASTRO - IRONFACE*\n';
            texto += '━━━━━━━━━━━━━━━━━━━━\n\n';
            
            // Dados Pessoais
            texto += '*DADOS PESSOAIS*\n';
            texto += `Nome: *${meta.dados_pessoais.nome_completo}*\n`;
            if (meta.dados_pessoais.alcunha && meta.dados_pessoais.alcunha !== 'N/A') {
                texto += `Alcunha: "${meta.dados_pessoais.alcunha}"\n`;
            }
            texto += `CPF: ${meta.dados_pessoais.cpf}\n`;
            texto += `RG: ${meta.dados_pessoais.rg}\n`;
            if (meta.dados_pessoais.data_nascimento) {
                texto += `Nascimento: ${new Date(meta.dados_pessoais.data_nascimento).toLocaleDateString('pt-BR')}\n`;
            }
            if (meta.dados_pessoais.filiacao_mae && meta.dados_pessoais.filiacao_mae !== 'N/A') {
                texto += `Mãe: ${meta.dados_pessoais.filiacao_mae}\n`;
            }
            if (meta.dados_pessoais.filiacao_pai && meta.dados_pessoais.filiacao_pai !== 'N/A') {
                texto += `Pai: ${meta.dados_pessoais.filiacao_pai}\n`;
            }
            
            // Formato: "Endereço: nomedarua, numero - nomedacidade/estado"
            let enderecoCompleto = '\n*Endereço:* ';
            if (meta.endereco.logradouro && meta.endereco.logradouro !== 'N/A') {
                enderecoCompleto += meta.endereco.logradouro;
            }
            enderecoCompleto += ` - ${meta.endereco.cidade}/${meta.endereco.estado}`;
            texto += enderecoCompleto + '\n';
            if (meta.endereco.cep && meta.endereco.cep !== 'N/A') {
                texto += `CEP: ${meta.endereco.cep}\n`;
            }
            
            // Características Físicas
            if (meta.caracteristicas.altura || meta.caracteristicas.cor_pele || meta.caracteristicas.cor_olhos) {
                texto += '\n*CARACTERÍSTICAS*\n';
                if (meta.caracteristicas.altura && meta.caracteristicas.altura !== 'N/A') {
                    texto += `Altura: ${meta.caracteristicas.altura}\n`;
                }
                if (meta.caracteristicas.cor_pele && meta.caracteristicas.cor_pele !== 'N/A') {
                    texto += `Cor da Pele: ${meta.caracteristicas.cor_pele}\n`;
                }
                if (meta.caracteristicas.cor_olhos && meta.caracteristicas.cor_olhos !== 'N/A') {
                    texto += `Cor dos Olhos: ${meta.caracteristicas.cor_olhos}\n`;
                }
                if (meta.caracteristicas.tatuagens && meta.caracteristicas.tatuagens !== 'N/A') {
                    texto += `Tatuagens: ${meta.caracteristicas.tatuagens}\n`;
                }
            }
            
            // Dados da Abordagem
            if (meta.dados_abordagem.data_abordagem || meta.dados_abordagem.local_abordagem) {
                texto += '\n*DADOS DA ABORDAGEM*\n';
                if (meta.dados_abordagem.data_abordagem) {
                    texto += `Data: ${new Date(meta.dados_abordagem.data_abordagem).toLocaleDateString('pt-BR')}\n`;
                }
                if (meta.dados_abordagem.local_abordagem && meta.dados_abordagem.local_abordagem !== 'N/A') {
                    texto += `Local: ${meta.dados_abordagem.local_abordagem}\n`;
                }
                if (meta.dados_abordagem.local_cadastro && meta.dados_abordagem.local_cadastro !== 'N/A') {
                    texto += `Cadastro: ${meta.dados_abordagem.local_cadastro}\n`;
                }
                if (meta.dados_abordagem.policial_responsavel && meta.dados_abordagem.policial_responsavel !== 'N/A') {
                    texto += `Responsável: ${meta.dados_abordagem.policial_responsavel}\n`;
                }
            }
            
            // Histórico Criminal (se selecionado)
            if (result.value.includeHistorico && meta.tags && meta.tags.length > 0) {
                texto += '\n*HISTÓRICO CRIMINAL*\n';
                texto += meta.tags.join(', ') + '\n';
            }
            
            texto += '\n━━━━━━━━━━━━━━━━━━━━\n';
            texto += `_Cadastrado em: ${new Date(this.currentDetailResult.createdTime).toLocaleString('pt-BR')}_`;
            
            // Copiar apenas o texto
            await navigator.clipboard.writeText(texto);
            
            btn.innerHTML = '<i data-lucide="check" style="width:18px; height:18px;"></i> Copiado!';
            lucide.createIcons();
            
            Swal.fire({
                icon: 'success',
                title: 'Texto Copiado!',
                text: 'O texto foi copiado para a área de transferência. Cole no WhatsApp com Ctrl+V.',
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff',
                timer: 2000
            });
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                lucide.createIcons();
            }, 2000);
            
        } catch (error) {
            console.error('Erro ao copiar:', error);
            
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            lucide.createIcons();
            
            Swal.fire({
                icon: 'error',
                title: 'Erro ao copiar',
                text: 'Erro: ' + error.message,
                background: '#1a1a1a',
                color: '#e0e0e0',
                confirmButtonColor: '#00d4ff'
            });
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    const savedClientId = localStorage.getItem('gdrive_client_id');
    const savedApiKey = localStorage.getItem('gdrive_api_key');
    
    if (savedClientId) document.getElementById('client-id').value = savedClientId;
    if (savedApiKey) document.getElementById('api-key').value = savedApiKey;

    window.cadastroManager = new CadastroManager();
    
    // Inicializar tela de consulta
    const consultaResults = document.getElementById('consulta-results');
    if (consultaResults) {
        consultaResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="search" style="width:48px; height:48px;"></i></div>
                <div class="empty-state-text">Utilize os filtros para buscar</div>
                <div class="empty-state-hint">Preencha um ou mais campos e clique em "Buscar"</div>
            </div>
        `;
        setTimeout(() => lucide.createIcons(), 0);
    }
    
    // Event listener para fechar modal de detalhes
    const detailsModal = document.getElementById('details-modal');
    const detailsModalClose = detailsModal?.querySelector('.modal-close');
    
    if (detailsModalClose) {
        detailsModalClose.addEventListener('click', () => {
            detailsModal.style.display = 'none';
        });
    }
    
    if (detailsModal) {
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                detailsModal.style.display = 'none';
            }
        });
    }
    
    // Event listeners para botões de copiar
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-field')) {
            const btn = e.target.closest('.btn-copy-field');
            const targetId = btn.dataset.copyTarget;
            const textElement = document.getElementById(targetId);
            const text = textElement.textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i data-lucide="check" style="width:14px; height:14px;"></i>';
                lucide.createIcons();
                
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    lucide.createIcons();
                }, 1500);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
            });
        }
    });
    
    // Event listener para botão copiar WhatsApp
    document.getElementById('btn-copy-whatsapp')?.addEventListener('click', () => {
        window.cadastroManager.copyToWhatsApp();
    });
    
    // Tentar reconectar automaticamente se houver credenciais salvas
    if (savedClientId && savedApiKey) {
        console.log('Credenciais encontradas, tentando reconectar automaticamente...');
        autoReconnect(savedClientId, savedApiKey);
    }
});

async function autoReconnect(clientId, apiKey) {
    try {
        // Verificar se já está autenticado
        const savedToken = localStorage.getItem('gdrive_token');
        const expiry = localStorage.getItem('gdrive_token_expiry');
        
        if (savedToken && expiry && Date.now() < parseInt(expiry)) {
            console.log('Token válido encontrado, reconectando...');
            await driveManager.initialize(clientId, apiKey);
            driveManager.accessToken = savedToken;
            
            // Configurar o token no GAPI
            if (window.gapi && window.gapi.client) {
                gapi.client.setToken({ access_token: savedToken });
            }
            
            window.cadastroManager.updateConnectionStatus();
            console.log('✅ Reconectado automaticamente!');
            return;
        }
        
        console.log('Token expirado ou não encontrado, necessário autenticar novamente');
        
    } catch (error) {
        console.error('Erro ao reconectar automaticamente:', error);
    }
}
