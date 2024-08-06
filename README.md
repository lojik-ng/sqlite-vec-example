# sqlite-vec NodeJS  RAG example

Simple RAG (Retrieval Augmented generation) example With sqlite-vec local vector database.

### About sqlite-vec
sqlite-vec is an extremely small, "fast enough" vector search SQLite extension that runs anywhere! A successor to sqlite-vss.

### About this example
This example uses openai library but works with ollama, groq, together and any llm provider that supports openai library.

- I used several text files in the knowledgebase folder as knowledge source, then copied the contents into sqlite tables. 
- I used ollama embedding api (with openai library) to generate embeddings of the content. You may need to change it from ollama to normal openai or third parties.

```
rename .env_sample to .env
run npm install
run npm start
```

Its bacically self explanatory when you check the code and its also verbosely commented.


[https://github.com/asg017/sqlite-vec](https://github.com/asg017/sqlite-vec)