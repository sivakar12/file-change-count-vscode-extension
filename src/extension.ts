import * as fs from 'fs';
import path = require('path');
import * as vscode from 'vscode';
import { gitToJs } from 'git-parse';
import * as _ from 'lodash';

interface CountsForPaths {
	[path: string]: number 
};

async function getFileChangeCounts(repoAbsolutePath: string) {
	const commits = await gitToJs(repoAbsolutePath);

	const counts: CountsForPaths = commits.reduceRight((counts: CountsForPaths, commit) => {

		commit.filesRenamed.forEach(renameAction => {
			counts[renameAction.newPath] = counts[renameAction.oldPath];
			delete counts[renameAction.oldPath];
		});

		commit.filesAdded.concat(commit.filesModified).forEach(fileModification => {
			const filePath = fileModification.path;
			if (counts[filePath] === undefined) {
				counts[filePath] = 0;
			}
			counts[filePath] += 1;
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
	onDidChangeTreeData?: vscode.Event<void | FileCount | null | undefined> | undefined;
	getTreeItem(element: FileCount): vscode.TreeItem | Thenable<vscode.TreeItem> {
		let treeItem = new vscode.TreeItem(element.path);
		treeItem.description = element.count.toString();
		return treeItem;
	}
	getChildren(): vscode.ProviderResult<FileCount[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('Empty workspace');
      return Promise.resolve([]);
		}
		const workspaceRoot = this.workspaceRoot;

		return this.loadCounts().then(() => {
			if (this.countsForPaths) {
				const fileCounts = Object.keys(this.countsForPaths).map(path => {
					return new FileCount(path, (this.countsForPaths? this.countsForPaths[path] || 0 : 0));
				});
				const fileCountsSorted = _.sortBy(fileCounts, f => -f.count);
				return Promise.resolve(fileCountsSorted);
			} else {
				return Promise.resolve([]);
			}
		});

		// return this.loadCounts().then(() => {
		// 	const elementRelativePath: string = element?.id || '';
		// 	const elementAbsolutePath: string = path.posix.join(workspaceRoot, elementRelativePath);
		// 	const filesNames = fs.readdirSync(elementAbsolutePath);

		// 	const dispayItems: NodeDetail[] = filesNames.map(filename => {
		// 		const fileStat = fs.statSync(path.posix.join(elementAbsolutePath, filename));
		// 		const childRelativePath = path.posix.join(elementRelativePath, filename);
		// 		const treeItemCollpsibleState = 
		// 			fileStat.isDirectory() ? 
		// 			vscode.TreeItemCollapsibleState.Expanded : 
		// 			vscode.TreeItemCollapsibleState.None;
				
		// 			return new NodeDetail(
		// 			childRelativePath,
		// 			filename, 
		// 			treeItemCollpsibleState,
		// 			(this.countsForPaths && this.countsForPaths[childRelativePath] || 0)
		// 		);
		// 	});
		// 	return Promise.resolve(dispayItems);
		// })
	}
}


class FileCount  {
	constructor(
		public readonly path: string,
		public readonly count: number
	) {}
}

export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const fileChangeCountProvider = new FileChangeCountProvider(rootPath);
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
