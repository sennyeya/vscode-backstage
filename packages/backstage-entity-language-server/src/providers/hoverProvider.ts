import { Hover, MarkupContent, MarkupKind } from 'vscode-languageserver';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { Scalar } from 'yaml';
import { toLspRange } from '../utils/misc';
import { getOrigRange, getPathAt, parseAllDocuments } from '../utils/yaml';

export async function doHover(
  document: TextDocument,
  position: Position,
): Promise<Hover | null> {
  const yamlDocs = parseAllDocuments(document.getText());
  const path = getPathAt(document, position, yamlDocs);
  console.log(path);
  return null;
}

function getKeywordHover(
  document: TextDocument,
  node: Scalar,
  keywords: Map<string, string | MarkupContent>,
): Hover | null {
  const keywordDocumentation = keywords.get(node.value as string);
  const markupDoc =
    typeof keywordDocumentation === 'string'
      ? {
          kind: MarkupKind.Markdown,
          value: keywordDocumentation,
        }
      : keywordDocumentation;
  if (markupDoc) {
    const range = getOrigRange(node);
    return {
      contents: markupDoc,
      range: range ? toLspRange(range, document) : undefined,
    };
  }
  return null;
}
