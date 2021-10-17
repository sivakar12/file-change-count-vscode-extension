import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

import { getParentPaths } from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');
	suite('Test getParentPaths', () => {
		test('Returns all parent paths', () => {
			const path = 'src/html/index.html';
			const expectedPaths = [
				'src/html',
				'src',
				'.'
			];
			const returnedPaths = getParentPaths(path);
			assert.deepStrictEqual(returnedPaths, expectedPaths);
		});
	});
});
