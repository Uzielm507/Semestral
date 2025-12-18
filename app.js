// Usamos IIFE para encapsular el código
const App = (() => {

    // 1. REFERENCIAS AL DOM
    const el = {
        // Navegación
        navBtns: document.querySelectorAll('.nav-btn'),
        views: document.querySelectorAll('.view-section'),
        
        // Búsqueda
        form: document.querySelector('#search-form'),
        input: document.querySelector('#pokemon-input'),
        container: document.querySelector('#pokemon-container'),
        
        // Historial y Favoritos
        historyList: document.querySelector('#history-list'),
        btnClearHistory: document.querySelector('#btn-clear-history'),
        favList: document.querySelector('#fav-list'),
        btnClearFavs: document.querySelector('#btn-clear-favs'),
        
        // Batalla
        vsInput1: document.querySelector('#vs-input-1'),
        vsInput2: document.querySelector('#vs-input-2'),
        btnBattle: document.querySelector('#btn-battle'),
        battleRes: document.querySelector('#battle-results'),
        
        // Cajas de luchadores
        f1Img: document.querySelector('#f1-img'), f1Name: document.querySelector('#f1-name'), 
        f1Score: document.querySelector('#f1-score'), f1Winner: document.querySelector('#f1-winner'),
        f2Img: document.querySelector('#f2-img'), f2Name: document.querySelector('#f2-name'), 
        f2Score: document.querySelector('#f2-score'), f2Winner: document.querySelector('#f2-winner')
    };

    // 2. UTILIDADES
    const utils = {
        async fetchPokemon(query) {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query.toLowerCase()}`);
            if (!res.ok) throw new Error('POKÉMON NO ENCONTRADO');
            return res.json();
        },
        async fetchUrl(url) {
            const res = await fetch(url);
            return res.json();
        },
        getStorage: (k) => JSON.parse(localStorage.getItem(k)) || [],
        setStorage: (k, v) => localStorage.setItem(k, JSON.stringify(v))
    };

    // 3. RENDERIZADO
    const render = {
        // Tarjeta principal
        card: (p, isFav) => {
            // Colores por tipo (simplificado)
            const typeColors = { fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', psychic: '#f85888', normal: '#a8a878' };
            
            const typesHtml = p.types.map(t => {
                const color = typeColors[t.type.name] || '#000';
                return `<span class="type-badge" style="background:${color}; border-color:black;">${t.type.name}</span>`;
            }).join('');

            const statsHtml = p.stats.map(s => {
                let color = '#4deeea';
                if(s.stat.name === 'hp') color = '#4deeea'; // Rojo
                if(s.stat.name === 'attack') color = '#4deeea'; // Naranja
                if(s.stat.name === 'defense') color = '#4deeea'; // Amarillo
                if(s.stat.name === 'speed') color = '#4deeea'; // Rosa
                return `
                <div class="stat-label">${s.stat.name.toUpperCase()}:</div>
                <div class="stat-bar-container">
                    <div class="stat-bar" style="width: ${Math.min(s.base_stat/2, 100)}%; background-color:${color};"></div>
                </div>`;
            }).join('');

            const abilities = p.abilities.map(a => `${a.ability.name} ${a.is_hidden ? '(Oculta)' : ''}`).join(', ');

            return `
                <div class="pokemon-card">
                    <button class="fav-toggle-btn ${isFav ? 'is-favorite' : ''}" onclick="App.toggleFav('${p.name}')">
                        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                    <div class="pokemon-img-container">
                        <img src="${p.sprites.front_default}" alt="${p.name}" class="pokemon-img">
                    </div>
                    <div class="pokemon-info">
                        <h2 class="pokemon-name">#${p.id} ${p.name}</h2>
                        <div class="pokemon-types">${typesHtml}</div>
                        <div class="abilities-list"><strong>HABILIDADES:</strong> ${abilities}</div>
                        <div class="stats-grid">${statsHtml}</div>
                        <div class="evolution-section">
                            <h3>CADENA EVOLUTIVA</h3>
                            <div id="evo-chain-container" class="evolution-chain">Cargando...</div>
                        </div>
                    </div>
                </div>`;
        },

        // Renderizar evoluciones recursivamente
        evolutionChain: async (speciesUrl, containerId) => {
            try {
                const speciesData = await utils.fetchUrl(speciesUrl);
                const evoData = await utils.fetchUrl(speciesData.evolution_chain.url);
                const chain = evoData.chain;
                const container = document.getElementById(containerId);

                let html = '';
                
                const processNode = (node) => {
                    const id = node.species.url.split('/').filter(Boolean).pop();
                    const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
                    
                    html += `
                    <div class="evo-item" onclick="App.searchFromList('${node.species.name}')">
                        <img src="${img}">
                        <span style="font-size:0.8rem; font-weight:bold;">${node.species.name}</span>
                    </div>`;

                    if (node.evolves_to.length > 0) {
                        html += `<div class="evo-arrow"><i class="fa-solid fa-arrow-right"></i></div>`;
                        node.evolves_to.forEach(next => processNode(next));
                    }
                };

                processNode(chain);
                container.innerHTML = html;

            } catch (e) {
                document.getElementById(containerId).innerHTML = 'No disponible';
            }
        },

        list: (container, listKey, emptyMsg) => {
            const list = utils.getStorage(listKey);
            container.innerHTML = '';
            if(!list.length) {
                container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
                return;
            }
            list.reverse().forEach(name => {
                container.innerHTML += `
                <div class="list-item">
                    <span style="font-weight:bold; text-transform:uppercase;">${name}</span>
                    <button class="nav-btn" style="padding:5px 10px; font-size:0.8rem;" onclick="App.searchFromList('${name}')">VER</button>
                </div>`;
            });
        }
    };

    // 4. MÉTODOS PÚBLICOS (ACCIONES)
    const actions = {
        init() {
            // Listeners
            el.form.addEventListener('submit', actions.handleSearch);
            el.btnBattle.addEventListener('click', actions.handleBattle);
            
            el.btnClearHistory.addEventListener('click', () => {
                localStorage.removeItem('history');
                render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
            });

            el.btnClearFavs.addEventListener('click', () => {
                localStorage.removeItem('favorites');
                render.list(el.favList, 'favorites', 'SIN FAVORITOS');
            });
        },

        // Router para cambiar pestañas
        router(viewId) {
            el.views.forEach(v => v.classList.remove('active'));
            el.navBtns.forEach(b => b.classList.remove('active'));

            document.getElementById(`view-${viewId}`).classList.add('active');
            document.getElementById(`nav-${viewId}`).classList.add('active');

            // Refrescar listas si entramos a esas vistas
            if(viewId === 'historial') render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
            if(viewId === 'favoritos') render.list(el.favList, 'favorites', 'SIN FAVORITOS');
        },

        // Buscador principal
        async handleSearch(e) {
            e.preventDefault();
            const query = el.input.value.trim();
            if(!query) return;

            el.container.innerHTML = `<div class="loading">CARGANDO...</div>`;

            try {
                const p = await utils.fetchPokemon(query);
                
                // Guardar Historial
                const hist = utils.getStorage('history').filter(h => h !== p.name);
                hist.push(p.name);
                utils.setStorage('history', hist);

                // Renderizar
                const favs = utils.getStorage('favorites');
                const isFav = favs.includes(p.name);
                el.container.innerHTML = render.card(p, isFav);
                
                // Cargar evoluciones
                render.evolutionChain(p.species.url, 'evo-chain-container');

            } catch (err) {
                el.container.innerHTML = `<div class="error-message">${err.message}</div>`;
            }
        },

        searchFromList(name) {
            el.input.value = name;
            actions.router('buscar');
            document.querySelector('#search-form button').click();
        },

        toggleFav(name) {
            let favs = utils.getStorage('favorites');
            if(favs.includes(name)) {
                favs = favs.filter(f => f !== name);
            } else {
                favs.push(name);
            }
            utils.setStorage('favorites', favs);
            
            // Re-renderizar tarjeta actual para actualizar el icono
            // (Un hack rápido es simular nueva búsqueda o manipular el DOM directamente)
            const btn = document.querySelector('.fav-toggle-btn');
            const icon = btn.querySelector('i');
            btn.classList.toggle('is-favorite');
            icon.classList.toggle('fa-solid');
            icon.classList.toggle('fa-regular');
        },

        async handleBattle() {
            const n1 = el.vsInput1.value.trim();
            const n2 = el.vsInput2.value.trim();
            if(!n1 || !n2) return alert("Ingresa dos Pokémon");

            try {
                const [p1, p2] = await Promise.all([utils.fetchPokemon(n1), utils.fetchPokemon(n2)]);
                
                el.battleRes.classList.remove('hidden');
                
                // Renderizar luchadores
                const renderFighter = (prefix, p) => {
                    const total = p.stats.reduce((acc, s) => acc + s.base_stat, 0);
                    document.getElementById(prefix+'-img').src = p.sprites.front_default;
                    document.getElementById(prefix+'-name').textContent = p.name.toUpperCase();
                    document.getElementById(prefix+'-score').textContent = total + " PTS";
                    return total;
                };

                const s1 = renderFighter('f1', p1);
                const s2 = renderFighter('f2', p2);

                el.f1Winner.classList.add('hidden');
                el.f2Winner.classList.add('hidden');

                if(s1 > s2) el.f1Winner.classList.remove('hidden');
                else if(s2 > s1) el.f2Winner.classList.remove('hidden');

            } catch (e) {
                alert("Error: Revisa los nombres de los Pokémon");
            }
        }
    };

    return actions;
})();

// Iniciar app
document.addEventListener('DOMContentLoaded', App.init);