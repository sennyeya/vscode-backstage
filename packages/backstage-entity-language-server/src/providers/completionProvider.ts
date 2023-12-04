/* eslint-disable @typescript-eslint/no-shadow */
import { EOL } from "os";
import {
  CompletionItem,
  CompletionItemKind,
  MarkupContent,
  Position,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { isScalar, Node } from "yaml";
import { IOption } from "../interfaces/module";
import { WorkspaceFolderContext } from "../services/workspaceManager";
import { insert, toLspRange } from "../utils/misc";

const priorityMap = {
  nameKeyword: 1,
  moduleName: 2,
  redirectedModuleName: 3,
  keyword: 4,
  // options
  requiredOption: 1,
  option: 2,
  aliasOption: 3,
  // choices
  defaultChoice: 1,
  choice: 2,
};

let dummyMappingCharacter: string;
let isAnsiblePlaybook: boolean;

export async function doCompletion(
  document: TextDocument,
  position: Position,
  context: WorkspaceFolderContext
): Promise<CompletionItem[] | null> {
  isAnsiblePlaybook = true;

  let preparedText = document.getText();
  const offset = document.offsetAt(position);

  // HACK: We need to insert a dummy mapping, so that the YAML parser can properly recognize the scope.
  // This is particularly important when parser has nothing more than indentation to
  // determine the scope of the current line.

  // This is handled w.r.t two scenarios:
  // 1. When we are at the key level, we use `_:` since we expect to work on a pair level.
  // 2. When we are at the value level, we use `__`. We do this because based on the above hack, the
  // use of `_:` at the value level creates invalid YAML as `: ` is an incorrect token in yaml string scalar

  dummyMappingCharacter = "_:";

  const previousCharactersOfCurrentLine = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: position.character },
  });

  if (previousCharactersOfCurrentLine.includes(": ")) {
    // this means we have encountered ": " previously in the same line and thus we are
    // at the value level
    dummyMappingCharacter = "__";
  }

  preparedText = insert(preparedText, offset, dummyMappingCharacter);
  return null;
}

function getKeywordCompletion(
  document: TextDocument,
  position: Position,
  path: Node[],
  keywords: Map<string, string | MarkupContent>
): CompletionItem[] {
  // find options that have been already provided by the user
  const providedParams = new Set();

  const remainingParams = [...keywords.entries()].filter(
    ([keyword]) => !providedParams.has(keyword)
  );
  const nodeRange = getNodeRange(path[path.length - 1], document);
  return remainingParams.map(([keyword, description]) => {
    const priority =
      keyword === "name" ? priorityMap.nameKeyword : priorityMap.keyword;
    const completionItem: CompletionItem = {
      label: keyword,
      kind: CompletionItemKind.Property,
      sortText: `${priority}_${keyword}`,
      documentation: description,
    };
    const insertText = atEndOfLine(document, position)
      ? `${keyword}:`
      : keyword;
    if (nodeRange) {
      completionItem.textEdit = {
        range: nodeRange,
        newText: insertText,
      };
    } else {
      completionItem.insertText = insertText;
    }
    return completionItem;
  });
}

function getHostCompletion(hostObjectList): CompletionItem[] {
  return hostObjectList.map(({ host, priority }) => {
    const completionItem: CompletionItem = {
      label: host,
      sortText: `${priority}_${host}`,
      kind: [1, 2].includes(priority)
        ? CompletionItemKind.Variable
        : CompletionItemKind.Value,
    };
    return completionItem;
  });
}

/**
 * Returns an LSP formatted range compensating for the DUMMY MAPPING hack, provided that
 * the node has range information and is a string scalar.
 */
function getNodeRange(node: Node, document: TextDocument): Range | undefined {
  const range = Range.create(Position.create(0, 0), Position.create(0, 0));
  if (range && isScalar(node) && typeof node.value === "string") {
    const start = range[0];
    let end = range[1];
    // compensate for DUMMY MAPPING
    if (node.value.includes(dummyMappingCharacter)) {
      end -= 2;
    } else {
      // colon, being at the end of the line, was excluded from the node
      end -= 1;
    }
    return toLspRange([start, end], document);
  }
  return undefined;
}

export async function doCompletionResolve(
  completionItem: CompletionItem,
  context: WorkspaceFolderContext
): Promise<CompletionItem> {
  if (completionItem.data?.type) {
    // resolve completion for a module option or sub-option

    const insertText = completionItem.data.atEndOfLine
      ? `${completionItem.label}:${resolveSuffix(
          completionItem.data.type,
          completionItem.data.firstElementOfList,
          isAnsiblePlaybook
        )}`
      : `${completionItem.label}`;

    if (completionItem.textEdit) {
      completionItem.textEdit.newText = insertText;
    } else {
      completionItem.insertText = insertText;
    }
  }
  return completionItem;
}

function isAlias(option: { name: string; specs: IOption }): boolean {
  return option.name !== option.specs.name;
}

function atEndOfLine(document: TextDocument, position: Position): boolean {
  const charAfterCursor = `${document.getText()}\n`[
    document.offsetAt(position)
  ];
  return charAfterCursor === "\n" || charAfterCursor === "\r";
}

/**
 * A utility function to check if the item is the first element of a list or not
 * @param document current document
 * @param nodeRange range of the keyword in the document
 * @returns {boolean} true if the key is the first element of the list, else false
 */
function firstElementOfList(document: TextDocument, nodeRange: Range): boolean {
  const checkNodeRange = {
    start: { line: nodeRange.start.line, character: 0 },
    end: nodeRange.start,
  };
  const elementsBeforeKey = document.getText(checkNodeRange).trim();

  return elementsBeforeKey === "-";
}

export function resolveSuffix(
  optionType: string,
  firstElementOfList: boolean,
  isDocPlaybook: boolean
) {
  let returnSuffix: string;

  if (isDocPlaybook) {
    // if doc is a playbook, indentation will shift one tab since a play is a list
    switch (optionType) {
      case "list":
        returnSuffix = firstElementOfList ? `${EOL}\t\t- ` : `${EOL}\t- `;
        break;
      case "dict":
        returnSuffix = firstElementOfList ? `${EOL}\t\t` : `${EOL}\t`;
        break;
      default:
        returnSuffix = " ";
        break;
    }
  } else {
    // if doc is not a playbook (any other ansible file like task file, etc.) indentation will not
    // include that extra tab
    switch (optionType) {
      case "list":
        returnSuffix = `${EOL}\t- `;
        break;
      case "dict":
        returnSuffix = `${EOL}\t`;
        break;
      default:
        returnSuffix = " ";
        break;
    }
  }

  return returnSuffix;
}
