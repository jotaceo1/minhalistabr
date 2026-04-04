const manifest = {
    id: "org.meuiptv.pro",
    version: "2.0.0",
    name: "Meu IPTV Pro",
    description: "Addon IPTV com Filmes, Séries agrupadas, Busca e Categorias separadas.",
    resources: ["catalog", "meta", "stream"],
    types: ["tv", "movie", "series"],
    catalogs: [
        {
            type: "tv",
            id: "cat_tv",
            name: "TV Ao Vivo",
            extra: [
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: [] }, // <-- GÊNEROS DE VOLTA
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "movie",
            id: "cat_filmes",
            name: "Filmes",
            extra: [
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: [] }, // <-- GÊNEROS DE VOLTA
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "series",
            id: "cat_series",
            name: "Séries",
            extra: [
                { name: "search", isRequired: false },
                { name: "genre", isRequired: false, options: [] }, // <-- GÊNEROS DE VOLTA
                { name: "skip", isRequired: false }
            ]
        }
    ],
    idPrefixes: ["iptv_"]
};

module.exports = manifest;
