/* =====================================================
   APP.JS - LÓGICA COMPLETA POKÉMON FINDER
===================================================== */
(() => {
    const App = (() => {

        // --- 1. REFERENCIAS AL DOM ---
        const el = {
            navBuscar: document.getElementById('btn-nav-buscar'),
            navHistorico: document.getElementById('btn-nav-historico'),
            navVs: document.getElementById('btn-nav-vs'),
            navFavoritos: document.getElementById('btn-nav-favoritos'),
            views: document.querySelectorAll('.view-section'),

            // Buscador
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('btn-search-action'),
            searchType: document.getElementsByName('searchType'),
            startMsg: document.getElementById('start-message'),
            
            // Tarjeta Pokémon
            pokemonCard: document.getElementById('pokemon-card-container'),
            sourceBadge: document.getElementById('data-source-badge'),
            pokeName: document.getElementById('poke-name'),
            pokeSprite: document.getElementById('poke-sprite'),
            pokeTypes: document.getElementById('poke-types'),
            pokeAbilities: document.getElementById('poke-abilities'),
            pokeStats: document.getElementById('poke-stats-container'),
            evolutionContainer: document.getElementById('evolution-container'),
            favBtn: document.getElementById('btn-toggle-fav'),

            // Tarjeta Habilidad
            abilityCard: document.getElementById('ability-card-container'),
            abilityName: document.getElementById('ability-name'),
            abilityDesc: document.getElementById('ability-desc'),
            abilityPokeList: document.getElementById('ability-pokemon-list'),

            // Histórico y Favoritos
            historyList: document.getElementById('history-list'),
            clearHistory: document.getElementById('btn-clear-history'),
            favList: document.getElementById('favorites-list'),
            clearFavs: document.getElementById('btn-clear-favorites'),

            // VS
            vsInput1: document.getElementById('vs-input-1'),
            vsInput2: document.getElementById('vs-input-2'),
            vsBtn: document.getElementById('btn-start-battle'),
            battleResults: document.getElementById('battle-results'),
            // ...referencias de luchadores se manejan dinámicamente o podrías agregarlas aquí
        };

        // --- 2. UTILIDADES Y API ---
        const utils = {
            // Obtener tipo de búsqueda (radio buttons)
            getSearchType() {
                return [...el.searchType].find(r => r.checked).value;
            },

            // Fetch genérico a PokeAPI
            async fetchData(endpoint) {
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error('No se encontraron datos');
                return res.json();
            },

            // Manejo de LocalStorage
            getStorage(key) { return JSON.parse(localStorage.getItem(key)) || []; },
            setStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); },

            // Cambiar Vistas
            showView(viewId) {
                el.views.forEach(v => v.classList.add('hidden'));
                document.getElementById(viewId).classList.remove('hidden');
                
                // Actualizar botones del nav
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                const navId = 'btn-nav-' + viewId.replace('view-', '');
                const btn = document.getElementById(navId);
                if(btn) btn.classList.add('active');
            }
        };

        // --- 3. LÓGICA DE RENDERIZADO ---
        const render = {
            
            // Renderizar Pokémon
            async pokemon(data) {
                // 1. Mostrar tarjeta y ocultar mensajes
                el.startMsg.classList.add('hidden');
                el.abilityCard.classList.add('hidden');
                el.pokemonCard.classList.remove('hidden');

                // 2. Datos Básicos
                el.sourceBadge.textContent = "DESDE API"; // O "DESDE CACHÉ" si implementas caché compleja
                el.pokeName.textContent = `#${data.id} ${data.name.toUpperCase()}`;
                
                // Imagen: Intenta usar el arte oficial, si no, el sprite por defecto
                const imgUrl = data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default;
                el.pokeSprite.src = imgUrl;

                // 3. Tipos (Colores visuales)
                el.pokeTypes.innerHTML = data.types.map(t => 
                    `<span class="type-badge">${t.type.name.toUpperCase()}</span>`
                ).join('');

                // 4. Habilidades
                el.pokeAbilities.innerHTML = data.abilities.map(a => 
                    `<div class="ability-tag">${a.ability.name} ${a.is_hidden ? '(Oculta)' : ''}</div>`
                ).join('');

                // 5. Estadísticas con Barras
                el.pokeStats.innerHTML = data.stats.map(s => {
                    // Calculamos un porcentaje simple (max base stat aprox 200)
                    const percent = Math.min((s.base_stat / 200) * 100, 100);
                    return `
                    <div class="stat-row">
                        <span class="stat-label">${s.stat.name.toUpperCase()}:</span>
                        <div class="progress-bar-bg" style="background:#eee; flex:1; height:10px; border:2px solid #000; margin-left:5px;">
                            <div class="progress-bar-fill" style="width: ${percent}%; background: #3eeadf; height:100%;"></div>
                        </div>
                        <span style="font-size:0.8rem; margin-left:5px;">${s.base_stat}</span>
                    </div>`;
                }).join('');

                // 6. Configurar botón favorito
                handlers.syncFavButton(data.name);
                handlers.saveHistory(data.name);

                // 7. Cadena de Evolución (Requiere fetch extra)
                await render.evolutionChain(data.species.url);
            },

            // Renderizar Cadena de Evolución
            async evolutionChain(speciesUrl) {
                el.evolutionContainer.innerHTML = 'Cargando evoluciones...';
                try {
                    const speciesData = await utils.fetchData(speciesUrl);
                    const evoData = await utils.fetchData(speciesData.evolution_chain.url);
                    
                    let chain = evoData.chain;
                    let html = '';

                    // Función recursiva para recorrer el árbol de evolución
                    const traverse = (node) => {
                        // Extraer ID de la URL para obtener la imagen
                        const id = node.species.url.split('/').filter(Boolean).pop();
                        const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
                        
                        html += `
                        <div class="evo-step" style="display:inline-flex; flex-direction:column; align-items:center; margin:0 10px;">
                            <img src="${img}" width="60">
                            <span style="font-size:0.7rem; font-weight:bold;">${node.species.name}</span>
                        </div>`;

                        if (node.evolves_to.length > 0) {
                            html += `<i class="fa-solid fa-arrow-right" style="margin-top:20px;"></i>`;
                            // Por simplicidad, tomamos la primera rama, pero podrían ser varias (ej. Eevee)
                            node.evolves_to.forEach(next => traverse(next));
                        }
                    };

                    el.evolutionContainer.innerHTML = ''; // Limpiar loader
                    // Creamos un contenedor flex para las evoluciones
                    const container = document.createElement('div');
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    
                    // Reiniciar html y procesar
                    html = ''; 
                    traverse(chain);
                    container.innerHTML = html;
                    el.evolutionContainer.appendChild(container);

                } catch (e) {
                    el.evolutionContainer.textContent = 'No se pudo cargar la evolución.';
                }
            },

            // Renderizar Habilidad
            async ability(data) {
                el.startMsg.classList.add('hidden');
                el.pokemonCard.classList.add('hidden');
                el.abilityCard.classList.remove('hidden');

                el.abilityName.textContent = data.name.toUpperCase().replace('-', ' ');
                
                // Buscar descripción en inglés
                const entry = data.effect_entries.find(e => e.language.name === 'en');
                el.abilityDesc.textContent = entry ? entry.effect : 'Sin descripción disponible.';

                // Listar Pokémones
                el.abilityPokeList.innerHTML = data.pokemon.map(p => `
                    <div style="border:2px solid black; padding:5px; margin:2px; font-size:0.8rem; text-align:center;">
                        ${p.pokemon.name}
                    </div>
                `).join('');
            },

            // Listas (Historial / Favoritos)
            simpleList(element, storageKey) {
                const data = utils.getStorage(storageKey);
                element.innerHTML = '';
                if (!data.length) {
                    element.innerHTML = '<div class="empty-state"><p>Lista vacía</p></div>';
                    return;
                }
                // Mostrar últimos agregados primero
                data.reverse().forEach(name => {
                    element.innerHTML += `
                    <div class="list-item" style="border-bottom:2px solid #000; padding:10px; display:flex; justify-content:space-between;">
                        <span>${name.toUpperCase()}</span>
                        <button onclick="document.getElementById('search-input').value='${name}'; document.getElementById('btn-search-action').click();" style="cursor:pointer; background:var(--yellow); border:2px solid #000;">VER</button>
                    </div>`;
                });
            },

            // Batalla
            battle(p1, p2) {
                el.battleResults.classList.remove('hidden');

                // Helper para renderizar tarjeta de peleador
                const renderFighter = (prefix, p) => {
                    document.getElementById(prefix + '-img').src = p.sprites.front_default;
                    document.getElementById(prefix + '-name').textContent = p.name.toUpperCase();
                    
                    const totalStats = p.stats.reduce((sum, s) => sum + s.base_stat, 0);
                    document.getElementById(prefix + '-points').textContent = totalStats + ' PTS';
                    
                    return totalStats;
                };

                const points1 = renderFighter('f1', p1);
                const points2 = renderFighter('f2', p2);

                // Determinar ganador visualmente
                const winnerBadge1 = document.querySelector('#fighter-1-card .winner-badge');
                const winnerBadge2 = document.querySelector('#fighter-2-card .winner-badge');
                
                winnerBadge1.classList.add('hidden');
                winnerBadge2.classList.add('hidden');

                if(points1 > points2) winnerBadge1.classList.remove('hidden');
                else if(points2 > points1) winnerBadge2.classList.remove('hidden');
                
                // Texto de análisis simple
                document.getElementById('type-advantages-text').innerHTML = `
                    <p><strong>${p1.name.toUpperCase()}</strong> tiene ${points1} puntos totales base.</p>
                    <p><strong>${p2.name.toUpperCase()}</strong> tiene ${points2} puntos totales base.</p>
                `;
            }
        };

        // --- 4. MANEJADORES DE EVENTOS ---
        const handlers = {
            async handleSearch() {
                const query = el.searchInput.value.trim().toLowerCase();
                const type = utils.getSearchType();

                if (!query) return alert('Por favor escribe algo.');

                try {
                    if (type === 'pokemon') {
                        const data = await utils.fetchData(`https://pokeapi.co/api/v2/pokemon/${query}`);
                        render.pokemon(data);
                    } else {
                        const data = await utils.fetchData(`https://pokeapi.co/api/v2/ability/${query.replace(/\s+/g, '-')}`);
                        render.ability(data);
                    }
                } catch (error) {
                    alert(error.message);
                }
            },

            saveHistory(name) {
                const hist = utils.getStorage('history');
                // Evitar duplicados consecutivos o mover al inicio
                const newHist = hist.filter(h => h !== name);
                newHist.push(name);
                utils.setStorage('history', newHist);
            },

            toggleFav() {
                const name = el.pokeName.textContent.split(' ')[1].toLowerCase(); // Hack para sacar el nombre del H2
                let favs = utils.getStorage('favorites');
                
                if (favs.includes(name)) {
                    favs = favs.filter(f => f !== name);
                } else {
                    favs.push(name);
                }
                utils.setStorage('favorites', favs);
                handlers.syncFavButton(name);
            },

            syncFavButton(name) {
                const favs = utils.getStorage('favorites');
                const isFav = favs.includes(name.toLowerCase());
                el.favBtn.innerHTML = isFav 
                    ? '<i class="fa-solid fa-heart" style="color:red;"></i>' 
                    : '<i class="fa-regular fa-heart"></i>';
            },

            async handleBattle() {
                const name1 = el.vsInput1.value.trim().toLowerCase();
                const name2 = el.vsInput2.value.trim().toLowerCase();

                if (!name1 || !name2) return alert('Ingresa dos Pokémon para pelear');

                try {
                    const [p1, p2] = await Promise.all([
                        utils.fetchData(`https://pokeapi.co/api/v2/pokemon/${name1}`),
                        utils.fetchData(`https://pokeapi.co/api/v2/pokemon/${name2}`)
                    ]);
                    render.battle(p1, p2);
                } catch (error) {
                    alert('Uno de los Pokémon no existe. Revisa los nombres.');
                }
            }
        };

        // --- 5. INICIALIZACIÓN ---
        const init = () => {
            // Event Listeners
            el.searchBtn.addEventListener('click', handlers.handleSearch);
            el.favBtn.addEventListener('click', handlers.toggleFav);
            el.vsBtn.addEventListener('click', handlers.handleBattle);

            el.clearHistory.addEventListener('click', () => {
                localStorage.removeItem('history');
                render.simpleList(el.historyList, 'history');
            });

            el.clearFavs.addEventListener('click', () => {
                localStorage.removeItem('favorites');
                render.simpleList(el.favList, 'favorites');
            });

            // Navegación
            el.navBuscar.onclick = () => utils.showView('view-buscar');
            el.navHistorico.onclick = () => {
                utils.showView('view-historico');
                render.simpleList(el.historyList, 'history');
            };
            el.navFavoritos.onclick = () => {
                utils.showView('view-favoritos');
                render.simpleList(el.favList, 'favorites');
            };
            el.navVs.onclick = () => utils.showView('view-vs');
        };

        return { init };
    })();

    // Arrancar la App
    document.addEventListener('DOMContentLoaded', App.init);
})();