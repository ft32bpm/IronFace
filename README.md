# IronFace - Sistema de Reconhecimento Facial Forense

Sistema de reconhecimento facial desenvolvido para apoio às operações policiais, utilizando inteligência artificial para identificação e gestão de cadastros de pessoas abordadas.

## Descrição do Projeto

O IronFace é um sistema web de reconhecimento facial que integra tecnologias modernas de IA com armazenamento em nuvem (Google Drive) para criar um banco de dados biométrico forense. O sistema permite cadastrar indivíduos abordados com suas fotos e informações detalhadas, além de realizar buscas faciais para identificar possíveis correspondências.

## Funcionalidades Principais

### 1. Triagem de Candidatos
- Comparação facial entre imagem de consulta e banco de dados
- Suporte para múltiplas imagens de consulta simultâneas
- Detecção automática de rostos e extração de características faciais
- Sistema de pontuação e classificação de candidatos
- Análise individual detalhada de cada correspondência
- Filtros ajustáveis para score mínimo e distância euclidiana

### 2. Cadastro de Pessoas
- Formulário completo de dados pessoais (nome, RG, CPF, data de nascimento, filiação)
- Informações de endereço (logradouro, bairro, cidade, estado, CEP)
- Características físicas (altura, cor da pele, cor dos olhos, tatuagens, sinais particulares)
- Dados da abordagem (data, local, policial responsável, observações)
- Histórico criminal com tags predefinidas (22 tipos de crimes)
- Upload e otimização automática de fotos
- Preenchimento automático através de texto colado
- Detecção de duplicatas por CPF, RG ou nome

### 3. Busca de Cadastros
- Busca por múltiplos filtros combinados
- Filtros de identificação: nome, CPF, RG, alcunha
- Filtros de localização: bairro, cidade, estado
- Filtros de características físicas: cor da pele, cor dos olhos, tatuagens
- Filtro por período de abordagem
- Filtro por tipo de crime no histórico
- Visualização detalhada de cadastros
- Edição e exclusão de registros
- Exportação de dados para WhatsApp

### 4. Configurações
- Conexão com Google Drive via OAuth 2.0
- Configuração de credenciais (Client ID e API Key)
- Otimização inteligente de imagens
- Enquadramento facial automático
- Sistema de cache para carregamento rápido
- Presets de qualidade (Economia, Balanceado, Alta Qualidade)

## Tecnologias Utilizadas

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Design system customizado com variáveis CSS
- Interface responsiva e moderna
- Ícones Lucide

### Bibliotecas e APIs
- **Face-API.js** (@vladmandic/face-api): detecção facial e reconhecimento
  - SSD MobileNet v1: detecção de rostos
  - Face Landmark 68: pontos de referência faciais
  - Face Recognition Net: extração de características (128 dimensões)
- **Google Drive API v3**: armazenamento em nuvem
- **Google Identity Services**: autenticação OAuth 2.0
- **SweetAlert2**: diálogos e notificações

### Estrutura de Arquivos

```
IronFace/
├── css/
│   ├── cadastro.css          # Estilos do formulário de cadastro
│   ├── compatibility.css     # Compatibilidade entre navegadores
│   ├── components.css        # Componentes reutilizáveis
│   ├── design-system.css     # Variáveis e sistema de design
│   ├── icons.css            # Estilos de ícones
│   ├── layout.css           # Layout geral da aplicação
│   ├── modal-details.css    # Modal de detalhes do cadastro
│   ├── modules.css          # Módulos específicos
│   └── optimization.css     # Otimizações de performance
├── js/
│   ├── app-faceapi.js       # Integração com Face-API
│   ├── app.js              # Lógica principal (legado)
│   ├── cadastro.js         # Gerenciamento de cadastros
│   ├── cluster.js          # Agrupamento de resultados
│   ├── compare.js          # Comparação de embeddings faciais
│   ├── embedding.js        # Geração de embeddings
│   ├── face-framing.js     # Enquadramento facial inteligente
│   ├── google-drive.js     # Integração com Google Drive
│   ├── image-optimizer.js  # Otimização de imagens
│   ├── models-faceapi.js   # Carregamento de modelos IA
│   ├── models.js           # Gerenciamento de modelos
│   └── tabs.js             # Sistema de abas
├── logo/
│   └── logo.png            # Logo do sistema
└── index.html              # Página principal
```

## Algoritmos de Reconhecimento Facial

### Detecção e Extração de Características
1. **Detecção de rosto**: SSD MobileNet v1 com confiança mínima de 72%
2. **Landmarks faciais**: 68 pontos de referência facial
3. **Descritor facial**: vetor de 128 dimensões (embedding)

