const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const manifest = require("./manifest");
const readline = require("readline");
const { Readable } = require("stream");

// ==========================================
// ⚠️ COLOQUE O SEU LINK M3U AQUI ABAIXO ⚠️
const URL_DA_LISTA = "http://alphaboxapp3.click:80/get.php?username=22818975&password=17936157&type=m3u_plus&output=ts"; 
// ==========================================

let canais = [];

async function iniciarAddon() {
    try {
        console.log("1. Conectando ao link M3U...");
        const resposta = await fetch(URL_DA_LISTA);

        if (!resposta.ok) {
            throw new Error(`Falha ao acessar o link: ${resposta.status}`);
        }

        console.log("2. Lendo linha por linha (Modo Econômico de Memória)...");
        
        // Converte o download em um fluxo de leitura contínua (canudinho)
        const bodyStream = Readable.fromWeb(resposta.body);
        const rl = readline.createInterface({ input: bodyStream });

        let canalAtual = null;
        let contador = 0;

        // Processa o arquivo linha por linha sem lotar a memória RAM
        for await (const linha of rl) {
            const texto = linha.trim();

            if (texto.startsWith("#EXTINF:")) {
                canalAtual = { id: `iptv_${contador}` };

                // Puxa a logo se tiver
                const logoMatch = texto.match(/tvg-logo="([^"]+)"/);
                canalAtual.logo = logoMatch ? logoMatch[1] : "https://via.placeholder.com/256x256.png?text=TV";

                // Puxa a categoria se tiver
                const groupMatch = texto.match(/group-title="([^"]+)"/);
                canalAtual.group = groupMatch ? groupMatch[1] : "Sem Categoria";

                // Puxa o nome do canal (fica depois da última vírgula)
                const partes = texto.split(",");
                canalAtual.name = partes.length > 1 ? partes[partes.length - 1].trim() : `Canal ${contador}`;

            } else if (texto.startsWith("http") && canalAtual) {
                // Achou o link, junta com as infos e guarda!
                canalAtual.url = texto;
                canais.push(canalAtual);
                canalAtual = null; // Reseta para o próximo
                contador++;
            }
        }

        // 3. Extraindo categorias únicas
        const categoriasUnicas = [...new Set(canais.map(c => c.group))].sort();
        manifest.catalogs[0].extra[0].options = categoriasUnicas;
        console.log(`✅ Sucesso: ${canais.length} canais carregados em ${categoriasUnicas.length} categorias.`);

        // 4. Criando o Addon
        const builder = new addonBuilder(manifest);

        // --- CATÁLOGO ---
        builder.defineCatalogHandler((args) => {
            if (args.type === "tv" && args.id === "meus_canais") {
                let canaisParaMostrar = canais;

                if (args.extra && args.extra.genre) {
                    canaisParaMostrar = canais.filter(canal => canal.group === args.extra.genre);
                }

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

        // --- METADADOS ---
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

        // --- STREAM ---
        builder.defineStreamHandler((args) => {
            if (args.type === "tv" && args.id.startsWith("iptv_")) {
                const canal = canais.find(c => c.id === args.id);
                if (canal) {
                    return Promise.resolve({ streams: [{ title: canal.name, url: canal.url }] });
                }
            }
            return Promise.resolve({ streams: [] });
        });

        // 5. Inicia o servidor com a porta do Render
        const PORT = process.env.PORT || 7000;
        serveHTTP(builder.getInterface(), { port: PORT });
        
        console.log(`🚀 Addon online e rodando na porta ${PORT}!`);

    } catch (error) {
        console.error("❌ Erro fatal ao iniciar:", error.message);
    }
}

iniciarAddon();
