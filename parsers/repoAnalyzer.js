const fs = require("fs");
const path = require("path");

const GraphBuilder = require("./graphBuilder");

const { walkRepository } = require("./repositoryWalker");

const {
    parserRegistry
} = require("./registry");

function analyzeRepository(repoRoot) {

    const graphBuilder =
        new GraphBuilder();

    for (const filePath of walkRepository(repoRoot)) {

        const ext =
            path.extname(filePath);


        const parser =
            parserRegistry[ext];

        if (!parser)
            continue;


        try {

            const source =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );

            const relativePath =
                path.relative(
                    repoRoot,
                    filePath
                );

            const graph =
                parser.parse(
                    source,
                    relativePath
                );

            graphBuilder.addGraph(graph);

            console.log(
                `Parsed ${relativePath}`
            );
        }
        catch (err) {

            console.error(
                `Failed: ${filePath}`,
                err.message
            );
        }
    }

    return graphBuilder.build();
}

module.exports =
    analyzeRepository;