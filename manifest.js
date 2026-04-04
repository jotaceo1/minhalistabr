const manifest = {
    id: "org.meuiptv.pro",
    version: "2.0.0",
    name: "Meu IPTV Pro",
    description: "Addon completo com Busca, Gêneros e Séries com Temporadas.",
    resources: ["catalog", "meta", "stream"],
    types: ["tv", "movie", "series"], // 1ª CAIXA DA SUA IMAGEM
    catalogs: [
        {
            type: "tv",
            id: "cat_tv",
            name: "TV Ao Vivo",
            extra: [
                { name: "search", isRequired: false }, // CAIXA DE BUSCA
                { name: "genre", isRequired: false, options: [] }, // 2ª CAIXA: GÊNEROS
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "movie",
            id: "cat_filmes",
            name: "Filmes",
            extra: [
                { name: "search", isRequired: false }, 
                { name: "genre", isRequired: false, options: [] },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "series",
            id: "cat_series",
            name: "Séries",
            extra: [
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: [] },
                { name: "skip", isRequired: false }
            ]
        }
    ],
    idPrefixes: ["iptv_"]
};

module.exports = manifest;
