## What is this?

This is a very early fork of `vscode-ansible` and `ansible-language-server` to provide support for YAML file editing of Backstage entities. The goal is for this repo to be the home of an additional few extensions for Backstage including `app-config.yaml` editing, Backstage deeplinking and Backstage error reporting in VSCode.

## Development

pre-step: ensure your VSCode is fully updated. None of the below steps will work if that is not the case.

1. Run `yarn` in both subdirectories in `packages/`.
2. Go to `Run and Debug` and then click the Green button next to `Both (src)` in the list.
3. Open an entity file. Assign the file type from YAML to `Backstage (Entity)`.
4. Edit.
