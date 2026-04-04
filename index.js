const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const parser = require("iptv-playlist-parser");
const manifest = require("./manifest");

// ==========================================
// ⚠️ COLOQUE O SEU LINK M3U AQUI ABAIXO ⚠️
const URL_DA_LISTA = "http://alphaboxapp3.click:80/get.php?username=22818975&password=17936157&type=m3u_plus&output=ts"; 
// ==========================================

let canais = [];

async function iniciarAddon() {
    try {
        console.log("1. Baixando lista M3U da internet...");
        const resposta = await fetch(URL_DA_LISTA);
        const conteudoM3u = await resposta.text();
        const playlist = parser.parse(conteudoM3u);
        
        console.log("2. Processando canais...");
        canais = playlist.items.map((item, index) => ({
            id: `iptv_${index}`,
            name: item.name,
            logo: item.tvg.logo || "https://via.placeholder.com/256x256.png?text=TV",
            url: item.url,
            group: item.group.title || "Sem Categoria" // Categoria padrão
        }));

        // 3. Extraindo categorias únicas e atualizando o manifesto
        const categoriasUnicas = [...new Set(canais.map(c => c.group))].sort();
        manifest.catalogs[0].extra[0].options = categoriasUnicas;
        console.log(`Sucesso: ${canais.length} canais carregados em ${categoriasUnicas.length} categorias.`);

        // 4. Criando o Addon
        const builder = new addonBuilder(manifest);

        // --- CATÁLOGO E PAGINAÇÃO ---
        builder.defineCatalogHandler((args) => {
            if (args.type === "tv" && args.id === "meus_canais") {
                let canaisParaMostrar = canais;

                // Aplica o filtro de Categoria
                if (args.extra && args.extra.genre) {
                    canaisParaMostrar = canais.filter(canal => canal.group === args.extra.genre);
                }

                // Aplica a Paginação (100 itens por vez)
                const skip = args.extra && args.extra.skip ? parseInt(args.extra.skip) : 0;
                const limite = 100; 
                const canaisPaginados = canaisParaMostrar.slice(skip, skip + limite);

                const metas = canaisPaginados.map(canal => ({
                    id: canal.id,
                    type: "tv",
                    name: canal.name,
                    poster: canal.logo,
                    posterShape: "square" 
                }));
                
                return Promise.resolve({ metas: metas });
            }
            return Promise.resolve({ metas: [] });
        });

        // --- DETALHES DO CANAL ---
        builder.defineMetaHandler((args) => {
            if (args.type === "tv" && args.id.startsWith("iptv_")) {
                const canal = canais.find(c => c.id === args.id);
                if (canal) {
                    return Promise.resolve({
                        meta: {
                            id: canal.id,
                            type: "tv",
                            name: canal.name,
                            poster: canal.logo,
                            posterShape: "square",
                            description: `Você está assistindo: ${canal.name}\nCategoria: ${canal.group}`,
                            genres: [canal.group]
                        }
                    });
                }
            }
            return Promise.resolve({ meta: {} });
        });

        // --- LINK DE STREAMING ---
        builder.defineStreamHandler((args) => {
            if (args.type === "tv" && args.id.startsWith("iptv_")) {
                const canal = canais.find(c => c.id === args.id);
                if (canal) {
                    return Promise.resolve({
                        streams: [{
                            title: canal.name,
                            url: canal.url
                        }]
                    });
                }
            }
            return Promise.resolve({ streams: [] });
        });

        // 5. Inicia o servidor
        serveHTTP(builder.getInterface(), { port: 7000 });
        
        // MENSAGEM ATUALIZADA COM O SEU IP LOCAL
        console.log("===============================================================");
        console.log("✅ TUDO PRONTO!");
        console.log("Para instalar no PC, use:      http://127.0.0.1:7000/manifest.json");
        console.log("Para instalar na TV ou iPad:   http://10.0.0.142:7000/manifest.json");
        console.log("===============================================================");

    } catch (error) {
        console.error("❌ Erro fatal ao iniciar:", error.message);
        console.log("Verifique se o seu link M3U está correto e funcionando.");
    }
}

// Inicia o processo
iniciarAddon();