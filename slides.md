# Goal

Backstage needs support for IDE editing of entities.

# Problem Statement

To implement this, we need to create our own Backstage Entity language server, because RedHat YAML language plugin doesn't support network calls during hover + validation.

# Step 1

Create a YAML parser + new file language.

# Step 2

Validate against existing Backstage entity JSON schema.

# Step 3

Integrate with `validate-entity` endpoint and give actionable feedback based on errors.

# Step 4

In-IDE completions, hover, and deep linking.
