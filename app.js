const App = (() => {

    // 1. REFERENCIAS AL DOM
    const el = {
        navBtns: document.querySelectorAll('.nav-btn'),
        views: document.querySelectorAll('.view-section'),
        
        form: document.querySelector('#search-form'),
        input: document.querySelector('#pokemon-input'),
        container: document.querySelector('#pokemon-container'),
        
        historyList: document.querySelector('#history-list'),
        favList: document.querySelector('#fav-list'),
        
        vsInput1: document.querySelector('#vs-input-1'),
        vsInput2: document.querySelector('#vs-input-2'),
        btnBattle: document.querySelector('#btn-battle'),
        battleRes: document.querySelector('#battle-results'),
        
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
        card: (p, isFav, isCache) => {
            const typeColors = { fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', psychic: '#f85888', normal: '#a8a878' };
            
            const typesHtml = p.types.map(t => {
                const color = typeColors[t.type.name] || '#000';
                return `<span class="type-badge" style="background:${color}; border-color:black;">${t.type.name}</span>`;
            }).join('');

            const statsHtml = p.stats.map(s => {
                return `
                <div class="stat-row">
                    <div class="stat-label">${s.stat.name.toUpperCase()}:</div>
                    <div class="stat-bar-container">
                        <div class="stat-bar" style="width: ${Math.min(s.base_stat/2, 100)}%; background-color:#4deeea;"></div>
                    </div>
                </div>`;
            }).join('');

            const abilities = p.abilities.map(a => `${a.ability.name} ${a.is_hidden ? '(Oculta)' : ''}`).join(', ');

            // Definimos el origen
            const originText = isCache ? 'DESDE CACHÉ' : 'DESDE API';
            const originClass = isCache ? 'origin-cache' : 'origin-api';

            return `
                <div class="pokemon-card">
                    <div class="origin-label ${originClass}">${originText}</div>

                    <div class="pokemon-img-container">
                        <img src="${p.sprites.front_default}" alt="${p.name}" class="pokemon-img">
                    </div>

                    <div class="pokemon-info">
                        <h2 class="pokemon-name">#${p.id} ${p.name}</h2>
                        <div class="pokemon-types">${typesHtml}</div>
                        <div class="abilities-list"><strong>HABILIDADES:</strong> ${abilities}</div>
                        
                        <div class="stats-grid">${statsHtml}</div>

                        <button class="fav-toggle-btn ${isFav ? 'is-favorite' : ''}" onclick="App.toggleFav('${p.name}')">
                            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        </button>

                        <div class="evolution-section">
                            <h3>CADENA EVOLUTIVA</h3>
                            <div id="evo-chain-container" class="evolution-chain">Cargando...</div>
                        </div>
                    </div>
                </div>`;
        },

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
                if(document.getElementById(containerId)) document.getElementById(containerId).innerHTML = 'No disponible';
            }
        },

        // --- AQUÍ ESTÁ LA LÓGICA DE LOS BOTONES DE HISTORIAL ---
        list: (container, listKey, emptyMsg) => {
            const list = utils.getStorage(listKey);
            const favs = utils.getStorage('favorites'); // Obtenemos favoritos para pintar el corazón
            
            container.innerHTML = '';
            if(!list.length) {
                container.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
                return;
            }

            list.reverse().forEach(name => {
                const isFav = favs.includes(name);
                
                // Si es la lista de HISTORIAL, mostramos los 3 botones
                if (listKey === 'history') {
                    container.innerHTML += `
                    <div class="list-item">
                        <span class="item-name">${name}</span>
                        <div class="item-actions">
                            <button class="nav-btn sm-btn" title="Ver" onclick="App.searchFromList('${name}')">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="nav-btn sm-btn ${isFav ? 'fav-active' : ''}" title="Favorito" onclick="App.toggleFavFromList('${name}')">
                                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                            </button>
                            <button class="nav-btn sm-btn btn-del" title="Borrar" onclick="App.removeFromHistory('${name}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>`;
                } else {
                    // Si es FAVORITOS, mantenemos el estilo simple (o puedes agregar borrar también)
                    container.innerHTML += `
                    <div class="list-item">
                        <span class="item-name">${name}</span>
                        <button class="nav-btn sm-btn" onclick="App.searchFromList('${name}')">VER</button>
                    </div>`;
                }
            });
        }
    };

    // 4. ACCIONES
    const actions = {
        init() {
            el.form.addEventListener('submit', actions.handleSearch);
            el.btnBattle.addEventListener('click', actions.handleBattle);
            
            document.querySelector('#btn-clear-history').addEventListener('click', () => {
                localStorage.removeItem('history');
                render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
            });

            document.querySelector('#btn-clear-favs').addEventListener('click', () => {
                localStorage.removeItem('favorites');
                render.list(el.favList, 'favorites', 'SIN FAVORITOS');
            });
        },

        router(viewId) {
            el.views.forEach(v => v.classList.remove('active'));
            el.navBtns.forEach(b => b.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            document.getElementById(`nav-${viewId}`).classList.add('active');

            if(viewId === 'historial') render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
            if(viewId === 'favoritos') render.list(el.favList, 'favorites', 'SIN FAVORITOS');
        },

        async handleSearch(e) {
            e.preventDefault();
            const query = el.input.value.trim();
            if(!query) return;

            el.container.innerHTML = `<div class="loading">CARGANDO...</div>`;

            try {
                const p = await utils.fetchPokemon(query);
                
                let hist = utils.getStorage('history').filter(h => h !== p.name);
                hist.push(p.name);
                utils.setStorage('history', hist);

                const favs = utils.getStorage('favorites');
                const isFav = favs.includes(p.name);
                el.container.innerHTML = render.card(p, isFav);
                
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

        // Borrar uno individual del historial
        removeFromHistory(name) {
            let hist = utils.getStorage('history');
            hist = hist.filter(h => h !== name);
            utils.setStorage('history', hist);
            // Re-renderizamos la lista
            render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
        },

        // Agregar/Quitar favorito desde la lista de historial
        toggleFavFromList(name) {
            actions.toggleFav(name); // Reutilizamos la lógica de guardado
            // Re-renderizamos el historial para que se actualice el corazón
            render.list(el.historyList, 'history', 'SIN BÚSQUEDAS RECIENTES');
        },

        toggleFav(name) {
            let favs = utils.getStorage('favorites');
            if(favs.includes(name)) {
                favs = favs.filter(f => f !== name);
            } else {
                favs.push(name);
            }
            utils.setStorage('favorites', favs);
            
            // Si estamos viendo la tarjeta del pokemon, actualizamos su botón también
            const btn = document.querySelector('.fav-toggle-btn');
            const currentPokeName = document.querySelector('.pokemon-name');
            
            if (btn && currentPokeName && currentPokeName.textContent.toLowerCase().includes(name)) {
                const icon = btn.querySelector('i');
                btn.classList.toggle('is-favorite');
                icon.classList.toggle('fa-solid');
                icon.classList.toggle('fa-regular');
            }
        },

        async handleBattle() {
            const n1 = el.vsInput1.value.trim();
            const n2 = el.vsInput2.value.trim();
            if(!n1 || !n2) return alert("Ingresa dos Pokémon");

            try {
                const [p1, p2] = await Promise.all([utils.fetchPokemon(n1), utils.fetchPokemon(n2)]);
                el.battleRes.classList.remove('hidden');
                
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

document.addEventListener('DOMContentLoaded', App.init);