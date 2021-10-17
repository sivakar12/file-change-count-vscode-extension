import * as fs from 'fs';
import pathModule = require('path');
import * as vscode from 'vscode';
import { gitToJs } from 'git-parse';
import * as _ from 'lodash';

interface FileCount {
	path: string,
	count: number,
	fraction?: number,
	terminalFile: boolean
}

function getParentPaths(path: string): string[] {
	let parents = [];
	if (path === '.') {
		return [];
	}
	const parentPath = pathModule.posix.dirname(path);
	return [path].concat(getParentPaths(parentPath));
}

function populateFraction(fileCounts: FileCount[]): FileCount[] {
	const totalCount = fileCounts
		//.filter(fileCount => fileCount.terminalFile)
		.map(f => f.count)
		.reduce((a, b) => a + b, 0);
	return fileCounts.map(fc => ({...fc, fraction: fc.count / totalCount}));
}

const TOTAL_INDICATORS = 300;

function fractionToBar(fraction: number): string {
	return _.repeat('.', Math.round(TOTAL_INDICATORS * fraction));
}

interface ChildrenList {
	path: string,
	hasChildren: boolean
}
function getDirectChildrenForPath(parentPath: string, allPaths: string[]): ChildrenList[] {
	return allPaths
		.filter(path => 
			//path.startsWith(parentPath) && path !== parentPath
			pathModule.dirname(path) === parentPath
		)
		.map(childPath => {
			const hasChildren = allPaths.filter(path =>
				// path => path.startsWith(childPath) && 
				// path !== childPath
				pathModule.dirname(path) === childPath
			).length > 0;
			return {
				path: childPath,
				hasChildren
			};
		});
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

	getAllPaths(): string[] {
		return Object.keys(this.countMap);
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
	console.log(counts);
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
	
	getTreeItem(element: FileCount): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const label = pathModule.basename(element.path);
		let treeItem = new vscode.TreeItem(label);
		treeItem.description = element.count.toString() + ' ' + fractionToBar(element.fraction || 0);
		treeItem.collapsibleState = element.terminalFile ? 
			vscode.TreeItemCollapsibleState.None :
			vscode.TreeItemCollapsibleState.Collapsed;
		return treeItem;

	}
	getChildren(element?: FileCount): vscode.ProviderResult<FileCount[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('Empty workspace');
      return Promise.resolve([]);
		}
		const workspaceRoot = this.workspaceRoot;

		return this.loadCounts().then(() => {
			if (this.countsForPaths) {
				let path = element?.path || '.';
				let children = getDirectChildrenForPath(path, this.countsForPaths.getAllPaths());
				const fileCounts: FileCount[] = children.map(c => ({
					path: c.path, 
					count: this.countsForPaths?.get(c.path) || 0, 
					terminalFile: !c.hasChildren
				}));
				const fileCountsSorted = _.sortBy(fileCounts, f => -f.count);
				const fileCountsWithFractions = populateFraction(fileCountsSorted);
				return Promise.resolve(fileCountsWithFractions);
			} else {
				return Promise.resolve([]);
			}
		});
	}
}


export function activate(context: vscode.ExtensionContext) {
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const fileChangeCountProvider = new FileChangeCountProvider(rootPath);
	vscode.window.registerTreeDataProvider('fileChangeCount', fileChangeCountProvider);
}

export function deactivate() {}