### Comparação Facial
O sistema utiliza dois métodos de comparação:

#### Distância Euclidiana
```
d = √Σ(a[i] - b[i])²
```
Onde `a` e `b` são os vetores de características (128 dimensões)

#### Cálculo de Similaridade
Conversão de distância euclidiana para porcentagem:
- Distância ≤ 0.35: Similaridade 96-100%
- Distância 0.35-0.45: Similaridade 90-96%
- Distância 0.45-0.52: Similaridade 82-90%
- Distância 0.52-0.60: Similaridade 60-82%
- Distância 0.60-0.75: Similaridade 25-60%
- Distância > 0.75: Similaridade 0-25%

### Limiares de Decisão
- **Candidato Forte**: Similaridade ≥ 82% (distância ≤ 0.52)
- **Revisar Manualmente**: Similaridade 74-82% (distância 0.52-0.60)
- **Descartar**: Similaridade < 74% (distância > 0.60)

### Validação de Qualidade
Para aceitar uma imagem, o sistema verifica:
- Score de detecção ≥ 82%
- Tamanho mínimo do rosto: 80px (largura/altura)
- Proporção mínima de área: 0.5% da imagem
- Apenas um rosto por imagem

## Otimização de Imagens

### Enquadramento Facial Inteligente
- Detecção automática da posição do rosto
- Recorte incluindo cabelo e parte do peito
- Tamanhos configuráveis: 600px, 800px ou 1024px
- Margem ajustável: 50% a 120% do rosto

### Compressão
- Formato JPEG para máxima compatibilidade
- Tamanho máximo fixo: 150KB por imagem
- Qualidade inicial configurável (60-95%)
- Ajuste automático para atingir o tamanho alvo
- Redução média de 80% no tamanho dos arquivos

### Impacto no Armazenamento
- 1000 fotos otimizadas: ~150MB
- 1000 fotos sem otimização: ~3GB
- Economia de ~95% no armazenamento

## Armazenamento no Google Drive

### Estrutura de Pastas
```
IronFace_Database/
├── [Cidade1]/
│   ├── [Ano]/
│   │   ├── [Mês]/
│   │   │   ├── Nome_CPF_RG.jpg
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── [Cidade2]/
│   └── ...
└── ...
```

### Nomenclatura de Arquivos
Formato: `Nome_CPF_RG.jpg`
- Nome: sem espaços (substituídos por underscore)
- CPF: apenas números (11 dígitos)
- RG: apenas números

Exemplo: `JoaoSilva_12345678900_98765432.jpg`

### Metadados
Cada imagem armazena metadados completos no campo `description` do Google Drive (formato JSON):
- Dados pessoais (nome, RG, CPF, data de nascimento, filiação)
- Endereço completo
- Características físicas
- Dados da abordagem
- Tags de histórico criminal

## Sistema de Cache

### Cache de Descritores Faciais
- Armazenamento local (localStorage) dos vetores de características
- Chave: `desc_[fileId]_[modifiedTime]`
- Dados armazenados:
  - Descritor facial (Float32Array convertido para array)
  - Detecção (box e landmarks)
  - Qualidade da detecção
  - Visuals processados

### Benefícios
- Primeira carga: processa todas as imagens (mais lento)
- Cargas subsequentes: até 90% mais rápido
- Cache automático por imagem
- Invalidação automática quando imagem é modificada

### Gerenciamento
- Limpeza automática quando localStorage fica cheio (remove 20% dos mais antigos)
- Botão manual para limpar todo o cache
- Cada descritor ocupa aproximadamente 2-3KB

## Segurança e Privacidade

### Armazenamento de Dados
- Dados armazenados no Google Drive pessoal/institucional do usuário
- Cada usuário tem seu próprio banco de dados isolado
- Não há compartilhamento de dados entre usuários
- Backup automático do Google Drive

### Autenticação
- OAuth 2.0 via Google Identity Services
- Token de acesso expira após 1 hora
- Credenciais armazenadas localmente apenas para reconexão
- Possibilidade de "esquecer" credenciais completamente

### Dados Sensíveis
- Nenhum dado é enviado para servidores externos além do Google Drive
- Processamento facial realizado localmente no navegador
- Cache armazenado apenas localmente

## Configuração do Google Drive

### Passo a Passo

