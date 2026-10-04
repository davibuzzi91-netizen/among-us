# Among Us Offline - Jogo Funcional

Um jogo Among Us completamente offline, desenvolvido em Vanilla JavaScript com suporte PWA para jogar sem internet.

## Características

✅ **Mapa The Skeld Completo**
- 14 salas interconectadas
- 14 vents (6 redes)
- 4 câmeras de segurança
- Botão de emergência na cafeteria

✅ **18 Tasks Implementadas**
- 2 Common Tasks (Fix Wiring, Swipe Card)
- 9 Short Tasks (Engine, Shields, Navigation, etc)
- 7 Long Tasks (Garbage, Reactor, Scan, etc)

✅ **IA Inteligente**
- 3-4 bots automáticos
- Navegação por pathfinding
- Completam tasks realistas
- Comportamento natural em diferentes salas

✅ **Controles Responsivos**
- WASD para movimento contínuo
- Click do mouse para movimento direto
- T para completar task próxima
- ESC para pausar

✅ **Barra de Progresso**
- Mostra % de tasks completas em tempo real
- Atualiza conforme bots completam tarefas

✅ **Progressive Web App (PWA)**
- Funciona offline
- Pode ser instalado como app
- Suporte a múltiplos navegadores

✅ **Modo Debug**
- Visualizar posições
- Ver informações de FPS
- Ativar com D ou no menu de pausa

## Como Rodar

### Opção 1: Abrir arquivo HTML direto
1. Extraia o ZIP
2. Abra `index.html` no navegador
3. Comece a jogar!

### Opção 2: Servidor local (recomendado para PWA)
```bash
# Com Python 3
python -m http.server 8000

# Com Python 2
python -m SimpleHTTPServer 8000

# Com Node.js (http-server)
npx http-server

# Com Node.js (Express)
npm install express
# Criar um server.js e executar
```

Depois acesse: `http://localhost:8000`

### Opção 3: GitHub Pages
1. Faça fork deste repositório
2. Ative GitHub Pages nas configurações
3. Acesse a URL publicada

## Controles do Jogo

| Tecla | Ação |
|-------|------|
| **WASD** | Movimento contínuo |
| **Mouse Click** | Mover para local clicado |
| **T** | Completar task próxima (quando perto) |
| **ESC** | Pausar jogo |
| **D** | Ativar modo debug |

## Estrutura do Projeto

```
among-us-game/
├── index.html           # PWA manifest, HTML, layout
├── manifest.json        # Metadados PWA
├── service-worker.js    # Suporte offline
├── style.css            # Estilos CSS
├── src/
│   └── game.js          # Engine principal do jogo
└── README.md            # Este arquivo
```

## Como Funciona

### Game Engine (Canvas 2D)
- Viewport de 1024x768px
- Renderização de 60 FPS
- Sprites de crewmates: 36x40px (padrão Among Us)

### Sistema de Movimento
- **Player**: Controla com WASD ou mouse
- **Bots**: IA automática com pathfinding
- Colisão com paredes das salas

### Sistema de Tasks
Cada task tem:
- Nome e descrição
- Sala específica
- Tipo (common, short, long)
- Subtasks múltiplas (alguns requerem 2 completações)

Bots:
- Navegam até a sala da task
- Completam em tempo realista
- Se comportam naturalmente

### Progresso
- Barra mostra % de tasks completas
- Atualiza em tempo real
- Goal: 100% de progresso

## Desenvolvimento

### Stack Tecnológico
- **Vanilla JavaScript** (ES6+)
- **Canvas 2D API** para renderização
- **Service Worker** para offline
- **PWA APIs** para instalação

### Sem Dependências Externas
- Zero frameworks
- Zero bibliotecas externas
- Funciona em qualquer navegador moderno

## Navegadores Suportados

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (Android Chrome, Safari iOS)

## Melhorias Futuras

- [ ] Multiplayer local (gamepad support)
- [ ] Modo impostor/crewmate
- [ ] Mais mapas (Polus, Airship, etc)
- [ ] Sistema de chat
- [ ] Animações mais suaves
- [ ] Efeitos de som
- [ ] Skins customizadas

## Problemas Conhecidos

- Pathfinding simples (pode melhorar)
- Sem detecção de sabotagem impostor
- Sem sistema de votação
- Física de colisão básica

## Contribuindo

Sinta-se livre para fazer pull requests com melhorias!

## Licença

MIT - Livre para usar em projetos pessoais e comerciais.

## Créditos

Desenvolvido como fan game de Among Us (Innersloth)
- Jogo original: Among Us by Innersloth
- Este é um projeto não-oficial educacional

---

**Divirta-se jogando! 🎮**

Qualquer dúvida ou problema, abra uma issue no repositório.
