// Módulo de Gerenciamento de Abas
(function() {
    'use strict';

    class TabManager {
        constructor() {
            this.tabs = [];
            this.activeTab = null;
            this.init();
        }

        init() {
            // Aguarda o DOM estar completamente carregado
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        setup() {
            // Seleciona todos os botões de aba
            const tabButtons = document.querySelectorAll('.tab-btn');
            
            if (tabButtons.length === 0) {
                console.error('TabManager: Nenhum botão de aba encontrado');
                return;
            }

            // Configura cada botão
            tabButtons.forEach(button => {
                const tabName = button.getAttribute('data-tab');
                
                if (!tabName) {
                    console.warn('TabManager: Botão sem data-tab encontrado', button);
                    return;
                }

                this.tabs.push({
                    button: button,
                    name: tabName,
                    content: document.getElementById(`${tabName}-tab`)
                });

                // Adiciona evento de clique
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab(tabName);
                });

                // Define aba ativa inicial
                if (button.classList.contains('active')) {
                    this.activeTab = tabName;
                }
            });

            console.log('TabManager: Inicializado com', this.tabs.length, 'abas');
        }

        switchTab(tabName) {
            console.log('TabManager: Mudando para aba', tabName);

            // Encontra a aba
            const tab = this.tabs.find(t => t.name === tabName);
            
            if (!tab) {
                console.error('TabManager: Aba não encontrada:', tabName);
                return;
            }

            if (!tab.content) {
                console.error('TabManager: Conteúdo da aba não encontrado:', `${tabName}-tab`);
                return;
            }

            // Desativa todas as abas
            this.tabs.forEach(t => {
                t.button.classList.remove('active');
                if (t.content) {
                    t.content.classList.remove('active');
                }
            });

            // Ativa a aba selecionada
            tab.button.classList.add('active');
            tab.content.classList.add('active');
            this.activeTab = tabName;

            // Dispara evento customizado
            this.onTabChange(tabName);

            console.log('TabManager: Aba ativada:', tabName);
        }

        onTabChange(tabName) {
            // Notifica outros módulos sobre mudança de aba
            window.dispatchEvent(new CustomEvent('tabchange', { 
                detail: { tab: tabName } 
            }));

            // Atualiza status de conexão para abas específicas
            if (tabName === 'cadastro' || tabName === 'configuracoes' || tabName === 'comparison') {
                if (window.cadastroManager) {
                    window.cadastroManager.updateConnectionStatus();
                }
            }
        }

        getActiveTab() {
            return this.activeTab;
        }
    }

    // Inicializa o gerenciador de abas
    window.tabManager = new TabManager();

})();
