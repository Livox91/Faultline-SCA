const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

function sanitizeNeo4jDbName(inputString) {
    return inputString
        .toLowerCase()                     // 1. Force lowercase (Neo4j requirement)
        .replace(/[^a-z0-9.-]/g, '-')     // 2. Replace any illegal character with a dash
        .replace(/^[^a-z]+/, '')           // 3. Remove leading non-letters (must start with a letter)
        .substring(0, 63);                 // 4. Enforce Neo4j's 63-character limit
}


async function createDatabase(name) {
    const session = driver.session();
    sanitized_name = sanitizeNeo4jDbName(name);
    try {
        await session.run(`CREATE DATABASE \`${sanitized_name}\``);
        console.log(`Database '${sanitized_name}' created successfully`);
    } catch (error) {
        console.error('Error creating database:', error);
    } finally {
        await session.close();
    }
}

async function dropDatabase(name) {
    const session = driver.session();
    sanitized_name = sanitizeNeo4jDbName(name);
    try {
        await session.run(`DROP DATABASE  \`${sanitized_name}\``);
        console.log(`Database '${sanitized_name}' dropped successfully`);
    } catch (error) {
        console.error('Error dropping database:', error);
    } finally {
        await session.close();
    }
}


async function closeDriver() {
    await driver.close();
}

module.exports = { driver, closeDriver, createDatabase, dropDatabase };
