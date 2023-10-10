import IntervalTree from "@flatten-js/interval-tree";
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ValidationManager } from "../services/validationManager";
import { WorkspaceFolderContext } from "../services/workspaceManager";
import { isPlaybook, parseAllDocuments } from "../utils/yaml";
import { CommandRunner } from "../utils/commandRunner";

/**
 * Validates the given document.
 * @param textDocument - the document to validate
 * @param linter - uses linter
 * @param quick - only re-evaluates YAML validation and uses lint cache
 * @returns Map of diagnostics per file.
 */
export async function doValidate(
  textDocument: TextDocument,
  validationManager: ValidationManager,
  quick = true,
  context?: WorkspaceFolderContext,
  connection?: Connection
): Promise<Map<string, Diagnostic[]>> {
  let diagnosticsByFile = new Map<string, Diagnostic[]>();
  console.log(quick, context);
  if (quick || !context) {
    // get validation from cache
    diagnosticsByFile =
      validationManager.getValidationFromCache(textDocument.uri) ||
      new Map<string, Diagnostic[]>();
  } else {
    if (!diagnosticsByFile.has(textDocument.uri)) {
      // In case there are no diagnostics for the file that triggered the
      // validation, set an empty array in order to clear the validation.
      diagnosticsByFile.set(textDocument.uri, []);
    }
    validationManager.cacheDiagnostics(textDocument.uri, diagnosticsByFile);
  }

  // attach quick validation for the inspected file
  for (const [fileUri, fileDiagnostics] of diagnosticsByFile) {
    if (textDocument.uri === fileUri) {
      fileDiagnostics.push(...getYamlValidation(textDocument));
    }
  }
  validationManager.processDiagnostics(textDocument.uri, diagnosticsByFile);
  return diagnosticsByFile;
}

export function getYamlValidation(textDocument: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const yDocuments = parseAllDocuments(textDocument.getText());
  console.log(yDocuments);
  const rangeTree = new IntervalTree<Diagnostic>();
  yDocuments.forEach((yDoc) => {
    yDoc.errors.forEach((error) => {
      const [errStart, errEnd] = error.pos;
      if (errStart) {
        const start = textDocument.positionAt(
          errStart !== undefined ? errStart : null
        );

        const end = textDocument.positionAt(
          errEnd !== undefined ? errEnd : null
        );

        const range = Range.create(start, end);

        let severity: DiagnosticSeverity;
        switch (error.name) {
          case "YAMLParseError":
            severity = DiagnosticSeverity.Error;
            break;
          case "YAMLWarning":
            severity = DiagnosticSeverity.Warning;
            break;
          default:
            severity = DiagnosticSeverity.Information;
            break;
        }
        rangeTree.insert([error.linePos[0].line, error.linePos[1].line], {
          message: scrubYamlErrorMessage(error.message),
          range: range || Range.create(0, 0, 0, 0),
          severity,
          source: "Backstage [YAML]",
        });
      }
    });
  });
  rangeTree.forEach((range, diag) => {
    diagnostics.push(diag);
  });

  return diagnostics;
}

function scrubYamlErrorMessage(message: string) {
  console.log(message);
  const messageWithoutTraceback = message.slice(0, message.indexOf(":\n\n"));
  return (
    messageWithoutTraceback
      .replace(/at line [0-9]+, column [0-9]+/g, "")
      .trim() + "."
  );
}
