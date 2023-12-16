import { ErrorObject } from "ajv";
import { Document, Scalar } from "yaml";

function getParts(jsonRef: string) {
  return jsonRef
    .replace(/^\//, "")
    .split("/")
    .map((e) => e.replace("~1", "/"));
}

function getRangeForInstancePath(
  jsonRef: string | string[],
  document: Document
) {
  let parts = jsonRef;
  if (!Array.isArray(jsonRef)) {
    parts = getParts(jsonRef);
  }
  const node = document.getIn(parts, true);
  if (!node) {
    return getRangeForInstancePath(parts.slice(0, parts.length - 1), document);
  }
  return (node as Scalar).range;
}

export default function improveErrors(
  errors: ErrorObject[],
  schema: unknown,
  options: {
    type: "yaml";
    document: Document;
  }
) {
  // 1. take AJV errors and get a readable set of _deduplicated_ error messages.
  // 2. be able to map from an AJV error to a string in YAML.

  const required: Record<string, Record<string, Set<string>>> = {};
  const additionalProperties: Record<string, Record<string, Set<string>>> = {};
  const type: Record<string, Record<string, Set<string>>> = {};
  const enums: Record<string, string[]> = {};

  for (const error of errors) {
    if (error.keyword === "required") {
      if (!(error.instancePath in required)) {
        required[error.instancePath] = {};
      }
      const atPath = required[error.instancePath];
      if (!(error.params.missingProperty in atPath)) {
        atPath[error.params.missingProperty] = new Set();
      }
      atPath[error.params.missingProperty].add(error.schemaPath);
    } else if (error.keyword === "additionalProperties") {
      if (!(error.instancePath in additionalProperties)) {
        additionalProperties[error.instancePath] = {};
      }
      const atPath = additionalProperties[error.instancePath];
      if (!(error.params.additionalProperty in atPath)) {
        atPath[error.params.additionalProperty] = new Set();
      }
      atPath[error.params.additionalProperty].add(error.schemaPath);
    } else if (error.keyword === "enum") {
      if (!(error.instancePath in enums)) {
        enums[error.instancePath] = [];
      }
      const atPath = enums[error.instancePath];
      if (atPath.length === 0) {
        atPath.push(...error.params.allowedValues);
      }
    } else if (error.keyword === "type") {
      if (!(error.instancePath in type)) {
        type[error.instancePath] = {};
      }
      const atPath = type[error.instancePath];
      if (!(error.params.type in atPath)) {
        atPath[error.params.type] = new Set();
      }
      atPath[error.params.type].add(error.schemaPath);
    }
  }

  [required, additionalProperties].forEach((map) =>
    Object.values(map).forEach((val) => {
      Object.keys(val).forEach((key) => {
        val[key] = [...val[key]] as any;
      });
    })
  );

  const outputErrors: { title: string; start: number; end: number }[] = [];

  const addMapToErrors = (
    map: Record<string, Record<string, any>>,
    prefix: string
  ) => {
    Object.entries(map).forEach(([instancePath, propertyMap]) => {
      Object.keys(propertyMap).forEach((property) => {
        const range = getRangeForInstancePath(instancePath, options.document);

        outputErrors.push({
          title: `${prefix} "${property}"`,
          start: range?.[0],
          end: range?.[1],
        });
      });
    });
  };
  const errorMessages = [
    "missing required property",
    "additional property",
    "invalid type",
  ];

  [required, additionalProperties, type].forEach((map, index) =>
    addMapToErrors(map, errorMessages[index])
  );
  Object.entries(enums).forEach(([instancePath, values]) => {
    const range = getRangeForInstancePath(instancePath, options.document);
    outputErrors.push({
      title: `'${instancePath}' must be of type "${values}"`,
      start: range?.[0],
      end: range?.[1],
    });
  });

  //   console.log(JSON.stringify(required, undefined, 2));
  //   console.log(JSON.stringify(additionalProperties, undefined, 2));
  //   console.log(errors);
  return outputErrors;
}
