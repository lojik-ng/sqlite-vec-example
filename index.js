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
const recreateTables = true; //set to false after first run

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
    let files = fs.readdirSync(knowledgebaseDirectory);
    files = files.map(file => {
        const content = fs.readFileSync(path.join(knowledgebaseDirectory, file), 'utf8');
        return {
            metadata: { file },
            content
        }
    })
    await vectorHelper.insertData({ dataArray: files, tableName: 'knowledgebase', dropTable: true });
    vectorHelper.indexTable('knowledgebase');
} else {
    vectorHelper.indexTable('knowledgebase');
}


// Loop through each question
for (const question of questions) {
    // Search the knowledgebase for the question using the vectorHelper.search function
    const results = await vectorHelper.search(question, 'knowledgebase', 3);
    const docs = results.map(result => result.content).join('\n\n\n\n');
    // Construct the prompt to ask the knowledgebase for an answer
    const prompt = `
You are a helpful assistant. Answer the question below using the information from only the knowledgebase.
If you don't know the answer, just say that you don't know or ask the user to re-phrase the question.
Don't try to make up an answer outside of the knowledgebase.

Question: ${question}

Knowledgebase: 
${docs}

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

