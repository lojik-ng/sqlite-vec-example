import * as sqliteVec from "sqlite-vec";
import Database from "better-sqlite3";
import OpenAI from "openai";
import 'dotenv/config'
import fs from "fs";

const vectorConfig = {
    chunkLength: 500,
    chuckOverlap: 100,
    embeddingDimension: 768,
    dbPath: "db/rag_database.db3",
    embedModelBaseUrl: "http://localhost:11434/v1",
    embedModelApiKey: "ollama",
    embedModel: "embed",
}

if (!fs.existsSync('db')) {
    fs.mkdirSync('db');
}
const db = new Database(vectorConfig.dbPath);
db.pragma('journal_mode = WAL');
sqliteVec.load(db);

const embeddingAI = new OpenAI({
    baseURL: vectorConfig.embedModelBaseUrl,
    apiKey: vectorConfig.embedModelApiKey,
});

const chunkText = (text, chunkSize, overlap) => {
    const words = text.trim().split(/\s+/);
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (currentChunk.length === 0 || currentLength + word.length + 1 <= chunkSize) {
            currentChunk.push(word);
            currentLength += word.length + (currentChunk.length > 1 ? 1 : 0);
        } else {
            chunks.push(currentChunk.join(' '));

            const overlapWords = Math.floor(overlap / (chunkSize / currentChunk.length));
            i -= overlapWords + 1;  // Move back to include overlap words

            currentChunk = [];
            currentLength = 0;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

const embed = async (string) => {
    const vector = await embeddingAI.embeddings.create({
        model: vectorConfig.embedModel,
        input: chunkText(string, vectorConfig.chunkLength, vectorConfig.chuckOverlap)
    });
    return vector.data[0].embedding;
}

const insertData = async ({ dataArray, tableName, dropTable = true }) => {
    if (dropTable) {
        db.exec(`DROP TABLE IF EXISTS ${tableName}`);
    }

    db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            vector TEXT NOT NULL,
            metadata TEXT NOT NULL
        );`);

    const insertStmt = db.prepare(`INSERT INTO ${tableName} (content, vector, metadata) VALUES (?, ?, ?)`);

    for (const row of dataArray) {
        const vector = await embed(row.content);
        insertStmt.run(row.content, JSON.stringify(vector), JSON.stringify(row.metadata));
    }
}


const indexTable = (tableName) => {
    db.exec(`DROP TABLE IF EXISTS ${tableName}_vector`);
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName}_vector USING vec0(embedding float[${vectorConfig.embeddingDimension}])`);

    const rows = db.prepare(`SELECT id, vector FROM ${tableName}`).all();
    const insertStmt = db.prepare(`INSERT INTO ${tableName}_vector (rowid, embedding) VALUES (?, ?)`);

    for (const row of rows) {
        insertStmt.run(BigInt(row.id), new Float32Array(JSON.parse(row.vector)));
    }
}

const search = async (text, tableName, resultQty = 3) => {
    const query = await embed(text);

    const result = db
        .prepare(`SELECT rowid as id, distance FROM ${tableName}_vector WHERE embedding MATCH ? ORDER BY distance LIMIT ${resultQty}`)
        .all(new Float32Array(query));

    const docIDs = result.map(row => row.id).join(',');
    const sql = `SELECT content, metadata FROM ${tableName} WHERE id IN (${docIDs})`;

    const docs = db.prepare(sql).all();

    return docs
}

export default { vectorConfig, db, embed, chunkText, insertData, indexTable, search }

