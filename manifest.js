const manifest = {
    id: "org.meuiptv.addon",
    version: "1.0.0",
    name: "Meu IPTV",
    description: "Addon para rodar minha lista com categorias e paginação",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
        {
            type: "tv",
            id: "meus_canais",
            name: "Canais Ao Vivo",
            extra: [
                {
                    name: "genre", // Filtro de categorias
                    isRequired: false, 
                    options: [] 
                },
                {
                    name: "skip", // Paginação para não travar a TV/iPad
                    isRequired: false
                }
            ]
        }
    ],
    idPrefixes: ["iptv_"]
};

module.exports = manifest;