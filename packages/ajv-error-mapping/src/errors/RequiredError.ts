import { AjvError } from './AjvError';

export class RequiredError extends AjvError {
  getMessage(): string {
    return `"${this.getValue()}" is required but missing.`;
  }

  getValue() {
    return this.error.params.missingProperty;
  }
}