1. Acesse [Google Cloud Console](https://console.cloud.google.com)

2. Crie um novo projeto
   - Nome sugerido: "IronFace"

3. Ative a Google Drive API
   - Menu: APIs & Services > Library
   - Busque "Google Drive API"
   - Clique em "Enable"

4. Configure a Tela de Consentimento OAuth
   - Menu: APIs & Services > OAuth consent screen
   - User Type: Internal (organizacional) ou External
   - Preencha os campos obrigatórios
   - Scopes: adicione `.../auth/drive.file`

5. Crie Credenciais OAuth 2.0
   - Menu: APIs & Services > Credentials
   - Create Credentials > OAuth client ID
   - Application type: Web application
   - Authorized JavaScript origins: adicione sua URL (ex: `http://localhost` para testes)
   - Authorized redirect URIs: mesma URL
   - Copie o Client ID gerado

6. Crie uma API Key
   - Menu: APIs & Services > Credentials
   - Create Credentials > API Key
   - Copie a API Key gerada

7. Configure no Sistema
   - Acesse aba "Configurações"
   - Cole Client ID e API Key
   - Clique em "Conectar"
   - Autorize o acesso na janela pop-up do Google

## Requisitos do Sistema

### Navegador
- Google Chrome 90+ (recomendado)
- Firefox 88+
- Edge 90+
- Safari 14+

### Conexão
- Conexão com internet para:
  - Carregar modelos de IA (primeira vez)
  - Acessar Google Drive
  - Autenticação OAuth

### Hardware
- Mínimo: 4GB RAM
- Recomendado: 8GB RAM
- Processador moderno (para processamento de IA)

### Resolução
- Mínima: 1366x768
- Recomendada: 1920x1080 ou superior

## Limitações Conhecidas

### Técnicas
- Máximo de ~1000 imagens recomendado no banco para performance ideal
- localStorage limitado a ~5-10MB (varia por navegador)
- Token do Google Drive expira após 1 hora (requer reconexão)
- Processamento facial pode ser lento em dispositivos mais antigos

### Funcionalidades
- Apenas um rosto por imagem (múltiplos rostos são rejeitados)
- Requer JavaScript habilitado
- Não funciona offline (exceto cache)
- Google Drive API tem limites de quota

## Boas Práticas

### Cadastramento
1. Use fotos frontais com boa iluminação
2. Evite óculos escuros ou acessórios que cubram o rosto
3. Tamanho mínimo recomendado: 640x480 pixels
4. Preencha todos os campos obrigatórios (nome, RG, CPF, cidade)
5. Selecione pelo menos uma tag de histórico criminal

### Busca Facial
1. Use imagens de boa qualidade para consulta
2. Configure o threshold adequadamente:
   - 85%+ para alta precisão (menos resultados)
   - 80-85% balanceado (recomendado)
   - 75-80% mais resultados (mais falsos positivos)
3. Sempre faça análise individual dos candidatos fortes
4. Use múltiplas fotos de consulta quando disponível

### Manutenção
1. Limpe o cache periodicamente se o banco crescer muito
2. Faça backup do Google Drive regularmente
3. Revise e atualize cadastros antigos
4. Remove duplicatas quando detectadas

## Desenvolvimento

### Estrutura do Código

#### Módulos Principais
- **cadastro.js**: Gerenciamento completo do CRUD de cadastros
- **google-drive.js**: Integração com Google Drive API
- **app-faceapi.js**: Processamento facial e comparações
- **image-optimizer.js**: Otimização e enquadramento de imagens

#### Padrões de Código
- ES6+ (modules, async/await, arrow functions)
- Event-driven architecture
- Separação de responsabilidades
- Cache estratégico para performance

#### Eventos Principais
- Carregamento de modelos IA
- Upload e otimização de imagens
- Processamento em lote (batches de 5 imagens)
- Comparação facial paralela

## Créditos

**Desenvolvido por**: Sd PM Ferrão
**Unidade**: Força Tática 32º BPM
**Finalidade**: Apoio às operações policiais
**Versão**: 1.0.0
**Ano**: 2024-2026

## Tecnologias Open Source Utilizadas

- Face-API.js by Vladimir Mandic
- SweetAlert2
- Lucide Icons
- Google Drive API
- Google Identity Services

## Licença

© 2026 - Todos os direitos reservados

Sistema desenvolvido para uso institucional da Polícia Militar.
Uso restrito a agentes de segurança pública devidamente autorizados.

## Suporte

Para questões técnicas ou sugestões de melhorias, entre em contato com o desenvolvedor através da unidade.

---

**IMPORTANTE**: Este sistema foi desenvolvido para auxiliar nas atividades de segurança pública. Os dados coletados devem ser tratados com confidencialidade e em conformidade com a Lei Geral de Proteção de Dados (LGPD). O uso inadequado das informações pode resultar em responsabilização civil e criminal.
