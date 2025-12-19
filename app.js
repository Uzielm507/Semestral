const App = (() => {
  const API = "https://pokeapi.co/api/v2";
  const CACHE_TTL_MS = 24 * 60 * 3600; // 24 horas

  const STORAGE = {
    cache: "pokedex_cache_v1",
    history: "pokedex_history_v1",     // [pokemonId]
    favorites: "pokedex_favorites_v1"  // [pokemonId]
  };

  const el = {
    navBtns: () => document.querySelectorAll(".nav-btn"),
    views: () => document.querySelectorAll(".view-section"),

    searchMode: () => document.querySelector("#search-mode"),
    input: () => document.querySelector("#pokemon-input"),
    btnSearch: () => document.querySelector("#btn-search"),
    container: () => document.querySelector("#pokemon-container"),

    historyList: () => document.querySelector("#history-list"),
    btnClearHistory: () => document.querySelector("#btn-clear-history"),

    favList: () => document.querySelector("#fav-list"),
    btnClearFavs: () => document.querySelector("#btn-clear-favs"),

    vsInput1: () => document.querySelector("#vs-input-1"),
    vsInput2: () => document.querySelector("#vs-input-2"),
    vsSearch1: () => document.querySelector("#vs-search-1"),
    vsSearch2: () => document.querySelector("#vs-search-2"),
    vsCard1: () => document.querySelector("#vs-card-1"),
    vsCard2: () => document.querySelector("#vs-card-2"),
    btnBattle: () => document.querySelector("#btn-battle"),
    battleArea: () => document.querySelector("#battle-results"),

    battleWinnerRow: () => document.querySelector("#battle-winner-row"),
    battleTypeAdv: () => document.querySelector("#battle-type-adv"),
    battleStatsCompare: () => document.querySelector("#battle-stats-compare"),
    battleScoreCalc: () => document.querySelector("#battle-score-calc")
  };

  const storage = {
    _read(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

    getCacheRoot() {
      return storage._read(STORAGE.cache, { pokemon: {}, ability: {}, type: {} });
    },
    setCacheRoot(root) { storage._write(STORAGE.cache, root); },

    getFavorites() { return storage._read(STORAGE.favorites, []); },
    setFavorites(list) { storage._write(STORAGE.favorites, list); },

    getHistory() { return storage._read(STORAGE.history, []); },
    setHistory(list) { storage._write(STORAGE.history, list); }
  };

  const cache = {
    _now: () => Date.now(),
    _makeKey(kind, query) {
      const q = String(query).trim().toLowerCase();
      return `${kind}:${q}`;
    },
    _get(kind, query) {
      const root = storage.getCacheRoot();
      const key = cache._makeKey(kind, query);
      return root[kind]?.[key] || null; // { data, ts, key }
    },
    _set(kind, query, data) {
      const root = storage.getCacheRoot();
      const key = cache._makeKey(kind, query);
      root[kind] = root[kind] || {};
      root[kind][key] = { data, ts: cache._now(), key };
      storage.setCacheRoot(root);
      return root[kind][key];
    },
    _delPokemonEverywhere(pokemonId) {
      const root = storage.getCacheRoot();
      for (const k of Object.keys(root.pokemon || {})) {
        const entry = root.pokemon[k];
        if (entry?.data?.id === pokemonId) delete root.pokemon[k];
      }
      storage.setCacheRoot(root);
    },
    _isFresh(entry) {
      if (!entry) return false;
      return (cache._now() - entry.ts) <= CACHE_TTL_MS;
    }
  };

  const api = {
    async fetchJson(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },


    async getPokemon(query) {
      const q = String(query).trim().toLowerCase();
      const cached = cache._get("pokemon", q);
      if (cached && cache._isFresh(cached)) {
        return { data: cached.data, origin: "cache" };
      }
      const hadButExpired = !!cached && !cache._isFresh(cached);

      const data = await api.fetchJson(`${API}/pokemon/${encodeURIComponent(q)}`);

      cache._set("pokemon", String(data.id), data);
      cache._set("pokemon", data.name, data);

      history.add(data.id);

      return { data, origin: hadButExpired ? "invalid" : "api" };
    },

    async getAbility(query) {
      const q = String(query).trim().toLowerCase();
      const cached = cache._get("ability", q);
      if (cached && cache._isFresh(cached)) {
        return { data: cached.data, origin: "cache" };
      }
      const hadButExpired = !!cached && !cache._isFresh(cached);

      const data = await api.fetchJson(`${API}/ability/${encodeURIComponent(q)}`);
      cache._set("ability", String(data.id), data);
      cache._set("ability", data.name, data);

      return { data, origin: hadButExpired ? "invalid" : "api" };
    },

    async getSpecies(pokemonIdOrName) {
      const q = String(pokemonIdOrName).trim().toLowerCase();
      return api.fetchJson(`${API}/pokemon-species/${encodeURIComponent(q)}`);
    },

    async getEvolutionChainByUrl(url) {
      return api.fetchJson(url);
    },

    async getType(typeName) {
      const t = String(typeName).trim().toLowerCase();
      const cached = cache._get("type", t);
      if (cached && cache._isFresh(cached)) return cached.data;
      const data = await api.fetchJson(`${API}/type/${encodeURIComponent(t)}`);
      cache._set("type", t, data);
      return data;
    }
  };

  const favorites = {
    has(id) {
      const list = storage.getFavorites();
      return list.includes(id);
    },
    toggle(id) {
      const list = storage.getFavorites();
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      else list.unshift(id);
      storage.setFavorites(list);
      render.favorites();
      render.history();
    },
    remove(id) {
      const list = storage.getFavorites().filter(x => x !== id);
      storage.setFavorites(list);
      render.favorites();
      render.history();
    },
    clear() {
      storage.setFavorites([]);
      render.favorites();
      render.history();
    }
  };

  const history = {
    add(pokemonId) {
      const list = storage.getHistory().filter(x => x !== pokemonId);
      list.unshift(pokemonId);
      storage.setHistory(list);
      render.history();
    },
    remove(pokemonId) {
      storage.setHistory(storage.getHistory().filter(x => x !== pokemonId));
      cache._delPokemonEverywhere(pokemonId);
      render.history();
      render.favorites();
    },
    clear() {
      const root = storage.getCacheRoot();
      root.pokemon = {};
      storage.setCacheRoot(root);
      storage.setHistory([]);
      render.history();
      render.favorites();
    }
  };

  const typeBadge = (name) => `<span class="type-badge">${name.toUpperCase()}</span>`;

  const originLabel = (origin) => {
    if (origin === "cache") return { text: "📦 DESDE CACHÉ", cls: "origin-cache" };
    if (origin === "invalid") return { text: "⏳ CACHÉ INVALIDADO", cls: "origin-invalid" };
    return { text: "🌐 DESDE API", cls: "origin-api" };
  };

  const safe = (s) => String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");

  function buildEvoLevels(chainRoot) {
    const levels = [];
    let current = [chainRoot];
    while (current.length) {
      levels.push(current);
      const next = [];
      for (const node of current) {
        for (const child of (node.evolves_to || [])) next.push(child);
      }
      current = next;
    }
    return levels;
  }

  const render = {
    async pokemonCard(pokemon, origin, selectedNameForEvo = null) {
      const isFav = favorites.has(pokemon.id);
      const { text: oText, cls: oCls } = originLabel(origin);

      const typesHtml = pokemon.types.map(t => typeBadge(t.type.name)).join("");
      const abilitiesHtml = pokemon.abilities.map(a => {
        const hidden = a.is_hidden;
        return `<span class="ability-pill ${hidden ? "hidden":""}">${safe(a.ability.name)}${hidden ? " (Oculta)" : ""}</span>`;
      }).join("");

      const statsHtml = pokemon.stats.map(s => {
        const val = s.base_stat;
        const width = Math.min(100, Math.round(val / 2));
        return `
          <div class="stat-row">
            <div class="stat-label">${safe(s.stat.name)}</div>
            <div class="stat-bar-container">
              <div class="stat-bar" style="width:${width}%"></div>
            </div>
          </div>
        `;
      }).join("");

      let evoHtml = "";
      try {
        const species = await api.getSpecies(pokemon.id);
        const evo = await api.getEvolutionChainByUrl(species.evolution_chain.url);
        const levels = buildEvoLevels(evo.chain);

        const rows = [];
        for (let i = 0; i < levels.length; i++) {
          const rowCards = await Promise.all(levels[i].map(async (node) => {
            const spName = node.species.name;
            const id = node.species.url.split("/").filter(Boolean).pop();
            const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
            const selected = (selectedNameForEvo || pokemon.name).toLowerCase() === spName.toLowerCase();
            return `
              <div class="evo-card ${selected ? "selected":""}" data-name="${safe(spName)}">
                <img src="${img}" alt="${safe(spName)}">
                <span class="name">${safe(spName)}</span>
              </div>
            `;
          }));

          rows.push(`<div class="evo-level">${rowCards.join("")}</div>`);
          if (i < levels.length - 1) rows.push(`<div class="evo-arrow">→</div>`);
        }

        evoHtml = `
          <div class="divider-dash"></div>
          <div class="evo-title">CADENA DE EVOLUCIÓN</div>
          <div class="evo-chain" id="evo-chain">${rows.join("")}</div>
        `;
      } catch (e) {
        evoHtml = "";
      }

      const sprite = pokemon.sprites?.front_default || "";

      return `
        <div class="pokemon-card" data-pokemon-id="${pokemon.id}">
          <div class="origin-label ${oCls}">${oText}</div>

          <div class="pokemon-img-container">
            ${sprite ? `<img class="pokemon-img" src="${sprite}" alt="${safe(pokemon.name)}">` : `<div>NO IMG</div>`}
          </div>

          <div class="pokemon-title">#${pokemon.id} ${safe(pokemon.name)}</div>

          <div class="type-row">${typesHtml}</div>

          <div class="block-title">HABILIDADES</div>
          <div class="ability-row">${abilitiesHtml}</div>

          <div class="block-title">STATS</div>
          ${statsHtml}

          <button class="like-btn ${isFav ? "on":""}" id="like-btn" type="button" title="Favorito">
            ${isFav ? "❤️" : "🤍"}
          </button>

          ${evoHtml}
        </div>
      `;
    },

    abilityCard(ability, origin) {
      const { text: oText, cls: oCls } = originLabel(origin);

      const effectEntry = (ability.effect_entries || []).find(e => e.language?.name === "en")
        || (ability.effect_entries || [])[0];

      const shortEffect = effectEntry?.short_effect || effectEntry?.effect || "Sin descripción.";

      const pokemonList = (ability.pokemon || []).map(p => {
        const name = p.pokemon.name;
        const id = p.pokemon.url.split("/").filter(Boolean).pop();
        const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        return `
          <div class="evo-card" data-name="${safe(name)}" title="Abrir Pokémon">
            <img src="${img}" alt="${safe(name)}">
            <span class="name">${safe(name)}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="pokemon-card">
          <div class="origin-label ${oCls}">${oText}</div>

          <div class="pokemon-title">✨ ${safe(ability.name)} <span style="float:right; font-size:18px; border:4px solid #000; padding:4px 10px; background:var(--yellow)">#${ability.id}</span></div>

          <div class="battle-box" style="background:#dcdcdc">
            <div class="block-title">EFECTO</div>
            <div class="mono">${safe(shortEffect)}</div>
          </div>

          <div class="block-title">POKÉMON CON ESTA HABILIDAD (${ability.pokemon?.length || 0})</div>
          <div class="evo-level" style="gap:12px; flex-wrap:wrap">${pokemonList || "<div class='mono'>Sin datos.</div>"}</div>
        </div>
      `;
    },

    emptyState(kind) {
      if (kind === "history") {
        return `
          <div class="empty-state">
            <div class="ico">📜</div>
            <div class="t1">NO HAY POKÉMONES EN EL HISTÓRICO</div>
            <div class="t2">Busca un pokémon para agregarlo aquí</div>
          </div>
        `;
      }
      if (kind === "favorites") {
        return `
          <div class="empty-state">
            <div class="ico">❤️</div>
            <div class="t1">NO HAY POKÉMONES EN FAVORITOS</div>
            <div class="t2">Dale al corazón en un pokémon para agregarlo aquí</div>
          </div>
        `;
      }
      if (kind === "vs-empty") {
        return `
          <div class="empty-state">
            <div class="ico">❔</div>
            <div class="t1">SELECCIONA UN POKÉMON</div>
            <div class="t2">Busca por ID o nombre</div>
          </div>`;
      }
      return "";
    },

    async history() {
      const list = storage.getHistory();
      const container = el.historyList();
      if (!container) return;

      if (!list.length) {
        container.innerHTML = render.emptyState("history");
        return;
      }

      const items = [];
      for (const id of list) {
        const entry = cache._get("pokemon", String(id));
        if (!entry) continue;

        const origin = cache._isFresh(entry) ? "cache" : "invalid";
        const p = entry.data;
        const sprite = p.sprites?.front_default || "";
        const types = p.types.map(t => typeBadge(t.type.name)).join("");
        const favOn = favorites.has(p.id);

        items.push(`
          <div class="list-item" data-id="${p.id}">
            <div class="mini">${sprite ? `<img src="${sprite}" alt="${safe(p.name)}">` : ""}</div>
            <div class="info">
              <div class="title">#${p.id} ${safe(p.name)}</div>
              <div class="type-row" style="margin:0">${types}</div>
              <div class="mono" style="margin-top:6px; font-weight:900">${originLabel(origin).text}</div>
            </div>
            <div class="actions">
              <button class="icon-btn fav" type="button" title="Favorito">${favOn ? "❤️" : "🤍"}</button>
              <button class="icon-btn trash" type="button" title="Borrar del caché">🗑️</button>
            </div>
          </div>
        `);
      }

      container.innerHTML = items.join("");
    },

    async favorites() {
      const list = storage.getFavorites();
      const container = el.favList();
      if (!container) return;

      if (!list.length) {
        container.innerHTML = render.emptyState("favorites");
        return;
      }

      const items = [];
      for (const id of list) {
        let entry = cache._get("pokemon", String(id));
        let origin = "cache";
        let p = entry?.data;

        if (entry && !cache._isFresh(entry)) origin = "invalid";
        if (!entry) {
          const res = await api.getPokemon(String(id));
          p = res.data;
          origin = res.origin;
        }

        const sprite = p.sprites?.front_default || "";
        const types = p.types.map(t => typeBadge(t.type.name)).join("");

        items.push(`
          <div class="list-item" data-id="${p.id}">
            <div class="mini">${sprite ? `<img src="${sprite}" alt="${safe(p.name)}">` : ""}</div>
            <div class="info">
              <div class="title">#${p.id} ${safe(p.name)}</div>
              <div class="type-row" style="margin:0">${types}</div>
              <div class="mono" style="margin-top:6px; font-weight:900">${originLabel(origin).text}</div>
            </div>
            <div class="actions">
              <button class="icon-btn trash" type="button" title="Quitar de favoritos">🗑️</button>
            </div>
          </div>
        `);
      }

      container.innerHTML = items.join("");
    },

    async vsCards(p1, o1, p2, o2) {
      const slot1 = el.vsCard1();
      const slot2 = el.vsCard2();
      if (!slot1 || !slot2) return;

      slot1.innerHTML = p1 ? render.vsMiniCard(p1, o1) : render.emptyState("vs-empty");
      slot2.innerHTML = p2 ? render.vsMiniCard(p2, o2) : render.emptyState("vs-empty");
    },

    vsMiniCard(pokemon, origin, extra = {}) {
      const { text: oText, cls: oCls } = originLabel(origin);
      const sprite = pokemon.sprites?.front_default || "";
      const types = pokemon.types.map(t => typeBadge(t.type.name)).join("");
      const favOn = favorites.has(pokemon.id);

      const winnerBadge = extra.winner ? `<div class="winner-badge">🏆 GANADOR</div>` : "";

      return `
        <div class="vs-mini-card ${extra.winner ? "winner" : (extra.loser ? "loser" : "")}" data-id="${pokemon.id}">
          ${winnerBadge}
          <div class="mini-origin ${oCls}">${oText.replace("DESDE ", "")}</div>
          ${sprite ? `<img src="${sprite}" alt="${safe(pokemon.name)}">` : ""}
          <div class="name">#${pokemon.id} ${safe(pokemon.name)}</div>
          <div class="type-row" style="justify-content:center; margin: 6px 0 10px 0;">${types}</div>
          ${extra.score != null ? `<div class="score">${Number(extra.score).toFixed(1)} pts</div>` : ""}
          <button class="like-btn ${favOn ? "on":""}" type="button" title="Favorito">${favOn ? "❤️" : "🤍"}</button>
        </div>
      `;
    },

    battleAnalysis({ p1, p2, score1, score2, mult1, mult2 }) {
      const adv1Class = mult1 > 1 ? "good" : (mult1 < 1 ? "bad" : "");
      const adv2Class = mult2 > 1 ? "good" : (mult2 < 1 ? "bad" : "");

      el.battleTypeAdv().innerHTML = `
        <div class="block-title">⚡ VENTAJAS DE TIPO</div>
        <div class="adv-row ${adv1Class}">
          <div class="mono"><b>${safe(p1.name)}</b> vs <b>${safe(p2.name)}</b>: <b>x${mult1.toFixed(2)}</b></div>
        </div>
        <div class="adv-row ${adv2Class}">
          <div class="mono"><b>${safe(p2.name)}</b> vs <b>${safe(p1.name)}</b>: <b>x${mult2.toFixed(2)}</b></div>
        </div>
      `;

      const rows = [
        ["HP","hp"], ["ATK","attack"], ["DEF","defense"],
        ["SP.ATK","special-attack"], ["SP.DEF","special-defense"], ["SPD","speed"]
      ].map(([label, statName]) => {
        const a = p1.stats.find(s => s.stat.name === statName)?.base_stat ?? 0;
        const b = p2.stats.find(s => s.stat.name === statName)?.base_stat ?? 0;
        const max = Math.max(a,b,1);
        const wa = Math.round((a/max)*50);
        const wb = Math.round((b/max)*50);
        return `
          <div class="compare-label">${label}</div>
          <div class="compare-grid">
            <div class="mono" style="text-align:right; font-weight:900">${a}</div>
            <div class="compare-bar">
              <div class="left" style="width:${wa}%"></div>
              <div class="right" style="width:${wb}%"></div>
            </div>
            <div class="mono" style="text-align:left; font-weight:900">${b}</div>
          </div>
        `;
      }).join("");

      el.battleStatsCompare().innerHTML = `
        <div class="block-title">📈 COMPARACIÓN DE STATS</div>
        ${rows}
      `;

      const base1 = utils.baseStatTotal(p1);
      const base2 = utils.baseStatTotal(p2);

      el.battleScoreCalc().innerHTML = `
        <div class="block-title">🧮 CÁLCULO DEL PUNTAJE</div>
        <div class="mono">
          <div><b>Stats Base Total</b>: ${safe(p1.name)}: ${base1} | ${safe(p2.name)}: ${base2}</div>
          <div><b>Multiplicador de Tipo</b>: ${safe(p1.name)}: x${mult1.toFixed(2)} | ${safe(p2.name)}: x${mult2.toFixed(2)}</div>
          <div><b>Puntaje Final</b>: ${safe(p1.name)}: ${score1.toFixed(1)} | ${safe(p2.name)}: ${score2.toFixed(1)}</div>
        </div>
      `;
    }
  };

  const utils = {
    baseStatTotal(p) {
      return (p.stats || []).reduce((acc, s) => acc + (s.base_stat || 0), 0);
    },

    async typeMultiplier(attackerTypes, defenderTypes) {
      let mult = 1;
      for (const at of attackerTypes) {
        const tData = await api.getType(at);
        const rel = tData.damage_relations;

        for (const dt of defenderTypes) {
          const d = dt.toLowerCase();
          if ((rel.no_damage_to || []).some(x => x.name === d)) mult *= 0;
          else if ((rel.double_damage_to || []).some(x => x.name === d)) mult *= 2;
          else if ((rel.half_damage_to || []).some(x => x.name === d)) mult *= 0.5;
        }
      }
      return mult;
    },

    enableBattleIfReady() {
      const btn = el.btnBattle();
      const ready = Boolean(state.vs.p1 && state.vs.p2);
      btn.disabled = !ready;
      btn.classList.toggle("btn-gray", !ready);
      btn.classList.toggle("btn-red", ready);
    }
  };

  const state = {
    view: "buscar",
    vs: { p1: null, o1: "api", p2: null, o2: "api" }
  };

  function router(view) {
    state.view = view;

    el.navBtns().forEach(b => b.classList.remove("active"));
    const map = { buscar: "#nav-buscar", historial: "#nav-historial", vs: "#nav-vs", favoritos: "#nav-favoritos" };
    const btn = document.querySelector(map[view]);
    if (btn) btn.classList.add("active");

    el.views().forEach(v => v.classList.remove("active"));
    const vEl = document.querySelector(`#view-${view}`);
    if (vEl) vEl.classList.add("active");

    if (view === "historial") render.history();
    if (view === "favoritos") render.favorites();
    if (view === "vs") {
      render.vsCards(state.vs.p1, state.vs.o1, state.vs.p2, state.vs.o2);
      utils.enableBattleIfReady();
    }
  }

  async function handleSearch() {
    const mode = el.searchMode().value;
    const q = el.input().value.trim();
    if (!q) return;

    el.container().innerHTML = `<div class="empty-state"><div class="ico">⏳</div><div class="t1">CARGANDO...</div></div>`;

    try {
      if (mode === "pokemon") {
        const res = await api.getPokemon(q);
        el.container().innerHTML = await render.pokemonCard(res.data, res.origin);
        wirePokemonCard(res.data);
      } else {
        const res = await api.getAbility(q);
        el.container().innerHTML = render.abilityCard(res.data, res.origin);
        wireAbilityCard();
      }
    } catch (e) {
      el.container().innerHTML = `<div class="empty-state"><div class="ico">❌</div><div class="t1">NO ENCONTRADO</div><div class="t2">${safe(e.message)}</div></div>`;
    }
  }

  function wirePokemonCard(pokemon) {
    const card = el.container().querySelector(".pokemon-card");
    const like = card?.querySelector("#like-btn");
    if (like) {
      like.addEventListener("click", () => {
        favorites.toggle(pokemon.id);
        like.classList.toggle("on", favorites.has(pokemon.id));
        like.textContent = favorites.has(pokemon.id) ? "❤️" : "🤍";
      });
    }

    const evo = el.container().querySelector("#evo-chain");
    if (evo) {
      evo.querySelectorAll(".evo-card").forEach(c => {
        c.addEventListener("click", async () => {
          const name = c.getAttribute("data-name");
          router("buscar");
          el.searchMode().value = "pokemon";
          el.input().value = name;
          await handleSearch();
        });
      });
    }
  }

  function wireAbilityCard() {
    const wrap = el.container().querySelector(".pokemon-card");
    if (!wrap) return;
    wrap.querySelectorAll(".evo-card").forEach(c => {
      c.addEventListener("click", async () => {
        const name = c.getAttribute("data-name");
        router("buscar");
        el.searchMode().value = "pokemon";
        el.input().value = name;
        await handleSearch();
      });
    });
  }

  function wireHistoryEvents() {
    const container = el.historyList();
    if (!container) return;

    container.addEventListener("click", async (ev) => {
      const row = ev.target.closest(".list-item");
      if (!row) return;
      const id = Number(row.getAttribute("data-id"));
      const isTrash = ev.target.closest(".trash");
      const isFav = ev.target.closest(".fav");
      const clickedCard = ev.target.closest(".info") || ev.target.closest(".mini");

      if (isTrash) { history.remove(id); return; }
      if (isFav) { favorites.toggle(id); return; }

      if (clickedCard) {
        router("buscar");
        el.searchMode().value = "pokemon";
        el.input().value = String(id);
        await handleSearch();
      }
    });
  }

  function wireFavEvents() {
    const container = el.favList();
    if (!container) return;

    container.addEventListener("click", async (ev) => {
      const row = ev.target.closest(".list-item");
      if (!row) return;
      const id = Number(row.getAttribute("data-id"));
      const isTrash = ev.target.closest(".trash");
      const clickedCard = ev.target.closest(".info") || ev.target.closest(".mini");

      if (isTrash) { favorites.remove(id); return; }

      if (clickedCard) {
        router("buscar");
        el.searchMode().value = "pokemon";
        el.input().value = String(id);
        await handleSearch();
      }
    });
  }

  async function vsSearch(which) {
    const q = (which === 1 ? el.vsInput1().value : el.vsInput2().value).trim();
    if (!q) return;

    const slot = which === 1 ? el.vsCard1() : el.vsCard2();
    slot.innerHTML = `<div class="empty-state"><div class="ico">⏳</div><div class="t1">CARGANDO...</div></div>`;

    try {
      const res = await api.getPokemon(q);
      if (which === 1) { state.vs.p1 = res.data; state.vs.o1 = res.origin; }
      else { state.vs.p2 = res.data; state.vs.o2 = res.origin; }

      render.vsCards(state.vs.p1, state.vs.o1, state.vs.p2, state.vs.o2);
      utils.enableBattleIfReady();
      wireVsCardHearts();
    } catch (e) {
      slot.innerHTML = `<div class="empty-state"><div class="ico">❌</div><div class="t1">NO ENCONTRADO</div><div class="t2">${safe(e.message)}</div></div>`;
      if (which === 1) state.vs.p1 = null;
      else state.vs.p2 = null;
      utils.enableBattleIfReady();
    }
  }

  function wireVsCardHearts() {
    [el.vsCard1(), el.vsCard2()].forEach(slot => {
      if (!slot) return;
      slot.querySelectorAll(".vs-mini-card").forEach(card => {
        const id = Number(card.getAttribute("data-id"));
        const btn = card.querySelector(".like-btn");
        if (!btn) return;
        btn.onclick = null;
        btn.addEventListener("click", () => {
          favorites.toggle(id);
          btn.classList.toggle("on", favorites.has(id));
          btn.textContent = favorites.has(id) ? "❤️" : "🤍";
        });
      });
    });
  }

  async function battle() {
    if (!state.vs.p1 || !state.vs.p2) return;

    const p1 = state.vs.p1;
    const p2 = state.vs.p2;

    const types1 = p1.types.map(t => t.type.name);
    const types2 = p2.types.map(t => t.type.name);

    const base1 = utils.baseStatTotal(p1);
    const base2 = utils.baseStatTotal(p2);

    const mult1 = await utils.typeMultiplier(types1, types2);
    const mult2 = await utils.typeMultiplier(types2, types1);

    const score1 = base1 * mult1;
    const score2 = base2 * mult2;

    const p1Winner = score1 >= score2;

    el.battleWinnerRow().innerHTML = `
      <div>${render.vsMiniCard(p1, state.vs.o1, { score: score1, winner: p1Winner, loser: !p1Winner })}</div>
      <div class="vs-mid">VS</div>
      <div>${render.vsMiniCard(p2, state.vs.o2, { score: score2, winner: !p1Winner, loser: p1Winner })}</div>
    `;

    render.battleAnalysis({ p1, p2, score1, score2, mult1, mult2 });

    el.battleArea().classList.remove("hidden");
    wireVsCardHearts();
  }

  function init() {
    el.btnSearch().addEventListener("click", handleSearch);
    el.input().addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
    });

    el.btnClearHistory().addEventListener("click", () => {
      if (confirm("¿Estás seguro de limpiar TODO el histórico/caché?")) history.clear();
    });
    wireHistoryEvents();

    el.btnClearFavs().addEventListener("click", () => {
      if (confirm("¿Estás seguro de limpiar TODOS los favoritos?")) favorites.clear();
    });
    wireFavEvents();

    el.vsSearch1().addEventListener("click", () => vsSearch(1));
    el.vsSearch2().addEventListener("click", () => vsSearch(2));
    el.vsInput1().addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); vsSearch(1); } });
    el.vsInput2().addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); vsSearch(2); } });

    el.btnBattle().addEventListener("click", battle);

    render.history();
    render.favorites();
  }

  return { init, router };
})();

window.addEventListener("DOMContentLoaded", () => App.init());


