import * as fs from 'fs';
import pathModule = require('path');
import * as vscode from 'vscode';
import { gitToJs } from 'git-parse';
import * as _ from 'lodash';

interface FileCount {
	path: string,
	count: number
}

function getParentPaths(path: string): string[] {
	let parents = [];
	if (path === '.') {
		return [];
	}
	const parentPath = pathModule.posix.dirname(path);
	return [path].concat(getParentPaths(parentPath));
}

class CountsForPaths {
	private countMap: { [path: string]: number };

	constructor() {
		this.countMap = {};
	}

	increment(path: string) {
		if (this.countMap[path] === undefined) {
			this.countMap[path] = 0;
		}
		this.countMap[path] += 1;
	}

	addCount(path: string, count: number) {
		if (this.countMap[path] === undefined) {
			this.countMap[path] = 0;
		}
		this.countMap[path] += count;
	}

	get(path: string): number {
		return this.countMap[path] || 0;
	}

	renamePath(oldPath: string, newPath: string) {
		this.countMap[newPath] = this.countMap[oldPath];
		delete this.countMap[oldPath];
	}

	populateParents() {
		const nodeKeys = Object.keys(this.countMap);
		let countMap = this.countMap;
		for (let node of nodeKeys) {
			const parents = getParentPaths(node);
			parents.forEach(parent => {
				this.addCount(parent, this.get(node));
			});
		}
	}
	
	getAsList(): FileCount[] {
		return Object.keys(this.countMap).map(path => {
			return {
				path: path,
				count: this.get(path) || 0
			};
		});
	}
}

async function getFileChangeCounts(repoAbsolutePath: string): Promise<CountsForPaths> {
	const commits = await gitToJs(repoAbsolutePath);
	
	const counts: CountsForPaths = commits.reduceRight((counts: CountsForPaths, commit) => {

		commit.filesRenamed.forEach(renameAction => {
			counts.renamePath(renameAction.oldPath, renameAction.newPath);
		});

		commit.filesAdded.concat(commit.filesModified).forEach(fileModification => {
			const filePath = fileModification.path;
			counts.increment(filePath);
		});
		return counts;
	}, new CountsForPaths());
	counts.populateParents();
	return counts;
}

class FileChangeCountProvider implements vscode.TreeDataProvider<FileCount> {
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
				const fileCounts: FileCount[] = this.countsForPaths.getAsList();
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


export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const fileChangeCountProvider = new FileChangeCountProvider(rootPath);
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
