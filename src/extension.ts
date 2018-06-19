'use strict';

import * as vscode from 'vscode';
import * as child_process from "child_process";

let panel: vscode.WebviewPanel | null;

function getConf<T>(name: string): T {
    const conf = vscode.workspace.getConfiguration("dotprof");
    return conf.get<T>(name);
}

function prof(handle: (s: string) => void, err: (s: string) => void) {
    let options: string[] = getConf("profilerOptions");
    for (let x in options) {
        options[x] = options[x].replace("${target}", getConf<string>("profileTarget"));
    }
    let cwd: string = getConf("profilerWorkingDirectory");
    const process = child_process.spawn(getConf("profilerPath"), options, {
        cwd: cwd.replace("${workspaceRoot}", vscode.workspace.rootPath)
    });
    const stdoutBuffer: Array<(string | Buffer)> = [];
    const stderrBuffer: Array<(string | Buffer)> = [];

    process.on("error", () => console.log("error"));
    process.on("exit", (code) => {
        if (code === 0) {
            let out = stdoutBuffer.join("");
            let options: string[] = getConf("gprof2dotOptions");
            const process = child_process.spawn("gprof2dot", options.concat(["-f", getConf("profilerType")]));
            const stdoutBuffer1: Array<(string | Buffer)> = [];
            const stderrBuffer1: Array<(string | Buffer)> = [];

            process.on("error", () => console.log("error"));
            process.on("exit", (code) => {
                if (code === 0) {
                    let out = stdoutBuffer1.join("");
                    const process = child_process.spawn(getConf("dotPath"), [
                        "-Tsvg"
                    ]);
                    const stdoutBuffer2: Array<(string | Buffer)> = [];
                    const stderrBuffer2: Array<(string | Buffer)> = [];

                    process.on("error", () => console.log("error"));
                    process.on("exit", (code) => {
                        if (code === 0) {
                            handle(stdoutBuffer2.join(""));
                        } else {
                            err(stderrBuffer2.join(""));
                        }
                    });
                    process.stdout.on("data", (chunk) => stdoutBuffer2.push(chunk));
                    process.stderr.on("data", (chunk) => stderrBuffer2.push(chunk));

                    process.stdin.end(out);
                } else {
                    err(stderrBuffer1.join(""));
                }
            })
            process.stdout.on("data", (chunk) => stdoutBuffer1.push(chunk));
            process.stderr.on("data", (chunk) => stderrBuffer1.push(chunk));

            process.stdin.end(out);
        } else {
            err(stderrBuffer.join(""));
        }
    });
    process.stdout.on("data", (chunk) => stdoutBuffer.push(chunk));
    process.stderr.on("data", (chunk) => stderrBuffer.push(chunk));
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.dotProfile', () => {
            if (getConf<string>("profileTarget")) {
                prof((s: string) => {
                    if (!panel) {
                        panel = vscode.window.createWebviewPanel('dotprof', 'Profile Diagram', vscode.ViewColumn.Two, {});
                        panel.onDidDispose(() => {
                            panel = null;
                        }, null, context.subscriptions);
                    }
                    panel.webview.html = s;
                }, (e: string) => {
                    vscode.window.showErrorMessage(e);
                });
            } else {
                vscode.window.showErrorMessage("profile target not configured, see command 'Profile Target'.");
            }
        }),
        vscode.commands.registerCommand('extension.profileTarget', () => {
            vscode.window.showInputBox({
                placeHolder: 'enter profile target name',
                value: <string>getConf("profileTarget")
            }).then((s: string) => {
                if (s != null) {
                    vscode.workspace.getConfiguration("dotprof").update("profileTarget", s, false);
                }
            });
        }),
        vscode.commands.registerCommand('extension.profilerWorkingDirectory', () => {
            vscode.window.showInputBox({
                placeHolder: 'enter profiler woring directory',
                value: <string>getConf("profilerWorkingDirectory")
            }).then((s: string) => {
                if (s != null) {
                    vscode.workspace.getConfiguration("dotprof").update("profilerWorkingDirectory", s, false);
                }
            });
        })
    );
}
