// From https://github.com/barnesoir/chatgpt-vscode-plugin

import * as vscode from 'vscode';
import * as fs from 'fs';
import { BaseMessage, ChatMessage } from '@langchain/core/messages';

export default class ChatGptViewProvider implements vscode.WebviewViewProvider {
    private webView?: vscode.WebviewView;
    private chain?: any;
    private openAIAPIKey?: string;
    private messages: BaseMessage[] = [];

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
            if (data.type === 'askLLM') {
                this.askLLM(data.value);
            }
            else if(data.type == 'clearChat'){
                this.messages = [];
            }
        });
    }

    public async ensureopenAIAPIKey() {
        this.openAIAPIKey = await this.context.globalState.get('chatgpt-api-key') as string;

        if (!this.openAIAPIKey) {
            const openAIAPIKeyInput = await vscode.window.showInputBox({
                prompt: "Please enter your OpenAI API Key, can be located at https://openai.com/account/api-keys",
                ignoreFocusOut: true,
            });
            this.openAIAPIKey = openAIAPIKeyInput!;
            this.context.globalState.update('chatgpt-api-key', this.openAIAPIKey);
        }
    }

    public async askLLM(prompt: string, code?: string){
        await this.ensureopenAIAPIKey();

        if(!this.chain){
            try{
                // Try to load any valid langchain file in .llm-helper folder
                if(vscode.workspace.workspaceFolders == undefined){
                    await vscode.window.showErrorMessage("A workspace folder must be opened to use langchain.");
                    return;
                }
                // No idea why we need to do this much; will this even work on drives with other letters?
                let workspace_path = vscode.workspace.workspaceFolders[0].uri.path.replace(/[a-zA-Z]:/, '').replace(/[\\/]+/g, '/');

                let mjs_file_url = workspace_path + "/.llm-helper/langchain.mjs";
                if(!fs.existsSync(mjs_file_url)){
                    await vscode.window.showErrorMessage("No default chain configured yet.");
                    return;
                }

                process.env["OPENAI_API_KEY"] = this.openAIAPIKey;
                const module = await import(mjs_file_url);
                this.chain = module.chain;
            }
            catch(error: any){
                await vscode.window.showErrorMessage("Unexpected error loading chain: ", error?.message);
                return;
            }
        }

        // Create question by adding prompt prefix to code, if provided
        const question = (code) ? `${prompt}: ${code}` : prompt;

        if (!this.webView) {
            await vscode.commands.executeCommand('chatgpt-vscode-plugin.view.focus');
        }
        else {
            this.webView?.show?.(true);
        }

        this.userSentQuestion(question);
        try{
            let response: string = await this.chain.invoke({
                messages: this.messages
            });
            this.botSentResponse(response);
        }
        catch(error: any){
            await vscode.window.showErrorMessage("Unexpected error running chain: ", error?.message);
        }
    }

    private botSentResponse(response: string){
        this.sendMessageToWebView({ type: 'addResponse', value: response });
        this.messages.push(new ChatMessage(response, "assistant"));
    }

    private userSentQuestion(message: string){
        this.sendMessageToWebView({ type: 'addQuestion', value: message, code: null });
        this.messages.push(new ChatMessage(message, "user"));
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