import { AjvError } from './AjvError';

export class AdditionalPropertiesError extends AjvError {
  getMessage(): string {
    return `property "${this.getValue()}" is not allowed`;
  }

  getValue(): string {
    return this.error.params.additionalProperty;
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
}
