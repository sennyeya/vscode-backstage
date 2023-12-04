import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  NotificationHandler,
  DidChangeTextDocumentParams,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { BackstageEntityLanguageService } from "./BackstageEntityLanguageService";

// Creates the LSP connection
const connection = createConnection(ProposedFeatures.all);

// Create a manager for open text documents
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// The workspace folder this server is operating on
let workspaceFolder: string | null;

documents.onDidOpen((event) => {
  connection.console.log(
    `[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`
  );
});

connection.onInitialize((params) => {
  workspaceFolder = params.rootUri;
  connection.console.log(
    `[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`
  );
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.None,
      },
    },
  };
});

const docChangeHandlers: NotificationHandler<DidChangeTextDocumentParams>[] =
  [];
connection.onDidChangeTextDocument((params) => {
  for (const handler of docChangeHandlers) {
    handler(params);
  }
});

// HACK: Using a connection proxy to allow multiple handlers
// This hack is necessary to simultaneously take advantage of the TextDocuments
// listener implementations and still be able to register handlers that it
// overrides, such as `onDidChangeTextDocument`.
const connectionProxy = new Proxy(connection, {
  get: (target, p, receiver) => {
    if (p === "onDidChangeTextDocument") {
      return (handler: NotificationHandler<DidChangeTextDocumentParams>) => {
        docChangeHandlers.push(handler);
      };
    } 
      return Reflect.get(target, p, receiver);
    
  },
});

const context = new BackstageEntityLanguageService(connectionProxy, documents);
context.initialize();

documents.listen(connectionProxy);
connection.listen();
