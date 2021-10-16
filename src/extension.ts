import * as fs from 'fs';
import path = require('path');
import * as vscode from 'vscode';
import { gitToJs } from 'git-parse';

interface CountsForPaths {
	[path: string]: number 
};

async function getFileChangeCounts(repoAbsolutePath: string) {
	const commits = await gitToJs(repoAbsolutePath);
	const counts: CountsForPaths = commits.reduceRight((counts: CountsForPaths, commit) => {
		commit.filesAdded.concat(commit.filesModified).forEach(fileModification => {
			const filePath = fileModification.path;
			if (filePath in counts) {
				counts[filePath] += 1;
			} else {
				counts[filePath] = 1;
			}
		});
		return counts;
	}, {});
	return counts;
}

class FileChangeCountProvider implements vscode.TreeDataProvider<NodeDetail> {
	constructor(private workspaceRoot?: string, private countsForPaths?: CountsForPaths) {
		console.log("workspace root is " + this.workspaceRoot);
	}
	loadCounts() {
		if (this.workspaceRoot && !this.countsForPaths) {
			return getFileChangeCounts(this.workspaceRoot).then(counts => this.countsForPaths = counts);
		} else {
			return Promise.resolve();
		}
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
		const workspaceRoot = this.workspaceRoot;
		return this.loadCounts().then(() => {
			const elementRelativePath: string = element?.id || '';
			const elementAbsolutePath: string = path.posix.join(workspaceRoot, elementRelativePath);
			const filesNames = fs.readdirSync(elementAbsolutePath);
				const dispayItems: NodeDetail[] = filesNames.map(filename => {
					const fileStat = fs.statSync(path.posix.join(elementAbsolutePath, filename));
					const childRelativePath = path.posix.join(elementRelativePath, filename);
					const treeItemCollpsibleState = 
						fileStat.isDirectory() ? 
						vscode.TreeItemCollapsibleState.Expanded : 
						vscode.TreeItemCollapsibleState.None;
					console.log(childRelativePath);
					return new NodeDetail(
						childRelativePath,
						filename, 
						treeItemCollpsibleState,
						(this.countsForPaths && this.countsForPaths[childRelativePath] || 0)
					);
				});
				return Promise.resolve(dispayItems);
		})
	}
}


class NodeDetail extends vscode.TreeItem {
	constructor(
		public readonly id: string,
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public changeCount: number
	) {
		super(label, collapsibleState);
		this.description = changeCount.toString();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const fileChangeCountProvider = new FileChangeCountProvider(rootPath);
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
