// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface PathItem extends vscode.TreeItem {
    type: string;
    locations: LocationItem[];
}

interface LocationItem extends vscode.TreeItem {
    index: number;
    type: string;
    file: string;
    beginLine: number;
    beginColumn: number;
    endLine: number;
    endColumn: number;
}

class PathProvider implements vscode.TreeDataProvider<PathItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PathItem | undefined> = new vscode.EventEmitter<PathItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<PathItem | undefined> = this._onDidChangeTreeData.event;

    private paths: PathItem[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    loadPaths(paths: PathItem[]) {
        this.paths = paths;
        this.refresh();
    }

    getTreeItem(element: PathItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PathItem): PathItem[] {
        if (element) {
            return [];
        } else {
            return this.paths;
        }
    }
}

class LocationProvider implements vscode.TreeDataProvider<LocationItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LocationItem | undefined> = new vscode.EventEmitter<LocationItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<LocationItem | undefined> = this._onDidChangeTreeData.event;

    private locations: LocationItem[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    loadLocations(locations: LocationItem[]) {
        this.locations = locations;
        this.refresh();
    }

    getTreeItem(element: LocationItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: LocationItem): LocationItem[] {
        if (element) {
            return [];
        } else {
            return this.locations;
        }
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Path Viewer');

    const allPathsProvider = new PathProvider();
    const pathDetailsProvider = new LocationProvider();

    const allPathsTreeView = vscode.window.createTreeView('all-paths', { treeDataProvider: allPathsProvider });
    const pathDetailsTreeView = vscode.window.createTreeView('path-details', { treeDataProvider: pathDetailsProvider });

    allPathsTreeView.onDidChangeSelection(e => {
        const selectedPath = e.selection[0];
        if (selectedPath) {
            pathDetailsProvider.loadLocations(selectedPath.locations);
        }
    });

    let disposable = vscode.commands.registerCommand('thebesttv-path-viewer.openOutputJson', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Please open a file named output.json');
            return;
        }

        const document = editor.document;
        const filePath = document.fileName;

        if (path.basename(filePath) !== 'output.json') {
            vscode.window.showErrorMessage('Please open a file named output.json');
            return;
        }

        const fileContent = document.getText();
        try {
            outputChannel.appendLine(`Loading path from: ${filePath}`);
            outputChannel.show();
            const jsonContent = JSON.parse(fileContent);

            if (jsonContent && jsonContent.results && Array.isArray(jsonContent.results)) {
                const allPaths: PathItem[] = jsonContent.results
                    // skip npe-good-source
                    .filter((result: any) => result.type !== 'npe-good-source')
                    .map((result: any) => ({
                        label: result.sourceIndex !== undefined
                            ? `${result.type} (${result.sourceIndex})` : result.type,
                        type: result.type,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,

                        locations: result.locations.map((location: any, index: number) => ({
                            label: `${index} ${location.type}: ${location.content}`,
                            index: index,
                            type: location.type,
                            file: location.file,
                            beginLine: location.beginLine,
                            beginColumn: location.beginColumn,
                            endLine: location.endLine,
                            endColumn: location.endColumn,
                            collapsibleState: vscode.TreeItemCollapsibleState.None
                        }))
                    }));

                allPathsProvider.loadPaths(allPaths);

                // focus on all-paths view
                vscode.commands.executeCommand("all-paths.focus");

                vscode.window.showInformationMessage('Paths loaded successfully');
            } else {
                vscode.window.showErrorMessage('Invalid JSON format: Expected results array');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Invalid JSON file');
        }
    });
    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
