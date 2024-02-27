import * as vscode from 'vscode';
import ChatGptViewProvider from './chatgpt-view-provider';

export function activate(context: vscode.ExtensionContext) {
	const chatViewProvider = new ChatGptViewProvider(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('chatgpt-vscode-plugin.askGPT', askChatGPT),
		vscode.window.registerWebviewViewProvider("chatgpt-vscode-plugin.view", chatViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	async function askChatGPT(userInput?: string) {
		if (!userInput) {
			userInput = await vscode.window.showInputBox({ prompt: "Ask ChatGPT a question" }) || "";
		}

		let editor = vscode.window.activeTextEditor;

		if (editor) {
			const selectedCode = editor.document.getText(vscode.window.activeTextEditor?.selection);
			const entireFileContents = editor.document.getText();

			const code = selectedCode
				? selectedCode
				: `This is the ${editor.document.languageId} file I'm working on: \n\n${entireFileContents}`;

			chatViewProvider.sendOpenAiApiRequest(userInput, code);
		}
	}
}

export function deactivate() {}
