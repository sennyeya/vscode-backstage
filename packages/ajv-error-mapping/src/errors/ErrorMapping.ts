import { AdditionalPropertiesError } from "./AdditionalPropertiesError";
import { EnumError } from "./EnumError";
import { RequiredError } from "./RequiredError";
import { TypeError } from "./TypeError";

export const mapping = {
  enum: EnumError,
  required: RequiredError,
  additionalProperties: AdditionalPropertiesError,
  type: TypeError,
};
