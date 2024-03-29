import { ChatOpenAI } from "@langchain/openai";
import { MessagesPlaceholder, ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const chatModel = new ChatOpenAI({});

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You respond to every request with 'no', no matter what it is."],
    new MessagesPlaceholder("messages")
]);

const outputParser = new StringOutputParser();

const chain = prompt.pipe(chatModel).pipe(outputParser);

export { chain }