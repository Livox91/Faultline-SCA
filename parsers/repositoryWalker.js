const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTENSIONS = new Set([
    ".dart"
    // ".ts",
    // ".js",
    // ".py"
]);

function* walkRepository(directory) {
    const entries = fs.readdirSync(directory, {
        withFileTypes: true
    });

    for (const entry of entries) {

        const fullPath = path.join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {

            if (
                entry.name === ".git" ||
                entry.name === "node_modules" ||
                entry.name === "build" ||
                entry.name === "dist" ||
                entry.name === ".dart_tool"
            ) {
                continue;
            }

            yield* walkRepository(fullPath);
        }
        else {

            const ext =
                path.extname(entry.name);

            if (
                SUPPORTED_EXTENSIONS.has(ext)
            ) {
                yield fullPath;
            }
        }
    }
}


module.exports = {
    walkRepository
};