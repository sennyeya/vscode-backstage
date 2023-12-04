import IntervalTree from "@flatten-js/interval-tree";
import {
  Connection,
  CreateFile,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ValidationManager } from "../services/validationManager";
import { WorkspaceFolderContext } from "../services/workspaceManager";
import { parseAllDocuments } from "../utils/yaml";
import Ajv from "ajv";
import entitySchema from "../schema/Entity.schema.json";
import entityEnvelope from "../schema/EntityEnvelope.schema.json";
import entityMeta from "../schema/EntityMeta.schema.json";
import apiSchema from "../schema/API.schema.json";
import componentSchema from "../schema/Component.schema.json";
import commonSchema from "../schema/common.schema.json";
import improveErrors from "ajv-error-mapping";
import { toLspRange } from "../utils/misc";

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
    if (textDocument.uri === fileUri && connection) {
      fileDiagnostics.push(...getYamlValidation(textDocument));
      const jsonSchemaValidation = await getJsonSchemaValidation(
        textDocument,
        connection
      );
      fileDiagnostics.push(...(jsonSchemaValidation ?? []));
    }
  }
  validationManager.processDiagnostics(textDocument.uri, diagnosticsByFile);
  return diagnosticsByFile;
}

const ajv = new Ajv({
  allowUnionTypes: true,
  allErrors: true,
});

ajv.addSchema(apiSchema, "API");
ajv.addSchema(componentSchema, "Component");
ajv.addSchema(entitySchema);
ajv.addSchema(entityEnvelope);
ajv.addSchema(entityMeta);
ajv.addSchema(commonSchema);

async function getJsonSchemaValidation(
  textDocument: TextDocument,
  connection: Connection
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const yDocuments = parseAllDocuments(textDocument.getText());

  for (const yamlDoc of yDocuments) {
    const parsedYaml = yamlDoc.toJS();
    const validate = ajv.getSchema(parsedYaml.kind ?? "Entity");
    if (!validate) continue;
    const success = validate(parsedYaml);
    if (success) continue;
    const errors = improveErrors(validate.errors, entitySchema, {
      type: "yaml",
      document: yamlDoc,
    });
    console.log(validate.errors);
    await createOutputFile(
      textDocument,
      connection,
      JSON.stringify(validate.errors)
    );

    errors.forEach((error) => {
      const { start, end, title } = error;
      const startPosition = textDocument.positionAt(
        start !== undefined ? start : null
      );

      const endPosition = textDocument.positionAt(
        end !== undefined ? end : null
      );

      diagnostics.push({
        message: title,
        range: Range.create(startPosition, endPosition),
        source: "Backstage [YAML]",
      });
    });
  }
  return diagnostics;
}

export async function createOutputFile(
  textDocument: TextDocument,
  connection: Connection,
  data: string
) {
  // uri of new file
  const currentPath: string = textDocument.uri.substr(
    0,
    textDocument.uri.lastIndexOf("/")
  );

  const newuri = `${currentPath}/errors.json`;

  // construct a CreateFile variable
  const createFile: CreateFile = { kind: "create", uri: newuri };
  // and make into array
  const createFiles: CreateFile[] = [];
  createFiles.push(createFile);

  // make a new workspaceEdit variable, specifying a createFile document change
  let workspaceEdit: WorkspaceEdit = { documentChanges: createFiles };

  // pass to client to apply this edit
  await connection.workspace.applyEdit(workspaceEdit);

  // To insert the text (and pop up the window), create array of TextEdit
  const textEdit: TextEdit[] = [];
  // let document = documents.get(newuri);
  const documentRange: Range = Range.create(0, 0, 0, data.length);
  // populate with the text, and where to insert (surely this is what workspaceChange.insert is for?)
  const textEdits: TextEdit = { range: documentRange, newText: data };

  textEdit.push(textEdits);

  // make a new array of textDocumentEdits, containing our TextEdit (range and text)
  const textDocumentEdit = TextDocumentEdit.create(
    { uri: newuri, version: 1 },
    textEdit
  );
  const textDocumentEdits: TextDocumentEdit[] = [];
  textDocumentEdits.push(textDocumentEdit);

  // set  our workspaceEdit variable to this new TextDocumentEdit
  workspaceEdit = { documentChanges: textDocumentEdits };

  // and finally apply this to our workspace.
  // we can probably do this some more elegant way
  connection.workspace.applyEdit(workspaceEdit);
}

export function getYamlValidation(textDocument: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const yDocuments = parseAllDocuments(textDocument.getText(), {
    prettyErrors: false,
  });
  const rangeTree = new IntervalTree<Diagnostic>();
  yDocuments.forEach((yDoc) => {
    yDoc.errors.forEach((error) => {
      const range = toLspRange(error.pos, textDocument);
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
      if (error.linePos && error.linePos.length === 2) {
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
  return `${messageWithoutTraceback
    .replace(/at line [0-9]+, column [0-9]+/g, "")
    .trim()}.`;
}
