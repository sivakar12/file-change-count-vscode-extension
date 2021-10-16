import * as vscode from 'vscode';

class FileChangeCountProvider implements vscode.TreeDataProvider<NodeDetail> {
	onDidChangeTreeData?: vscode.Event<void | NodeDetail | null | undefined> | undefined;
	getTreeItem(element: NodeDetail): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	getChildren(element?: NodeDetail): vscode.ProviderResult<NodeDetail[]> {
		return [];
	}

}

class NodeDetail implements vscode.TreeItem {

}

export function activate(context: vscode.ExtensionContext) {
	
	const fileChangeCountProvider = new FileChangeCountProvider();
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
