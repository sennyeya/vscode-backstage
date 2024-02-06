import { AjvError } from "./AjvError";

export class EnumError extends AjvError {
  getMessage(): string {
    return `the only valid options are "${this.getValue()}"`;
  }

  getValue() {
    return this.error.params.allowedValues.join(",");
  }
}
