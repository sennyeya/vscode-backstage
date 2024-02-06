import { AjvError } from "./AjvError";

export class TypeError extends AjvError {
  getMessage(): string {
    return `type: "${this.getValue()}" expected`;
  }

  getValue() {
    return this.error.params.type;
  }
}
