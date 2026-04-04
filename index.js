const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest");
const readline = require("readline");
const { Readable } = require("stream");

// ==========================================
// ⚠️ COLOQUE O SEU LINK M3U AQUI ABAIXO ⚠️
const URL_DA_LISTA = "http://alphaboxapp3.click:80/get.php?username=22818975&password=17936157&type=m3u_plus&output=ts"; 
// ==========================================

// Nosso novo "Banco de Dados" separado
const db = {
    tv: [],
    movie: [],
    series: {} // Séries serão agrupadas por nome
};

// Ferramenta para formatar strings e ajudar nas buscas
const limparTexto = (texto) => texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function iniciarAddon() {
    try {
        console.log("1. Conectando ao link M3U...");
        const resposta = await fetch(URL_DA_LISTA);
        if (!resposta.ok) throw new Error("Falha ao acessar o link");

        console.log("2. Separando TV, Filmes e Séries (Modo Econômico)...");
        const bodyStream = Readable.fromWeb(resposta.body);
        const rl = readline.createInterface({ input: bodyStream });

        let canalAtual = null;
        let idCounter = 0;

        // Expressão Regular para achar Séries (Ex: Nome da Série S01E05)
        // Isso varia por provedor. Tenta achar S(número)E(número)
        const regexSerie = /(.*?)\s*[-_]?\s*[Ss](\d+)[Ee](\d+)/i;

        for await (const linha of rl) {
            const texto = linha.trim();

            if (texto.startsWith("#EXTINF:")) {
                const groupMatch = texto.match(/group-title="([^"]+)"/i);
                const logoMatch = texto.match(/tvg-logo="([^"]+)"/i);
                const nomeRaw = texto.split(",").pop().trim();
                
                canalAtual = {
                    nomeOriginal: nomeRaw,
                    grupo: groupMatch ? groupMatch[1] : "Geral",
                    logo: logoMatch ? logoMatch[1] : "https://via.placeholder.com/256x256.png?text=Midia"
                };

            } else if (texto.startsWith("http") && canalAtual) {
                canalAtual.url = texto;
                const categoriaLower = canalAtual.grupo.toLowerCase();
                
                // Tenta ver se o nome bate com o padrão de Série
                const matchSerie = canalAtual.nomeOriginal.match(regexSerie);

                // LÓGICA DE SEPARAÇÃO:
                if (matchSerie) {
                    // É SÉRIE!
                    const nomeSerie = matchSerie[1].trim() || "Série Desconhecida";
                    const temporada = parseInt(matchSerie[2], 10);
                    const episodio = parseInt(matchSerie[3], 10);
                    const idSerie = `iptv_series_${Buffer.from(nomeSerie).toString('base64').substring(0, 10)}`; // ID único pra série

                    // Se a série ainda não existe no nosso DB, criamos
                    if (!db.series[nomeSerie]) {
                        db.series[nomeSerie] = {
                            id: idSerie,
                            name: nomeSerie,
                            logo: canalAtual.logo,
                            group: canalAtual.grupo,
                            videos: [] // Lista de episódios
                        };
                    }

                    // Adiciona o episódio à série
                    db.series[nomeSerie].videos.push({
                        id: `${idSerie}:${temporada}:${episodio}`,
                        title: `T${temporada} E${episodio} - ${canalAtual.nomeOriginal}`,
                        season: temporada,
                        episode: episodio,
                        released: new Date().toISOString(), // Necessário pro Stremio exibir certo
                        streams: [{ title: "Assistir", url: canalAtual.url }]
                    });

                } else if (categoriaLower.includes("filme") || categoriaLower.includes("vod") || categoriaLower.includes("cinema")) {
                    // É FILME!
                    db.movie.push({
                        id: `iptv_movie_${idCounter++}`,
                        name: canalAtual.nomeOriginal,
                        logo: canalAtual.logo,
                        group: canalAtual.grupo,
                        url: canalAtual.url
                    });
                } else {
                    // É TV!
                    db.tv.push({
                        id: `iptv_tv_${idCounter++}`,
                        name: canalAtual.nomeOriginal,
                        logo: canalAtual.logo,
                        group: canalAtual.grupo,
                        url: canalAtual.url
                    });
                }
                canalAtual = null;
            }
        }

        // Converte o Objeto de Séries em uma Array para facilitar o catálogo
        const seriesArray = Object.values(db.series);

        console.log(`✅ Sucesso! TV: ${db.tv.length} | Filmes: ${db.movie.length} | Séries: ${seriesArray.length}`);

        const builder = new addonBuilder(manifest);

        // --- HANDLER DE CATÁLOGO (COM BUSCA) ---
        builder.defineCatalogHandler((args) => {
            let itensParaMostrar = [];

            // Define qual banco de dados usar baseado no catálogo solicitado
            if (args.type === "tv") itensParaMostrar = db.tv;
            else if (args.type === "movie") itensParaMostrar = db.movie;
            else if (args.type === "series") itensParaMostrar = seriesArray;

            // FERRAMENTA DE BUSCA
            if (args.extra && args.extra.search) {
                const termoBusca = limparTexto(args.extra.search);
                itensParaMostrar = itensParaMostrar.filter(item => 
                    limparTexto(item.name).includes(termoBusca)
                );
            }

            // Paginação
            const skip = args.extra && args.extra.skip ? parseInt(args.extra.skip) : 0;
            const itensPaginados = itensParaMostrar.slice(skip, skip + 100);

            const metas = itensPaginados.map(item => ({
                id: item.id,
                type: args.type,
                name: item.name,
                poster: item.logo,
                posterShape: args.type === "tv" ? "square" : "poster" // Poster de cinema pra filmes/series
            }));
            
            return Promise.resolve({ metas });
        });

        // --- HANDLER DE METADADOS (ONDE AS TEMPORADAS APARECEM) ---
        builder.defineMetaHandler((args) => {
            let metaData = null;

            if (args.type === "tv") metaData = db.tv.find(i => i.id === args.id);
            else if (args.type === "movie") metaData = db.movie.find(i => i.id === args.id);
            else if (args.type === "series") {
                const serieEncontrada = seriesArray.find(s => s.id === args.id);
                if (serieEncontrada) {
                    // O Stremio agrupa por temporadas magicamente se enviarmos a array 'videos'
                    metaData = { ...serieEncontrada };
                    // Organiza os episódios do menor pro maior pra não ficar bagunçado
                    metaData.videos.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                }
            }

            if (metaData) {
                return Promise.resolve({
                    meta: {
                        id: metaData.id,
                        type: args.type,
                        name: metaData.name,
                        poster: metaData.logo,
                        posterShape: args.type === "tv" ? "square" : "poster",
                        description: `Categoria: ${metaData.group}`,
                        videos: metaData.videos || [] // Isso cria as temporadas na tela da Série!
                    }
                });
            }
            return Promise.resolve({ meta: {} });
        });

        // --- HANDLER DE STREAM ---
        builder.defineStreamHandler((args) => {
            if (args.type === "series") {
                // Acha a série e depois acha o episódio específico clicado
                const [idSerie] = args.id.split(":"); // O Stremio pede o video no formato ID:Temp:Ep
                const serie = seriesArray.find(s => s.id === idSerie);
                if (serie) {
                    const episodio = serie.videos.find(v => v.id === args.id);
                    if (episodio) return Promise.resolve({ streams: episodio.streams });
                }
            } else {
                // Para Filmes e TV
                const lista = args.type === "tv" ? db.tv : db.movie;
                const item = lista.find(i => i.id === args.id);
                if (item) return Promise.resolve({ streams: [{ title: item.name, url: item.url }] });
            }
            return Promise.resolve({ streams: [] });
        });

        // 5. Inicia o servidor
        const PORT = process.env.PORT || 7000;
        serveHTTP(builder.getInterface(), { port: PORT });
        console.log(`🚀 Addon Pro rodando na porta ${PORT}!`);

    } catch (error) {
        console.error("❌ Erro fatal:", error.message);
    }
}

iniciarAddon();
