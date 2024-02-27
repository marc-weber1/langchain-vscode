// From https://github.com/barnesoir/chatgpt-vscode-plugin

import OpenAI from "openai";
import * as vscode from 'vscode';

export default class ChatGptViewProvider implements vscode.WebviewViewProvider {
    private webView?: vscode.WebviewView;
    private openAiApi?: OpenAI;
    private apiKey?: string;
    private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    constructor(private context: vscode.ExtensionContext) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this.webView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'askChatGPT') {
                this.sendOpenAiApiRequest(data.value);
            }
            else if(data.type == 'clearChat'){
                this.messages = [];
            }
        });
    }

    public async ensureApiKey() {
        this.apiKey = await this.context.globalState.get('chatgpt-api-key') as string;

        if (!this.apiKey) {
            const apiKeyInput = await vscode.window.showInputBox({
                prompt: "Please enter your OpenAI API Key, can be located at https://openai.com/account/api-keys",
                ignoreFocusOut: true,
            });
            this.apiKey = apiKeyInput!;
            this.context.globalState.update('chatgpt-api-key', this.apiKey);
        }
    }

    public async sendOpenAiApiRequest(prompt: string, code?: string) {
        await this.ensureApiKey();

        if (!this.openAiApi) {
            try {
                this.openAiApi = new OpenAI({apiKey: this.apiKey});
            } catch (error: any) {
                vscode.window.showErrorMessage("Failed to connect to ChatGPT", error?.message);
                return;
            }
        }

        // Create question by adding prompt prefix to code, if provided
        const question = (code) ? `${prompt}: ${code}` : prompt;

        if (!this.webView) {
            await vscode.commands.executeCommand('chatgpt-vscode-plugin.view.focus');
        } else {
            this.webView?.show?.(true);
        }

        let response: string = '';

        this.userSentQuestion(question);
        try {
            let completion;
            try {
                console.log(this.messages);
                completion = await this.openAiApi.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: this.messages
                });
            } catch (error: any) {
                await vscode.window.showErrorMessage("Error sending request to ChatGPT", error);
                return;
            }

            response = completion?.choices[0].message.content || '';

            /*const REGEX_CODEBLOCK = new RegExp('\`\`\`', 'g');
            const matches = response.match(REGEX_CODEBLOCK);
            const count = matches ? matches.length : 0;
            if (count % 2 !== 0) {
                response += '\n\`\`\`';
            }*/

            this.botSentResponse(response);
            
        } catch (error: any) {
            await vscode.window.showErrorMessage("Error sending request to ChatGPT", error);
            return;
        }
    }

    private botSentResponse(response: string){
        this.sendMessageToWebView({ type: 'addResponse', value: response });
        this.messages.push({role: "assistant", content: response});
    }

    private userSentQuestion(message: string){
        this.sendMessageToWebView({ type: 'addQuestion', value: message, code: null });
        this.messages.push({role: "user", content: message});
    }

    private sendMessageToWebView(message: any) {
        this.webView?.webview.postMessage(message);
    }

    private getHtml(webview: vscode.Webview) {

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesMainUri}" rel="stylesheet">
				<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="overflow-hidden">
				<div class="flex flex-col h-screen">
					<div class="flex-1 overflow-y-auto" id="qa-list"></div>
					<div id="in-progress" class="p-4 flex items-center hidden">
                        <div style="text-align: center;">
                            <div>Please wait while we handle your request ❤️</div>
                            <div class="loader"></div>
                            <div>Please note, ChatGPT facing scaling issues which will impact this extension</div>
                        </div>
					</div>
					<div class="p-4 flex items-center">
						<div class="flex-1">
							<textarea
								type="text"
								rows="2"
								class="border p-2 w-full"
								id="question-input"
								placeholder="Ask a question..."
							></textarea>
						</div>
						<button style="background: var(--vscode-button-background)" id="ask-button" class="p-2 ml-5">Ask</button>
						<button style="background: var(--vscode-button-background)" id="clear-button" class="p-2 ml-3">Clear</button>
					</div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}