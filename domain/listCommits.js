const { Octokit } = require('octokit');
const { driver } = require('../neo4j/driver');

function sanitizeNeo4jDbName(inputString) {
    return inputString
        .toLowerCase()                     // 1. Force lowercase (Neo4j requirement)
        .replace(/[^a-z0-9.-]/g, '-')     // 2. Replace any illegal character with a dash
        .replace(/^[^a-z]+/, '')           // 3. Remove leading non-letters (must start with a letter)
        .substring(0, 63);                 // 4. Enforce Neo4j's 63-character limit
}

async function listAndIngestCommits(authOctokit, owner, repo) {
    const sanitized_name = sanitizeNeo4jDbName(`${owner}_${repo}`);
    const session = driver.session({ database: sanitized_name });

    try {
        console.log(`Fetching commit history for ${owner}/${repo}...`);


        let allCommits = [];
        let page = 1;
        let commits;
        do {
            commits = await authOctokit.rest.repos.listCommits({
                owner,
                repo,
                per_page: 100,
                page
            });
            allCommits = allCommits.concat(commits.data);
            page++;
        } while (commits.data.length === 100);

        console.log(`Found ${allCommits.length} commits. Fetching detailed file changes...`);

        const fullCommitData = [];

        // 3. Fetch full details for each commit to get the 'files' array
        for (const commit of allCommits) {
            const { data: detailedCommit } = await authOctokit.rest.repos.getCommit({
                owner,
                repo,
                ref: commit.sha
            });
            fullCommitData.push(detailedCommit);
        }

        console.log('Formatting complete. Pushing data array to Neo4j...');

        // 4. The Cypher query handling the Nodes and Relationships
        const cypherQuery = `
            UNWIND $jsonArray AS data

            MERGE (c:Commit {sha: data.sha})
            SET c.message = data.commit.message,
                c.date = datetime(data.commit.author.date),
                c.url = data.html_url,
                c.total_changes = data.stats.total

            FOREACH (parent IN data.parents |
                MERGE (p:Commit {sha: parent.sha})
                MERGE (c)-[:HAS_PARENT]->(p)
            )

            MERGE (author:User {login: data.author.login})
            SET author.id = data.author.id, 
            
            MERGE (author)-[:AUTHORED]->(c)

            MERGE (committer:User {login: data.committer.login})
            SET committer.id = data.committer.id, 
            
            MERGE (committer)-[:COMMITTED]->(c)

            FOREACH (file IN data.files |
                MERGE (f:File {filename: file.filename})
                
                FOREACH (_ IN CASE WHEN file.status = 'modified' THEN [1] ELSE [] END |
                    MERGE (c)-[r:MODIFIED]->(f)
                    SET r.additions = file.additions, r.deletions = file.deletions, r.changes = file.changes
                )
                
                FOREACH (_ IN CASE WHEN file.status = 'added' THEN [1] ELSE [] END |
                    MERGE (c)-[r:ADDED]->(f)
                    SET r.additions = file.additions
                )
                
                FOREACH (_ IN CASE WHEN file.status = 'removed' THEN [1] ELSE [] END |
                    MERGE (c)-[r:DELETED]->(f)
                    SET r.deletions = file.deletions
                )
            )
        `;

        // 5. Execute the query with our data array passed as a parameter
        await session.run(cypherQuery, { jsonArray: fullCommitData });

        console.log(`Successfully ingested commits into your Neo4j graph!`);



    } catch (error) {
        console.error("Error processing commits:", error);
    } finally {
        // Always close the session to free up resources
        await session.close();
    }
}


module.exports = {
    listAndIngestCommits
};
