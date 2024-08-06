import * as sqliteVec from "sqlite-vec";
import Database from "better-sqlite3";
import OpenAI from "openai";
import 'dotenv/config'

const vectorConfig = {
    chunkLength: 500,
    chuckOverlap: 100,
    embeddingDimension: 768,
    dbPath: "db/demo.db3",
}

const db = new Database(vectorConfig.dbPath);
db.pragma('journal_mode = WAL');
sqliteVec.load(db);

const embeddingAI = new OpenAI({
    // baseURL: "http://localhost:11434/v1",
    apiKey: process.env.OPENAI_API_KEY,
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
        model: "embed",
        input: chunkText(string, vectorConfig.chunkLength, vectorConfig.chuckOverlap)
    });
    return vector.data[0].embedding;
}

const indexContent = async ({ objectArray, tableName, dropTable = true }) => {
    if (dropTable) {
        db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
    }
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName} USING vec0(embedding float[${vectorConfig.embeddingDimension}])`);
    for (const row of objectArray) {
        db.prepare(`INSERT INTO ${tableName}(rowid, embedding) VALUES (?, ?)`,)
            .run(BigInt(row.id), new Float32Array(row.vector));
    }
}

const search = async (searchString, tableName, resultQty = 3) => {
    const query = await embed(searchString);

    const result = db
        .prepare(`SELECT rowid as id, distance FROM ${tableName} WHERE embedding MATCH ? ORDER BY distance LIMIT ${resultQty}`)
        .all(new Float32Array(query));

    return result;
}

export default { vectorConfig, db, embed, chunkText, indexContent, search }

