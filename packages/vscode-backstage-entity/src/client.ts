import * as path from "path";
import { ExtensionContext, window } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn,
} from "vscode-languageclient/node";

const lsName = "Backstage Entity Support";

export const startClient = async (context: ExtensionContext) => {
  const serverModule = context.asAbsolutePath(
    path.join("out", "server", "index.js")
  );

  // server is run at port 6009 for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6010"] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const outputChannel = window.createOutputChannel(lsName);

  const clientOptions: LanguageClientOptions = {
    // register the server for catalog-info.yaml documents
    documentSelector: [{ scheme: "file", language: "backstage-entity" }],
    revealOutputChannelOn: RevealOutputChannelOn.Never,
  };

  const client = new LanguageClient(
    "backstage-entity-server",
    "Backstage Entity Language Server",
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(
    client.onTelemetry((e) => {
      console.log(e);
    })
  );

  try {
    console.log("starting");
    await client.start();
    console.log("started");
  } catch (err) {
    let errorMessage: string;
    if (err instanceof Error) {
      errorMessage = err.message;
    } else {
      errorMessage = String(err);
    }
    console.error(`Language Client initialization failed with ${errorMessage}`);
  }
  return client;
};
