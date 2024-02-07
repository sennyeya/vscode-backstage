import { DefinitionLink } from 'vscode-languageserver';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';

export async function getDefinition(
  document: TextDocument,
  position: Position,
): Promise<DefinitionLink[] | null> {
  return null;
}
