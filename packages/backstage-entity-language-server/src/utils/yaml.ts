import * as _ from "lodash";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Document,
  DocumentOptions,
  isMap,
  isScalar,
  isSeq,
  Node,
  parseAllDocuments as parseAllYamlDocuments,
  ParseOptions,
  SchemaOptions,
  YAMLMap,
} from "yaml";
import { Position } from "vscode-languageserver";

type Options = ParseOptions & DocumentOptions & SchemaOptions;

export function getPathAt(
  document: TextDocument,
  position: Position,
  docs: Document[],
  inclusive = false
): Node[] | null {
  const offset = document.offsetAt(position);
  const doc = _.find(docs, (d) => contains(d.contents, offset, inclusive));
  if (doc && doc.contents) {
    return getPathAtOffset([doc.contents], offset, inclusive, doc);
  }
  return null;
}

export function contains(
  node: Node | null,
  offset: number,
  inclusive: boolean
): boolean {
  const range = getOrigRange(node);
  const start = range?.[0] || 0;
  const end = range?.[1] || -1;
  return !!(
    range &&
    start <= offset &&
    (end === -1 || end > offset || (inclusive && end >= offset))
  );
}

export function getPathAtOffset(
  path: Node[],
  offset: number,
  inclusive: boolean,
  doc: Document
): Node[] | null {
  if (path) {
    const currentNode = path[path.length - 1];
    if (isMap(currentNode)) {
      let pair = _.find(currentNode.items, (p) =>
        contains(p.key as Node, offset, inclusive)
      );
      if (pair) {
        return getPathAtOffset(
          path.concat(pair as unknown as Node, pair.key as Node),
          offset,
          inclusive,
          doc
        );
      }
      pair = _.find(currentNode.items, (p) =>
        contains(p.value as Node, offset, inclusive)
      );
      if (pair) {
        return getPathAtOffset(
          path.concat(pair as unknown as Node, pair.value as Node),
          offset,
          inclusive,
          doc
        );
      }
      pair = _.find(currentNode.items, (p) => {
        const inBetweenNode = doc.createNode(null);
        const start = getOrigRange(p.key as Node)?.[1];
        const end = getOrigRange(p.value as Node)?.[0];
        if (start && end) {
          inBetweenNode.range = [start, end - 1, end];
          return contains(inBetweenNode, offset, inclusive);
        }
        return false;
      });
      if (pair) {
        return path.concat(pair as unknown as Node, doc.createNode(null));
      }
    } else if (isSeq(currentNode)) {
      const item = _.find(currentNode.items, (n) =>
        contains(n as Node, offset, inclusive)
      );
      if (item) {
        return getPathAtOffset(
          path.concat(item as Node),
          offset,
          inclusive,
          doc
        );
      }
    } else if (contains(currentNode, offset, inclusive)) {
      return path;
    }
    return path.concat(doc.createNode(null)); // empty node as indentation marker
  }
  return null;
}

export function getYamlMapKeys(mapNode: YAMLMap): Array<string> {
  return mapNode.items.map((pair) => {
    if (pair.key && isScalar(pair.key)) {
      return (pair.key.value as any).toString();
    }
    return undefined;
  });
}

export function getOrigRange(
  node: Node | null | undefined
): [number | undefined, number | undefined] | null | undefined {
  if (node?.range) {
    const range = node.range;
    return [range[0], range[1]];
  }
  return [node?.range?.[0], node?.range?.[1]];
}

/** Parsing with the YAML library tailored to the needs of this extension */
export function parseAllDocuments(str: string, options?: Options): Document[] {
  if (!str) {
    return [];
  }
  const docs = parseAllYamlDocuments(
    str,
    Object.assign({ keepSourceTokens: true, options })
  );
  return docs;
}
