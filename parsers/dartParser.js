const Parser = require("tree-sitter");
const Dart = require('@driftlog/tree-sitter-dart');

class DartKnowledgeGraphParser {
    constructor(repoName = "repository") {
        this.parser = new Parser();
        this.parser.setLanguage(Dart);
        this.repoName = repoName;
    }

    /**
     * Parse a single file and return its graph fragment.
     */
    parse(sourceCode, filePath) {
        const tree = this.parser.parse(sourceCode);

        const graph = {
            file: filePath,
            nodes: [],
            relationships: []
        };

        const nodeMap = new Set();

        const addNode = (id, type, name, extra = {}) => {
            if (!nodeMap.has(id)) {
                graph.nodes.push({ id, type, name, ...extra });
                nodeMap.add(id);
            }
        };

        const addRel = (from, to, type, props = {}) => {
            graph.relationships.push({ from, to, type, ...props });
        };

        const getText = node =>
            sourceCode.slice(node.startIndex, node.endIndex);

        // ── Seed the file node and link it to the repo ──────────────────────
        const fileId = `file:${filePath}`;
        const repoId = `repo:${this.repoName}`;

        addNode(repoId, "Repository", this.repoName);
        addNode(fileId, "File", filePath);
        addRel(repoId, fileId, "CONTAINS");

        // ── Main AST walker ──────────────────────────────────────────────────
        //
        // State is carried explicitly so that entering/leaving a class or
        // method scope never bleeds into sibling nodes.
        //
        const walk = (node, currentClass = null, currentMethod = null) => {

            let nextClass = currentClass;
            let nextMethod = currentMethod;

            // ── IMPORTS ────────────────────────────────────────────────────
            if (
                node.type === "import_or_export" ||
                node.type === "import_specification"
            ) {
                const text = getText(node);
                const match = text.match(/['"]([^'"]+)['"]/);

                if (match) {
                    const target = match[1];
                    const importId = `import:${target}`;

                    addNode(importId, "Import", target);

                    // File → Import (source-level)
                    addRel(fileId, importId, "IMPORTS");

                    // File → File when the path looks like a relative dart file
                    if (target.startsWith('.') || target.startsWith('package:')) {
                        const resolvedId = `file:${target}`;
                        addNode(resolvedId, "File", target);
                        addRel(fileId, resolvedId, "IMPORTS_FILE");
                    }
                }
            }

            // ── CLASS ──────────────────────────────────────────────────────
            if (node.type === "class_definition") {

                const nameNode = node.childForFieldName("name");

                if (nameNode) {
                    const className = getText(nameNode);
                    const classId = `class:${className}`;

                    addNode(classId, "Class", className);
                    addRel(fileId, classId, "DECLARES");

                    const text = getText(node);

                    // EXTENDS
                    const extendsMatch = text.match(/extends\s+([A-Za-z0-9_<>, ]+?)(?:\s+(?:implements|with|{))/);
                    if (extendsMatch) {
                        const parent = extendsMatch[1].trim().split('<')[0]; // strip generics
                        addNode(`class:${parent}`, "Class", parent);
                        addRel(classId, `class:${parent}`, "EXTENDS");
                    }

                    // IMPLEMENTS
                    const implementsMatch = text.match(/implements\s+([^{]+)/);
                    if (implementsMatch) {
                        implementsMatch[1]
                            .split(",")
                            .map(v => v.trim().split('<')[0].trim()) // strip generics
                            .filter(Boolean)
                            .forEach(iface => {
                                addNode(`class:${iface}`, "Interface", iface);
                                addRel(classId, `class:${iface}`, "IMPLEMENTS");
                            });
                    }

                    // WITH (mixins)
                    const withMatch = text.match(/with\s+([^{implements]+)/);
                    if (withMatch) {
                        withMatch[1]
                            .split(",")
                            .map(v => v.trim().split('<')[0].trim())
                            .filter(Boolean)
                            .forEach(mixin => {
                                addNode(`class:${mixin}`, "Mixin", mixin);
                                addRel(classId, `class:${mixin}`, "MIXES_IN");
                            });
                    }

                    // Walk the body with class scope set
                    for (const child of node.namedChildren) {
                        walk(child, className, null);
                    }
                    return; // children already walked above — skip the default walk
                }
            }

            // ── MIXIN DEFINITION ──────────────────────────────────────────
            if (node.type === "mixin_declaration") {
                const nameNode = node.childForFieldName("name");
                if (nameNode) {
                    const mixinName = getText(nameNode);
                    const mixinId = `class:${mixinName}`;
                    addNode(mixinId, "Mixin", mixinName);
                    addRel(fileId, mixinId, "DECLARES");

                    for (const child of node.namedChildren) {
                        walk(child, mixinName, null);
                    }
                    return;
                }
            }

            // ── TOP-LEVEL FUNCTION ─────────────────────────────────────────
            if (
                node.type === "function_signature" &&
                !currentClass
            ) {
                const nameNode = node.childForFieldName("name");
                if (nameNode) {
                    const fnName = getText(nameNode);
                    const fnId = `function:${fnName}`;

                    addNode(fnId, "Function", fnName);
                    addRel(fileId, fnId, "DECLARES");

                    nextMethod = fnId;
                }
            }

            // ── CONCRETE METHODS (function_declaration inside a class body) ─
            //
            // tree-sitter-dart surfaces concrete method bodies as
            // `function_declaration` children of a `class_body`.
            // We also catch `getter_declaration` / `setter_declaration`.
            //
            if (
                currentClass &&
                (
                    node.type === "function_declaration" ||
                    node.type === "getter_declaration" ||
                    node.type === "setter_declaration" ||
                    node.type === "constructor_declaration"
                )
            ) {
                const nameNode =
                    node.childForFieldName("name") ||
                    node.childForFieldName("returnType"); // constructors sometimes lack 'name'

                const rawName = nameNode ? getText(nameNode) : currentClass;
                const isStatic = getText(node).trimStart().startsWith("static");
                const methodId = `method:${currentClass}.${rawName}`;

                addNode(methodId, "Method", rawName, {
                    class: currentClass,
                    static: isStatic,
                    kind: node.type
                });

                addRel(`class:${currentClass}`, methodId, "DECLARES");

                nextMethod = methodId;
            }

            // ── ABSTRACT / INTERFACE METHOD SIGNATURES ─────────────────────
            if (node.type === "method_signature" && currentClass) {
                const nameNode = node.childForFieldName("name");
                if (nameNode) {
                    const methodName = getText(nameNode);
                    const methodId = `method:${currentClass}.${methodName}`;
                    const isStatic = getText(node).includes("static");

                    addNode(methodId, "Method", methodName, {
                        class: currentClass,
                        static: isStatic,
                        abstract: true
                    });

                    addRel(`class:${currentClass}`, methodId, "DECLARES");

                    nextMethod = methodId;
                }
            }

            // ── FIELD / PROPERTY ──────────────────────────────────────────
            if (
                node.type === "initialized_identifier" &&
                currentClass
            ) {
                const propName = getText(node);
                const propId = `property:${currentClass}.${propName}`;

                addNode(propId, "Property", propName, { class: currentClass });
                addRel(`class:${currentClass}`, propId, "DECLARES");
            }

            // ── GLOBAL VARIABLES ──────────────────────────────────────────
            if (node.type === "top_level_variable_declaration") {
                const text = getText(node);
                const matches = [...text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=/g)];

                matches.forEach(m => {
                    const variable = m[1];
                    const id = `global:${variable}`;

                    addNode(id, "GlobalVariable", variable);
                    addRel(fileId, id, "DECLARES");
                });
            }

            // ── FUNCTION / METHOD CALLS ────────────────────────────────────
            //
            // tree-sitter-dart uses `call_expression` (not invocation_expression).
            // Shape:  call_expression → function: <expr>   arguments: <args>
            //
            if (node.type === "call_expression" && currentMethod) {
                const fnExprNode = node.childForFieldName("function");

                if (fnExprNode) {
                    const fnText = getText(fnExprNode);

                    // Simple call:  foo(...)
                    // Member call:  obj.foo(...)  or  ClassName.foo(...)
                    const parts = fnText.split(".");
                    const calledName = parts[parts.length - 1];

                    // Ignore very short / punctuation-only tokens
                    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(calledName)) {
                        const calledId = parts.length > 1
                            ? `method:${parts[0]}.${calledName}`
                            : `function:${calledName}`;

                        // Add a placeholder node only if genuinely unknown
                        if (!nodeMap.has(calledId)) {
                            addNode(
                                calledId,
                                parts.length > 1 ? "Method" : "Function",
                                calledName
                            );
                        }

                        addRel(currentMethod, calledId, "CALLS");
                    }
                }
            }

            // ── INSTANTIATES  (new ClassName(...) or ClassName(...)) ───────
            //
            // Dart has both `new_expression` and direct constructor calls that
            // resolve to a `call_expression` whose function is a type identifier.
            //
            if (node.type === "new_expression" && currentMethod) {
                // new ClassName(...)
                const typeNode =
                    node.childForFieldName("constructorInvocation") ||
                    node.children.find(c => c.type === "type_name" || c.type === "identifier");

                if (typeNode) {
                    const typeName = getText(typeNode).split("<")[0].trim(); // strip generics
                    const classId = `class:${typeName}`;

                    if (!nodeMap.has(classId)) {
                        addNode(classId, "Class", typeName);
                    }

                    addRel(currentMethod, classId, "INSTANTIATES");
                }
            }

            // Also catch implicit constructor calls:
            // When a call_expression's function node is a capitalized identifier
            // and it does NOT look like a static method call, treat as INSTANTIATES.
            if (
                node.type === "call_expression" &&
                currentMethod
            ) {
                const fnExprNode = node.childForFieldName("function");
                if (fnExprNode) {
                    const fnText = getText(fnExprNode).trim();
                    // Bare ClassName(...) — capital first letter, no dot
                    if (/^[A-Z][A-Za-z0-9_]*$/.test(fnText)) {
                        const classId = `class:${fnText}`;

                        if (!nodeMap.has(classId)) {
                            addNode(classId, "Class", fnText);
                        }

                        addRel(currentMethod, classId, "INSTANTIATES");
                    }
                }
            }

            // ── DEFAULT: recurse into children with current scope ──────────
            for (const child of node.namedChildren) {
                walk(child, nextClass, nextMethod);
            }
        };

        walk(tree.rootNode);

        return graph;
    }

    /**
     * Merge graphs from multiple files into one unified graph.
     * Deduplicates nodes by id; keeps all relationships.
     */
    static merge(graphs) {
        const merged = { nodes: [], relationships: [] };
        const seen = new Set();

        for (const g of graphs) {
            for (const node of g.nodes) {
                if (!seen.has(node.id)) {
                    merged.nodes.push(node);
                    seen.add(node.id);
                }
            }
            merged.relationships.push(...g.relationships);
        }

        return merged;
    }
}

module.exports = DartKnowledgeGraphParser;