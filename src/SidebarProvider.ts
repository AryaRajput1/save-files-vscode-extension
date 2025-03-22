import * as vscode from "vscode";
import { getNonce } from "./getNonce";

import * as fs from 'fs';
import * as path from 'path';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithCustomToken, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, signOut } from "firebase/auth";
import { auth, db, googleProvider } from "./utils/firebase";
import { collection, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";


export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;
  _files?: string[];
  _folderPath?: string;
  private _context: vscode.ExtensionContext;

  constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._context = context; 

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No open project found!");
      return;
    }

    this._folderPath = workspaceFolders[0].uri.fsPath;
  }

  private async signInWithEmail(webviewView: vscode.WebviewView) {
    await setPersistence(auth, browserSessionPersistence);
    const email = await vscode.window.showInputBox({
      placeHolder: "Enter your email",
      prompt: "Sign in with Firebase",
    });

    if (!email) {
      vscode.window.showErrorMessage("Email is required.");
      return;
    }

    const password = await vscode.window.showInputBox({
      placeHolder: "Enter your password",
      prompt: "Enter your Firebase password",
      password: true,
    });

    if (!password) {
      vscode.window.showErrorMessage("Password is required.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get Firebase ID Token
      const idToken = await user.getIdToken();

      // Store token in VS Code globalState
      this._context.globalState.update("firebaseAuthToken", idToken);

      vscode.window.showInformationMessage(`Signed in as ${user.email}`);

      webviewView.webview.postMessage({
        type: "authentication",
        value: JSON.stringify(user),
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Sign-in failed: ${error.message}`);
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Restore session if token exists
    const storedToken = this._context.globalState.get<string>("firebaseAuthToken");
    if (storedToken) {
      signInWithCustomToken(auth, storedToken)
        .then((userCredential) => {
          const user = userCredential.user;
          vscode.window.showInformationMessage(`Welcome back, ${user.email}`);

          webviewView.webview.postMessage({
            type: "authentication",
            value: JSON.stringify(user),
          });
        })
        .catch(() => {
          vscode.window.showWarningMessage("Session expired. Please sign in again.");
          this._context.globalState.update("firebaseAuthToken", null);
        });
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "onInfo": {
          if (!data.value) {
            return;
          }
          const files = await this.saveProjectFiles(auth.currentUser?.email!);
          webviewView.webview.postMessage({
            type: 'save-files',
            value: 'Project Files saved successfully. Now Try to fetch files.'
          })
          // vscode.window.showInformationMessage("Files saved to Firebase!");
          break;
        }
        case "get-files": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage("Getting Files");

          const files = await this.fetchUserFiles(auth.currentUser?.email!)
          console.log(files)
          webviewView.webview.postMessage({
            type: 'get-files',
            value: JSON.stringify(files)
          })
          
          vscode.window.showInformationMessage("Files Fetched!");
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
        case "logout": {
          await this.logout(webviewView);
          break;
        }
        case "delete-project": {
          if (!data.value) return;
          const projectName = data.value;
          await this.deleteProject(auth.currentUser?.email!, projectName, webviewView);
          break;
        }
        case "sign-in": {
          if (auth.currentUser) {
            webviewView.webview.postMessage({
              type: "authentication",
              value: JSON.stringify(auth.currentUser),
            });
            vscode.window.showInformationMessage(`Already signed in as ${auth.currentUser.email}`);
            return;
          }

          await this.signInWithEmail(webviewView);
          break;
        }
      }
    });
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out/compiled", "sidebar.js")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out/compiled", "sidebar.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content=" img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource
      }; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <script nonce="${nonce}">
          const context = acquireVsCodeApi()
        </script>
			</head>
      <body>
      <div id="app"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
  async logout(webviewView: vscode.WebviewView) {
    try {
      await signOut(auth);
      this._context.globalState.update("firebaseAuthToken", null);
      vscode.window.showInformationMessage("Successfully logged out.");
      
      webviewView.webview.postMessage({
        type: "logout",
      });
    } catch (error: any) {
      vscode.window.showErrorMessage(`Logout failed: ${error.message}`);
    }
  }
  async saveProjectFiles(userId: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No open project found!");
      return;
    }

    const folderPath = workspaceFolders[0].uri.fsPath;
    const files = this.getFiles(folderPath);

    let projectName = folderPath.split("/").pop() as string;
    
    await setDoc(doc(collection(db, "projects"), userId), { // ✅ Correct Firestore syntax
      projects: {
        [projectName]: files
      }
    },  { merge: true });

    vscode.window.showInformationMessage("Files saved to Firebase!");
    return files;
  }

  async fetchUserFiles(userId: string) {
    try {
      console.log('Fetching')
      const userDocRef = doc(collection(db, "projects"), userId);
      const userDocSnap = await getDoc(userDocRef);
  
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        console.log("Fetched Data:", data);

        console.log(data)
        return data.projects || {}; // Return the paths object
      } else {
        console.log("No document found for this user.");
        return {};
      }
    } catch (error) {
      console.error("Error fetching user files:", error);
      return {};
    }
  }

  getFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        this.getFiles(filePath, fileList);
      } else {
        fileList.push(file);
      }
    });
    return fileList;
  }

  async deleteProject(userId: string, projectName: string, webviewView: vscode.WebviewView) {
    try {
      const userDocRef = doc(collection(db, "projects"), userId);
      const userDocSnap = await getDoc(userDocRef);
  
      if (!userDocSnap.exists()) {
        vscode.window.showWarningMessage("No project found to delete.");
        return;
      }
  
      const data = userDocSnap.data();
      if (!data.projects || !data.projects[projectName]) {
        vscode.window.showWarningMessage(`Project "${projectName}" not found.`);
        return;
      }
  
      // Remove the project from Firestore
      await updateDoc(userDocRef, {
        [`projects.${projectName}`]: deleteField()
      });
  
      vscode.window.showInformationMessage(`Project "${projectName}" deleted successfully.`);
  
      // Notify webview
      webviewView.webview.postMessage({
        type: "delete-success",
        value: projectName
      });
  
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to delete project: ${error.message}`);
    }
  }
}