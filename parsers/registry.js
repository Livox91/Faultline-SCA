const DartParser = require("./dartParser");

// const TypeScriptParser =
//     require("./parsers/TypeScriptParser");

// const JavaScriptParser =
//     require("./parsers/JavaScriptParser");

// const PythonParser =
//     require("./parsers/PythonParser");

const parserRegistry = {
    ".dart": new DartParser()
    // ".ts": new TypeScriptParser(),
    // ".js": new JavaScriptParser(),
    // ".py": new PythonParser()
};

module.exports = {
    parserRegistry
};

