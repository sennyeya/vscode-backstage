import { ErrorObject } from "ajv";
import { Document, Scalar } from "yaml";
import { AjvError, DeduplicatedAjvError } from "./errors/AjvError";
import { mapping } from "./errors/ErrorMapping";

function getParts(jsonRef: string) {
  return jsonRef
    .replace(/^\//, "")
    .split("/")
    .map((e) => e.replace("~1", "/"));
}

export function getRangeForInstancePath(
  jsonRef: string | string[],
  document: Document
): { start: number | undefined; end: number | undefined } {
  let parts = jsonRef;
  if (!Array.isArray(jsonRef)) {
    parts = getParts(jsonRef);
  }
  const node = document.getIn(parts, true);
  if (!node) {
    return getRangeForInstancePath(parts.slice(0, parts.length - 1), document);
  }
  const range = (node as Scalar).range;
  return {
    start: range?.[0],
    end: range?.[1],
  };
}

export function improveErrors(
  errors: ErrorObject[],
  schema: unknown,
  options: {
    type: "yaml";
    document: Document;
  }
) {
  // 1. take AJV errors and get a readable set of _deduplicated_ error messages.
  // 2. be able to map from an AJV error to a string in YAML.
  const aggregatedErrors: AjvError[] = [];
  for (const error of errors) {
    const errorObj: AjvError = new mapping[error.keyword]({
      ajvError: error,
    });
    aggregatedErrors.push(errorObj);
  }

  const deduplicatedErrors = AjvError.deduplicate(aggregatedErrors);

  const outputErrors: { title: string; start: number; end: number }[] = [];

  const addMapToErrors = (
    map: Map<string, Map<string, DeduplicatedAjvError<string[]>>>
  ) => {
    map.forEach((propertyMap, instancePath) => {
      propertyMap.forEach((property) => {
        const range = getRangeForInstancePath(instancePath, options.document);

        outputErrors.push({
          title: property.message,
          ...range,
        });
      });
    });
  };

  addMapToErrors(deduplicatedErrors);

  return outputErrors;
}
