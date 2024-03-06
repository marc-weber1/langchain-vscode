import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
});

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You respond to every request with 'no', no matter what it is."],
    ["user", "{input}"],
]);

const chain = prompt.pipe(chatModel);

export { chain }