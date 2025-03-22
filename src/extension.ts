// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HelloWorldPannel } from './SwiperPannel';
import { SidebarProvider } from './SidebarProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	const sidebarProvider = new SidebarProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"save-files-sidebar",
			sidebarProvider
		)
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('save-files.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		HelloWorldPannel.createOrShow(context.extensionUri)
	}))

	context.subscriptions.push(vscode.commands.registerCommand('save-files.refresh', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		HelloWorldPannel.kill()
		HelloWorldPannel.createOrShow(context.extensionUri)
	}))

	context.subscriptions.push(vscode.commands.registerCommand('save-files.askQuestion', async () => {
		const answer = await vscode.window.showInformationMessage('Is this working?', 'Yes', 'No');

		console.log(answer);
	}))
}

// This method is called when your extension is deactivated
export function deactivate() { }
