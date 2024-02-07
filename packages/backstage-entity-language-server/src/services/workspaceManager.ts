/* eslint-disable @typescript-eslint/no-use-before-define */
import * as _ from 'lodash';
import {
  ClientCapabilities,
  Connection,
  WorkspaceFolder,
  WorkspaceFoldersChangeEvent,
} from 'vscode-languageserver';
import * as path from 'path';
import { URI } from 'vscode-uri';

/**
 * Holds the overall context for the whole workspace.
 */
export class WorkspaceManager {
  public connection: Connection;
  private sortedWorkspaceFolders: WorkspaceFolder[] = [];
  private folderContexts: Map<string, WorkspaceFolderContext> = new Map();
  public clientCapabilities: ClientCapabilities = {};

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setWorkspaceFolders(workspaceFolders: WorkspaceFolder[]): void {
    this.sortedWorkspaceFolders = this.sortWorkspaceFolders(workspaceFolders);
  }

  public setCapabilities(capabilities: ClientCapabilities): void {
    this.clientCapabilities = capabilities;
  }

  /**
   * Determines the workspace folder context for the given URI.
   */
  public getContext(uri: string): WorkspaceFolderContext | undefined {
    const workspaceFolder = this.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      let context = this.folderContexts.get(workspaceFolder.uri);
      if (!context) {
        context = new WorkspaceFolderContext(
          this.connection,
          workspaceFolder,
          this,
        );
        this.folderContexts.set(workspaceFolder.uri, context);
      }
      return context;
    }
    return undefined;
  }

  public async forEachContext(
    callbackfn: (value: WorkspaceFolderContext) => Promise<void> | void,
  ): Promise<void> {
    await Promise.all(
      _.map(Array.from(this.folderContexts.values()), folder =>
        callbackfn(folder),
      ),
    );
  }

  /**
   * Finds the inner-most workspace folder for the given URI.
   */
  public getWorkspaceFolder(uri: string): WorkspaceFolder | undefined {
    for (const workspaceFolder of this.sortedWorkspaceFolders) {
      if (URI.parse(uri).toString().startsWith(workspaceFolder.uri)) {
        return workspaceFolder;
      }
    }
    /* *
     * If control reaches at this point it indicates an individual file is
     * opened in client without any workspace.
     * Set the workspace to directory of the file pointed by uri.
     */
    const documentFolderPathParts = URI.parse(uri).toString().split(path.sep);
    documentFolderPathParts.pop();
    const workspaceFolder: WorkspaceFolder = {
      uri: documentFolderPathParts.join(path.sep),
      name: documentFolderPathParts[documentFolderPathParts.length - 1],
    };

    this.connection.console.log(
      `workspace folder explicitly set to ${
        URI.parse(workspaceFolder.uri).path
      }`,
    );
    return workspaceFolder;
  }

  public handleWorkspaceChanged(event: WorkspaceFoldersChangeEvent): void {
    const removedUris = new Set(event.removed.map(folder => folder.uri));

    // We only keep contexts of existing workspace folders
    for (const removedUri of removedUris) {
      this.folderContexts.delete(removedUri);
    }

    const newWorkspaceFolders = this.sortedWorkspaceFolders.filter(folder => {
      return !removedUris.has(folder.uri);
    });
    newWorkspaceFolders.push(...event.added);
    this.sortedWorkspaceFolders =
      this.sortWorkspaceFolders(newWorkspaceFolders);
  }

  private sortWorkspaceFolders(workspaceFolders: WorkspaceFolder[]) {
    return workspaceFolders.sort((a, b) => {
      return b.uri.length - a.uri.length;
    });
  }
}

/**
 * Holds the context for particular workspace folder. This context is used by
 * all services to interact with the client and with each other.
 */
export class WorkspaceFolderContext {
  private connection: Connection;
  public clientCapabilities: ClientCapabilities;
  public workspaceFolder: WorkspaceFolder;

  constructor(
    connection: Connection,
    workspaceFolder: WorkspaceFolder,
    workspaceManager: WorkspaceManager,
  ) {
    this.connection = connection;
    this.clientCapabilities = workspaceManager.clientCapabilities;
    this.workspaceFolder = workspaceFolder;
  }
}
