import * as fs from 'fs';
import path = require('path');
import * as vscode from 'vscode';

function getFileChangeCounts(fileRelativePath: String) {
}

class FileChangeCountProvider implements vscode.TreeDataProvider<NodeDetail> {
	constructor(private workspaceRoot?: string) {
		console.log("workspace root is " + this.workspaceRoot);
	}
	onDidChangeTreeData?: vscode.Event<void | NodeDetail | null | undefined> | undefined;
	getTreeItem(element: NodeDetail): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	getChildren(element?: NodeDetail): vscode.ProviderResult<NodeDetail[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('Empty workspace');
      return Promise.resolve([]);
		}
		const elementRelativePath: string = element?.id || '.';
		const elementAbsolutePath: string = path.join(this.workspaceRoot, elementRelativePath);
		const filesNames = fs.readdirSync(elementAbsolutePath);
			const dispayItems: NodeDetail[] = filesNames.map(filename => {
				const fileStat = fs.statSync(path.join(elementAbsolutePath, filename));
				const childRelativePath = path.join(elementRelativePath, filename);
				const treeItemCollpsibleState = 
					fileStat.isDirectory() ? 
					vscode.TreeItemCollapsibleState.Expanded : 
					vscode.TreeItemCollapsibleState.None;
				return new NodeDetail(
					childRelativePath,
					filename, 
					treeItemCollpsibleState);
			});
			return Promise.resolve(dispayItems);
	}
}


class NodeDetail extends vscode.TreeItem {
	constructor(
		public readonly id: string,
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label);
		this.description = '0';
	}
}

export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const fileChangeCountProvider = new FileChangeCountProvider(rootPath);
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
