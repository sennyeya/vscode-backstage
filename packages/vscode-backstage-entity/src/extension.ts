import { ExtensionContext } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { startClient } from './client';

export let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
  console.log('activating');
  client = await startClient(context);
  console.log('connected');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
