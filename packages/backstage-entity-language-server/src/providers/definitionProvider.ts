import { DefinitionLink, Range } from "vscode-languageserver";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { isScalar } from "yaml";
import { toLspRange } from "../utils/misc";
import {
  AncestryBuilder,
  getOrigRange,
  getPathAt,
  isTaskParam,
  parseAllDocuments,
} from "../utils/yaml";

export async function getDefinition(
  document: TextDocument,
  position: Position
): Promise<DefinitionLink[] | null> {
  return null;
}
