// Import the OpenAI and dotenv libraries
import OpenAI from "openai";
import 'dotenv/config'

// Import the vectorHelper module from the ./vectorHelper.js file
import vectorHelper from "./vectorHelper.js";

// Import the path and fs modules
import path from "path";
import fs from "fs";

// Define the directory containing the knowledgebase files
const knowledgebaseDirectory = 'knowledgebase';

// Define a flag to control whether to recreate the tables in the database
const recreateTables = true;

// Define an array of questions to ask the knowledgebase
const questions = [
    "Who said Nollywood has no shortage of talent and ambition?",
    "which countries have warned their citizens about traveling to the UK?",
    "which SQLite3 library is faster than node-sqlite3?",
    "Is Walz popular in America?",
]

// Create an instance of the OpenAI library using the API key from the environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// If the flag is set to recreate the tables, execute the following code
if (recreateTables) {
    // Drop the knowledgebase table if it exists
    vectorHelper.db.exec(`
        DROP TABLE IF EXISTS knowledgebase;
    `);

    // Create the knowledgebase table
    vectorHelper.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledgebase (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            vector TEXT NOT NULL
        );
    `);

    // Get a list of all files in the knowledgebase directory
    const files = fs.readdirSync(knowledgebaseDirectory);

    // Prepare a statement to insert data into the knowledgebase table
    const insertStmt = vectorHelper.db.prepare("INSERT INTO knowledgebase (content, vector) VALUES (?, ?)");

    // Loop through each file in the knowledgebase directory
    for (const file of files) {
        // Construct the full path to the file
        const filePath = path.join(knowledgebaseDirectory, file);

        // Read the content of the file
        const content = fs.readFileSync(filePath, "utf-8");

        // Embed the content using the vectorHelper.embed function and store the resulting vector
        const vector = await vectorHelper.embed(content);

        // Insert the content and vector into the knowledgebase table
        insertStmt.run(content, JSON.stringify(vector));
    }

    // Prepare a statement to retrieve the id and vector from the knowledgebase table
    const rows = vectorHelper.db.prepare("SELECT id, vector FROM knowledgebase").all();

    // Index the content vectors using the vectorHelper.indexContent function
    await vectorHelper.indexContent({ objectArray: rows.map(({ id, vector }) => ({ id, vector: JSON.parse(vector) })), tableName: 'knowledge_vectors', dropTablerows: true });

}

// Loop through each question
for (const question of questions) {
    // Search the knowledgebase for the question using the vectorHelper.search function and retrieve the IDs of the matching documents
    let docIDs = await vectorHelper.search(question, 'knowledge_vectors', 2);

    // Prepare a statement to retrieve the content from the knowledgebase table for the matching documents
    const docs = vectorHelper.db.prepare(`SELECT content FROM knowledgebase WHERE id IN (${docIDs.map(({ id }) => id).join(",")})`).all();

    // Construct the prompt to ask the knowledgebase for an answer
    const prompt = `
You are a helpful assistant. Answer the question below using the information from only the knowledgebase.
If you don't know the answer, just say that you don't know or ask the user to re-phrase the question.
Don't try to make up an answer outside of the knowledgebase.

Question: ${question}

Knowledgebase: ${docs.map(({ content }) => content).join("\n")}

Answer: `;

    // Use the OpenAI library to generate an answer to the question using the GPT-4o-mini model
    const { choices } = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "user", content: prompt },
        ]
    });

    // Log the generated answer
    console.log({ question, answer: choices[0].message.content });
    console.log(' ')
}

