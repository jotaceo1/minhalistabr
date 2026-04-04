const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest");
const readline = require("readline");
const { Readable } = require("stream");

// ==========================================
// ⚠️ COLOQUE O SEU LINK M3U AQUI ABAIXO ⚠️
const URL_DA_LISTA = "http://alphaboxapp3.click:80/get.php?username=22818975&password=17936157&type=m3u_plus&output=ts"; 
// ==========================================

const db = { tv: [], movie: [], series: {} };

const limparTexto = (texto) => texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function iniciarAddon() {
    try {
        console.log("1. Lendo a sua lista M3U...");
        const resposta = await fetch(URL_DA_LISTA);
        if (!resposta.ok) throw new Error("Falha ao acessar o link");

        const bodyStream = Readable.fromWeb(resposta.body);
        const rl = readline.createInterface({ input: bodyStream, crlfDelay: Infinity });

        let c = null; 
        let idCounter = 0;
        const regexSerie = /(.*?)\s*[-_]?\s*[Ss](\d+)[Ee](\d+)/i;

        for await (const linha of rl) {
            const txt = linha.trim(); 

            if (txt.startsWith("#EXTINF:")) {
                const groupMatch = txt.match(/group-title="([^"]+)"/i);
                const logoMatch = txt.match(/tvg-logo="([^"]+)"/i);
                
                c = {
                    nome: txt.split(",").pop().trim(),
                    grupo: groupMatch ? groupMatch[1] : "Geral",
                    logo: logoMatch ? logoMatch[1] : null 
                };

            } else if (txt.startsWith("http") && c) {
                const catLower = c.grupo.toLowerCase();
                const matchSerie = c.nome.match(regexSerie);

                if (matchSerie) {
                    const nomeSerie = matchSerie[1].trim() || "Serie";
                    const temp = parseInt(matchSerie[2], 10);
                    const ep = parseInt(matchSerie[3], 10);

                    if (!db.series[nomeSerie]) {
                        db.series[nomeSerie] = {
                            id: `iptv_s_${idCounter++}`, 
                            name: nomeSerie,
                            logo: c.logo || "https://via.placeholder.com/256x256.png?text=Serie",
                            group: c.grupo,
                            videos: []
                        };
                    }

                    db.series[nomeSerie].videos.push({
                        id: `${db.series[nomeSerie].id}:${temp}:${ep}`,
                        title: `T${temp} E${ep} - ${c.nome}`,
                        season: temp,
                        episode: ep,
                        released: new Date().toISOString(),
                        url: txt 
                    });

                } else if (catLower.includes("filme") || catLower.includes("vod") || catLower.includes("cinema")) {
                    db.movie.push({
                        id: `iptv_m_${idCounter++}`,
                        name: c.nome,
                        logo: c.logo || "https://via.placeholder.com/256x256.png?text=Filme",
                        group: c.grupo,
                        url: txt
                    });
                } else {
                    db.tv.push({
                        id: `iptv_t_${idCounter++}`,
                        name: c.nome,
                        logo: c.logo || "https://via.placeholder.com/256x256.png?text=TV",
                        group: c.grupo,
                        url: txt
                    });
                }
                c = null; 
            }
        }

        const seriesArray = Object.values(db.series);
        
        // --- PREENCHENDO O MENU DE GÊNEROS ---
        // Pega as categorias únicas de cada aba e remove os espaços vazios
        const catTv = [...new Set(db.tv.map(i => i.group))].filter(Boolean).sort();
        const catMovie = [...new Set(db.movie.map(i => i.group))].filter(Boolean).sort();
        const catSeries = [...new Set(seriesArray.map(i => i.group))].filter(Boolean).sort();

        // Injeta as categorias dentro do Manifesto
        manifest.catalogs[0].extra.find(e => e.name === "genre").options = catTv;
        manifest.catalogs[1].extra.find(e => e.name === "genre").options = catMovie;
        manifest.catalogs[2].extra.find(e => e.name === "genre").options = catSeries;

        console.log(`✅ Tudo certo! TV: ${db.tv.length} | Filmes: ${db.movie.length} | Séries: ${seriesArray.length}`);

        db.series = null; 

        const builder = new addonBuilder(manifest);

        // --- SISTEMA DE CATÁLOGO (GRADE, BUSCA E FILTROS) ---
        builder.defineCatalogHandler((args) => {
            let lista = [];
            if (args.type === "tv") lista = db.tv;
            else if (args.type === "movie") lista = db.movie;
            else if (args.type === "series") lista = seriesArray;

            // Ativa a Busca
            if (args.extra && args.extra.search) {
                const busca = limparTexto(args.extra.search);
                lista = lista.filter(i => limparTexto(i.name).includes(busca));
            }

            // Ativa o Filtro de Gêneros
            if (args.extra && args.extra.genre) {
                lista = lista.filter(i => i.group === args.extra.genre);
            }

            // Ativa a Paginação para não travar
            const skip = args.extra && args.extra.skip ? parseInt(args.extra.skip) : 0;
            const metas = lista.slice(skip, skip + 100).map(item => ({
                id: item.id,
                type: args.type,
                name: item.name,
                poster: item.logo,
                posterShape: args.type === "tv" ? "square" : "poster"
            }));
            
            return Promise.resolve({ metas });
        });

        // --- SISTEMA DE METADADOS (ONDE AS TEMPORADAS APARECEM) ---
        builder.defineMetaHandler((args) => {
            let meta = null;
            if (args.type === "tv") meta = db.tv.find(i => i.id === args.id);
            else if (args.type === "movie") meta = db.movie.find(i => i.id === args.id);
            else if (args.type === "series") {
                const serie = seriesArray.find(s => s.id === args.id);
                if (serie) {
                    meta = { ...serie };
                    meta.videos.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                }
            }

            if (meta) {
                return Promise.resolve({
                    meta: {
                        id: meta.id,
                        type: args.type,
                        name: meta.name,
                        poster: meta.logo,
                        posterShape: args.type === "tv" ? "square" : "poster",
                        description: `Categoria: ${meta.group}`,
                        genres: [meta.group],
                        videos: meta.videos || [] // Isso cria o botão de Temporadas!
                    }
                });
            }
            return Promise.resolve({ meta: {} });
        });

        // --- SISTEMA DE LINKS DE VÍDEO ---
        builder.defineStreamHandler((args) => {
            if (args.type === "series") {
                const [idSerie] = args.id.split(":"); 
                const serie = seriesArray.find(s => s.id === idSerie);
                if (serie) {
                    const ep = serie.videos.find(v => v.id === args.id);
                    if (ep) return Promise.resolve({ streams: [{ title: "Assistir", url: ep.url }] });
                }
            } else {
                const lista = args.type === "tv" ? db.tv : db.movie;
                const item = lista.find(i => i.id === args.id);
                if (item) return Promise.resolve({ streams: [{ title: item.name, url: item.url }] });
            }
            return Promise.resolve({ streams: [] });
        });

        const PORT = process.env.PORT || 7000;
        serveHTTP(builder.getInterface(), { port: PORT });
        console.log(`🚀 Servidor rodando na porta ${PORT}!`);

    } catch (error) {
        console.error("❌ Erro fatal:", error.message);
    }
}

iniciarAddon();
