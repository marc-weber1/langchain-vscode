import * as vscode from 'vscode';
import ChatGptViewProvider from './chatgpt-view-provider';

export function activate(context: vscode.ExtensionContext) {
	const chatViewProvider = new ChatGptViewProvider(context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("chatgpt-vscode-plugin.view", chatViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);
}

export function deactivate() {}
