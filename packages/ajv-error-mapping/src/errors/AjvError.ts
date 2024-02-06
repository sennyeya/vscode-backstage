import { ErrorObject } from "ajv";

export interface AjvErrorProperties {
  ajvError: ErrorObject;
}

export interface DeduplicatedAjvError<T> {
  items: T;
  message: string;
}

export abstract class AjvError {
  error: ErrorObject;

  constructor(properties: AjvErrorProperties) {
    this.error = properties.ajvError;
  }

  abstract getMessage(): string;

  getValue(): string | undefined {
    return undefined;
  }

  collect(): {
    instancePath: string;
    property: string;
    value: string;
  } {
    return {
      instancePath: this.error.instancePath,
      property: this.error.schemaPath,
      value: this.getValue(),
    };
  }

  static deduplicate(errors: AjvError[]) {
    const perInstancePath: Map<
      string,
      Map<string, DeduplicatedAjvError<string[]>>
    > = new Map();
    const perInstancePathDuplicated: Map<
      string,
      Map<string, DeduplicatedAjvError<Set<string>>>
    > = new Map();
    for (const error of errors) {
      const errorInformation = error.collect();
      if (!perInstancePathDuplicated.has(errorInformation.instancePath)) {
        perInstancePathDuplicated.set(errorInformation.instancePath, new Map());
      }
      const atPath = perInstancePathDuplicated.get(
        errorInformation.instancePath
      );
      if (!atPath.has(errorInformation.value)) {
        atPath.set(errorInformation.value, {
          items: new Set(),
          message: error.getMessage(),
        });
      }
      atPath.get(errorInformation.value).items.add(errorInformation.property);
    }

    perInstancePathDuplicated.forEach((perProperty, key) => {
      if (!perInstancePath.has(key)) {
        perInstancePath.set(key, new Map());
      }
      const atPath = perInstancePath.get(key);
      perProperty.forEach((uniqueValues, property) => {
        atPath.set(property, {
          items: [...uniqueValues.items],
          message: uniqueValues.message,
        });
      });
    });

    return perInstancePath;
  }
}
