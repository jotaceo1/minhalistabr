const manifest = {
    id: "org.meuiptv.pro",
    version: "2.0.0",
    name: "Meu IPTV Pro",
    description: "Addon IPTV completo com Filmes, Séries agrupadas e Busca integrada.",
    resources: ["catalog", "meta", "stream"],
    types: ["tv", "movie", "series"], // Adicionado Filmes e Séries
    catalogs: [
        {
            type: "tv",
            id: "cat_tv",
            name: "TV Ao Vivo",
            extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }]
        },
        {
            type: "movie",
            id: "cat_filmes",
            name: "Filmes",
            extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }]
        },
        {
            type: "series",
            id: "cat_series",
            name: "Séries",
            extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }]
        }
    ],
    idPrefixes: ["iptv_"]
};

module.exports = manifest;
