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

    private currentDecorationType?: vscode.TextEditorDecorationType;

    async highlightLocation(location: LocationItem) {
        const uri = vscode.Uri.file(location.file);
        const document = await vscode.window.showTextDocument(uri);

        // 清除之前的高亮
        if (this.currentDecorationType) {
            document.setDecorations(this.currentDecorationType, []);
            this.currentDecorationType.dispose(); // 释放之前装饰类型的资源
        }

        // 创建一个范围，覆盖从开始行列到结束行列的代码
        const range = new vscode.Range(
            new vscode.Position(location.beginLine - 1, location.beginColumn - 1),
            new vscode.Position(location.endLine - 1, location.endColumn - 1)
        );

        // 创建一个装饰类型，用边框框出代码，并在行尾展示文字
        this.currentDecorationType = vscode.window.createTextEditorDecorationType({
            border: '1px solid rgba(255,0,0,0.5)', // 红色边框，半透明
            after: {
                contentText: `${location.index} ${location.type}`, // 行尾展示的文字
                color: 'rgba(255,0,0,0.5)', // 文字颜色
                margin: '0 0 0 3em' // 文字与代码的间距
            }
        });

        document.setDecorations(this.currentDecorationType, [range]);

        // 聚焦到高亮的范围
        document.revealRange(range, vscode.TextEditorRevealType.InCenter);
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

    pathDetailsTreeView.onDidChangeSelection(e => {
        const selectedLocation = e.selection[0];
        if (selectedLocation) {
            pathDetailsProvider.highlightLocation(selectedLocation);
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
